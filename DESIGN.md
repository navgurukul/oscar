# Oscar Design System
> Inspired by Wispr Flow's editorial approach, with Oscar's cyan identity
> Version 1.0 — March 2026

---

## 1. Brand Overview

**Product:** Oscar — AI Voice Notes  
**Tagline:** "Just talk. We handle the rest."  
**Core Concept:** Voice-to-text made beautiful  
**Mission:** Transform voice notes into polished, usable text with AI

**Design Philosophy:**
- Warm, human, approachable — not clinical
- Editorial elegance meets functional SaaS
- Oscar's cyan = energy, voice, motion
- Inspired by Wispr Flow's "Voice in Motion" ethos

---

## 2. Color Palette

### Primary Colors (Oscar Identity)

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Cyan Primary** | `#06B6D4` | `187 80% 42%` | CTAs, active states, mic animation |
| **Cyan Light** | `#22D3EE` | `187 86% 60%` | Hover states, highlights |
| **Cyan Dark** | `#0891B2` | `187 90% 37%` | Pressed states, accents |
| **Cyan Subtle** | `#CFFAFE` | `187 97% 90%` | Backgrounds, tags |

### Neutral Colors (Wispr Flow Inspired)

| Name | Hex | Usage |
|------|-----|-------|
| **Cream** | `#FCFBF2` | Primary background (warm like Wispr) |
| **Warm White** | `#FDFCF0` | Secondary background |
| **Charcoal** | `#0B0B0B` | Dark text, dark mode |
| **Slate 900** | `#0F172A` | Dark backgrounds |
| **Slate 600** | `#475569` | Secondary text |
| **Slate 400** | `#94A3B8` | Muted text |
| **Slate 200** | `#E2E8F0` | Borders, dividers |
| **White** | `#FFFFFF` | Cards, surfaces |

### Accent Colors (Complementary)

| Name | Hex | Usage |
|------|-----|-------|
| **Lavender** | `#BDADFF` | Wispr Flow accent (optional secondary) |
| **Soft Teal** | `#5EEAD4` | Success states, secondary actions |
| **Rose** | `#FDA4AF` | Warnings, recording indicator |

### Dark Mode

| Element | Light | Dark |
|---------|-------|------|
| Background | `#FCFBF2` | `#0B0B0B` |
| Surface | `#FFFFFF` | `#1C1C1E` |
| Text Primary | `#0B0B0B` | `#FFFFFF` |
| Text Secondary | `#475569` | `#94A3B8` |
| Border | `#E2E8F0` | `#2D2D2D` |

---

## 3. Typography

### Font Stack

| Element | Font | Weight | Size |
|---------|------|--------|------|
| **Headlines** | Figtree (serif) → Inter (fallback) | 500-600 | 32-64px |
| **Body** | Inter | 400 | 16px |
| **UI/Labels** | Inter | 500 | 14px |
| **Mono/Code** | JetBrains Mono | 400 | 14px |
| **Caption** | Inter | 400 | 12px |

### Type Scale

```
H1: 56px / 1.1 / 600 — Hero headlines
H2: 40px / 1.2 / 500 — Section titles
H3: 24px / 1.3 / 500 — Card titles
Body: 16px / 1.6 / 400 — Paragraphs
Small: 14px / 1.5 / 400 — Secondary text
Caption: 12px / 1.4 / 400 — Labels, metadata
```

### Typography Principles
- **Figtree** for headlines — editorial warmth (load from Google Fonts)
- **Inter** for body/UI — clean, functional
- Comfortable line-heights (1.5-1.6 for body)
- Generous letter-spacing on headlines

---

## 4. UI Components

### Buttons

| Variant | Background | Text | Border | Radius |
|---------|------------|------|--------|--------|
| **Primary** | `#06B6D4` | White | None | `9999px` (pill) |
| **Primary Hover** | `#0891B2` | White | None | `9999px` |
| **Secondary** | Transparent | `#0B0B0B` | 1px `#E2E8F0` | `9999px` |
| **Ghost** | Transparent | `#475569` | None | — |
| **Danger** | `#EF4444` | White | None | `9999px` |

