/* eslint-disable no-console, @typescript-eslint/no-magic-numbers, max-statements */
import type { Browser } from 'wxt/browser'

import { browser } from 'wxt/browser'
import { defineBackground } from 'wxt/utils/define-background'

import { createEngine, isWordBreakSymbol } from '../engine'

type ContentMessage = ModeMessage | WorkerKeyMessage | WorkerResetMessage
type Draw = (ctx: OffscreenCanvasRenderingContext2D, size: number) => void
type IconMap = Record<number, ImageData>
interface IconSet {
  en: IconMap
  vi: IconMap
}
interface ModeMessage {
  enabled: boolean
  type: 'mode_update'
  worker: boolean
}
interface WorkerKeyMessage {
  key: string
  type: 'worker_key'
}
interface WorkerResetMessage {
  type: 'worker_reset'
}

const makeIcon = (size: number, draw: Draw): ImageData | null => {
    if (typeof OffscreenCanvas === 'undefined') return null
    const canvas = new OffscreenCanvas(size, size),
      ctx = canvas.getContext('2d')
    if (!ctx) return null
    draw(ctx, size)
    return ctx.getImageData(0, 0, size, size)
  },
  makeIcons = (draw: Draw): IconMap | null => {
    const [small, large] = [makeIcon(16, draw), makeIcon(32, draw)]
    if (!(small && large)) return null
    return { 16: small, 32: large }
  },
  star = (ctx: OffscreenCanvasRenderingContext2D, size: number) => {
    const center = size / 2,
      outer = size * 0.38,
      inner = size * 0.16
    ctx.beginPath()
    for (let i = 0; i < 10; i += 1) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5,
        radius = i % 2 === 0 ? outer : inner,
        x = center + Math.cos(angle) * radius,
        y = center + Math.sin(angle) * radius
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  },
  blue = '#0000ff',
  red = '#ff0000',
  white = '#ffffff',
  yellow = '#ffff00',
  drawVietnam = (ctx: OffscreenCanvasRenderingContext2D, size: number) => {
    ctx.fillStyle = red
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = yellow
    star(ctx, size)
  },
  drawUk = (ctx: OffscreenCanvasRenderingContext2D, size: number) => {
    const half = size / 2,
      diagWhite = size * 0.3,
      diagRed = size * 0.18,
      crossWhite = size * 0.32,
      crossRed = size * 0.18
    ctx.fillStyle = blue
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = white
    ctx.lineWidth = diagWhite
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(size, size)
    ctx.moveTo(0, size)
    ctx.lineTo(size, 0)
    ctx.stroke()
    ctx.strokeStyle = red
    ctx.lineWidth = diagRed
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(size, size)
    ctx.moveTo(0, size)
    ctx.lineTo(size, 0)
    ctx.stroke()
    ctx.fillStyle = white
    ctx.fillRect(half - crossWhite / 2, 0, crossWhite, size)
    ctx.fillRect(0, half - crossWhite / 2, size, crossWhite)
    ctx.fillStyle = red
    ctx.fillRect(half - crossRed / 2, 0, crossRed, size)
    ctx.fillRect(0, half - crossRed / 2, size, crossRed)
  },
  getIcons = (() => {
    let cached: IconSet | null = null
    return () => {
      if (cached) return cached
      const on = makeIcons(drawVietnam),
        off = makeIcons(drawUk)
      if (!(on && off)) return null
      cached = { en: off, vi: on }
      return cached
    }
  })(),
  HOST_NAME = 'com.telex.vietnamese'

interface NativeMessage {
  deleteCount?: number
  error?: string
  insertText?: string
  status: string
}
let nativePort: Browser.runtime.Port | null = null,
  nativeConnected = false,
  enabled = true

