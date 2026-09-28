---
name: validating-accessibility-ui
description: Implement or review Base do Basquete UI accessibility. Use when controls, forms, navigation, focus behavior, responsive layout, motion, or loading, error, and empty states change.
---

# Validating accessibility and UI behavior

Apply the accessibility requirements in [AGENTS.md](../../../AGENTS.md). Sienna is complementary evidence, never a replacement for semantic HTML, keyboard access, focus, contrast, or code fixes.

Read [browser-evidence-matrix.md](references/browser-evidence-matrix.md) and select the rows matching the affected interface.

## Workflow

1. List affected routes, components, user states, and viewports.
2. Prefer native semantic controls and verify accessible names, labels, instructions, and programmatic error relationships.
3. Test keyboard order, visible focus, activation, escape/close behavior, and focus restoration where applicable.
4. Verify loading, empty, error, success, incomplete, long, and extreme-data states affected by the change.
5. Check contrast, color independence, target size, reflow, zoom at 200%, mobile and desktop behavior, and reduced motion.
6. Run focal component/route tests and browser QA only for the affected flows. Record any unavailable check honestly.
7. Produce `SKILL_RESULT` from the agent contract.

Do not declare general WCAG conformance from a focal review.
