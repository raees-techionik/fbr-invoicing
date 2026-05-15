---
name: FBR Z E-Invoicing Portal
colors:
  # ── Primary brand: coral red-orange ──────────────────────────────────────
  primary: "#f05c44"
  on-primary: "#ffffff"
  primary-container: "rgba(240, 92, 68, 0.08)"
  on-primary-container: "#d14c3c"
  inverse-primary: "#c24835"
  primary-fixed: "rgba(240, 92, 68, 0.30)"
  primary-fixed-dim: "rgba(240, 92, 68, 0.18)"
  on-primary-fixed: "#f05c44"
  on-primary-fixed-variant: "#b04535"

  # ── Secondary: emerald green (Pakistan national color; used for sidebar
  #    active state and navigation highlight) ────────────────────────────────
  secondary: "#0b8a4a"
  on-secondary: "#ffffff"
  secondary-container: "rgba(18, 121, 73, 0.25)"
  on-secondary-container: "#ffffff"
  secondary-fixed: "#b4f7df"
  secondary-fixed-dim: "#0b8a4a"
  on-secondary-fixed: "#155b05"
  on-secondary-fixed-variant: "#087a3d"

  # ── Tertiary: success / submitted invoice state ───────────────────────────
  tertiary: "#28a745"
  on-tertiary: "#ffffff"
  tertiary-container: "#b4f7df"
  on-tertiary-container: "#155b05"
  tertiary-fixed: "#b4f7df"
  tertiary-fixed-dim: "#1ad497"
  on-tertiary-fixed: "#008a0b"
  on-tertiary-fixed-variant: "#006b08"

  # ── Error / failed invoice state ──────────────────────────────────────────
  error: "#dc3545"
  on-error: "#ffffff"
  error-container: "#f8d7da"
  on-error-container: "#b02a37"

  # ── Neutral surfaces — light content area ─────────────────────────────────
  surface: "#ffffff"
  surface-dim: "#f9fbfc"
  surface-bright: "#ffffff"
  surface-container-lowest: "#ffffff"
  surface-container-low: "#f9f9f9"
  surface-container: "rgba(255, 255, 255, 0.96)"
  surface-container-high: "rgba(255, 255, 255, 0.20)"
  surface-container-highest: "#f3f3f3"
  on-surface: "#333333"
  on-surface-variant: "#6c757d"
  surface-tint: "#f05c44"
  surface-variant: "#f3f3f3"

  # ── Dark sidebar: near-black navy with deep-teal undertone ────────────────
  inverse-surface: "#08131d"
  inverse-on-surface: "rgba(255, 255, 255, 0.86)"
  inverse-on-surface-muted: "rgba(255, 255, 255, 0.58)"

  # ── Outlines / dividers ───────────────────────────────────────────────────
  outline: "#ced4da"
  outline-variant: "#eaeaea"

  # ── Semantic extras ───────────────────────────────────────────────────────
  background: "#ffffff"
  on-background: "#333333"
  scrim: "rgba(0, 0, 0, 0.40)"
  shadow: "rgba(16, 24, 40, 0.16)"

typography:
  display:
    fontFamily: SF Pro
    fontSize: 32px
    fontWeight: "700"
    lineHeight: 40px
    letterSpacing: -0.02em

  headline-lg:
    fontFamily: SF Pro
    fontSize: 26px
    fontWeight: "700"
    lineHeight: 34px
    letterSpacing: -0.01em

  headline-md:
    fontFamily: SF Pro
    fontSize: 20px
    fontWeight: "700"
    lineHeight: 28px

  title-lg:
    fontFamily: SF Pro
    fontSize: 18px
    fontWeight: "500"
    lineHeight: 26px

  body-lg:
    fontFamily: SF Pro
    fontSize: 16px
    fontWeight: "400"
    lineHeight: 24px

  body-md:
    fontFamily: SF Pro
    fontSize: 15px
    fontWeight: "400"
    lineHeight: 22px

  body-sm:
    fontFamily: SF Pro
    fontSize: 14px
    fontWeight: "400"
    lineHeight: 20px

  label-lg:
    fontFamily: SF Pro
    fontSize: 15px
    fontWeight: "700"
    lineHeight: 20px

  label-md:
    fontFamily: SF Pro
    fontSize: 13px
    fontWeight: "700"
    lineHeight: 18px

  label-sm:
    fontFamily: SF Pro
    fontSize: 12px
    fontWeight: "500"
    lineHeight: 16px
    letterSpacing: 0.02em

  mono:
    fontFamily: "source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace"
    fontSize: 13px
    fontWeight: "400"
    lineHeight: 20px

