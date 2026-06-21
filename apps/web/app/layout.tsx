/** biome-ignore-all lint/nursery/noUndeclaredClasses: standard tailwind v4 utilities biome cannot resolve */
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Providers from './providers'
import './globals.css'

const metadata: Metadata = {
  description: 'Type Vietnamese with Telex, right in your browser.',
  title: 'Telex — Vietnamese input'
}
const RootLayout = ({ children }: { children: ReactNode }) => (
  <html lang='en' suppressHydrationWarning>
    <body className='antialiased'>
      <Providers>{children}</Providers>
    </body>
  </html>
)
export { metadata }
export default RootLayout
