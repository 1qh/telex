/* eslint-disable no-continue */
/** biome-ignore-all lint/performance/useTopLevelRegex: x */
/** biome-ignore-all lint/nursery/noContinue: x */
import { file } from 'bun'
import { log } from 'node:console'

import { createEngine } from './engine'

const text = await file('test.jsonl').text(),
  lines = text.split(/\r?\n/u),
  baseFails: string[] = [],
  commaFails: string[] = [],
  run = (value: string) => {
    const engine = createEngine()
    engine.processString(value, 0)
    return engine.getProcessedString()
  }

for (const l of lines) {
  if (!l) continue
  const { expected, input } = JSON.parse(l) as { expected: string; input: string },
    base = run(input)
  if (base !== expected) baseFails.push(`base | ${input.padEnd(12)} | ${base.padEnd(8)} | ${expected}`)
  const inputComma = `${input},`,
    expectedComma = `${expected},`,
    withComma = run(inputComma)
  if (withComma !== expectedComma)
    commaFails.push(`comma | ${inputComma.padEnd(12)} | ${withComma.padEnd(8)} | ${expectedComma}`)
}

const fails = baseFails.concat(commaFails)

if (fails.length) for (const [i, fail] of fails.entries()) log(`${String(i + 1).padStart(4)} | ${fail}`)
else log('✅')
