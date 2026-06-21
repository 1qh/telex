'use client'
import type { InputMethod, VirtualFile } from 'idecn'
import { buttonVariants } from '@a/ui/button'
import { createEngine, isWordBreakSymbol } from '@telex/engine'
import { Workspace } from 'idecn'
import { Download, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCallback, useMemo, useState } from 'react'

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
const firstLine = (content: string, fallback: string): string =>
  content
    .split('\n')
    .find(line => line.trim().length > 0)
    ?.trim() ?? fallback
interface Doc {
  content: string
  id: string
}
const INITIAL: Doc[] = [
  { content: '', id: 'doc-1' },
  { content: '', id: 'doc-2' },
  { content: '', id: 'doc-3' }
]
const Page = () => {
  const [docs, setDocs] = useState<Doc[]>(INITIAL)
  const { resolvedTheme, setTheme } = useTheme()
  const files = useMemo<VirtualFile[]>(
    () =>
      docs.map((doc, index) => ({
        content: '',
        id: doc.id,
        language: 'plaintext',
        name: firstLine(doc.content, `Untitled ${index + 1}`),
        open: index === 0
      })),
    [docs]
  )
  const onContentChange = useCallback((panelId: string, content: string) => {
    const id = panelId.replace('__virtual:', '')
    setDocs(previous => previous.map(doc => (doc.id === id ? { ...doc, content } : doc)))
  }, [])
  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }
  return (
    <>
      <Workspace className='h-dvh' editable files={files} inputMethod={telexInput} onContentChange={onContentChange} />
      <div className='fixed right-4 bottom-9 z-50 flex gap-2'>
        <a
          aria-label='Download extension'
          className={buttonVariants({ size: 'icon', variant: 'outline' })}
          download
          href='/telex.zip'>
          <Download />
        </a>
        <button
          aria-label='Toggle theme'
          className={buttonVariants({ size: 'icon', variant: 'outline' })}
          onClick={toggleTheme}
          type='button'>
          {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
        </button>
      </div>
    </>
  )
}
export default Page
