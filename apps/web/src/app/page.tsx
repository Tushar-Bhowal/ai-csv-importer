import { HealthCheck } from '@/components/HealthCheck'

export default function Home() {
  return (
    <main
      style={{
        maxWidth: '42rem',
        margin: '0 auto',
        padding: '4rem 1.5rem',
        display: 'grid',
        gap: '1.5rem',
      }}
    >
      <div>
        <h1 style={{ margin: 0, fontSize: '1.75rem' }}>AI CSV Importer</h1>
        <p style={{ margin: '0.5rem 0 0', color: 'var(--muted)' }}>
          Upload any CSV. One AI call works out what the columns mean; deterministic TypeScript
          converts every row.
        </p>
      </div>

      <HealthCheck />
    </main>
  )
}
