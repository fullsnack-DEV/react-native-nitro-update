#!/usr/bin/env node

/**
 * Interactive OTA setup for react-native-nitro-update.
 * Run after install:  npx -p react-native-nitro-update setup-ota
 * Or (if lib is installed):  npm run setupOTA
 *
 * Walks the user through:
 *   1. Pick hosting method (GitHub branch, S3, Firebase, custom API, manual)
 *   2. Collect required inputs
 *   3. Generate config files + code snippet
 */

const readline = require('readline')
const fs = require('fs')
const path = require('path')

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

function ask(question, fallback) {
  return new Promise((resolve) => {
    const suffix = fallback ? ` ${DIM}(${fallback})${RESET}` : ''
    rl.question(`${CYAN}?${RESET} ${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || fallback || '')
    })
  })
}

function choose(question, options) {
  return new Promise((resolve) => {
    console.log(`\n${CYAN}?${RESET} ${BOLD}${question}${RESET}`)
    options.forEach((opt, i) => {
      console.log(`  ${CYAN}${i + 1}${RESET}  ${opt.label}${opt.hint ? `  ${DIM}${opt.hint}${RESET}` : ''}`)
    })
    rl.question(`\n${CYAN}>${RESET} Enter number [1-${options.length}]: `, (answer) => {
      const idx = parseInt(answer, 10) - 1
      if (idx >= 0 && idx < options.length) {
        resolve(options[idx].value)
      } else {
        console.log(`${RED}Invalid choice. Defaulting to 1.${RESET}`)
        resolve(options[0].value)
      }
    })
  })
}

function banner() {
  console.log(`
${CYAN}╔══════════════════════════════════════════════════╗
║   ${BOLD}react-native-nitro-update${RESET}${CYAN}  —  OTA Setup Wizard  ║
╚══════════════════════════════════════════════════╝${RESET}
`)
  console.log(`${DIM}This will generate config files and code snippets`)
  console.log(`for your chosen OTA hosting method.${RESET}\n`)
}

async function main() {
  banner()

  const method = await choose('How do you want to host your OTA updates?', [
    { value: 'github_branch', label: 'GitHub Branch',           hint: 'Push version.txt + bundle.zip to a branch (easiest, free)' },
    { value: 'github_release', label: 'GitHub Releases',        hint: 'Attach assets to a GitHub Release' },
    { value: 's3',             label: 'AWS S3',                  hint: 'Upload to S3 bucket (with optional CloudFront CDN)' },
    { value: 'firebase',       label: 'Firebase Storage',       hint: 'Upload to Firebase / GCS bucket' },
    { value: 'api',            label: 'Custom API / Backend',   hint: 'POST to your own server endpoint' },
    { value: 'manual',         label: 'Manual / Any CDN',       hint: 'Just give me the code, I will host files myself' },
  ])

  let config = { method }

  switch (method) {
    case 'github_branch':
      config = await collectGithubBranch(config)
      break
    case 'github_release':
      config = await collectGithubRelease(config)
      break
    case 's3':
      config = await collectS3(config)
      break
    case 'firebase':
      config = await collectFirebase(config)
      break
    case 'api':
      config = await collectAPI(config)
      break
    case 'manual':
      config = await collectManual(config)
      break
  }

  const platform = await choose('Which platform(s)?', [
    { value: 'ios',      label: 'iOS only' },
    { value: 'android',  label: 'Android only' },
    { value: 'both',     label: 'Both iOS and Android' },
  ])
  config.platform = platform

  const applyMode = await choose('When should the OTA update apply?', [
    { value: 'next_launch',  label: 'Next app launch',  hint: 'Download in background, apply when user reopens (recommended)' },
    { value: 'immediate',    label: 'Immediately',       hint: 'Restart the app right after download' },
  ])
  config.applyMode = applyMode

  console.log(`\n${GREEN}${BOLD}Generating files...${RESET}\n`)

  const appDir = process.cwd()
  generateEnvFile(appDir, config)
  generateBuildScript(appDir, config)
  generateFastfile(appDir, config)
  printCodeSnippet(config)
  printNextSteps(config)

  rl.close()
}

// ─── Collectors ──────────────────────────────────────────────────────────

async function collectGithubBranch(config) {
  config.githubUrl = await ask('GitHub repo URL', 'https://github.com/owner/repo')
  config.branch = await ask('Branch name', 'main')
  config.versionFile = await ask('Version file name', 'version.txt')
  config.bundleFile = await ask('Bundle zip file name', 'bundle.zip')
  return config
}

async function collectGithubRelease(config) {
  config.githubUrl = await ask('GitHub repo URL', 'https://github.com/owner/repo')
  config.versionFile = await ask('Version file name (release asset)', 'version.txt')
  config.bundleFile = await ask('Bundle zip file name (release asset)', 'bundle.zip')
  return config
}

async function collectS3(config) {
  config.bucket = await ask('S3 bucket name')
  config.region = await ask('AWS region', 'us-east-1')
  config.prefix = await ask('Path prefix inside the bucket', 'ota/')

  console.log(`\n${DIM}Your manager needs to create an IAM user with s3:PutObject + s3:GetObject`)
  console.log(`permission on this bucket. You'll get an Access Key ID and Secret Access Key.${RESET}\n`)

  config.accessKeyId = await ask('AWS Access Key ID (or leave empty to set later)')
  config.secretAccessKey = await ask('AWS Secret Access Key (or leave empty to set later)')
  config.cloudfrontId = await ask('CloudFront distribution ID (optional, for cache invalidation)')

  const publicUrl = await ask('Public URL where files will be served', `https://${config.bucket}.s3.${config.region}.amazonaws.com/${config.prefix}`)
  config.publicBaseUrl = publicUrl.replace(/\/$/, '')

  return config
}

async function collectFirebase(config) {
  config.projectId = await ask('Firebase project ID')
  config.storagePrefix = await ask('Storage path prefix', 'ota/')

  console.log(`\n${DIM}You need a service account JSON with Storage write access.`)
  console.log(`Set GOOGLE_APPLICATION_CREDENTIALS to its path.${RESET}\n`)

  config.serviceAccountPath = await ask('Path to service account JSON (or leave empty to set later)')
  config.makePublic = await ask('Make uploaded files public? (y/n)', 'y')
  config.publicBaseUrl = await ask('Public URL for the bucket', `https://storage.googleapis.com/${config.projectId}.appspot.com/${config.storagePrefix}`)
  config.publicBaseUrl = config.publicBaseUrl.replace(/\/$/, '')

  return config
}

async function collectAPI(config) {
  config.apiUrl = await ask('Upload endpoint URL', 'https://your-api.com/ota/upload')
  config.apiKey = await ask('API key / secret (or leave empty to set later)')
  config.apiHeader = await ask('Auth header name', 'X-API-Key')

  config.configJsonUrl = await ask('Config JSON URL your API serves (for single-URL flow)', 'https://your-api.com/ota.json')

  return config
}

async function collectManual(config) {
  config.publicBaseUrl = await ask('Base URL where you will host version.txt + bundle.zip', 'https://your-cdn.com/ota')
  config.publicBaseUrl = config.publicBaseUrl.replace(/\/$/, '')
  return config
}

// ─── Generators ──────────────────────────────────────────────────────────

function generateEnvFile(appDir, config) {
  const envPath = path.join(appDir, '.env.ota')
  const examplePath = path.join(appDir, '.env.ota.example')

  let lines = ['# Generated by: npx setup-ota', `# Method: ${config.method}`, '']

  switch (config.method) {
    case 's3':
      lines.push('OTA_DESTINATION=s3')
      lines.push(`AWS_BUCKET=${config.bucket || ''}`)
      lines.push(`AWS_REGION=${config.region || 'us-east-1'}`)
      lines.push(`AWS_OTA_PREFIX=${config.prefix || 'ota/'}`)
      lines.push(`AWS_ACCESS_KEY_ID=${config.accessKeyId || ''}`)
      lines.push(`AWS_SECRET_ACCESS_KEY=${config.secretAccessKey || ''}`)
      if (config.cloudfrontId) lines.push(`AWS_CLOUDFRONT_ID=${config.cloudfrontId}`)
      break
    case 'firebase':
      lines.push('OTA_DESTINATION=firebase_storage')
      lines.push(`FIREBASE_PROJECT_ID=${config.projectId || ''}`)
      lines.push(`FIREBASE_STORAGE_PREFIX=${config.storagePrefix || 'ota/'}`)
      lines.push(`FIREBASE_STORAGE_PUBLIC=${config.makePublic === 'y' ? '1' : '0'}`)
      if (config.serviceAccountPath) lines.push(`GOOGLE_APPLICATION_CREDENTIALS=${config.serviceAccountPath}`)
      break
    case 'api':
      lines.push('OTA_DESTINATION=api')
      lines.push(`OTA_API_URL=${config.apiUrl || ''}`)
      lines.push(`OTA_API_KEY=${config.apiKey || ''}`)
      lines.push(`OTA_API_HEADER=${config.apiHeader || 'X-API-Key'}`)
      break
    default:
      lines.push('# No upload credentials needed for this method.')
      lines.push(`# OTA_DESTINATION=none`)
      break
  }

  const content = lines.join('\n') + '\n'

  fs.writeFileSync(examplePath, content)
  console.log(`  ${GREEN}Created${RESET}  .env.ota.example`)

  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, content)
    console.log(`  ${GREEN}Created${RESET}  .env.ota`)
  } else {
    console.log(`  ${YELLOW}Skipped${RESET}  .env.ota  ${DIM}(already exists)${RESET}`)
  }

  addToGitignore(appDir, '.env.ota')
  addToGitignore(appDir, 'ota-release/')
}

function generateBuildScript(appDir, config) {
  const scriptsDir = path.join(appDir, 'scripts')
  const scriptPath = path.join(scriptsDir, 'build-ota-zip.sh')

  if (fs.existsSync(scriptPath)) {
    console.log(`  ${YELLOW}Skipped${RESET}  scripts/build-ota-zip.sh  ${DIM}(already exists)${RESET}`)
    return
  }

  if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true })

  const platforms = config.platform === 'both' ? ['ios', 'android'] : [config.platform]
  const bundleBlocks = platforms.map((p) => {
    const ext = p === 'ios' ? 'jsbundle' : 'bundle'
    const bundleFile = p === 'ios' ? `index.ios.${ext}` : `index.android.${ext}`
    return `
echo "Bundling ${p} (production)..."
npx react-native bundle \\
  --platform ${p} \\
  --dev false \\
  --entry-file index.js \\
  --bundle-output "$OUT_DIR/${bundleFile}" \\
  --assets-dest "$OUT_DIR"

BUNDLE_FILES="$BUNDLE_FILES ${bundleFile}"
`
  }).join('')

  const script = `#!/usr/bin/env bash
#
# Build OTA bundle and zip for react-native-nitro-update.
# Generated by: npx setup-ota
#
# Usage:
#   npm run ota:zip              # version from package.json
#   npm run ota:zip -- 1.0.2     # custom version
#   OTA_VERSION=1.0.2 npm run ota:zip
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="$APP_DIR/ota-release"
ZIP_NAME="bundle.zip"
BUNDLE_FILES=""

get_version() {
  if [[ -n "\${1:-}" ]]; then
    echo "$1"
  elif [[ -n "\${OTA_VERSION:-}" ]]; then
    echo "$OTA_VERSION"
  else
    node -p "require('$APP_DIR/package.json').version"
  fi
}

VERSION="$(get_version "\${1:-}")"

echo "Building OTA release (version: $VERSION)"
mkdir -p "$OUT_DIR"
cd "$APP_DIR"

echo "$VERSION" > "$OUT_DIR/version.txt"
${bundleBlocks}
echo "Creating zip..."
cd "$OUT_DIR"
rm -f "$ZIP_NAME"
zip -q "$ZIP_NAME" $BUNDLE_FILES version.txt

echo ""
echo "Done. OTA artifacts:"
echo "  $OUT_DIR/version.txt"
echo "  $OUT_DIR/$ZIP_NAME"
ls -la "$OUT_DIR/$ZIP_NAME"
`

  fs.writeFileSync(scriptPath, script, { mode: 0o755 })
  console.log(`  ${GREEN}Created${RESET}  scripts/build-ota-zip.sh`)

  addNpmScript(appDir, 'ota:zip', 'bash scripts/build-ota-zip.sh')
  addNpmScript(appDir, 'setupOTA', 'node -e "require(\'react-native-nitro-update/bin/setup-ota.js\')"')
}

