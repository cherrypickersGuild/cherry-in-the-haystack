# cherry-in-the-haystack UX Design Specification

_Updated on 2026-04-04 by HK (based on actual web frontend implementation)_
_Original: 2026-02-28_

---

## Executive Summary

**Cherry for AI Engineers** is a living, community-driven knowledge base for LLM practitioners. It solves the fragmented, rapidly-changing LLM knowledge problem by providing a single curated source of truth with personalized intelligence.

**Vision:** "Orientation in chaos through collective intelligence that compounds — personalized to your needs."

**Target Users:**

- **Free Tier:** AI engineers and builders who need to stay current with LLM developments — zero friction, no account required to read
- **Paid Tier:** Practitioners who want signal-to-noise control — personalized feeds, custom sources, natural language scoring criteria
- **Enterprise Tier:** Marketing/content teams who turn curated sources into polished newsletters (Newsletter Studio)

**Core Experience:** Navigate structured knowledge → read a concept or news page → close the tab feeling _caught up and FOMO-free_

**Emotional Goals:** Oriented · Sharp · Confident · In Control · FOMO-free

**Platform:** Mobile-first (commute consumption), desktop-optimized for deep work sessions

**Design Inspiration:** Clean, modern light-mode aesthetic with sophisticated component system

**UX Principle:** Users should _navigate_ Cherry like a map, not _scroll_ it like a feed.

---

## 1. Design System Foundation

### 1.1 Design System Choice

**Selected:** shadcn/ui (New York style) + Tailwind CSS

**Rationale:** Cherry needed a production-ready design system with full ownership. shadcn/ui provides composable components copied directly into the project — no black-box dependency. Radix UI primitives underneath give accessibility for free (keyboard nav, ARIA, focus management). Tailwind CSS enables mobile-first responsive design with minimal overhead.

**What it provides:**

- Full component library: 50+ components including buttons, forms, dialogs, cards, navigation, dropdowns, toasts, tables
- Accessible by default (WCAG 2.1 AA compliant primitives)
- Light/dark mode theming with CSS variables
- Responsive utilities via Tailwind
- New York style configuration for modern aesthetic

**Custom components implemented:**

- Tree-stem sidebar navigation with curved branches
- Interactive treemap visualization
- News cards with star ratings
- Mobile sheet-based navigation
- Page header component
- Handbook placeholder pages
- Patch notes timeline
- Concept pages (frameworks, model updates, case studies)

### 1.2 Theme System

**Theme Provider:** Uses `next-themes` for seamless theme switching

**Supported Themes:**
- Light mode (default)
- Dark mode (via `.dark` class)

**Color Format:** OKLCH color space for better color management and perceptual uniformity

---

## 2. Visual Foundation

### 2.1 Color System

**Selected Theme:** Light mode default with cherry brand accents

**Color Tokens (Light Mode):**

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | `#F7F6F9` | App background (light cream) |
| `--foreground` | `#1A1626` | Primary text (deep purple) |
| `--card` | `#FFFFFF` | Card background (white) |
| `--card-foreground` | `#1A1626` | Card text |
| `--popover` | `#FFFFFF` | Popover/dropdown background |
| `--popover-foreground` | `#1A1626` | Popover text |
| `--border` | `#E4E1EE` | All borders and dividers |
| `--input` | `#E4E1EE` | Input field borders |

**Semantic Colors:**

| Token | Value | Usage |
|-------|-------|-------|
| `--primary` | `#C94B6E` | Primary brand color (cherry) |
| `--primary-foreground` | `#FFFFFF` | Text on primary background |
| `--secondary` | `#F2F0F7` | Secondary background (light purple-gray) |
| `--secondary-foreground` | `#1A1626` | Text on secondary |
| `--muted` | `#F2F0F7` | Muted background |
| `--muted-foreground` | `#9E97B3` | Muted text (soft purple) |
| `--accent` | `#FDF0F3` | Accent background (cherry soft) |
| `--accent-foreground` | `#C94B6E` | Text on accent |

**Functional Colors:**

| Token | Value | Usage |
|-------|-------|-------|
| `--destructive` | `#C94B6E` | Error/danger states |
| `--destructive-foreground` | `#FFFFFF` | Text on destructive |
| `--success` | `#2D7A5E` | Success states (green) |
| `--success-soft` | `#EFF7F3` | Success background |
| `--ring` | `#C94B6E` | Focus ring (cherry) |

