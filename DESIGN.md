# Oscar Design System
> Inspired by Wispr Flow editorial approach, with Oscar terracotta identity
> Version 1.2 — Jun 2026 (font table + pill geometry reconciled to shipped code)

---

## 1. Brand Overview

**Product:** Oscar — AI Voice Scribbles
**Tagline:** "Just talk. We handle the rest."  
**Core Concept:** Voice-to-text made beautiful  
**Mission:** Transform voice streams into polished, usable Scribbles with AI

**Design Philosophy:**
- Warm, human, approachable — not clinical
- Editorial elegance meets functional SaaS
- Oscar terracotta = voice warmth, editorial energy, active motion
- Inspired by Wispr Flow "Voice in Motion" ethos

---

## 2. Color Palette

### Primary Colors (Oscar Identity)

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Terracotta Primary** | `#B8623D` | `18 50% 48%` | Brand mark, CTAs, active states, mic animation |
| **Terracotta Light** | `#E8C9B8` | `19 51% 82%` | Hover states, highlights, soft fills |
| **Terracotta Dark** | `#823F24` | `17 57% 33%` | Pressed states, high-contrast accents |
| **Terracotta Subtle** | `#F7E6DD` | `21 61% 92%` | Backgrounds, tags |

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
| **Lavender** | `#BDADFF` | Wispr Flow accent (rare secondary) |
| **Soft Green** | `#4ADE80` | Success states |
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
| **Headlines** | EB Garamond (serif) | 400-700 | 32-64px |
| **Body** | Figtree | 400 | 16px |
| **UI/Labels** | Figtree | 500 | 14px |
| **Mono/Code** | IBM Plex Mono | 400 | 14px |
| **Caption** | Figtree | 400 | 12px |

> Loaded via `next/font/google` in [packages/web/app/layout.tsx](./packages/web/app/layout.tsx) (`--font-eb-garamond`, `--font-figtree`, `--font-ibm-plex-mono`); desktop mirrors them via a Google Fonts `@import` in [app-base.css](./packages/desktop/src/styles/app-base.css). Earlier drafts of this doc named Inter + JetBrains Mono — those were never shipped.

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
- **EB Garamond** (serif) for headlines — editorial warmth (loaded from Google Fonts)
- **Figtree** for body/UI — clean, functional
- **IBM Plex Mono** for code/metadata
- Comfortable line-heights (1.5-1.6 body)
- Generous letter-spacing on headlines

---

## 4. UI Components

### Buttons

| Variant | Background | Text | Border | Radius |
|---------|------------|------|--------|--------|
| **Primary** | `#B8623D` | Cream | None | `9999px` (pill) |
| **Primary Hover** | `#A25234` | Cream | None | `9999px` |
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

**Hover:** Subtle lift, shadow increase

### Input Fields

- Height: 44px
- Background: `#FFFFFF`
- Border: 1px `#E2E8F0`
- Border Radius: 12px
- Focus: 2px ring `#B8623D` at 30% opacity
- Padding: 12px 16px

### Recording Button (Hero Component)

- Size: 80×80px (mobile), 96×96px (desktop)
- Shape: Perfect circle
- Background: `#B8623D` (terracotta-500)
- Icon: Microphone (white, 32px)
- Animation: Pulsing ring when recording
- Shadow: `0 20px 40px rgba(184,98,61,0.3)`

### Desktop Dictation Pill — Edge Handle (Paper variant)

Always-visible overlay docked flush to the bottom edge of the screen. Used only by the desktop stream / dictation flow (not Scribbles or Minutes). Source: [packages/desktop/public/pill.html](./packages/desktop/public/pill.html), [packages/desktop/src-tauri/src/pill.rs](./packages/desktop/src-tauri/src/pill.rs).

**Handle (rest / ready)**:
- Rest: 72 × 5 px · radius `999px 999px 0 0` · white→`#F8FAFC` gradient · 1px border `rgba(15,23,42,.08)` · shadow `0 -1px 6px rgba(0,0,0,.35)`
- Ready: 96 × 6 px with terracotta glow `0 -2px 12px rgba(184,98,61,.32), 0 -1px 4px rgba(0,0,0,.4)`
- "Click to dictate" hint: 10px / 500 weight / `.06em` tracking · uppercase · `#B8623D`

**Hit zone**: full window width × 56 px tall, anchored to bottom. Hover enters ready state only; click starts dictation. 220 ms leave-debounce before collapse.

**Active transition**: `opacity .22s, transform .26s cubic-bezier(.2,.8,.25,1)`. `transform-origin: center bottom`. Pill ends 22 px above bottom edge while recording, processing, inserted, or error states are active.

