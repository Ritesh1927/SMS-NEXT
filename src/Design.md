# DESIGN SYSTEM

> Audited from the live codebase at `SMS-FRONTEND/` (Vite + React 18 + TypeScript + Tailwind CSS 3 + shadcn/ui + Radix UI + Recharts). This document describes what is **actually implemented**, not an aspirational redesign. Values pulled directly from `tailwind.config.ts` and `src/index.css` are exact; values described from component markup (hex codes, one-off pixel radii, shadows) are marked **(derived)** where they don't route through a token yet. No code was changed to produce this document.

> **2026-09 update (sms-next, explicitly requested redesign):** the user asked for a visual pass across `sms-next` and gave explicit authority to adjust color/theme (overriding rule §35.11 below for this pass only). What changed, so this stays the reference rather than going stale:
> - **Palette refined, not replaced.** Primary/accent are still the indigo→violet family, just retuned (`--primary: hsl(243 75% 59%)`, `--accent: hsl(258 88% 67%)`); a new `--coral` token (`hsl(14 90% 60%)`) and `--info` token (`hsl(199 89% 48%)`) were added for cases that need a warm/blue accent beyond the four original semantic colors. `.dark` was rebuilt from generic shadcn grays into a real navy-indigo palette matching light mode's brand family (sms-next has no dark-mode toggle wired up yet, so this is currently dormant but ready).
> - **New shared component: `src/components/PageHeader.tsx`.** Icon chip (`.icon-chip`, a `rounded-2xl` tinted square) + title + subtitle + right-aligned actions row. Every top-level dashboard page in sms-next should use this instead of a hand-rolled `<h1>` block — it's the single biggest fix for pages that read as "plain" (Classes, Attendance, Settings, Chat, etc. all had bare text-only headers before this pass). Accent color per page follows §12's per-section sidebar wayfinding colors (blue=People, violet=Academics, amber=Communication/Attendance, emerald/coral=Finance, fuchsia=Insights, slate=Administration).
> - **`EmptyState` upgraded**: still one icon + one muted line, but the icon now sits in a soft tinted circle (`bg-primary/8`, `h-14 w-14 rounded-2xl`) instead of a bare `opacity-30` glyph floating on white — reads less like an error state, more like an intentional "nothing here yet" moment.
> - **New CSS utilities in `globals.css`**: `.shadow-premium-card`/`.shadow-premium-card-hover` (the §8 tier-2 recipe as real classes instead of inline arbitrary `shadow-[...]` values), `.card-premium`/`.card-premium-hover` (composed versions of the above), `.bg-brand-gradient`/`.text-brand-gradient` (the one brand gradient from rule §29.6, as reusable classes instead of re-typing the gradient stops per file).
> - **Everything else in this document still holds** — spacing, radius, typography, motion, component patterns are unchanged. Treat this block as an amendment, not a rewrite: when in doubt, the detailed sections below are still the source of truth for anything not called out here.

---

## 1. Design Philosophy

The product ("EduNivo" — a school management system) reads as a **premium SaaS admin panel**: light, airy neutral surfaces (`#F1F2F6`-ish background) punctuated by one confident brand gradient (indigo → violet) used sparingly for emphasis — primary actions, active nav state, stat-card icon chips, the header/sidebar-logo chrome, and hero banners.

Core traits, observed consistently across 37 pages:

- **Soft elevation over hard lines.** Most surfaces are white cards on a slightly tinted gray page background, separated by large soft shadows (`0 ... rgba(15,23,42,...)`) rather than heavy borders. Borders are thin and low-contrast (`#E2E8F0`/`#CDD3DD`-family) and are layered *with* shadows, not instead of them.
- **Rounded, never sharp.** Base radius is `1rem` (16px) and nothing in the product uses hard 0–4px corners except the smallest interactive chips (badges, table cells implicitly square).
- **One accent color family, tinted per context.** Primary brand color (indigo `#4F46E5`/`hsl(243 78% 56%)`) plus a fixed set of semantic colors (success green, warning amber, destructive red, info blue) and — only in the sidebar — a rotating per-section accent (blue/violet/cyan/emerald/amber/fuchsia/slate) used purely as low-opacity tints for wayfinding, never as saturated fills.
- **Data-forward.** Dashboards lead with stat cards and charts; tables are dense but never cramped (`h-12` header rows, `p-4` cells).
- **Restrained motion.** Transitions are short (150–300ms), used for hover lift/shadow-swap and state changes — never decorative animation for its own sake, aside from two intentionally "alive" background glows (`zoom-breathe`, blurred gradient orbs) on hero/header chrome.
- **Two typefaces, one job each.** Plus Jakarta Sans for anything that is a heading/identity/emphasis; DM Sans for everything you read as body copy; JetBrains Mono reserved for numeric/tabular values (stats, roll numbers, OTP fields).

---

## 2. Brand Identity

| Element | Value | Where |
|---|---|---|
| Product name | **EduNivo** — "School Management System" | `Login.tsx` logo lockup |
| Logo mark | `GraduationCap` (lucide) in a rounded-xl gradient chip | Sidebar header, Login page, favicon-equivalent |
| Brand gradient | `linear-gradient(135deg, #4F46E5 0%, #8B5CF6 100%)` (`.btn-gradient`, `.gradient-deep-orange`, `.gradient-warm`, `text-gradient`) | CTAs, icon chips, active states |
| Login-page gradient | `linear-gradient(135deg, #2563EB, #7C3AED)` **(derived, page-local)** | Only `Login.tsx` — slightly bluer than the app-wide brand gradient; treat as this page's own accent, not a second global brand color |
| Tagline tone | Warm, encouraging copy ("Have a productive day ahead!", motivational quote on dashboard) | Dashboard hero banner |

---

## 3. Color System

All color tokens are defined as HSL triples in `src/index.css` (`:root` / `.dark`) and consumed via Tailwind's `hsl(var(--x))` pattern in `tailwind.config.ts`. **Always reference the Tailwind class (`bg-primary`, `text-muted-foreground`, etc.), never the raw HSL.**

### Core tokens (light mode)

| Token | HSL | Approx. hex | Usage |
|---|---|---|---|
| `--background` | `222 22% 94%` | `#EDEFF4` | App shell / page background |
| `--foreground` | `222 47% 11%` | `#0F172A` | Primary text |
| `--card` | `0 0% 100%` | `#FFFFFF` | Card/surface background, inputs |
| `--card-foreground` | `222 47% 11%` | `#0F172A` | Text on cards |
| `--popover` | `0 0% 100%` | `#FFFFFF` | Dropdowns, popovers, tooltips |
| `--primary` | `243 78% 56%` | `#4F46E5` (indigo) | Primary buttons, links, active states, focus ring |
| `--primary-hover` | `245 63% 48%` | `#3F35C9` | Declared but primary hover is normally done via `hover:bg-primary/90` opacity, not this token |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` | Text/icons on primary fill |
| `--secondary` | `226 62% 93%` | `#E4E9FB` | Secondary buttons, subtle tinted backgrounds (e.g. hover pills) |
| `--secondary-foreground` | `222 47% 11%` | `#0F172A` | Text on secondary |
| `--muted` | `220 20% 91%` | `#E4E7EC` | Skeletons, disabled fills, table stripes |
| `--muted-foreground` | `215 20% 30%` | `#3D4A5C` | Secondary/help text, captions |
| `--accent` | `258 90% 66%` | `#8B5CF6` (violet) | Gradient partner to primary; hover backgrounds (`hover:bg-accent`) |
| `--accent-foreground` | `0 0% 100%` | `#FFFFFF` | Text on accent |
| `--destructive` | `0 84% 60%` | `#EF4444` | Delete actions, error states, overdue badges |
| `--destructive-foreground` | `0 0% 100%` | `#FFFFFF` | Text on destructive |
| `--success` | `142 71% 45%` | `#22C55E` | Paid/clear/positive trend states |
| `--success-foreground` | `0 0% 100%` | `#FFFFFF` | Text on success fill |
| `--warning` | `38 92% 50%` | `#F59A0A` | Pending states, license-expiry banners |
| `--warning-foreground` | `222 47% 11%` | `#0F172A` | Text on warning fill (dark, for contrast on amber) |
| `--border` / `--input` | `220 14% 83%` | `#CDD3DD` | Default borders, input borders |
| `--ring` | `243 78% 56%` | `#4F46E5` | Focus ring (matches primary) |

### Sidebar-specific tokens

| Token | HSL | Usage |
|---|---|---|
| `--sidebar-background` | `0 0% 100%` | Sidebar surface (white, light mode) |
| `--sidebar-foreground` | `215 19% 35%` | Default nav text |
| `--sidebar-primary` / `-foreground` | `243 78% 56%` / white | Reserved for primary-styled sidebar elements |
| `--sidebar-accent` / `-foreground` | `226 62% 93%` / dark | Hover background for nav rows |
| `--sidebar-active` | `226 55% 87%` | Declared token for active state (in practice `AppSidebar.tsx` uses a hardcoded `#F4F1FF` pill instead — see §12) |
| `--sidebar-border` | `220 14% 83%` | Divider between sidebar and content |
| `--sidebar-ring` | `243 78% 56%` | Focus ring inside sidebar |

### Dark mode

A full `.dark` palette exists (deep navy background `224 39% 8%`, raised card `224 32% 11%`, lightened primary `243 78% 64%`, etc.) and is wired through `next-themes`/a manual `dark` class toggle in `TopNavbar.tsx`. **The header/sidebar-logo chrome (`.premium-header`) is deliberately dark in both modes** — it's a fixed navy→indigo gradient independent of the theme toggle, so it never needs a dark-mode variant.

