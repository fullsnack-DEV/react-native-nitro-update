#!/usr/bin/env node

/**
 * Main CLI entry point for react-native-nitro-update.
 *
 * Usage:
 *   npx react-native-nitro-update build [options]
 *   npx react-native-nitro-update doctor [--json]
 *   npx react-native-nitro-update setup
 *   npx react-native-nitro-update bootstrap
 */

const fs = require('fs')
const path = require('path')
const args = process.argv.slice(2)
const command = args[0]

switch (command) {
  case 'bootstrap': {
    const { writeOtaBootstrap } = require('../scripts/ota-bootstrap.js')
    const appDir = process.cwd()
    let baseUrl
    try {
      const otaConfigPath = path.join(appDir, 'ota-config.js')
      if (fs.existsSync(otaConfigPath)) {
        baseUrl = require(otaConfigPath).baseUrl
      }
    } catch {
      // ignore
    }
    writeOtaBootstrap(appDir, {
      baseUrl,
      sourceTag: 'npx react-native-nitro-update bootstrap',
      quiet: false,
    })
    break
  }

  case 'build':
    process.argv = [process.argv[0], process.argv[1], ...args.slice(1)]
    require('./build.js')
    break

  case 'doctor': {
    const { runDoctorCli } = require('./doctor.js')
    runDoctorCli(args.slice(1))
      .then((code) => process.exit(code))
      .catch((err) => {
        console.error(`\x1b[31mError: ${err.message}\x1b[0m`)
        process.exit(1)
      })
    break
  }

  case 'setup':
    process.argv = [process.argv[0], process.argv[1], ...args.slice(1)]
    require('./setup-ota.js')
    break

  case '--help':
  case '-h':
  case undefined:
    console.log(`
\x1b[1mreact-native-nitro-update\x1b[0m CLI

\x1b[1mCommands:\x1b[0m
  build      Build OTA bundle zip (react-native bundle + zip)
  doctor     Diagnose project setup issues
  setup      Interactive OTA setup wizard
  bootstrap  Write OTA_BOOTSTRAP.md (native checklist + snippets)

\x1b[1mExamples:\x1b[0m
  npx react-native-nitro-update build --platform ios
  npx react-native-nitro-update build --platform both --version 1.0.2
  npx react-native-nitro-update doctor
  npx react-native-nitro-update doctor --json
  npx react-native-nitro-update setup
  npx react-native-nitro-update bootstrap

Run any command with --help for more details.
`)
    break

  default:
    console.error(`\x1b[31mUnknown command: ${command}\x1b[0m`)
    console.error(`Run \x1b[1mnpx react-native-nitro-update --help\x1b[0m for available commands.`)
    process.exit(1)
}
