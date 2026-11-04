// The engine against real sockets on loopback: a SOCKS5 client, the engine, and a probe server that records how
// the bytes arrived.

#include <arpa/inet.h>
#include <netinet/in.h>
#include <poll.h>
#include <sys/socket.h>
#include <unistd.h>

#include <atomic>
#include <chrono>
#include <condition_variable>
#include <cstring>
#include <mutex>
#include <thread>

#include "check.hpp"
#include "desync.hpp"
#include "engine.hpp"
#include "net.hpp"
#include "samples.hpp"
#include "tls.hpp"

using namespace voxel::dpi;

namespace {

using Bytes = std::vector<uint8_t>;

Bytes pattern(size_t size, uint32_t seed = 1) {
  Bytes out(size);
  uint32_t state = seed;
  for (auto& b : out) {
    state = state * 1664525u + 1013904223u;
    b = static_cast<uint8_t>(state >> 24);
  }
  return out;
}

/** Accepts connections and records, per connection, the size of every chunk that recv() returned. */
class ProbeServer {
 public:
  explicit ProbeServer(bool echo = false, std::string greeting = "") : echo_(echo), greeting_(std::move(greeting)) {
    std::string error;
    listener_ = net::listen_loopback(0, &error);
    port_ = net::local_port(listener_);
    thread_ = std::thread([this] { accept_loop(); });
  }

  ~ProbeServer() {
    stopping_ = true;
    if (thread_.joinable()) thread_.join();
    for (auto& t : workers_) t.join();
    if (listener_ >= 0) ::close(listener_);
  }

  uint16_t port() const { return port_; }

  std::vector<size_t> chunks() {
    std::lock_guard<std::mutex> lock(mutex_);
    return chunks_;
  }

  Bytes received() {
    std::lock_guard<std::mutex> lock(mutex_);
    return received_;
  }

  bool wait_for_bytes(size_t count, int timeout_ms = 5000) {
    std::unique_lock<std::mutex> lock(mutex_);
    return changed_.wait_for(lock, std::chrono::milliseconds(timeout_ms), [&] { return received_.size() >= count; });
  }

 private:
  void accept_loop() {
    while (!stopping_) {
      if (net::wait_readable(listener_, 100) <= 0) continue;
      int fd = ::accept4(listener_, nullptr, nullptr, SOCK_CLOEXEC);
      if (fd < 0) continue;
      workers_.emplace_back([this, fd] { serve(fd); });
    }
  }

  void serve(int fd) {
    if (!greeting_.empty()) net::send_all(fd, reinterpret_cast<const uint8_t*>(greeting_.data()), greeting_.size(), 2000);
    uint8_t buffer[65536];
    while (!stopping_) {
      if (net::wait_readable(fd, 100) <= 0) continue;
      ssize_t n = ::recv(fd, buffer, sizeof(buffer), 0);
      if (n <= 0) break;
      {
        std::lock_guard<std::mutex> lock(mutex_);
        chunks_.push_back(static_cast<size_t>(n));
        received_.insert(received_.end(), buffer, buffer + n);
      }
      changed_.notify_all();
      if (echo_ && !net::send_all(fd, buffer, static_cast<size_t>(n), 5000)) break;
    }
    ::close(fd);
  }

  bool echo_;
  std::string greeting_;
  int listener_ = -1;
  uint16_t port_ = 0;
  std::atomic<bool> stopping_{false};
  std::thread thread_;
  std::vector<std::thread> workers_;
  std::mutex mutex_;
  std::condition_variable changed_;
  std::vector<size_t> chunks_;
  Bytes received_;
};

const socks5::Credentials kCredentials{"engine-test", "engine-pass"};

struct Proxy {
  Engine engine;
  EngineOptions options;

  explicit Proxy(const std::string& strategy, bool allow_local = true) {
    std::string error;
    if (!parse_strategy(strategy, &options.strategy, &error)) testing::report(__FILE__, __LINE__, "strategy: " + error);
    options.credentials = kCredentials;
    options.allow_local_targets = allow_local;
    options.first_flight_wait_ms = 1500;
  }

