#!/usr/bin/env bash
# Apply compatibility fixes to Nitrogen-generated files for current react-native-nitro-modules.
# Run this after `npm run specs` (nitrogen) so the generated code works without consumer patches.
# Also runs as part of prepublishOnly to guarantee the published package is always clean.
#
# Fixes applied:
# 1) RecyclableView → HybridView (NitroUpdateAutolinking.swift)
# 2) Remove override from equals() in *Swift.hpp bridge (HybridObject::equals is not
#    virtual in some NitroModules versions)
# 3) Validate Android generated code matches expected NitroModules API
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GEN="$PKG_DIR/nitrogen/generated"

FIXES_APPLIED=0

# --- iOS Fixes ---

# 1) Swift: HybridView instead of RecyclableView
#    Nitrogen may generate RecyclableView.Type but some NitroModules versions
#    renamed/removed it in favor of HybridView.
AUTOLINK="$GEN/ios/NitroUpdateAutolinking.swift"
if [ -f "$AUTOLINK" ]; then
  if grep -q 'RecyclableView\.Type' "$AUTOLINK"; then
    sed -i '' 's/RecyclableView\.Type/HybridView.Type/g' "$AUTOLINK"
    echo "  [fix] RecyclableView → HybridView in NitroUpdateAutolinking.swift"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
  fi
fi

# 2) C++: remove override from equals() in Swift bridge
#    HybridObject::equals may or may not be virtual depending on the NitroModules version.
#    Removing override is safe in both cases (function still overrides, just without the keyword).
SWIFT_HPP="$GEN/ios/c++/HybridBundleUpdaterSpecSwift.hpp"
if [ -f "$SWIFT_HPP" ]; then
  if grep -q 'bool equals(.*) override {' "$SWIFT_HPP"; then
    sed -i '' 's/bool equals(const std::shared_ptr<HybridObject>\& other) override {/bool equals(const std::shared_ptr<HybridObject>\& other) {/' "$SWIFT_HPP"
    echo "  [fix] Removed override from equals() in HybridBundleUpdaterSpecSwift.hpp"
    FIXES_APPLIED=$((FIXES_APPLIED + 1))
  fi
fi

# --- Android Validation ---
# The Android generated code must use the CxxPart/JavaPart/createHybridObject pattern
# from NitroModules >=0.35.0. Validate key files exist and contain expected symbols.

ANDROID_HPP="$GEN/android/c++/JHybridBundleUpdaterSpec.hpp"
ANDROID_CPP="$GEN/android/c++/JHybridBundleUpdaterSpec.cpp"
ANDROID_KT="$GEN/android/kotlin/com/margelo/nitro/nitroupdate/HybridBundleUpdaterSpec.kt"
ANDROID_ONLOAD="$GEN/android/NitroUpdateOnLoad.cpp"

ANDROID_OK=true

if [ -f "$ANDROID_HPP" ]; then
  if ! grep -q 'JHybridObject::CxxPart' "$ANDROID_HPP"; then
    echo "  [warn] JHybridBundleUpdaterSpec.hpp missing JHybridObject::CxxPart reference"
    ANDROID_OK=false
  fi
  if ! grep -q 'JHybridObject::JavaPart' "$ANDROID_HPP"; then
    echo "  [warn] JHybridBundleUpdaterSpec.hpp missing JHybridObject::JavaPart reference"
    ANDROID_OK=false
  fi
fi

if [ -f "$ANDROID_CPP" ]; then
  if ! grep -q 'getJHybridObject' "$ANDROID_CPP"; then
    echo "  [warn] JHybridBundleUpdaterSpec.cpp missing getJHybridObject() call"
    ANDROID_OK=false
  fi
  if ! grep -q 'createHybridObject' "$ANDROID_CPP"; then
    echo "  [warn] JHybridBundleUpdaterSpec.cpp missing createHybridObject() implementation"
    ANDROID_OK=false
  fi
fi

if [ -f "$ANDROID_KT" ]; then
  if ! grep -q 'HybridObject.CxxPart' "$ANDROID_KT"; then
    echo "  [warn] HybridBundleUpdaterSpec.kt missing HybridObject.CxxPart reference"
    ANDROID_OK=false
  fi
  if ! grep -q 'createCxxPart' "$ANDROID_KT"; then
    echo "  [warn] HybridBundleUpdaterSpec.kt missing createCxxPart() override"
    ANDROID_OK=false
  fi
fi

if [ -f "$ANDROID_ONLOAD" ]; then
  if ! grep -q 'CxxPart::registerNatives' "$ANDROID_ONLOAD"; then
    echo "  [warn] NitroUpdateOnLoad.cpp missing CxxPart::registerNatives() call"
    ANDROID_OK=false
  fi
fi

if [ "$ANDROID_OK" = true ]; then
  echo "  [ok] Android generated code validated"
else
  echo ""
  echo "  ⚠️  Android generated code may be incompatible with NitroModules >=0.35.0."
  echo "       Run 'npm run specs' with nitrogen >=0.35.0 to regenerate."
fi

echo ""
if [ $FIXES_APPLIED -gt 0 ]; then
  echo "Post-nitrogen fixes: $FIXES_APPLIED fix(es) applied."
else
  echo "Post-nitrogen fixes: all checks passed, no fixes needed."
fi
