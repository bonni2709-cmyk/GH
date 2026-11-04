#!/usr/bin/env bash
# Builds app/libs/voxelcore.aar: the Go facade over Xray-core, bound for Android with gomobile.
#
# Needs: Go (version from go.mod), the Android NDK (ANDROID_NDK_HOME) and network access to the Go module proxy.
# Usage: bash build-aar.sh [output.aar]
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")"

OUT="${1:-${VOXEL_AAR_OUT:-$(cd ../../.. && pwd)/libs/voxelcore.aar}}"
# Commit of golang.org/x/mobile that go.mod pins (the same snapshot is used for the gomobile tool).
MOBILE_REV="197770444867"
TARGETS="${VOXEL_ANDROID_TARGETS:-android/arm64,android/arm,android/amd64}"

command -v go >/dev/null 2>&1 || { echo "error: the Go toolchain is not installed (go.mod needs $(grep '^go ' go.mod))" >&2; exit 1; }
export ANDROID_NDK_HOME="${ANDROID_NDK_HOME:-${ANDROID_NDK_ROOT:-${ANDROID_NDK_LATEST_HOME:-}}}"
[ -n "$ANDROID_NDK_HOME" ] && [ -d "$ANDROID_NDK_HOME" ] || { echo "error: set ANDROID_NDK_HOME to an Android NDK installation" >&2; exit 1; }

echo "== Go $(go version | awk '{print $3}'), NDK $ANDROID_NDK_HOME"

# Fill in anything missing from go.sum, then fetch the pinned gomobile tools.
go mod tidy
GOBIN="$(go env GOPATH)/bin"
export PATH="$GOBIN:$PATH"
go install "golang.org/x/mobile/cmd/gomobile@${MOBILE_REV}"
go install "golang.org/x/mobile/cmd/gobind@${MOBILE_REV}"
gomobile init

mkdir -p "$(dirname "$OUT")"
rm -f "$OUT"
echo "== gomobile bind -> $OUT ($TARGETS)"
gomobile bind -v \
  -androidapi 24 \
  -trimpath \
  -ldflags="-s -w -buildid= -checklinkname=0" \
  -target="$TARGETS" \
  -o "$OUT" \
  .

[ -s "$OUT" ] || { echo "error: gomobile produced no AAR" >&2; exit 1; }
echo "== AAR contents"
unzip -l "$OUT" | awk '/classes.jar|libgojni.so|AndroidManifest/ {print}'
for abi in $(echo "$TARGETS" | tr ',' '\n' | sed 's#android/##; s#arm64#arm64-v8a#; s#^arm$#armeabi-v7a#; s#amd64#x86_64#; s#^386$#x86#'); do
  unzip -l "$OUT" | grep -q "jni/$abi/libgojni.so" || { echo "error: $abi library missing from the AAR" >&2; exit 1; }
done
echo "== done: $(du -h "$OUT" | cut -f1) $OUT"