  bool start() {
    std::string error;
    const bool ok = engine.start(options, &error);
    if (!ok) testing::report(__FILE__, __LINE__, "engine did not start: " + error);
    return ok;
  }
};

/** Opens a SOCKS5 connection through the proxy. Returns the reply code, or 0xFF when the exchange broke off. */
int connect_via(uint16_t proxy_port, const std::string& host, uint16_t port, int* fd_out, const socks5::Credentials& credentials = kCredentials) {
  *fd_out = -1;
  int fd = ::socket(AF_INET, SOCK_STREAM | SOCK_CLOEXEC, 0);
  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(proxy_port);
  addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  if (fd < 0 || ::connect(fd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0) {
    if (fd >= 0) ::close(fd);
    return 0xFF;
  }
  Bytes out = {0x05, 0x01, 0x02};
  out.push_back(0x01);
  out.push_back(static_cast<uint8_t>(credentials.user.size()));
  out.insert(out.end(), credentials.user.begin(), credentials.user.end());
  out.push_back(static_cast<uint8_t>(credentials.pass.size()));
  out.insert(out.end(), credentials.pass.begin(), credentials.pass.end());
  in_addr ip{};
  if (::inet_pton(AF_INET, host.c_str(), &ip) == 1) {
    out.insert(out.end(), {0x05, 0x01, 0x00, 0x01});
    const auto* raw = reinterpret_cast<const uint8_t*>(&ip);
    out.insert(out.end(), raw, raw + 4);
  } else {
    out.insert(out.end(), {0x05, 0x01, 0x00, 0x03, static_cast<uint8_t>(host.size())});
    out.insert(out.end(), host.begin(), host.end());
  }
  out.push_back(static_cast<uint8_t>(port >> 8));
  out.push_back(static_cast<uint8_t>(port));
  net::send_all(fd, out.data(), out.size(), 2000);

  uint8_t method[2];
  uint8_t auth[2];
  uint8_t reply[10];
  if (!net::recv_exact(fd, method, 2, 3000) || method[1] != 0x02 || !net::recv_exact(fd, auth, 2, 3000) || auth[1] != 0x00 ||
      !net::recv_exact(fd, reply, sizeof(reply), 12000)) {
    ::close(fd);
    return 0xFF;
  }
  if (reply[1] != 0x00) {
    ::close(fd);
    return reply[1];
  }
  *fd_out = fd;
  return 0;
}

bool read_all(int fd, Bytes* out, size_t count, int timeout_ms = 8000) {
  const int64_t deadline = net::now_ms() + timeout_ms;
  while (out->size() < count) {
    int left = static_cast<int>(deadline - net::now_ms());
    if (left <= 0 || net::wait_readable(fd, left) <= 0) return false;
    uint8_t buffer[65536];
    ssize_t n = ::recv(fd, buffer, sizeof(buffer), 0);
    if (n <= 0) return false;
    out->insert(out->end(), buffer, buffer + n);
  }
  return true;
}

bool send_bytes(int fd, const Bytes& bytes) { return net::send_all(fd, bytes.data(), bytes.size(), 5000); }

}  // namespace

TEST(engine_relays_both_ways) {
  ProbeServer server(true);
  Proxy proxy("");
  CHECK(proxy.start());
  int fd = -1;
  CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &fd), 0);
  if (fd < 0) return;

  const Bytes payload = pattern(300 * 1024);
  std::thread writer([&] { send_bytes(fd, payload); });
  Bytes echoed;
  CHECK(read_all(fd, &echoed, payload.size(), 15000));
  writer.join();
  CHECK(echoed == payload);
  CHECK(server.received() == payload);
  ::close(fd);

  proxy.engine.stop();
  const Stats stats = proxy.engine.stats();
  CHECK_EQ(stats.accepted, static_cast<uint64_t>(1));
  CHECK_EQ(stats.connected, static_cast<uint64_t>(1));
  CHECK_EQ(stats.failed, static_cast<uint64_t>(0));
  CHECK_EQ(stats.desynced, static_cast<uint64_t>(0));
  CHECK_EQ(stats.bytes_up, static_cast<uint64_t>(payload.size()));
  CHECK_EQ(stats.bytes_down, static_cast<uint64_t>(payload.size()));
}

