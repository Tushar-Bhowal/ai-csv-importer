# AI CSV Importer

Upload any CSV of leads. One AI call works out what the columns mean; deterministic TypeScript
converts every row into GrowEasy CRM format.

> **Status: Phase 0 (scaffold + deploy).** The importer itself lands in Phase 1–4. This README is
> replaced in Phase 7.

## The idea

> **The LLM decides how to interpret the file. Code does the interpreting.**

The model sees the header row and ~30 sampled rows, and returns a *mapping plan* — which column
feeds which CRM field, what date format this file uses, how its status strings map onto the four
allowed values. Pure TypeScript then applies that plan to all 40,000 rows.

|                            | Row-by-row batching | Schema mapping (this) |
| -------------------------- | ------------------- | --------------------- |
| AI calls, 10k rows         | ~400                | **1**                 |
| Cost                       | ~$1.20              | **~$0.0002**          |
| Latency                    | ~90s                | **~4s**               |
| Same input → same output   | no                  | **yes**               |
| Can hallucinate a phone no. | yes                | **structurally impossible** |
| Unit-testable              | no                  | **yes**               |

## Run it

```bash
npm install
cp .env.example .env      # the API key is optional — see below
npm run dev:api           # terminal 1 → http://localhost:3001
npm run dev:web           # terminal 2 → http://localhost:3000
```

**No API key?** It still runs. The app falls back to heuristic column matching, sets
`degraded: true`, and says so in the UI. A free key from
[aistudio.google.com/apikey](https://aistudio.google.com/apikey) enables AI mapping.

```bash
npm run typecheck    # project references + web + test configs
npm test             # Vitest, packages/core
npm run lint
```

## Layout

```
packages/core   the product. imports neither Express nor React.
apps/api        Express 5. app.ts knows nothing about where it runs.
apps/web        Next.js 15 App Router.
```

`apps/api/src/app.ts` builds the Express app. `server.ts` calls `app.listen()` for local dev and any
plain Node host. `api/index.js` is a one-line `export default app` for Vercel. The app does not know
which one is using it.

## Deploy — two Vercel projects, same repo

Both are created by hand in the Vercel dashboard, from
`github.com/Tushar-Bhowal/ai-csv-importer`.

**Project 1 — `api`**

| Setting | Value |
| --- | --- |
| Root Directory | `apps/api` |
| Include files outside Root Directory | **on** (npm workspaces: `@groweasy/core` lives at the repo root) |
| Framework Preset | Other |
| Install / Build Command | taken from `apps/api/vercel.json` |
| Env | `GOOGLE_GENERATIVE_AI_API_KEY`, `WEB_ORIGIN=https://<web-url>` |

**Project 2 — `web`**

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Include files outside Root Directory | **on** |
| Framework Preset | Next.js |
| Env | `NEXT_PUBLIC_API_URL=https://<api-url>` |

### Then verify the deployment, before building anything on top of it

```bash
# 1. the API is up
curl https://<api-url>/api/v1/health

# 2. SSE streams rather than buffering — three ticks, one second apart.
#    If they all arrive at once after 3s, the progress stream would be a lie in production.
curl -N https://<api-url>/api/v1/probe/stream

# 3. the platform's request body ceiling. Must be 200, not 413.
#    Vercel Functions cap below the 5 MB the assignment mentions.
head -c 5242880 /dev/zero | tr '\0' 'a' > /tmp/5mb.csv
curl -s -o /dev/null -w '%{http_code}\n' -F file=@/tmp/5mb.csv https://<api-url>/api/v1/probe/echo
```

4. Open the web URL. The health card must read `ok` — that is the cross-origin CORS check.

`/api/v1/probe/*` exists only to answer (2) and (3) on the real platform rather than on localhost.
It is deleted at the end of Phase 3.
