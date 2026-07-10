import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import type { ReactNode } from 'react'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })

export const metadata: Metadata = {
  title: 'AI CSV Importer',
  description: 'Upload any CSV. AI maps the columns. Code converts the rows.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
