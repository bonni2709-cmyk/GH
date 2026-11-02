#!/usr/bin/env bash
# Exercises the actual APK on an Android emulator. No secrets are used.
set -euo pipefail
apk=$(find "${1:-incoming-apk}" -maxdepth 1 -name '*.apk' -print -quit)
[[ -n "$apk" && -f "$apk" ]] || { echo 'APK not found' >&2; exit 1; }
adb install -r "$apk"
adb logcat -c
adb shell am start -W -n chat.vale.app/chat.vale.android.MainActivity

# Wait for the non-backup directory and Android Keystore-wrapped SQLCipher key.
ready=0
for _ in {1..30}; do
    if adb shell run-as chat.vale.app ls no_backup/vault.key >/dev/null 2>&1 && \
       adb shell run-as chat.vale.app ls no_backup/vale.db >/dev/null 2>&1; then ready=1; break; fi
    sleep 2
done
if [[ $ready != 1 ]]; then
    echo 'Android vault did not initialize' >&2
    adb shell run-as chat.vale.app ls -la no_backup || true
    adb shell uiautomator dump /sdcard/vale-failure.xml || true
    adb exec-out cat /sdcard/vale-failure.xml || true
    adb logcat -d -s AndroidRuntime:E System.err:W | tail -100 || true
    exit 1
fi

snapshot() {
    adb shell uiautomator dump /sdcard/vale-window.xml >/dev/null
    adb exec-out cat /sdcard/vale-window.xml > "$RUNNER_TEMP/vale-window.xml"
}
# Print the centre of the first UI node matching a class or an accessible label.
coordinates() {
    python3 - "$RUNNER_TEMP/vale-window.xml" "$1" <<'PY'
import re, sys, xml.etree.ElementTree as ET
root = ET.parse(sys.argv[1]).getroot()
mode = sys.argv[2]
for node in root.iter('node'):
    a = node.attrib
    match = (mode == 'edit' and a.get('class', '').endswith('EditText')) or (
        mode == 'create' and 'Создать профиль' in a.get('text', ''))
    if match:
        bounds = re.findall(r'\d+', a.get('bounds', ''))
        if len(bounds) == 4:
            x1, y1, x2, y2 = map(int, bounds)
            print((x1 + x2) // 2, (y1 + y2) // 2)
            sys.exit(0)
sys.exit(1)
PY
}

snapshot
position=$(coordinates edit) || { echo 'Profile name field not found' >&2; cat "$RUNNER_TEMP/vale-window.xml"; exit 1; }
adb shell input tap $position
adb shell input text Alice
adb shell input keyevent KEYCODE_BACK
snapshot
position=$(coordinates create) || { echo 'Create profile button not found' >&2; cat "$RUNNER_TEMP/vale-window.xml"; exit 1; }
adb shell input tap $position

created=0
for _ in {1..20}; do
    sleep 2
    snapshot
    if grep -q 'Чаты' "$RUNNER_TEMP/vale-window.xml"; then created=1; break; fi
done
if [[ $created != 1 ]]; then
    echo 'Profile creation did not reach the chat screen' >&2
    cat "$RUNNER_TEMP/vale-window.xml"
    adb logcat -d -s AndroidRuntime:E System.err:W | tail -100 || true
    exit 1
fi
adb shell pidof chat.vale.app >/dev/null
echo 'Android APK launched, initialized encrypted storage and created a profile.'