### Non-tokenized brand hex (used directly in markup, not as CSS vars)

These recur often enough to be de-facto tokens even though they aren't declared in `:root`. Treat them as **fixed values for this exact use**, not free-floating brand colors:

| Hex | Role |
|---|---|
| `#0F172A` | Headline / high-emphasis text on white cards (same value as `--foreground`) |
| `#475569` | Secondary text on cards (stat titles, hero subcopy) |
| `#64748B` | Tertiary/help text, icon default color |
| `#E2E8F0` / `#CDD3DD` | Card/border hairlines |
| `#F1F5F9` | Chart gridlines, subtle dividers, icon-button resting background |
| `#0F172A → #1E1B4B → #312E81` | `.premium-header` gradient stops (navy → deep indigo → violet-indigo) |

### Chart & status colors (StatCard accents, `STAT_ACCENTS` in `Index.tsx`)

| Accent | Color | Dark pair | Used for |
|---|---|---|---|
| Blue | `#3B82F6` → `#2563EB` | Students |
| Violet | `#8B5CF6` → `#7C3AED` | Teachers |
| Amber | `#F59E0B` → `#D97706` | Attendance |
| Emerald | `#10B981` → `#059669` | Fees |

### Sidebar per-section wayfinding colors **(derived — one accent per nav section, always at low opacity)**

Overview `primary`/indigo · People & My Classes `blue-500` · Academics `violet-500` · Performance `cyan-500` · Finance `emerald-500` · Communication `amber-500` · Insights `fuchsia-500` · Administration `slate-500`. Each is used only as `/8` (hover bg), `/10` (active bg — inactive rows), `/15` (icon chip), `/60` (resting icon) opacity — never full-strength fill. The **active** row overrides all of this with one fixed purple treatment (`#F4F1FF` bg / `#E7DEFF` border / `#6D5DF6` text) regardless of section, so "selected" reads as a UI state, not a category color.

### Where colors are used (quick reference)

- **Primary** — default button fill, links, focus rings, progress bars, active icon color, "View Details" card links.
- **Success/Warning/Destructive** — always as `bg-[hsl(var(--x))]/10 text-[hsl(var(--x))] border-[hsl(var(--x))]/20` triplets for status badges (fee status, attendance, license warnings) — soft-tint badges, never solid fills, except toasts/destructive buttons which use full-strength fill.
- **Muted** — every secondary/caption text line, skeleton loaders, disabled states, table header text.
- **Border** — card outlines, input outlines, table row dividers, dropdown separators.

---

## 4. Typography

Fonts loaded via Google Fonts `@import` in `index.css`, declared in `tailwind.config.ts`:

```css
font-family: {
  sans: ["DM Sans", "system-ui", "sans-serif"],       /* body */
  heading: ["Plus Jakarta Sans", "system-ui", "sans-serif"], /* headings + identity text */
  mono: ["JetBrains Mono", "monospace"],               /* stats, OTP, roll numbers */
}
```

- **Body font:** DM Sans, applied globally via `body { font-family: 'DM Sans', ... }`. Weights loaded: 400/500/600.
- **Heading font:** Plus Jakarta Sans, applied globally to all `h1–h6` (`font-heading` utility for non-heading-tag elements that should look like headings, e.g. card titles, nav labels, stat values). Weights loaded: 400/500/600/700/800; headings default to `font-bold tracking-tight`.
- **Mono font:** JetBrains Mono, via `.font-mono-stats` utility and `font-mono` class — used for roll numbers, OTP inputs, code-like values.

### Scale actually in use (no formal `text-*` overrides in `tailwind.config.ts` — this is Tailwind's default type scale, applied consistently)

| Role | Class | Size / line-height | Weight | Example |
|---|---|---|---|---|
| Page H1 | `text-2xl` (sometimes `text-[28px]`/`sm:text-[28px]` on hero) | 24px / tight | `font-bold` | "Students", dashboard greeting |
| Section H2 | `text-lg` | 18px | `font-semibold` | "Analytics Overview", "More Insights" |
| Card title | `text-2xl` (shadcn `CardTitle`) or `text-[16px]` (`DashboardSectionHeader`) | 24px / 16px | `font-semibold` | Card headers |
| Stat value | `text-[32px]` | 32px / leading-none | `font-bold` | StatCard big number |
| Body | `text-sm` | 14px | `font-normal`/`font-medium` | Table cells, descriptions, form values |
| Small / caption | `text-xs` | 12px | `font-medium`/`font-semibold` | Muted captions, badges, section labels |
| Micro | `text-[10px]`–`text-[11px]` | 10–11px | `font-semibold` | "Coming soon" pill, sidebar section labels, timestamps |
| Nav text | `text-sm` (`text-[15px]` when active) | 14–15px | `font-medium`→`font-semibold` on active | Sidebar links |
| Button text | `text-sm` | 14px | `font-medium` | All button variants |
| Labels (forms) | `text-xs font-semibold` | 12px | 600 | Auth/settings form field labels |

**Letter-spacing:** headings use `tracking-tight`; uppercase micro-labels (sidebar section labels, form section dividers) use `tracking-wide` or `tracking-[0.1em]`. Body text uses default tracking.

**Line-height:** headings `leading-none`/`leading-tight`; body defaults to Tailwind's normal leading; AI chat content explicitly sets `line-height: 1.6` for readability of longer prose.

---

## 5. Spacing System

No custom spacing scale is declared in `tailwind.config.ts` — the app uses **Tailwind's default 4px-based scale** directly, but usage converges on a small, consistent subset:

| Token | Value | Where it shows up |
|---|---|---|
| `1` (4px) | Icon-to-text micro gaps, badge internal gap | `gap-1`, `px-1` |
| `1.5` (6px) | Label-to-input gap, tight icon gaps | `space-y-1.5`, `gap-1.5` |
| `2` (8px) | Small button gaps, icon-text pairs | `gap-2`, `p-2` (sidebar group padding) |
| `2.5` (10px) | Avatar-to-text gaps in nav/header | `gap-2.5` |
| `3` (12px) | Form field stacking, filter-bar gaps | `space-y-3`, `gap-3` |
| `3.5` (14px) | Auth-form vertical rhythm | `space-y-3.5` |
| `4` (16px) | **Default grid gap**, card content padding-top removal, dialog gap | `gap-4`, `p-4` |
| `5` (20px) | Sidebar section padding, hero banner gap | `gap-5`, `py-5` |
| `6` (24px) | **Standard card padding** (`CardContent`, `CardHeader`), **page-level vertical rhythm** (`space-y-6` wraps almost every page body) | `p-6`, `space-y-6` |
| `8` (32px) | Hero banner padding on `sm:`, large button padding (`lg` button `px-8`) | `sm:p-8` |
| `12` (48px) | Empty-state vertical padding | `py-12` |

**Page-level rule:** every page body is wrapped in `<div className="space-y-6">` (sometimes `space-y-6 animate-fade-in` on the dashboard) directly inside `DashboardLayout`'s `<main className="p-6">`. This is the single most consistent spacing decision in the app — **new pages should follow it exactly**: `main` padding is fixed at `p-6` by the layout, page content stacks its own sections with `space-y-6`, and cards/tables inside use `gap-4` for grids for `gap-3` for tighter filter rows.

**Form spacing:** field groups use `space-y-1` to `space-y-1.5` (label→input), forms stack fields with `space-y-3` to `space-y-4`, multi-column forms use `grid gap-6 sm:grid-cols-2` for section pairing.

**Modal spacing:** `DialogContent` default `p-6` with `gap-4` between header/body/footer (from the shadcn primitive); larger modals (signup, ID card) override to `max-h-[90vh] overflow-y-auto`.

---

## 6. Border Radius

Base token: `--radius: 1rem` (16px), consumed as:

```css
--radius-lg: var(--radius)          /* 16px — Tailwind's `rounded-lg` */
--radius-md: calc(var(--radius) - 2px)  /* 14px — `rounded-md` */
--radius-sm: calc(var(--radius) - 4px)  /* 12px — `rounded-sm` */
```

This is **unusually large** for `rounded-md`/`rounded-sm` compared to shadcn's stock 6/4/2px scale — the whole app reads rounder than a typical admin panel as a result.

| Context | Class | Effective radius |
|---|---|---|
| Buttons | `rounded-md` | 14px |
| Inputs, selects, textareas | `rounded-md` | 14px |
| shadcn Card (default) | `rounded-lg` | 16px |
| Badges, avatars, pills | `rounded-full` | fully round |
| Dialogs | `sm:rounded-lg` | 16px |
| Dropdown/popover content | `rounded-md` | 14px |
| Custom "premium" cards (StatCard, hero banner) | `rounded-[18px]`, `rounded-2xl`/`rounded-3xl` | 18–24px **(derived, not tokenized)** |
| Sidebar container | `rounded-br-[20px]` (bottom-right only, where it meets content) | 20px **(derived)** |
| Auth-page inputs/buttons | `rounded-[14px]`, `rounded-xl` | 14–16px **(derived — happens to land near `--radius-md`)** |
| Login card | `rounded-[22px]` | 22px **(derived)** |
| Section header chip (icon badge) | `rounded-xl`/`rounded-2xl` | 16–24px |

**Radius hierarchy (small → large):** `rounded-sm` (12px, rare) → `rounded-md` (14px, controls: buttons/inputs/dropdowns) → `rounded-lg` (16px, cards/dialogs) → `rounded-xl`/`rounded-2xl` (16–24px, hero/feature surfaces and icon chips) → `rounded-full` (avatars, badges, pills, switches). Custom pixel values (`rounded-[18px]`, `rounded-[20px]`, `rounded-[22px]`) appear on bespoke "premium" surfaces (StatCard, sidebar, login card) that want to sit visually one step rounder than a plain card — **use `rounded-2xl` as the nearest token-safe equivalent when building new premium surfaces**, reserving arbitrary values only when matching an existing bespoke component exactly.

