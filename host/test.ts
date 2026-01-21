const encodeMessage = (message: Record<string, unknown>): Uint8Array => {
  const body = new TextEncoder().encode(JSON.stringify(message)),
    header = new Uint8Array(4)
  new DataView(header.buffer).setUint32(0, body.length, true)
  const result = new Uint8Array(header.length + body.length)
  result.set(header)
  result.set(body, 4)
  return result
}

process.stdout.write(encodeMessage({ action: 'ping' }))
