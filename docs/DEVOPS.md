# DevOps — CI/CD, Build & Deployment Design

> Owner: DevOps Engineer Agent
> Last Updated: 2026-06-24
> Status: DRAFT for stakeholder review. Contains **approval-gate** items (host choice — GATE-B).
> Source of truth: `PRD.md`, `ARCHITECTURE.md`, `TECH_DECISIONS.md` (ADRs), `DATA_MODEL.md`, `API_SPEC.md`, `RISKS.md`.
> Companion (authored in parallel by SDET Lead): `TEST_STRATEGY.md`, `QUALITY_GATES.md` — **all numeric gate thresholds in CI are placeholders (`<from QUALITY_GATES.md>`) until those land.**

This document defines how ClearSolve is built, tested, deployed, and operated. It does **not** implement application code. It covers the polyglot Rust→WASM→Vite build, CI quality gates, cross-origin isolation for prod + dev, the offline predefined-solution generation pipeline, deploy/preview/rollback, and config/secrets.

---

## 1. Overview

ClearSolve is a **pure client-side SPA, static-hosting only, no backend** (CON-2). DevOps is therefore lean on the runtime side (nothing to provision server-side; persistence is IndexedDB + OPFS in the browser) but **non-trivial on the build side** because of two things:

1. A **polyglot build**: a Rust solver crate compiled to WebAssembly (wasm-pack) that feeds a React + TypeScript + Vite frontend (ADR-001, ADR-004).
2. **Cross-origin isolation** (COOP/COEP) required for the multi-threaded WASM engine variant — in **production hosting** and in **local/CI dev/test** (ADR-003, ADR-008, RISK-006, NFR-010).

Plus a third, offline concern:

3. An **offline predefined-solution generation pipeline** (the same Rust core compiled natively) that produces the bundled solution library shards. This is the **primary mitigation for RISK-001** and runs outside the request path (ADR-009).

### Repo layout assumed by this design

The app is not scaffolded yet; CI references this conventional polyglot layout. The implementation phase should adopt it (or adjust the CI paths):

```
/                         repo root
  engine/                 Rust solver crate (Cargo.toml) — compiles to WASM (live)
                          AND natively (offline generator: bin generate-library)
  frontend/               React + TS + Vite SPA
    package.json
    src/wasm/pkg/         <- wasm-pack output (gitignored; produced by build)
    public/               static assets copied to dist root
      _headers            <- COOP/COEP + caching (created; see §4)
      library/
        index.json        predefined library index (eager)
        shards/*.bin      predefined library shards (lazy)
  tools/library-gen/      Node orchestration/encoding for the offline pipeline
  public/_headers         (created at repo root as the canonical header template;
                           implementation moves/symlinks it under frontend/public)
  .github/workflows/      ci.yml, generate-library.yml, deploy.yml (created)
  netlify.toml.template   alternative-host template (created)
  .env.example            (created)
```

> Note: `public/_headers` was created at the **repo root** as the canonical template because the frontend isn't scaffolded yet. During implementation, move it to `frontend/public/_headers` so Vite copies it into `dist/`. The content is host-portable (Cloudflare Pages + Netlify both read `_headers`).

---

## 2. Pipeline Stages (diagram)

