# Test Coverage Matrix — Personal Browser-Native NLHE GTO Solver ("ClearSolve")

> Owner: SDET Lead Agent
> Last Updated: 2026-06-24
> Status: DRAFT for review
> Source of truth: `ACCEPTANCE_CRITERIA.md` (AC-*), `USER_STORIES.md` (US-*), `PRD.md`, `ARCHITECTURE.md`, `API_SPEC.md`
> Companion: `TEST_STRATEGY.md`, `QUALITY_GATES.md`

Maps every acceptance criterion to risk, the lowest useful test level, automation status, the responsible automation agent, and current status. Test levels: **U**=domain/Rust unit, **C**=component, **AI**=application integration (port fakes), **RW**=real-WASM/worker integration, **E2E**=Playwright, **M**=manual/exploratory, **TH**=trust harness (Sec 6 of strategy). Status is Planned for all (new project).

| AC | Story | Scenario | Risk | Test Level(s) | Manual/Auto | Responsible Agent | Status |
|----|-------|----------|------|---------------|-------------|-------------------|--------|
| AC-001 | US-001 | Live solve runs locally, zero compute network call (only static assets) | RISK-004, NFR-006 | E2E (network intercept) | Automated | playwright-engineer | Planned |
| AC-002 | US-001 | Valid strategy; freq sums==1; matches reference within tolerance | RISK-004 (High) | U + RW + TH (Rings 1-3) | Automated (+M spot-review) | engineer + api-automation-engineer | Planned |
| AC-003 | US-002 | UI responsive (<100ms main-thread block) during solve | NFR-002 | E2E (long-task) | Automated | playwright-engineer | Planned |
| AC-004 | US-003 | Progress + iteration count shown and updating | RISK-004 (trust UX) | C + E2E | Automated | playwright-engineer | Planned |
| AC-005 | US-004 | Stop halts in bounded time; best-so-far labeled not-converged | RISK-010, EDGE-003/006 | RW + E2E | Automated | api-automation-engineer + playwright-engineer | Planned |
| AC-006 | US-005 | Over-budget solve warned/blocked with suggestions | RISK-001/003/010 (High) | AI + RW + E2E | Automated | api-automation-engineer + playwright-engineer | Planned |
| AC-024 | US-024 | Cache hit served instantly; no solve loop; provenance shown | RISK-014, RISK-001 | AI + RW | Automated | api-automation-engineer | Planned |
| AC-025 | US-025 | Cache miss / corrupt library -> live fallback with notice | RISK-014, EDGE-009/010 | AI + RW | Automated | api-automation-engineer | Planned |
| AC-026 | US-026 | Result labeled Predefined vs Live; settings shown | RISK-014/004, BR-007 | AI + C + E2E | Automated | api-automation-engineer + playwright-engineer | Planned |
| AC-007 | US-006 | Preflop HU spot configurable; empty range blocks solve | RISK-004 (validation) | U + C | Automated | engineer + playwright-engineer | Planned |
| AC-008 | US-007 | 13x13 range editor: select/weight, 169-class layout | BR-001 | U + C | Automated | engineer + playwright-engineer | Planned |
| AC-009 | US-008 | Bet-sizing tree configurable; more sizes -> higher cost | RISK-001 | U + C | Automated | engineer | Planned |
| AC-010 | US-009 | Board validated: duplicates/conflicts rejected | BR-002, EDGE-005 | U (+property) | Automated | engineer | Planned |
| AC-011 | US-010 | Strategy grid colored by action; per-cell freq; sums==1 | BR-003 | C (+U for sum) | Automated (+M readability) | playwright-engineer | Planned |
| AC-012 | US-011 | EV per action/hand with unit; equity as % | BR-004 | U (equity/EV oracle) + C | Automated | engineer + playwright-engineer | Planned |
| AC-013 | US-012 | Exploitability shown, labeled estimate; abstraction shown | RISK-004, BR-005 | C + E2E | Automated | playwright-engineer | Planned |
| AC-014 | US-013 | GTO-term tooltips/explanations | RISK-007 (Should) | C + M | Auto(light)+Manual | playwright-engineer | Planned |
| AC-015 | US-014 | Constrained postflop solve within bound; valid output | RISK-001/003 | RW + TH | Automated | api-automation-engineer | Planned |
| AC-016 | US-015 | Spot+result persist across reload/restart; no egress | RISK-013, NFR-006 | AI + E2E (G-PERS) | Automated | api-automation-engineer + playwright-engineer | Planned |
| AC-017 | US-016 | Saved work load/rename/delete | RISK-013 | AI + E2E | Automated | api-automation-engineer + playwright-engineer | Planned |
| AC-018 | US-017 | Storage usage shown; eviction communicated; quota-fail no partial record | RISK-003/013, EDGE-004 | AI + C + E2E | Automated | api-automation-engineer | Planned |
| AC-019 | US-018 | App usable with no install/account; loads from static host | CON-2 | E2E | Automated | playwright-engineer | Planned |
| AC-020 | US-019 | Unsupported browser -> clear gate, states missing capability | NFR-009, EDGE-002 | C + E2E | Automated | playwright-engineer | Planned |
| AC-021 | US-020 | App works offline after first load (shell+WASM+library) | RISK-006 (SW/COEP) | E2E | Automated | playwright-engineer | Planned |
| AC-022 | US-022 | Spot export/import round-trips; import schema-validated | RISK-013 (Could) | U + AI + E2E | Automated (light) | api-automation-engineer | Planned |
| AC-023 | US-021 | Practice scores answer vs solution; reveal + next | REQ-021 | U (scoring) + AI + E2E | Automated | engineer + playwright-engineer | Planned |
| AC-027 | US-027 | Practice draws from predefined/saved spots | REQ-021 | AI + E2E | Automated | api-automation-engineer + playwright-engineer | Planned |

