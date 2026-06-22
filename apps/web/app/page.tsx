'use client'
/* oxlint-disable promise/prefer-await-to-then */
import type { FileActions, TreeContextAction, VirtualFile, WorkspaceRef } from 'idecn'
import { buttonVariants } from '@a/ui/button'
import { Workspace } from 'idecn'
import { Copy, Download, FilePlus, Moon, Sun, Trash2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { telexInputMethod } from './telex-ime'

const VIRTUAL = '__virtual:'
const STORAGE_KEY = 'telex-docs'
const ACTIVE_KEY = 'telex-active'
const loadActive = (): null | string => {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}
const noop = (): void => undefined
const subscribeNoop = (): (() => void) => noop
const firstLine = (content: string, fallback: string): string =>
  content
    .split('\n')
    .find(line => line.trim().length > 0)
    ?.trim() ?? fallback
interface Doc {
  content: string
  id: string
  initialContent: string
  n: number
}
const fresh = (content: string, id: string, n: number): Doc => ({ content, id, initialContent: content, n })
const INITIAL: Doc[] = [fresh('', 'doc-1', 1), fresh('', 'doc-2', 2), fresh('', 'doc-3', 3)]
const isStored = (value: unknown): value is { content: string; id: string; n: number } => {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return typeof record.content === 'string' && typeof record.id === 'string' && typeof record.n === 'number'
}
const loadDocs = (): Doc[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return INITIAL
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return INITIAL
    const docs = parsed.filter(isStored).map(entry => fresh(entry.content, entry.id, entry.n))
    return docs.length > 0 ? docs : INITIAL
  } catch {
    return INITIAL
  }
}
const Page = () => {
  const [docs, setDocs] = useState<Doc[]>(loadDocs)
  const [activeId, setActiveId] = useState<null | string>(loadActive)
  const docsRef = useRef<Doc[]>(docs)
  const pendingOpenRef = useRef<null | string>(null)
  const workspaceRef = useRef<WorkspaceRef>(null)
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false
  )
  const { resolvedTheme, setTheme } = useTheme()
  useEffect(() => {
    docsRef.current = docs
  }, [docs])
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs.map(doc => ({ content: doc.content, id: doc.id, n: doc.n }))))
    } catch {
      // storage unavailable
    }
  }, [docs])
  const files = useMemo<VirtualFile[]>(() => {
    const activeExists = activeId !== null && docs.some(doc => doc.id === activeId)
    return docs.map((doc, index) => ({
      content: doc.initialContent,
      id: doc.id,
      language: 'plaintext',
      name: firstLine(doc.content, `Untitled ${doc.n}`),
      open: activeExists ? doc.id === activeId : index === 0
    }))
  }, [activeId, docs])
  const onContentChange = useCallback((panelId: string, content: string) => {
    const id = panelId.replace(VIRTUAL, '')
    setDocs(previous => previous.map(doc => (doc.id === id ? { ...doc, content } : doc)))
  }, [])
  const onTabChange = useCallback((panelId: string) => {
    const id = panelId.replace(VIRTUAL, '')
    setActiveId(id)
    try {
      localStorage.setItem(ACTIVE_KEY, id)
    } catch {
      // storage unavailable
    }
  }, [])
  const createDoc = useCallback(() => {
    setDocs(previous => {
      const n = Math.max(0, ...previous.map(doc => doc.n)) + 1
      const id = `doc-${n}`
      pendingOpenRef.current = id
      return [...previous, fresh('', id, n)]
    })
  }, [])
  useEffect(() => {
    const pendingId = pendingOpenRef.current
    if (!pendingId) return
    if (!docs.some(doc => doc.id === pendingId)) return
    pendingOpenRef.current = null
    const panelId = `${VIRTUAL}${pendingId}`
    let tries = 0
    const tryOpen = () => {
      const workspace = workspaceRef.current
      if (!workspace) return
      workspace.openVirtual(pendingId)
      tries += 1
      if (!workspace.hasPanel(panelId) && tries < 20) requestAnimationFrame(tryOpen)
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
            onSelect: () =>
              setDocs(previous => {
                const next = previous.filter(entry => entry.id !== id)
                return next.length > 0 ? next : previous
              })
          }
        ]
        return actions
      },
      copyPath: false
    }),
    []
  )
  const toggleTheme = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
  }
  if (!mounted) return null
  return (
    <div className='flex h-dvh flex-col'>
      <Workspace
        className='flex-1'
        editable
        fileActions={fileActions}
        files={files}
        inputMethod={telexInputMethod}
        onContentChange={onContentChange}
        onTabChange={onTabChange}
        ref={workspaceRef}
      />
      <div className='fixed right-4 bottom-9 z-50 flex gap-2'>
        <button
          aria-label='New doc'
          className={buttonVariants({ size: 'icon', variant: 'outline' })}
          onClick={createDoc}
          type='button'>
          <FilePlus />
        </button>
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