```
                          ┌──────────────────────────────────────────────┐
   PR / push to main ───► │                   CI (ci.yml)                 │
                          └──────────────────────────────────────────────┘
                                              │
        ┌──────────────────────┬──────────────┴───────────┬─────────────────────┐
        ▼                      ▼                           ▼                     ▼
  build-wasm            rust-tests                  frontend-checks         security
 (Rust→WASM,         (fmt, clippy,               (lint, tsc typecheck,    (npm audit,
  cache toolchain,    cargo test:                  Vitest unit + cov)      cargo audit)
  upload artifact)    determinism +                     │
        │             invariants +                      ▼
        │             CFR+ vs oracle)             build-app (Vite)
        │                  │                      + bundle-size budget (RISK-003)
        │                  │                      + verify _headers present
        │                  │                            │
        │                  │                            ▼
        │                  │                       e2e (Playwright,
        │                  │                       cross-origin ISOLATED webServer)
        ▼                  ▼                            │
  trust-harness (correctness vs reference solver,       │
   fast subset on PR / full on main) RISK-004/014       │
        └──────────────┬───────────────────────────────┘
                       ▼
                  ci-gate (single required status → branch protection)

  ───────────────────────────────────────────────────────────────────────────
  OFFLINE, on-demand (generate-library.yml, workflow_dispatch):
     native generator (same Rust core) → solve tranche → validate vs reference
       → encode shards+index (ADR-007) → artifact → human review → COMMIT to repo
     (heavy tranches run LOCALLY on desktop; CI is for small/standard tranches)

  ───────────────────────────────────────────────────────────────────────────
  DEPLOY (deploy.yml): PR → preview deploy (no approval)
                       main → production deploy [APPROVAL GATE: `production` env]
                              → smoke check COOP/COEP live → (rollback = re-promote)
```

Stage relevance to this project: **lint, type-check, unit (Vitest), Rust engine tests (cargo test), build, E2E (Playwright), bundle-size budget, security audit, and the solver trust/correctness harness.** There is no integration/API server stage because there is no backend; "integration" here means application-layer tests against the port fakes (`SolverEngine`, `PredefinedCache`, `PersistenceStore`) which run inside the Vitest unit/integration job.

---

## 3. Build Orchestration — Rust → WASM → Vite (polyglot)

The dependency is one-directional: **Vite consumes a prebuilt WASM package**; it never compiles Rust itself.

### 3.1 Step order

1. **Compile the Rust engine to WASM** with `wasm-pack build --release --target web --out-dir frontend/src/wasm/pkg`. This emits the `.wasm` binary + a JS/TS glue module + `.d.ts` types that the frontend imports.
2. **Vite build** (`npm run build`) imports the generated `pkg` as an ESM module. Vite handles WASM as an asset (content-hashed) and bundles the worker (`?worker`) that hosts the engine.
3. The predefined **library** (`frontend/public/library/index.json` + `shards/*.bin`) is already committed (produced offline, §6); Vite copies `public/` to `dist/` verbatim, so the library and `_headers` ship as-is.

### 3.2 npm scripts the implementation should define (so local == CI)

```jsonc
// frontend/package.json (illustrative — implemented in scaffolding phase)
{
  "scripts": {
    "wasm:build":   "wasm-pack build ../engine --release --target web --out-dir frontend/src/wasm/pkg",
    "wasm:build:mt":"# multi-thread variant build (nightly + atomics target-features) — see §5.4",
    "dev":          "vite",                 // dev server sets COOP/COEP (§4.3)
    "build":        "vite build",           // assumes wasm already built
    "build:all":    "npm run wasm:build && npm run build",
    "preview":      "vite preview",
    "lint":         "eslint .",
    "typecheck":    "tsc --noEmit",
    "test:unit":    "vitest run",
    "test:e2e":     "playwright test"
  }
}
```

CI calls the same scripts (`wasm:build`, `lint`, `typecheck`, `test:unit`, `build`, `test:e2e`) so **local and CI behavior are aligned** (DevOps standard).

### 3.3 CI caching strategy (keeps PR feedback fast)

| Cache | Tool | Key | Why |
|-------|------|-----|-----|
| cargo registry + git deps + `target/` | `Swatinem/rust-cache@v2` | `Cargo.lock` + workspace, **separate keys for `wasm32` vs `native`** | Avoid recompiling deps every run; the wasm and native target dirs differ, so they are cached independently |
| wasm toolchain (`wasm-pack`) | `taiki-e/install-action` (prebuilt binary) | pinned version | Installing wasm-pack from source is slow; use the prebuilt |
| `node_modules` | `actions/setup-node` `cache: npm` | `package-lock.json` | Fast `npm ci` |
| Playwright browsers | implicit / `~/.cache/ms-playwright` | Playwright version | Avoid re-download (can add an explicit cache step if needed) |

The **WASM artifact is built once** in the `build-wasm` job and shared with downstream jobs (`frontend-checks`, `build-app`) via `actions/upload-artifact` / `download-artifact`, so Rust is **not recompiled** in every job.