function generateFastfile(appDir, config) {
  if (config.method === 'github_branch' || config.method === 'github_release' || config.method === 'manual') {
    console.log(`  ${DIM}Skipped${RESET}  Fastfile  ${DIM}(not needed for ${config.method})${RESET}`)
    return
  }

  const fastlaneDir = path.join(appDir, 'fastlane')
  const fastfilePath = path.join(fastlaneDir, 'Fastfile')

  if (fs.existsSync(fastfilePath)) {
    console.log(`  ${YELLOW}Skipped${RESET}  fastlane/Fastfile  ${DIM}(already exists)${RESET}`)
    return
  }

  if (!fs.existsSync(fastlaneDir)) fs.mkdirSync(fastlaneDir, { recursive: true })

  let uploadBlock = ''

  if (config.method === 's3') {
    uploadBlock = `
    bucket = ENV["AWS_BUCKET"] || UI.user_error!("Set AWS_BUCKET in .env.ota")
    region = ENV["AWS_REGION"] || "us-east-1"
    prefix = ENV["AWS_OTA_PREFIX"] || "ota/"
    prefix = "\#{prefix}/" unless prefix.end_with?("/")

    UI.message("Uploading to S3 s3://\#{bucket}/\#{prefix}...")
    sh("aws s3 cp \#{out_dir}/version.txt s3://\#{bucket}/\#{prefix}version.txt")
    sh("aws s3 cp \#{out_dir}/bundle.zip s3://\#{bucket}/\#{prefix}bundle.zip")
    if ENV["AWS_CLOUDFRONT_ID"]
      UI.message("Invalidating CloudFront cache...")
      sh("aws cloudfront create-invalidation --distribution-id \#{ENV['AWS_CLOUDFRONT_ID']} --paths \\"/\#{prefix}*\\"")
    end`
  } else if (config.method === 'firebase') {
    uploadBlock = `
    project_id = ENV["FIREBASE_PROJECT_ID"] || UI.user_error!("Set FIREBASE_PROJECT_ID in .env.ota")
    prefix = ENV["FIREBASE_STORAGE_PREFIX"] || "ota/"
    UI.message("Uploading to Firebase Storage...")
    sh("gsutil cp \#{out_dir}/version.txt gs://\#{project_id}.appspot.com/\#{prefix}version.txt")
    sh("gsutil cp \#{out_dir}/bundle.zip gs://\#{project_id}.appspot.com/\#{prefix}bundle.zip")
    if ENV["FIREBASE_STORAGE_PUBLIC"] == "1"
      sh("gsutil -m acl ch -r -u AllUsers:R gs://\#{project_id}.appspot.com/\#{prefix}")
    end`
  } else if (config.method === 'api') {
    uploadBlock = `
    url = ENV["OTA_API_URL"] || UI.user_error!("Set OTA_API_URL in .env.ota")
    api_key = ENV["OTA_API_KEY"]
    header = ENV["OTA_API_HEADER"] || "X-API-Key"
    UI.message("Uploading to API \#{url}...")
    cmd = "curl -sf -X POST"
    cmd += " -H \\"\#{header}: \#{api_key}\\"" if api_key && !api_key.empty?
    cmd += " -F \\"version=\#{ota_version}\\""
    cmd += " -F \\"zip=@\#{out_dir}/bundle.zip\\""
    cmd += " \\"\#{url}\\""
    sh(cmd)`
  }

  const fastfile = `# Generated by: npx setup-ota
# Run:  fastlane ota
# With version:  fastlane ota version:1.0.5
# Dry run:  fastlane ota dry_run:true

default_platform(:ios)

platform :ios do
  desc "Build OTA bundle and upload"
  lane :ota do |options|
    version = options[:version] || ENV["OTA_VERSION"]
    dry_run = options[:dry_run] || false

    app_dir = File.expand_path("..", __dir__)
    out_dir = File.join(app_dir, "ota-release")

    # 1. Build
    if version
      sh("cd \#{app_dir} && OTA_VERSION=\#{version} npm run ota:zip")
    else
      sh("cd \#{app_dir} && npm run ota:zip")
    end

    version_file = File.join(out_dir, "version.txt")
    ota_version = File.read(version_file).strip
    UI.success("OTA version: \#{ota_version}")

    if dry_run
      UI.important("Dry run — skipping upload")
      next
    end

    # 2. Upload
${uploadBlock}

    UI.success("OTA \#{ota_version} published!")
  end
end
`

  fs.writeFileSync(fastfilePath, fastfile)
  console.log(`  ${GREEN}Created${RESET}  fastlane/Fastfile`)
}

