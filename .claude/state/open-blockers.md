# Open Blockers

This file tracks anything blocking planning, implementation, testing, review, release, or documentation.

---

## Current Blockers Summary

| ID | Summary | Status | Priority | Needed |
|----|---------|--------|----------|--------|
| BLK-001 | No git remote configured — cannot push | Open | Should | A repo URL (user does the push) |
| BLK-002 | License undecided (TBD) | Open | Could | Owner picks a license |

No blockers prevent active development; both are external/owner decisions.

---

## BLK-001: No git remote configured

Status: Open
Priority: Should
Owner: User

### Description
The repo has local commits on `main` but no remote, so changes cannot be pushed.

### Minimum Needed To Unblock
`git remote add origin <url> && git push -u origin main` (the owner runs the push, or provides the URL).

### Suggested Default
Create an empty GitHub repo and push `main`.

---

## BLK-002: License undecided

Status: Open
Priority: Could
Owner: User

### Description
No license chosen (README marks it TBD). Personal use for now.

### Minimum Needed To Unblock
Owner selects a license (or leaves all-rights-reserved by default).
