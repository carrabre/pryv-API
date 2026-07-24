#!/usr/bin/env node

const path = require('node:path')
const {spawn} = require('node:child_process')

const projectDir = path.join(__dirname, '..')
const host = process.env.APP_HOST || 'localhost'
const port = process.env.PORT || '1147'

const numericPort = Number.parseInt(port, 10)
if (Number.isFinite(numericPort) && numericPort > 0 && numericPort < 1024) {
  if (typeof process.getuid === 'function' && process.getuid() !== 0) {
    console.warn(
      `⚠️  Port ${numericPort} is a privileged port on macOS/Linux. If Next.js fails to bind, run with sudo or use a port >= 1024.\n`,
    )
  }
}

console.log(`🚀 Starting production server on http://${host}:${port}...\n`)

const nextBin =
  process.platform === 'win32'
    ? path.join(projectDir, 'node_modules', '.bin', 'next.cmd')
    : path.join(projectDir, 'node_modules', '.bin', 'next')

const child = spawn(nextBin, ['start', '--hostname', host, '--port', port], {
  stdio: 'inherit',
  cwd: projectDir,
  shell: false,
})

process.on('SIGINT', () => {
  child.kill('SIGTERM')
})

process.on('SIGTERM', () => {
  child.kill('SIGTERM')
})

child.on('exit', (code) => {
  process.exit(code ?? 0)
})
