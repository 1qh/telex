import { keyboard } from '@nut-tree-fork/nut-js'

keyboard.config.autoDelayMs = 0
process.stdout.write('Will type "xin chào" in 3 seconds...\nFocus on a text editor!\n')
await new Promise<void>(resolve => {
  setTimeout(resolve, 3000)
})
process.stdout.write('Typing...\n')
await keyboard.type('xin chào')
process.stdout.write('Done!\n')