**Brand Tokens:**

| Token | Value | Usage |
|-------|-------|-------|
| `--cherry` | `#C94B6E` | Primary cherry brand |
| `--cherry-soft` | `#FDF0F3` | Cherry with opacity |
| `--cherry-border` | `#F2C4CE` | Light cherry border |
| `--violet` | `#7B5EA7` | Secondary brand color |
| `--violet-soft` | `#F3EFFA` | Violet with opacity |
| `--violet-border` | `#C7B8E8` | Light violet border |

**Text Hierarchy:**

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#1A1626` | Main headings |
| `--text-secondary` | `#6B6480` | Secondary headings |
| `--text-body` | `#3D3652` | Body text |
| `--text-muted` | `#9E97B3` | Disabled/placeholder |

**Chart Colors:**

| Token | Value | Usage |
|-------|-------|-------|
| `--chart-1` | `#C94B6E` | Cherry (primary) |
| `--chart-2` | `#7B5EA7` | Violet (secondary) |
| `--chart-3` | `#2D7A5E` | Green (tertiary) |
| `--chart-4` | `#D4854A` | Amber (quaternary) |
| `--chart-5` | `#4A90D9` | Blue (quinary) |

**Sidebar Specific:**

| Token | Value | Usage |
|-------|-------|-------|
| `--sidebar` | `#FFFFFF` | Sidebar background |
| `--sidebar-foreground` | `#6B6480` | Sidebar text |
| `--sidebar-primary` | `#C94B6E` | Sidebar active |
| `--sidebar-primary-foreground` | `#FFFFFF` | Text on sidebar active |
| `--sidebar-accent` | `#F2F0F7` | Sidebar hover |
| `--sidebar-accent-foreground` | `#1A1626` | Text on sidebar hover |
| `--sidebar-border` | `#E4E1EE` | Sidebar border |
| `--sidebar-ring` | `#C94B6E` | Sidebar focus ring |

### 2.2 Typography

**Font Stack:**

| Role | Font | Usage |
|------|------|-------|
| **Primary** | `'Geist', 'Inter', sans-serif` | UI elements, body text |
| **Display** | `'Plus Jakarta Sans', sans-serif` | Headings, emphasis |
| **Monospace** | `'Geist Mono', monospace` | Code, technical content |
| **Legacy** | `'Inter', sans-serif` | Fallback support |

**Type Scale:**

| Role | Size | Weight | Line-height |
|------|------|--------|-------------|
| **h1 (Page title - mobile)** | `20px` | 800 (extrabold) | none |
| **h1 (Page title - desktop)** | `30px` | 800 (extrabold) | none |
| **h2 (Section)** | `17px` | 600-700 (semibol/bold) | snug |
| **h3 (Card title)** | `16px` | 700 (bold) | snug |
| **Body** | `14px` | 400 (regular) | relaxed (1.6) |
| **Small** | `13px` | 400 (regular) | relaxed |
| **Meta/Label** | `11px` | 700 (bold) | - |
| **Badge text** | `11px` | 700 (bold) | +0.6px letter-spacing (uppercase) |
| **Tiny label** | `10px` | 400 (regular) | - |

**CSS Variables:**

```css
--font-sans: 'Geist', 'Inter', sans-serif;
--font-mono: 'Geist Mono', monospace;
--font-rounded: 'Plus Jakarta Sans', sans-serif;
--font-inter: 'Inter', sans-serif;
```

**Typography Classes:**

```tsx
/* Page Header */
<h1 className="font-extrabold text-[#1A1626] leading-none mb-2.5 text-[20px] lg:text-[30px]">

/* Subtitle */
<p className="text-[13px] lg:text-[15px] text-text-muted leading-relaxed">

/* News Card Title */
<h3 className="text-[16px] font-bold text-[#1A1626] leading-snug mb-2">

/* News Summary */
<p className="text-[14px] text-text-body leading-relaxed mb-3">

/* Badge Text */
<span className="text-[11px] font-bold uppercase tracking-[0.6px] px-2.5 py-1 rounded-full">
```

### 2.3 Spacing & Layout

**Base unit:** 4px grid (Tailwind default)

**Spacing Scale:**

