import {gzipSync} from 'node:zlib'
import {readFileSync, readdirSync, statSync} from 'node:fs'
import path from 'node:path'

const configPath = path.resolve('.bundlesize.config.json')
const config = JSON.parse(readFileSync(configPath, 'utf8'))
const defaultCompression = config.defaultCompression ?? 'none'

function parseSize(value) {
  const match = /^(\d+(?:\.\d+)?)\s*(b|kb|mb)$/i.exec(value)
  if (!match) throw new Error(`Invalid size: ${value}`)
  const amount = Number(match[1])
  const unit = match[2].toLowerCase()
  if (unit === 'b') return amount
  if (unit === 'kb') return amount * 1024
  return amount * 1024 * 1024
}

function globToRegExp(glob) {
  let pattern = ''
  for (let i = 0; i < glob.length; i += 1) {
    const char = glob[i]
    const next = glob[i + 1]
    if (char === '*' && next === '*') {
      pattern += '.*'
      i += 1
    } else if (char === '*') {
      pattern += '[^/]*'
    } else {
      pattern += char.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    }
  }
  return new RegExp(`^${pattern}$`)
}

function walk(dir) {
  const files = []
  for (const name of readdirSync(dir)) {
    const file = path.join(dir, name)
    const stats = statSync(file)
    if (stats.isDirectory()) files.push(...walk(file))
    else files.push(file)
  }
  return files
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} kB`
}

const allFiles = walk('.next').map((file) => file.split(path.sep).join('/'))
let failed = false

for (const entry of config.files) {
  const compression = entry.compression ?? defaultCompression
  const maxSize = parseSize(entry.maxSize)
  const pattern = globToRegExp(entry.path)
  const matches = allFiles.filter((file) => pattern.test(file))

  if (!matches.length) {
    console.error(`No files matched ${entry.path}`)
    failed = true
    continue
  }

  const results = matches.map((file) => {
    const source = readFileSync(file)
    const size = compression === 'gzip' ? gzipSync(source).length : source.length
    return {file, size}
  })

  const failures = results.filter(({size}) => size > maxSize)
  const largest = results.reduce((currentLargest, result) =>
    result.size > currentLargest.size ? result : currentLargest,
  )

  if (!failures.length) {
    console.log(
      `PASS ${entry.path} ${matches.length} files, largest ${formatSize(largest.size)} <= ${entry.maxSize} ${compression} (${largest.file})`,
    )
    continue
  }

  failed = true
  console.error(
    `FAIL ${entry.path} ${failures.length}/${matches.length} files over ${entry.maxSize} ${compression}`,
  )
  for (const {file, size} of failures) {
    console.error(`  ${file} ${formatSize(size)} > ${entry.maxSize} ${compression}`)
  }
}

if (failed) process.exit(1)