rounded:
  xs: 0.25rem
  sm: 0.375rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.875rem
  full: 9999px

spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 12px
  sidebar-width: 220px
  sidebar-width-collapsed: 80px
  sidebar-padding: 12px
  content-offset: 270px
  content-padding: 24px
  card-padding: 20px
  nav-item-height: 54px
  nav-item-radius: 8px

elevation:
  0: "none"
  1: "rgba(0, 0, 0, 0.09) 0px 3px 12px"
  2: "0px 2px 8px rgba(0, 0, 0, 0.05)"
  3: "0 8px 32px 0 rgba(0, 0, 0, 0.37)"
  4: "14px 0 34px rgba(16, 24, 40, 0.16)"
  sidebar-active: "0 10px 22px rgba(8, 122, 61, 0.25)"
  primary-glow: "0px 5px 12px rgba(240, 92, 68, 0.40)"

motion:
  duration-fast: 150ms
  duration-default: 180ms
  duration-slow: 300ms
  easing-standard: ease
  easing-enter: ease-out
  easing-exit: ease-in
  easing-linear: linear

components:
  # ── Sidebar ────────────────────────────────────────────────────────────────
  sidebar:
    background: "linear-gradient(180deg, #101b24 0%, #08131d 45%, #06111a 100%)"
    backgroundAccent: "radial-gradient(circle at 40% 8%, rgba(18, 121, 73, 0.30), transparent 26%)"
    borderRight: "1px solid rgba(255, 255, 255, 0.08)"
    boxShadow: "{elevation.4}"
    width: "{spacing.sidebar-width}"
    widthCollapsed: "{spacing.sidebar-width-collapsed}"
    transition: "width {motion.duration-default} {motion.easing-standard}, transform {motion.duration-default} {motion.easing-standard}"

  sidebar-nav-item:
    textColor: "rgba(255, 255, 255, 0.86)"
    backgroundColor: transparent
    rounded: "{rounded.md}"
    height: "{spacing.nav-item-height}"
    fontSize: 15px
    fontWeight: "700"
    padding: "0 16px"

  sidebar-nav-item-hover:
    textColor: "#ffffff"
    backgroundColor: "rgba(255, 255, 255, 0.08)"

  sidebar-nav-item-active:
    textColor: "#ffffff"
    backgroundColor: "linear-gradient(135deg, #0b8a4a 0%, #087a3d 100%)"
    boxShadow: "{elevation.sidebar-active}"

  sidebar-submenu-item:
    textColor: "rgba(255, 255, 255, 0.74)"
    fontSize: 13px
    fontWeight: "700"
    height: 36px
    padding: "0 10px"
    rounded: 7px
    borderLeft: "1px solid rgba(255, 255, 255, 0.12)"

  # ── Glass cards (frosted) ──────────────────────────────────────────────────
  card-glass:
    backgroundColor: "rgba(255, 255, 255, 0.20)"
    backdropFilter: "blur(10px)"
    border: "1px solid rgba(255, 255, 255, 0.18)"
    boxShadow: "{elevation.1}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card-padding}"

  card-glass-deep:
    backgroundColor: "rgba(255, 255, 255, 0.60)"
    backdropFilter: "blur(10px)"
    border: "2px solid #f3f3f3"
    boxShadow: "rgba(255, 255, 255, 0.17) 0px -23px 25px 0px inset, rgba(255, 255, 255, 0.15) 0px -36px 30px 0px inset, rgba(255, 255, 255, 0.10) 0px -79px 40px 0px inset, rgba(202, 202, 202, 0.06) 0px 2px 1px, rgba(0, 0, 0, 0.09) 0px 4px 2px"
    rounded: "{rounded.xl}"
    padding: "{spacing.card-padding}"

  card-flat:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.outline-variant}"
    boxShadow: "{elevation.2}"
    rounded: "{rounded.lg}"
    padding: "{spacing.card-padding}"

  # ── Buttons ────────────────────────────────────────────────────────────────
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    boxShadow: "{elevation.primary-glow}"
    transition: "background {motion.duration-slow} {motion.easing-standard}"

  button-primary-hover:
    backgroundColor: "{colors.inverse-primary}"
    boxShadow: "none"

  button-outline:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    border: "1px solid {colors.primary}"
    typography: "{typography.label-lg}"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    transition: "background {motion.duration-slow} {motion.easing-standard}, color {motion.duration-slow} {motion.easing-standard}"

  button-outline-hover:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"

  button-glass:
    backgroundColor: "rgba(255, 255, 255, 0.20)"
    backdropFilter: "blur(10px)"
    textColor: "{colors.primary}"
    border: "1px solid rgba(255, 255, 255, 0.18)"
    boxShadow: "0 8px 20px 0 rgba(0, 0, 0, 0.37)"
    rounded: "{rounded.lg}"
    padding: "10px 20px"

  button-glass-hover:
    backgroundColor: "rgba(224, 224, 224, 0.20)"
    textColor: "{colors.on-primary-container}"

  button-success:
    backgroundColor: "{colors.tertiary}"
    textColor: "{colors.on-tertiary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"

  button-success-hover:
    backgroundColor: "#208537"

  # ── Inputs ─────────────────────────────────────────────────────────────────
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    border: "1px solid {colors.outline}"
    rounded: "{rounded.sm}"
    padding: "10px 12px"
    transition: "border {motion.duration-fast} {motion.easing-standard}"

  input-default-focus:
    border: "2px solid {colors.primary}"
    outline: none
    boxShadow: none

  input-glass:
    backgroundColor: "rgba(255, 255, 255, 0.20)"
    backdropFilter: "blur(10px)"
    border: "1px solid rgba(255, 255, 255, 0.18)"
    boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)"
    rounded: "{rounded.lg}"
    padding: "12px 12px 12px 40px"

  input-glass-focus:
    border: "2px solid {colors.primary}"
    backgroundColor: "rgba(255, 255, 255, 0.60)"
    rounded: "{rounded.full}"

  # ── Badges / Status pills ──────────────────────────────────────────────────
  badge-submitted:
    backgroundColor: "{colors.tertiary-container}"
    textColor: "{colors.on-tertiary-container}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "4px 12px"

  badge-failed:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.on-error-container}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "4px 12px"

  badge-draft:
    backgroundColor: "#e9ecef"
    textColor: "#6c757d"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "4px 12px"

  badge-pending:
    backgroundColor: "#fff3cd"
    textColor: "#856404"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: "4px 12px"

  # ── Search box ─────────────────────────────────────────────────────────────
  search-box:
    backgroundColor: "{colors.surface}"
    border: "1px solid {colors.outline}"
    rounded: "{rounded.lg}"
    boxShadow: "0 1px 4px rgba(0, 0, 0, 0.05)"
    padding: "4px 12px"

  search-box-focus:
    border: "2px solid {colors.primary}"
    rounded: "{rounded.sm}"

  # ── Tables ─────────────────────────────────────────────────────────────────
  table-header-cell:
    textColor: "{colors.on-surface-variant}"
    fontWeight: "600"
    backgroundColor: transparent
    borderBottom: "1px solid {colors.outline-variant}"

  table-body-cell:
    textColor: "{colors.on-surface}"
    typography: "{typography.body-sm}"
    borderBottom: "1px solid rgba(108, 117, 125, 0.375)"
    verticalAlign: middle

  # ── Loading spinner ────────────────────────────────────────────────────────
  spinner:
    size: 60px
    borderWidth: 6px
    trackColor: "#e0e0e0"
    activeColor: "{colors.primary}"
    duration: "{motion.duration-slow} linear infinite"
