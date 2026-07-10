export function FolderIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 128 108"
      className={className}
      role="presentation"
      aria-hidden
      focusable="false"
    >
      <defs>
        <linearGradient id="folder-back" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--chart-2)" />
          <stop offset="1" stopColor="var(--chart-4)" />
        </linearGradient>
        <linearGradient id="folder-front" x1="0.1" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="color-mix(in oklab, var(--primary) 45%, white)" />
        </linearGradient>
      </defs>

      <path
        d="M8 28a10 10 0 0 1 10-10h26a6 6 0 0 1 4.2 1.8l6 6a6 6 0 0 0 4.2 1.8H110a10 10 0 0 1 10 10v52a10 10 0 0 1-10 10H18a10 10 0 0 1-10-10Z"
        fill="url(#folder-back)"
      />

      <path
        d="M12 46h104a6 6 0 0 1 5.9 7l-6.4 38A12 12 0 0 1 103.7 101H24.3a12 12 0 0 1-11.8-10L6.1 53A6 6 0 0 1 12 46Z"
        fill="url(#folder-front)"
      />
    </svg>
  )
}