| Token | Value | Usage |
|-------|-------|-------|
| `tiny` | `0.25rem` (4px) | Micro spacing |
| `small` | `0.5rem` (8px) | Compact spacing |
| `medium` | `1rem` (16px) | Default spacing |
| `large` | `1.5rem` (24px) | Comfortable spacing |
| `xl` | `2rem` (32px) | Generous spacing |
| `xxl` | `3rem` (48px) | Section spacing |

**Border Radius:**

| Token | Value | Usage |
|-------|-------|-------|
| Default | `0.75rem` (12px) | Cards, buttons |
| Small | `calc(var(--radius) - 4px)` | Small elements |
| Medium | `calc(var(--radius) - 2px)` | Medium elements |
| Large | `var(--radius)` | Large elements |
| XL | `calc(var(--radius) + 4px)` | Extra large elements |

**Layout Grid:**

| Breakpoint | Range | Container | Gutters |
|------------|-------|-----------|---------|
| Mobile | `0 - 1023px` | Full width | `16px` (px-4) |
| Desktop (lg) | `≥ 1024px` | Max `1440px` | `40px` (lg:px-10) |
| Wide | `≥ 1440px` | Max `1440px` centered | `40px` |

**Sidebar Width:** `240px` (hidden on mobile)

---

## 3. Component Library

### 3.1 Shadcn/ui Components (50+)

**Navigation:**
- `navigation-menu.tsx` - Horizontal navigation
- `breadcrumb.tsx` - Breadcrumb trails
- `tabs.tsx` - Tabbed content
- `separator.tsx` - Visual dividers

**Overlays:**
- `dialog.tsx` - Modal dialogs
- `sheet.tsx` - Side sheets (mobile drawer)
- `drawer.tsx` - Drawer component
- `popover.tsx` - Hover/popover content
- `dropdown-menu.tsx` - Dropdown menus
- `context-menu.tsx` - Right-click menus
- `alert-dialog.tsx` - Alert confirmations
- `hover-card.tsx` - Hover info cards

**Feedback:**
- `alert.tsx` - Alert banners
- `toast.tsx` + `toaster.tsx` - Toast notifications
- `sonner.tsx` - Alternative toast system
- `skeleton.tsx` - Loading placeholders
- `progress.tsx` - Progress bars
- `spinner.tsx` - Loading spinners

**Form Elements:**
- `button.tsx` + `button-group.tsx` - Buttons
- `input.tsx` + `input-group.tsx` + `textarea.tsx` - Text inputs
- `select.tsx` - Dropdown selects
- `checkbox.tsx` - Checkboxes
- `radio-group.tsx` - Radio buttons
- `switch.tsx` - Toggle switches
- `slider.tsx` - Range sliders
- `calendar.tsx` - Date picker
- `input-otp.tsx` - OTP input
- `form.tsx` - Form wrapper (react-hook-form + zod)
- `field.tsx` - Form field wrapper
- `label.tsx` - Form labels

**Data Display:**
- `card.tsx` - Card containers
- `badge.tsx` - Status badges
- `avatar.tsx` - User avatars
- `table.tsx` - Data tables
- `empty.tsx` - Empty states
- `item.tsx` - List items
- `pagination.tsx` - Pagination controls

**Advanced:**
- `command.tsx` - Command palette (cmdk)
- `collapsible.tsx` - Collapsible sections
- `accordion.tsx` - Accordion lists
- `resizable.tsx` - Resizable panels
- `scroll-area.tsx` - Custom scrollbars
- `carousel.tsx` - Image carousels
- `chart.tsx` - Charts (recharts)
- `aspect-ratio.tsx` - Aspect ratio containers
- `toggle.tsx` + `toggle-group.tsx` - Toggle buttons
- `tooltip.tsx` - Tooltip hints
- `kbd.tsx` - Keyboard key display
- `menubar.tsx` - Application menu bar

**Utilities:**
- `use-mobile.tsx` - Responsive hook

### 3.2 Custom Cherry Components

#### Component 1: Sidebar Navigation (`sidebar.tsx`)

**Purpose:** Desktop navigation with tree-stem visual pattern

**Features:**
- Persistent 240px width on desktop (hidden on mobile)
- Curved SVG connectors for child items
- Active state highlighting with cherry color
- Hover states with color transitions
- Sections → Items → Child items hierarchy
- Adaptive text sizing for long labels

