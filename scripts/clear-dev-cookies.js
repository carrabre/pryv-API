#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const {execFileSync, spawn} = require('node:child_process')

console.log('🧹 Clearing development cookies and cache...')

const projectDir = path.join(__dirname, '..')
const devHost = process.env.APP_HOST || 'localhost'
const devPort = process.env.PORT || '1147'

const numericPort = Number.parseInt(devPort, 10)
if (!/^\d+$/.test(devPort) || numericPort < 1 || numericPort > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}
if (Number.isFinite(numericPort) && numericPort > 0 && numericPort < 1024) {
  if (typeof process.getuid === 'function' && process.getuid() !== 0) {
    console.warn(
      `⚠️  Port ${numericPort} is a privileged port on macOS/Linux. If Next.js fails to bind, run with sudo or use a port >= 1024.\n`,
    )
  }
}

// Stop listeners on the explicitly validated development port without invoking a shell.
try {
  if (process.platform === 'darwin' || process.platform === 'linux') {
    const output = execFileSync('lsof', ['-ti', `:${numericPort}`], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    for (const line of output.split(/\s+/)) {
      if (!/^\d+$/.test(line)) continue
      process.kill(Number(line), 'SIGTERM')
    }
    console.log(`🔄 Freed port ${devPort} if it was in use`)
  } else if (process.platform === 'win32') {
    console.warn('Automatic port cleanup is unavailable on Windows; stop the listener manually.')
  }
} catch {
  // Ignore errors - port might not be in use
}

// Clear Next.js cache
const nextCacheDir = path.join(projectDir, '.next')
if (fs.existsSync(nextCacheDir)) {
  console.log('📂 Removing .next directory...')
  fs.rmSync(nextCacheDir, {recursive: true, force: true})
}

// Clear turbo cache
const turboCacheDir = path.join(projectDir, '.turbo')
if (fs.existsSync(turboCacheDir)) {
  console.log('📂 Removing .turbo directory...')
  fs.rmSync(turboCacheDir, {recursive: true, force: true})
}

// Clear TypeScript build cache
const tsBuildInfoFile = path.join(projectDir, 'tsconfig.tsbuildinfo')
if (fs.existsSync(tsBuildInfoFile)) {
  console.log('📂 Removing TypeScript build cache...')
  fs.rmSync(tsBuildInfoFile, {force: true})
}

console.log('✅ Cleanup complete!')
console.log(`🚀 Starting development server on http://${devHost}:${devPort}...\n`)

// Start the dev server with better process management
const nextBin =
  process.platform === 'win32'
    ? path.join(projectDir, 'node_modules', '.bin', 'next.cmd')
    : path.join(projectDir, 'node_modules', '.bin', 'next')

const devProcess = spawn(nextBin, ['dev', '--turbo', '--hostname', devHost, '--port', devPort], {
  stdio: 'inherit',
  shell: false,
  cwd: projectDir,
})

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Gracefully shutting down...')
  devProcess.kill('SIGTERM')
  process.exit(0)
})

process.on('SIGTERM', () => {
  console.log('\n🛑 Gracefully shutting down...')
  devProcess.kill('SIGTERM')
  process.exit(0)
})

// Handle dev process exit
devProcess.on('exit', (code) => {
  if (code !== 0) {
    console.log(`\n❌ Development server exited with code ${code}`)
  }
  process.exit(code)
})
