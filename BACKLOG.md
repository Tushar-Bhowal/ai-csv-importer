# Backlog

Non-blocking findings from phase-end reviews. Correctness and security issues are fixed
immediately and never land here. Everything below is swept in Phase 6.

| # | Phase | Finding | Source |
|---|-------|---------|--------|
| 1 | 0 | `npm audit`: 2 moderate, both `postcss <8.5.10` bundled inside Next. **Accepted, not fixed** — `npm audit fix --force` "resolves" it by downgrading to `next@9.3.3`. Not exploitable here: we ship no user-authored CSS. Revisit when Next ships a patched postcss. | `npm audit` |
| 2 | 0 | Next's ESLint plugin is not wired into the flat config (`eslint.config.mjs`). Costs us the `next/core-web-vitals` rules. Add in Phase 4 when there is real UI to lint. | `next build` warning |
| 3 | 0 | `npm ci` needs `--include=optional`. rolldown (vitest → vite) pins `@emnapi/core` as an optional **peer**; `npm install` writes a lockfile that plain `npm ci` rejects as out of sync. An npm bug, not ours. CI passes the flag; `npm install` (what the README and Vercel use) is unaffected. Revisit when npm fixes optional-peer lockfile resolution. | fresh-clone test |
| 4 | 0 | `typescript` pinned at 5.9.3 though 7.0.2 is out: `typescript-eslint@8.63` declares peer `>=4.8.4 <6.1.0`. `@types/node` pinned at 24.x to match the Node 24 runtime, not the newest 26.x line. | `npm outdated` |
