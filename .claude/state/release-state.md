# Release State

This file tracks release readiness, known risks, approvals, rollback planning, and post-release validation.

---

## Current Release

Release ID: none
Version: 0.1.0 (pre-release, unreleased)
Status: Not started (active development; personal use)
Release Manager: Owner
Last Updated: 2026-06-28

---

## Release Readiness Checklist

| Area | Status | Notes |
|------|--------|-------|
| Scope complete | N/A | iterative personal tool; no fixed release scope |
| Code review complete | N/A | solo project |
| Test strategy satisfied | Partial | 94 unit tests; no E2E |
| CI green | Local only | CI workflows are starters |
| Security review complete | N/A | no backend / no secrets / no data egress |
| Documentation updated | Yes | README + docs current as of 2026-06-28 |
| Deployment plan ready | No | not deployed; no remote/host configured |
| Rollback plan ready | N/A | static site; redeploy previous build |
| Known risks documented | Yes | RISKS.md + technical-debt.md |

---

## Known Release Risks

| ID | Risk | Level | Accepted? |
|----|------|-------|-----------|
| REL-RISK-001 | Multiway results are estimates (labeled), not exact GTO | Med | Yes (by design, honest labeling) |
| REL-RISK-002 | No deployment/host configured yet | Low | Yes (pre-release) |

---

## Release Recommendation

Recommendation: Pending (active development; not seeking a release yet)

Reason: Engine port in progress; deployment + license are open items.

---

## Approvals

| Approval | Required | Status |
|----------|----------|--------|
| Release approval | When deploying | Not started |
| Production deployment approval | When deploying | Not started |

---

## Rollback Summary

Rollback Plan Status: N/A until deployed. Static site → re-promote the previous immutable build.