**Specs:**
- Height: 40px (default), 48px (large), 32px (small)
- Padding: 16px 24px
- Font: Inter 500 14px
- Transition: 150ms ease

### Cards

- Background: `#FFFFFF`
- Border: 1px `#E2E8F0`
- Border Radius: 16px
- Padding: 24px
- Shadow: `0 1px 3px rgba(0,0,0,0.1)`

**Hover:** Subtle lift with shadow increase

### Input Fields

- Height: 44px
- Background: `#FFFFFF`
- Border: 1px `#E2E8F0`
- Border Radius: 12px
- Focus: 2px ring `#06B6D4` at 30% opacity
- Padding: 12px 16px

### Recording Button (Hero Component)

- Size: 80px x 80px (mobile), 96px x 96px (desktop)
- Shape: Perfect circle
- Background: `#06B6D4` (cyan-500)
- Icon: Microphone (white, 32px)
- Animation: Pulsing ring when recording
- Shadow: Large soft shadow `0 20px 40px rgba(6,182,212,0.3)`

### Navigation

- Sticky header on scroll
- Background: `#FCFBF2` / `#0B0B0B` (dark)
- Height: 64px
- Logo left, nav center, CTA right

### Tags/Labels

- Pill shape (fully rounded)
- Background: `#CFFAFE` (cyan-100)
- Text: `#0891B2` (cyan-700)
- Padding: 4px 12px
- Font: Inter 500 12px

---

## 5. Spacing System

### Base Unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Tight spacing |
| sm | 8px | Icon gaps |
| md | 16px | Default padding |
| lg | 24px | Section gaps |
| xl | 32px | Card padding |
| 2xl | 48px | Section margins |
| 3xl | 64px | Hero spacing |

### Layout Principles
- Max content width: 1200px
- Section padding: 64px vertical
- Card gap: 24px
- Generous whitespace — "editorial feel"

---

## 6. Icons

### Icon System

| Type | Style | Source |
|------|-------|--------|
| **UI Icons** | Thin-stroke (1.5px) | Lucide React |
| **Recording** | Filled | Custom + Lucide |
| **Social** | Brand colors | Official logos |

### Key Icons Needed
- Microphone (recording)
- Stop (recording stop)
- Play (playback)
- Copy (clipboard)
- Download (export)
- Trash (delete)
- Edit (pencil)
- Settings (gear)
- Chevron (navigation)
- X (close)

---

## 7. Animations & Motion

### Transitions

| Element | Duration | Easing |
|---------|----------|--------|
| Button hover | 150ms | ease-out |
| Card hover | 200ms | ease |
| Page transitions | 300ms | ease-in-out |
| Modal open | 250ms | ease-out (scale) |

### Microinteractions

| Element | Animation |
|---------|-----------|
| **Recording Button** | Pulsing cyan ring (infinite) |
| **Success** | Checkmark draw animation |
| **Copy** | Brief scale bounce |
| **Hover states** | Subtle color shift + lift |

### Recording Animation Specs
```css
@keyframes pulse-ring {
  0% { transform: scale(1); opacity: 0.8; }
  50% { transform: scale(1.2); opacity: 0; }
  100% { transform: scale(1); opacity: 0; }
}
```
- Ring: 2px cyan stroke
- Duration: 1.5s infinite
- Scale: 1.0 → 1.4

---

## 8. Layout Structure

### Page Layout

```
┌─────────────────────────────────────────┐
│           HEADER (sticky)                │
│  [Logo]    [Features] [Pricing]  [CTA]  │
├─────────────────────────────────────────┤
│           HERO SECTION                   │
│     Centered, voice-first content       │
│     [Big Recording Button]              │
│     "Just talk. We handle the rest."    │
├─────────────────────────────────────────┤
│        FEATURE CARDS (Bento Grid)       │
│   ┌─────────┐ ┌─────────┐              │
│   │ Speak   │ │ AI      │              │
│   │ Freely  │ │ Formats │              │
│   └─────────┘ └─────────┘              │
├─────────────────────────────────────────┤
│          HOW IT WORKS                   │
│     Step by step with illustrations     │
├─────────────────────────────────────────┤
│              FOOTER                      │
└─────────────────────────────────────────┘
```