**Full pill** (active states):
- Height: 44 px · radius 999 px · padding `0 6px 0 18px`
- Background: white → `#F8FAFC` linear gradient
- Border: 1 px `rgba(15,23,42,.08)` · shadow `0 16px 40px rgba(2,6,23,.55), 0 2px 8px rgba(2,6,23,.35), inset 0 1px 0 #fff`
- Body min-width 110 px; separated from action buttons by a 1 px × 22 px divider in `rgba(15,23,42,.08)`
- Action buttons (28 × 28 px circles, hover background `rgba(15,23,42,.05)`): Transform (sparkle) · Settings (chevron) · Note

**State bodies**:
- Idle: 13 dots, 2.5 × 2.5 px, color `rgba(15,23,42,.5)`
- Recording: 15-bar waveform, 2.5 px wide, color `#B8623D` (terracotta-500) — subtle `mm-wave` baseline drift staggered 0.06 s, with live audio levels scaling bar amplitude on top
- Processing: 13 pulse dots — animation `mm-pulse 1.1s ease-in-out infinite`, staggered 0.07 s
- Error: rose-700 (`#BE123C`) triangle glyph + "no input" label

**Inserted toast**: positioned 82 px above bottom · `#B8623D` bg · `#F7F4EE` text · padding `7px 14px` · shadow `0 8px 24px rgba(130,63,36,.35)` · 1500 ms dwell before collapse.

**Keyboard hint**: reserved for explicit expanded/teaching surfaces. It is not shown during idle hover or active dictation.

**Settings popover**: 260 px wide, radius 14 px, padded `6px`, white surface. Items at `13px / .02em`. Transform list uses the same hover/select style; selected row shows a terracotta-500 check. Toggle: 32 × 18 px pill with 14 × 14 px knob; on state uses `#B8623D`. Language opens a sub-page within the popover with a "Back" affordance.

**Window size** (Tauri `set_size` per phase, `PILL_W`/`PILL_H` in [pill.rs](./packages/desktop/src-tauri/src/pill.rs)): **140×16 px** (rest / ready — handle + hover buffer), **280×200 px** (recording / processing / downloading / inserted / copied / error / auth), **280×380 px** (settings open). Bottom edge stays flush with the primary monitor's bottom on every resize. macOS NSPanel level 1000 is re-applied after each resize so the pill floats above the Dock and fullscreen Spaces.

### Navigation

- Sticky header on scroll
- Background: `#FCFBF2` / `#0B0B0B` (dark)
- Height: 64px
- Logo left, nav center, CTA right

### Tags/Labels

- Pill shape (fully rounded)
- Background: `#F7E6DD` (terracotta-50)
- Text: `#823F24` (terracotta-700)
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
| **Recording Button** | Pulsing terracotta ring (infinite) |
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
- Ring: 2px terracotta stroke
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
- CSS custom properties
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
  --accent: #B8623D;
}
```

---

## 10. Component States

### Button States

| State | Primary | Secondary |
|-------|---------|-----------|
| Default | bg-terracotta-500, text-cream | border-cream-300 |
| Hover | bg-terracotta-600 | bg-cream-50 |
| Active | bg-terracotta-700 | bg-cream-200 |
| Disabled | opacity-50, cursor-not-allowed | opacity-50 |

### Input States

| State | Style |
|-------|-------|
| Default | border-slate-200 |
| Focus | ring-2 ring-terracotta-500/30 |
| Error | border-red-500 |
| Disabled | bg-slate-100 |

---

## 11. Accessibility

### Requirements
- WCAG 2.1 AA compliance
- Focus visible on all interactive elements
- Min contrast ratio 4.5:1
- Keyboard navigation support
- Screen reader labels on icons

### Focus States
```css
:focus-visible {
  outline: 2px solid #B8623D;
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

Use design system with AI workflow:

1. Build new UI or redesigns with `$frontend-skill` — keeps visual direction intentional, avoids generic SaaS patterns.
2. Review with [`skills/oscar-design-review/SKILL.md`](/Users/souvikdeb/Desktop/oscar/skills/oscar-design-review/SKILL.md) before merging major UI work.

Review checks:

- brand alignment with OSCAR terracotta-and-cream editorial system
- consistency across web and desktop patterns
- hierarchy, spacing, motion, responsiveness
- empty, loading, error, success states
- maintainability and shared-component reuse

---

## 14. Credits & Inspiration

- **Wispr Flow** — Primary design inspiration
  - Editorial aesthetic
  - "Voice in Motion" concept
  - Warm cream backgrounds
  - EB Garamond + Figtree typography
  - Pill-shaped everything
  
- **Oscar's Identity**
  - Terracotta (`#B8623D`) as hero/brand color
  - Voice-first, not just transcription

---

*Document maintained by Light — Last updated May 2026*
