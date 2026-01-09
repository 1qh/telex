/** biome-ignore-all lint/performance/useTopLevelRegex: x */
/** biome-ignore-all lint/nursery/noContinue: x */
import { file } from 'bun'
import { log } from 'node:console'

import { createEngine } from './engine'

const fails = (await file('test.jsonl').text())
  .split(/\r?\n/u)
  .filter(Boolean)
  .map(l => {
    const { expected, input } = JSON.parse(l) as { expected: string; input: string },
      engine = createEngine()
    engine.processString(input, 0)
    const output = engine.getProcessedString()
    if (output === expected) return null
    return `${input.padEnd(12)} | ${output.padEnd(8)} | ${expected}`
  })
  .filter(Boolean)

if (fails.length) for (const [i, fail] of fails.entries()) log(`${String(i + 1).padStart(4)} | ${fail}`)
else log('✅')