---

## 7. Borders

- **Default border color:** `--border` (`#CDD3DD`, `220 14% 83%`) — applied globally via `@layer base { * { @apply border-border; } }`, so every unstyled border in the app defaults to this color automatically.
- **Weight:** `1px` almost everywhere; occasional `2px` on decorative/active elements (switch track, sidebar active-row underline uses a filled bar, not a border).
- **Usage pattern:** borders are paired with shadows on cards (`shadow-[0_0_0_1px_rgba(...),...]`) rather than used alone — the "1px inset ring + drop shadow" combo (see §8) is the dominant elevation technique, more common than a plain `border` class on data cards.
- **Semantic borders:** status badges use `border-[hsl(var(--x))]/20` (20% opacity of the status color) around a matching 10%-opacity fill — a consistent "tinted pill" recipe used for fee status, license warnings, etc.
- **Focus "border":** inputs get `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` — a ring, not a border-color change (see §31 Accessibility).

---

## 8. Shadows & Elevation

Elevation is built from **two systems** used side by side:

**1. shadcn defaults** — `shadow-sm` (cards, buttons), `shadow-lg` (dropdown/popover content), `shadow-2xl` (dialogs). Simple, single-layer, low-contrast.

**2. Custom multi-layer "premium" shadows (derived, not tokenized)** — used on StatCard, `.glass-card`, `.hover-lift`, and the sidebar. Pattern: a 1px solid-color "ring" via `box-shadow` (substituting for a border) + a tight near shadow + a large soft ambient shadow, e.g.:

```css
box-shadow:
  0 0 0 1px rgba(15,23,42,0.07),   /* hairline ring instead of border */
  0 1px 2px rgba(15,23,42,0.04),  /* contact shadow */
  0 12px 24px -16px rgba(15,23,42,0.12); /* ambient glow */
```

On hover, all three layers intensify and the element lifts (`translateY(-2px)` to `-4px` / `hover:-translate-y-1`), e.g. `.glass-card:hover`, `.hover-lift:hover`, `StatCard`'s hover state. Transition is always `box-shadow, transform` over `0.25s–0.3s ease` (or the "premium ease" cubic-bezier below).

| Elevation | Recipe | Used on |
|---|---|---|
| Flat / resting card | `shadow-sm` or the 3-layer hairline recipe above | Table card, generic Card |
| Raised / interactive card | 3-layer recipe + `hover:-translate-y-1` and stronger shadow on hover | StatCard, dashboard chart cards |
| Header/chrome | `box-shadow: inset 0 1px 0 rgba(255,255,255,.06), 0 12px 32px -12px rgba(15,23,42,.55)` | `.premium-header` (TopNavbar, sidebar logo band) |
| Dropdown / popover | `shadow-lg` (or `shadow-md`) | Radix content panels |
| Dialog | `shadow-2xl` | Modals |
| Sidebar panel | `shadow-[6px_0_30px_-10px_rgba(79,70,229,0.16)]` — colored (indigo-tinted) ambient shadow | `Sidebar` container |
| Buttons | `shadow-sm shadow-primary/20` resting → `shadow-md shadow-primary/25` hover | Primary/destructive buttons |

**Rule going forward:** use plain `shadow-sm`/`shadow-md`/`shadow-lg` for ordinary UI chrome (dropdowns, popovers, simple cards). Reserve the 3-layer hairline+ambient recipe for **hero/stat/feature surfaces** that are meant to feel like the premium focal point of a screen — don't apply it to every card, or the "premium" surfaces stop standing out.

---

## 9. Layout System

- **Page shell:** `DashboardLayout` = fixed sidebar (via `SidebarProvider`) + a right column of `TopNavbar` (sticky, `h-16`) over `<main className="flex-1 p-6 overflow-auto">`. Every authenticated page is wrapped in this; auth pages (`Login.tsx`, `SuperAdminLogin.tsx`) render full-bleed without it.
- **Container width:** Tailwind's `container` is configured `center: true, padding: "2rem", screens: { "2xl": "1400px" }` — but in practice the app **does not use `.container`** inside the dashboard; content simply fills `<main>` edge-to-edge (minus the fixed `p-6`). The `container` utility is effectively reserved for any future full-width marketing/public page.
- **Page structure convention:** `<div className="space-y-6">` → header row (`flex items-center justify-between` with title/subtitle left, primary action button right) → filter/search row (`flex flex-col sm:flex-row gap-3`) → main content (Card+Table, or a grid of cards) → pagination row (`flex items-center justify-between`).
- **Vertical rhythm:** `space-y-6` between major page sections; `space-y-4`/`mb-4` between a section heading and its content; `space-y-1`–`space-y-1.5` inside form fields.
- **Alignment:** left-aligned text throughout (no centered body text except empty states and the 404 page); action buttons are right-aligned in header rows via `justify-between`.

**How a new page should be structured to belong:**
```
<DashboardLayout>
  <div className="space-y-6">
    <div className="flex items-center justify-between">   {/* title + primary action */}
    <div className="flex flex-col sm:flex-row gap-3">     {/* search + filters, optional */}
    <Card><CardContent className="p-0"><Table>...</Table></CardContent></Card>
       {/* or a grid of Cards/StatCards for non-tabular content */}
    <div className="flex items-center justify-between">   {/* pagination, if paginated */}
  </div>
</DashboardLayout>
```

---

## 10. Grid System

No CSS grid framework beyond Tailwind's utilities — grids are declared ad hoc per section, but the ratios repeat:

| Pattern | Class | Used for |
|---|---|---|
| Stat card row | `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4` | Dashboard KPI cards |
| Two-column charts | `grid grid-cols-1 lg:grid-cols-2 gap-4` | Attendance/Fee charts |
| Asymmetric feed + sidebar | `grid grid-cols-1 lg:grid-cols-[1.85fr_1fr] gap-5` | Recent Activity + Upcoming Events |
| Three-column insight row | `grid grid-cols-1 lg:grid-cols-3 gap-4` (with a `lg:col-span-2` item for the dominant panel) | Performance chart + Pending Fees; Upcoming Exams + Calendar |
| Form two-column | `grid gap-6 sm:grid-cols-2` | Signup dialog, longer forms |

**Rule:** grids always start `grid-cols-1` and add columns at `sm:`/`lg:` — **never** jump straight to a multi-column grid without a `grid-cols-1` mobile base. Gaps are `gap-4` by default, `gap-5`/`gap-6` for looser/feature sections, `gap-3` for tight filter bars.

---

## 11. Header

There are two "headers" in the system — keep them distinct:

**A. `TopNavbar` (app chrome, every authenticated page)**
- Height: `h-16` (64px), `sticky top-0 z-30`.
- Background: `.premium-header` — a fixed dark navy→indigo radial+linear gradient (`#0F172A → #1E1B4B → #312E81`) with `backdrop-filter: blur(18px)`, independent of light/dark theme toggle (see §3).
- Decoration: three blurred color "orb" divs (`blur-3xl`, low-opacity indigo/violet/blue circles) absolutely positioned behind content, plus a 1px gradient hairline at the bottom edge.
- Left: `SidebarTrigger` (ghost icon button, `PanelLeft` icon).
- Center (desktop only, `hidden md:flex`): global search — `h-10 rounded-2xl border border-white/10 bg-white/[0.06]` input with a `Search` icon and a `Ctrl K` `<kbd>` hint; results dropdown is a **white** card (`bg-white rounded-xl border border-[#CDD3DD] shadow-lg`) breaking from the dark header to stay legible.
- Right (in order): optional license-expiry warning pill (amber-tinted) → theme toggle (`Sun`/`Moon` ghost icon button) → notifications bell (`DropdownMenu`, red dot badge when unseen) → vertical divider (`h-8 w-px bg-white/10`) → user menu (`Avatar` + name/role + `ChevronDown`, opens white dropdown).
- All icon buttons: `h-10 w-10 rounded-full`, `text-white/70` resting → `text-white hover:bg-white/10` on hover.

**B. Sidebar logo band (top of `AppSidebar`)**
- Height: `h-16`, same `.premium-header` treatment as TopNavbar so the two visually fuse into one L-shaped chrome band.
- Content: gradient-chip logo (`GraduationCap` icon in a `btn-gradient` rounded-xl box) + school name (`font-heading`, white, truncates) + role label (`text-[11px] text-white/50`).
- Collapsed state: centers just the logo chip, hides text.

---

## 12. Sidebar

Built on shadcn's `Sidebar` primitive (`components/ui/sidebar.tsx`) with heavy app-specific styling in `AppSidebar.tsx`.

| Property | Value |
|---|---|
| Expanded width | `16rem` (256px) — `SIDEBAR_WIDTH` |
| Collapsed (icon) width | `4.5rem` (72px) — `SIDEBAR_WIDTH_ICON` |
| Mobile width | `18rem` (288px), rendered as a `Sheet` overlay below the `768px` breakpoint |
| Background | `bg-sidebar` → white (`--sidebar-background: 0 0% 100%`) |
| Border | `border-sidebar-border/70` on the right edge, plus `rounded-br-[20px]` |
| Elevation | `shadow-[6px_0_30px_-10px_rgba(79,70,229,0.16)]` — soft indigo-tinted ambient shadow, no hard border needed on top of it |
| Collapse toggle | `PanelLeft` icon in `SidebarTrigger` (TopNavbar) and/or `Ctrl/Cmd+B` keyboard shortcut |
| Persistence | State stored in a cookie (`sidebar:state`, 7-day max-age) so it survives reloads |

