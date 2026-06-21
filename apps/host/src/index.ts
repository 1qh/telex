// oxlint-disable prefer-await-to-then, prefer-await-to-callbacks, prefer-top-level-await, no-promise-executor-return
/* eslint-disable no-continue, @typescript-eslint/no-loop-func, no-await-in-loop, max-statements */
/** biome-ignore-all lint/nursery/noUnnecessaryConditions: x */
/** biome-ignore-all lint/nursery/noContinue: x */
/** biome-ignore-all lint/performance/noAwaitInLoops: x */
import { clipboard, Key, keyboard } from '@nut-tree-fork/nut-js'
keyboard.config.autoDelayMs = 0

const wait = async (ms: number) =>
    new Promise<void>(resolve => {
      setTimeout(resolve, ms)
    }),
  isMac = process.platform === 'darwin',
  pasteKey = isMac ? Key.LeftCmd : Key.LeftControl,
  pasteText = async (text: string) => {
    const previous = await clipboard.getContent().catch(() => null)
    try {
      await clipboard.setContent(text)
      await keyboard.pressKey(pasteKey, Key.V)
      await keyboard.releaseKey(pasteKey, Key.V)
      await wait(50)
    } finally {
      if (previous !== null) await clipboard.setContent(previous).catch(() => null)
    }
  },
  readExact = async (stream: NodeJS.ReadableStream, size: number): Promise<null | Uint8Array> => {
    const chunks: Uint8Array[] = []
    let totalRead = 0
    while (totalRead < size) {
      const chunk = await new Promise<null | Uint8Array>(resolve => {
        const data = stream.read(size - totalRead)
        if (data) {
          if (typeof data === 'string') return resolve(Buffer.from(data))
          return resolve(data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer))
        }
        const onReadable = () => {
            const d = stream.read(size - totalRead)
            if (d) {
              stream.off('readable', onReadable)
              // eslint-disable-next-line @typescript-eslint/no-use-before-define
              stream.off('end', onEnd)
              if (typeof d === 'string') return resolve(Buffer.from(d))
              resolve(d instanceof Uint8Array ? d : new Uint8Array(d as ArrayBuffer))
            }
          },
          onEnd = () => {
            stream.off('readable', onReadable)
            stream.off('end', onEnd)
            resolve(null)
          }
        stream.once('readable', onReadable)
        stream.once('end', onEnd)
      })
      if (!chunk) return null
      chunks.push(chunk)
      totalRead += chunk.length
    }
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    if (chunks.length === 1) return chunks[0] as Uint8Array
    const result = new Uint8Array(totalRead)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result
  },
  readMessage = async (): Promise<null | Record<string, unknown>> => {
    const header = await readExact(process.stdin, 4)
    if (!header) return null
    const view = new DataView(header.buffer, header.byteOffset, header.byteLength),
      messageLength = view.getUint32(0, true)
    if (messageLength === 0) return null
    const body = await readExact(process.stdin, messageLength)
    if (!body) return null
    return JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>
  },
  sendMessage = (message: Record<string, unknown>) => {
    const body = new TextEncoder().encode(JSON.stringify(message)),
      header = new Uint8Array(4)
    new DataView(header.buffer).setUint32(0, body.length, true)
    process.stdout.write(header)
    process.stdout.write(body)
  },
  simulateTyping = async (deleteCount: number, insertText: string, usePaste: boolean): Promise<boolean> => {
    try {
      for (let i = 0; i < deleteCount; i += 1) {
        await keyboard.pressKey(Key.Backspace)
        await keyboard.releaseKey(Key.Backspace)
      }
      if (insertText) await (usePaste ? pasteText(insertText) : keyboard.type(insertText))
      return true
    } catch (error) {
      sendMessage({ error: String(error), status: 'error' })
      return false
    }
  },
  main = async () => {
    sendMessage({ status: 'ready' })
    while (true) {
      const message = await readMessage()
      if (!message) break
      const action = message.action as string
      if (action === 'ping') {
        sendMessage({ status: 'ok' })
        continue
      }
      if (action === 'type') {
        const deleteCount = (message.deleteCount as number) || 0,
          insertText = (message.insertText as string) || '',
          usePaste = Boolean(message.usePaste),
          success = await simulateTyping(deleteCount, insertText, usePaste)
        sendMessage({
          deleteCount,
          insertText,
          status: success ? 'ok' : 'error'
        })
        continue
      }
      sendMessage({ action, status: 'unknown' })
    }
  }
main().catch((error: unknown) => {
  sendMessage({ error: String(error), status: 'fatal' })
  process.exit(1)
})
