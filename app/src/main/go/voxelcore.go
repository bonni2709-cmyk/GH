// Package voxelcore is the Go side of VOXEL VPN: a small, panic-safe facade over Xray-core.
//
// gomobile turns it into the Java class voxelcore.Voxelcore (plus the voxelcore.LogSink interface),
// which is what the Android app calls to start and stop the proxy core on a TUN descriptor,
// read traffic counters and receive the core's log lines.
package voxelcore

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"sync"

	applog "github.com/xtls/xray-core/app/log"
	xlog "github.com/xtls/xray-core/common/log"
	"github.com/xtls/xray-core/core"
	"github.com/xtls/xray-core/features/stats"
	"github.com/xtls/xray-core/infra/conf/serial"
	_ "github.com/xtls/xray-core/main/distro/all"
	_ "golang.org/x/mobile/asset" // keeps golang.org/x/mobile in go.mod, which gomobile bind requires
)

// LogSink receives every log line the core produces.
type LogSink interface {
	OnLog(line string)
}

var (
	mu       sync.Mutex
	instance *core.Instance
	counters stats.Manager

	sinkMu sync.RWMutex
	sink   LogSink
)

func init() {
	// Route the core's console log into the sink instead of stdout (invisible on Android).
	_ = applog.RegisterHandlerCreator(applog.LogType_Console,
		func(applog.LogType, applog.HandlerCreatorOptions) (xlog.Handler, error) {
			return xlog.NewLogger(func() xlog.Writer { return sinkWriter{} }), nil
		})
}

type sinkWriter struct{}

func (sinkWriter) Write(line string) error {
	sinkMu.RLock()
	current := sink
	sinkMu.RUnlock()
	if current != nil {
		current.OnLog(strings.TrimRight(line, "\r\n"))
	}
	return nil
}

func (sinkWriter) Close() error { return nil }

// SetLogSink installs (or, with nil, removes) the receiver of the core's log lines.
func SetLogSink(s LogSink) {
	sinkMu.Lock()
	sink = s
	sinkMu.Unlock()
}

// Version returns the version of the embedded Xray-core.
func Version() string {
	return core.Version()
}

// Start launches the core with the given JSON configuration on the TUN descriptor tunFd.
// The core duplicates the descriptor, so the caller keeps ownership of its own copy.
// assetDir is where optional data files (geoip.dat, geosite.dat) are looked up.
func Start(config string, tunFd int, assetDir string) (err error) {
	defer recoverTo(&err, "start")

	if tunFd < 3 {
		return fmt.Errorf("invalid TUN descriptor %d", tunFd)
	}
	mu.Lock()
	defer mu.Unlock()
	if instance != nil {
		return errors.New("the core is already running")
	}

	setEnv("xray.tun.fd", strconv.Itoa(tunFd))
	setEnv("XRAY_TUN_FD", strconv.Itoa(tunFd))
	if assetDir != "" {
		setEnv("xray.location.asset", assetDir)
		setEnv("XRAY_LOCATION_ASSET", assetDir)
	}

	built, err := serial.LoadJSONConfig(strings.NewReader(config))
	if err != nil {
		return fmt.Errorf("configuration rejected: %w", err)
	}
	inst, err := core.New(built)
	if err != nil {
		return fmt.Errorf("core initialisation failed: %w", err)
	}
	if err := inst.Start(); err != nil {
		_ = inst.Close()
		return fmt.Errorf("core start failed: %w", err)
	}
	instance = inst
	counters, _ = inst.GetFeature(stats.ManagerType()).(stats.Manager)
	return nil
}

// Stop shuts the core down. It is a no-op when the core is not running.
func Stop() (err error) {
	defer recoverTo(&err, "stop")

	mu.Lock()
	defer mu.Unlock()
	if instance == nil {
		return nil
	}
	inst := instance
	instance = nil
	counters = nil
	return inst.Close()
}

// IsRunning reports whether the core is currently running.
func IsRunning() bool {
	mu.Lock()
	defer mu.Unlock()
	return instance != nil
}

// QueryStats returns the value of a traffic counter such as
// "inbound>>>tun>>>traffic>>>downlink"; with reset the counter is zeroed and its old value returned.
// Unknown counters and a stopped core give 0.
func QueryStats(name string, reset bool) int64 {
	mu.Lock()
	manager := counters
	mu.Unlock()
	if manager == nil {
		return 0
	}
	counter := manager.GetCounter(name)
	if counter == nil {
		return 0
	}
	if reset {
		return counter.Set(0)
	}
	return counter.Value()
}

// ValidateConfig checks that the core accepts config, without starting it and without touching a
// TUN device (the tun inbound is dropped for the check). While the core is running only the
// configuration itself is checked, so the running instance is left alone.
func ValidateConfig(config string) (err error) {
	defer recoverTo(&err, "validate")

	stripped, err := withoutTun(config)
	if err != nil {
		return err
	}
	built, err := serial.LoadJSONConfig(strings.NewReader(stripped))
	if err != nil {
		return err
	}
	if IsRunning() {
		return nil
	}
	inst, err := core.New(built)
	if err != nil {
		return err
	}
	return inst.Close()
}

// withoutTun removes "tun" inbounds from a JSON configuration.
func withoutTun(config string) (string, error) {
	var root map[string]json.RawMessage
	if err := json.Unmarshal([]byte(config), &root); err != nil {
		return "", fmt.Errorf("the configuration is not valid JSON: %w", err)
	}
	raw, ok := root["inbounds"]
	if !ok {
		return config, nil
	}
	var inbounds []map[string]json.RawMessage
	if err := json.Unmarshal(raw, &inbounds); err != nil {
		return config, nil // let the real loader report what is wrong with it
	}
	kept := make([]map[string]json.RawMessage, 0, len(inbounds))
	for _, inbound := range inbounds {
		var protocol string
		_ = json.Unmarshal(inbound["protocol"], &protocol)
		if strings.EqualFold(protocol, "tun") {
			continue
		}
		kept = append(kept, inbound)
	}
	encoded, err := json.Marshal(kept)
	if err != nil {
		return "", err
	}
	root["inbounds"] = encoded
	out, err := json.Marshal(root)
	if err != nil {
		return "", err
	}
	return string(out), nil
}

func setEnv(key, value string) {
	_ = os.Setenv(key, value)
}

// recoverTo turns a panic inside the core into an error: a panic must never cross the JNI boundary.
func recoverTo(err *error, what string) {
	if r := recover(); r != nil {
		*err = fmt.Errorf("%s: internal error: %v", what, r)
	}
}