## Cross-cutting coverage (not single-AC; trust/quality backbone)

| Concern | Maps to | Test Level(s) | Auto/Manual | Responsible Agent | Gate |
|---------|---------|---------------|-------------|-------------------|------|
| Toy-game oracles (Kuhn, push/fold, matrix) | RISK-004, AC-002 | U/RW (TH Ring 1) | Automated | engineer | G3.1 |
| Self-consistency invariants | RISK-004, NFR-004 | RW (TH Ring 2) | Automated | api-automation-engineer | G3.2 |
| Determinism (seed reproducibility) | NFR-004 | U + RW | Automated | engineer + api-automation-engineer | G3.2 |
| Single vs multi-thread parity | ADR-003, RISK-006 | RW | Automated | api-automation-engineer | G3.3 |
| Reference-solver benchmark | RISK-004/014, M2 | RW (TH Ring 3) | Automated (+M spot-review) | api-automation-engineer + engineer | G3.4 |
| Cache/live cross-source consistency | RISK-004/014 | RW | Automated | api-automation-engineer | G3.5 |
| Equity/EV independent cross-check | BR-004, AC-012 | U | Automated | engineer | G3.2 |
| Board isomorphism correctness | RISK-014, ARCH 7.2 | U (property-based) | Automated | engineer | G4.2 |
| Worker message-protocol contract | API_SPEC Sec 3 | RW | Automated | api-automation-engineer | G2.6/G3.* |
| Quantization round-trip | ADR-007 | U | Automated | engineer | G4.7 |
| OOM resilience (no UI crash) | RISK-010, NFR-003 | RW | Automated | api-automation-engineer | G5.2 |
| Privacy / no-egress | NFR-006, AC-001 | E2E | Automated | playwright-engineer | G-PRIV |
| Memory budget / bundle ceiling | RISK-003 | RW + CI check | Automated | performance-test-engineer | G5.1/G5.4 |
| Perf/memory tracking (alerts) | NFR-001 | RW harness | Automated (non-gating) | performance-test-engineer | G5a |
| Accessibility | NFR-008 adjacency | E2E (axe) + M | Auto+Manual | playwright-engineer | Sec 8 (Could) |
| Visual regression (grids) | AC-011/012 | E2E snapshot | Automated (small set) | playwright-engineer | review |
| Expert GTO sanity spot-review | RISK-004/009 | M | Manual | SDET / expert | M0 + release |

## Coverage gaps / notes
- **Manual-only:** expert GTO strategy sanity review; grid readability; GTO-term UX helpfulness; browser/device matrix beyond CI set (Q-007). All small, high-judgement, documented.
- **Deferred/light (Could):** AC-022 export/import, AC-014 tooltips, responsive layout.
- **Pending open questions:** tolerances (Sec 6.6 strategy) and tractability bound (Q-001) ratified in M0; coverage fixtures track the final predefined coverage list (Q-010).
- Every Must/Should AC has at least one automated test at the lowest useful level. No Must AC is manual-only.
