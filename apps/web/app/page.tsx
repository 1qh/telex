'use client'
import { createEngine } from '@telex/engine'
import { useId, useMemo, useState } from 'react'

const transform = (raw: string): string => {
  const engine = createEngine()
  engine.processString(raw, 0)
  return engine.getProcessedString()
}
const Page = () => {
  const [raw, setRaw] = useState('tieengs Vieejt')
  const output = useMemo(() => transform(raw), [raw])
  const rawId = useId()
  return (
    <main className='page'>
      <header className='header'>
        <h1 className='title'>
          Telex <span className='title-muted'>— Vietnamese input</span>
        </h1>
        <a className='download' download href='/telex.zip'>
          Download extension (.zip)
        </a>
      </header>
      <div className='panes'>
        <section className='pane'>
          <label className='label' htmlFor={rawId}>
            Type raw Telex
          </label>
          <textarea
            className='input'
            id={rawId}
            onChange={event => setRaw(event.target.value)}
            spellCheck={false}
            value={raw}
          />
        </section>
        <section className='pane'>
          <span className='label'>Vietnamese</span>
          <output className='output' htmlFor={rawId}>
            {output}
          </output>
        </section>
      </div>
    </main>
  )
}
export default Page