**Navigation structure:** items are grouped by `section` (Overview, People/My Classes, Academics, Performance, Finance, Communication, Insights, Administration) with a small-caps section label (`text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70`). Each section has one fixed accent color used only for its icon and hover state (see §3) — this is how the sidebar tells sections apart without changing shape or weight.

**Nav row anatomy:**
- Row: `h-11`, `rounded-[8px]`, `px-3` (or centered `w-11` icon-only when collapsed), `gap-3`.
- Icon: wrapped in a `h-7 w-7 rounded-[7px]` chip; icon itself `h-4 w-4` and colored by section accent (`text-{color}-500/60`) when inactive.
- **Active row:** flat pill fill `#F4F1FF`, border `#E7DEFF`, text/icon `#6D5DF6`, subtle inset highlight shadow, plus a `h-5 w-1 rounded-full` accent bar on the far left edge — this exact treatment is fixed regardless of section, so "selected" always reads the same way.
- **Hover (inactive):** `bg-{section-color}/8`, icon scales to `110%` (`group-hover:scale-110`), text goes from `text-muted-foreground` to `text-foreground`.
- **Coming-soon items:** muted (`text-muted-foreground/60`), non-interactive-feeling, with a small gradient `coming-soon-badge` pill (`Clock` icon + "Soon", 10px text) right-aligned.
- Icon sizing: `16px` (`h-4 w-4`) resting, bumps to `18px` when active (`h-[18px] w-[18px]`).

**Collapsed sidebar:** icon-only, centered (`justify-center`), all rows become `w-11` square buttons; labels and section headers hide (`opacity-0`); every row gets a `Tooltip` (right side, `delayDuration=0`) showing the label since text is gone; scrollbar is hidden entirely (`[scrollbar-width:none]`) to keep the rail clean.

**Bottom user/logout section** (`border-t border-sidebar-border/70`, `pt-4 pb-5`):
- User row: `Avatar` (gradient initials fallback) + name/role, `hover:bg-secondary/60`, rounded-xl.
- Logout button: full-width, `variant="ghost"`, but overridden to a **destructive-tinted outline style** — `border-red-200 bg-red-50 text-red-500`, darkening on hover (`hover:bg-red-100`) — the only place in the app a "ghost" button carries a permanent color instead of being neutral until hovered. This is intentional (logout should always read as a caution action, not blend in).

**Scroll behavior:** the nav item list is its own `overflow-y-auto` region between the fixed logo header and fixed user footer, so header/footer never scroll away.

---

## 13. Navigation

- **Primary nav** = the sidebar (§12). **Utility nav** = the `TopNavbar` search/notifications/profile (§11).
- **Active-route detection:** exact pathname match (`location.pathname === item.url`), with `end={item.url === "/"}` so the dashboard root doesn't stay "active" on every route.
- **Breadcrumbs:** a shadcn `breadcrumb.tsx` primitive exists but is not observed in active page use — most pages use a simple `ArrowLeft` "Back" button (ghost/icon) instead of a breadcrumb trail on detail/form pages.
- **Tabs** (secondary in-page navigation, e.g. `SettingsPage`): shadcn `Tabs` — `TabsList` is a `h-10 rounded-md bg-muted p-1` pill container; the active `TabsTrigger` gets `bg-background shadow-sm`. Tab labels always pair a small icon (`h-3.5 w-3.5`) with text via `gap-1.5`.

---

## 14. Buttons

Base: `class-variance-authority` variant system in `components/ui/button.tsx`.

| Variant | Style | Use |
|---|---|---|
| `default` | `bg-primary text-primary-foreground shadow-sm shadow-primary/20`, `hover:bg-primary/90` + stronger shadow | Primary CTA (one per view, typically top-right) |
| `destructive` | `bg-destructive`, same shadow pattern in red | Delete/remove confirmations |
| `outline` | `border border-input bg-card`, `hover:bg-accent hover:text-accent-foreground` | Secondary actions, filters, pagination |
| `secondary` | `bg-secondary`, `hover:bg-secondary/80` | Lower-emphasis actions next to a primary one |
| `ghost` | transparent, `hover:bg-accent` | Icon buttons, toolbar actions, nav triggers |
| `link` | `text-primary underline-offset-4 hover:underline` | Inline text actions |

| Size | Height | Padding | Notes |
|---|---|---|---|
| `default` | `h-10` (40px) | `px-4 py-2` | Standard |
| `sm` | `h-9` (36px) | `px-3` | Compact rows, table actions |
| `lg` | `h-11` (44px) | `px-8` | Rare — auth pages |
| `icon` | `h-10 w-10` | — | Square, icon-only |

**Shared button behavior:** `rounded-md` (14px, see §6), `text-sm font-medium`, `gap-2` for icon+label, `transition-all duration-150`, `active:scale-[0.97]` (tactile press feedback on every button in the app), `disabled:opacity-50 disabled:pointer-events-none`, `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`.

**Loading state:** no built-in spinner variant — pages manually swap children for `<Loader2 className="h-4 w-4 animate-spin mr-2" /> Verb-ing...` and set `disabled`. Follow this pattern rather than inventing a new one.

**"Premium CTA" pattern (derived, used outside the base component):** auth-page and hero CTAs use `.btn-gradient`/inline gradient (`bg-gradient-to-r from-[#2563EB] to-[#7C3AED]`) with `rounded-[14px]`/`rounded-xl`, larger height (`h-11`–`h-[54px]`), and a colored glow shadow (`shadow-[0_8px_20px_-6px_rgba(...)]`) plus `hover:-translate-y-px`. Reserve this heavier treatment for **auth/marketing-style high-stakes single CTAs** — regular in-app primary actions should stay on the plain `default` button variant.

---

## 15. Inputs & Forms

Base `Input`/`Textarea`/`Select` (shadcn): `h-10` (Input/Select) or `min-h-[80px]` (Textarea), `rounded-md` (14px), `border border-input bg-card px-3 py-2 text-sm`, placeholder in `text-muted-foreground`, focus state `ring-2 ring-ring ring-offset-2` (no border-color change — the ring *is* the focus indicator).

| State | Treatment |
|---|---|
| Default | `border-input bg-card` |
| Focus | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`, `outline-none` |
| Disabled | `disabled:cursor-not-allowed disabled:opacity-50` |
| Error | **No dedicated error-state class exists on the base Input** — validation errors are surfaced via `sonner` toasts (`toast.error(...)`), not inline field-level red borders/text. If inline field errors are needed going forward, the natural extension is `border-destructive focus-visible:ring-destructive` paired with a `text-xs text-destructive` message below the field, matching the existing destructive token — but this is not yet an established pattern in the codebase. |
| Icon-affixed | Icon absolutely positioned `left-3`/`left-4` + input gets `pl-9`/`pl-11`; toggle icons (show/hide password) use `right-3`/`right-4` |

**Form field anatomy (standard):**
```html
<div className="space-y-1.5">
  <label className="text-xs font-semibold text-foreground">Label</label>
  <Input ... />
