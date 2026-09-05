// oxlint-disable prefer-await-to-callbacks -- node stream readable/end is an event API
/* eslint-disable no-await-in-loop -- sequential stdin protocol reads + ordered keystrokes are inherently serial */
/** biome-ignore-all lint/performance/noAwaitInLoops: sequential stdin protocol reads + ordered keystrokes are inherently serial */
import { clipboard, Key, keyboard } from '@nut-tree-fork/nut-js'

keyboard.config.autoDelayMs = 0
const wait = async (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })
const isMac = process.platform === 'darwin'
const pasteKey = isMac ? Key.LeftCmd : Key.LeftControl
const pasteText = async (text: string) => {
  const previous = await clipboard.getContent().catch(() => null)
  try {
    await clipboard.setContent(text)
    await keyboard.pressKey(pasteKey, Key.V)
    await keyboard.releaseKey(pasteKey, Key.V)
    await wait(50)
  } finally {
    if (previous !== null) await clipboard.setContent(previous).catch(() => null)
  }
}
const toBytes = (data: Buffer | string): Uint8Array => (typeof data === 'string' ? Buffer.from(data) : data)
const readChunk = async (stream: NodeJS.ReadableStream, want: number): Promise<null | Uint8Array> =>
  new Promise<null | Uint8Array>(resolve => {
    // biome-ignore lint/nursery/noUnsafeTypeAssertion: NodeJS ReadableStream.read() is typed any; in byte mode it yields Buffer|string|null
    const immediate = stream.read(want) as Buffer | null | string
    if (immediate !== null) {
      resolve(toBytes(immediate))
      return
    }
    const teardown: (() => void)[] = []
    const onReadable = () => {
      // biome-ignore lint/nursery/noUnsafeTypeAssertion: NodeJS ReadableStream.read() is typed any; in byte mode it yields Buffer|string|null
      const next = stream.read(want) as Buffer | null | string
      if (next !== null) {
        for (const off of teardown) off()
        resolve(toBytes(next))
      }
    }
    const onEnd = () => {
      for (const off of teardown) off()
      resolve(null)
    }
    teardown.push(
      () => {
        stream.off('readable', onReadable)
      },
      () => {
        stream.off('end', onEnd)
      }
    )
    stream.once('readable', onReadable)
    stream.once('end', onEnd)
  })
const readExact = async (stream: NodeJS.ReadableStream, size: number): Promise<null | Uint8Array> => {
  const chunks: Uint8Array[] = []
  let totalRead = 0
  while (totalRead < size) {
    const chunk = await readChunk(stream, size - totalRead)
    if (!chunk) return null
    chunks.push(chunk)
    totalRead += chunk.length
  }
  const [first] = chunks
  if (chunks.length === 1 && first) return first
  const result = new Uint8Array(totalRead)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }
  return result
}
const readMessage = async (): Promise<null | Record<string, unknown>> => {
  const header = await readExact(process.stdin, 4)
  if (!header) return null
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength)
  const messageLength = view.getUint32(0, true)
  if (messageLength === 0) return null
  const body = await readExact(process.stdin, messageLength)
  if (!body) return null
  // biome-ignore lint/nursery/noUnsafeTypeAssertion: JSON.parse returns any; the native-messaging frame is a JSON object
  return JSON.parse(new TextDecoder().decode(body)) as Record<string, unknown>
}
const sendMessage = (message: Record<string, unknown>) => {
  const body = new TextEncoder().encode(JSON.stringify(message))
  const header = new Uint8Array(4)
  new DataView(header.buffer).setUint32(0, body.length, true)
  process.stdout.write(header)
  process.stdout.write(body)
}
const simulateTyping = async (deleteCount: number, insertText: string, pasteMode: boolean): Promise<boolean> => {
  try {
    for (let i = 0; i < deleteCount; i += 1) {
      await keyboard.pressKey(Key.Backspace)
      await keyboard.releaseKey(Key.Backspace)
    }
    if (insertText) await (pasteMode ? pasteText(insertText) : keyboard.type(insertText))
    return true
  } catch (error) {
    sendMessage({ error: String(error), status: 'error' })
    return false
  }
}
const handle = async (message: Record<string, unknown>) => {
  const { action } = message
  if (action === 'ping') {
    sendMessage({ status: 'ok' })
    return
  }
  if (action === 'type') {
    const deleteCount = typeof message.deleteCount === 'number' ? message.deleteCount : 0
    const insertText = typeof message.insertText === 'string' ? message.insertText : ''
    const pasteMode = Boolean(message.usePaste)
    const success = await simulateTyping(deleteCount, insertText, pasteMode)
    sendMessage({ deleteCount, insertText, status: success ? 'ok' : 'error' })
    return
  }
  sendMessage({ action, status: 'unknown' })
}
const main = async () => {
  sendMessage({ status: 'ready' })
  let message = await readMessage()
  while (message) {
    await handle(message)
    message = await readMessage()
  }
}
try {
  await main()
} catch (error) {
  sendMessage({ error: String(error), status: 'fatal' })
  process.exitCode = 1
}
