# AI CSV Importer

Upload any CSV of leads — any column names, any layout. The app works out what each column means
and returns clean records in GrowEasy CRM format. Built for the GrowEasy Software Developer
take-home.

## The one idea

> **The LLM decides how to interpret the file. Code does the interpreting.**

One AI call per file. The model reads the header row and a sample of ~30 rows and returns a *mapping
plan* — which column feeds which CRM field, what date format the file uses, how its status words map
onto the four allowed values. Deterministic TypeScript then applies that plan to every row.

That single decision buys three things:

- **The model never emits a data value.** It returns column names, a format string, and enum maps —
  never a name, an email, or a phone number. So it cannot hallucinate a contact, and a cell reading
  `Ignore previous instructions` has no path to the output. Prompt injection is prevented by the
  *shape* of the data, not by filtering it.
- **Same CSV in, same records out.** `applyPlan()` is a pure function, which is what makes the
  transform layer genuinely unit-testable.
- **Cost and latency scale with the number of _columns_, not the number of rows.** A 10,000-row file
  costs the same one call as a 30-row file.

Work an LLM does badly, code does instead: `libphonenumber-js` splits phone numbers, `date-fns`
parses dates. The model's job is to *name* the format, not to do the parsing.

## How it works

1. **Upload** — drag-and-drop or file picker.
2. **Preview** — the browser parses the CSV and shows the rows in a scrollable, sticky-header table.
   No AI, and **no backend call yet**.
3. **Confirm** — only now does the browser POST the raw CSV to the API.
4. **Result** — the API runs `parseCsv → one mapping call → applyPlan` and returns the imported
   records, the skipped rows (with reasons), the totals, and a ready-to-download CSV.

**No API key? It still works.** The app falls back to heuristic column matching, sets
`degraded: true`, and says so in the UI — so a reviewer who never sets up a key still sees the whole
flow.

## Run it

Requires **Node 24** (see `.nvmrc`; `nvm use` picks it up).

```bash
npm install               # also builds packages/core, which the API imports
cp .env.example .env      # the API key is optional — see below
npm run dev               # web → :3000   api → :3001   core → rebuilds on save
```

Open **http://localhost:3000**. Or run the pieces separately: `npm run dev:api`, `npm run dev:web`,
`npm run dev:core`.

A free Gemini key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) enables AI
mapping. Without it, the app runs on the heuristic mapper.

```bash
npm run typecheck    # core project refs + api + web + eval
npm test             # Vitest — core, the API import route, and the CSV preview
npm run lint
npm run eval         # field-level mapping accuracy on adversarial fixtures (needs a key for the LLM column)
```

> Adding a dependency? Refresh the lockfile with `npm install --include=optional`. rolldown (via
> vitest → vite) pins `@emnapi/core` as an optional *peer*, and a lockfile written by plain
> `npm install` omits it — which npm's own `npm ci` then rejects.

## Accuracy & latency (measured)

`npm run eval` runs the pipeline against eight adversarial fixtures (ambiguous dates, split names,
Excel preambles, status slang, a prompt-injection row, a contactless row that must be skipped) and
scores *populated-cell* accuracy — cells that carry data in either the expected or the actual
record. Nothing below is quoted that was not measured on this machine.

| | heuristic | LLM (`gemini-3-flash-preview`) |
| --- | --- | --- |
| Populated-cell accuracy | 86% (107/124) | **100% (124/124)** |
| Mapping latency, per file | — | avg 15.9s · max 27.1s (8 calls) |
| Imported/skipped split | correct on every fixture | correct on every fixture |

The LLM maps every populated cell correctly where the name-matching heuristic reaches 86% — it wins
exactly the cases only the sample values can resolve: ambiguous `dd/MM` vs `MM/dd` dates, split
first/last-name columns, file-specific status words, and a name column whose header (`Prospect`)
isn't in the synonym list. On a hostile fixture, the injected text lands in `crm_note` verbatim and
cannot flip an enum — the plan names columns, so a cell value has no path to a mapping decision.

The latency is dominated by Gemini free-tier `503 "high demand"` throttling and the 20-requests/day
quota, not by the model itself; a paid key is markedly faster.

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

`200` returns `{ headers, plan, records, skipped, summary, csv }` — the `ImportResult` schema in
`packages/core`. There is no multipart parse: nothing but our own web app calls this route, and it
holds the bytes already. `express.raw` enforces the 4 MB cap *during* the stream.

Every failure answers with one envelope, `{ error: { code, message, requestId } }`:

