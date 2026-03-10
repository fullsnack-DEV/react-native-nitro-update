#!/usr/bin/env node

/**
 * Package-hosted OTA build command.
 *
 * Usage:
 *   npx react-native-nitro-update build --platform ios
 *   npx react-native-nitro-update build --platform android --version 1.0.2
 *   npx react-native-nitro-update build --platform both --output ./my-ota
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--platform' && argv[i + 1]) {
      args.platform = argv[++i]
    } else if (arg === '--version' && argv[i + 1]) {
      args.version = argv[++i]
    } else if (arg === '--entry' && argv[i + 1]) {
      args.entry = argv[++i]
    } else if (arg === '--output' && argv[i + 1]) {
      args.output = argv[++i]
    } else if (arg === '--dev') {
      args.dev = true
    } else if (arg === '--help' || arg === '-h') {
      args.help = true
    }
  }
  return args
}

function printHelp() {
  console.log(`
${BOLD}react-native-nitro-update build${RESET}

Build an OTA bundle zip ready for upload.

${BOLD}Usage:${RESET}
  npx react-native-nitro-update build [options]

${BOLD}Options:${RESET}
  --platform <ios|android|both>   Target platform (default: ios)
  --version <string>              OTA version string (auto-detected from native project if omitted)
  --entry <file>                  Entry file (default: index.js)
  --output <dir>                  Output directory (default: ./ota-output)
  --dev                           Dev build (default: false)
  -h, --help                      Show this help

${BOLD}Examples:${RESET}
  npx react-native-nitro-update build --platform ios
  npx react-native-nitro-update build --platform android --version 1.0.2
  npx react-native-nitro-update build --platform both --output ./my-ota
`)
}

function detectVersionFromNative(projectRoot, platform) {
  if (platform === 'ios' || platform === 'both') {
    const version = detectIOSVersion(projectRoot)
    if (version) return version
  }
  if (platform === 'android' || platform === 'both') {
    const version = detectAndroidVersion(projectRoot)
    if (version) return version
  }
  return null
}

function detectIOSVersion(projectRoot) {
  const iosDir = path.join(projectRoot, 'ios')
  if (!fs.existsSync(iosDir)) return null

  try {
    const entries = fs.readdirSync(iosDir)
    const xcodeproj = entries.find((e) => e.endsWith('.xcodeproj'))
    if (!xcodeproj) return null

    const pbxproj = path.join(iosDir, xcodeproj, 'project.pbxproj')
    if (!fs.existsSync(pbxproj)) return null

    const content = fs.readFileSync(pbxproj, 'utf8')
    const match = content.match(/MARKETING_VERSION\s*=\s*([^;]+);/)
    if (match) return match[1].trim()
  } catch {}
  return null
}

function detectAndroidVersion(projectRoot) {
  const gradlePath = path.join(projectRoot, 'android', 'app', 'build.gradle')
  if (!fs.existsSync(gradlePath)) {
    const ktsPath = gradlePath + '.kts'
    if (fs.existsSync(ktsPath)) {
      try {
        const content = fs.readFileSync(ktsPath, 'utf8')
        const match = content.match(/versionName\s*=?\s*"([^"]+)"/)
        if (match) return match[1]
      } catch {}
    }
    return null
  }

  try {
    const content = fs.readFileSync(gradlePath, 'utf8')
    const match = content.match(/versionName\s+["']([^"']+)["']/)
    if (match) return match[1]
  } catch {}
  return null
}

function detectVersionFromPackageJson(projectRoot) {
  const pkgPath = path.join(projectRoot, 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    return pkg.version || null
  } catch {}
  return null
}

function run(cmd, cwd) {
  console.log(`${DIM}$ ${cmd}${RESET}`)
  execSync(cmd, { cwd, stdio: 'inherit' })
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.help) {
    printHelp()
    process.exit(0)
  }

  const projectRoot = process.cwd()
  const platform = args.platform || 'ios'
  const entry = args.entry || 'index.js'
  const outputDir = path.resolve(projectRoot, args.output || 'ota-output')
  const dev = args.dev || false

  if (!['ios', 'android', 'both'].includes(platform)) {
    console.error(`${RED}Error: --platform must be ios, android, or both${RESET}`)
    process.exit(1)
  }

  // Resolve version: CLI flag > native project > package.json > error
  let version = args.version
  if (!version) {
    version = detectVersionFromNative(projectRoot, platform)
    if (version) {
      console.log(`${GREEN}Auto-detected version from native project: ${BOLD}${version}${RESET}`)
    }
  }
  if (!version) {
    version = detectVersionFromPackageJson(projectRoot)
    if (version) {
      console.log(`${YELLOW}Using version from package.json: ${BOLD}${version}${RESET}`)
    }
  }
  if (!version) {
    console.error(`${RED}Error: Could not detect version. Pass --version <string> explicitly.${RESET}`)
    process.exit(1)
  }

  const platforms = platform === 'both' ? ['ios', 'android'] : [platform]

  console.log(`
${CYAN}${BOLD}react-native-nitro-update${RESET} ${DIM}OTA build${RESET}
${DIM}─────────────────────────────────${RESET}
  Platform:  ${BOLD}${platform}${RESET}
  Version:   ${BOLD}${version}${RESET}
  Entry:     ${entry}
  Output:    ${outputDir}
  Dev:       ${dev}
${DIM}─────────────────────────────────${RESET}
`)

  // Clean and create output directory
  if (fs.existsSync(outputDir)) {
    fs.rmSync(outputDir, { recursive: true })
  }
  fs.mkdirSync(outputDir, { recursive: true })

  // Write version.txt
  fs.writeFileSync(path.join(outputDir, 'version.txt'), version + '\n')
  console.log(`${GREEN}Wrote${RESET} version.txt (${version})`)

  // Bundle each platform
  const bundleFiles = []

  for (const p of platforms) {
    const ext = p === 'ios' ? 'jsbundle' : 'bundle'
    const bundleFile = p === 'ios' ? `index.ios.${ext}` : `index.android.${ext}`
    const bundleOutput = path.join(outputDir, bundleFile)

    console.log(`\n${CYAN}Bundling ${p}...${RESET}`)

    run(
      `npx react-native bundle` +
      ` --platform ${p}` +
      ` --dev ${dev}` +
      ` --entry-file ${entry}` +
      ` --bundle-output "${bundleOutput}"` +
      ` --assets-dest "${outputDir}"`,
      projectRoot
    )

    bundleFiles.push(bundleFile)
    console.log(`${GREEN}Bundled${RESET} ${bundleFile}`)
  }

  // Create zip
  console.log(`\n${CYAN}Creating zip...${RESET}`)

  const assetsDir = path.join(outputDir, 'assets')
  const hasAssets = fs.existsSync(assetsDir) && fs.statSync(assetsDir).isDirectory()

  const zipName = 'bundle.zip'
  const filesToZip = [...bundleFiles, 'version.txt']
  if (hasAssets) {
    filesToZip.push('assets')
  }

  run(`zip -rq "${zipName}" ${filesToZip.join(' ')}`, outputDir)

  // Summary
  const zipPath = path.join(outputDir, zipName)
  const zipStat = fs.statSync(zipPath)
  const sizeMB = (zipStat.size / (1024 * 1024)).toFixed(2)

  console.log(`
${GREEN}${BOLD}OTA build complete${RESET}

  ${BOLD}Version:${RESET}   ${version}
  ${BOLD}Zip:${RESET}       ${zipPath}
  ${BOLD}Size:${RESET}      ${sizeMB} MB
  ${BOLD}Contains:${RESET}  ${filesToZip.join(', ')}

${DIM}Upload version.txt and ${zipName} to your CDN / GitHub Release / S3.${RESET}
`)
}

main()
