const DEFAULT_WEB_ORIGIN = 'http://localhost:3000'

export const isProduction = process.env.NODE_ENV === 'production'

export const allowedOrigins = (process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN)
  .split(',')
  // A browser's Origin header is scheme://host[:port], never with a trailing
  // slash — but a human pasting a URL into an env var usually includes one.
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean)

export const hasLlmKey = Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)

if (isProduction && !process.env.WEB_ORIGIN) {
  console.warn(
    `[config] WEB_ORIGIN is not set. CORS will only allow ${DEFAULT_WEB_ORIGIN}, so the deployed ` +
      `web app will be blocked by the browser. Set WEB_ORIGIN to the web deployment's origin.`,
  )
}