</div>
```
Required-field asterisks and helper text are not a widely-established pattern — most validation is server-driven + toast-surfaced.

**Auth-page forms deviate intentionally**: inputs are taller (`h-11`–`h-[52px]`), more rounded (`rounded-xl`/`rounded-[14px]`), and use a 3px focus ring at brand-blue (`focus-visible:ring-[3px] focus-visible:ring-[#2563EB]/15`) instead of the default 2px `ring-ring` — this is a deliberate "the login form is the hero of the page" treatment, not an inconsistency to fix; don't carry these overrides into ordinary in-app forms.

**Select/Dropdown/Switch/Checkbox:** all follow the same `rounded-md` (14px, or `rounded-full` for Switch), `border-input`, focus-ring pattern as Input, via Radix primitives. Switch: `h-6 w-11` track, `h-5 w-5` thumb, `bg-primary` when checked.

---

## 16. Cards

**Base shadcn Card** (`components/ui/card.tsx`): `rounded-lg border bg-card text-card-foreground shadow-sm`. `CardHeader`/`CardContent` both `p-6` (Content drops top padding: `p-6 pt-0`), `CardFooter` `p-6 pt-0` with `flex items-center`. This is the workhorse for table wrappers, settings panels, form containers — **the default choice for any new card unless it needs to be a dashboard focal point**.

**"Premium" cards (StatCard, chart wrappers) — derived, richer treatment:**
- Radius: `rounded-[18px]`–`rounded-[20px]`.
- Background: plain white, no visible `border` class — elevation carries the whole "edge" via the 3-layer shadow recipe (§8).
- Padding: `p-6`.
- Hover: `-translate-y-1`, shadow intensifies, and a colored glow (`--accent-glow`, the card's own accent color at low opacity) joins the shadow stack — each StatCard's hover glow is tinted to match its own icon color.
- Internal structure is a fixed grid (`grid-rows-[48px_auto_auto_1fr_auto]`): icon+action row → title/value → trend → decoration (mini chart) → footer link, always in that order.
- Footer: `border-t border-[#F1F5F9] pt-3` — a hairline divider lighter than the standard `--border` token, used specifically to close off a card's own footer without competing with the card's outer shadow-edge.

**Chart cards** (`AttendanceChart`, `FeeChart`, etc.) wrap a `DashboardSectionHeader` (dark variant, full-bleed, no padding on the parent) directly above a white `p-6` chart body — the parent supplies `rounded-[20px] overflow-hidden` and a colored 1px border (e.g. `rgba(59,130,246,0.18)`), the header sits flush at the top with square corners (inherited via `overflow-hidden` clipping), and the chart body below it is plain white. **This header-band-over-white-body pattern is the standard for anything chart-shaped** — don't put a generic `CardHeader` above a chart; use `DashboardSectionHeader` instead.

**Card hover behavior in general:** only "premium"/interactive cards lift on hover; plain data/table-wrapper cards do not move on hover (only their *rows* do, via `hover:bg-muted/50`).

---

## 17. Tables

shadcn `Table` primitive, always wrapped in `<Card><CardContent className="p-0">...</CardContent></Card>` so the table's own borders sit flush inside the card edge.

| Part | Style |
|---|---|
| Header row | `border-b`, cells `h-12 px-4 text-left font-medium text-muted-foreground` — never bold/dark, stays visually quiet |
| Body row | `border-b`, `hover:bg-muted/50` (and `cursor-pointer` when the row navigates somewhere), `data-[state=selected]:bg-muted` |
| Cell | `p-4 align-middle` |
| Last row | `border-0` (no trailing divider) |
| Row identity | leading `Avatar` (h-9 w-9) + two-line name/subtext stack is the standard first column for people-tables (students, teachers) |
| Numeric/status cell | progress bar (`h-1.5 rounded-full bg-muted` track + colored fill) for percentages; tinted `Badge`-style span for status |
| Actions column | right-aligned (`text-right`), `flex justify-end gap-1` of `h-8 w-8` icon-ghost buttons, often ending in a `MoreHorizontal` dropdown for secondary actions (view/edit/delete) |
| Loading | skeleton rows: same row/cell structure, each cell replaced with `<div className="h-4 bg-muted rounded animate-pulse" />` |
| Empty | single full-width cell (`colSpan`), centered, `py-12`, muted icon (`h-10 w-10 opacity-30`) + `text-muted-foreground` message |

**Pagination** (outside the card, below it): left = "Showing X–Y of Z" (`text-sm text-muted-foreground`), right = `h-8 w-8` icon buttons (prev/next, `ChevronLeft`/`ChevronRight`) flanking numbered page buttons (`variant="default"` for current page, `"outline"` for others). Only rendered when `totalPages > 1`.

---

## 18. Modals & Dialogs

shadcn `Dialog` (Radix): overlay `bg-black/80`, content is centered, `max-w-lg` default, `gap-4 border bg-card p-6 shadow-2xl`, `rounded-lg` on `sm:` and above (edge-to-edge below `sm:`). Entrance/exit uses Radix's built-in `animate-in`/`animate-out` with fade + zoom-95 + slide-from-top, `duration-200`.

- **Confirm/destructive dialogs** use the dedicated `AlertDialog`-based `ConfirmDialog` component (title + description + Cancel/Confirm footer), not the generic `Dialog` — keep this distinction: `Dialog` for content/forms, `AlertDialog`/`ConfirmDialog` for yes/no confirmations.
- **Larger content dialogs** (signup form, ID card) override `sm:max-w-2xl`/`sm:max-w-md` and add `max-h-[90vh] overflow-y-auto rounded-2xl` to stay scrollable without growing past the viewport.
- **Close affordance:** a fixed top-right `X` (`h-4 w-4`, `opacity-70 hover:opacity-100`) is baked into `DialogContent` — never add a second manual close button.
- **Footer button order:** Cancel/secondary on the left (or `flex-col-reverse` stacked below on mobile), primary/confirm action on the right (`sm:justify-end sm:space-x-2`) — standard for all dialogs.

---

## 19. Dropdowns

Radix `DropdownMenu`/`Select`/`Popover` all share one visual language: `bg-popover` (white), `rounded-md` (14px), `border`, `shadow-md`/`shadow-lg`, `p-1` inner padding, items `rounded-sm px-2 py-1.5 text-sm`, hover/focus state `focus:bg-accent`. Entrance uses the same `animate-in fade-in-0 zoom-in-95` treatment as dialogs but faster context (dropdown, not modal).

- **User/notification menus** (TopNavbar) widen to `w-56`/`w-80` and group content with `DropdownMenuLabel` + `DropdownMenuSeparator`.
- **Search results panel** (TopNavbar) is a custom (non-Radix) absolutely-positioned `div`, not a `DropdownMenu` — because it needs custom multi-section grouping (Students/Teachers/Classes) and a text input trigger rather than a button. Visually it still matches the dropdown language: white, `rounded-xl`, `border-[#CDD3DD]`, `shadow-lg`.

---

## 20. Tabs

shadcn `Tabs`: `TabsList` = `inline-flex h-10 rounded-md bg-muted p-1 text-muted-foreground` (a pill-shaped segmented control, not underlined tabs). Active `TabsTrigger` = `bg-background text-foreground shadow-sm` — i.e. the active tab looks like a raised white pill inside the gray track, not an underline. `TabsContent` gets `mt-2` from its list. Used for in-page section switching (Settings: School Profile / Academic / Notifications / Security / Fees), each trigger paired with a small leading icon.

---

## 21. Badges

`components/ui/badge.tsx`: `rounded-full border px-2.5 py-0.5 text-xs font-semibold`. Variants: `default` (solid primary fill), `secondary`, `destructive` (solid), `outline` (border only, `text-foreground`).

**The dominant real-world badge is not a variant prop but a computed tinted-pill className** (e.g. `feeColor()` in `Students.tsx`): `bg-[hsl(var(--x))]/10 text-[hsl(var(--x))] border-[hsl(var(--x))]/20` — a 10%-opacity fill, full-strength text, 20%-opacity border, keyed to `--success`/`--warning`/`--destructive`/blue-500 (for "partial"). **This is the house style for status pills** — prefer it over the solid `default`/`destructive` Badge variants whenever the badge represents a data state (paid/pending/overdue) rather than a UI label (a count, a static tag).

Other small pill patterns worth reusing rather than reinventing:
- **"Coming soon"** — `coming-soon-badge` utility: gradient-filled, white text, `text-[10px]`, `Clock` icon.
- **"Live"/status dot badge** (DashboardSectionHeader) — `rounded-full` pill with a small solid dot (`h-1.5 w-1.5 rounded-full`) + label, green for "live/good."

---

## 22. Alerts & Notifications

- **Toasts** (`sonner`, global `<Toaster />`): the system-of-record for success/error feedback (`toast.success(...)`, `toast.error(...)`, and the `useToast`/shadcn toast hook for titled variants). Styled via `group-[.toaster]:bg-background group-[.toaster]:border-border group-[.toaster]:shadow-lg` — matches the app's card language, not a separate colorful toast skin. This is how **all async operation feedback** (save/delete/upload success or failure) is surfaced — never a blocking `alert()` or inline page banner for transient feedback.
- **Inline banners** (persistent, page-level warnings) use a distinct recipe: `rounded-2xl border-{color}-200 bg-{color}-50 px-5 py-4` with a leading icon, semibold headline + smaller supporting line — e.g. license-expiry warning (amber, in header) and low-license-seats warning (blue, on dashboard). Use this pattern (not a toast) for **standing/contextual warnings that should stay visible**, not just flash once.
- **Notice/announcement badges** use a `priorityIcon()` mapping: high priority → `AlertTriangle` (destructive color), medium → `Megaphone` (warning color), low/default → `Info` (primary color) — reuse this icon/color mapping anywhere priority needs a glyph.
- **shadcn `Alert` component** (`alert.tsx`, `default`/`destructive` variants) exists but is lightly used relative to toasts + custom banners — prefer the established toast/banner patterns above for new work unless building a static inline callout inside a form.

---

## 23. Calendar

`react-day-picker` (`components/ui/calendar.tsx`) for date pickers, plus a bespoke `SchoolCalendar` dashboard widget for events. Calendar-heavy views follow the same card/header conventions as everything else (`DashboardSectionHeader` on top, content below). Event entries use a leading colored dot/icon keyed to event type, consistent with the priority-icon pattern in §22.

---

## 24. Charts & Data Visualization

All charts use **Recharts**, wrapped in the header-band-over-white-body card pattern (§16/§8).

| Element | Style |
|---|---|
| Grid lines | `stroke="#F1F5F9"`, `strokeDasharray="3 3"`, vertical lines off (`vertical={false}`) |
| Axes | `stroke="#64748B"`, `fontSize={12}`, no tick lines, no axis line (`tickLine={false} axisLine={false}`) — labels float, no visible axis rule |
| Tooltip | White card: `border-1px #CDD3DD`, `rounded-xl` (12px), `fontSize 13px`, soft ambient shadow — matches the dropdown/popover language |
| Area/line fill | Brand indigo (`#4F46E5`) with a vertical gradient fading to transparent (`stopOpacity 0.22 → 0`), `strokeWidth 2.5`, active dot `r=5` white-ringed |
| Bar/mini charts (StatCard decorations) | Same accent-color family as the card itself, low opacity (`0.16`–`0.3`), staggered `transitionDelay` on hover for a subtle cascade |
| Chart height | `260px` (`ResponsiveContainer height={260}`) is the standard for a half-width dashboard chart |

**Density rule:** dashboards never show more than 2–3 charts per row (`lg:grid-cols-2` or one `lg:col-span-2` chart beside a list-style card), and every chart is paired with a plain-language header/subtitle (via `DashboardSectionHeader`) rather than relying on axis labels alone to explain what's shown.

---

## 25. Empty States

Extremely consistent pattern across the entire app (tables, chat, AI panel, fee lists, attendance lists):

```html
<div className="text-center py-12 text-muted-foreground">   <!-- py-6 for tighter contexts (dropdown lists) -->
  <Icon className="h-10 w-10 mx-auto mb-2 opacity-30" />    <!-- h-12 w-12 mb-3 in card-level empties -->
  <p className="text-sm">No {things} found.</p>
</div>
```

Rules: the icon is always the **same lucide icon that represents the entity** (e.g. `Users` for no students, `School` for no classes, `MessageSquare` for no chat), always at `opacity-30` (never full color — empty states must read as quieter than populated ones), always centered, always paired with a short literal sentence ("No X found.") rather than a marketing-style empty-state illustration or CTA. In-table empties use `py-12`; smaller list/dropdown empties use `py-6` and drop the icon.

---

## 26. Loading States

Two patterns, chosen by context:

1. **Skeleton (structure-preserving)** — `Skeleton` component (`animate-pulse rounded-md bg-muted`) shaped to match the real content: skeleton table rows/cells (matches the table's actual column count), or a full-block skeleton (`h-[280px] bg-secondary rounded-2xl animate-pulse`) standing in for a not-yet-loaded chart. **Always prefer this over a spinner when the final content has a known shape** (tables, charts, cards) — it prevents layout shift and reads as "premium," matching the rest of the app.
2. **Spinner (`Loader2` + `animate-spin`)** — reserved for **action feedback inside a button** ("Signing in...", "Verifying...", "Saving...") or brief inline waits (search-in-progress). Never used as a full-page loading state in the audited pages.

No full-page spinner/loading-screen pattern was found — even initial dashboard load uses the chart-skeleton approach while the rest of the page (hero, stat cards) renders immediately with placeholder values (`"…"`).

---

## 27. Error States

- **Field/API errors:** surfaced via `sonner` toasts (`toast.error(msg)`), with the message taken from the API response when available (`err?.response?.data?.message`) and a generic fallback otherwise. There is no inline red-text-under-field pattern in current use (see §15).
- **Page-level "no data / failed to load"** (e.g. `ParentDashboard`): `<div className="flex items-center justify-center h-64 text-destructive">{error || "No data found."}</div>` — centered, destructive-colored text, no icon, no retry button currently wired up.
- **404 (`NotFound.tsx`):** the one page that breaks from `DashboardLayout` entirely — full-viewport centered (`min-h-screen flex items-center justify-center bg-muted`), large bold "404", muted subtitle, a plain text link (not a button) back to home. This is the simplest page in the app and intentionally so — treat it as a template for other full-viewport system states (500 page, offline page) if/when they're built, keeping the same centered/minimal structure rather than importing dashboard chrome.
- **Destructive confirmation:** every delete action goes through `ConfirmDialog` (§18) before firing — never an immediate/silent delete.

---

## 28. Iconography

- **Library:** `lucide-react` exclusively — no other icon set appears anywhere in the codebase. Style is consistent (outline/stroke icons, not filled).
- **Stroke:** default lucide stroke width (2px equivalent), not customized.
- **Sizing scale (the only sizes actually used):**

| Size | Class | Context |
|---|---|---|
| 12px | `h-3 w-3` | Trend arrows, micro badges |
| 14px | `h-3.5 w-3.5` | Tab icons, footer meta icons, "back" arrows |
| 16px | `h-4 w-4` | **Default/most common** — buttons, table action icons, form field icons, nav icons (resting) |
| 18px | `h-[18px] w-[18px]` | Active sidebar nav icon (bumped from 16px), header toggle icons |
| 20px | `h-5 w-5` | Section header icons, StatCard icon (inside its own chip), dialog title icons |
| 40–48px | `h-10 w-10` / `h-12 w-12` | Empty-state icons only, always at `opacity-30` |

- **Icon spacing:** `gap-2` for icon+label in buttons/nav, `gap-1.5` for tighter inline pairs (badges, footer meta), icon-in-input offset by `left-3`/`left-4` with matching `pl-9`/`pl-11` on the input.
- **Icon color:** inherits `currentColor` by default (follows text color); the only exceptions are semantic status icons (destructive/warning/primary per §22's `priorityIcon`) and the sidebar's per-section tinted icons (§12).
- **Icon backgrounds ("chips"):** a recurring motif — icons sit inside a small rounded/gradient square (`h-7 w-7 rounded-[7px]` in sidebar rows, `h-11 w-11 rounded-xl` in section headers, `h-12 w-12 rounded-2xl` in StatCard) rather than floating bare next to text, whenever the icon is meant to be a focal point rather than a small inline glyph.

---

## 29. Animation & Motion

Declared keyframes (`tailwind.config.ts`):

| Animation | Duration/easing | Use |
|---|---|---|
| `fade-in` | `0.4s ease-out` (translateY 10px→0, opacity 0→1) | Page-level entrance (`animate-fade-in` on dashboard root) |
| `scale-in` | `0.2s ease-out` (scale 0.95→1, opacity 0→1) | Available for pop-in elements |
| `accordion-down`/`up` | `0.2s ease-out` | Radix Accordion (height auto-animate) |
| `zoom-breathe` | `6s ease-in-out infinite` (scale 1→1.06→1) | Slow ambient "alive" effect, decorative background elements only |

**Interaction transitions** (not keyframed, just `transition-*` + duration utilities):
- Standard UI transition: `transition-colors`/`transition-all duration-150`–`200ms`, `ease-in-out` or default ease — buttons, nav hover, dropdown items.
- **"Premium ease"** `cubic-bezier(0.16, 1, 0.3, 1)` at `duration-300`ms — reserved for StatCard hover (lift + shadow + icon scale) and DashboardSectionHeader hover; a slight overshoot-free deceleration curve that reads as more considered than linear/ease. Use this specific curve when adding hover motion to a new "premium" card, for consistency with existing ones — don't introduce a third easing curve.
- **Sidebar width/position transitions:** `duration-200 ease-linear` (collapse/expand, mobile slide) — deliberately linear (not eased) since it's tracking a drag-like width change, not a discrete pop.
- **Dialog/dropdown entrance:** Radix's built-in `animate-in`/`animate-out` (fade + zoom-95, `duration-200`), consistent across all overlay primitives.
- **Micro-feedback:** every button does `active:scale-[0.97]` on press (150ms) — a small, consistent "tactile" cue app-wide.

**Motion principles for new work:** keep transitions short (150–300ms), reserve the premium cubic-bezier for hover on focal/hero surfaces, never animate more than transform+opacity+shadow (no animating layout-affecting properties like width/height outside the sidebar's own collapse transition), and don't add new infinite/looping animation beyond the two existing ambient ones (`zoom-breathe`, blurred orb glows) — those are already at the app's motion budget for "decorative."

---

## 30. Responsive Design

- **Breakpoints:** Tailwind defaults (`sm 640px`, `md 768px`, `lg 1024px`, `xl 1280px`, `2xl 1400px` — the last one customized from Tailwind's default `1536px` down to `1400px` for the `container` utility only). The app's own `useIsMobile()` hook additionally defines a hard **768px** mobile threshold used by the sidebar.
- **Sidebar:** desktop (`md:` and up) = persistent, collapsible-to-icon rail. Below `768px` = fully hidden, replaced by a `Sheet` slide-over triggered from `SidebarTrigger`, `18rem` wide, no rail/icon-only intermediate state on mobile.
- **Header:** the center search bar hides below `md:` (`hidden md:flex`); the license-warning pill hides below `lg:` (`hidden lg:flex`); user name/role text and the divider hide below `sm:` (icon-only avatar remains).
- **Grids:** universally `grid-cols-1` at the base, expanding at `sm:`/`lg:` (see §10) — content **stacks to a single column by default**, never assumes multi-column space.
- **Typography scaling:** minimal fluid type — mostly fixed sizes, with a couple of explicit breakpoint swaps (`text-2xl sm:text-[28px]` on the dashboard greeting, `text-[26px] sm:text-[28px]` on the login heading).
- **Padding:** hero/login cards scale their own padding up at breakpoints (`px-6 py-6 sm:px-8 sm:py-7 lg:px-9 lg:py-7`); the dashboard `<main>` padding itself is fixed at `p-6` regardless of viewport (no responsive reduction) — acceptable because `p-6` (24px) is already modest.
- **Mobile navigation:** no bottom tab bar — the same sidebar-as-sheet pattern serves mobile nav; forms/filters stack vertically (`flex-col sm:flex-row`) rather than introducing separate mobile-only components.
- **Horizontal scrolling:** tables are the one place horizontal scroll is allowed and expected — shadcn's `Table` wraps itself in `<div className="relative w-full overflow-auto">` by default, so wide tables scroll within their card rather than breaking the page layout. Do not disable this wrapper.

**Practical rule for new pages:** design mobile-first with `grid-cols-1`/`flex-col`, add columns only at `sm:`/`lg:`, never hide *primary* content below a breakpoint (only hide secondary chrome like the header search or a warning pill), and let tables — not the page — own horizontal scrolling.

---

## 31. Accessibility

Practices observed and worth preserving in new work:

- **Focus visibility:** every interactive primitive (button, input, select, textarea, dropdown item, sidebar row) carries `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` (or the sidebar's own `ring-sidebar-ring` equivalent) — focus is always a visible ring, never suppressed. Preserve this on any new interactive element.
- **Touch targets:** icon buttons are consistently `h-8 w-8` (table row actions) to `h-10 w-10` (header/toolbar) — the smaller `h-8` size is below the ideal 44px touch target and should be treated as a desktop-density choice, not extended to mobile-only controls.
- **Labels:** form fields use explicit `<label htmlFor="...">` tied to input `id`s on auth pages (`Login.tsx`); list/table-driven pages more often rely on `placeholder` text alone for search inputs — prefer an explicit associated `<label>` (visually hidden if needed) over placeholder-only labeling for any new required field.
- **Screen-reader text:** interactive icon-only controls that have no visible label ship a `sr-only` span (e.g. `SidebarTrigger`'s "Toggle Sidebar", `DialogClose`'s "Close") — continue this for any new icon-only button.
- **Semantic structure:** `<header>` for TopNavbar, `<main>` for page content, heading tags (`h1`–`h3`) used for real hierarchy (page title → section title → card title) rather than styled `div`s — keep this hierarchy intact (don't skip heading levels for visual convenience).
- **Color contrast:** body text (`#0F172A` on white/`#EDEFF4`) and muted text (`#3D4A5C`-ish on white) both clear AA; status badges use full-strength text color over a 10%-tint background specifically to keep text contrast high while the *background* stays soft (this is why the tinted-pill badge recipe uses 10%/20% opacity rather than a mid-tone fill — a solid mid-tone badge background would risk failing contrast with white text at small sizes).
- **Tooltip usage:** tooltips supplement (collapsed sidebar labels, avatar identity on hover) rather than deliver information unavailable elsewhere — the collapsed sidebar's tooltip is the sole exception where the label genuinely only exists in the tooltip, which is acceptable since expanding the sidebar restores the always-visible label.
- **Keyboard:** sidebar toggle has a keyboard shortcut (`Ctrl/Cmd+B`); Radix primitives (Dialog, DropdownMenu, Select, Tabs) provide full keyboard nav out of the box — don't replace them with custom-built equivalents that would lose this for free.

---

## 32. Do's and Don'ts

**Do**
- Reuse `DashboardLayout` for every authenticated page; let it own `p-6` main padding and sidebar/header chrome.
- Wrap page content in `space-y-6`, grids in `gap-4` (or `gap-3` for tight filter rows), form fields in `space-y-1.5`.
- Use CSS-variable-backed Tailwind classes (`bg-primary`, `text-muted-foreground`, `border-border`) instead of hardcoded hex wherever the target color has a token.
- Use the tinted-pill recipe (`bg-[hsl(var(--x))]/10 text-[hsl(var(--x))] border-[hsl(var(--x))]/20`) for status badges.
- Use `DashboardSectionHeader` (dark variant) atop any new chart card, and the standard Card/CardContent/Table trio for any new list view.
- Match empty states to the exact icon+opacity-30+"No X found."  recipe (§25), and skeletons (not spinners) to any content with a known shape.
- Keep new hover motion on the established 150–300ms range, using the `cubic-bezier(0.16,1,0.3,1)` curve only for "premium" focal cards.
- Keep icon sizes to the six values in §28's table — don't introduce a `h-6 w-6` inline icon or similar off-scale size.

**Don't**
- Don't invent a new radius value outside `rounded-md`(14px)/`rounded-lg`(16px)/`rounded-xl`/`rounded-2xl`/`rounded-full` for standard components — only bespoke "premium" surfaces get a one-off pixel radius, and only when matching an existing sibling exactly.
- Don't apply the 3-layer hairline+ambient shadow recipe to routine cards — it's reserved for hero/stat/feature surfaces; overusing it flattens the visual hierarchy it's meant to create.
- Don't carry the auth-page's larger inputs (`h-11`+, `rounded-xl`, 3px ring) or bluer gradient (`#2563EB→#7C3AED`) into ordinary in-app forms — those are page-local, not the app-wide button/input standard.
- Don't add a full-page spinner/loading screen — the app has no such pattern; use skeletons or let the shell render immediately with placeholder values instead.
- Don't introduce a second icon library, a second accent-color system, or a fourth transition-easing curve.
- Don't put body copy in Plus Jakarta Sans or headings in DM Sans — the two fonts have fixed, non-overlapping jobs.
- Don't use `alert()`/inline-only error text for async feedback — route through `sonner` toasts, reserving a persistent colored banner only for standing/contextual warnings.

---

## 33. Implementation Guidelines

1. **Start from a token, not a hex.** Check `src/index.css`'s `:root` block and `tailwind.config.ts`'s `colors` map before writing a color; only fall back to one of the "non-tokenized brand hex" values in §3 if the exact use-case (e.g. header chrome, chart gridlines) already relies on that same hex elsewhere.
2. **Compose from existing primitives first.** Almost every visual need is already covered by `components/ui/*` (shadcn) or one of the app-specific building blocks (`StatCard`, `DashboardSectionHeader`, `ConfirmDialog`) — build new UI by composing these, not by writing new low-level styled `div`s.
3. **Match density to context.** Data-dense contexts (tables, filter bars) use `h-8`–`h-10` controls and `text-sm`/`text-xs`; hero/auth contexts use `h-11`+ controls and slightly larger type — pick based on which context you're in, not by default habit.
4. **New page checklist:** wrap in `DashboardLayout` → `space-y-6` root → header row (title + primary action) → optional filter row → content (Card+Table, or StatCard/chart grid) → optional pagination. Confirm mobile behavior by checking the page collapses to `grid-cols-1`/`flex-col` and that the sidebar's mobile Sheet still works.
5. **New status type checklist:** pick (or add) an HSL token in `:root`/`.dark`, then use the tinted-pill recipe — never introduce a bespoke solid-fill badge for a new status.
6. **Verify in both density states.** Any sidebar-adjacent or icon-heavy component should be sanity-checked in both expanded and collapsed sidebar states, since collapsed mode hides text and relies on tooltips.

---

## 34. Design Tokens

Exact values as declared in `SMS-FRONTEND/src/index.css`. Consume via Tailwind classes (`bg-primary`, not `var(--primary)` directly) inside this codebase; the raw block below is the portable reference for reuse in another project.

```css
:root {
  /* Core surfaces */
  --background: 222 22% 94%;          /* #EDEFF4 */
  --foreground: 222 47% 11%;          /* #0F172A */
  --card: 0 0% 100%;                  /* #FFFFFF */
  --card-foreground: 222 47% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;

  /* Brand */
  --primary: 243 78% 56%;             /* #4F46E5 indigo */
  --primary-hover: 245 63% 48%;
  --primary-foreground: 0 0% 100%;
  --accent: 258 90% 66%;              /* #8B5CF6 violet — gradient partner to primary */
  --accent-foreground: 0 0% 100%;

  --secondary: 226 62% 93%;           /* #E4E9FB */
  --secondary-foreground: 222 47% 11%;
  --muted: 220 20% 91%;               /* #E4E7EC */
  --muted-foreground: 215 20% 30%;    /* #3D4A5C */

  /* Semantic */
  --destructive: 0 84% 60%;           /* #EF4444 */
  --destructive-foreground: 0 0% 100%;
  --success: 142 71% 45%;             /* #22C55E */
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 50%;              /* #F59A0A */
  --warning-foreground: 222 47% 11%;

  /* Borders / focus */
  --border: 220 14% 83%;              /* #CDD3DD */
  --input: 220 14% 83%;
  --ring: 243 78% 56%;

  /* Radius */
  --radius: 1rem;                     /* 16px — rounded-lg */
                                       /* rounded-md = 14px, rounded-sm = 12px (calc from --radius) */

  /* Sidebar */
  --sidebar-background: 0 0% 100%;
  --sidebar-foreground: 215 19% 35%;
  --sidebar-primary: 243 78% 56%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 226 62% 93%;
  --sidebar-accent-foreground: 222 47% 11%;
  --sidebar-active: 226 55% 87%;
  --sidebar-border: 220 14% 83%;
  --sidebar-ring: 243 78% 56%;
}

.dark {
  --background: 224 39% 8%;
  --foreground: 210 20% 92%;
  --card: 224 32% 11%;
  --card-foreground: 210 20% 92%;
  --popover: 224 32% 11%;
  --popover-foreground: 210 20% 92%;
  --primary: 243 78% 64%;
  --primary-hover: 245 70% 56%;
  --primary-foreground: 0 0% 100%;
  --secondary: 224 26% 16%;
  --secondary-foreground: 210 20% 92%;
  --muted: 224 26% 16%;
  --muted-foreground: 215 15% 65%;
  --accent: 258 85% 70%;
  --accent-foreground: 0 0% 100%;
  --destructive: 0 72% 55%;
  --destructive-foreground: 0 0% 100%;
  --success: 142 65% 45%;
  --success-foreground: 0 0% 100%;
  --warning: 38 92% 55%;
  --warning-foreground: 222 47% 11%;
  --border: 224 22% 20%;
  --input: 224 22% 20%;
  --ring: 243 78% 64%;
  --sidebar-background: 224 32% 10%;
  --sidebar-foreground: 215 15% 75%;
  --sidebar-primary: 243 78% 64%;
  --sidebar-primary-foreground: 0 0% 100%;
  --sidebar-accent: 224 26% 16%;
  --sidebar-accent-foreground: 210 20% 92%;
  --sidebar-active: 243 40% 24%;
  --sidebar-border: 224 22% 20%;
  --sidebar-ring: 243 78% 64%;
}
```

```css
/* Typography */
--font-sans: 'DM Sans', system-ui, sans-serif;         /* body */
--font-heading: 'Plus Jakarta Sans', system-ui, sans-serif; /* h1–h6, identity/emphasis text */
--font-mono: 'JetBrains Mono', monospace;               /* stats, OTP, tabular values */

/* Spacing (Tailwind default scale — the values below are this app's recurring subset) */
--space-1: 0.25rem;   /* 4px  — micro icon/text gaps */
--space-1_5: 0.375rem;/* 6px  — label→input gap */
--space-2: 0.5rem;    /* 8px  — button internal gap, sidebar group padding */
--space-3: 0.75rem;   /* 12px — form field stacking, filter-bar gaps */
--space-4: 1rem;      /* 16px — default grid gap */
--space-5: 1.25rem;   /* 20px — sidebar section padding */
--space-6: 1.5rem;    /* 24px — card padding, page-level vertical rhythm (default) */
--space-8: 2rem;      /* 32px — hero padding at sm:, lg-button padding */
--space-12: 3rem;     /* 48px — empty-state vertical padding */

/* Radius */
--radius-lg: 1rem;                    /* 16px — cards, dialogs */
--radius-md: calc(1rem - 2px);        /* 14px — buttons, inputs, dropdowns */
--radius-sm: calc(1rem - 4px);        /* 12px — rare, small nested controls */
--radius-pill: 9999px;                /* badges, avatars, switch track */

/* Shadows */
--shadow-sm: 0 1px 2px rgba(15,23,42,0.04);                                    /* base card/button */
--shadow-md: 0 4px 6px -1px rgba(15,23,42,0.08);                               /* dropdown/popover */
--shadow-lg: 0 10px 15px -3px rgba(15,23,42,0.10);                             /* elevated dropdown */
--shadow-2xl: 0 25px 50px -12px rgba(15,23,42,0.25);                           /* dialogs */
--shadow-premium-card:
  0 0 0 1px rgba(15,23,42,0.07),
  0 1px 2px rgba(15,23,42,0.04),
  0 12px 24px -16px rgba(15,23,42,0.12);                                       /* StatCard / hero surfaces, resting */
--shadow-premium-card-hover:
  0 0 0 1px rgba(15,23,42,0.10),
  0 2px 4px rgba(15,23,42,0.06),
  0 24px 40px -20px rgba(15,23,42,0.16);                                       /* + accent-tinted glow, see §8 */

/* Motion */
--ease-standard: ease;                        /* default UI transitions */
--ease-premium: cubic-bezier(0.16, 1, 0.3, 1); /* hero/stat-card hover */
--duration-fast: 150ms;   /* button press, color transitions */
--duration-standard: 200ms; /* dropdown/dialog entrance, sidebar width */
--duration-slow: 300ms;   /* premium card hover lift */
```

---

# REUSABLE DESIGN RULES

Apply these when bringing this visual language into a **different** project (a fresh Vite/React/Tailwind app, or any other stack that can consume CSS variables + a Tailwind-like utility system). The goal is that a new project *feels* like it belongs next to this one, without literally copying this codebase's business logic.

1. **Bring the token file, not individual colors.** Copy the `:root`/`.dark` HSL block from §34 verbatim into the new project's global stylesheet, and wire your utility framework's color config to reference those CSS variables (`hsl(var(--primary))`, etc.) exactly as `tailwind.config.ts` does here — never hardcode the hex equivalents in components.
2. **Two-typeface rule, not more.** One heading font (Plus Jakarta Sans) for anything identity/emphasis, one body font (DM Sans) for everything read as prose/data, optionally one mono font for tabular/numeric values. Do not add a third "display" font for marketing sections — the existing heading font already carries that weight (700/800 available).
3. **Radius philosophy: rounder than default, but only two working radii.** Pick one base radius token (~16px here) and derive `md`/`sm` by subtracting 2–4px from it, so the whole app reads as one rounded family rather than mixing sharp and round corners. Reserve one-off larger pixel radii (`18–22px`) for a small, deliberate set of "premium" hero surfaces — not for every card.
4. **Spacing philosophy: 4px base, but converge on a short list.** Don't use the full Tailwind spacing scale freely — restrict real usage to the ~10 values in §34 (`1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 8, 12`) so vertical rhythm stays predictable. Page bodies get one fixed outer padding (from the layout shell) and one section-spacing value (`space-y-6` here) — don't let individual pages invent their own rhythm.
5. **Elevation has exactly two tiers.** Tier 1 (routine UI: cards, dropdowns, dialogs) uses single-layer utility shadows (`shadow-sm`/`md`/`lg`/`2xl`). Tier 2 (hero/stat/feature surfaces only) uses the 3-layer hairline-ring + contact-shadow + ambient-glow recipe, with a hover state that adds lift + a color-matched glow. Never give tier-1 surfaces tier-2 treatment — that's how "premium" stops reading as premium.
6. **One brand gradient, applied sparingly.** Define exactly one two-stop brand gradient (135deg, primary → accent) and reuse it for: the main CTA style, the logo/icon chip, and hero banners. Don't generate a different gradient per feature area — if you need visual variety, vary *opacity/tint* of the semantic status colors instead (see rule 8), not the brand gradient itself.
7. **Card hierarchy, not card uniformity.** Distinguish "plain data container" cards (base card component, border + `shadow-sm`, no hover motion) from "focal/premium" cards (StatCard-style: no border, rich shadow, hover lift, accent-glow) — pick which tier a new card belongs to *before* styling it, don't blend the two recipes.
8. **Status color recipe, not status color palette.** Don't invent new colors per status; take the existing semantic tokens (success/warning/destructive/info) and always express "state" as a 10%-opacity fill + full-strength text + 20%-opacity border of that one token — this single recipe is what makes every badge/pill in the app feel related even though they represent different data.
9. **Navigation accent-per-section, but one fixed "active" treatment.** If the new project also has a categorized sidebar, it's fine (and recommended) to give each nav section its own low-opacity hover/icon tint for wayfinding — but the *active/selected* row should use one single fixed color treatment across all sections, so "currently selected" always reads identically regardless of which section you're in.
10. **Two easing curves, two duration bands.** Default UI motion: `ease`/`ease-in-out`, 150–200ms. Hero/focal hover motion: one custom "premium" cubic-bezier, 250–300ms. Don't add a third curve or reach outside 150–300ms for interactive (non-decorative) motion. Ambient/decorative motion (background glows) can run longer (5–8s) but must be subtle (≤6% scale/opacity swing) and never touch layout-affecting properties.
11. **Icon system: one library, six sizes, chip-wrap when focal.** Standardize on one icon library. Restrict sizes to a small fixed scale (12/14/16/18/20px inline, 40–48px for empty states). When an icon needs to be a visual anchor (not just an inline glyph), wrap it in a small rounded/gradient chip rather than enlarging the bare icon.
12. **Responsive-by-default grids.** Every multi-column layout starts at `grid-cols-1`/`flex-col` and adds columns only at `sm:`/`lg:` breakpoints — never ship a layout that assumes desktop width as the default state. Let one component type (typically tables) own horizontal scroll; everything else reflows/stacks.
13. **Empty/loading/error states are a fixed vocabulary, not per-page decisions.** Define once: (a) empty = icon at 30% opacity + one-line muted message, centered; (b) loading = shape-matching skeleton for known-shape content, inline spinner only for button/action feedback; (c) async error = toast, persistent/contextual warning = colored inline banner. Reuse these three recipes everywhere rather than letting each page invent its own.
14. **Accessibility floor, not ceiling.** Every interactive element gets a visible focus ring by default (don't rely on `outline: none` without a replacement), icon-only controls always get accessible/`sr-only` labels, and status-communicating color is always paired with text/icon — never color alone.

---

# AI IMPLEMENTATION INSTRUCTIONS

**Before creating or modifying any UI in this project (or a new project seeded from this document), read this DESIGN.md in full first.** It is the single source of truth for this codebase's visual language — treat conflicts between "what looks plausible" and what this document specifies as won automatically by this document.

When implementing UI:

1. **Never introduce random colors.** Every color must resolve to an existing token in §3/§34 (`bg-primary`, `text-muted-foreground`, `border-destructive`, etc.) or one of the explicitly-listed non-tokenized brand hex values. If a genuinely new semantic color is needed (e.g. a new status type), add it as a proper HSL token following the existing naming convention — don't inline a new hex.
2. **Never create inconsistent spacing.** Use only the spacing values enumerated in §5/§34. Page-level rhythm is always `space-y-6` inside a `p-6` main region; don't invent a different outer rhythm per page.
3. **Never create a new radius style without justification.** Default to `rounded-md` (controls) or `rounded-lg` (cards/dialogs). A new arbitrary pixel radius is only acceptable when matching an existing bespoke "premium" surface named in §6/§16 — state which one you're matching.
4. **Reuse existing component patterns before writing new markup.** Check `components/ui/*` and the app-specific components (`StatCard`, `DashboardSectionHeader`, `ConfirmDialog`, `DashboardLayout`) first. A new table, form, dialog, badge, or empty state should be recognizable as "the same kind of thing" as the ones documented in §16–25.
5. **Follow the documented typography.** Plus Jakarta Sans for headings/identity text, DM Sans for body, JetBrains Mono only for numeric/tabular/code-like values. Don't swap these roles.
6. **Follow the documented responsive behavior.** Start every new layout mobile-first (`grid-cols-1`/`flex-col`), add columns/rows only at `sm:`/`lg:`, and never hide primary content behind a breakpoint (only secondary chrome may hide).
7. **Follow the documented animation system.** Use `ease`/150–200ms for standard interaction feedback; use the "premium" cubic-bezier at 250–300ms only for hero/focal-card hover; don't add new looping/decorative animation beyond what's already documented in §29.
8. **Maintain visual consistency across pages.** A new page should be structurally indistinguishable in *rhythm and hierarchy* from the ones audited here (§9's page-structure template), even if its content is entirely new.
9. **Prefer existing components over creating duplicates.** Before writing a new Card/Badge/Modal/EmptyState/Skeleton variant, confirm one doesn't already cover the need — extend via `className`/props rather than forking.
10. **When uncertain, follow the closest existing component pattern**, and note in your response which existing pattern you matched (e.g. "styled this new stat tile after `StatCard`," "used the tinted-pill badge recipe from `feeColor()`").
11. **Do not redesign the established visual language unless explicitly requested.** This document describes what exists; treat any perceived "improvement" to color, spacing, radius, or motion as out of scope unless the user asks for a redesign by name.