### 3.4 CI-build vs host-build of the WASM (decision)

**Decision: build the WASM (and the SPA) in GitHub Actions**, not on the host's build image. Rationale: Cloudflare Pages / Netlify build images do **not** ship the Rust/wasm toolchain by default, so building there means installing rustup + wasm-pack on every deploy (slow, fragile). Building in CI gives one place with cached toolchains, and the deploy job (or the host's "upload prebuilt output" mode) just publishes `dist/`. The `netlify.toml.template` notes the alternative if host-build is ever preferred.

---

## 4. Cross-Origin Isolation (COOP/COEP) — production AND dev (RISK-006, ADR-003/008)

This is the highest-risk infrastructure concern. The multi-threaded WASM engine needs `SharedArrayBuffer`, which the browser only exposes when the page is **cross-origin isolated** (`crossOriginIsolated === true`). That requires **both** response headers on the document:

```
Cross-Origin-Opener-Policy:   same-origin
Cross-Origin-Embedder-Policy: require-corp
```

If they are absent, the app **silently and correctly falls back to single-thread** (ADR-003 — same result, slower). So missing headers are not a correctness bug, but they silently forfeit the main performance lever. CI and a post-deploy smoke check both assert the headers are present so the degradation is never silent to *us*.

### 4.1 Production (chosen host)

- **Cloudflare Pages (preferred, ADR-008/GATE-B):** ships the `public/_headers` file (copied to `dist/_headers`). Cloudflare Pages reads `_headers` natively and applies it to production **and preview** deployments. **Created:** `public/_headers`.
- **Netlify (acceptable alternative):** also reads the same `_headers` file. A `netlify.toml` could express the same headers, but to avoid drift we keep `_headers` as the single source of truth. **Created:** `netlify.toml.template` (rename to `netlify.toml` only if Netlify is the approved host; otherwise delete).
- **GitHub Pages:** **cannot set these headers** → single-thread only (or a fragile Service-Worker COEP shim). Documented as the reason ADR-008 rejects it as the primary host.

### 4.2 The `require-corp` interaction (do not break it)

Under `COEP: require-corp`, every cross-origin subresource must supply CORP/CORS. ClearSolve is no-backend and fetches **only its own same-origin assets** (app bundle, WASM, library index/shards), so this is satisfied. **Guardrail:** do not add third-party script/style/font/image origins without giving them CORP, or they will be blocked. If an embeddable third party is ever needed, switch to `COEP: credentialless` and re-test. The CSP `connect-src 'self'` also enforces the no-egress posture (NFR-006).

### 4.3 Local dev (Vite dev server) — header snippet

The Vite dev server must send the same headers so `crossOriginIsolated` is true locally and the threaded engine + `SharedArrayBuffer` work during development. The frontend isn't scaffolded yet, so here is the snippet to add to `vite.config.ts` during implementation (do **not** create a real `vite.config` now):

```ts
// vite.config.ts — dev + preview server cross-origin isolation (ADR-003, RISK-006)
import { defineConfig } from 'vite';

const crossOriginIsolation = {
  name: 'cross-origin-isolation',
  configureServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      next();
    });
  },
  // same for `configurePreviewServer` so `vite preview` (used by Playwright) isolates too
  configurePreviewServer(server) {
    server.middlewares.use((_req, res, next) => {
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      next();
    });
  },
};

export default defineConfig({
  plugins: [/* react(), */ crossOriginIsolation],
  server:  { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
  preview: { headers: { 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' } },
});
```

> Either the `server.headers`/`preview.headers` option **or** the middleware plugin is sufficient; the plugin is shown because it also covers edge cases (some asset routes) and the preview server used by Playwright. Pick one and keep it consistent.

### 4.4 E2E (Playwright) cross-origin isolation

Playwright's `webServer` must serve the built `dist/` **with** COOP/COEP, otherwise `SharedArrayBuffer`/threaded-engine tests fail and the cross-origin-isolated code paths go untested. Two options for the implementation:
- run `vite preview` (with the preview headers above) as the Playwright `webServer`, or
- serve `dist/` via a tiny static server that injects the two headers.

