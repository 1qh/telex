'use client'
import type { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'

const Providers = ({ children }: { children: ReactNode }) => (
  <ThemeProvider attribute='class' defaultTheme='dark' enableSystem>
    {children}
  </ThemeProvider>
)
export default Providers