function printCodeSnippet(config) {
  console.log(`\n${CYAN}${BOLD}── Code snippet ──${RESET}`)
  console.log(`${DIM}Add this to your App.tsx (or wherever you want OTA):${RESET}\n`)

  let importLine = ''
  let configLine = ''
  let checkLine = ''

  switch (config.method) {
    case 'github_branch':
      importLine = `import {\n  checkForUpdate, downloadUpdate, confirmBundle, getStoredVersion,\n  reloadApp, githubOTA,\n} from 'react-native-nitro-update'`
      configLine = `const { versionUrl, downloadUrl } = githubOTA({\n  githubUrl: '${config.githubUrl}',\n  ref: '${config.branch}',\n  otaVersionPath: '${config.versionFile}',\n  bundlePath: '${config.bundleFile}',\n  useReleases: false,\n})`
      checkLine = buildCheckSnippet('versionUrl', 'downloadUrl', config.applyMode)
      break
    case 'github_release':
      importLine = `import {\n  checkForUpdate, downloadUpdate, confirmBundle, getStoredVersion,\n  reloadApp, githubOTA,\n} from 'react-native-nitro-update'`
      configLine = `const { versionUrl, downloadUrl } = githubOTA({\n  githubUrl: '${config.githubUrl}',\n  otaVersionPath: '${config.versionFile}',\n  bundlePath: '${config.bundleFile}',\n  useReleases: true,\n})`
      checkLine = buildCheckSnippet('versionUrl', 'downloadUrl', config.applyMode)
      break
    case 's3':
    case 'firebase':
    case 'manual':
      importLine = `import {\n  checkForUpdate, downloadUpdate, confirmBundle, getStoredVersion,\n  reloadApp, otaUrls,\n} from 'react-native-nitro-update'`
      configLine = `const { versionUrl, downloadUrl } = otaUrls('${config.publicBaseUrl || 'https://your-cdn.com/ota'}')`
      checkLine = buildCheckSnippet('versionUrl', 'downloadUrl', config.applyMode)
      break
    case 'api':
      importLine = `import {\n  checkAndDownloadFromConfig, confirmBundle, getStoredVersion,\n} from 'react-native-nitro-update'`
      configLine = `const OTA_CONFIG_URL = '${config.configJsonUrl || 'https://your-api.com/ota.json'}'`
      checkLine = buildSingleUrlSnippet(config.applyMode)
      break
  }

  console.log(`\`\`\`typescript\n${importLine}\n\n${configLine}\n\n${checkLine}\n\`\`\`\n`)
}

