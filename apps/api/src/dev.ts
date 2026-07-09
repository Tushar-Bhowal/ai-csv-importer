import { fileURLToPath } from 'node:url'

// Local dev only: pull GOOGLE_GENERATIVE_AI_API_KEY etc. from the repo-root
// .env via Node's native loader — no dotenv dependency. Absent file is fine.
// Loaded before app.js is imported, because config.ts reads process.env at
// import time; a static import would run first and see nothing.
try {
  process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)))
} catch {
  /* no .env — defaults apply */
}

const { app } = await import('./app.js')

const port = Number(process.env.PORT ?? 3001)

app.listen(port, () => {
  console.warn(`api listening on http://localhost:${port}`)
})