---

## Brand & Style

FBR Z is a Pakistani government-adjacent e-invoicing compliance portal — a tool businesses must use to submit invoices to the Federal Board of Revenue under Rule 150R. Despite the regulatory context, the design leans into a premium, modern SaaS aesthetic. The interface communicates professionalism and trustworthiness while remaining approachable.

The defining visual decision is the **dual-layer composition**: a deep near-black navy sidebar flanked by a bright, glassmorphic content canvas. This contrast is deliberate — the sidebar feels like a solid foundation (permanent navigation; authoritative), while the content area floats above it (dynamic; contextual). The result reads as confident and contemporary without feeling sterile.

## Colors

The color palette is built on three pillars:

**Coral primary (`#f05c44`)** is the brand's action color. It appears on every interactive element — buttons, focus rings, link text, icon highlights, and the loading spinner. It is warm and energetic, softening what could otherwise be a cold compliance tool. Its hover state darkens to `#d14c3c` or `#c24835` depending on context; never a flat darkening, always directional.

**Emerald green secondary (`#0b8a4a` → `#087a3d`)** owns the sidebar's active navigation state, delivered as a left-to-right gradient. This shade evokes Pakistan's flag and anchors the government-compliance context without heavy-handed iconography. The sidebar background also carries a subtle emerald radial bloom at the top-left (`rgba(18, 121, 73, 0.30)`), creating a thematic glow that ties active items to the overall atmosphere.

