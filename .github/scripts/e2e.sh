#!/usr/bin/env bash
# End-to-end check of the release APK on a running emulator:
#
#   launch -> import a subscription from an incy:// link -> connect -> real TCP traffic through the VPN tunnel -> disconnect
#
# The helper servers from e2e-servers.sh must already run on the host; the emulator sees the host as 10.0.2.2.
# The request that proves the tunnel goes to 203.0.113.7, an address that exists nowhere. It can only be answered
# if it travels  TUN -> Xray-core tun inbound -> VLESS -> the Xray server on the host -> its web server.
#
# Environment: E2E_APK (path of the APK), E2E_OUT (directory for the screenshots and logs).
set -u

export PATH="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}/platform-tools:$PATH"

PKG=com.voxel.vpn
APK="${E2E_APK:?set E2E_APK}"
OUT="${E2E_OUT:?set E2E_OUT}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UITOOL="$HERE/uitool.py"
MARKER="VOXEL-E2E-OK"
mkdir -p "$OUT"

escape() { python3 -c 'import sys; sys.stdout.write(sys.stdin.read().replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A"))'; }
notice() { echo "::notice title=E2E::$1"; }
shot() { adb exec-out screencap -p > "$OUT/$1.png" 2> /dev/null || true; }
ui() { adb shell uiautomator dump /sdcard/voxel-ui.xml > /dev/null 2>&1; adb shell cat /sdcard/voxel-ui.xml 2> /dev/null | tr -d '\r'; }
ui_has() { ui | python3 "$UITOOL" has "$1"; }
app_log() { adb logcat -d -s VOXEL:V 2> /dev/null | tr -d '\r'; }
view() { adb shell am start -W -a android.intent.action.VIEW -d "$1" "$PKG" > /dev/null 2>&1; }
probe() { adb shell 'printf "GET /voxel.txt HTTP/1.0\r\nHost: probe.invalid\r\n\r\n" | toybox nc -w 4 203.0.113.7 80' 2>&1 | tr -d '\r'; }

save_logs() {
  adb logcat -d > "$OUT/logcat.txt" 2> /dev/null || true
  app_log > "$OUT/app-log.txt"
}

fail() {
  echo "::error title=E2E failed::$(printf '%s' "$1" | head -c 1500 | escape)"
  shot failure
  save_logs
  echo "::error title=E2E crash log::$(grep -E 'AndroidRuntime|FATAL EXCEPTION|ANR in|Process: ' "$OUT/logcat.txt" | tail -n 40 | head -c 6000 | escape)"
  echo "::error title=E2E app log::$(tail -n 60 "$OUT/app-log.txt" | head -c 9000 | escape)"
  echo "::error title=E2E screen texts::$(ui | python3 "$UITOOL" texts | head -c 2000 | escape)"
  echo "::error title=E2E network::$( { adb shell 'ip addr | grep -E "^[0-9]+:|inet "; echo ---; ip rule | head -n 20; echo ---; ip route show table all | head -n 25'; adb shell dumpsys connectivity 2> /dev/null | grep -iE 'vpn|tun[0-9]' | head -n 12; } 2>&1 | tr -d '\r' | head -c 3500 | escape)"
  exit 1
}

wait_log() { # <ERE> <seconds>
  local i
  for ((i = 0; i < $2; i++)); do
    if app_log | grep -qE "$1"; then return 0; fi
    sleep 1
  done
  return 1
}

wait_ui() { # <regex> <seconds>
  local i
  for ((i = 0; i < $2; i++)); do
    if ui_has "$1"; then return 0; fi
    sleep 1
  done
  return 1
}

# Answers the system's "Connection request" dialog when it shows up (the app-op pre-approval normally prevents it).
answer_vpn_dialog() {
  local xml point
  xml="$(ui)"
  if printf '%s' "$xml" | python3 "$UITOOL" has 'package="com.android.vpndialogs"'; then
    point="$(printf '%s' "$xml" | python3 "$UITOOL" center 'resource-id="android:id/button1"')"
    if [ -n "$point" ]; then
      adb shell input tap $point
      notice "tapped OK on the VPN consent dialog"
      return 0
    fi
  fi
  return 1
}

# ---- device ---------------------------------------------------------------------------------------------------
adb wait-for-device
adb shell input keyevent KEYCODE_WAKEUP > /dev/null 2>&1
adb shell wm dismiss-keyguard > /dev/null 2>&1
prop() { adb shell getprop "$1" | tr -d '\r'; }
notice "device: $(prop ro.product.model), Android $(prop ro.build.version.release) (API $(prop ro.build.version.sdk)), ABI $(prop ro.product.cpu.abi)"
notice "toybox: $(adb shell 'toybox nc --help 2>&1 | head -n 1' | tr -d '\r')"