The Service-Worker (PWA offline, FEAT-011) and COEP must be designed together (ARCHITECTURE Sec 10) — the SW must not strip the isolation headers; test the offline + isolated combination in E2E.

---

## 5. The Polyglot Build in Detail

### 5.1 Rust → WASM (live engine)
- Crate in `engine/`, target `wasm32-unknown-unknown`, built with `wasm-pack --target web`.
- `RUSTFLAGS: -D warnings` in CI keeps the engine warning-clean.
- Output (`pkg/`) is **gitignored** and always reproduced from source in CI/local.

### 5.2 Determinism (NFR-004) is a build/test property
Seeded solves must be byte-stable. CI `rust-tests` runs determinism tests (same seed → same strategy) and the frequency-sum invariants (BR-003). This underpins the golden-output and trust tests (RISK-004).

### 5.3 Same core, two compile targets (ADR-009)
The **same Rust crate** compiles (a) to WASM for the live in-browser engine and (b) natively for the offline generator binary (`generate-library`). One solving codebase → cache and live engine share validated logic. CI caches the two target dirs under separate keys (`wasm32`, `native`).

### 5.4 Multi-thread WASM variant (deferred per Q-003 / GATE-B)
Per ADR-003, ship single-thread first; add the threaded variant once the host headers are confirmed. The threaded build needs atomics/bulk-memory target features (and typically a nightly toolchain + `-Z build-std`). CI has a `TODO(impl)` placeholder for the second `wasm-pack` invocation. The app feature-detects at runtime and picks the variant — **no rebuild of the app needed to fall back**.

---

## 6. Offline Predefined-Solution Generation Pipeline (ADR-009, RISK-001)

This pipeline produces the bundled solution library. It is **not in the request path** and never ships in the app — only its **output** (shards + index) ships, committed into the repo as versioned static assets.

### 6.1 What it does
1. Build the native generator (`engine` → `bin generate-library`) — same Rust core, no browser limits.
2. Solve the Q-010 coverage **tranche** at high iteration counts / finer abstraction than the in-browser engine (ARCHITECTURE Sec 18).
3. **Validate** each entry's exploitability against a reference solver on a benchmark subset, within tolerance (RISK-004/014, M2). SDET co-owns the reference oracle.
4. **Encode** to the ADR-007 two-tier format: small eager `index.json` (LookupKeyString → shard/offset + `GenerationMeta`) + compressed binary `shards/*.bin` (quantized strategies, Brotli/gzip), stamped with `formatVersion` + integrity hash (NFR-011).
5. Emit the assets as a CI artifact.

### 6.2 How/when it runs — and the honest time-limit reality
- **Manual** (`workflow_dispatch`) with a `tranche` input — **not** on every push. **Created:** `.github/workflows/generate-library.yml`.
- **Honest caveat:** production-class postflop solves can run minutes-to-hours each. The full library (Tranche 2/3) **will exceed normal GitHub-hosted runner time/cost limits** (6h/job hard cap). Therefore:
  - The CI job is scoped to **one tranche/subset per run** and is suitable for **small/standard tranches** (preflop, smoke, small flop samples) and for reproducibility.
  - **Heavy/full-library generation runs LOCALLY on a desktop** (no CI time cap — this is a Windows dev box; native `cargo build --release` + the generator binary run fine on Windows), and the validated output is **committed**. This is the recommended path for the expensive tranches and avoids paying for long CI minutes.
  - (Optional future) a dedicated long-running self-hosted runner could host heavy generation if desired — that would be a new-infrastructure **approval-gate** item, not proposed for MVP.