**Anatomy:**
```tsx
<section className="flex flex-col gap-6 px-6 py-8">
  {/* Section header */}
  <div className="font-semibold text-[10px] uppercase tracking-wider text-text-muted">
    {section}
  </div>

  {/* Items with tree stems */}
  <div className="flex flex-col gap-1">
    {items.map((item) => (
      <div key={item.id}>
        {/* Item with optional tree stem for children */}
        <Link href={item.href}>...</Link>

        {/* Child items with curved connector */}
        {item.children && (
          <div className="relative ml-4">
            <svg className="absolute left-0">...</svg>
            {item.children.map(child => ...)}
          </div>
        )}
      </div>
    ))}
  </div>
</section>
```

**States:**
- Default: Muted text color
- Hover: Cherry background with cherry text
- Active: Cherry background (`bg-[#C94B6E]`) with white text
- Active-violet: Violet background for concept pages

**Accessibility:**
- `role="navigation"`
- `aria-label="Main navigation"`
- Active item: `aria-current="page"`
- Section headers: `role="group"`

---

#### Component 2: Mobile Sidebar (`mobile-sidebar.tsx`)

**Purpose:** Sheet-based mobile navigation

**Features:**
- Full-height sheet on mobile
- Same navigation structure as desktop
- Swipe to dismiss
- Trigger button in mobile header

**Anatomy:**
```tsx
<Sheet>
  <SheetTrigger className="lg:hidden">
    {/* Menu button */}
  </SheetTrigger>
  <SheetContent side="left" className="w-[280px]">
    {/* Navigation content */}
  </SheetContent>
</Sheet>
```

---

#### Component 3: Buzz Treemap (`buzz-treemap.tsx`)

**Purpose:** Interactive category distribution visualization

**Features:**
- CSS grid with 4 cells (2x2 layout)
- Responsive sizing (mobile: 72px/52px rows, desktop: 128px/88px rows)
- Click-to-filter behavior
- Radial gradients for depth
- Dynamic font scaling based on percentage

**Anatomy:**
```tsx
<div className="grid grid-cols-2 gap-2 w-full">
  {sectors.map(sector => (
    <button
      key={sector.id}
      className={cn(
        "relative overflow-hidden rounded-xl",
        "transition-all duration-200",
        "hover:brightness-90"
      )}
      style={{ backgroundColor: sector.color }}
    >
      {/* Percentage */}
      <span className="text-[17px] font-bold">{sector.percentage}%</span>

      {/* Label */}
      <span className="text-[8px] uppercase tracking-wider">{sector.label}</span>
    </button>
  ))}
</div>
```

**States:**
- Default: Sector colors with gradients
- Hover: Brightness reduced to 90%
- Selected: Outline in sector color

**Variants:**
- Mobile: Condensed labels, smaller cells
- Desktop: Full labels, larger cells

---

#### Component 4: Top Items List (`top-items-list.tsx`)

**Purpose:** News cards with star ratings and badges

**Features:**
- Border cards with left accent border
- Color-coded badges (cherry/violet/green)
- Star ratings with ★ characters
- Hover effects with shadow transitions
- Responsive card list

**Anatomy:**
```tsx
<Card className="border-l-4 border-l-[#C94B6E]">
  <CardHeader>
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1">
        <Badge variant="cherry">{category}</Badge>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{summary}</CardDescription>
      </div>

      {/* Star rating */}
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(star => (
          <span className={cn(star <= rating ? "text-[#C94B6E]" : "text-text-muted")}>
            ★
          </span>
        ))}
      </div>
    </div>
  </CardHeader>
</Card>
```

**States:**
- Default: Subtle border
- Hover: Shadow elevation (`shadow-card-hover`)
- Must-read: Cherry left border accent
- Read: 70% opacity

**Badge Variants:**
- Cherry: Primary category/action
- Violet: Secondary
- Green: Success/positive

---

#### Component 5: Page Header (`page-header.tsx`)

**Purpose:** Page title and subtitle component

**Anatomy:**
```tsx
<div className="mb-8">
  <h1 className="font-extrabold text-[#1A1626] leading-none mb-2.5 text-[20px] lg:text-[30px]">
    {title}
  </h1>
  {subtitle && (
    <p className="text-[13px] lg:text-[15px] text-text-muted leading-relaxed">
      {subtitle}
    </p>
  )}
</div>
```

---

#### Component 6: Handbook Placeholder (`handbook-placeholder.tsx`)

**Purpose:** Coming soon pages with status indicators

