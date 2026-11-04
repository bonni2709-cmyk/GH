#!/usr/bin/env bash
# Starts the two helper servers the emulator test talks to. The emulator reaches the runner as 10.0.2.2.
#
#   :9000   a static web server with the subscription (sub.txt) and a marker file (voxel.txt)
#   :10443  an Xray-core VLESS server whose outbound sends every connection to that web server
#
# Usage: E2E_SERVER_BIN=<path of the e2e-server binary> bash e2e-servers.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK="${E2E_WORK:-${RUNNER_TEMP:-/tmp}/e2e}"
SERVER_BIN="${E2E_SERVER_BIN:?set E2E_SERVER_BIN}"
UUID="5783a3e7-e373-51cd-8642-c83782b807c5"

rm -rf "$WORK"
mkdir -p "$WORK/www"
cp "$ROOT/.github/e2e/www/"* "$WORK/www/"

EXPIRE=$(( $(date +%s) + 90 * 24 * 3600 ))
cat > "$WORK/www/sub.txt" <<SUB
#profile-title: VOXEL E2E
#subscription-userinfo: upload=1048576; download=5242880; total=10737418240; expire=$EXPIRE
vless://$UUID@10.0.2.2:10443?encryption=none&security=none&type=tcp#E2E%20server
SUB

setsid nohup python3 -m http.server 9000 --bind 0.0.0.0 --directory "$WORK/www" > "$WORK/web.log" 2>&1 &
echo $! > "$WORK/web.pid"
setsid nohup "$SERVER_BIN" "$ROOT/.github/e2e/server.json" > "$WORK/xray.log" 2>&1 &
echo $! > "$WORK/xray.pid"

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:9000/voxel.txt" > /dev/null 2>&1 && (exec 3<>/dev/tcp/127.0.0.1/10443) 2> /dev/null; then
    echo "test servers are up: web :9000, xray :10443 (work dir $WORK)"
    exit 0
  fi
  sleep 1
done
echo "the test servers did not come up" >&2
tail -n 20 "$WORK/web.log" "$WORK/xray.log" >&2 || true
exit 1