### 6.3 Versioning the library + getting artifacts into the app build
- The library is **versioned** via `formatVersion` + `engineVersionClass` + integrity hash in `index.json` (DATA_MODEL Sec 7). The app validates these on load and disables the cache (live-solve fallback) on mismatch/corruption (EDGE-010, NFR-011).
- Generated, **validated** assets are **committed to `frontend/public/library/`** (a human reviews the artifact first — the cache is trust-bearing, so keep a human in the loop). The normal app build (`ci.yml` → `build-app`) then just consumes the committed files; no special wiring.
- Two ways to land them: (A) download the artifact, review, commit by hand (**recommended** for the trust-bearing cache), or (B) have the workflow open a **PR** (requires `contents: write`) so `ci.yml` gates the new shards before merge. Never push library assets straight to `main`.
- The committed shards are content-hashed and `Cache-Control: immutable` (see `_headers`), so the CDN serves them efficiently and the browser caches them in OPFS for offline (FEAT-011).

---

## 7. CI Quality Gates (wired to QUALITY_GATES.md)

`ci.yml` implements the gates below. **Numeric thresholds are placeholders** (`<from QUALITY_GATES.md>`) until the SDET Lead's `QUALITY_GATES.md` lands; this design wires the *stages* and the *enforcement point*, and the thresholds drop in.

| Gate | Job / step | Enforcement | Threshold source |
|------|-----------|-------------|------------------|
| Rust format | `rust-tests` → `cargo fmt --check` | hard | n/a (binary) |
| Rust lint | `rust-tests` → `cargo clippy` | hard | n/a |
| Rust unit + determinism + invariants | `rust-tests` → `cargo test` | hard | n/a (must pass) |
| Frontend lint | `frontend-checks` → ESLint | hard | n/a |
| Type-check | `frontend-checks` → `tsc --noEmit` | hard | n/a |
| Unit coverage (Vitest) | `frontend-checks` → coverage thresholds | hard | `QUALITY_GATES.md` |
| Build succeeds | `build-app` → `vite build` | hard | n/a |
| **Bundle-size budget** (RISK-003) | `build-app` → size step | hard (once wired) | `QUALITY_GATES.md` |
| Headers present | `build-app` → verify `_headers` (COOP/COEP) | hard | n/a (RISK-006) |
| E2E (Playwright, isolated) | `e2e` | hard | `QUALITY_GATES.md` (flake budget) |
| Dependency audit | `security` → npm/cargo audit | advisory→hard | `QUALITY_GATES.md` |
| **Solver trust/correctness** (RISK-004/014) | `trust-harness` | advisory→hard | `QUALITY_GATES.md` (exploitability tolerance) |

- **`ci-gate`** job aggregates the hard gates into **one required status** for branch protection. `security` and `trust-harness` start **advisory** (`continue-on-error`) and are promoted to hard gates once thresholds are finalized — they are not *disabled*, just not yet blocking, and their reports upload regardless.
- **Flaky CI** is not tolerated: the E2E flake budget comes from `QUALITY_GATES.md`; flakes are surfaced via the uploaded Playwright report, never hidden by retries-to-green. Do not disable tests to make a pipeline pass.
- **PR vs main split:** the slow `trust-harness` runs a **fast subset on PRs** and the **full suite on main/schedule**, keeping PR feedback quick while still validating thoroughly before release.

---

## 8. Deploy / Preview / Promotion / Rollback (static, no backend)

### 8.1 Two valid deploy models
1. **Host-native git integration (recommended default for a personal tool):** connect the repo to Cloudflare Pages; the host auto-builds (or auto-publishes a prebuilt artifact) on push and creates **preview deployments per PR** automatically. Simplest, least to maintain. The catch: building Rust/WASM on the host needs toolchain install (§3.4), so prefer "upload prebuilt `dist/`" mode.
2. **CI-driven deploy (`deploy.yml`, created):** CI builds with cached toolchains and publishes `dist/` via `wrangler pages deploy`. Use this when you want the deploy gated on the **same** build + tests as `ci.yml` and an explicit audit trail.

### 8.2 Environment promotion
- **Preview** (PR): isolated preview URL, no approval. Cloudflare Pages applies `_headers` to previews too, so isolation is testable pre-merge.
- **Production** (main): gated by a GitHub **`production` environment with a required reviewer** → a human must approve each production release (satisfies the production-deploy approval rule). After deploy, a **smoke check** asserts the live site sends COOP/COEP (the single most important post-deploy assertion — RISK-006).