# ---- install --------------------------------------------------------------------------------------------------
installed="$(adb install -r -g "$APK" 2>&1)"
printf '%s' "$installed" | grep -q Success || fail "adb install failed: $installed"
notice "installed $(adb shell dumpsys package "$PKG" | grep -m1 versionName | tr -d '\r ')"
consent="$(adb shell appops set "$PKG" ACTIVATE_VPN allow 2>&1 | tr -d '\r')"
notice "VPN consent pre-approved ${consent:+[$consent]}"

# ---- control: the marker must be unreachable without the VPN ------------------------------------------------
before="$(probe)"
if printf '%s' "$before" | grep -q "$MARKER"; then
  fail "the marker is reachable without the VPN, so a later success would prove nothing"
fi
notice "control request without the VPN: no marker, as expected"

# ---- 1. cold start --------------------------------------------------------------------------------------------
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" > "$OUT/start.txt" 2>&1
grep -q "Status: ok" "$OUT/start.txt" || fail "the app did not start: $(cat "$OUT/start.txt")"
wait_ui '(text|content-desc)="Not connected"' 30 || fail "the main screen never showed 'Not connected'"
[ -n "$(adb shell pidof "$PKG" | tr -d '\r')" ] || fail "the app process is gone after the launch"
sleep 1
shot 01-start
notice "1/6 the app starts and shows the idle screen"

# ---- 2. import a subscription from a deep link ---------------------------------------------------------------
view "incy://add/http://10.0.2.2:9000/sub.txt"
wait_ui '(text|content-desc)="[^"]*E2E server' 40 || fail "the subscription was not imported (no 'E2E server' on the screen)"
sleep 2
shot 02-imported
notice "2/6 the incy://add link imported the subscription: $(app_log | grep -E ' import: ' | tail -n 1 | sed 's/.*VOXEL *: //')"

# ---- 3. connect -----------------------------------------------------------------------------------------------
view "incy://connect"
connected=0
for ((i = 1; i <= 90; i++)); do
  log="$(app_log)"
  if printf '%s' "$log" | grep -q "vpn: Connected"; then connected=1; break; fi
  if printf '%s' "$log" | grep -qE ' E VOXEL +: vpn: '; then break; fi
  if ((i % 4 == 0)); then answer_vpn_dialog; fi
  sleep 1
done
[ "$connected" = 1 ] || fail "the app did not reach the connected state"
wait_ui '(text|content-desc)="Protected"' 20 || fail "the screen does not say 'Protected' although the core is running"
sleep 2
shot 03-connected
notice "3/6 connected through the VPN service; interfaces: $(adb shell 'ip addr | grep -E "^[0-9]+: (tun|xray)|inet 172"' | tr -d '\r' | tr '\n' '|' | head -c 400)"

# ---- 4. traffic through the tunnel ---------------------------------------------------------------------------
answer=""
for ((i = 1; i <= 6; i++)); do
  answer="$(probe)"
  if printf '%s' "$answer" | grep -q "$MARKER"; then break; fi
  sleep 2
done
printf '%s\n' "$answer" > "$OUT/probe-through-tunnel.txt"
printf '%s' "$answer" | grep -q "$MARKER" || fail "no response came back through the tunnel: $(printf '%s' "$answer" | head -c 300)"
notice "4/6 a request to the non-existent 203.0.113.7 was answered through the tunnel: $(printf '%s' "$answer" | head -n 1)"
sleep 2
shot 04-traffic
notice "screen texts while connected: $(ui | python3 "$UITOOL" texts | tr '\n' '|' | head -c 600)"

# ---- 5. the logs screen ---------------------------------------------------------------------------------------
point="$(ui | python3 "$UITOOL" center '(text|content-desc)="Logs"')"
if [ -n "$point" ]; then
  adb shell input tap $point
  sleep 2
  shot 05-logs
  point="$(ui | python3 "$UITOOL" center '(text|content-desc)="Close"')"
  if [ -n "$point" ]; then adb shell input tap $point; sleep 1; fi
  notice "5/6 the logs screen opens"
else
  notice "5/6 the logs button was not found in the UI dump (skipped)"
fi

# ---- 6. disconnect --------------------------------------------------------------------------------------------
view "incy://disconnect"
wait_log "vpn: Disconnected" 40 || fail "the app did not disconnect"
wait_ui '(text|content-desc)="Not connected"' 20 || fail "the screen did not return to 'Not connected'"
sleep 2
shot 06-disconnected
after="$(probe)"
if printf '%s' "$after" | grep -q "$MARKER"; then fail "the marker is still reachable after the disconnect"; fi
notice "6/6 disconnected, and the tunnel is gone again"

# ---- verdict --------------------------------------------------------------------------------------------------
save_logs
if grep -q "FATAL EXCEPTION" "$OUT/logcat.txt"; then
  fail "the app crashed during the run"
fi
echo "::notice title=E2E app log::$(tail -n 40 "$OUT/app-log.txt" | head -c 6000 | escape)"
notice "all checks passed"
