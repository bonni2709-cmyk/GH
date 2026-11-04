#!/usr/bin/env bash
# End-to-end check of the release APK on a running emulator:
#
#   launch -> import a subscription from an incy:// link -> connect -> real TCP traffic through the VPN tunnel -> disconnect
#   first run -> the on-screen power button with the real permission dialogs (notifications, VPN consent)
#   Russian   -> the same screen with the Russian resources
#
# The helper servers from e2e-servers.sh must already run on the host; the emulator sees the host as 10.0.2.2.
# The request that proves the tunnel goes to 203.0.113.7, an address that exists nowhere. It can only be answered
# if it travels  TUN -> Xray-core tun inbound -> VLESS -> the Xray server on the host -> its web server.
#
# GitHub shows at most 10 notices per step, so the progress is collected in $E2E_OUT/report.txt and printed as one notice.
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
REPORT="$OUT/report.txt"
: > "$REPORT"

escape() { python3 -c 'import sys; sys.stdout.write(sys.stdin.read().replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A"))'; }
note() { echo "$1"; printf '%s\n' "$1" >> "$REPORT"; }
shot() { adb exec-out screencap -p > "$OUT/$1.png" 2> /dev/null || true; }
ui() { adb shell uiautomator dump /sdcard/voxel-ui.xml > /dev/null 2>&1; adb shell cat /sdcard/voxel-ui.xml 2> /dev/null | tr -d '\r'; }
ui_has() { ui | python3 "$UITOOL" has "$1"; }
ui_texts() { ui | python3 "$UITOOL" texts | tr '\n' '|' | head -c "${1:-700}"; }
tap() { # <regex>: taps the centre of the first node that matches
  local point
  point="$(ui | python3 "$UITOOL" center "$1")"
  [ -n "$point" ] || return 1
  adb shell input tap $point
}
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
  echo "::error title=E2E report::$(head -c 6000 "$REPORT" | escape)"
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

wait_ui_gone() { # <regex> <seconds>: the screen must be readable and must no longer match
  local i xml
  for ((i = 0; i < $2; i++)); do
    xml="$(ui)"
    if [ -n "$xml" ] && ! printf '%s' "$xml" | python3 "$UITOOL" has "$1"; then return 0; fi
    sleep 1
  done
  return 1
}

