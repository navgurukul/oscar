---
name: oscar-design-review
description: Review OSCAR product changes for visual consistency, UX quality, design-system alignment, frontend architecture, and repo-wide pattern consistency. Use when updating screens, styles, layout, navigation, motion, shared UI components, or when preparing a PR and wanting a focused design/consistency review before merge.
---

# Oscar Design Review

Review OSCAR changes with two goals: protect the product's visual identity and reduce repo drift. Favor focused, high-signal findings over broad redesign advice.

## Workflow

1. Read the live repo design rules in `DESIGN.md`.
2. Read the live repo AI/product context in `Agents.md`.
3. Read the changed files first, then inspect neighboring shared patterns before judging one-off code.
4. Load `references/review-checklist.md` and use it as the review rubric.
5. If the work is a UI build or redesign, assume `$frontend-skill` should be used before this review skill.

## Review Scope

Review these areas when they are touched:

- visual system: color, type, spacing, surface treatment, motion, hierarchy
- product UX: empty states, error states, loading states, responsiveness, CTA clarity
- consistency: naming, structure, shared primitives, repeated patterns, token reuse
- architecture: duplication, overly coupled components, one-off style logic, misplaced business logic
- performance: oversized client surfaces, unnecessary rerenders, unnecessary API or data work

## Codebase Targets

Start with the affected area, then compare it against the nearest shared baseline:

- web marketing/product UI: `packages/web/app`, `packages/web/components`, `packages/web/app/globals.css`, `packages/web/styles/globals.css`
- shared UI primitives: `packages/web/components/ui`
- web services/patterns: `packages/web/lib/services`, `packages/web/lib/hooks`, `packages/web/lib/constants.ts`
- desktop UI: `packages/desktop/src/App.tsx`, `packages/desktop/src/App.css`, `packages/desktop/src/components`

If reviewing a cross-cutting change, inspect both web and desktop before declaring a new pattern valid.

## Output Rules

- Present findings first, ordered by severity.
- Include exact file references for every substantial finding.
- Explain user impact and consistency impact, not just code style preference.
- Prefer fixes that strengthen shared patterns over local patchwork.
- If no issues are found, say so explicitly and mention residual risks or unreviewed areas.

## OSCAR-Specific Rules

- Keep OSCAR's cyan-and-cream editorial identity from `DESIGN.md`.
- Prefer one dominant idea per screen or section; avoid card-heavy layouts unless cards are the interaction.
- Protect mobile legibility and first-screen hierarchy.
- Reuse shared primitives before adding new visual patterns.
- Standardize naming, validation, and service boundaries when inconsistency will spread.
- Avoid over-engineering. Recommend the smallest change that fixes the biggest issue.

## Use With Frontend Skill

For new UI work or redesigns:

1. Use `$frontend-skill` to shape the visual direction and implementation.
2. Use `$oscar-design-review` after the build to tighten hierarchy, consistency, and maintainability.

## Reference

Read `references/review-checklist.md` for the detailed rubric.
