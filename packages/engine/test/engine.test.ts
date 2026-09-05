import { file } from 'bun'
import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { createEngine } from '../src/index'

const run = (value: string) => {
  const engine = createEngine()
  engine.processString(value, 0)
  return engine.getProcessedString()
}
describe('engine golden (vi-rs corpus)', () => {
  test('every case transforms identically, plain + comma-suffixed', async () => {
    const text = await file(join(import.meta.dir, 'engine.golden.jsonl')).text()
    const fails: string[] = []
    for (const line of text.split(/\r?\n/u))
      if (line) {
        // biome-ignore lint/nursery/noUnsafeTypeAssertion: JSON.parse returns any; each fixture line is a {expected,input} object
        const { expected, input } = JSON.parse(line) as { expected: string; input: string }
        const base = run(input)
        if (base !== expected) fails.push(`base | ${input} -> ${base} | want ${expected}`)
        const commaInput = `${input},`
        const commaOut = run(commaInput)
        if (commaOut !== `${expected},`) fails.push(`comma | ${commaInput} -> ${commaOut} | want ${expected},`)
      }
    expect(fails).toEqual([])
  }, 120_000)
})
