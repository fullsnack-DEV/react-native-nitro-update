#!/usr/bin/env bash
# Build OTA bundle and zip for iOS only.
# Run from repo root: ./example/scripts/build-ota-zip-ios.sh
# Output: example/ota-demo/bundle.zip
#
# Before running: make your visible changes in example/App.tsx so you can confirm the OTA:
#   - Change BUILD_LABEL to e.g. '1.0.1' (in example/App.tsx)
#   - Optionally change a color or add text like "OTA worked!"

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$EXAMPLE_DIR/ota-demo"
ZIP_NAME="bundle.zip"

mkdir -p "$OUT_DIR"
cd "$EXAMPLE_DIR"

echo "Bundling iOS JS..."
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output "$OUT_DIR/index.ios.jsbundle" \
  --assets-dest "$OUT_DIR"

echo "Creating zip..."
cd "$OUT_DIR"
zip -r "$ZIP_NAME" .

echo "Done: $OUT_DIR/$ZIP_NAME"
ls -la "$OUT_DIR/$ZIP_NAME"
