#!/usr/bin/env python3
"""A network lab for the DPI engine (needs root, iproute2, openssl, curl).

Four network namespaces form a path with two router hops:

    client (vc) --- gateway (vg) --- dpi box (vd) --- server (vs)

* The client runs the engine (`voxel-dpi`) and curl. Packets it sends with TTL 1 die at the gateway; packets with
  TTL 2 reach the DPI box but die when the box forwards them, so a decoy segment with `fake=2` is seen by the DPI
  and never by the server, exactly as the TTL tricks are meant to work on a real network.
* The DPI box sniffs the client-to-server packets (AF_PACKET) and, like a middlebox that injects resets, kills
  every connection whose TLS ClientHello names `blocked.test`, using one of three models:
    packet  looks for the name in every packet on its own (no reassembly)
    reasm   reassembles the stream (first data seen wins) and reads the SNI of the first TLS record only
    strict  like reasm, but gives up on a flow when it does not see the start of the stream
* The server is `openssl s_server`, one instance per model port, so the TLS handshake and the HTTP answer are real.

Every case runs curl through the engine with a strategy and says whether the connection got through. The cases
include controls that must fail (no engine, an engine that does nothing, a strategy the model is immune to), so a
pass means the strategy beat the model and not that the model was lax.

    sudo python3 dpi_lab.py --engine build/dpi/voxel-dpi [--report report.txt]
"""

import argparse
import os
import shutil
import signal
import socket
import struct
import subprocess
import sys
import tempfile
import time

SERVER_IP = "10.88.3.2"
CLIENT_IP = "10.88.1.2"
BLOCKED = "blocked.test"
ALLOWED = "allowed.test"
MODEL_PORTS = {443: "packet", 444: "reasm", 445: "strict"}
NO_DPI_PORT = 446
NAMESPACES = ("vc", "vg", "vd", "vs")
USER, PASSWORD = "lab", "lab-pass"


# --------------------------------------------------------------------------------------------- the DPI box


def parse_hello(data):
    """What a DPI that reads only the first TLS record sees: ('need',), ('allow', why) or ('sni', name)."""
    if len(data) < 5:
        return ("need",)
    if data[0] != 0x16 or data[1] != 3:
        return ("allow", "not TLS")
    record = int.from_bytes(data[3:5], "big")
    if len(data) < 9:
        return ("need",)
    if data[5] != 1:
        return ("allow", "not a ClientHello")
    if 4 + int.from_bytes(data[6:9], "big") > record:
        return ("allow", "the hello spans several records")
    end = min(len(data), 5 + record)
    p = 5 + 4 + 2 + 32

    def short(n):
        return p + n > end

    if short(1):
        return ("need",)
    p += 1 + data[p]
    if short(2):
        return ("need",)
    p += 2 + int.from_bytes(data[p:p + 2], "big")
    if short(1):
        return ("need",)
    p += 1 + data[p]
    if short(2):
        return ("need",)
    p += 2
    while p + 4 <= end:
        kind = int.from_bytes(data[p:p + 2], "big")
        length = int.from_bytes(data[p + 2:p + 4], "big")
        p += 4
        if kind == 0:
            if short(5):
                return ("need",)
            name_length = int.from_bytes(data[p + 3:p + 5], "big")
            if short(5 + name_length):
                return ("need",)
            return ("sni", data[p + 5:p + 5 + name_length].decode("latin1"))
        p += length
    return ("need",) if len(data) < 5 + record else ("allow", "no SNI")


