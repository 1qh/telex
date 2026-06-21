'use client'

import { createEngine } from '@telex/engine'
import { useMemo, useState } from 'react'

const transform = (raw: string): string => {
  const engine = createEngine()
  engine.processString(raw, 0)
  return engine.getProcessedString()
}

const Page = () => {
  const [raw, setRaw] = useState('tieengs Vieejt')
  const output = useMemo(() => transform(raw), [raw])

  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        padding: '1rem',
        gap: '0.75rem'
      }}
    >
      <header style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '1.05rem', fontWeight: 600 }}>
          Telex <span style={{ color: 'var(--muted)', fontWeight: 400 }}>— Vietnamese input</span>
        </h1>
        <a
          download
          href="/telex.zip"
          style={{
            background: 'var(--accent)',
            borderRadius: '0.5rem',
            color: '#06222b',
            fontSize: '0.9rem',
            fontWeight: 600,
            padding: '0.5rem 0.9rem',
            textDecoration: 'none'
          }}
        >
          Download extension (.zip)
        </a>
      </header>

      <div style={{ display: 'grid', flex: 1, gap: '0.75rem', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
        <section style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minHeight: 0 }}>
          <label htmlFor="raw" style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>
            Type raw Telex
          </label>
          <textarea
            autoFocus
            id="raw"
            onChange={(event) => setRaw(event.target.value)}
            spellCheck={false}
            value={raw}
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: '0.6rem',
              color: 'var(--text)',
              flex: 1,
              fontFamily: 'ui-monospace, monospace',
              fontSize: '1.4rem',
              lineHeight: 1.5,
              outline: 'none',
              padding: '1rem',
              resize: 'none'
            }}
          />
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minHeight: 0 }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>Vietnamese</span>
          <output
            htmlFor="raw"
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: '0.6rem',
              flex: 1,
              fontSize: '1.4rem',
              lineHeight: 1.5,
              overflow: 'auto',
              padding: '1rem',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word'
            }}
          >
            {output}
          </output>
        </section>
      </div>
    </main>
  )
}

export default Page
