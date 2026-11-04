// Command e2e-server runs an Xray-core server from a JSON configuration.
//
// The CI emulator test starts it on the runner and lets the app connect to it, so that real traffic
// from the emulator crosses the whole path: TUN, Xray-core tun inbound, VLESS, this server.
package main

import (
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/xtls/xray-core/core"
	"github.com/xtls/xray-core/infra/conf/serial"
	_ "github.com/xtls/xray-core/main/distro/all"
)

func main() {
	if len(os.Args) != 2 {
		fmt.Fprintln(os.Stderr, "usage: e2e-server <config.json>")
		os.Exit(2)
	}
	raw, err := os.ReadFile(os.Args[1])
	if err != nil {
		fmt.Fprintln(os.Stderr, "cannot read the configuration:", err)
		os.Exit(1)
	}
	built, err := serial.LoadJSONConfig(strings.NewReader(string(raw)))
	if err != nil {
		fmt.Fprintln(os.Stderr, "invalid configuration:", err)
		os.Exit(1)
	}
	server, err := core.New(built)
	if err != nil {
		fmt.Fprintln(os.Stderr, "cannot create the server:", err)
		os.Exit(1)
	}
	if err := server.Start(); err != nil {
		fmt.Fprintln(os.Stderr, "cannot start the server:", err)
		os.Exit(1)
	}
	defer server.Close()
	fmt.Println("e2e-server is running")

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop
}
