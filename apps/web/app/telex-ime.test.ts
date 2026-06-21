import { describe, expect, test } from 'bun:test'
import { telexInputMethod } from './telex-ime'

const type = (keys: string): string => {
  const session = telexInputMethod()
  let buffer = ''
  for (const key of keys) {
    const edit = session(key)
    if (edit) buffer = buffer.slice(0, buffer.length - edit.deleteBefore) + edit.insert
  }
  return buffer
}
describe('telex input method', () => {
  test('composes a single word', () => {
    expect(type('tieengs')).toBe('tiếng')
  })
  test('keeps the space between words', () => {
    expect(type('tieengs vieejt')).toBe('tiếng việt')
  })
  test('word-break punctuation types through and resets composition', () => {
    expect(type('ddoongf,')).toBe('đồng,')
  })
  test('multiple words, tones, and capitals', () => {
    expect(type('xin chaof Vieejt Nam')).toBe('xin chào Việt Nam')
  })
})