### Recording Page Layout

```
┌─────────────────────────────────────────┐
│  [← Back]          Oscar         [⚙️]  │
├─────────────────────────────────────────┤
│                                         │
│         ┌─────────────┐                 │
│         │   (🎤)    │  ← Recording   │
│         │   O       │    Button      │
│         └─────────────┘                 │
│                                         │
│           00:00:00                     │
│         Recording...                    │
│                                         │
├─────────────────────────────────────────┤
│  [Transcription appears here in        │
│   real-time, in a clean card view]     │
└─────────────────────────────────────────┘
```

### Results Page Layout

```
┌─────────────────────────────────────────┐
│  [← Back]          Results     [Copy]  │
├─────────────────────────────────────────┤
│                                         │
│  📝 Your Voice Note                     │
│  ──────────────────────────             │
│  [Formatted note content here]          │
│                                         │
├─────────────────────────────────────────┤
│  [Edit]  [Download]  [New Recording]  │
└─────────────────────────────────────────┘
```

---

## 9. Dark Mode Implementation

### Strategy
- Use CSS custom properties
- Toggle via `dark` class on `<html>`
- System preference detection

### Dark Mode Colors

```css
:root.dark {
  --background: #0B0B0B;
  --surface: #1C1C1E;
  --text-primary: #FFFFFF;
  --text-secondary: #94A3B8;
  --border: #2D2D2D;
  --accent: #06B6D4; /* Keep cyan! */
}
```

---

## 10. Component States

### Button States

| State | Primary | Secondary |
|-------|---------|-----------|
| Default | bg-cyan-500, text-white | border-slate-200 |
| Hover | bg-cyan-600 | bg-slate-50 |
| Active | bg-cyan-700 | bg-slate-100 |
| Disabled | opacity-50, cursor-not-allowed | opacity-50 |

### Input States

| State | Style |
|-------|-------|
| Default | border-slate-200 |
| Focus | ring-2 ring-cyan-500/30 |
| Error | border-red-500 |
| Disabled | bg-slate-100 |

---

## 11. Accessibility

### Requirements
- WCAG 2.1 AA compliance
- Focus visible on all interactive elements
- Minimum contrast ratio 4.5:1
- Keyboard navigation support
- Screen reader labels on icons

### Focus States
```css
:focus-visible {
  outline: 2px solid #06B6D4;
  outline-offset: 2px;
}
```

---

## 12. Implementation Checklist

### Phase 1: Core (MVP)
- [ ] Update globals.css with new color tokens
- [ ] Add Figtree + Inter fonts
- [ ] Create Button component variants
- [ ] Create Card component
- [ ] Create Input component
- [ ] Update Recording button with animation
- [ ] Implement dark mode CSS

### Phase 2: Polish
- [ ] Add spacing tokens to Tailwind config
- [ ] Create Navigation component
- [ ] Add icon library (Lucide)
- [ ] Implement page layouts
- [ ] Add microinteraction animations

### Phase 3: Features
- [ ] Bento grid for features section
- [ ] How-it-works illustrations
- [ ] Footer component
- [ ] Mobile responsive adjustments

---

## 13. AI Workflow

Use this design system together with the AI workflow below:

1. Build new UI or redesigns with `$frontend-skill` so the visual direction stays intentional and avoids generic SaaS patterns.
2. Review the result with [`skills/oscar-design-review/SKILL.md`](/Users/souvikdeb/Desktop/oscar/skills/oscar-design-review/SKILL.md) before merging major UI work.

The review should check:

- brand alignment with OSCAR's cyan-and-cream editorial system
- consistency across web and desktop patterns
- hierarchy, spacing, motion, and responsiveness
- empty, loading, error, and success states
- maintainability and shared-component reuse

---

## 14. Credits & Inspiration

- **Wispr Flow** — Primary design inspiration
  - Editorial aesthetic
  - "Voice in Motion" concept
  - Warm cream backgrounds
  - Figtree + Inter typography
  - Pill-shaped everything
  
- **Oscar's Identity**
  - Cyan (#06B6D4) as hero/brand color
  - Voice-first, not just transcription

---

*Document maintained by Light — Last updated March 2026*
