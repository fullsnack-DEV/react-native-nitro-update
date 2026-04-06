#!/usr/bin/env node

/**
 * Diagnostic tool for react-native-nitro-update setup.
 * Run: npx setup-ota doctor
 *      npx setup-ota doctor --json
 */

const fs = require('fs')
const path = require('path')

const CYAN = '\x1b[36m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const RED = '\x1b[31m'
const DIM = '\x1b[2m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const CHECK = `${GREEN}✓${RESET}`
const WARN = `${YELLOW}⚠${RESET}`
const FAIL = `${RED}✗${RESET}`

class Doctor {
  constructor(projectRoot, options = {}) {
    this.projectRoot = projectRoot
    this.jsonOutput = options.json || false
    this.results = []
  }

  log(icon, message) {
    if (!this.jsonOutput) {
      console.log(`  ${icon} ${message}`)
    }
  }

  addResult(name, status, message, fix = null) {
    this.results.push({ name, status, message, fix })
  }

  async run() {
    if (!this.jsonOutput) {
      console.log(`
${CYAN}${BOLD}react-native-nitro-update doctor${RESET}
${DIM}Checking your project setup...${RESET}
`)
    }

    this.checkPackageJson()
    this.checkReactNativeVersion()
    this.checkNitroModulesVersion()
    this.checkiOSPodfile()
    this.checkIOSOtaBundleLoading()
    this.checkAndroidMainApplication()
    this.checkSwiftSettings()
    this.checkMetroConfig()

    if (this.jsonOutput) {
      console.log(JSON.stringify({ checks: this.results }, null, 2))
    } else {
      this.printSummary()
    }

    const hasErrors = this.results.some((r) => r.status === 'error')
    return hasErrors ? 1 : 0
  }

  checkPackageJson() {
    const pkgPath = path.join(this.projectRoot, 'package.json')

    if (!fs.existsSync(pkgPath)) {
      this.addResult('package.json', 'error', 'Not found', 'Run this command from your React Native project root')
      return
    }

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }

      if (!deps['react-native-nitro-update']) {
        this.addResult(
          'react-native-nitro-update',
          'error',
          'Not installed',
          'npm install react-native-nitro-update'
        )
        this.log(FAIL, 'react-native-nitro-update not in dependencies')
      } else {
        this.addResult('react-native-nitro-update', 'ok', `Installed: ${deps['react-native-nitro-update']}`)
        this.log(CHECK, `react-native-nitro-update: ${deps['react-native-nitro-update']}`)
      }

      if (!deps['react-native-nitro-modules']) {
        this.addResult(
          'react-native-nitro-modules',
          'error',
          'Not installed',
          'npm install react-native-nitro-modules'
        )
        this.log(FAIL, 'react-native-nitro-modules not in dependencies')
      } else {
        this.addResult('react-native-nitro-modules', 'ok', `Installed: ${deps['react-native-nitro-modules']}`)
        this.log(CHECK, `react-native-nitro-modules: ${deps['react-native-nitro-modules']}`)
      }
    } catch (e) {
      this.addResult('package.json', 'error', `Parse error: ${e.message}`)
      this.log(FAIL, `package.json parse error: ${e.message}`)
    }
  }

  checkReactNativeVersion() {
    const pkgPath = path.join(this.projectRoot, 'package.json')
    if (!fs.existsSync(pkgPath)) return

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const rnVersion = deps['react-native']

      if (!rnVersion) {
        this.addResult('react-native', 'error', 'Not found in dependencies')
        this.log(FAIL, 'react-native not found')
        return
      }

      const versionMatch = rnVersion.match(/(\d+)\.(\d+)/)
      if (versionMatch) {
        const major = parseInt(versionMatch[1], 10)
        const minor = parseInt(versionMatch[2], 10)

        if (major === 0 && minor < 73) {
          this.addResult(
            'react-native-version',
            'warning',
            `Version ${rnVersion} may have compatibility issues`,
            'react-native-nitro-update works best with RN 0.73+'
          )
          this.log(WARN, `react-native ${rnVersion} - recommend 0.73+`)
        } else {
          this.addResult('react-native-version', 'ok', `Version ${rnVersion} is compatible`)
          this.log(CHECK, `react-native ${rnVersion}`)
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  checkNitroModulesVersion() {
    const pkgPath = path.join(this.projectRoot, 'package.json')
    if (!fs.existsSync(pkgPath)) return

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const nitroVersion = deps['react-native-nitro-modules']

      if (!nitroVersion) return

      const versionMatch = nitroVersion.match(/(\d+)\.(\d+)/)
      if (versionMatch) {
        const major = parseInt(versionMatch[1], 10)
        const minor = parseInt(versionMatch[2], 10)

        if (major === 0 && minor < 20) {
          this.addResult(
            'nitro-modules-version',
            'warning',
            `Version ${nitroVersion} may have API differences`,
            'Consider upgrading to 0.20+ for better compatibility'
          )
          this.log(WARN, `react-native-nitro-modules ${nitroVersion} - recommend 0.20+`)
        } else {
          this.addResult('nitro-modules-version', 'ok', `Version ${nitroVersion}`)
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  checkiOSPodfile() {
    const podfilePath = path.join(this.projectRoot, 'ios', 'Podfile')

    if (!fs.existsSync(podfilePath)) {
      this.addResult('ios-podfile', 'warning', 'ios/Podfile not found', 'iOS setup not detected')
      this.log(WARN, 'ios/Podfile not found')
      return
    }

    const content = fs.readFileSync(podfilePath, 'utf8')

    // Check for NitroUpdateBundleManager pod
    if (!content.includes('NitroUpdateBundleManager')) {
      this.addResult(
        'ios-bundle-manager-pod',
        'error',
        'NitroUpdateBundleManager pod not found in Podfile',
        `Add to Podfile:\n  pod 'NitroUpdateBundleManager', :path => '../node_modules/react-native-nitro-update'`
      )
      this.log(FAIL, 'NitroUpdateBundleManager pod not in Podfile')
    } else {
      this.addResult('ios-bundle-manager-pod', 'ok', 'NitroUpdateBundleManager pod configured')
      this.log(CHECK, 'NitroUpdateBundleManager pod found')
    }

    // Check for nitro_update_pod_utils.rb or sanitize_swift_conditions
    if (content.includes('nitro_update_pod_utils') || content.includes('sanitize_swift_conditions')) {
      this.addResult('ios-swift-sanitizer', 'ok', 'Swift flag sanitization configured')
      this.log(CHECK, 'Swift flag sanitization configured')
    } else {
      this.addResult(
        'ios-swift-sanitizer',
        'error',
        'Swift flag sanitization not configured (required)',
        `Add to Podfile post_install:\n  require_relative '../node_modules/react-native-nitro-update/scripts/nitro_update_pod_utils'\n  NitroUpdatePodUtils.apply!(installer)`
      )
      this.log(FAIL, 'Missing NitroUpdatePodUtils Podfile wiring')
    }
  }

  /**
   * @returns {{ major: number, minor: number, raw: string } | null}
   */
  getReactNativeSemver() {
    const pkgPath = path.join(this.projectRoot, 'package.json')
    if (!fs.existsSync(pkgPath)) return null
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
      const deps = { ...pkg.dependencies, ...pkg.devDependencies }
      const v = deps['react-native']
      if (!v || typeof v !== 'string') return null
      const cleaned = v.replace(/^[\^~>=<]+\s*/, '')
      const m = cleaned.match(/^(\d+)\.(\d+)/)
      if (!m) return null
      return { major: parseInt(m[1], 10), minor: parseInt(m[2], 10), raw: v }
    } catch {
      return null
    }
  }

  /**
   * Swift / ObjC sources under ios/, excluding Pods and build outputs.
   * @param {string} iosDir
   * @returns {string[]}
   */
  findIosNativeSourceFiles(iosDir) {
    const results = []
    const skipDirs = new Set(['Pods', 'build', 'DerivedData', 'node_modules', '.git'])

    const walk = (dir) => {
      let entries
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        if (skipDirs.has(entry.name)) continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(fullPath)
        } else if (/\.(swift|m|mm)$/.test(entry.name)) {
          results.push(fullPath)
        }
      }
    }

    walk(iosDir)
    return results
  }

  iosFileIndicatesOta(content) {
    return (
      content.includes('NitroUpdateBundleManager') ||
      content.includes('NitroUpdateBundleManagerObjC') ||
      content.includes('getStoredBundleURL')
    )
  }

  checkIOSOtaBundleLoading() {
    const iosDir = path.join(this.projectRoot, 'ios')
    if (!fs.existsSync(iosDir)) return

    const appDelegateFiles = this.findFiles(iosDir, /AppDelegate\.(swift|mm?)$/)
    const sourceFiles = this.findIosNativeSourceFiles(iosDir)

    if (sourceFiles.length === 0) {
      this.addResult('ios-app-delegate', 'warning', 'No iOS .swift/.m/.mm sources found under ios/')
      this.log(WARN, 'No iOS native sources found')
      return
    }

    let foundFile = null
    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf8')
      if (this.iosFileIndicatesOta(content)) {
        foundFile = file
        break
      }
    }

    if (foundFile) {
      const short = path.relative(this.projectRoot, foundFile)
      this.addResult('ios-app-delegate', 'ok', `OTA bundle loading referenced in ${short}`)
      this.log(CHECK, `iOS OTA wiring found (${short})`)
    } else {
      this.addResult(
        'ios-app-delegate',
        'error',
        'No OTA bundle loading found under ios/ (searched .swift/.m/.mm excluding Pods)',
        `Add NitroUpdateBundleManager.getStoredBundleURL() in release bundleURL() (see INTEGRATION.md). RN 0.76+ often uses a *Delegate class next to AppDelegate.swift.`
      )
      this.log(FAIL, 'iOS OTA bundle loading not found in native sources')
    }

    if (appDelegateFiles.length === 0 && !this.jsonOutput) {
      this.log(WARN, 'No file named AppDelegate.swift/mm/m — if OTA fails, confirm bundleURL() runs in your RN entry delegate')
    }
  }

  checkAndroidMainApplication() {
    const androidDir = path.join(this.projectRoot, 'android')
    if (!fs.existsSync(androidDir)) {
      this.addResult('android-main-application', 'warning', 'android/ not found')
      this.log(WARN, 'android/ directory not found')
      return
    }

    const mainAppFiles = this.findFiles(androidDir, /MainApplication\.(kt|java)$/)

    if (mainAppFiles.length === 0) {
      this.addResult('android-main-application', 'warning', 'MainApplication not found')
      this.log(WARN, 'MainApplication not found')
      return
    }

    const rn = this.getReactNativeSemver()
    const strictReactHost =
      rn !== null && rn.major === 0 && rn.minor >= 76

    let foundBundleLoader = false
    let reactHostOtaOk = true
    let reactHostIssueFile = null

    for (const file of mainAppFiles) {
      const content = fs.readFileSync(file, 'utf8')
      const hasLoader =
        content.includes('NitroUpdateBundleLoader') || content.includes('getStoredBundlePath')
      const usesDefaultReactHost = /\bgetDefaultReactHost\b/.test(content)
      const passesJsBundleFilePath = content.includes('jsBundleFilePath')

      if (hasLoader) {
        foundBundleLoader = true
      }

      if (strictReactHost && usesDefaultReactHost) {
        if (!hasLoader || !passesJsBundleFilePath) {
          reactHostOtaOk = false
          reactHostIssueFile = file
        }
      }
    }

    if (strictReactHost && !reactHostOtaOk && reactHostIssueFile) {
      this.addResult(
        'android-react-host-ota',
        'error',
        'getDefaultReactHost used but OTA path not passed as jsBundleFilePath',
        `Pass jsBundleFilePath = NitroUpdateBundleLoader.getStoredBundlePath(this) into getDefaultReactHost(...) (RN ${rn.raw}). See INTEGRATION.md §3.1 and the library example MainApplication.kt.`
      )
      this.log(
        FAIL,
        `Android: getDefaultReactHost without jsBundleFilePath + NitroUpdateBundleLoader (${path.relative(this.projectRoot, reactHostIssueFile)})`
      )
    }

    const otaAndroidPass = foundBundleLoader && (!strictReactHost || reactHostOtaOk)

    if (otaAndroidPass) {
      this.addResult('android-main-application', 'ok', 'MainApplication wired for OTA')
      this.log(CHECK, 'MainApplication uses NitroUpdateBundleLoader')
    } else if (!foundBundleLoader) {
      this.addResult(
        'android-main-application',
        'error',
        'MainApplication not wired for OTA bundle loading',
        `In MainApplication, use NitroUpdateBundleLoader.getStoredBundlePath(context) for the JS bundle path (see INTEGRATION.md §3).`
      )
      this.log(FAIL, 'MainApplication missing OTA bundle loading')
    }
  }

  checkSwiftSettings() {
    const iosDir = path.join(this.projectRoot, 'ios')
    if (!fs.existsSync(iosDir)) return

    const xcodeprojs = this.findFiles(iosDir, /\.xcodeproj$/, true)
    const issues = []

    for (const projDir of xcodeprojs) {
      const pbxproj = path.join(projDir, 'project.pbxproj')
      if (!fs.existsSync(pbxproj)) continue

      const content = fs.readFileSync(pbxproj, 'utf8')

      // Check for problematic SWIFT_ACTIVE_COMPILATION_CONDITIONS
      const conditionsMatch = content.match(/SWIFT_ACTIVE_COMPILATION_CONDITIONS\s*=\s*"([^"]+)"/g)
      if (conditionsMatch) {
        for (const match of conditionsMatch) {
          const value = match.match(/=\s*"([^"]+)"/)?.[1] || ''
          const hasFlags = value.split(/\s+/).some((t) => t.startsWith('-'))
          if (hasFlags) {
            issues.push({
              file: projDir,
              issue: 'SWIFT_ACTIVE_COMPILATION_CONDITIONS contains compiler flags',
              value,
            })
          }
        }
      }

      // Check for dangling -D in OTHER_SWIFT_FLAGS
      const otherFlagsMatch = content.match(/OTHER_SWIFT_FLAGS\s*=\s*"([^"]+)"/g)
      if (otherFlagsMatch) {
        for (const match of otherFlagsMatch) {
          const value = match.match(/=\s*"([^"]+)"/)?.[1] || ''
          if (value.match(/\s-D\s/) || value.match(/-D$/)) {
            issues.push({
              file: projDir,
              issue: 'OTHER_SWIFT_FLAGS contains dangling -D',
              value,
            })
          }
        }
      }
    }

    if (issues.length > 0) {
      const issueText = issues.map((i) => `${path.basename(i.file)}: ${i.issue}`).join(', ')
      this.addResult(
        'swift-settings',
        'error',
        `Swift build settings issues found: ${issueText}`,
        `Run: cd ios && pod install\nOr add NitroUpdatePodUtils.apply!(installer) to Podfile post_install`
      )
      this.log(FAIL, `Swift settings issues: ${issues.length} found`)
      issues.forEach((i) => {
        this.log('', `  ${DIM}${path.basename(i.file)}: ${i.issue}${RESET}`)
      })
    } else {
      this.addResult('swift-settings', 'ok', 'Swift build settings look good')
      this.log(CHECK, 'Swift build settings OK')
    }
  }

  checkMetroConfig() {
    const metroConfigPaths = [
      path.join(this.projectRoot, 'metro.config.js'),
      path.join(this.projectRoot, 'metro.config.cjs'),
    ]

    let metroConfigPath = null
    for (const p of metroConfigPaths) {
      if (fs.existsSync(p)) {
        metroConfigPath = p
        break
      }
    }

    if (!metroConfigPath) {
      this.addResult('metro-config', 'warning', 'metro.config.js not found')
      this.log(WARN, 'metro.config.js not found')
      return
    }

    // Check for common issues
    const content = fs.readFileSync(metroConfigPath, 'utf8')

    // Check if watchFolders might cause resolution issues
    if (content.includes('watchFolders') && !content.includes('node_modules')) {
      this.addResult(
        'metro-config',
        'warning',
        'metro.config.js has watchFolders but may not include node_modules',
        'Ensure node_modules is accessible in your Metro config'
      )
      this.log(WARN, 'Metro watchFolders may need adjustment')
    } else {
      this.addResult('metro-config', 'ok', 'Metro config found')
      this.log(CHECK, 'Metro config found')
    }
  }

  findFiles(dir, pattern, directories = false) {
    const results = []

    const search = (currentDir) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name)

          if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === 'Pods' || entry.name === 'build') {
              continue
            }
            if (directories && pattern.test(entry.name)) {
              results.push(fullPath)
            }
            search(fullPath)
          } else if (!directories && pattern.test(entry.name)) {
            results.push(fullPath)
          }
        }
      } catch (e) {
        // Ignore permission errors
      }
    }

    search(dir)
    return results
  }

  printSummary() {
    const errors = this.results.filter((r) => r.status === 'error')
    const warnings = this.results.filter((r) => r.status === 'warning')
    const ok = this.results.filter((r) => r.status === 'ok')

    console.log('')
    console.log(`${BOLD}Summary:${RESET} ${ok.length} passed, ${warnings.length} warnings, ${errors.length} errors`)

    if (errors.length > 0) {
      console.log(`\n${RED}${BOLD}Errors to fix:${RESET}`)
      errors.forEach((e) => {
        console.log(`\n  ${RED}•${RESET} ${BOLD}${e.name}${RESET}: ${e.message}`)
        if (e.fix) {
          console.log(`    ${DIM}Fix: ${e.fix}${RESET}`)
        }
      })
    }

    if (warnings.length > 0 && !this.jsonOutput) {
      console.log(`\n${YELLOW}${BOLD}Warnings:${RESET}`)
      warnings.forEach((w) => {
        console.log(`\n  ${YELLOW}•${RESET} ${BOLD}${w.name}${RESET}: ${w.message}`)
        if (w.fix) {
          console.log(`    ${DIM}Suggestion: ${w.fix}${RESET}`)
        }
      })
    }

    console.log('')
  }
}

/**
 * @param {string[]} argv Arguments after the `doctor` subcommand (e.g. ['--json']).
 * @returns {Promise<number>} Exit code (0 = success, 1 = errors).
 */
async function runDoctorCli(argv) {
  const jsonOutput = argv.includes('--json')
  const projectRoot = process.cwd()
  const doctor = new Doctor(projectRoot, { json: jsonOutput })
  return doctor.run()
}

module.exports = { Doctor, runDoctorCli }

if (require.main === module) {
  runDoctorCli(process.argv.slice(2))
    .then((exitCode) => process.exit(exitCode))
    .catch((err) => {
      console.error(`${RED}Error: ${err.message}${RESET}`)
      process.exit(1)
    })
}