**Deep navy background (`#101b24` → `#08131d` → `#06111a`)** forms the sidebar shell via a three-stop vertical gradient. This is not a generic dark mode — it reads as rich and deliberate, almost branded, with near-zero chroma.

Status semantics use a traffic-light system: `#28a745` for submitted/success, `#dc3545` for failed/error, `#856404`/`#fff3cd` for pending/draft. Badge backgrounds are low-saturation tints of the status color; text carries the full saturated shade.

## Typography

The primary typeface is **SF Pro** (Apple's system font, locally hosted as OTF files in three weights: 400, 500, 700). The UI inherits Apple's characteristic optical clarity — clean geometric forms, generous tracking, and a neutral personality that lets the data lead. Inter is loaded as a secondary web font for contexts where SF Pro isn't available, and for explicit component usage in the loading screen.

The type scale is not elaborate. A three-weight palette (regular, medium, bold) handles all hierarchy needs. Bold 700 weight is applied to sidebar navigation labels and all button text — even small ones — ensuring labels never disappear against glass backgrounds. Data values in tables use regular weight at 14–15px with the monospace stack for numbers that need alignment.

## Layout & Spacing

The layout is a classic **fixed sidebar + scrollable main** pattern. The sidebar is 220px wide (collapsing to 80px icon-only mode on toggle, or sliding off-canvas on mobile). The main content area carries `margin-left: 270px` to account for the sidebar plus a small gutter; this updates responsively when the sidebar collapses or closes.

All rhythm is based on an **8px grid**. Padding inside content pages is 24px. Card inner padding is 20px. Navigation item height is a generous 54px for comfortable touch targets.

Content pages use Bootstrap's 12-column grid for horizontal layout. There is no maximum content width — the interface is designed to use the full available viewport, which suits a data-heavy compliance tool where tables and forms benefit from horizontal space.

## Elevation & Depth

Depth is communicated through three surface recipes, not a simple shadow scale:

**Level 0 — Flat:** Solid white backgrounds with a 1px `#eaeaea` border. Used for tables and inner containers where visual weight should be minimal.

**Level 1 — Ambient glass:** `rgba(255, 255, 255, 0.20)` fill, `backdrop-filter: blur(10px)`, `1px solid rgba(255, 255, 255, 0.18)` border, and a soft `rgba(0, 0, 0, 0.09) 0px 3px 12px` outer shadow. This is the primary card surface for dashboard widgets and data panels. The frosted look places the card visually above the page background without hard edges.

**Level 2 — Deep glass:** `rgba(255, 255, 255, 0.60)` fill, `backdrop-filter: blur(10px)`, `2px solid #f3f3f3` border, and a stacked multi-layer inset shadow that simulates depth inside the card itself (the shadow pushes inward from the edges). Used for form containers on the invoice and customer pages.

**Level 3 — Login glass:** `rgba(255, 255, 255, 0.20)` fill, `backdrop-filter: blur(10px)`, heavier outer shadow (`0 8px 32px 0 rgba(0, 0, 0, 0.37)`). Used only on the login screen inputs and button, creating a more dramatic frosted effect appropriate for a full-viewport hero layout.

The sidebar itself uses a directional shadow (`14px 0 34px rgba(16, 24, 40, 0.16)`) cast rightward onto the content area, physically separating the navigation layer from the content layer.

## Shapes

The shape system is **intentionally inconsistent** across the current codebase, reflecting organic growth rather than a unified decision. The design intent, extracted from the dominant patterns, is:

- **Pill badges** (`border-radius: 9999px`): All status labels (SUBMITTED, FAILED, DRAFT, PENDING) are full pills. This is non-negotiable — pills visually separate status from data-cell text.
- **Input fields** (4px–12px): Form inputs use small radii to feel structured and precise.
- **Standard buttons** (8px–12px): The main action button radius. Feels modern without being soft.
- **Glass cards** (30px): The primary dashboard card radius. Very generous — more Apple-like than typical SaaS. This softness contrasts with the strict data it contains.
- **Section headers on invoice form** (30px top radius only): A compound radius where the header curves into a form block.

When implementing new components, maintain generous radius (`rounded.xl` → 30px) for outer containers and restrained radius (`rounded.md` → 8–12px) for interactive elements inside them.

## Components

### Sidebar Navigation

The sidebar is the visual anchor of the application. Its background gradient must always flow from `#101b24` at the top to `#06111a` at the bottom, with the green radial glow confined to the upper-left quadrant. Navigation items sit on an 8px grid gap. Active items receive the emerald gradient and a green box-shadow glow — never an underline or left-border indicator, always a filled background.

Sub-items are indented under a left-border line (`1px solid rgba(255, 255, 255, 0.12)`), displayed at 13px bold, and sit at 36px height. This subordination is strong enough to be clear at a glance without requiring chevron icons at every level.

The collapse transition is 180ms `ease` — fast enough to feel snappy, slow enough to not be jarring on the sidebar width.

### Glass Cards

All metric cards, data panels, and form sections use the glass surface recipe. The frosted effect requires both a `backdrop-filter: blur(10px)` and a white-tinted background — neither alone is sufficient. The 1px white border (`rgba(255, 255, 255, 0.18)`) acts as a light-refraction highlight and must always be present; removing it makes the card look like a flat white shape rather than a glass object.

### Buttons

Primary buttons are solid coral fill. Outline buttons show coral text and border, filling to solid coral on hover. The fill-on-hover transition uses 300ms ease — slow enough that the color change feels intentional, not accidental. Ghost/glass buttons on the login screen inherit the frosted glass aesthetic.

Every button that triggers a form submission or destructive action uses the coral primary with the glow shadow (`0px 5px 12px rgba(240, 92, 68, 0.40)`). This shadow makes the button feel pressable and draws the eye to the primary action.

### Form Inputs

Standard inputs use a 1px `#ced4da` border and receive a 2px coral border on focus with no box-shadow (the design intentionally avoids the browser default blue glow). Select elements follow the same focus treatment. On the login screen, inputs use the glass recipe with a heavy outer shadow, and the focus state transitions the radius to fully rounded (`border-radius: 50px`), which is a login-screen-specific override not used elsewhere.

### Status Badges

All invoice status values are displayed as pill badges. The four states are: SUBMITTED (green tint, dark green text), UPLOAD_FAILED (red tint, dark red text), DRAFT/PENDING (warm amber tint, dark amber text), and OFFLINE (gray tint, muted text). Badge text is 12px, medium or semibold weight, with 0.02em letter spacing to keep the all-caps labels readable at small sizes.

### Loading State

The application loading screen uses a centered spinner on `#f9fbfc` — a near-white off-white that is clearly a loading state, not the app shell. The spinner is 60px, 6px border, gray track (`#e0e0e0`) with a coral active arc (`#f05c44`), animating at 1s linear. This coral spinner is the very first brand color the user sees.
