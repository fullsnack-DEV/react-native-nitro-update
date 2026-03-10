#!/usr/bin/env node

/**
 * Pre-publish validation for react-native-nitro-update.
 * Run via: npm run validate
 * 
 * Checks:
 * - All files in package.json "files" exist
 * - No absolute paths in source files
 * - No monorepo paths leak into published code
 * - TypeScript compiles without errors
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const RED = '\x1b[31m'
const GREEN = '\x1b[32m'
const YELLOW = '\x1b[33m'
const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'

const ROOT = path.resolve(__dirname, '..')
let hasErrors = false

function error(msg) {
  console.error(`${RED}${BOLD}ERROR:${RESET} ${msg}`)
  hasErrors = true
}

function warn(msg) {
  console.warn(`${YELLOW}WARN:${RESET} ${msg}`)
}

function success(msg) {
  console.log(`${GREEN}✓${RESET} ${msg}`)
}

function checkFilesExist() {
  console.log('\nChecking package.json files...')
  
  const pkgPath = path.join(ROOT, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  const files = pkg.files || []
  
  for (const pattern of files) {
    // Skip glob patterns for now, just check direct paths
    if (pattern.includes('*')) continue
    
    const fullPath = path.join(ROOT, pattern)
    if (!fs.existsSync(fullPath)) {
      error(`File in package.json "files" does not exist: ${pattern}`)
    }
  }
  
  success('package.json files field validated')
}

function checkNoAbsolutePaths() {
  console.log('\nChecking for absolute paths...')
  
  const dirsToCheck = ['src', 'lib', 'bin']
  const absolutePathPatterns = [
    /\/Users\/[^/]+/g,
    /\/home\/[^/]+/g,
    /C:\\Users\\[^\\]+/g,
    /\/var\/folders\//g,
  ]
  
  const monorepoPatterns = [
    /-root\/packages\//g,
    /\.\.\/\.\.\/packages\//g,
    /workspaces\/packages\//g,
  ]
  
  for (const dir of dirsToCheck) {
    const dirPath = path.join(ROOT, dir)
    if (!fs.existsSync(dirPath)) continue
    
    checkDirectory(dirPath, absolutePathPatterns, monorepoPatterns)
  }
  
  success('No problematic paths found')
}

function checkDirectory(dirPath, absolutePatterns, monorepoPatterns) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)
    
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue
      checkDirectory(fullPath, absolutePatterns, monorepoPatterns)
    } else if (entry.name.match(/\.(js|ts|json)$/)) {
      const content = fs.readFileSync(fullPath, 'utf8')
      const relativePath = path.relative(ROOT, fullPath)
      
      for (const pattern of absolutePatterns) {
        const matches = content.match(pattern)
        if (matches) {
          error(`Absolute path found in ${relativePath}: ${matches[0]}`)
        }
      }
      
      for (const pattern of monorepoPatterns) {
        const matches = content.match(pattern)
        if (matches) {
          error(`Monorepo path found in ${relativePath}: ${matches[0]}`)
        }
      }
    }
  }
}

function checkTypeScript() {
  console.log('\nChecking TypeScript...')
  
  try {
    execSync('npm run typecheck', { cwd: ROOT, stdio: 'pipe' })
    success('TypeScript compilation successful')
  } catch (e) {
    error('TypeScript compilation failed')
    console.error(e.stdout?.toString() || e.message)
  }
}

function checkNpmPack() {
  console.log('\nValidating npm pack...')
  
  try {
    const output = execSync('npm pack --dry-run 2>&1', { cwd: ROOT, encoding: 'utf8' })
    
    // Check for any suspicious files
    const lines = output.split('\n')
    const suspiciousPatterns = [
      /\.env$/,
      /credentials/i,
      /secret/i,
      /\.local$/,
    ]
    
    for (const line of lines) {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(line) && line.includes('npm notice')) {
          warn(`Potentially sensitive file in package: ${line}`)
        }
      }
    }
    
    success('npm pack validation passed')
  } catch (e) {
    error('npm pack failed')
    console.error(e.message)
  }
}

function main() {
  console.log(`${BOLD}Validating react-native-nitro-update package...${RESET}`)
  
  checkFilesExist()
  checkNoAbsolutePaths()
  checkTypeScript()
  checkNpmPack()
  
  console.log('')
  if (hasErrors) {
    console.error(`${RED}${BOLD}Validation failed!${RESET} Fix the errors above before publishing.`)
    process.exit(1)
  } else {
    console.log(`${GREEN}${BOLD}All validations passed!${RESET}`)
    process.exit(0)
  }
}

main()
