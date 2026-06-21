'use client'
import type { InputMethod, VirtualFile } from 'idecn'
import { createEngine, isWordBreakSymbol } from '@telex/engine'
import { Workspace } from 'idecn'

const telexInput: InputMethod = () => {
  let engine = createEngine()
  let composed = ''
  return (key: string) => {
    if (key.length !== 1 || key === ' ' || isWordBreakSymbol(key)) {
      engine = createEngine()
      composed = ''
      return null
    }
    engine.processKey(key, 0)
    const next = engine.getProcessedString()
    const edit = { deleteBefore: composed.length, insert: next }
    composed = next
    return edit
  }
}
const FILES: VirtualFile[] = [
  { content: '', language: 'plaintext', name: 'Untitled 1', open: true },
  { content: '', language: 'plaintext', name: 'Untitled 2' },
  { content: '', language: 'plaintext', name: 'Untitled 3' }
]
const Page = () => <Workspace className='h-dvh' editable files={FILES} inputMethod={telexInput} />
export default Page