### 8.3 Rollback (`docs` cross-ref: see ROLLBACK below in §10)
- Static host, **no backend, no database, no migrations** → rollback is trivial and risk-free: re-promote a previous immutable deployment (Cloudflare Pages dashboard or `wrangler pages deployment` / Netlify "publish deploy"). No data rollback to consider (all user data is client-side and untouched by deploys).
- **One caveat:** the predefined-library `formatVersion`. If a release bumps the library format, an older app build re-promoted on rollback must still validate-or-disable the newer cached shards gracefully (EDGE-010 already covers this — the app disables the cache and live-solves on version mismatch). Keep library `formatVersion` changes backward-tolerant.

### 8.4 Artifact / versioning strategy
- App build artifacts are content-hashed by Vite; each deployment is immutable on the host.
- The predefined library is versioned independently (`formatVersion`) and committed; its shards are content-addressed and long-cached.
- `VITE_APP_VERSION` + the WASM `engineVersion` are surfaced for the version-mismatch UX (EDGE-008).

---

## 9. Configuration & Secrets (lean)

- **No runtime secrets** (no backend, no data egress — NFR-006). `connect-src 'self'` in CSP forbids unexpected network calls.
- **Build-time public flags** are `VITE_`-prefixed and **inlined into the bundle** (therefore not secret). See `.env.example` (created): `VITE_APP_VERSION`, `VITE_FORCE_SINGLE_THREAD`, `VITE_LIBRARY_BASE_PATH`, `VITE_DEBUG_PANEL`.
- **CI/deploy secrets** live **only in GitHub Actions secrets**, never in the repo: `CLOUDFLARE_API_TOKEN` (scoped Pages:Edit), `CLOUDFLARE_ACCOUNT_ID` (or `NETLIFY_AUTH_TOKEN` / `NETLIFY_SITE_ID`). Documented (names only) in `.env.example`.
- **Analytics:** intentionally none in MVP. Adding any analytics later is an **approval-gate** item (it would touch CSP `connect-src`, the COEP/CORP posture, and the privacy guarantee NFR-006).

---

## 10. Required Companion Docs (to be expanded in implementation)

This file is the master design. The implementation phase should split out (or the Documentation Engineer can lift from here):
- **DEPLOYMENT.md** — target env, prerequisites, steps, smoke checks, approval gates (content in §4.1, §8).
- **ROLLBACK.md** — re-promote previous deployment; no data rollback; library `formatVersion` caveat (content in §8.3).
- **ENVIRONMENT.md** — variable table from `.env.example` + §9.
- **LOCAL_SETUP.md** — §11 below.

---

## 11. Local Setup (Windows dev box; CI is Linux)

Dev machine is Windows/PowerShell; CI runs on Linux runners. The toolchains are cross-platform, but note the Windows specifics.

### 11.1 Prerequisites
- **Node 20+** (match CI `NODE_VERSION`).
- **Rust toolchain** via `rustup` (`https://rustup.rs`). Add the WASM target:
  ```powershell
  rustup target add wasm32-unknown-unknown
  ```
  Rust on Windows needs the **MSVC build tools** (Visual Studio C++ build tools) for the *native* generator build; the *wasm* target does not need MSVC. Install "Desktop development with C++" if the native `generate-library` build fails to link.
- **wasm-pack**:
  ```powershell
  cargo install wasm-pack
  # or: winget install rustwasm.wasm-pack
  ```

### 11.2 First build + run
```powershell
# from repo root
npm --prefix frontend ci
npm --prefix frontend run wasm:build      # Rust -> WASM
npm --prefix frontend run dev             # Vite dev server WITH COOP/COEP (§4.3)
```
Open the dev URL; check `crossOriginIsolated === true` in the console to confirm the threaded engine is available locally.

### 11.3 Run the gates locally (parity with CI)
```powershell
# Rust
cargo fmt --all --check --manifest-path engine/Cargo.toml
cargo clippy --all-targets --manifest-path engine/Cargo.toml
cargo test --release --manifest-path engine/Cargo.toml
# Frontend
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run test:unit
npm --prefix frontend run build
npm --prefix frontend run test:e2e
```

