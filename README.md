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
| `.github/workflows/build.yml` | CI: core AAR, app tests and APK |

## Build

CI does everything; a push to any branch runs `.github/workflows/build.yml`:

1. **core**: `go vet`, `go test`, then `gomobile bind` produces `voxelcore.aar` (arm64-v8a, armeabi-v7a, x86_64).
2. **app**: the JVM unit tests run first and write every Xray configuration the builder can produce; the Go test
   then loads each of them into the real Xray-core and also checks that broken variants are rejected; finally the
   signed release APK is built and uploaded as `voxel-vpn-apk`.
3. **export**: on pushes the APK is also stored as a git blob (its sha is printed in the job annotations), so it can
   be fetched with `gh api repos/<owner>/<repo>/git/blobs/<sha> -H 'Accept: application/vnd.github.raw' > voxel-vpn.apk`.

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