function buildCheckSnippet(versionVar, downloadVar, applyMode) {
  const reloadLine = applyMode === 'immediate' ? `\n    reloadApp()  // restart now` : `\n    // New bundle saved; will load on next app launch`
  return `// On mount (e.g. in useEffect):
const current = getStoredVersion()
if (current) confirmBundle()

// After interactions settle:
const hasUpdate = await checkForUpdate(${versionVar})
if (hasUpdate) {
  await downloadUpdate(${downloadVar})${reloadLine}
}`
}

function buildSingleUrlSnippet(applyMode) {
  const reloadOpt = applyMode === 'immediate' ? ', { reloadAfterDownload: true }' : ''
  return `// On mount:
const current = getStoredVersion()
if (current) confirmBundle()

// After interactions settle:
const { updated } = await checkAndDownloadFromConfig(OTA_CONFIG_URL${reloadOpt})
if (updated) {
  console.log('Update downloaded${applyMode === 'immediate' ? ', restarting...' : '; will apply on next launch'}')
}`
}

function printNextSteps(config) {
  console.log(`${GREEN}${BOLD}── Next steps ──${RESET}\n`)

  const steps = []

  steps.push('1. Wire native so the app loads OTA bundle when present:')
  steps.push('   iOS:     In AppDelegate, use NitroUpdateBundleManager.getStoredBundleURL()')
  steps.push('   Android: In MainApplication, use NitroUpdateBundleLoader.getStoredBundlePath(context)')

  steps.push('')
  steps.push('2. Add the code snippet above to your App.tsx')

  steps.push('')
  steps.push('3. Build an OTA zip:')
  steps.push('   npm run ota:zip            # uses version from package.json')
  steps.push('   npm run ota:zip -- 1.0.5   # custom version')

  switch (config.method) {
    case 'github_branch':
      steps.push('')
      steps.push('4. Upload: push version.txt and bundle.zip to your repo branch:')
      steps.push(`   cp ota-release/version.txt . && cp ota-release/bundle.zip .`)
      steps.push(`   git add version.txt bundle.zip && git commit -m "OTA 1.0.x" && git push origin ${config.branch}`)
      break
    case 'github_release':
      steps.push('')
      steps.push('4. Upload: create a GitHub Release and attach version.txt + bundle.zip:')
      steps.push('   gh release create v1.0.x ota-release/version.txt ota-release/bundle.zip')
      break
    case 's3':
      steps.push('')
      steps.push('4. Upload to S3:')
      steps.push('   fastlane ota                   # builds + uploads')
      steps.push('   fastlane ota version:1.0.5     # custom version')
      steps.push('')
      steps.push(`   ${DIM}Make sure .env.ota has your AWS credentials.`)
      steps.push(`   Your manager creates an IAM user with s3:PutObject on the bucket.`)
      steps.push(`   You need: AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY.${RESET}`)
      break
    case 'firebase':
      steps.push('')
      steps.push('4. Upload to Firebase Storage:')
      steps.push('   fastlane ota')
      steps.push('')
      steps.push(`   ${DIM}Set GOOGLE_APPLICATION_CREDENTIALS in .env.ota.${RESET}`)
      break
    case 'api':
      steps.push('')
      steps.push('4. Upload via your API:')
      steps.push('   fastlane ota')
      steps.push('')
      steps.push(`   ${DIM}Your API should accept POST with version + zip fields.`)
      steps.push(`   It should serve GET ${config.configJsonUrl} returning { version, bundleUrl }.${RESET}`)
      break
    case 'manual':
      steps.push('')
      steps.push('4. Upload ota-release/version.txt and ota-release/bundle.zip to your host.')
      steps.push(`   They should be at: ${config.publicBaseUrl}/version.txt and ${config.publicBaseUrl}/bundle.zip`)
      break
  }

  steps.push('')
  steps.push(`${DIM}Docs: https://github.com/fullsnack-DEV/react-native-nitro-update${RESET}`)

  console.log(steps.join('\n'))
  console.log('')
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function addToGitignore(appDir, entry) {
  const gitignorePath = path.join(appDir, '.gitignore')
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `${entry}\n`)
    return
  }
  const content = fs.readFileSync(gitignorePath, 'utf8')
  if (!content.includes(entry)) {
    fs.appendFileSync(gitignorePath, `\n${entry}\n`)
  }
}

function addNpmScript(appDir, name, command) {
  const pkgPath = path.join(appDir, 'package.json')
  if (!fs.existsSync(pkgPath)) return
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
    if (!pkg.scripts) pkg.scripts = {}
    if (pkg.scripts[name]) {
      console.log(`  ${YELLOW}Skipped${RESET}  npm script "${name}"  ${DIM}(already exists)${RESET}`)
      return
    }
    pkg.scripts[name] = command
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
    console.log(`  ${GREEN}Added${RESET}   npm script: ${BOLD}npm run ${name}${RESET}`)
  } catch {}
}

main().catch((err) => {
  console.error(`${RED}Error: ${err.message}${RESET}`)
  process.exit(1)
})
