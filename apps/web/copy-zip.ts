import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outputDir = join(here, '..', 'extension', '.output')
const publicDir = join(here, 'public')
const target = join(publicDir, 'telex.zip')

const newestChromeZip = (): string => {
  const zips = readdirSync(outputDir)
    .filter((name) => name.endsWith('-chrome.zip'))
    .map((name) => {
      const path = join(outputDir, name)
      return { path, mtime: statSync(path).mtimeMs }
    })
    .sort((a, b) => b.mtime - a.mtime)
  const [newest] = zips
  if (!newest) throw new Error(`no *-chrome.zip found in ${outputDir} — run \`bun run zip\` in apps/extension first`)
  return newest.path
}

mkdirSync(publicDir, { recursive: true })
copyFileSync(newestChromeZip(), target)
console.log('ok')