**Features:**
- Status badges with timelines
- 2-column grid for expectations
- Color coding by section (BASICS/ADVANCED)
- Notification button

**Anatomy:**
```tsx
<div className="flex flex-col items-center justify-center py-16 px-4">
  <Badge variant="outline" className="mb-4">
    Coming {timeline}
  </Badge>

  <h2 className="text-[24px] font-bold text-text-primary mb-3">
    {title}
  </h2>

  <p className="text-[14px] text-text-body text-center max-w-md mb-8">
    {description}
  </p>

  {/* Expectations grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
    {expectations.map(expectation => (
      <div key={expectation.id} className="flex items-start gap-3">
        <CheckIcon className="text-[#2D7A5E]" />
        <span className="text-[13px] text-text-body">{expectation.text}</span>
      </div>
    ))}
  </div>

  <Button variant="outline">
    <BellIcon />
    Notify me when ready
  </Button>
</div>
```

**Color Coding:**
- BASICS sections: Cherry accent
- ADVANCED sections: Violet accent

---

#### Component 7: Patch Notes Page (`patch-notes-page.tsx`)

**Purpose:** Release notes with timeline

**Features:**
- Chronological timeline
- Date markers
- Update categories
- Impact summaries

---

#### Component 8: Frameworks/Model Updates/Case Studies Pages

**Purpose:** Content pages for Newly Discovered section

**Components:**
- `nd-frameworks-page.tsx` - Framework showcase
- `nd-model-updates-page.tsx` - Model updates timeline
- `nd-case-studies-page.tsx` - Case studies presentation
- `concept-reader-page.tsx` - Concept relationships visualization

---

## 4. Layout Patterns

### 4.1 Page Structure

**Desktop Layout:**
```tsx
<div className="flex h-screen overflow-hidden bg-background">
  {/* Desktop sidebar - 240px, hidden on mobile */}
  <Sidebar className="hidden lg:flex" />

  {/* Content column */}
  <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
    {/* Mobile header - visible on mobile only */}
    <header className="flex lg:hidden items-center gap-2.5 px-4 h-14 bg-white border-b">

    {/* Main content - responsive padding */}
    <main className="flex-1 overflow-y-auto px-4 py-4 lg:px-10 lg:py-8">
      {renderContent()}
    </main>
  </div>
</div>
```

**Key Layout Elements:**
- Sidebar: Fixed 240px width, hidden on mobile
- Mobile header: 56px height, visible below lg breakpoint
- Main content: Responsive padding (16px mobile, 40px desktop)
- Content container: Max 1440px

### 4.2 Responsive Breakpoints

| Breakpoint | Tailwind | Width | Layout |
|------------|----------|-------|--------|
| Mobile | `default` | `0 - 1023px` | Single column, bottom/hamburger nav |
| Desktop | `lg:` | `≥ 1024px` | Persistent sidebar, multi-column |
| Wide | Custom | `≥ 1440px` | Same as desktop, centered content |

**Responsive Classes:**
```tsx
/* Hide on mobile, show on desktop */
className="hidden lg:flex"

/* Mobile: 16px, Desktop: 40px */
className="px-4 py-4 lg:px-10 lg:py-8"

/* Mobile: 20px, Desktop: 30px */
className="text-[20px] lg:text-[30px]"
```

---

## 5. UX Pattern Decisions

### 5.1 Button Hierarchy

| Level | Style | Usage |
|-------|-------|-------|
| Primary | Cherry fill, white text | Account signup, newsletter generate |
| Secondary | Light background, primary text | Sidebar actions, secondary CTAs |
| Ghost | Transparent, elevated hover | Nav items, icon buttons |
| Outline | Border only, colored text | Cancel, secondary actions |
| Destructive | Cherry fill (same as primary) | Delete, remove actions |
| Disabled | `opacity-50`, `cursor-not-allowed` | Form incomplete, locked |

### 5.2 Feedback Patterns

| Event | Pattern | Duration | Rationale |
|-------|---------|----------|-----------|
| Content loaded | No feedback | — | Expected behavior |
| Item read/seen | Subtle opacity (70%) | Persistent | Visual progress |
| Account saved | Toast (success) | 4s auto-dismiss | Confirmation |
| Error (system) | Toast (error) | Until dismissed | Must not auto-hide |
| Error (form) | Inline beneath field | Until corrected | Contextual |
| Loading (page) | Skeleton screen | Until ready | Holds layout |

