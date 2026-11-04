# VOXEL VPN

An Android VPN client (`com.voxel.vpn`, Kotlin + Jetpack Compose, English and Russian) built on
[Xray-core](https://github.com/XTLS/Xray-core). The system `VpnService` hands a TUN descriptor to Xray-core's
native `tun` inbound, so the whole tunnel runs inside the core: no tun2socks layer and no helper binaries.

## What it does

- **Global mode.** Every app goes through the selected server; private and link-local ranges stay direct, DNS is
  resolved over DoH through the tunnel. The app's own sockets are excluded from the VPN, so there is no routing loop.
- **INCY-compatible import.** Paste text or open a link:
  - `incy://crypt1/...` (AES-256-GCM sealed subscription link), `incy://add/...`, `incy://import/...`, nested up to four levels;
  - control links `incy://connect`, `open`, `disconnect`, `close`, `toggle`, `status`;
  - subscription URLs (`http://`, `https://`), including Base64 bodies, plain link lists, Xray JSON and JSON arrays;
  - share links: VLESS (REALITY, TLS), VMess, Trojan, Shadowsocks (including 2022 ciphers), SOCKS5;
  - transports: TCP, WebSocket, gRPC, HTTPUpgrade, XHTTP, mKCP.
- **Subscription metadata.** `profile-title`, `profile-update-interval` (due subscriptions refresh on start),
  `subscription-userinfo` (traffic bar and days left), `announce`, support and web-page links, read from the HTTP
  headers or from inline `#key: value` lines.
- **Safety defaults.** `allowInsecure` is dropped, REALITY gets a browser fingerprint when none is given, plain
  VLESS/Trojan to a public host is refused, redirects never leave http(s) and never downgrade https to http.
- **Servers.** Grouped by subscription, with TCP latency probes, selection that survives refreshes, and a journal
  screen that shows the app's and the core's log lines.

Entries the core cannot run (ShadowsocksR, TUIC, Hysteria, WireGuard/AmneziaWG, SOCKS4) are skipped and counted.

## Layout

| Path | Contents |
| --- | --- |
| `app/src/main/java/com/voxel/vpn/model` | `ServerProfile`, `Subscription`, `AppData`; ids are hashes of the canonical outbound |
| `app/src/main/java/com/voxel/vpn/parser` | share links, subscription bodies, metadata; `incy/` holds crypt1, link parsing and the importer |
| `app/src/main/java/com/voxel/vpn/net` | subscription fetcher, DNS/DoH resolvers, TCP pinger |
| `app/src/main/java/com/voxel/vpn/core` | Xray configuration builder, connection state, traffic meter, log bus |
| `app/src/main/java/com/voxel/vpn/data` | persistent store (atomic JSON file) and the merge rules for imported sources |
| `app/src/main/java/com/voxel/vpn/vpn` | `VoxelVpnService`, `VpnController`, Kotlin face of the Go binding |
| `app/src/main/java/com/voxel/vpn/ui` | view model, theme, components, screens |
| `app/src/main/go` | `voxelcore`: the Go facade over Xray-core, its tests and the gomobile build script |
| `.github/workflows/build.yml` | CI: core AAR, app tests, APK, emulator end-to-end test |

## Build

CI does everything; a push to any branch runs `.github/workflows/build.yml`:

1. **core**: `go vet`, `go test`, then `gomobile bind` produces `voxelcore.aar` (arm64-v8a, armeabi-v7a, x86_64).
   The AAR is kept in the Actions cache, keyed by the NDK version and the hash of the Go sources, so the core is
   rebuilt only when it changes.
2. **app**: restores the AAR, runs the JVM unit tests (they also write every Xray configuration the builder can
   produce), lets the Go test load each of those configurations into the real Xray-core (broken variants must be
   rejected), and builds the signed release APK. Android lint runs next to it (it reports, it does not block).
3. **export**: on pushes the APK is stored as git blobs of at most 15 MB (their shas are printed in the job
   annotations, in order), so it can be fetched with the plain REST API where the artifact hosts are not reachable:
   `for sha in <sha1> <sha2> ...; do gh api repos/<owner>/<repo>/git/blobs/$sha -H 'Accept: application/vnd.github.raw'; done > voxel-vpn.apk`.
4. **e2e**: an Android 14 emulator (KVM, `.github/scripts/emulator.sh`) installs the APK and drives it for real:
   - an `incy://add/...` link imports a subscription from a web server on the runner (title, traffic bar, days left
     and the latency probe must show up), `incy://connect` brings the VPN up, and a TCP request to an address that
     exists nowhere (203.0.113.7) must be answered: it can only arrive through the TUN device, the Xray-core `tun`
     inbound, VLESS, and the Xray-core server (`app/src/main/go/cmd/e2e-server`) that also runs on the runner.
     Before the connection and after the disconnect the same request must fail;
   - a second run from a clean permission state presses the on-screen power button and answers the real
     notification and VPN consent dialogs;
   - the screen is read again with the Russian locale.
   Screenshots of the steps and the logs are exported as git blobs (the "E2E files" annotation lists `name=sha`).
   The scripts are in `.github/scripts` (`e2e.sh`, `e2e-servers.sh`, `uitool.py`) and the server setup in `.github/e2e`.

The AAR and the APK travel between the jobs through `actions/cache`; the `voxel-vpn-apk`, `test-reports` and
`e2e-output` artifacts are uploaded on a best-effort basis, because a repository whose artifact storage is full
rejects every upload and must not fail the build for that.

Locally (Go 1.27, JDK 21, Android SDK with an NDK):

```sh
export ANDROID_NDK_HOME="$ANDROID_HOME/ndk/29.0.14206865"
bash app/src/main/go/build-aar.sh        # writes app/libs/voxelcore.aar
./gradlew :app:testDebugUnitTest         # also dumps app/build/xray-configs
VOXEL_CONFIG_DIR="$PWD/app/build/xray-configs" go test ./... -count=1   # in app/src/main/go
./gradlew :app:assembleRelease           # app/build/outputs/apk/release/voxel-vpn-release.apk
```

`app/debug.keystore` is a development key kept in the repository so that every build is signed identically and can be
installed over the previous one. Point `VOXEL_KEYSTORE`, `VOXEL_KEYSTORE_PASSWORD`, `VOXEL_KEY_ALIAS` and
`VOXEL_KEY_PASSWORD` at your own key for a real release.
