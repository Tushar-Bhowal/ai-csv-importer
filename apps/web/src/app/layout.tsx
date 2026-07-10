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

// Runs before the body paints, so the OS dark preference is applied with no flash
// of the light theme. The .dark token block and the components' `dark:` utility
// variants both key on this class, so it must sit on the element, not come from a
// media query. suppressHydrationWarning covers the class React did not itself render.
const applyColorScheme = `try{if(matchMedia('(prefers-color-scheme: dark)').matches)document.documentElement.classList.add('dark')}catch(e){}`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <script dangerouslySetInnerHTML={{ __html: applyColorScheme }} />
        {children}
      </body>
    </html>
  )
}