# Answers the system dialog that is in front, if there is one: the notification permission or the VPN "Connection request".
# Prints "notification" or "vpn" when it tapped a button.
answer_dialogs() {
  local xml point
  xml="$(ui)"
  point="$(printf '%s' "$xml" | python3 "$UITOOL" center 'resource-id="[^"]*:id/permission_allow_button"')"
  if [ -n "$point" ]; then
    shot dialog-notification
    adb shell input tap $point
    echo notification
    return 0
  fi
  if printf '%s' "$xml" | python3 "$UITOOL" has 'package="com.android.vpndialogs"'; then
    point="$(printf '%s' "$xml" | python3 "$UITOOL" center 'resource-id="android:id/button1"')"
    if [ -n "$point" ]; then
      shot dialog-vpn
      adb shell input tap $point
      echo vpn
    fi
  fi
  return 0
}

# ---- device ---------------------------------------------------------------------------------------------------
adb wait-for-device
adb shell input keyevent KEYCODE_WAKEUP > /dev/null 2>&1
adb shell wm dismiss-keyguard > /dev/null 2>&1
prop() { adb shell getprop "$1" | tr -d '\r'; }
note "device: $(prop ro.product.model), Android $(prop ro.build.version.release) (API $(prop ro.build.version.sdk)), ABI $(prop ro.product.cpu.abi)"

# ---- install --------------------------------------------------------------------------------------------------
installed="$(adb install -r -g "$APK" 2>&1)"
printf '%s' "$installed" | grep -q Success || fail "adb install failed: $installed"
note "installed $(adb shell dumpsys package "$PKG" | grep -m1 versionName | tr -d '\r ')"
consent="$(adb shell appops set "$PKG" ACTIVATE_VPN allow 2>&1 | tr -d '\r')"
note "VPN consent pre-approved for the deep-link run ${consent:+[$consent]}"

# ---- control: the marker must be unreachable without the VPN ------------------------------------------------
before="$(probe)"
if printf '%s' "$before" | grep -q "$MARKER"; then
  fail "the marker is reachable without the VPN, so a later success would prove nothing"
fi
note "control request without the VPN: no marker, as expected"

# ---- 1. cold start --------------------------------------------------------------------------------------------
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" > "$OUT/start.txt" 2>&1
grep -q "Status: ok" "$OUT/start.txt" || fail "the app did not start: $(cat "$OUT/start.txt")"
wait_ui '(text|content-desc)="Not connected"' 30 || fail "the main screen never showed 'Not connected'"
[ -n "$(adb shell pidof "$PKG" | tr -d '\r')" ] || fail "the app process is gone after the launch"
ui_has 'text="Add subscription or server"' || fail "the add card is missing on the empty start screen"
sleep 1
shot 01-start
note "1/9 the app starts and shows the idle screen with the add card"

# ---- 2. import a subscription from a deep link ---------------------------------------------------------------
view "incy://add/http://10.0.2.2:9000/sub.txt"
wait_ui '(text|content-desc)="[^"]*E2E server' 40 || fail "the subscription was not imported (no 'E2E server' on the screen)"
sleep 2
shot 02-imported
adb shell input swipe 360 1000 360 350 400
sleep 2
shot 02b-servers
wait_ui 'text="[0-9]+ ms"' 20 || fail "the latency probe never showed a result for the imported server"
for expected in 'text="VOXEL E2E"' 'text="1 server .+ days left"' 'text="6.00 MB of 10.0 GB"' 'text="E2E server"'; do
  ui_has "$expected" || fail "the list does not show what the subscription declared: $expected"
done
list_texts="$(ui_texts 700)"
adb shell input swipe 360 350 360 1100 400
sleep 1
note "2/9 the incy://add link imported the subscription: $(app_log | grep -E ' import: ' | tail -n 1 | sed 's/.*VOXEL *: //')"
note "    the list shows: $list_texts"

# ---- 3. the add card folds away once there are servers, and the plus button brings it back ------------------
wait_ui_gone 'text="Add subscription or server"' 10 || fail "the add card is still open although the server list is not empty"
tap 'content-desc="Add"' || fail "the add button next to the server list was not found"
wait_ui 'text="Add subscription or server"' 10 || fail "the add card did not open after a tap on the plus button"
sleep 1
shot 02c-add-card
tap 'content-desc="Close"' || fail "the close button of the add card was not found"
wait_ui_gone 'text="Add subscription or server"' 10 || fail "the add card did not fold away again"
note "3/9 the add card folds away behind the plus button once servers exist, and opens and closes on tap"

# ---- 4. connect with a deep link -----------------------------------------------------------------------------
view "incy://connect"
connected=0
for ((i = 1; i <= 90; i++)); do
  log="$(app_log)"
  if printf '%s' "$log" | grep -q "vpn: Connected"; then connected=1; break; fi
  if printf '%s' "$log" | grep -qE ' E VOXEL +: vpn: '; then break; fi
  if ((i % 4 == 0)); then answer_dialogs > /dev/null; fi
  sleep 1
done
[ "$connected" = 1 ] || fail "the app did not reach the connected state"
wait_ui '(text|content-desc)="Protected"' 20 || fail "the screen does not say 'Protected' although the core is running"
sleep 2
shot 03-connected
note "4/9 connected through the VPN service; interfaces: $(adb shell 'ip addr | grep -E "^[0-9]+: (tun|xray)|inet 172"' | tr -d '\r' | tr '\n' '|' | head -c 400)"

# ---- 5. traffic through the tunnel ---------------------------------------------------------------------------
answer=""
for ((i = 1; i <= 6; i++)); do
  answer="$(probe)"
  if printf '%s' "$answer" | grep -q "$MARKER"; then break; fi
  sleep 2
done
printf '%s\n' "$answer" > "$OUT/probe-through-tunnel.txt"
printf '%s' "$answer" | grep -q "$MARKER" || fail "no response came back through the tunnel: $(printf '%s' "$answer" | head -c 300)"
sleep 2
shot 04-traffic
note "5/9 a request to the non-existent 203.0.113.7 was answered through the tunnel: $(printf '%s' "$answer" | head -n 1)"
note "    the screen shows: $(ui_texts 500)"

# ---- 6. the logs screen ---------------------------------------------------------------------------------------
if tap 'content-desc="Logs"'; then
  sleep 2
  shot 05-logs
  ui_has 'text="[^"]*vpn: Connected' || fail "the logs screen does not show the 'vpn: Connected' line"
  tap 'content-desc="Close"' || fail "the close button of the logs screen was not found"
  wait_ui_gone '(text|content-desc)="Clear"' 10 || fail "the logs screen did not close"
  note "6/9 the logs screen opens, lists the connection log and closes"
else
  fail "the logs button was not found"
fi

# ---- 7. disconnect with a deep link --------------------------------------------------------------------------
view "incy://disconnect"
wait_log "vpn: Disconnected" 40 || fail "the app did not disconnect"
wait_ui '(text|content-desc)="Not connected"' 20 || fail "the screen did not return to 'Not connected'"
sleep 2
shot 06-disconnected
after="$(probe)"
if printf '%s' "$after" | grep -q "$MARKER"; then fail "the marker is still reachable after the disconnect"; fi
note "7/9 disconnected, and the tunnel is gone again"
app_log > "$OUT/app-log-deeplinks.txt"
adb logcat -d > "$OUT/logcat-deeplinks.txt" 2> /dev/null || true

# ---- 8. first run: the on-screen button and the real permission dialogs -------------------------------------
adb shell pm revoke "$PKG" android.permission.POST_NOTIFICATIONS > "$OUT/revoke.txt" 2>&1
adb shell appops set "$PKG" ACTIVATE_VPN default > /dev/null 2>&1
adb shell am force-stop "$PKG"
adb logcat -c
adb shell am start -W -n "$PKG/.MainActivity" > "$OUT/start2.txt" 2>&1
grep -q "Status: ok" "$OUT/start2.txt" || fail "the app did not start for the first-run check: $(cat "$OUT/start2.txt")"
wait_ui '(text|content-desc)="Not connected"' 30 || fail "the first-run screen never showed 'Not connected'"
sleep 1
tap 'content-desc="Not connected"' || fail "the power button was not found"
notification=0
vpn=0
connected=0
for ((i = 1; i <= 60; i++)); do
  if app_log | grep -q "vpn: Connected"; then connected=1; break; fi
  if app_log | grep -qE ' E VOXEL +: vpn: '; then break; fi
  case "$(answer_dialogs)" in
    notification) notification=1 ;;
    vpn) vpn=1 ;;
  esac
  sleep 1
