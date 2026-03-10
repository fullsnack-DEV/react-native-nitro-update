#!/usr/bin/env bash
# Apply compatibility fixes to Nitrogen-generated files for current react-native-nitro-modules.
# Run this after `npm run specs` (nitrogen) so the generated code works without consumer patches.
#
# Fixes applied:
# 1) RecyclableView → HybridView (NitroUpdateAutolinking.swift)
# 2) Remove override from equals() in *Swift.hpp bridge (HybridObject::equals is not virtual)
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
GEN="$PKG_DIR/nitrogen/generated"

# 1) Swift: HybridView instead of RecyclableView
AUTOLINK="$GEN/ios/NitroUpdateAutolinking.swift"
if [ -f "$AUTOLINK" ]; then
  sed -i '' 's/RecyclableView\.Type/HybridView.Type/g' "$AUTOLINK"
  echo "Applied HybridView fix to NitroUpdateAutolinking.swift"
fi

# 2) C++: remove override from equals() in Swift bridge
SWIFT_HPP="$GEN/ios/c++/HybridBundleUpdaterSpecSwift.hpp"
if [ -f "$SWIFT_HPP" ]; then
  sed -i '' 's/bool equals(const std::shared_ptr<HybridObject>\& other) override {/bool equals(const std::shared_ptr<HybridObject>\& other) {/' "$SWIFT_HPP"
  echo "Removed override from equals() in HybridBundleUpdaterSpecSwift.hpp"
fi

echo "Post-nitrogen fixes done."
