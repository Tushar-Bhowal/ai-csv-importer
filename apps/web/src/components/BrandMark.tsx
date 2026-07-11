import { cn } from '@/lib/utils'

// Three source columns converging into one field — the product in one glyph.
// currentColor throughout, so it follows the text color in both themes.
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('text-primary', className)}
    >
      <path d="M3 5h5" />
      <path d="M3 12h5" />
      <path d="M3 19h5" />
      <path d="M8 5c4.5 0 4.5 7 9 7" opacity="0.45" />
      <path d="M8 19c4.5 0 4.5-7 9-7" opacity="0.45" />
      <path d="M8 12h9" />
      <path d="m17 12 4 0" />
      <path d="m18.5 9.5 2.5 2.5-2.5 2.5" />
    </svg>
  )
}
