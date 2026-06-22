'use client'
/* oxlint-disable promise/prefer-await-to-then */
import type { FileActions, TreeContextAction, TreeDataItem, VirtualFile, WorkspaceRef } from 'idecn'
import { buttonVariants } from '@a/ui/button'
import { Workspace } from 'idecn'
import { Copy, Download, Moon, Sun, Trash2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { telexInputMethod } from './telex-ime'

const VIRTUAL = '__virtual:'
const firstLine = (content: string, fallback: string): string =>
  content
    .split('\n')
    .find(line => line.trim().length > 0)
    ?.trim() ?? fallback
const docTitle = (title: string | undefined, n: number): string => {
  const trimmed = title?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : `Untitled ${n}`
}
interface Doc {
  content: string
  id: string
  title: string
}
const INITIAL: Doc[] = [
  { content: '', id: 'doc-1', title: 'Untitled 1' },
  { content: '', id: 'doc-2', title: 'Untitled 2' },
  { content: '', id: 'doc-3', title: 'Untitled 3' }
]
const Page = () => {
  const counterRef = useRef(INITIAL.length)
  const [docs, setDocs] = useState<Doc[]>(INITIAL)
  const { resolvedTheme, setTheme } = useTheme()
  const workspaceRef = useRef<WorkspaceRef>(null)
  const docsRef = useRef(docs)
  const pendingOpenRef = useRef<null | string>(null)
  useEffect(() => {
    docsRef.current = docs
  }, [docs])
  const files = useMemo<VirtualFile[]>(
    () =>
      docs.map((doc, index) => ({
        content: '',
        id: doc.id,
        language: 'plaintext',
        name: firstLine(doc.content, doc.title),
        open: index === 0
      })),
    [docs]
  )
  const onContentChange = useCallback((panelId: string, content: string) => {
    const id = panelId.replace(VIRTUAL, '')
    setDocs(previous => previous.map(doc => (doc.id === id ? { ...doc, content } : doc)))
  }, [])
  const createDoc = useCallback((title?: string) => {
    counterRef.current += 1
    const doc: Doc = { content: '', id: `doc-${counterRef.current}`, title: docTitle(title, counterRef.current) }
    pendingOpenRef.current = doc.id
    setDocs(previous => [...previous, doc])
  }, [])
  useEffect(() => {
    const pendingId = pendingOpenRef.current
    if (!pendingId) return
    const doc = docs.find(entry => entry.id === pendingId)
    if (!doc) return
    pendingOpenRef.current = null
    const id = `${VIRTUAL}${doc.id}`
    const item: TreeDataItem = { id, name: firstLine(doc.content, doc.title), path: id }
    let tries = 0
    const tryOpen = () => {
      const workspace = workspaceRef.current
      if (!workspace) return
      workspace.openFile(item)
      tries += 1
      if (!workspace.hasPanel(id) && tries < 20) requestAnimationFrame(tryOpen)
    }
    requestAnimationFrame(tryOpen)
  }, [docs])
  const fileActions = useMemo<FileActions>(
    () => ({
      contextActions: ({ isFolder, path }) => {
        if (isFolder) return []
        const id = path.replace(VIRTUAL, '')
        const actions: TreeContextAction[] = [
          {
            icon: Copy,
            label: 'Copy text',
            onSelect: () => {
              const doc = docsRef.current.find(entry => entry.id === id)
              if (doc) navigator.clipboard.writeText(doc.content).catch(() => undefined)
            }
          },
          {
            destructive: true,
            icon: Trash2,
            label: 'Delete',
            onSelect: () => setDocs(previous => previous.filter(entry => entry.id !== id))
          }
        ]
        return actions
      },
      copyPath: false,
      onCreateFile: (_parentPath, name) => createDoc(name)
    }),
    [createDoc]
  )
  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }
  return (
    <div className='flex h-dvh flex-col'>
      <Workspace
        className='flex-1'
        editable
        fileActions={fileActions}
        files={files}
        inputMethod={telexInputMethod}
        onContentChange={onContentChange}
        ref={workspaceRef}
      />
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
    </div>
  )
}
export default Page