TEST(engine_splits_the_first_payload_only) {
  ProbeServer server;
  Proxy proxy("split=1,5;delay=40");
  CHECK(proxy.start());
  int fd = -1;
  CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &fd), 0);
  if (fd < 0) return;
  const Bytes first = pattern(16, 5);
  CHECK(send_bytes(fd, first));
  CHECK(server.wait_for_bytes(16));
  // Later writes pass through as they are.
  std::this_thread::sleep_for(std::chrono::milliseconds(150));
  const Bytes second = pattern(40, 6);
  CHECK(send_bytes(fd, second));
  CHECK(server.wait_for_bytes(56));
  CHECK((server.chunks() == std::vector<size_t>{1, 4, 11, 40}));
  Bytes expected = first;
  expected.insert(expected.end(), second.begin(), second.end());
  CHECK(server.received() == expected);
  ::close(fd);
  proxy.engine.stop();
  CHECK_EQ(proxy.engine.stats().desynced, static_cast<uint64_t>(1));
}

TEST(engine_cuts_a_tls_hello_into_records_and_segments) {
  ProbeServer server;
  Proxy proxy("tlsrec=sni+2;split=sni+2;delay=40");
  CHECK(proxy.start());
  int fd = -1;
  CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &fd), 0);
  if (fd < 0) return;
  const Bytes hello = samples::from_hex(samples::curl_hello_hex());
  const size_t sni = tls::parse_client_hello(hello.data(), hello.size()).sni_offset;
  CHECK(send_bytes(fd, hello));
  CHECK(server.wait_for_bytes(hello.size() + tls::kRecordHeader));
  CHECK((server.chunks() == std::vector<size_t>{sni + 2, hello.size() + tls::kRecordHeader - (sni + 2)}));

  // Two records now carry the handshake message; their payloads put together are the original one.
  const Bytes got = server.received();
  const size_t first_payload = (static_cast<size_t>(got[3]) << 8) | got[4];
  CHECK_EQ(first_payload, sni + 2 - tls::kRecordHeader);
  const size_t second_at = tls::kRecordHeader + first_payload;
  CHECK_EQ(static_cast<int>(got[second_at]), 0x16);
  Bytes payload(got.begin() + 5, got.begin() + static_cast<std::ptrdiff_t>(second_at));
  payload.insert(payload.end(), got.begin() + static_cast<std::ptrdiff_t>(second_at + 5), got.end());
  CHECK(payload == Bytes(hello.begin() + 5, hello.end()));
  ::close(fd);
}

TEST(engine_waits_for_the_rest_of_a_split_tls_record) {
  ProbeServer server;
  Proxy proxy("split=2;delay=40");
  CHECK(proxy.start());
  int fd = -1;
  CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &fd), 0);
  if (fd < 0) return;
  const Bytes hello = samples::from_hex(samples::openssl_hello_hex());
  // The client writes its hello in three pieces; the engine collects the record before it cuts it.
  CHECK(send_bytes(fd, Bytes(hello.begin(), hello.begin() + 100)));
  std::this_thread::sleep_for(std::chrono::milliseconds(60));
  CHECK(send_bytes(fd, Bytes(hello.begin() + 100, hello.begin() + 200)));
  std::this_thread::sleep_for(std::chrono::milliseconds(60));
  CHECK(send_bytes(fd, Bytes(hello.begin() + 200, hello.end())));
  CHECK(server.wait_for_bytes(hello.size()));
  CHECK(server.received() == hello);
  CHECK_EQ(server.chunks().front(), static_cast<size_t>(2));
  ::close(fd);
}

TEST(engine_urgent_byte_and_disorder_deliver_the_stream_intact) {
  for (const char* strategy : {"oob=3;delay=20", "disorder=1;delay=10", "oob=2;disorder=1;split=4"}) {
    ProbeServer server;
    Proxy proxy(strategy);
    CHECK(proxy.start());
    int fd = -1;
    CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &fd), 0);
    if (fd < 0) return;
    const Bytes payload = pattern(24, 9);
    CHECK(send_bytes(fd, payload));
    // The urgent byte is not part of the data the server reads; the held-back first segment comes after one retransmission.
    CHECK(server.wait_for_bytes(payload.size(), 8000));
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    const Bytes got = server.received();
    if (got != payload) {
      testing::report(__FILE__, __LINE__, std::string("strategy ") + strategy + ": the server got " + std::to_string(got.size()) + " bytes instead of " + std::to_string(payload.size()) + ", chunks " + std::to_string(server.chunks().size()));
    }
    ::close(fd);
  }
}