### 5.3 Form Patterns

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Label position | Above input | Clearest for scanning |
| Required fields | No asterisk | All required unless "(optional)" |
| Validation timing | On blur | Don't interrupt typing |
| Error display | Inline beneath input | Contextual, clear |
| Help text | Caption beneath input | Always visible |

### 5.4 Modal Patterns

| Decision | Choice |
|----------|--------|
| Size SM | Max 400px (confirmations) |
| Size MD | Max 560px (forms) |
| Size LG | Max 800px (editor) |
| Dismiss | Click outside + Escape |
| Focus | Auto-focus first element |
| Stacking | No nested modals |

### 5.5 Navigation Patterns

| Decision | Choice |
|----------|--------|
| Active state | Cherry bg + cherry text (digest); violet bg + violet text (concepts) |
| Breadcrumbs | Shown in pages >1 level deep |
| Back button | Browser native (`history.back()`) |
| Deep links | All pages deep-linkable |
| URL structure | `/[section]/[subsection]` |

### 5.6 Empty State Patterns

| Context | Message + Action |
|---------|-----------------|
| First visit | "Welcome to Cherry. Start with This Week's Highlight →" |
| No search results | "No results for '[query]' — try a related concept" |
| No items this week | "Nothing passed our quality threshold this week." |

### 5.7 Notification Patterns

| Decision | Choice |
|----------|--------|
| Placement | Bottom-right (desktop), bottom-center (mobile) |
| Auto-dismiss | Success: 4s, Info: 5s, Warning/Error: persistent |
| Max stacked | 3 at once |
| Priority | Error > Warning > Success > Info |

### 5.8 Search Patterns (⌘K)

| Decision | Choice |
|----------|--------|
| Trigger | `⌘K` / `Ctrl+K` or sidebar icon |
| Results | Instant, debounced 150ms |
| Result types | Concepts, news items, recent searches |
| No results | "No results found" + suggestion |

### 5.9 Date/Time Patterns

| Context | Format |
|---------|--------|
| Recent (≤7 days) | `Feb 25` |
| Older (>7 days) | `Feb 25, 2026` |
| Patchnotes range | `Feb 17 → Feb 28` |
| Relative times | Avoid (engineers prefer specific dates) |

---

## 6. Responsive Design & Accessibility

### 6.1 Responsive Strategy

**Platform Decision:** Mobile-first with desktop-optimized deep work sessions

**Breakpoints:**

| Breakpoint | Range | Layout | Navigation |
|------------|-------|--------|------------|
| Mobile | 0-1023px | Single column | Hamburger sheet |
| Desktop | 1024px+ | Multi-column | Persistent sidebar (240px) |
| Wide | 1440px+ | Centered, max 1440px | Same as desktop |

**Adaptation Patterns:**

| Element | Mobile | Desktop |
|---------|--------|---------|
| Sidebar | Sheet overlay | Persistent (240px) |
| Content padding | 16px | 40px |
| Page title | 20px | 30px |
| Treemap | 72px/52px rows | 128px/88px rows |
| Modals | Full-screen sheet | Centered modal |
| Touch targets | 44×44px minimum | 32×32px minimum |

### 6.2 Accessibility Strategy

**Target: WCAG 2.1 Level AA**

**Color Contrast:**

