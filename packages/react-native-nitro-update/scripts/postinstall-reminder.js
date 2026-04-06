#!/usr/bin/env node
/**
 * Short reminder after npm install (skipped in CI).
 */

if (process.env.CI === 'true' || process.env.CI === '1') {
  process.exit(0)
}

console.log(`
\x1b[36m[react-native-nitro-update]\x1b[0m Next steps:
  \x1b[2m•\x1b[0m Add peer: \x1b[1mnpm install react-native-nitro-modules\x1b[0m (if not already in package.json)
  \x1b[2m•\x1b[0m Wire native iOS/Android per \x1b[1mINTEGRATION.md\x1b[0m in this package, or run \x1b[1mnpx react-native-nitro-update bootstrap\x1b[0m for \x1b[1mOTA_BOOTSTRAP.md\x1b[0m
  \x1b[2m•\x1b[0m Validate: \x1b[1mnpx react-native-nitro-update doctor\x1b[0m
`)
