---
name: design-system
description: >
  Enforces the Legal Contract Review Platform design system on every UI component,
  page, and style decision. Always apply this skill when writing any frontend code —
  components, layouts, pages, CSS, Tailwind classes, or inline styles. Trigger when
  the user asks to build a page, component, UI, screen, layout, or anything visual.
  Also trigger when the user says "make it look like the design", "follow the design
  system", "use our colors", or "style this properly". Never use arbitrary colors,
  spacing, or typography that are not defined here.
---

## Design System: Legal Contract Review Platform

Enterprise-grade AI contract review platform. Every UI decision must communicate:
**trust, security, professionalism, clarity, and intelligence.**

---

## Colors

### Brand

| Token | Hex | Use |
|---|---|---|
| Primary | `#112E81` | Buttons, sidebar background, toolbar, active states |
| Primary Hover | `#0E276E` | Hover on primary elements |
| Secondary | `#4647AE` | Secondary buttons, accents |
| Secondary Hover | `#3B3C96` | Hover on secondary elements |
| Accent | `#AACCD6` | Highlights, selected text, info indicators |
| Accent Light | `#D8E8ED` | Soft backgrounds, selected table rows |

### Light Theme

| Token | Hex | Use |
|---|---|---|
| Background | `#FFFFFF` | Page background |
| Background Subtle | `#F8FAFC` | Main content area, row hover |
| Surface | `#F1F5F9` | AI assistant message bubbles, cards |
| Elevated Surface | `#FFFFFF` | Cards, modals |
| Border Default | `#E2E8F0` | Card borders, dividers, chat container |
| Border Strong | `#CBD5E1` | Input borders, ghost button borders |
| Primary Text | `#0F172A` | Headings, body text |
| Secondary Text | `#475569` | Descriptions, labels |
| Muted Text | `#64748B` | Placeholders, helper text |

### Dark Theme

| Token | Hex |
|---|---|
| Background | `#0F172A` |
| Background Subtle | `#162033` |
| Surface | `#1E293B` |
| Elevated Surface | `#263449` |
| Border Default | `rgba(255,255,255,0.08)` |
| Border Strong | `rgba(255,255,255,0.15)` |
| Primary Text | `#F8FAFC` |
| Secondary Text | `#CBD5E1` |
| Muted Text | `#94A3B8` |

### Semantic

| State | Color |
|---|---|
| Success | `#16A34A` |
| Warning | `#F59E0B` |
| Error | `#DC2626` |
| Info | `#0284C7` |

### Contract Status

| Status | Color |
|---|---|
| Completed | `#16A34A` |
| Processing | `#F59E0B` |
| Failed | `#DC2626` |
| Draft | `#64748B` |

### Confidence Score

| Range | Color |
|---|---|
| 90–100% | `#16A34A` |
| 70–89% | `#84CC16` |
| 50–69% | `#F59E0B` |
| Below 50% | `#DC2626` |

---

## Typography

| Font role | Family | Use for |
|---|---|---|
| Primary | `Inter, sans-serif` | Body, inputs, labels, buttons, tables, headings |
| Monospace | `JetBrains Mono, monospace` | Contract excerpts, technical content, code |

### Scale

| Token | Size | Weight |
|---|---|---|
| Display | 32px | 700 |
| H1 | 28px | 700 |
| H2 | 24px | 600 |
| H3 | 20px | 600 |
| H4 | 18px | 600 |
| Body Large | 16px | 400 |
| Body | 14px | 400 |
| Small | 12px | 400 |

---

## Spacing

4px grid. Use only these values:

| Token | Value |
|---|---|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| 2xl | 40px |
| 3xl | 48px |

---

## Layout

Three-column dashboard layout:

```
┌──────────────────────────────────────────────┐
│  Sidebar (280px)  │  Main (flex-1)  │  Panel (340px)  │
└──────────────────────────────────────────────┘
```

| Zone | Width | Background | Notes |
|---|---|---|---|
| Sidebar | 280px | `#112E81` | Navigation, brand |
| Main Content | flex-1 | `#F8FAFC` | Primary workspace |
| Right Panel | 340px | `#FFFFFF` | AI insights, metadata, status |

---

## Components

### Buttons

| Variant | Background | Text | Border | Use for |
|---|---|---|---|---|
| Primary | `#112E81` | `#FFFFFF` | — | Upload, Process, Save, Sign In |
| Secondary | `#4647AE` | `#FFFFFF` | — | View Details, Open Chat, Export |
| Ghost | transparent | inherit | `1px solid #CBD5E1` | Cancel, Close, Back |

### Cards

- Background: `#FFFFFF`
- Border: `1px solid #E2E8F0`
- Border radius: `12px`
- Padding: `24px`

### Forms / Inputs

- Height: `44px`
- Border: `#CBD5E1`
- Focus border: `#112E81`
- Border radius: `8px`

### Contract Viewer

- Document area background: `#FFFFFF`
- Toolbar background: `#112E81`, text: `#FFFFFF`
- Selected text highlight: `#AACCD6`

### Key Term Table

Columns: Key Term · Value · Page Number · Confidence Score · Status

- Row hover: `#F8FAFC`
- Selected row: `#D8E8ED`

### Chat Interface

- User message: background `#112E81`, text `#FFFFFF`
- Assistant message: background `#F1F5F9`, text `#0F172A`
- Chat container: background `#FFFFFF`, border `#E2E8F0`

---

## Icons

- Library: **Lucide React**
- Default size: `18px`
- Stroke width: `1.5`

---

## Motion

- Duration: `150ms`
- Easing: `ease-out`
- No bounce animations
- No excessive motion
- Fast transitions only — prioritize usability

---

## Accessibility

- WCAG AA compliance
- Keyboard navigation on all interactive elements
- Visible focus states
- Minimum 4.5:1 text contrast ratio
- Screen reader compatible

---

## Rules

1. Never use colors not defined in this system
2. Never use spacing values not on the 4px grid
3. Never use fonts other than Inter and JetBrains Mono
4. Always use `#112E81` for primary actions and the sidebar
5. Always use Lucide React at 18px / stroke 1.5 for icons
6. Always use `12px` border radius on cards
7. Keep transitions at `150ms ease-out` — no bounce, no slow fades
8. High information density — this is an enterprise tool, not a marketing site
