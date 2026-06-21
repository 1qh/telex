'use client'
import type { ClipboardEvent, KeyboardEvent } from 'react'
import { Button, buttonVariants } from '@a/ui/button'
import { createEngine } from '@telex/engine'
import { Download, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useMemo, useState } from 'react'

const transform = (raw: string): string => {
  const engine = createEngine()
  engine.processString(raw, 0)
  return engine.getProcessedString()
}
const Page = () => {
  const [raw, setRaw] = useState('')
  const { resolvedTheme, setTheme } = useTheme()
  const vietnamese = useMemo(() => transform(raw), [raw])
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (event.key === 'Backspace') {
      event.preventDefault()
      setRaw(current => current.slice(0, -1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      setRaw(current => `${current}\n`)
    } else if (event.key.length === 1) {
      event.preventDefault()
      setRaw(current => current + event.key)
    }
  }
  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault()
    setRaw(current => current + event.clipboardData.getData('text'))
  }
  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }
  return (
    <>
      <textarea
        className='h-dvh w-full resize-none bg-background p-8 font-mono text-2xl text-foreground outline-none'
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        readOnly
        spellCheck={false}
        value={vietnamese}
      />
      <div className='fixed right-5 bottom-5 flex gap-2'>
        <a
          aria-label='Download extension'
          className={buttonVariants({ size: 'icon', variant: 'outline' })}
          download
          href='/telex.zip'>
          <Download />
        </a>
        <Button aria-label='Toggle theme' onClick={toggleTheme} size='icon' variant='outline'>
          {resolvedTheme === 'dark' ? <Sun /> : <Moon />}
        </Button>
      </div>
    </>
  )
}
export default Page