done
granted="$(adb shell dumpsys package "$PKG" | grep -m1 -E 'POST_NOTIFICATIONS: granted=' | tr -d '\r' | sed 's/^ *//' | cut -d, -f1)"
[ "$connected" = 1 ] || fail "the first-run connect did not complete (notification dialog answered: $notification, VPN dialog answered: $vpn, $granted)"
[ "$notification" = 1 ] || fail "the notification permission dialog never appeared although the permission had been revoked ($granted)"
wait_ui '(text|content-desc)="Protected"' 20 || fail "the first-run screen does not say 'Protected'"
sleep 2
shot 07-first-run-connected
answer="$(probe)"
printf '%s' "$answer" | grep -q "$MARKER" || fail "no response through the tunnel after the first-run connect: $(printf '%s' "$answer" | head -c 300)"
tap 'content-desc="Protected"' || fail "the power button was not found while connected"
wait_log "vpn: Disconnected" 40 || fail "the power button did not disconnect"
wait_ui '(text|content-desc)="Not connected"' 20 || fail "the screen did not return to 'Not connected' after the button"
note "8/9 first run with the real dialogs: notification dialog answered=$notification, VPN consent dialog answered=$vpn ($granted); traffic flowed; the button disconnects"

# ---- 9. the Russian resources --------------------------------------------------------------------------------
locale_out="$(adb shell cmd locale set-app-locales "$PKG" --locales ru 2>&1 | tr -d '\r')"
if wait_ui 'text="Не подключено"' 25; then
  sleep 1
  shot 08-russian
  adb shell input swipe 360 1000 360 350 400
  sleep 2
  shot 08b-russian-list
  note "9/9 the Russian resources are used: $(ui_texts 700)"
elif [ -z "$locale_out" ]; then
  fail "the app did not switch to Russian after the per-app locale change"
else
  note "9/9 the per-app locale command is not available on this image ($locale_out); the Russian check was skipped"
fi

# ---- verdict --------------------------------------------------------------------------------------------------
save_logs
if grep -q "FATAL EXCEPTION" "$OUT/logcat.txt" "$OUT/logcat-deeplinks.txt"; then
  fail "the app crashed during the run"
fi
echo "::notice title=E2E report::$(head -c 8000 "$REPORT" | escape)"
echo "::notice title=E2E app log::$(tail -n 40 "$OUT/app-log.txt" | head -c 6000 | escape)"
echo "e2e: all checks passed"