### 11.4 Generate a library tranche locally (heavy tranches)
```powershell
cargo build --release --manifest-path engine/Cargo.toml --bin generate-library
# ./engine/target/release/generate-library --tranche tranche-2 --out artifacts/library
# node tools/library-gen/encode.mjs --in artifacts/library --out frontend/public/library
```
Commit the validated `frontend/public/library/` output (review first — trust-bearing).

---

## 12. Troubleshooting (common failures)

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| `crossOriginIsolated === false`; threaded engine never used | COOP/COEP headers not served (dev: vite config; prod: `_headers` not in `dist`) | Add headers (§4.3); verify `dist/_headers` exists; check host applies `_headers` |
| Third-party asset blocked / blank | `COEP: require-corp` blocks a cross-origin resource lacking CORP | Make it same-origin, add CORP, or switch to `COEP: credentialless` and re-test |
| CI WASM build slow every run | rust-cache key mismatch / wasm-pack built from source | Confirm `Swatinem/rust-cache` keyed on `Cargo.lock`; use prebuilt `wasm-pack` (taiki-e) |
| `cargo test` passes locally, fails in CI | `RUSTFLAGS: -D warnings` in CI; nondeterminism | Fix warnings; ensure seeded determinism (NFR-004) |
| Playwright SAB tests fail in CI | webServer not sending COOP/COEP | Set preview/static-server headers (§4.4) |
| Bundle-size gate fails | initial JS/WASM over budget (RISK-003) | Code-split, ensure shards stay lazy (not in initial chunk), check WASM size |
| Production deploy stuck "waiting" | `production` environment required reviewer not approved | Approve the deployment (intended approval gate) |
| Cache returns stale/wrong / disabled | library `formatVersion`/integrity mismatch (EDGE-010) | Regenerate + re-commit library; app falls back to live solve meanwhile |

---

## 13. Risk Cross-Reference (DevOps responses)

| Risk | DevOps response (where) |
|------|------------------------|
| **RISK-006** (COOP/COEP / threads) | `public/_headers` (prod), Vite dev/preview header snippet (§4.3), Playwright isolated webServer (§4.4), CI header-presence gate + post-deploy smoke check (§8.2). Single-thread fallback means missing headers degrade, never break. |
| **RISK-001** (live postflop infeasible) | Offline generation pipeline (§6) ships precomputed heavy spots; CI consumes committed shards. Long solves run locally/desktop (honest time-limit handling). |
| **RISK-003** (bundle/memory) | Bundle-size budget gate (§7); lazy library shards excluded from initial budget; `Cache-Control: immutable` on shards; index kept small/eager. |
| **RISK-010** (OOM) | Not a CI concern at runtime, but determinism + budget logic are unit-tested in `rust-tests`; trust-harness validates bounded solves. |
| **RISK-004 / RISK-014** (correctness/trust) | `trust-harness` job + offline reference-solver validation (§6.1, §7); determinism tests; library integrity/version checks enforced in app and re-validated in CI. |
| **RISK-013** (eviction) | Not a deploy concern (client-side); export/import is the user backup (app feature), unaffected by deploys. |

---

## 14. Approvals Needed (DevOps)

1. **GATE-B (ADR-008) — final deploy target:** **Cloudflare Pages (recommended)** vs Netlify, and whether multi-thread WASM (and thus COOP/COEP) is **in MVP** or deferred to post-MVP. This design works for either host with the same `_headers` file; the `deploy.yml` template shows the Cloudflare path and `netlify.toml.template` covers Netlify. **Recommendation: Cloudflare Pages; ship single-thread first, enable threading once headers are verified on the live host.**
2. **Production deploy approval mechanism:** confirm the GitHub `production` **environment + required reviewer** as the approval gate (no production deploy without it).
3. **(Future / not now)** A dedicated long-running runner for heavy library generation would be a **new-infrastructure** approval item — not proposed for MVP (heavy tranches run locally instead).

No production deploy, no destructive operation, and no new cloud service is being executed by this design — only configuration files and documentation are created.
