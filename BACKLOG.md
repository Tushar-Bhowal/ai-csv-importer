# Backlog

Non-blocking findings from phase-end reviews. Correctness and security issues are fixed
immediately and never land here. Everything below is swept in Phase 6.

| # | Phase | Finding | Source |
|---|-------|---------|--------|
| 1 | 0 | `npm audit`: 2 moderate, both `postcss <8.5.10` bundled inside Next. **Accepted, not fixed** — `npm audit fix --force` "resolves" it by downgrading to `next@9.3.3`. Not exploitable here: we ship no user-authored CSS. Revisit when Next ships a patched postcss. | `npm audit` |
| 2 | 0 | Next's ESLint plugin is not wired into the flat config (`eslint.config.mjs`). Costs us the `next/core-web-vitals` rules. Add in Phase 4 when there is real UI to lint. | `next build` warning |
