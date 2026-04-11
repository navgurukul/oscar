# CLAUDE.md

This repository uses a two-step UI workflow to protect design quality and repo consistency.

## UI Build Workflow

For any meaningful UI, UX, styling, layout, navigation, motion, or shared component work:

1. Read [DESIGN.md](/Users/souvikdeb/Desktop/oscar/DESIGN.md) first.
2. Read [Agents.md](/Users/souvikdeb/Desktop/oscar/Agents.md) for product and AI-system context.
3. Build with the same principles used by Codex's `frontend-skill`:
   - favor strong hierarchy over lots of components
   - avoid generic SaaS card grids unless cards are the interaction
   - keep one dominant idea per section or screen
   - preserve OSCAR's cyan-and-cream editorial identity
   - make mobile layout and first-screen clarity intentional
   - use motion sparingly and purposefully

## UI Review Workflow

After implementing UI work, review it using:

- [skills/oscar-design-review/SKILL.md](/Users/souvikdeb/Desktop/oscar/skills/oscar-design-review/SKILL.md)
- [skills/oscar-design-review/references/review-checklist.md](/Users/souvikdeb/Desktop/oscar/skills/oscar-design-review/references/review-checklist.md)

That review should check:

- visual consistency with the design system
- UX quality across loading, empty, error, and success states
- consistency across web and desktop patterns when both surfaces are affected
- shared-component reuse before introducing one-off patterns
- maintainability, duplication, and architectural drift

## Review Output Format

When reviewing changes:

- present findings first, ordered by severity
- include exact file references
- explain user impact and consistency impact
- prefer focused fixes over broad redesign advice
- explicitly say when no major issues are found, and mention residual risks