TEST(engine_does_not_wait_for_a_client_when_the_server_speaks_first) {
  ProbeServer server(false, "220 hello\r\n");
  Proxy proxy("split=1");
  proxy.options.first_flight_wait_ms = 5000;
  CHECK(proxy.start());
  int fd = -1;
  CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &fd), 0);
  if (fd < 0) return;
  const int64_t started = net::now_ms();
  Bytes greeting;
  CHECK(read_all(fd, &greeting, 11, 3000));
  CHECK(net::now_ms() - started < 2000);
  CHECK_EQ(std::string(greeting.begin(), greeting.end()), std::string("220 hello\r\n"));
  ::close(fd);
}

TEST(engine_turns_away_wrong_credentials) {
  ProbeServer server;
  Proxy proxy("");
  CHECK(proxy.start());
  int fd = -1;
  CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &fd, {"engine-test", "wrong"}), 0xFF);
  CHECK(fd < 0);
  for (int i = 0; i < 50 && proxy.engine.stats().failed == 0; ++i) std::this_thread::sleep_for(std::chrono::milliseconds(20));
  CHECK_EQ(proxy.engine.stats().failed, static_cast<uint64_t>(1));
  CHECK_EQ(proxy.engine.stats().connected, static_cast<uint64_t>(0));
  CHECK(server.chunks().empty());
}

TEST(engine_never_connects_back_into_the_device) {
  ProbeServer server;
  Proxy proxy("", /*allow_local=*/false);
  CHECK(proxy.start());
  int fd = -1;
  CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &fd), 0x02);
  CHECK_EQ(connect_via(proxy.engine.port(), "0.0.0.0", server.port(), &fd), 0x02);
  CHECK_EQ(connect_via(proxy.engine.port(), "127.8.9.10", 80, &fd), 0x02);
}

TEST(engine_reports_a_refused_target) {
  uint16_t closed_port = 0;
  {
    std::string error;
    int probe = net::listen_loopback(0, &error);
    closed_port = net::local_port(probe);
    ::close(probe);
  }
  Proxy proxy("");
  CHECK(proxy.start());
  int fd = -1;
  CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", closed_port, &fd), 0x05);
}

TEST(engine_resolves_names_from_its_own_table) {
  ProbeServer server(true);
  Proxy proxy("");
  CHECK(parse_hosts("Voxel.Test=127.0.0.1,::1; other.test = 10.1.2.3 ", &proxy.options.hosts));
  CHECK(proxy.start());
  int fd = -1;
  CHECK_EQ(connect_via(proxy.engine.port(), "voxel.test", server.port(), &fd), 0);
  if (fd < 0) return;
  CHECK(send_bytes(fd, pattern(100)));
  Bytes echoed;
  CHECK(read_all(fd, &echoed, 100));
  CHECK(echoed == pattern(100));
  ::close(fd);
}

TEST(engine_host_table_syntax) {
  std::map<std::string, std::vector<std::string>> hosts;
  CHECK(parse_hosts("", &hosts));
  CHECK(hosts.empty());
  CHECK(parse_hosts("a.test=1.2.3.4,5.6.7.8;b.test=::1", &hosts));
  CHECK_EQ(hosts.size(), static_cast<size_t>(2));
  CHECK_EQ(hosts["a.test"].size(), static_cast<size_t>(2));
  CHECK(!parse_hosts("a.test", &hosts));
  CHECK(!parse_hosts("=1.2.3.4", &hosts));
  CHECK(!parse_hosts("a.test=1.2.3.4,", &hosts));
}

TEST(engine_stops_promptly_with_connections_open) {
  ProbeServer server;
  Proxy proxy("split=1");
  proxy.options.first_flight_wait_ms = 10000;
  CHECK(proxy.start());
  int fds[3];
  for (int& fd : fds) CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &fd), 0);
  const int64_t started = net::now_ms();
  proxy.engine.stop();
  CHECK(net::now_ms() - started < 2500);
  CHECK(!proxy.engine.running());
  for (int fd : fds) {
    if (fd < 0) continue;
    Bytes nothing;
    CHECK(!read_all(fd, &nothing, 1, 2000));  // closed: recv() returns 0
    ::close(fd);
  }
}

