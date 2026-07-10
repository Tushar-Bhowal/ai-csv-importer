# AI CSV Importer

Upload any CSV of leads. One AI call works out what the columns mean; deterministic TypeScript
converts every row into GrowEasy CRM format.

> **Status: the core, the AI mapping call, the API and the UI are all built.**
> The browser posts the CSV to the Express API; the API makes one AI call per file and returns clean
> records. Without a key it falls back to heuristic column matching, reports `degraded: true`, and
> says so in the UI. This README is replaced in Phase 7.

| Phase | | |
| --- | --- | --- |
| 0 | scaffold, deploy, probes | done |
| 1 | `packages/core` — parse, transform, zero AI | done |
| 2 | one AI call → `MappingPlan` | done |
| 3 | Express API + upload route | done |
| 4 | Next.js UI | done, ahead of 2 and 3 |
| 5 | **eval harness — cost, latency, mapping accuracy** | **next** |
| 6 | robustness | |
| 7 | README, decisions, submit | |

## The idea

> **The LLM decides how to interpret the file. Code does the interpreting.**

The assignment asks for records to be sent to the AI in batches. This app does that — but only for
the rows that need it.

First comes one call. The model reads the header row and ~30 sampled rows, and returns a *mapping
plan*: which column feeds which CRM field, what date format this file uses, how its status strings
map onto the four allowed values. Deterministic TypeScript then applies that plan to every row.
Rows the plan cannot resolve are escalated back to the AI in batches, with retry and backoff.

Mapping first, batching for the residue. Three reasons:

- **The mapping call cannot emit a data value.** It returns column names, a format string, and an
  enum map — never a name, an email, or a phone number. So it cannot hallucinate a contact, and a
  cell reading `Ignore previous instructions` has no path to the output. Prompt injection is
  prevented by the shape of the data, not by filtering it.
- **Same input, same output.** `applyPlan()` is a pure function, which is what makes the transform
  layer unit-testable at all.
- **Cost and latency scale with the number of _columns_, not the number of rows.**

Cost, latency, and field-level mapping accuracy are measured in Phase 5 by `npm run eval`, and the
numbers land here. Nothing is quoted until it has been measured.

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

## The API

The browser posts the CSV straight to Express. The file crosses the network once, and the Gemini key
lives only on the API.

| | |
| --- | --- |
| `GET /api/v1/health` | `{ status, llm: available \| degraded, version, allowedOrigins }` |
| `POST /api/v1/import` | the CSV as the **raw request body**, `Content-Type: text/csv`, max 4 MB |

```bash
curl -X POST http://localhost:3001/api/v1/import \
  -H 'Content-Type: text/csv' \
  --data-binary @leads.csv
```

`200` returns `{ headers, previewRows, plan, records, skipped, summary, csv }` — the `ImportResult`
schema in `packages/core`. There is no multipart parse: nothing but our own web app calls this route,
and it has the bytes already. `express.raw` enforces the 4 MB cap *during* the stream, which is the
only property multer was wanted for.

Every failure answers with one envelope, `{ error: { code, message, requestId } }`:

| | |
| --- | --- |
| `400` | the file is empty |
| `413` | over 4 MB — Vercel rejects a 5 MB body before the function runs, so our ceiling sits under it |
| `415` | `Content-Type` was not `text/csv` |
| `422` | a header row, but no data rows |
| `500` | the message is always `Something went wrong on our side.` — an internal message can carry a path or a credential |

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

The browser posts the CSV to the API cross-origin, so a wrong `WEB_ORIGIN` fails every import.

The function's `maxDuration` is capped at `60s` in `apps/api/vercel.json` — comfortably above the
30s in-code Gemini timeout, well under Vercel's 300s default, as a runaway-cost guard. Express
becomes a single function Vercel names `index`, so the glob has to be `**/*`; a source-path glob like
`src/app.ts` silently matches nothing (verified against `vercel build`). The Next.js-style
`export const maxDuration` does **not** apply to the Express preset.

Then **Deployments → ⋯ → Redeploy.** Environment variables only take effect on a new build.

> Both variables are read at build/boot time, not per request. Change either one and you must
> redeploy that project. `NEXT_PUBLIC_*` values are baked into the browser bundle, so the *web*
> project must be redeployed if `<api-url>` ever changes.

### Then verify the deployment, before building anything on top of it

```bash
# 1. the API is up, and knows whether it has a key
curl https://<api-url>/api/v1/health

# 2. a real import, end to end
curl -X POST https://<api-url>/api/v1/import \
  -H 'Content-Type: text/csv' --data-binary @leads.csv

# 3. the 4 MB ceiling holds. Must be 413 with our envelope, not Vercel's raw error page.
head -c 5242880 /dev/zero | tr '\0' 'a' > /tmp/5mb.csv
curl -s -X POST https://<api-url>/api/v1/import \
  -H 'Content-Type: text/csv' --data-binary @/tmp/5mb.csv
```

4. Open the web URL. The header must read `API v0.1.0` — that is the cross-origin CORS check — and
   an upload must complete.

Two throwaway probes at `/api/v1/probe/*` answered the SSE-buffering and body-ceiling questions on
the real platform during Phase 0. Both answers are settled, and the probes were deleted in Phase 3.

### If a deploy goes wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build fails with `TS2349: This expression is not callable` on a dependency | Vercel's Express builder typechecks with its **own hardcoded compiler settings — it ignores `tsconfig.json` entirely** (verified: deleting the tsconfig changes nothing). Packages shipping modern dual CJS/ESM type declarations (helmet was ours) are unreadable to it. | Reproduce locally with `cd apps/api && npx vercel build` — no auth needed, exact same checker. Then replace the offending dependency (helmet became six lines in `middleware/securityHeaders.ts`) or change the import form until the local `vercel build` passes. |
| Build fails with `Cannot find module '@groweasy/core'` | Vercel pruned the repo root, so npm workspaces never linked `packages/core`. | Settings → Build & Deployment → Root Directory → include files outside it. |
| Build fails with `@groweasy/core/dist/index.js` not found | The root `npm install` didn't run, so the `prepare` script never built `core`. | The install command must run at the repo root. `apps/api/vercel.json` already does this with `cd ../.. && npm install`. |
| Web page shows *"Cannot reach the API"* | `WEB_ORIGIN` isn't set on the API project, so CORS is still allowing only `localhost:3000`. | Set `WEB_ORIGIN` to the web deployment's origin. `GET /api/v1/health` echoes `allowedOrigins`, so you can see exactly what the API will accept. |
| Progress stream arrives all at once at the end | The platform buffered the SSE response. | Headers `X-Accel-Buffering: no` and `Cache-Control: no-transform` are already set. If it still buffers, SSE must become chunked polling. |
| Upload returns `413` | Vercel caps request bodies below the 5 MB the brief mentions. | Lower the upload limit to 4 MB and say so in this README. |
