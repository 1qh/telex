// oxlint-disable prefer-await-to-then, prefer-top-level-await, no-promise-executor-return
import { keyboard } from '@nut-tree-fork/nut-js'

keyboard.config.autoDelayMs = 0

const main = async () => {
  console.log('Will type "xin chào" in 3 seconds...\nFocus on a text editor!')
  await new Promise(r => {
    setTimeout(r, 3000)
  })
  console.log('Typing...')
  await keyboard.type('xin chào')
  console.log('Done!')
}

main().catch(console.error)