TEST(engine_can_be_started_again_and_refuses_double_starts) {
  Proxy proxy("");
  CHECK(proxy.start());
  std::string error;
  CHECK(!proxy.engine.start(proxy.options, &error));
  CHECK(error.find("already running") != std::string::npos);
  const uint16_t first = proxy.engine.port();
  proxy.engine.stop();
  CHECK(proxy.start());
  CHECK(proxy.engine.port() != 0);
  (void)first;
  EngineOptions bad;
  Engine other;
  CHECK(!other.start(bad, &error));
  CHECK(error.find("user name") != std::string::npos);
}

TEST(engine_refuses_more_connections_than_allowed) {
  ProbeServer server;
  Proxy proxy("");
  proxy.options.max_connections = 2;
  CHECK(proxy.start());
  int a = -1;
  int b = -1;
  int c = -1;
  CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &a), 0);
  CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &b), 0);
  CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &c), 0xFF);
  for (int fd : {a, b, c}) {
    if (fd >= 0) ::close(fd);
  }
}

TEST(engine_serves_many_connections_at_once) {
  ProbeServer server(true);
  Proxy proxy("split=1,mid;delay=1");
  CHECK(proxy.start());
  constexpr int kClients = 48;
  std::atomic<int> good{0};
  std::vector<std::thread> clients;
  for (int i = 0; i < kClients; ++i) {
    clients.emplace_back([&, i] {
      int fd = -1;
      if (connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &fd) != 0) return;
      const Bytes payload = pattern(20000 + static_cast<size_t>(i) * 100, static_cast<uint32_t>(i + 1));
      std::thread writer([&] { send_bytes(fd, payload); });
      Bytes echoed;
      const bool ok = read_all(fd, &echoed, payload.size(), 20000);
      writer.join();
      // The server echoes every connection into one shared log, so only this client's own echo is compared.
      if (ok && echoed == payload) ++good;
      ::close(fd);
    });
  }
  for (auto& t : clients) t.join();
  CHECK_EQ(good.load(), kClients);
  proxy.engine.stop();
  CHECK_EQ(proxy.engine.stats().accepted, static_cast<uint64_t>(kClients));
  CHECK_EQ(proxy.engine.stats().active, static_cast<uint64_t>(0));
}

TEST(engine_survives_clients_that_vanish) {
  ProbeServer server(true);
  Proxy proxy("tlsrec=sni+2;split=1,sni+2;disorder=1;delay=1");
  CHECK(proxy.start());
  const Bytes hello = samples::from_hex(samples::curl_hello_hex());
  for (int round = 0; round < 40; ++round) {
    int fd = -1;
    if (connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &fd) != 0) continue;
    // Walk away at every stage: before sending, in the middle of the hello, right after it, with an RST.
    switch (round % 4) {
      case 0: break;
      case 1: send_bytes(fd, Bytes(hello.begin(), hello.begin() + 60)); break;
      case 2: send_bytes(fd, hello); break;
      default: {
        send_bytes(fd, hello);
        linger l{1, 0};
        ::setsockopt(fd, SOL_SOCKET, SO_LINGER, &l, sizeof(l));
        break;
      }
    }
    ::close(fd);
  }
  // Still works afterwards.
  int fd = -1;
  CHECK_EQ(connect_via(proxy.engine.port(), "127.0.0.1", server.port(), &fd), 0);
  if (fd >= 0) {
    CHECK(send_bytes(fd, pattern(64, 77)));
    Bytes echoed;
    CHECK(read_all(fd, &echoed, 64));
    ::close(fd);
  }
  proxy.engine.stop();
  CHECK_EQ(proxy.engine.stats().active, static_cast<uint64_t>(0));
}

TEST(fake_probe_gives_an_answer) {
  // Whether this kernel can rewrite a queued segment; the lab tests in CI use it for real.
  const bool supported = fake_supported();
  std::fprintf(stderr, "  fake segments supported here: %s\n", supported ? "yes" : "no");
  CHECK(supported == fake_supported());
}
