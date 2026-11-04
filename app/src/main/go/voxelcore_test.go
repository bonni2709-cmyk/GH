package voxelcore

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func TestVersionIsReported(t *testing.T) {
	if strings.TrimSpace(Version()) == "" {
		t.Fatal("empty version")
	}
}

func TestNotRunningByDefault(t *testing.T) {
	if IsRunning() {
		t.Fatal("core must not be running")
	}
	if got := QueryStats("inbound>>>tun>>>traffic>>>uplink", false); got != 0 {
		t.Fatalf("stats of a stopped core must be 0, got %d", got)
	}
	if err := Stop(); err != nil {
		t.Fatalf("Stop on a stopped core must be a no-op: %v", err)
	}
}

func TestStartRejectsBadDescriptor(t *testing.T) {
	for _, fd := range []int{-1, 0, 1, 2} {
		if err := Start("{}", fd, ""); err == nil {
			t.Fatalf("descriptor %d must be rejected", fd)
		}
	}
	if IsRunning() {
		t.Fatal("a rejected start must not leave the core running")
	}
}

func TestValidateRejectsGarbage(t *testing.T) {
	if err := ValidateConfig("not json"); err == nil {
		t.Fatal("garbage must be rejected")
	}
	if err := ValidateConfig(`{"outbounds":[{"protocol":"vless","settings":{}}]}`); err == nil {
		t.Fatal("an incomplete outbound must be rejected")
	}
}

func TestWithoutTunKeepsOtherInbounds(t *testing.T) {
	in := `{"inbounds":[{"tag":"tun","protocol":"tun"},{"tag":"socks","protocol":"socks"},{"tag":"T","protocol":"TUN"}],"x":1}`
	out, err := withoutTun(in)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(strings.ToLower(out), `"tun"`) || !strings.Contains(out, `"socks"`) || !strings.Contains(out, `"x":1`) {
		t.Fatalf("unexpected result: %s", out)
	}
	if same, _ := withoutTun(`{"log":{}}`); same != `{"log":{}}` {
		t.Fatalf("a config without inbounds must pass through untouched, got %s", same)
	}
}

type captureSink struct {
	mu    sync.Mutex
	lines []string
}

func (c *captureSink) OnLog(line string) {
	c.mu.Lock()
	c.lines = append(c.lines, line)
	c.mu.Unlock()
}

func TestSinkWriterForwardsTrimmedLines(t *testing.T) {
	c := &captureSink{}
	SetLogSink(c)
	defer SetLogSink(nil)
	if err := (sinkWriter{}).Write("2026/11/04 [Warning] hello\r\n"); err != nil {
		t.Fatal(err)
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	if len(c.lines) != 1 || c.lines[0] != "2026/11/04 [Warning] hello" {
		t.Fatalf("unexpected lines: %q", c.lines)
	}
}

// configDir holds the configurations VoxelCore's Kotlin generator produced (see XrayConfigBuilderTest).
func configDir(t *testing.T) string {
	t.Helper()
	dir := os.Getenv("VOXEL_CONFIG_DIR")
	if dir == "" {
		t.Skip("VOXEL_CONFIG_DIR is not set")
	}
	return dir
}

func TestEveryGeneratedConfigIsAcceptedByXray(t *testing.T) {
	dir := configDir(t)
	files, err := filepath.Glob(filepath.Join(dir, "*.json"))
	if err != nil || len(files) < 10 {
		t.Fatalf("expected the generated configs in %s, found %d (%v)", dir, len(files), err)
	}
	for _, file := range files {
		file := file
		t.Run(strings.TrimSuffix(filepath.Base(file), ".json"), func(t *testing.T) {
			data, err := os.ReadFile(file)
			if err != nil {
				t.Fatal(err)
			}
			if err := ValidateConfig(string(data)); err != nil {
				t.Fatalf("Xray-core rejected %s: %v", filepath.Base(file), err)
			}
		})
	}
}

// Negative controls: prove that the validation above is not vacuous.
func TestXrayRejectsBrokenVariantsOfAGeneratedConfig(t *testing.T) {
	dir := configDir(t)
	data, err := os.ReadFile(filepath.Join(dir, "reality.json"))
	if err != nil {
		t.Fatal(err)
	}
	good := string(data)
	if err := ValidateConfig(good); err != nil {
		t.Fatalf("baseline must be valid: %v", err)
	}
	broken := map[string]string{
		"short public key":    strings.Replace(good, `"publicKey":"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8"`, `"publicKey":"short"`, 1),
		"odd short id":        strings.Replace(good, `"shortId":"6ba85179e30d4fc2"`, `"shortId":"abc"`, 1),
		"unknown fingerprint": strings.Replace(good, `"fingerprint":"chrome"`, `"fingerprint":"unsafe"`, 1),
		"removed transport":   strings.Replace(good, `"network":"tcp"`, `"network":"h2"`, 1),
	}
	for name, config := range broken {
		if config == good {
			t.Fatalf("%s: test fixture did not change the config", name)
		}
		if err := ValidateConfig(config); err == nil {
			t.Errorf("%s: Xray-core accepted a broken configuration", name)
		}
	}
}

// The configurations chained through the DPI engine: the proxy outbound dials through a local SOCKS5 outbound.
func TestDpiConfigsAreAcceptedAndReallyChainTheProxyOutbound(t *testing.T) {
	dir := configDir(t)
	files, err := filepath.Glob(filepath.Join(dir, "dpi-*.json"))
	if err != nil || len(files) < 5 {
		t.Fatalf("expected the DPI configs in %s, found %d (%v)", dir, len(files), err)
	}
	chained := 0
	for _, file := range files {
		name := strings.TrimSuffix(filepath.Base(file), ".json")
		data, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		text := string(data)
		if err := ValidateConfig(text); err != nil {
			t.Errorf("%s: Xray-core rejected the config: %v", name, err)
			continue
		}
		if strings.HasPrefix(name, "dpi-skipped-") {
			// UDP based transports must keep their own sockets.
			if strings.Contains(text, "dialerProxy") || strings.Contains(text, `"tag":"dpi-out"`) {
				t.Errorf("%s: a QUIC transport must not be chained through the engine", name)
			}
			continue
		}
		chained++
		for _, want := range []string{`"dialerProxy":"dpi-out"`, `"tag":"dpi-out"`, `"protocol":"socks"`, `"address":"127.0.0.1"`} {
			if !strings.Contains(text, want) {
				t.Errorf("%s: the config does not contain %s", name, want)
			}
		}
		// Negative control: a socks outbound without an address is not a valid single server.
		broken := strings.Replace(text, `"address":"127.0.0.1"`, `"host":"127.0.0.1"`, 1)
		if broken == text {
			t.Fatalf("%s: test fixture did not change the config", name)
		}
		if err := ValidateConfig(broken); err == nil {
			t.Errorf("%s: Xray-core accepted a socks outbound without an address", name)
		}
	}
	if chained < 5 {
		t.Fatalf("only %d chained configs were checked", chained)
	}
}