def checksum(data):
    if len(data) % 2:
        data += b"\0"
    total = sum(struct.unpack("!%dH" % (len(data) // 2), data))
    while total >> 16:
        total = (total & 0xFFFF) + (total >> 16)
    return ~total & 0xFFFF


def reset_packet(src, dst, sport, dport, seq):
    tcp = struct.pack("!HHIIBBHHH", sport, dport, seq & 0xFFFFFFFF, 0, 5 << 4, 0x04, 0, 0, 0)
    pseudo = socket.inet_aton(src) + socket.inet_aton(dst) + struct.pack("!BBH", 0, 6, len(tcp))
    tcp = tcp[:16] + struct.pack("!H", checksum(pseudo + tcp)) + tcp[18:]
    ip = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 20 + len(tcp), 0, 0, 64, 6, 0, socket.inet_aton(src), socket.inet_aton(dst))
    return ip + tcp


class Flow:
    def __init__(self, isn, model):
        self.isn = isn
        self.model = model
        self.done = False
        self.seen_payload = False
        self.data = bytearray()
        self.filled = bytearray()

    def store(self, offset, payload):
        if offset > 65536:
            return
        end = offset + len(payload)
        if len(self.data) < end:
            self.data.extend(b"\0" * (end - len(self.data)))
            self.filled.extend(b"\0" * (end - len(self.filled)))
        for i, byte in enumerate(payload):
            if not self.filled[offset + i]:  # the first data seen for a position wins
                self.data[offset + i] = byte
                self.filled[offset + i] = 1

    def contiguous(self):
        n = self.filled.find(b"\0")
        return bytes(self.data if n < 0 else self.data[:n])


def run_sniffer(args):
    sniffer = socket.socket(socket.AF_PACKET, socket.SOCK_RAW, socket.htons(0x0800))
    sniffer.bind((args.iface, 0))
    injector = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_RAW)
    server = socket.inet_aton(SERVER_IP)
    flows = {}
    stats = {"blocked": 0, "allowed": 0, "ignored": 0}
    log = open(args.log, "w", buffering=1)
    debug = bool(os.environ.get("DPI_LAB_DEBUG"))
    running = [True]
    signal.signal(signal.SIGTERM, lambda *_: running.__setitem__(0, False))
    open(args.ready, "w").close()

    def note(text):
        log.write("%.3f %s\n" % (time.time(), text))

    def block(key, client, sport, dport, seq, ack, payload):
        stats["blocked"] += 1
        note("BLOCK %s:%d -> :%d (%s)" % (client, sport, dport, MODEL_PORTS[dport]))
        for _ in range(2):
            injector.sendto(reset_packet(SERVER_IP, client, dport, sport, ack), (client, 0))
            injector.sendto(reset_packet(client, SERVER_IP, sport, dport, seq + len(payload)), (SERVER_IP, 0))

    while running[0]:
        sniffer.settimeout(0.2)
        try:
            frame = sniffer.recv(65535)
        except socket.timeout:
            continue
        ip = frame[14:]
        if len(ip) < 20 or ip[0] >> 4 != 4 or ip[9] != 6 or ip[16:20] != server:
            continue
        header = (ip[0] & 15) * 4
        tcp = ip[header:struct.unpack("!H", ip[2:4])[0]]
        if len(tcp) < 20:
            continue
        sport, dport, seq, ack, offset_flags = struct.unpack("!HHIIH", tcp[:14])
        if dport not in MODEL_PORTS:
            continue
        flags = offset_flags & 0x3F
        payload = tcp[(offset_flags >> 12) * 4:]
        client = socket.inet_ntoa(ip[12:16])
        key = (client, sport, dport)
        if flags & 0x02 and not flags & 0x10:
            flows[key] = Flow(seq, MODEL_PORTS[dport])
            continue
        flow = flows.get(key)
        if debug and flow is not None and payload:
            note("PACKET %s:%d -> :%d offset=%d len=%d ttl=%d flags=%02x head=%s" % (
                client, sport, dport, (seq - flow.isn - 1) & 0xFFFFFFFF, len(payload), ip[8], flags, payload[:6].hex()))
        if flow is None or flow.done or not payload:
            continue
        if flow.model == "packet":
            if BLOCKED.encode() in payload.lower():
                flow.done = True
                block(key, client, sport, dport, seq, ack, payload)
            continue
        offset = (seq - flow.isn - 1) & 0xFFFFFFFF
        if not flow.seen_payload:
            flow.seen_payload = True
            if flow.model == "strict" and offset != 0:
                flow.done = True
                stats["ignored"] += 1
                note("IGNORE %s:%d (%s): the first payload I saw starts at offset %d" % (client, sport, flow.model, offset))
                continue
        flow.store(offset, payload)
        verdict = parse_hello(flow.contiguous())
        if verdict[0] == "need":
            continue
        flow.done = True
        if verdict[0] == "sni":
            note("SNI %s:%d (%s) = %s" % (client, sport, flow.model, verdict[1]))
            if verdict[1].lower() == BLOCKED:
                block(key, client, sport, dport, seq, ack, payload)
            else:
                stats["allowed"] += 1
        else:
            note("ALLOW %s:%d (%s): %s" % (client, sport, flow.model, verdict[1]))
            stats["allowed"] += 1
    note("STATS %s" % stats)


# ------------------------------------------------------------------------------------------ the lab itself


def sh(*cmd, check=True, **kwargs):
    return subprocess.run(cmd, check=check, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, **kwargs)


def in_ns(name, *cmd):
    return ("ip", "netns", "exec", name) + cmd


def teardown():
    for name in NAMESPACES:
        sh("ip", "netns", "del", name, check=False)


def build_lab():
    teardown()
    for name in NAMESPACES:
        sh("ip", "netns", "add", name)
        sh(*in_ns(name, "ip", "link", "set", "lo", "up"))
    for a, ns_a, b, ns_b in (("c0", "vc", "g0", "vg"), ("g1", "vg", "d0", "vd"), ("d1", "vd", "s0", "vs")):
        sh("ip", "link", "add", a, "type", "veth", "peer", "name", b)
        sh("ip", "link", "set", a, "netns", ns_a)
        sh("ip", "link", "set", b, "netns", ns_b)
    addresses = (("vc", "c0", "10.88.1.2/24"), ("vg", "g0", "10.88.1.1/24"), ("vg", "g1", "10.88.2.1/24"),
                 ("vd", "d0", "10.88.2.2/24"), ("vd", "d1", "10.88.3.1/24"), ("vs", "s0", "10.88.3.2/24"))
    for name, dev, cidr in addresses:
        sh(*in_ns(name, "ip", "addr", "add", cidr, "dev", dev))
        sh(*in_ns(name, "ip", "link", "set", dev, "up"))
    sh(*in_ns("vc", "ip", "route", "add", "default", "via", "10.88.1.1"))
    sh(*in_ns("vg", "ip", "route", "add", "10.88.3.0/24", "via", "10.88.2.2"))
    sh(*in_ns("vd", "ip", "route", "add", "10.88.1.0/24", "via", "10.88.2.1"))
    sh(*in_ns("vs", "ip", "route", "add", "default", "via", "10.88.3.1"))
    for name in ("vg", "vd"):
        sh(*in_ns(name, "sysctl", "-qw", "net.ipv4.ip_forward=1"))
    # The lab itself must work before anything is tested with it.
    ping = sh(*in_ns("vc", "ping", "-c", "1", "-W", "2", SERVER_IP), check=False)
    if ping.returncode != 0:
        raise RuntimeError("the lab network does not route: " + ping.stdout)
    ttl1 = sh(*in_ns("vc", "ping", "-c", "1", "-W", "1", "-t", "1", SERVER_IP), check=False)
    if ttl1.returncode == 0:
        raise RuntimeError("a TTL 1 packet reached the server; the lab has no gateway hop")


class Lab:
    def __init__(self, engine, workdir):
        self.engine = engine
        self.workdir = workdir
        self.processes = []

    def start(self):
        build_lab()
        cert, key = os.path.join(self.workdir, "cert.pem"), os.path.join(self.workdir, "key.pem")
        sh("openssl", "req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-keyout", key,
           "-out", cert, "-subj", "/CN=lab", "-days", "1")
        for port in list(MODEL_PORTS) + [NO_DPI_PORT]:
            self.processes.append(subprocess.Popen(
                in_ns("vs", "openssl", "s_server", "-accept", "%s:%d" % (SERVER_IP, port), "-cert", cert, "-key", key, "-www", "-quiet"),
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL))
        ready = os.path.join(self.workdir, "sniffer.ready")
        self.sniffer_log = os.path.join(self.workdir, "sniffer.log")
        self.processes.append(subprocess.Popen(
            in_ns("vd", sys.executable, os.path.abspath(__file__), "sniffer", "--iface", "d0", "--log", self.sniffer_log, "--ready", ready)))
        for _ in range(100):
            if os.path.exists(ready):
                break
            time.sleep(0.1)
        else:
            raise RuntimeError("the sniffer did not come up")
        for port in list(MODEL_PORTS) + [NO_DPI_PORT]:
            for _ in range(50):
                probe = sh(*in_ns("vc", "curl", "-sk", "-o", "/dev/null", "--max-time", "3", "https://%s:%d/" % (SERVER_IP, port)), check=False)
                if probe.returncode == 0:
                    break
                time.sleep(0.1)
            else:
                raise RuntimeError("the TLS server on port %d does not answer" % port)

    def stop(self):
        for process in self.processes:
            process.terminate()
        for process in self.processes:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
        teardown()

    def fetch(self, port, strategy, name=BLOCKED):
        """Runs curl for `name` against the server on `port`, through the engine unless strategy is None."""
        engine = None
        proxy = []
        try:
            if strategy is not None:
                engine = subprocess.Popen(in_ns("vc", self.engine, "--user", USER, "--pass", PASSWORD, "--strategy", strategy),
                                          stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                line = engine.stdout.readline()
                if not line.startswith("READY"):
                    return False, "engine did not start: " + engine.stderr.read()[:300], 0.0
                proxy = ["--proxy", "socks5://%s:%s@127.0.0.1:%s" % (USER, PASSWORD, line.split()[1])]
            started = time.time()
            result = sh(*in_ns("vc", "curl", "-sk", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "12", *proxy,
                               "--connect-to", "%s:%d:%s:%d" % (name, port, SERVER_IP, port), "https://%s:%d/" % (name, port)), check=False)
            elapsed = time.time() - started
            detail = "http %s" % result.stdout.strip() if result.returncode == 0 else "curl exit %d" % result.returncode
            return result.returncode == 0 and result.stdout.strip() == "200", detail, elapsed
        finally:
            if engine is not None:
                engine.send_signal(signal.SIGTERM)
                try:
                    engine.communicate(timeout=6)
                except subprocess.TimeoutExpired:
                    engine.kill()


# (the model's port, strategy or None for no engine at all, name in the hello, does the connection get through?)
CASES = (
    (NO_DPI_PORT, None, BLOCKED, True, "no DPI on this path: the lab and the server work"),
    (443, None, BLOCKED, False, "packet model blocks the name"),
    (443, None, ALLOWED, True, "packet model lets another name through"),
    (443, "off", BLOCKED, False, "the engine alone does not help"),
    (443, "light", BLOCKED, True, "TCP split hides the name from a per-packet scan"),
    (443, "tlsrec=sni+2", BLOCKED, True, "a record header inside the name breaks the scan"),
    (444, None, BLOCKED, False, "reassembling model blocks the name"),
    (444, None, ALLOWED, True, "reassembling model lets another name through"),
    (444, "light", BLOCKED, False, "control: a reassembling DPI is immune to TCP split"),
    (444, "standard", BLOCKED, True, "TLS records cut inside the name beat a first-record parser"),
    (444, "fake=2;split=sni+2;hold=30", BLOCKED, True, "a decoy hello with TTL 2 is all the DPI sees first"),
    (444, "oob=sni+2", BLOCKED, True, "an urgent byte inside the name corrupts what the DPI reads"),
    (445, None, BLOCKED, False, "strict model blocks the name"),
    (445, "light", BLOCKED, False, "control: strict model sees the whole stream despite TCP split"),
    (445, "disorder=1", BLOCKED, True, "a first segment held back by TTL 1 hides the start of the stream"),
    (445, "strong", BLOCKED, True, "the strong preset beats the strict model"),
    (NO_DPI_PORT, "standard", BLOCKED, True, "split + records work against a plain server"),
    (NO_DPI_PORT, "strong", BLOCKED, True, "disorder retransmits and the handshake completes"),
    (NO_DPI_PORT, "fake=2", BLOCKED, True, "the decoy dies before the server; the real hello is retransmitted"),
    (NO_DPI_PORT, "fake=2;split=sni+2;delay=5;hold=30", BLOCKED, True, "decoy + split + delay"),
    (NO_DPI_PORT, "oob=sni+2;disorder=1", BLOCKED, True, "urgent byte and held-back segment together"),
)


def run_lab(args):
    if os.geteuid() != 0:
        print("the lab needs root (network namespaces)", file=sys.stderr)
        return 2
    engine = os.path.abspath(args.engine)
    workdir = tempfile.mkdtemp(prefix="dpi-lab-")
    lab = Lab(engine, workdir)
    rows = []
    failures = 0
    try:
        lab.start()
        for port, strategy, name, expected, why in CASES:
            if args.only and args.only not in (strategy or "(no engine)"):
                continue
            ok, detail, seconds = lab.fetch(port, strategy, name)
            verdict = "PASS" if ok == expected else "FAIL"
            failures += verdict == "FAIL"
            model = MODEL_PORTS.get(port, "none")
            rows.append("%s  %-6s %-30s %-7s got %-8s expected %-8s %5.2fs  %s" % (
                verdict, model, strategy if strategy is not None else "(no engine)", name.split(".")[0], "through" if ok else "blocked",
                "through" if expected else "blocked", seconds, why))
            print(rows[-1], flush=True)
        time.sleep(0.3)
    except Exception as error:  # the report must say what broke the lab itself
        failures += 1
        rows.append("FAIL  lab: %s" % error)
        print(rows[-1], file=sys.stderr)
    finally:
        lab.stop()
    log = ""
    if os.path.exists(os.path.join(workdir, "sniffer.log")):
        with open(os.path.join(workdir, "sniffer.log")) as handle:
            log = handle.read()
    summary = "DPI lab: %d cases, %d failed" % (len(rows), failures)
    print(summary)
    if args.report:
        with open(args.report, "w") as handle:
            handle.write(summary + "\n" + "\n".join(rows) + "\n")
            handle.write("\nwhat the DPI box decided (tail):\n" + "\n".join(log.splitlines()[-60:]) + "\n")
    if failures and log:
        print("\n".join(log.splitlines()[-40:]))
    shutil.rmtree(workdir, ignore_errors=True)
    return 1 if failures else 0


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command")
    sniffer = sub.add_parser("sniffer", help="internal: the DPI box")
    sniffer.add_argument("--iface", required=True)
    sniffer.add_argument("--log", required=True)
    sniffer.add_argument("--ready", required=True)
    parser.add_argument("--engine", help="path of the voxel-dpi tool")
    parser.add_argument("--report", help="write the result table here")
    parser.add_argument("--only", help="run only the cases whose strategy contains this text")
    args = parser.parse_args()
    if args.command == "sniffer":
        run_sniffer(args)
        return 0
    if not args.engine:
        parser.error("--engine is required")
    return run_lab(args)


if __name__ == "__main__":
    sys.exit(main())
