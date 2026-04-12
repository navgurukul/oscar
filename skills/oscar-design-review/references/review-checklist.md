# OSCAR Design Review Checklist

Use this checklist after reading `DESIGN.md`, `Agents.md`, and the affected files.

## 1. Brand And Visual System

- Does the work match OSCAR's cyan-and-cream editorial identity?
- Is typography consistent with the repo's established scale and tone?
- Are accent colors restrained, or has the UI drifted into a noisy palette?
- Are shadows, borders, radii, and surface treatments aligned with nearby screens?

## 2. Hierarchy And Layout

- Is there one dominant idea per screen or section?
- Is the first viewport understandable in a few seconds?
- Is spacing consistent, or are there one-off gaps and compressed regions?
- Has the design fallen into generic card grids where layout would be stronger?

## 3. Product UX

- Are primary actions obvious?
- Are loading, empty, success, and error states present and clear?
- Is mobile behavior intentional, not just compressed desktop layout?
- Are navigation patterns consistent with adjacent screens?

## 4. Accessibility And Readability

- Is text contrast strong enough on all backgrounds?
- Are tap targets and buttons large enough on mobile?
- Is body copy scannable and brief where it should be?
- Do motion and visual effects support clarity instead of distracting from it?

## 5. Consistency And Reuse

- Could an existing shared primitive or pattern have been reused?
- Are names, props, and file structure consistent with the nearest equivalent feature?
- Is similar logic duplicated across components, routes, or services?
- Is styling localized when it should be tokenized or shared?

## 6. Architecture And Maintainability

- Is business logic kept out of presentational components when possible?
- Are modules decoupled enough to scale without cross-file churn?
- Are new abstractions justified, or is the code over-engineered?
- Is validation and error handling consistent with existing service patterns?

## 7. Performance And Safety

- Did the change add unnecessary client-side work, large dependencies, or repeated fetches?
- Are long lists, expensive effects, and heavy animations kept under control?
- Are API inputs validated and server-side secrets kept on the server?
- Did the implementation accidentally introduce stale state or inconsistent local storage behavior?

## 8. Cross-Surface Review

- If the feature exists in both web and desktop, are the patterns compatible?
- If a new pattern is introduced, is it strong enough to become the new baseline?
- If not, should the change be aligned back to the current shared pattern instead?
