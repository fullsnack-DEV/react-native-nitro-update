#!/usr/bin/env node

/**
 * Run the react-native-nitro-update CLI from the installed package.
 * Use this in package.json scripts so you don't need long inline node -e "..." commands.
 *
 * Usage (from your app directory):
 *   node node_modules/react-native-nitro-update/scripts/run-cli.js build --platform ios
 *   node node_modules/react-native-nitro-update/scripts/run-cli.js build --platform ios --upload s3
 *   node node_modules/react-native-nitro-update/scripts/run-cli.js setup
 *
 * Or add to package.json:
 *   "ota:build": "node node_modules/react-native-nitro-update/scripts/run-cli.js build --platform ios"
 *   "ota:build:upload": "node node_modules/react-native-nitro-update/scripts/run-cli.js build --platform ios --upload s3"
 *   "setupOTA": "node node_modules/react-native-nitro-update/scripts/run-cli.js setup"
 */

const path = require('path');

const pkgRoot = path.resolve(__dirname, '..');
const cliPath = path.join(pkgRoot, 'bin', 'cli.js');

process.argv = [process.argv[0], cliPath, ...process.argv.slice(2)];
require(cliPath);
