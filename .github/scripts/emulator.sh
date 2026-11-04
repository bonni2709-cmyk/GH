#!/usr/bin/env bash
# Installs an Android emulator image and boots it in the background on a GitHub runner.
#
#   emulator.sh install   sdkmanager + a 720x1280 AVD named "voxel"
#   emulator.sh boot      starts the emulator and waits until Android reports sys.boot_completed
#
# Every failure is reported as an annotation that carries the emulator's own log, so a slow or broken boot
# can be diagnosed without access to the raw job log.
set -uo pipefail

API="${EMULATOR_API:-34}"
AVD="voxel"
BOOT_TIMEOUT="${EMULATOR_BOOT_TIMEOUT:-1200}"
SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-/usr/local/lib/android/sdk}}"
export PATH="$SDK/cmdline-tools/latest/bin:$SDK/platform-tools:$SDK/emulator:$PATH"
# avdmanager and the emulator must agree on where AVDs live (their defaults differ between SDK tool versions).
export ANDROID_AVD_HOME="$HOME/.android/avd"
mkdir -p "$ANDROID_AVD_HOME"
WORK="${RUNNER_TEMP:-/tmp}/emulator"
mkdir -p "$WORK"

escape() { python3 -c 'import sys; sys.stdout.write(sys.stdin.read().replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A"))'; }
notice() { echo "::notice title=Emulator::$1"; }

fail() {
  echo "::error title=Emulator failed::$(printf '%s' "$1" | head -c 1500 | escape)"
  if [ -f "$WORK/emulator.log" ]; then
    echo "::error title=Emulator log::$(tail -n 70 "$WORK/emulator.log" | head -c 9000 | escape)"
  fi
  echo "::error title=Emulator host::$( { echo "adb: $(adb devices 2>&1 | tr '\n' ' ')"; nproc; free -m | sed -n 1,2p; uptime; ls -l /dev/kvm 2>&1; pgrep -a emulator 2>&1 | cut -c1-300; } | head -c 3000 | escape)"
  if adb get-state > /dev/null 2>&1; then
    echo "::error title=Emulator logcat::$(adb logcat -d 2> /dev/null | tail -n 40 | head -c 6000 | escape)"
  fi
  exit 1
}

install_image() {
  yes | sdkmanager --licenses > /dev/null 2>&1
  local flavour image chosen=""
  for flavour in default google_apis; do
    image="system-images;android-$API;$flavour;x86_64"
    if sdkmanager --install "platform-tools" "emulator" "$image" > "$WORK/sdkmanager.log" 2>&1; then
      chosen="$image"
      break
    fi
    notice "could not install $image: $(tail -n 3 "$WORK/sdkmanager.log" | tr '\n' ' ')"
  done
  [ -n "$chosen" ] || fail "no x86_64 system image for API $API could be installed"

  if ! echo no | avdmanager create avd --force -n "$AVD" -k "$chosen" -d pixel_2 > "$WORK/avd.log" 2>&1; then
    fail "avdmanager failed: $(tail -n 5 "$WORK/avd.log")"
  fi
  # A small screen keeps the software renderer quick; two cores and 3 GB match what the runner has.
  # avdmanager prints where it put the AVD (the location depends on the SDK tools version).
  local config dir
  dir="$(avdmanager list avd 2> /dev/null | sed -n 's/^ *Path: *//p' | head -n1 | tr -d '\r')"
  config="$dir/config.ini"
  if [ ! -f "$config" ]; then
    config="$(find "$HOME" -maxdepth 6 -path "*/$AVD.avd/config.ini" 2> /dev/null | head -n1)"
  fi
  [ -f "$config" ] || fail "the AVD configuration file was not found (avdmanager said: $(avdmanager list avd 2>&1 | tr '\n' ' ' | head -c 600))"
  sed -i -E '/^(hw\.lcd\.(width|height|density)|hw\.ramSize|hw\.cpu\.ncore)=/d' "$config"
  printf 'hw.lcd.width=720\nhw.lcd.height=1280\nhw.lcd.density=320\nhw.ramSize=3072\nhw.cpu.ncore=2\n' >> "$config"

  notice "image $chosen, emulator $(emulator -version 2>&1 | grep -m1 -i 'emulator version' | tr -d '\r')"
  notice "acceleration check: $(emulator -accel-check 2>&1 | tr '\n' ' ' | head -c 300)"
}

boot() {
  adb start-server > /dev/null 2>&1
  setsid nohup emulator -avd "$AVD" -no-window -no-audio -no-boot-anim -no-snapshot \
    -gpu swiftshader_indirect -accel on -camera-back none -camera-front none -verbose \
    > "$WORK/emulator.log" 2>&1 < /dev/null &
  local pid=$! started elapsed
  started="$(date +%s)"
  while :; do
    elapsed=$(($(date +%s) - started))
    # The launcher may hand over to a qemu child, so either of the two counts as alive.
    if ! kill -0 "$pid" 2> /dev/null && ! pgrep -f 'qemu-system' > /dev/null 2>&1; then
      fail "the emulator process exited after ${elapsed}s"
    fi
    if [ "$(adb shell getprop sys.boot_completed 2> /dev/null | tr -d '\r')" = "1" ]; then
      break
    fi
    if [ "$elapsed" -ge "$BOOT_TIMEOUT" ]; then
      fail "Android did not finish booting within ${BOOT_TIMEOUT}s"
    fi
    sleep 5
  done
  notice "Android booted after ${elapsed}s"

  # No animations: the screenshots and UI dumps settle at once.
  for scale in window_animation_scale transition_animation_scale animator_duration_scale; do
    adb shell settings put global "$scale" 0 > /dev/null 2>&1
  done
  adb shell input keyevent KEYCODE_WAKEUP > /dev/null 2>&1
  adb shell wm dismiss-keyguard > /dev/null 2>&1
  sleep 5
  notice "device ready: $(adb shell getprop ro.product.model | tr -d '\r'), Android $(adb shell getprop ro.build.version.release | tr -d '\r'), $(adb shell wm size | tr -d '\r' | tail -n 1)"
}

case "${1:-}" in
  install) install_image ;;
  boot) boot ;;
  *)
    echo "usage: emulator.sh install|boot" >&2
    exit 2
    ;;
esac
