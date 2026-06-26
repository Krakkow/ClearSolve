# Testing Lessons

This file captures reusable testing and SDET lessons.

## Testing Lesson Index

| ID | Lesson | Area | Status |
|----|--------|------|--------|
| TL-001 | | | Active |

---

## Testing Lesson Template

```markdown
## TL-000: <Lesson Title>

Status: Active | Deprecated | Superseded
Area: Unit | API | Integration | E2E | Manual | Performance | CI
Discovered During:
Related Tests:
Related Bugs:

### Context

### Lesson

### Future Testing Guidance

### Automation Impact

### Flakiness Risk

### Follow-Up
```

---

## TL-001: Prefer API Coverage Before UI Coverage When Suitable

Status: Active
Area: API / E2E
Discovered During: Infrastructure Setup
Related Tests:
Related Bugs:

### Context

The SDET strategy prioritizes stable, lower-level tests before broad UI automation.

### Lesson

Use API/integration tests for business rules and validation where possible. Use Playwright/E2E for critical user journeys.

### Future Testing Guidance

Before assigning Playwright work, SDET Lead should decide if API-level coverage is more stable and valuable.

### Automation Impact

Prevents brittle UI-heavy suites.

### Flakiness Risk

Lower.

### Follow-Up

None.