| Pair | Ratio | Requirement | Status |
|------|-------|-------------|--------|
| Text (#1A1626) on BG (#F7F6F9) | ~14:1 | 4.5:1 | ✓ Pass |
| Cherry (#C94B6E) on BG (#F7F6F9) | ~4.8:1 | 4.5:1 | ✓ Pass |
| Muted (#9E97B3) on card (#FFFFFF) | ~3.5:1 | 4.5:1 | ⚠ Large text only |

**Key Requirements:**

| Requirement | Implementation |
|-------------|----------------|
| Keyboard navigation | Tab order follows visual flow |
| Focus indicators | 2px cherry outline (`outline: 2px solid var(--cherry)`) |
| Skip link | "Skip to main content" on focus |
| Semantic HTML | `<nav>`, `<main>`, `<article>`, `<section>` |
| ARIA labels | Icons without visible text |
| ARIA live regions | `aria-live="polite"` on toasts |
| Alt text | Descriptive labels for images |
| Form labels | Associated `<label>` elements |
| Error identification | `role="alert"` linked to input |

**Testing Strategy:**

| Type | Tool | Frequency |
|------|------|-----------|
| Automated | Lighthouse (CI/CD) | Every PR |
| Automated | axe DevTools | Dev workflow |
| Manual keyboard | Tab-through flows | Pre-release |
| Screen reader | NVDA/VoiceOver | Sprint end |

---

## 7. Animation & Transitions

### 7.1 Base Transitions

```css
/* Smooth transitions on interactive elements */
button, a, [role="button"] {
  transition: all 150ms ease;
}

/* Focus states */
*:focus-visible {
  outline: 2px solid var(--cherry);
  outline-offset: 2px;
}
```

### 7.2 Component Animations

| Component | Animation | Duration |
|-----------|-----------|----------|
| Skeleton | Pulse shimmer | 1.5s infinite |
| Card hover | Shadow transition | 150ms ease |
| Treemap hover | Brightness | 200ms ease |
| Nav items | Color + bg | 150ms ease |
| Toast | Slide in + fade | 300ms ease |
| Dialog | Scale + fade | 200ms ease |

---

## 8. Implementation Notes

### 8.1 CSS Variable Mapping

**Override shadcn/ui defaults with Cherry tokens:**

```css
:root {
  /* Surfaces */
  --background: #F7F6F9;
  --card: #FFFFFF;
  --popover: #FFFFFF;
  --border: #E4E1EE;
  --input: #E4E1EE;

  /* Text */
  --foreground: #1A1626;
  --card-foreground: #1A1626;
  --popover-foreground: #1A1626;
  --muted-foreground: #9E97B3;

  /* Brand */
  --primary: #C94B6E;
  --primary-foreground: #FFFFFF;
  --secondary: #F2F0F7;
  --secondary-foreground: #1A1626;
  --accent: #FDF0F3;
  --accent-foreground: #C94B6E;

  /* Functional */
  --destructive: #C94B6E;
  --destructive-foreground: #FFFFFF;
  --ring: #C94B6E;

  /* Sidebar */
  --sidebar: #FFFFFF;
  --sidebar-foreground: #6B6480;
  --sidebar-primary: #C94B6E;
  --sidebar-primary-foreground: #FFFFFF;
  --sidebar-accent: #F2F0F7;
  --sidebar-accent-foreground: #1A1626;
  --sidebar-border: #E4E1EE;
  --sidebar-ring: #C94B6E;

  /* Custom brand tokens */
  --cherry: #C94B6E;
  --cherry-soft: #FDF0F3;
  --cherry-border: #F2C4CE;
  --violet: #7B5EA7;
  --violet-soft: #F3EFFA;
  --violet-border: #C7B8E8;
  --success: #2D7A5E;
  --success-soft: #EFF7F3;

  /* Text hierarchy */
  --text-primary: #1A1626;
  --text-secondary: #6B6480;
  --text-body: #3D3652;
  --text-muted: #9E97B3;

  /* Charts */
  --chart-1: #C94B6E;
  --chart-2: #7B5EA7;
  --chart-3: #2D7A5E;
  --chart-4: #D4854A;
  --chart-5: #4A90D9;
}
```

### 8.2 Component Priority

**Implemented (Production Ready):**
1. Sidebar Navigation - ✅ Complete
2. Buzz Treemap - ✅ Complete
3. Top Items List - ✅ Complete
4. Page Header - ✅ Complete
5. Handbook Placeholder - ✅ Complete
6. Patch Notes Page - ✅ Complete
7. Frameworks/Model Updates/Case Studies - ✅ Complete
8. Mobile Sidebar - ✅ Complete

**Shadcn/ui Components:** All 50+ components available

---

## 9. Appendix

### Related Documents

- Product Requirements: `docs/PRD/`
- Architecture: `docs/architecture/`
- Original UX Spec (backup): `docs/ux-design-specification-backup-20260404.md`

### Version History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-02-28 | 1.0 | Initial UX Design Specification | HK |
| 2026-02-28 | 1.1 | Completed all sections | HK |
| 2026-04-04 | 2.0 | **Updated to match actual web frontend implementation** | HK |

---

_This UX Design Specification (v2.0) reflects the ACTUAL implemented design from the web frontend at `apps/web/`. The previous specification (v1.0) is backed up as `docs/ux-design-specification-backup-20260404.md`._
