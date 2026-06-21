import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import './globals.css'

export const metadata: Metadata = {
  description: 'Live Telex → Vietnamese transform, powered by @telex/engine',
  title: 'Telex — Vietnamese input'
}

const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang="en">
    <body>{children}</body>
  </html>
)

export default RootLayout
