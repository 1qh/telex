/* eslint-disable no-console -- CLI installer; console is its user-facing output */
/** biome-ignore-all lint/performance/useTopLevelRegex: x */
import { chmodSync, existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'

const HOST_NAME = 'com.telex.vietnamese'
const scriptDir = import.meta.dirname
const ROOT_DIR = join(scriptDir, '..')
const getManifestLocations = (): string[] => {
  const home = homedir()
  const os = platform()
  if (os === 'win32')
    return [
      join(home, 'AppData', 'Local', 'Google', 'Chrome', 'NativeMessagingHosts'),
      join(home, 'AppData', 'Local', 'Chromium', 'NativeMessagingHosts'),
      join(home, 'AppData', 'Local', 'Microsoft', 'Edge', 'NativeMessagingHosts')
    ]
  if (os === 'darwin')
    return [
      join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'NativeMessagingHosts'),
      join(home, 'Library', 'Application Support', 'Chromium', 'NativeMessagingHosts'),
      join(home, 'Library', 'Application Support', 'Microsoft Edge', 'NativeMessagingHosts'),
      join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave Browser', 'NativeMessagingHosts')
    ]
  return [
    join(home, '.config', 'google-chrome', 'NativeMessagingHosts'),
    join(home, '.config', 'chromium', 'NativeMessagingHosts'),
    join(home, '.config', 'microsoft-edge', 'NativeMessagingHosts')
  ]
}
const getHostPath = (): string => {
  const os = platform()
  const wrapper = os === 'win32' ? 'telex-host.cmd' : 'telex-host.sh'
  return join(ROOT_DIR, wrapper)
}
const createWrapperScript = (): string => {
  const os = platform()
  const indexPath = join(scriptDir, 'index.ts')
  const wrapperPath = getHostPath()
  const bunPath = process.execPath
  if (os === 'win32') writeFileSync(wrapperPath, `@echo off\r\n"${bunPath}" run "${indexPath}"\r\n`)
  else {
    writeFileSync(wrapperPath, `#!/bin/bash\nexec "${bunPath}" run "${indexPath}"\n`)
    chmodSync(wrapperPath, 0o755)
  }
  console.log(`Using bun at: ${bunPath}`)
  return wrapperPath
}
const install = (extensionId: string): boolean => {
  console.log('Installing Telex Vietnamese Input Native Host...')
  console.log(`Extension ID: ${extensionId}`)
  const hostPath = createWrapperScript()
  console.log(`Created wrapper script: ${hostPath}`)
  const manifest = {
    allowed_origins: [`chrome-extension://${extensionId}/`],
    description: 'Telex Vietnamese Input Native Host',
    name: HOST_NAME,
    path: hostPath,
    type: 'stdio'
  }
  const locations = getManifestLocations()
  let installed = false
  for (const location of locations)
    try {
      mkdirSync(location, { recursive: true })
      const manifestPath = join(location, `${HOST_NAME}.json`)
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
      console.log(`Installed: ${manifestPath}`)
      installed = true
    } catch (error) {
      console.log(`Could not install to ${location}: ${String(error)}`)
    }
  if (installed) {
    console.log('\n✅ Installation complete!')
    console.log('\nNext steps:')
    console.log('  1. Restart Chrome')
    console.log('  2. Open Google Docs and test!')
  } else console.log('\n❌ Installation failed')
  return installed
}
const uninstall = (): boolean => {
  console.log('Uninstalling Telex Vietnamese Input Native Host...')
  const locations = getManifestLocations()
  let removed = false
  for (const location of locations) {
    const manifestPath = join(location, `${HOST_NAME}.json`)
    if (existsSync(manifestPath))
      try {
        unlinkSync(manifestPath)
        console.log(`Removed: ${manifestPath}`)
        removed = true
      } catch (error) {
        console.log(`Could not remove ${manifestPath}: ${String(error)}`)
      }
  }
  console.log(removed ? '\n✅ Uninstallation complete!' : '\n⚠️  Nothing to remove')
  return removed
}
const printUsage = () => {
  console.log(`
Telex Vietnamese Input - Native Host Installer
Usage:
  bun run src/install.ts <extension-id>    Install with extension ID
  bun run src/install.ts --uninstall       Uninstall
  To find your extension ID:
  1. Go to chrome://extensions
  2. Enable "Developer mode"
  3. Load your extension (Load unpacked)
  4. Copy the ID shown under the extension name
`)
}
const main = () => {
  const args = process.argv.slice(2)
  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage()
    return
  }
  if (args[0] === '--uninstall') {
    uninstall()
    return
  }
  const extensionId = args[0] ?? ''
  if (extensionId.length !== 32 || !/^[\da-z]+$/iu.test(extensionId)) {
    console.warn(`Warning: "${extensionId}" doesn't look like a valid extension ID`)
    console.warn('Extension IDs are 32 lowercase alphanumeric characters')
    console.warn('')
  }
  install(extensionId)
}
main()
