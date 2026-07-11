# AI CSV Importer

Upload any CSV of leads — any column names, any layout — and get back clean, structured records in
GrowEasy's CRM format. A model reads the columns **once** and decides how to interpret the file;
deterministic TypeScript does the actual converting.

Built for the GrowEasy **Software Developer (Full-Time)** take-home.

- **Live app:** <https://ai-csv-importer-web.vercel.app>
- **Repository:** <https://github.com/Tushar-Bhowal/ai-csv-importer>

---

## What's built

Every functional requirement in the brief, plus most of the bonus list.

**Required**

- Responsive web app: drag-and-drop **and** file-picker upload.
- **Preview before importing** — the browser parses the CSV and shows the rows in a scrollable,
  sticky-header table. No AI runs yet.
- **Confirm gate** — the backend is called only after you confirm.
- **Results** — imported records, skipped rows (with reasons), total imported, total skipped.
- One AI call maps arbitrary columns onto the **15 CRM fields** and returns structured JSON.
- All the AI rules: 4 status enums, 5 data-source enums (or blank), `new Date()`-parseable dates,
  notes overflow for extra emails/phones, single-CSV-row safety, and skipping any row with no email
  **and** no mobile.

**Bonus (done)**

| ✅ | Bonus item |
|---|---|
| ✅ | Drag & drop upload |
| ✅ | Progress indicator during AI processing (a live elapsed-seconds timer, not fake steps) |
| ✅ | Dark mode (the default; a toggle remembers your choice) |
| ✅ | Unit tests — **190**, on the logic that matters |
| ✅ | Virtualized results table (renders ~40 rows for a 10,000-row import) |
| ✅ | Deployed on Vercel |
| ✅ | This README |
| ✅ | Retry with backoff on the AI call |

**Beyond the brief**

- **Works with no API key** — falls back to a heuristic column matcher, flags itself `degraded`, and
  says so in the UI. A reviewer who never sets up a key still sees the whole flow.
- **Bring-your-own-key** — if the server's Gemini quota is spent, the result explains exactly why and
  lets you re-run with your own key (sent once, never stored).
