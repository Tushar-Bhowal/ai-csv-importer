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

Requires **Node 24** (see `.nvmrc`; `nvm use` picks it up).

```bash
npm install               # also builds packages/core, which the API imports
cp .env.example .env      # the API key is optional — see below
npm run dev               # web → :3000   api → :3001   core → rebuilds on save
```

Or run them separately: `npm run dev:api`, `npm run dev:web`, `npm run dev:core`.

> Adding a dependency? Refresh the lockfile with `npm install --include=optional`. rolldown (via
> vitest → vite) pins `@emnapi/core` as an optional *peer*, and a lockfile written by plain
> `npm install` omits it — which npm's own `npm ci` then rejects. See `BACKLOG.md` #3.

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
apps/web        Next.js 16 App Router.
```

`apps/api/src/app.ts` builds the Express app and `export default`s it. Vercel
[deploys Express with zero config](https://vercel.com/docs/frameworks/backend/express) by picking up
that default export — no `api/` folder, no rewrites, no compiled output. `src/dev.ts` calls
`app.listen()` for local development. It's named `dev.ts`, not `server.ts`, because Vercel also
treats `src/server.ts` as an entrypoint candidate and we want exactly one.

`packages/core` **is** compiled to `dist`, because Vercel's Express function
[does not bundle its dependencies](https://vercel.com/docs/frameworks/backend/express#limitations).
Per Turborepo's [Internal Packages](https://turborepo.dev/docs/core-concepts/internal-packages)
guidance, a package consumed by a bundler can ship raw TypeScript; one consumed without a bundler
must be compiled. `npm install` builds it via a `prepare` script.

## Deploy — two Vercel projects, same repo

Each project needs the other's URL, so the order matters: **api → web → back to api.**

**Step 1 — create the `api` project**

Vercel → Add New → Project → import `Tushar-Bhowal/ai-csv-importer`.

| Setting | Value |
| --- | --- |
| Project Name | `ai-csv-importer-api` |
| Root Directory | `apps/api` |
| Include files outside Root Directory | **on** (npm workspaces: `@groweasy/core` lives at the repo root) |
| Framework Preset | Express (auto-detected) |
| Install / Build Command | leave empty — `apps/api/vercel.json` sets them |
| Env | *(none yet)* |

Deploy, then copy the URL. Call it `<api-url>`.

**Step 2 — create the `web` project**

Add New → Project → import **the same repo again**.

| Setting | Value |
| --- | --- |
| Project Name | `ai-csv-importer` |
| Root Directory | `apps/web` |
| Include files outside Root Directory | **on** |
| Framework Preset | Next.js (auto-detected) |
| Env | `NEXT_PUBLIC_API_URL` = `<api-url>` — no trailing slash |

Deploy, then copy the URL. Call it `<web-url>`. **This is the URL you submit.**

**Step 3 — go back to the `api` project and finish it**

Settings → Environment Variables:

| Name | Value |
| --- | --- |
| `WEB_ORIGIN` | `<web-url>` — no trailing slash |
| `GOOGLE_GENERATIVE_AI_API_KEY` | your key (optional; without it the app runs on heuristics) |

Then **Deployments → ⋯ → Redeploy.** Environment variables only take effect on a new build.

> Both variables are read at build/boot time, not per request. Change either one and you must
> redeploy that project. `NEXT_PUBLIC_*` values are baked into the browser bundle, so the *web*
> project must be redeployed if `<api-url>` ever changes.

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

### If a deploy goes wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build fails with `Cannot find module '@groweasy/core'` | **Include files outside Root Directory** is off, so Vercel pruned `packages/`. | Turn it on. Both projects. |
| Build fails with `@groweasy/core/dist/index.js` not found | The root `npm install` didn't run, so the `prepare` script never built `core`. | The install command must run at the repo root. `apps/api/vercel.json` already does this with `cd ../.. && npm install`. |
| Web page shows *"Cannot reach the API"* | `WEB_ORIGIN` isn't set on the API project, so CORS is still allowing only `localhost:3000`. | Set `WEB_ORIGIN` to the web deployment's origin. `GET /api/v1/health` echoes `allowedOrigins`, so you can see exactly what the API will accept. |
| Progress stream arrives all at once at the end | The platform buffered the SSE response. | Headers `X-Accel-Buffering: no` and `Cache-Control: no-transform` are already set. If it still buffers, SSE must become chunked polling. |
| Upload returns `413` | Vercel caps request bodies below the 5 MB the brief mentions. | Lower the upload limit to 4 MB and say so in this README. |
