import type { InputMethod } from 'idecn'
import { createEngine, isWordBreakSymbol } from '@telex/engine'

const telexInputMethod: InputMethod = () => {
  let engine = createEngine()
  let composed = ''
  return (key: string) => {
    if (key.length !== 1) {
      engine = createEngine()
      composed = ''
      return null
    }
    if (key === ' ' || isWordBreakSymbol(key)) {
      engine = createEngine()
      composed = ''
      return { deleteBefore: 0, insert: key }
    }
    engine.processKey(key, 0)
    const next = engine.getProcessedString()
    const edit = { deleteBefore: composed.length, insert: next }
    composed = next
    return edit
  }
}
export { telexInputMethod }