- **An eval harness** that measures mapping accuracy on adversarial CSVs — heuristic **86%** vs LLM
  **100%** (see [Accuracy](#accuracy--how-we-know-the-ai-works)).
- **Prompt-injection safe by construction** — explained below.

---

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

```
Upload ─▶ Preview (parsed in the browser, no AI) ─▶ Confirm ─▶ API ─▶ Results
                                                                │
                          parseCsv ─▶ one Gemini mapping call ─▶ applyPlan (pure) ─▶ ImportResult
```

1. **Upload** — drag-and-drop or file picker.
2. **Preview** — the browser parses the CSV and shows the rows in a table. No AI, **no backend call
   yet** (the brief requires this).
3. **Confirm** — only now does the browser POST the raw CSV to the API.
4. **Result** — the API runs `parseCsv → one mapping call → applyPlan` and returns the imported
   records, the skipped rows with reasons, the totals, and a ready-to-download CSV.

If the model is unavailable (no key, rate-limited, timeout), the mapping falls back to a heuristic
column matcher, the response is flagged `degraded` with the exact reason, and the UI offers a
re-run with your own key.

## Tech stack

| Area | Choices |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS v4, shadcn / Radix, Motion |
| Backend | Node 24, Express 5 |
| AI | Google Gemini via the Vercel AI SDK — `generateObject` with a Zod schema (no `JSON.parse`) |
| Core logic | TypeScript (strict), Zod, papaparse, date-fns, libphonenumber-js |
| Tests & tooling | Vitest, ESLint, Prettier, npm workspaces |
| Hosting | Vercel — two projects (web + api) from one repo |

## The CRM schema (the target)

Every imported record has these **15 fields**; a missing value is `''`, never `null`.

```
created_at · name · email · country_code · mobile_without_country_code · company · city · state ·
country · lead_owner · crm_status · crm_note · data_source · possession_time · description
```

- `crm_status` is one of `GOOD_LEAD_FOLLOW_UP · DID_NOT_CONNECT · BAD_LEAD · SALE_DONE`, or blank.
- `data_source` is one of `leads_on_demand · meridian_tower · eden_park · varah_swamy ·
  sarjapur_plots`, or blank — these are GrowEasy's internal project names, so an external CSV almost
  never contains them and blank is the correct answer.
- `created_at` is emitted as `YYYY-MM-DD HH:mm:ss` and always satisfies `new Date(created_at)`.
- `country_code` is `+91`-style; `mobile_without_country_code` is bare digits.

## Run it locally

**Prerequisites:** Node **24** (see `.nvmrc` — run `nvm use`) and npm.

```bash
# 1. install (also compiles packages/core, which the API imports)
npm install

# 2. optional: add a Gemini key to enable AI mapping (the app runs without one)
cp .env.example .env        # then paste a key from https://aistudio.google.com/apikey

# 3. start web (:3000), api (:3001), and the core watcher together
npm run dev
```

Open **http://localhost:3000** and upload a CSV. Don't have one handy? Any of the files in
[`eval/fixtures/`](eval/fixtures/) works.

Run the pieces separately if you prefer: `npm run dev:web`, `npm run dev:api`, `npm run dev:core`.

**Checks:**

```bash
npm run typecheck    # strict TypeScript across core, api, web, and eval
npm test             # Vitest — 190 tests (core logic, the API route, the CSV preview)
npm run lint
npm run eval         # mapping accuracy on adversarial fixtures (needs a key for the LLM column)
```

> **Heads up on the lockfile:** adding a dependency? Refresh it with
> `npm install --include=optional`. rolldown (via vitest) pins `@emnapi/*` as optional peers that a
> plain `npm install` can drop.

## Accuracy — how we know the AI works

`npm run eval` runs the pipeline against **eight adversarial fixtures**, each isolating one hard
case: ambiguous `13/05` dates, split first/last-name columns, an Excel title/preamble above the real
header, file-specific status slang, a prompt-injection row, a contactless row that must be skipped,
and a `Source: Facebook` column that must stay blank. It scores *populated-cell* accuracy — the cells
that carry data in either the expected or the actual record — for the heuristic and the LLM on the
**same** files. Nothing below is quoted that wasn't measured.

| | heuristic | LLM (`gemini-3-flash-preview`) |
|---|---|---|
| Populated-cell accuracy | 86% (107/124) | **100% (124/124)** |
| Mapping latency, per file | — | avg 15.9s · max 27.1s (8 calls) |
| Imported/skipped split | correct on every fixture | correct on every fixture |

The LLM wins exactly the cases only the *sample values* can resolve: ambiguous dates, split names,
status words, and a name column whose header (`Prospect`) isn't in any synonym list. On the hostile
fixture, the injected text lands in `crm_note` verbatim and cannot flip an enum — the plan names
columns, so a cell value has no path to a mapping decision. The latency is Gemini free-tier `503`
throttling and the 20-requests/day quota, not the model; a paid key is markedly faster.

The traps, the expected output for every cell, and the runner all live in [`eval/`](eval/).

## The API

The browser posts the CSV straight to Express. The file crosses the network once, and the Gemini key
lives only on the API.

| | |
|---|---|
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

An optional `X-Llm-Api-Key` header runs the mapping call with the caller's own Gemini key for that
one request — read once, handed to the provider, never stored or logged. When the mapping degrades,
`summary.degradedReason` says exactly why (`no_key`, `rate_limited`, `invalid_key`, `timeout`,
`call_failed`) and the UI offers the bring-your-own-key re-run.

Every failure answers with one envelope, `{ error: { code, message, requestId } }`:

| | |
|---|---|
| `400` | the file is empty |
| `413` | over 4 MB — Vercel rejects a 5 MB body before the function runs, so our ceiling sits under it |
| `415` | `Content-Type` was not `text/csv` |
| `422` | a header row, but no data rows |
| `500` | the message is always `Something went wrong on our side.` — an internal message can carry a path or a credential |

## Data handling

For the mapping call, a sample of up to ~30 rows of the uploaded CSV — real lead data, including
names, emails, and phone numbers — is sent to Google's Gemini API. No row is stored: the app is
stateless and holds nothing after the response, and the model returns only column names, a format
string, and enum maps — never row data. The server's key stays server-side. A visitor's own key (the
degraded re-run) travels once per request in a header over HTTPS, is used in memory, and is never
stored or logged.

## Project structure

```
packages/core     the product — no Express, no React. Pure library.
  schema/         Zod source of truth: the 15 CRM fields, the mapping plan, the API contract
  parse/          decode bytes → rows; detect the header row under a preamble
  mapping/        the heuristic matcher + the one Gemini call → a MappingPlan
  transform/      applyPlan (pure), phone/date/enum coercion, CSV-injection guard
apps/api          Express 5 — thin. Routes, not thinking. Deploys to Vercel as one function.
apps/web          Next.js 16 App Router — upload, preview dialog, results grid, charts
eval/             eight adversarial fixtures + the accuracy runner
```

`apps/api/src/app.ts` builds the Express app and `export default`s it; Vercel
[deploys Express with zero config](https://vercel.com/docs/frameworks/backend/express) by picking up
that export. `packages/core` is compiled to `dist` because Vercel's Express function
[doesn't bundle its dependencies](https://vercel.com/docs/frameworks/backend/express#limitations);
`npm install` builds it via a `prepare` script.

## Deploy — two Vercel projects, same repo

Each project needs the other's URL, so the order matters: **api → web → back to api.**

**Step 1 — create the `api` project.** Vercel → Add New → Project → import the repo.

| Setting | Value |
|---|---|
| Root Directory | `apps/api` |
| Include files outside Root Directory | **on** (npm workspaces: `@groweasy/core` lives at the repo root) |
| Framework Preset | Express (auto-detected) |
| Install / Build Command | leave empty — `apps/api/vercel.json` sets them |

Deploy, then copy the URL. Call it `<api-url>`.

**Step 2 — create the `web` project.** Add New → Project → import **the same repo again**.

| Setting | Value |
|---|---|
| Root Directory | `apps/web` |
| Include files outside Root Directory | **on** |
| Env | `NEXT_PUBLIC_API_URL` = `<api-url>` — no trailing slash |

Deploy, then copy the URL. Call it `<web-url>`. **This is the URL you submit.**

**Step 3 — finish the `api` project.** Settings → Environment Variables:

| Name | Value |
|---|---|
| `WEB_ORIGIN` | `<web-url>` — no trailing slash |
| `GOOGLE_GENERATIVE_AI_API_KEY` | your key (optional; without it the app runs on heuristics) |

The browser posts the CSV cross-origin, so a wrong `WEB_ORIGIN` fails every import.
`GET /api/v1/health` echoes `allowedOrigins` so you can see what the API accepts. Both variables are
read at build/boot time — change either and redeploy that project.

### If a deploy goes wrong

| Symptom | Cause | Fix |
|---|---|---|
| Build fails typechecking a dependency | Vercel's Express builder typechecks with its **own hardcoded settings — it ignores `tsconfig.json`**. Packages shipping dual CJS/ESM type declarations (helmet was ours) are unreadable to it. | Reproduce with `cd apps/api && npx vercel build`, then replace the dependency until it passes. |
| `Cannot find module '@groweasy/core'` | Vercel pruned the repo root, so workspaces never linked `packages/core`. | Root Directory → include files outside it. |
| `@groweasy/core/dist/index.js` not found | The root `npm install` didn't run, so `prepare` never built core. | The install command must run at the repo root; `apps/api/vercel.json` already does `cd ../.. && npm install`. |
| Web shows *"Cannot reach the API"* | `WEB_ORIGIN` isn't set, so CORS still allows only `localhost:3000`. | Set `WEB_ORIGIN` to the web deployment's origin. |

## Submission

- **Hosted app:** <https://ai-csv-importer-web.vercel.app>
- **Repository:** <https://github.com/Tushar-Bhowal/ai-csv-importer>
- **Position:** Software Developer (Full-Time)