| | |
| --- | --- |
| `400` | the file is empty |
| `413` | over 4 MB — Vercel rejects a 5 MB body before the function runs, so our ceiling sits under it |
| `415` | `Content-Type` was not `text/csv` |
| `422` | a header row, but no data rows |
| `500` | the message is always `Something went wrong on our side.` — an internal message can carry a path or a credential |

## Data handling

For the mapping call, a sample of up to ~30 rows of the uploaded CSV — real lead data, including
names, emails, and phone numbers — is sent to Google's Gemini API. No row is stored: the app is
stateless, holds nothing after the response, and the model returns only column names, a format
string, and enum maps, never row data. The API key stays server-side and never reaches the browser.

## Layout

```
packages/core   the product. imports neither Express nor React. schema · parse · mapping · transform
apps/api        Express 5. thin — routes, not thinking.
apps/web        Next.js 16 App Router.
eval/           adversarial fixtures + the accuracy runner
```

`apps/api/src/app.ts` builds the Express app and `export default`s it. Vercel
[deploys Express with zero config](https://vercel.com/docs/frameworks/backend/express) by picking up
that default export — no `api/` folder, no rewrites. `src/dev.ts` calls `app.listen()` for local
development; it's named `dev.ts`, not `server.ts`, because Vercel also treats `src/server.ts` as an
entrypoint candidate and we want exactly one.

`packages/core` **is** compiled to `dist`, because Vercel's Express function
[does not bundle its dependencies](https://vercel.com/docs/frameworks/backend/express#limitations).
`npm install` builds it via a `prepare` script.

## Deploy — two Vercel projects, same repo

Each project needs the other's URL, so the order matters: **api → web → back to api.**

**Step 1 — create the `api` project.** Vercel → Add New → Project → import the repo.

| Setting | Value |
| --- | --- |
| Root Directory | `apps/api` |
| Include files outside Root Directory | **on** (npm workspaces: `@groweasy/core` lives at the repo root) |
| Framework Preset | Express (auto-detected) |
| Install / Build Command | leave empty — `apps/api/vercel.json` sets them |

Deploy, then copy the URL. Call it `<api-url>`.

**Step 2 — create the `web` project.** Add New → Project → import **the same repo again**.

| Setting | Value |
| --- | --- |
| Root Directory | `apps/web` |
| Include files outside Root Directory | **on** |
| Env | `NEXT_PUBLIC_API_URL` = `<api-url>` — no trailing slash |

Deploy, then copy the URL. Call it `<web-url>`. **This is the URL you submit.**

**Step 3 — finish the `api` project.** Settings → Environment Variables:

| Name | Value |
| --- | --- |
| `WEB_ORIGIN` | `<web-url>` — no trailing slash |
| `GOOGLE_GENERATIVE_AI_API_KEY` | your key (optional; without it the app runs on heuristics) |

The browser posts the CSV to the API cross-origin, so a wrong `WEB_ORIGIN` fails every import.
`GET /api/v1/health` echoes `allowedOrigins`, so you can see exactly what the API will accept. Both
variables are read at build/boot time — change either and you must redeploy that project.

Then **Deployments → ⋯ → Redeploy** (environment variables only take effect on a new build), and
verify:

```bash
curl https://<api-url>/api/v1/health                                   # up, and knows if it has a key
curl -X POST https://<api-url>/api/v1/import \
  -H 'Content-Type: text/csv' --data-binary @leads.csv                 # a real import, end to end
```

Then open the web URL and run an upload end to end — that exercises the cross-origin CORS path.

### If a deploy goes wrong

| Symptom | Cause | Fix |
| --- | --- | --- |
| Build fails typechecking a dependency | Vercel's Express builder typechecks with its **own hardcoded settings — it ignores `tsconfig.json`**. Packages shipping dual CJS/ESM type declarations (helmet was ours) are unreadable to it. | Reproduce locally with `cd apps/api && npx vercel build`. Replace the dependency (helmet became six lines in `middleware/securityHeaders.ts`) until the local build passes. |
| `Cannot find module '@groweasy/core'` | Vercel pruned the repo root, so npm workspaces never linked `packages/core`. | Settings → Build & Deployment → Root Directory → include files outside it. |
| `@groweasy/core/dist/index.js` not found | The root `npm install` didn't run, so the `prepare` script never built `core`. | The install command must run at the repo root; `apps/api/vercel.json` already does `cd ../.. && npm install`. |
| Web page shows *"Cannot reach the API"* | `WEB_ORIGIN` isn't set on the API project, so CORS still allows only `localhost:3000`. | Set `WEB_ORIGIN` to the web deployment's origin. |

## Submission

- **Hosted app:** _<web deployment URL>_
- **Repository:** _<public GitHub URL>_
- **Position:** Software Developer (Full-Time)