const tabModes = new Map<number, boolean>(),
  updateBadge = async (tabId: number) => {
    const worker = tabModes.get(tabId)
    if (enabled)
      await browser.action.setTitle({ tabId, title: 'Double Option/Alt to switch between simple and worker mode\n' })
    else await browser.action.setTitle({ tabId, title: 'Click or Double Ctrl to toggle\n' })
    if (!(enabled && worker)) {
      await browser.action.setBadgeText({ tabId, text: '' })
      return
    }
    await browser.action.setBadgeBackgroundColor({ color: [0, 0, 0, 1], tabId })
    await browser.action.setBadgeText({ tabId, text: nativeConnected ? '✅' : '❌' })
  },
  updateAllBadges = () => {
    for (const tabId of tabModes.keys()) updateBadge(tabId)
  },
  connectNative = () => {
    if (nativePort) return
    try {
      nativePort = browser.runtime.connectNative(HOST_NAME)
      nativePort.onMessage.addListener((message: NativeMessage) => {
        if (message.status === 'ready') {
          nativeConnected = true
          console.log('[Telex] Native host connected')
          updateAllBadges()
        }
      })
      nativePort.onDisconnect.addListener(() => {
        console.log('[Telex] Native host disconnected:', browser.runtime.lastError?.message)
        nativePort = null
        nativeConnected = false
        updateAllBadges()
        setTimeout(connectNative, 5000)
      })
    } catch {
      nativePort = null
      nativeConnected = false
    }
  },
  sendToNative = (message: { action: string; deleteCount?: number; insertText?: string; usePaste?: boolean }) => {
    if (!nativePort) connectNative()
    try {
      nativePort?.postMessage(message)
    } catch {
      nativePort = null
      nativeConnected = false
    }
  },
  tabEngines = new Map<number, ReturnType<typeof createEngine>>(),
  getTabEngine = (tabId: number) => {
    let engine = tabEngines.get(tabId)
    if (!engine) {
      engine = createEngine()
      tabEngines.set(tabId, engine)
    }
    return engine
  },
  toneCombining = /[\u0300\u0301\u0303\u0309\u0323]/u,
  markCombining = /[\u0302\u0306\u031B]/u,
  needsPaste = (text: string) => {
    for (const ch of text) {
      const nfd = ch.normalize('NFD')
      if (toneCombining.test(nfd) && markCombining.test(nfd)) return true
    }
    return false
  }
browser.tabs.onRemoved.addListener(tabId => {
  tabEngines.delete(tabId)
  tabModes.delete(tabId)
  browser.action.setBadgeText({ tabId, text: '' })
})
browser.runtime.onMessage.addListener(
  // eslint-disable-next-line @typescript-eslint/strict-void-return
  (message: ContentMessage, sender, sendResponse: (response: unknown) => void): boolean => {
    const tabId = sender.tab?.id
    if (!tabId) return false
    if (message.type === 'worker_key') {
      const engine = getTabEngine(tabId),
        before = engine.getProcessedString()
      engine.processKey(message.key, 0)
      const after = engine.getProcessedString()
      let commonPrefix = 0
      while (commonPrefix < before.length && before[commonPrefix] === after[commonPrefix]) commonPrefix += 1
      const deleteCount = before.length - commonPrefix,
        insertText = after.slice(commonPrefix),
        usePaste = insertText ? needsPaste(insertText) : false
      sendToNative({ action: 'type', deleteCount, insertText, usePaste })
      if (isWordBreakSymbol(message.key)) tabEngines.get(tabId)?.reset()
      sendResponse({
        deleteCount,
        insertText,
        success: nativeConnected,
        usePaste
      })
      return true
    }
    if (message.type === 'worker_reset') {
      tabEngines.get(tabId)?.reset()
      sendResponse({ success: true })
      return true
    }
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (message.type === 'mode_update') {
      tabModes.set(tabId, message.worker && message.enabled)
      updateBadge(tabId)
      sendResponse({ success: true })
      return true
    }
    return false
  }
)

const readEnabled = async () => {
    const stored = await browser.storage.local.get('enabled')
    return typeof stored.enabled === 'boolean' ? stored.enabled : true
  },
  setIcon = async (value: boolean) => {
    const icons = getIcons()
    if (!icons) return
    await browser.action.setIcon({ imageData: value ? icons.vi : icons.en })
  },
  setEnabled = async (value: boolean) => {
    if (enabled === value) return
    enabled = value
    await browser.storage.local.set({ enabled })
    await setIcon(enabled)
    updateAllBadges()
  },
  init = async () => {
    enabled = await readEnabled()
    await setIcon(enabled)
    updateAllBadges()
    connectNative()
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return
      const next = changes.enabled?.newValue
      if (typeof next === 'boolean' && next !== enabled) {
        enabled = next
        setIcon(next)
        updateAllBadges()
      }
    })
    browser.action.onClicked.addListener(() => {
      setEnabled(!enabled)
    })
  }

export default defineBackground(() => {
  init()
})
