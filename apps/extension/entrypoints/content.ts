// oxlint-disable prefer-await-to-then, no-unreadable-array-destructuring, unicorn/prefer-math-trunc
/* eslint-disable complexity, @typescript-eslint/no-misused-promises */
import type { Engine } from '@telex/engine'
import {
  addMarkToChar,
  addToneToChar,
  allowedInputTypes,
  createEngine,
  isAlpha,
  isWordBreakSymbol,
  lower,
  ModeFlags
} from '@telex/engine'
import { browser } from 'wxt/browser'
import { defineContentScript } from 'wxt/utils/define-content-script'

type Editable = HTMLElement | HTMLInputElement | HTMLTextAreaElement
interface EditorState {
  engine: Engine
  start: number
  text: string
}
const states = new WeakMap<Editable, EditorState>()
const getState = (target: Editable): EditorState => {
  const existing = states.get(target)
  if (existing) return existing
  const state = { engine: createEngine(), start: 0, text: '' }
  states.set(target, state)
  return state
}
const resetState = (state: EditorState, start: number) => {
  state.engine.reset()
  state.start = start
  state.text = ''
}
const syncStateForInput = (value: string, caret: number, state: EditorState) => {
  let segmentStart = 0
  for (let index = caret - 1; index >= 0; index -= 1) {
    const normalized = lower(addMarkToChar(addToneToChar(value[index] ?? '', 0), 0))
    if (!(normalized && (isAlpha(normalized) || 'adefjorswxz'.includes(normalized)))) {
      segmentStart = index + 1
      break
    }
  }
  const segment = value.slice(segmentStart, caret)
  if (segment && segmentStart === state.start && segment === state.text) return
  resetState(state, segmentStart)
  state.engine.processString(segment, ModeFlags.EnglishMode)
  state.text = state.engine.getProcessedString()
}
const isInline = (node: HTMLElement) => getComputedStyle(node).display.startsWith('inline')
const getContentEditableState = (root: HTMLElement): null | { caret: number; text: string } => {
  const selection = document.getSelection()
  if (!selection?.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!(range.collapsed && root.contains(range.startContainer))) return null
  let text = ''
  let caret = -1
  let lastBreak = false
  const add = (value: string) => {
    if (!value || (value === '\n' && lastBreak)) return
    lastBreak = value === '\n'
    text += value
  }
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const { data } = node as Text
      const offset = Math.min(range.startOffset, data.length)
      if (node === range.startContainer) {
        add(data.slice(0, offset))
        caret = text.length
        add(data.slice(offset))
      } else add(data)
      return
    }
    if (!(node instanceof HTMLElement)) return
    if (node.tagName === 'BR') return add('\n')
    for (const [i, child] of node.childNodes.entries()) {
      if (node === range.startContainer && i === range.startOffset) caret = text.length
      walk(child)
    }
    if (node === range.startContainer && range.startOffset >= node.childNodes.length) caret = text.length
    if (node !== root && !isInline(node)) add('\n')
  }
  walk(root)
  if (caret < 0) caret = text.length
  return { caret, text }
}
const findTextPosition = (root: HTMLElement, index: number) => {
  let pos = 0
  let lastBreak = false
  let fallback: { node: Node; offset: number } = { node: root, offset: 0 }
  const setFallback = (node: Node, offset: number) => {
    fallback = { node, offset }
  }
  const addBreak = (node: Node, isBr: boolean) => {
    if (lastBreak) return null
    const parent = node.parentNode
    if (!parent) return null
    const base = Array.prototype.indexOf.call(parent.childNodes, node) + (isBr ? 0 : 1)
    const after = base + (isBr ? 1 : 0)
    if (index <= pos) return { node: parent, offset: base }
    if (index <= pos + 1) return { node: parent, offset: after }
    pos += 1
    lastBreak = true
    setFallback(parent, after)
    return null
  }
  const walk = (node: Node): null | { node: Node; offset: number } => {
    if (node.nodeType === Node.TEXT_NODE) {
      const { data } = node as Text
      const next = pos + data.length
      lastBreak = false
      if (index <= next) return { node, offset: index - pos }
      pos = next
      setFallback(node, data.length)
      return null
    }
    if (!(node instanceof HTMLElement)) return null
    if (node.tagName === 'BR') return addBreak(node, true)
    for (const child of node.childNodes) {
      const found = walk(child)
      if (found) return found
    }
    if (node !== root && !isInline(node)) return addBreak(node, false)
    return null
  }
  return walk(root) ?? fallback
}
const getEditableTarget = (target: EventTarget | null): Editable | null => {
  const element = target instanceof Element ? target : target instanceof Text ? target.parentElement : null
  if (!element) return null
  if (element instanceof HTMLTextAreaElement) return element
  if (element instanceof HTMLInputElement) return allowedInputTypes.includes(element.type) ? element : null
  const editable = element.closest('[contenteditable]')
  return editable instanceof HTMLElement && editable.isContentEditable ? editable : null
}
const fixCaps = (key: string, event: KeyboardEvent) => {
  if (!event.getModifierState('CapsLock') || key.toLowerCase() === key.toUpperCase()) return key
  return event.shiftKey ? key.toLowerCase() : key.toUpperCase()
}
const handleKey = (target: Editable, key: string, state: EditorState): boolean => {
  const inputTarget = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ? target : null
  let cr: number
  let s: string
  let root: HTMLElement | null = null
  if (inputTarget) {
    const { selectionEnd: end, selectionStart: start, value } = inputTarget
    if (start === null || end === null || start !== end) return false
    cr = start
    s = value
  } else {
    root = target
    const current = getContentEditableState(root)
    if (!current) return false
    cr = current.caret
    s = current.text
  }
  syncStateForInput(s, cr, state)
  state.engine.processKey(key, 0)
  state.text = state.engine.getProcessedString()
  if (state.text === s.slice(state.start, cr) + key) return false
  if (inputTarget) inputTarget.setRangeText(state.text, state.start, cr, 'end')
  else if (root) {
    const startPos = findTextPosition(root, state.start)
    const endPos = findTextPosition(root, cr)
    const range = document.createRange()
    range.setStart(startPos.node, startPos.offset)
    range.setEnd(endPos.node, endPos.offset)
    range.deleteContents()
    if (state.text) range.insertNode(document.createTextNode(state.text))
    root.normalize()
    const selection = document.getSelection()
    if (selection) {
      const caretPos = findTextPosition(root, state.start + state.text.length)
      const caretRange = document.createRange()
      caretRange.setStart(caretPos.node, caretPos.offset)
      caretRange.collapse(true)
      selection.removeAllRanges()
      selection.addRange(caretRange)
    }
  }
  target.dispatchEvent(new Event('input', { bubbles: true }))
  if (isWordBreakSymbol(key)) resetState(state, state.start + state.text.length)
  return true
}
let lastAlt = 0
let lastCtrl = 0
let lastEnabled = false
let lastWorker = false
let on = true
let workerMode = false
let workerResetPending = false
let workerDeletes = 0
const workerSiteChecks = [
  () => {
    if (document.querySelector('.kix-appview')) return true
    try {
      return Boolean(window.top?.document.querySelector('.kix-appview'))
    } catch {
      return false
    }
  }
]
const isWorkerSite = () => {
  for (const check of workerSiteChecks)
    try {
      if (check()) return true
    } catch {
      //
    }
  return false
}
const workerQueue: string[] = []
const handleWorkerKey = async (key: string) => {
  try {
    const response: {
      deleteCount?: number
      insertText?: string
      usePaste?: boolean
    } = await browser.runtime.sendMessage({ key, type: 'worker_key' })
    return {
      deleteCount: response.deleteCount ?? 0,
      insertText: response.insertText ?? '',
      usePaste: Boolean(response.usePaste)
    }
  } catch {
    return { deleteCount: 0, insertText: '', usePaste: false }
  }
}
const resetWorkerEngine = () => {
  workerQueue.length = 0
  workerDeletes = 0
  workerResetPending = false
  browser.runtime.sendMessage({ type: 'worker_reset' }).catch(() => null)
}
const tryResetWorker = () => {
  if (workerResetPending && workerQueue.length === 0 && !workerDeletes) resetWorkerEngine()
}
const queueWorkerReset = () => {
  workerResetPending = true
  tryResetWorker()
}
const reportMode = () => {
  const enabled = on
  const worker = enabled && (workerMode || isWorkerSite())
  const changedWorker = worker !== lastWorker
  if (!changedWorker && enabled === lastEnabled) return
  lastEnabled = enabled
  lastWorker = worker
  if (changedWorker) resetWorkerEngine()
  browser.runtime.sendMessage({ enabled, type: 'mode_update', worker }).catch(() => null)
}
const onKeydown = async (event: KeyboardEvent) => {
  if (event.key === 'Control') {
    if (event.repeat) return
    const now = Date.now()
    if (now - lastCtrl > 300) {
      lastCtrl = now
      return
    }
    lastCtrl = 0
    on = !on
    browser.storage.local.set({ enabled: on })
    reportMode()
    return
  }
  if (event.key === 'Alt') {
    if (event.repeat || !on) return
    const now = Date.now()
    if (now - lastAlt > 300) {
      lastAlt = now
      return
    }
    lastAlt = 0
    workerMode = !workerMode
    browser.storage.local.set({ workerMode })
    reportMode()
    return
  }
  reportMode()
  if (!on || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
  let { key } = event
  if (lastWorker) {
    const [next] = workerQueue
    if (next && key === next) {
      workerQueue.shift()
      tryResetWorker()
      return
    }
    if (workerDeletes && key === 'Backspace') {
      workerDeletes -= 1
      tryResetWorker()
      return
    }
    if (key === ' ' || key.length !== 1) {
      queueWorkerReset()
      return
    }
    key = fixCaps(key, event)
    event.preventDefault()
    event.stopPropagation()
    const { deleteCount, insertText, usePaste } = await handleWorkerKey(key)
    workerDeletes += deleteCount
    if (!usePaste) for (const ch of insertText) workerQueue.push(ch)
    if (isWordBreakSymbol(key)) queueWorkerReset()
    return
  }
  if (key.length !== 1) return
  key = fixCaps(key, event)
  const target = getEditableTarget(event.target) ?? getEditableTarget(document.activeElement)
  if (!target) return
  if (handleKey(target, key, getState(target))) event.preventDefault()
}
const main = async () => {
  const stored = await browser.storage.local.get(['enabled', 'workerMode'])
  on = typeof stored.enabled === 'boolean' ? stored.enabled : true
  workerMode = typeof stored.workerMode === 'boolean' ? stored.workerMode : false
  reportMode()
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return
    if (typeof changes.enabled?.newValue === 'boolean') on = changes.enabled.newValue
    if (typeof changes.workerMode?.newValue === 'boolean') workerMode = changes.workerMode.newValue
    reportMode()
  })
  // eslint-disable-next-line @typescript-eslint/strict-void-return
  document.addEventListener('keydown', onKeydown, { capture: true })
}
export default defineContentScript({
  allFrames: true,
  main,
  matchAboutBlank: true,
  matchOriginAsFallback: true,
  matches: ['<all_urls>'],
  runAt: 'document_start'
})
