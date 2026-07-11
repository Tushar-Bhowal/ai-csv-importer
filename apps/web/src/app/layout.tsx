import type { Metadata } from 'next'
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from 'next/font/google'
import type { ReactNode } from 'react'

import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' })
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage' })

export const metadata: Metadata = {
  title: 'AI CSV Importer',
  description: 'Upload any CSV. AI maps the columns. Code converts the rows.',
}

// Runs before the body paints, so the theme is applied with no flash of the wrong
// one. A saved choice (the toggle) wins; otherwise dark is the default. The .dark
// token block and the components' `dark:` variants both key on this class, so it
// must sit on the element. suppressHydrationWarning covers the class React did
// not itself render.
const applyColorScheme = `try{if(localStorage.getItem('theme')!=='light')document.documentElement.classList.add('dark')}catch(e){document.documentElement.classList.add('dark')}`

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrainsMono.variable} ${bricolage.variable}`}
    >
      <body>
        <script dangerouslySetInnerHTML={{ __html: applyColorScheme }} />
        {children}
      </body>
    </html>
  )
}
