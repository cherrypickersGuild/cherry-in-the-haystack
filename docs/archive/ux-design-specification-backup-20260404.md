# cherry-in-the-haystack UX Design Specification

_Created on 2026-02-28 by HK_
_Generated using BMad Method - Create UX Design Workflow v1.0_

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

**Platform:** Mobile-first (commute consumption), desktop-optimized for deep work sessions (personalization config, Newsletter Studio)

**Design Inspiration:** Obsidian (deliberate navigation, knowledge graph feel, no endless scroll) + Morning Brew (structured sections, satisfying completeness)

**UX Principle:** Users should _navigate_ Cherry like a map, not _scroll_ it like a feed.

---

## 1. Design System Foundation

### 1.1 Design System Choice

**Selected:** shadcn/ui (v2, Tailwind CSS v4)

**Rationale:** Cherry needs visual distinctiveness (Obsidian-inspired, not generic SaaS) with strong defaults. shadcn/ui provides composable components copied directly into the project — full ownership, no black-box dependency. Radix UI primitives underneath give accessibility for free (keyboard nav, ARIA, focus management). Tailwind CSS enables mobile-first responsive design with minimal overhead.

**What it provides:**

- Full component library: buttons, forms, dialogs, cards, navigation, dropdowns, toasts, tables
- Accessible by default (WCAG 2.1 AA compliant primitives)
- Dark/light mode theming with CSS variables
- Responsive utilities via Tailwind

**Custom components needed:**

- Concept knowledge graph visualization (no standard component covers this)
- "Completeness signal" / FOMO-free progress indicator (novel pattern)
- Newsletter Studio editor panel
- Personalization scoring criteria input (natural language → weights)
- Content card variants (concept page card vs news item card vs newsletter draft card)

**Customization approach:** Override shadcn/ui CSS variables for Cherry's brand palette; extend Tailwind config for custom spacing/typography scale.

---

## 2. Core User Experience

### 2.1 Defining Experience

**Core loop:** Navigate structured knowledge → land on a concept or news page → feel instantly oriented and caught up.

**The ONE thing users do most:** Browse and read curated LLM knowledge — consuming concept pages (Overview → Child Concepts → Progressive References) and weekly news digests.

**What must be effortless:** Getting from intent to insight. Whether "what's new in LLMs this week?" or "explain RAG to me" — zero friction, immediate value.

**Most critical to get right:** The concept page reading experience and the weekly news digest — these are where Cherry's core value is delivered.

**UX Principle — Navigate, Don't Scroll:** Cherry should feel like a **map you navigate**, not a feed you consume infinitely. Users open sections deliberately, read with purpose, and leave satisfied — not anxious.

### 2.3 Core Experience Principles

| Principle       | Decision                                                                                   | Rationale                                                                         |
| --------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| **Speed**       | Instant feel — skeleton screens, no blank states, immediate navigation                     | Commute users have 2–3 min; every ms counts                                       |
| **Guidance**    | Light-touch — zero friction for reading; contextual prompts for personalization setup only | Engineers don't want to be babied; onboarding only where complexity warrants it   |
| **Flexibility** | Structured content layout (Cherry controls) + flexible filtering (user controls)           | Reading UX is opinionated for clarity; personalization is the paid differentiator |
| **Feedback**    | Subtle, satisfying micro-confirmations — not celebratory toasts                            | Engineers prefer signal over noise; rewards should feel earned, not manufactured  |

### 2.2 Novel UX Patterns

#### The Completeness Signal (Anti-FOMO Pattern)

**Challenge:** Most content platforms make users feel like there's always more to read. Cherry needs the opposite — users should feel _done_ and _caught up_, not anxious.

**Pattern Name:** The Completeness Signal
**User Goal:** Know they haven't missed anything important since their last visit

**Design Solution:** Morning Brew-style "end card" — **only in Patchnotes**

- Patchnotes has a **defined, finite scope** (all changes since last visit, chronological)
- When a user reaches the end, they see a satisfying end state: _"You're caught up — [date range] reviewed"_
- Clear temporal boundary (last visit → today) so users know exactly what "caught up" means
- "Newly Discovered" and concept pages are browsable, not finite — no end-card there

**States:**

- Default: "Last visit: [date] → Today: [date] · X days of updates"
- In progress: Timeline items scrolled through, badge drains
- Complete: End card with date range + 3 stats (updates reviewed, areas changed, status: Current)

**Rationale:** Users chose Cherry precisely to escape FOMO. The UI must actively signal completeness in the one section designed for catch-up (Patchnotes), while leaving discovery sections (Newly Discovered, Basics, Advanced) intentionally open-ended.

**Accessibility:** Keyboard navigable; screen reader announces "End of Patchnotes. You are caught up as of [date]."

---

## 3. Visual Foundation

### 3.1 Color System

**Selected Theme:** Obsidian Night — deep purple-slate backgrounds, cherry-red accent, violet secondary

**Rationale:** Dark-mode-native for engineer users. The data visualization elements (treemap, keyword trend charts) pop on dark backgrounds. Cherry-red accent is singular and memorable — one bold signal color that cuts through the darkness, consistent with the product name. Preserves the existing site's dark mode default while dramatically upgrading visual sophistication.

**Color Tokens:**

| Token                 | Hex       | Usage                                           |
| --------------------- | --------- | ----------------------------------------------- |
| `--color-bg`          | `#13111A` | App background                                  |
| `--color-surface`     | `#1C1927` | Cards, sidebars, panels                         |
| `--color-elevated`    | `#241F32` | Modals, dropdowns, popovers                     |
| `--color-border`      | `#2A2535` | All borders and dividers                        |
| `--color-text`        | `#E8E4F0` | Primary text                                    |
| `--color-muted`       | `#8B849E` | Secondary text, timestamps, labels              |
| `--color-cherry`      | `#C94B6E` | Primary accent — CTAs, active states, links     |
| `--color-cherry-soft` | `#2D1F26` | Cherry accent backgrounds (badges, highlights)  |
| `--color-violet`      | `#7B5EA7` | Secondary — section labels, concept graph nodes |
| `--color-violet-soft` | `#221A33` | Violet accent backgrounds                       |
| `--color-success`     | `#3D7A5E` | Success states                                  |
| `--color-warning`     | `#8A6A2E` | Warning states                                  |
| `--color-error`       | `#8A2E3E` | Error states                                    |

**Data Visualization Palette** (for treemap, charts, keyword trends):

- Sector 1 (Models/Research): `#C94B6E` (cherry)
- Sector 2 (Frameworks/Tools): `#7B5EA7` (violet)
- Sector 3 (Business/Enterprise): `#3D7A5E` (teal-green)
- Sector 4 (Governance/Ecosystem): `#8A6A2E` (amber)
- Trending up: `#3D7A5E` · Trending down: `#8A2E3E`

### 3.2 Typography

**Font Stack:**

- **Headings:** `Inter` (or system-ui fallback) — variable weight, tight letter-spacing for sharp headers
- **Body:** `Inter` — 16px base, 1.7 line-height for comfortable reading
- **Code/Monospace:** `'JetBrains Mono', 'Fira Code', monospace` — for inline code snippets, concept IDs

**Type Scale:**
| Role | Size | Weight | Letter-spacing |
|------|------|--------|----------------|
| h1 (Page title) | 28px | 700 | -0.5px |
| h2 (Section) | 20px | 600 | -0.3px |
| h3 (Subsection) | 16px | 600 | 0 |
| Body | 14px | 400 | 0 |
| Small / Meta | 12px | 400 | 0 |
| Label / Caps | 11px | 600 | +0.8px uppercase |
| Code inline | 12px | 400 | 0 (monospace) |

### 3.3 Spacing & Layout

**Base unit:** 4px grid

**Spacing scale:**
`xs=4px · sm=8px · md=12px · lg=16px · xl=24px · 2xl=32px · 3xl=48px · 4xl=64px`

**Layout grid:**

- Desktop: 12-column, 1280px max container, 24px gutters
- Tablet: 8-column, 768px, 20px gutters
- Mobile: 4-column, full-width, 16px gutters

**Interactive Visualizations:**

- Color Theme Explorer: [ux-color-themes.html](./ux-color-themes.html)

---

## 4. Design Direction

### 4.1 Chosen Design Approach

**Selected: Left Sidebar Navigator + Context-Appropriate Content Layouts**

A hybrid of two approved directions — the persistent left sidebar from Direction 1 combined with the focused concept reading experience from Direction 6. The sidebar is the constant anchor across all screens; the main area adapts to what is being viewed.

**Navigation Architecture:**

- **Left sidebar (220px, persistent desktop):** 4-section hierarchy
  1. **Digest** — This Week's Highlight, Patchnotes
  2. **Basics** — Prompting Techniques, RAG, Fine-tuning, Agent Architectures, Embeddings & Vector DBs, Evaluation
  3. **Advanced** — Chain-of-Thought, Multi-hop RAG, PEFT/LoRA/QLoRA, Multi-agent Systems, Custom Embeddings, Adversarial Evaluation
  4. **Newly Discovered** — Research & Models (Model Updates, Papers & Benchmarks) · Service & System Building (Frameworks, Tools, Shared Resources) · Industry & Business ⭐ (Case Studies) · Ecosystem & Governance (Regulations, Big Tech Trends, This Week's Posts)
- **My Feed — Paid** pinned button at sidebar bottom

**Content Area Layouts by Section:**

| Section                        | Layout                                                     | Key Elements                                            |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------- |
| This Week's Highlight          | 2-column (treemap / keywords+must-reads) + full-width feed | Metrics strip, treemap hero, keyword pills, ranked list |
| Patchnotes                     | Single-column centered (max 740px)                         | Timeline, end-card (only here)                          |
| Newly Discovered sub-pages     | Single-column + optional right aside                       | Leaderboard/articles by category                        |
| Concept Page (Basics/Advanced) | 3-column (nav / reading / roadmap)                         | Focused reading, roadmap graph, digest callout          |
| Mobile all sections            | Single column + bottom nav                                 | Treemap on dashboard, bottom tab navigation             |

**Layout Decisions:**

- Navigation: Persistent left sidebar (desktop) / Bottom tab bar (mobile)
- Visual density: Balanced — comfortable reading with generous line-height, compact metadata
- Information hierarchy: Section label → page title → meta → content (consistent across all pages)
- Border style: Subtle — 1px `--color-border` on all cards/panels; no drop shadows
- Depth cues: Background color steps (`--bg` < `--surface` < `--elevated`) replace shadows

**Interaction Decisions:**

- Primary action: Direct navigation — click sidebar item → content loads (no confirmation)
- Information disclosure: Progressive — overview (dashboard) → category drill-down → item detail
- User control: Structured reading experience (Cherry decides layout); flexible filtering (user decides category)

**Interactive Mockups:**

- Design Direction Showcase: [ux-design-directions.html](./ux-design-directions.html)

---

## 5. User Journey Flows

### 5.1 Critical User Paths

Five critical journeys cover the full product scope across all tiers.

---

#### Journey 1: Browse This Week's Highlight (Free Tier — Primary)

**User Goal:** Stay current with what's happening in LLMs this week in 3–5 minutes.
**Entry Point:** Cherry homepage (This Week's Highlight dashboard)
**Approach:** Single-screen overview → category drill-down → item read

**Flow:**

1. **Land on dashboard.** See week label, 4 metrics (items, topics, keywords, must-reads), treemap, trending keywords, must-reads list.
2. **Scan treemap** → understand which sectors dominated this week (Models 38%, Frameworks 28%, etc.)
3. **Optional: Click treemap sector or category tab** → filtered feed showing only that category's items
4. **Scan must-reads** → read title + 1-line summary for each starred item
5. **Click an item** → opens article source in new tab (external link) OR navigates to Cherry concept page if linked
6. **Optional detour:** Notice a trending keyword → click to explore related concept in Basics/Advanced

**Decision Points:**

- External article → new tab, user returns to Cherry after reading
- Cherry concept link → in-app navigation to concept page (Journey 2)
- No time → user scans treemap + keywords alone (30 seconds of value delivered)

**Success State:** User closes tab feeling "I know what happened in LLMs this week." No end-card needed — this section is browsable, not finite.

**Error States:** Content not loaded → skeleton screens hold layout, retry automatically.

---

#### Journey 2: Read a Concept Page (All Tiers — Primary)

**User Goal:** Learn about or reference a specific LLM concept (e.g., RAG, Fine-tuning).
**Entry Points:** Sidebar nav (click concept name) · Search (⌘K) · Related concept card on another page · Roadmap graph node
**Approach:** Direct navigation → focused reading → optional lateral exploration

**Flow:**

1. **Click concept in sidebar** (e.g., "RAG" under Basics) → navigate to concept page
2. **Oriented instantly:** See Basics/Advanced badge, page title, meta (updated date, sources, read time)
3. **Read Section 01 — Overview:** Opinionated definition + when to use it + practical framing
4. **Scan Section 02 — Related Concepts:** Cards showing prerequisite / subtopic / extends / related relationships
   - Optional: Click a related concept card → navigate to that page (same journey restarts)
   - Notice "⚡ New →" card → Contextual Retrieval just appeared in Newly Discovered
5. **Read Section 03 — Progressive References:** Start Here → Next → Deeper
   - Click reference → opens external resource in new tab
6. **Optional: Use roadmap graph (right panel)** → see "YOU ARE HERE" in learning path, click next concept node

**Decision Points:**

- Follow related concept → re-enter Journey 2 at new concept
- Follow reference link → leave Cherry temporarily (external tab)
- Use roadmap graph → navigate to next concept in learning sequence
- Click "⚡ New in Digest" callout → navigate to Newly Discovered item

**Success State:** User understands the concept and knows what to read next. Time on page: 3–10 min.

---

#### Journey 3: Patchnotes Catch-Up (All Tiers — Primary)

**User Goal:** Know everything that changed in the LLM ecosystem since the last visit.
**Entry Point:** Click "📋 Patchnotes" in sidebar
**Approach:** Linear, finite — scroll from last visit to today → end card

**Flow:**

1. **Land on Patchnotes.** See "Last visit: [date] → Today: [date] · X days of updates" banner.
2. **Scroll through timeline** (newest first). Each item: date + category dot + title + 2-line impact summary.
3. **Optional: Click item** → external article or Cherry concept page for full detail
4. **Reach end of timeline** → End Card appears: "You're caught up · [date range] · X updates reviewed · X areas changed · Status: Current"
5. **Optional next action:** "Explore more" links to This Week's Highlight or a highlighted concept

**Decision Points:**

- First-time user (no previous visit) → "Welcome! Here's everything from this week."
- Long absence (>30 days) → "It's been a while — here are the 10 most impactful changes since [date]."

**Error States:** No updates since last visit → "Nothing changed that passed our quality threshold. Check back next week."

**Success State:** End-card reached. Badge in header clears to zero. "Current" status visible.

---

#### Journey 4: Signup + Paid Personalization Setup (Conversion Flow)

**User Goal:** Upgrade from free browsing to a personalized My Feed.
**Entry Point:** Click "✦ My Feed — Paid" button in sidebar
**Approach:** Wizard (4 steps: Pricing → Account → Preferences → Feed Preview)

**Flow:**

1. **Click "My Feed — Paid"** → Modal opens: tier comparison (Free vs Paid vs Enterprise). Paid features listed: custom sources, natural language scoring, personalized digest.
2. **Click "Start Paid Trial"** → Account creation: email + password OR Google/GitHub OAuth
3. **Email verified** → Land on Personalization Setup (Onboarding step 1/2):
   - Prompt: _"Describe what matters to you as an AI engineer."_
   - Example hint: _"I care more about practical engineering than theory. Skip governance and model benchmarks."_
4. **User types preference** → AI parses → shows "Interpreted as:" chip list:
   - Business Cases ↑ · Practical Tools ↑ · Regulations ↓ · Benchmarks ↓
   - User adjusts chips (drag to reorder, click to toggle) or clicks "Looks right"
5. **"Build My Feed"** → First personalized My Feed loads. Items rescored and filtered.
6. **Optional:** Add custom sources (Onboarding step 2/2): paste RSS feed or URL, Cherry ingests and scores.

**Decision Points:**

- Skip personalization → My Feed loads with default weights; preferences accessible in Settings anytime
- OAuth vs email → both supported; OAuth preferred (fewer friction points)
- Enterprise plan → routes to sales contact flow instead of self-serve

**Success State:** User sees first personalized feed. Can confirm relevance immediately. Preferences editable at any time.

---

#### Journey 5: Newsletter Studio — Draft Creation (Enterprise Tier)

**User Goal:** Create a polished LLM newsletter from this week's curated content in under 15 minutes.
**Entry Point:** "Newsletter Studio" nav item (visible to Enterprise users only, top of sidebar)
**Approach:** 4-step creation wizard → editor → export

**Flow:**

1. **Open Newsletter Studio.** See draft history sidebar + "New Draft" button. Click "New Draft."
2. **Step 1 — Configure:**
   - Tone: Professional / Casual / Technical (radio)
   - Structure template: Highlights → Deep dive → Tool spotlight / Custom sections
   - Audience level: Beginner / Intermediate / Expert
   - Focus: Business / Technical / Research / Mixed
3. **Step 2 — Select Content:**
   - Browse This Week's Highlight items. Click to include (cherry check). Mix community + private sources.
   - Minimum 3, recommended 5–10 items. See selection summary on right.
4. **Step 3 — Generate:**
   - Click "Generate Draft" → Progress bar with status ("Organizing structure… Drafting sections… Finalizing…")
   - Draft appears in editor panel. Sections collapsible. Inline editing enabled.
5. **Step 4 — Review + Export:**
   - Edit inline or regenerate individual sections
   - Save draft (auto-versioned) OR Export (copy HTML / send to Mailchimp/Sendgrid / download)

**Decision Points:**

- Regenerate with different config → preserves source selection, reruns generation
- A/B variants → generate 2 versions from same sources, compare side by side
- Save for later → auto-saved with version history, accessible on return

**Success State:** Newsletter marked "Ready to send." Editor satisfaction confirmed. Time: <15 minutes.

---

## 6. Component Library

### 6.1 Component Strategy

**From shadcn/ui (use as-is or with CSS variable overrides):**
Button, Input, Textarea, Select, Checkbox, RadioGroup, Switch, Form, Label, Card, Badge, Separator, Tabs, Dialog, Sheet (mobile drawer), DropdownMenu, NavigationMenu, Toast, Skeleton, Progress, ScrollArea, Tooltip, Avatar

### 6.2 Custom Components

Twelve custom components are required — none are covered adequately by shadcn/ui.

---

**Component 1: Sidebar Navigation (`<SidebarNav>`)**

|                |                                                                                                                          |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Purpose**    | 4-section hierarchical navigation — Digest, Basics, Advanced, Newly Discovered                                           |
| **Why custom** | Requires 3-level hierarchy (section header → direct items → sub-items within sub-groups) not supported by NavigationMenu |

_Anatomy:_

- Section header (`.knav-h`): ALL-CAPS label, 10px, muted color, full width
- Direct item (`.knav-item`): 12px, 20px left indent, hover: elevated bg
- Sub-group label (`.knav-sg`): 8px, violet, 14px left indent, non-interactive
- Sub-item (`.knav-sub`): 11px, 26px left indent, hover: elevated bg

_States:_ Default · Hover (elevated bg) · Active/cherry (current top-level item) · Active-violet (current concept page item)

_Accessibility:_ `role="navigation"`, `aria-label="Main navigation"`. Active item: `aria-current="page"`. Section headers: `role="group"`, `aria-label="[section name]"`.

---

**Component 2: Treemap (`<BuzzTreemap>`)**

|                |                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------- |
| **Purpose**    | Visualize weekly content distribution across sectors (Models, Frameworks, Business, Ecosystem) |
| **Why custom** | No standard component; click-to-filter behavior is Cherry-specific                             |

_Anatomy:_ CSS grid with 4 cells, proportional sizing by percentage. Each cell: sector label (8px caps), percentage (17px bold), item count + source names (9px).

_States:_ Default · Hover (brightness +10%) · Selected (outline in sector color) · Loading (skeleton shimmer)

_Variants:_ Desktop (128px/88px rows) · Mobile (72px/52px rows, condensed labels)

_Behavior:_ Click sector → filter content feed to that sector. Click again → deselect (show all).

---

**Component 3: Keyword Pill (`<KeywordPill>`)**

|                |                                                               |
| -------------- | ------------------------------------------------------------- |
| **Purpose**    | Display trending keyword with % change indicator              |
| **Why custom** | Novel "hot" variant behavior (cherry fill + trend percentage) |

_Anatomy:_ Rounded pill with keyword label + trend % badge.

_Variants:_ Hot (cherry border + bg + cherry percentage) · Normal (muted border + muted color + green percentage) · Active (cherry fill)

_States:_ Default · Hover (brightness shift) · Active (filled, click to filter)

---

**Component 4: News Item (`<NewsItem>`)**

|                |                                                                                   |
| -------------- | --------------------------------------------------------------------------------- |
| **Purpose**    | Compact list item in feeds — title, 1-line summary, category badge + score + date |
| **Why custom** | Three-slot meta row (badge + stars + date) and read-state tracking                |

_States:_ Default · Hover (elevated background) · Read (70% opacity, slightly dimmed) · Must-read (cherry left border accent)

_Variants:_ Compact (title + meta only) · Full (title + summary + meta)

---

**Component 5: Concept Card (`<ConceptCard>`)**

|                |                                                                                            |
| -------------- | ------------------------------------------------------------------------------------------ |
| **Purpose**    | Related concept link in concept page Section 02                                            |
| **Why custom** | Relationship label (prerequisite / subtopic / extends / related) + "new in digest" variant |

_Anatomy:_ Relationship label (9px violet caps) + concept name (12px bold) + description (10px muted)

_States:_ Default (subtle border) · Hover (violet border) · New-in-digest (cherry border + "⚡ New →" label)

---

**Component 6: Progressive Reference (`<ProgressiveRef>`)**

|                |                                                                                 |
| -------------- | ------------------------------------------------------------------------------- |
| **Purpose**    | Learning path reference item in concept page Section 03                         |
| **Why custom** | Difficulty level indicator + "what it adds" annotation — no standard equivalent |

_Anatomy:_ Left border (2px, colored by level) + level label (9px caps) + title (12px bold) + summary (11px) + adds-note (10px violet italic)

_Variants:_ Start Here (cherry border) · Next (border) · Deeper (border) · Expert (violet border)

_States:_ Default · Hover (border highlights to cherry) · Visited (subtle opacity)

---

**Component 7: Company Leaderboard Card (`<LeaderboardCard>`)**

|                |                                                                     |
| -------------- | ------------------------------------------------------------------- |
| **Purpose**    | Company benchmark ranking in Newly Discovered / Model Updates       |
| **Why custom** | Rank + score + model list layout; "new entry" and "leader" variants |

_States:_ Default · Leading (cherry border + soft bg) · New-entry (cherry "NEW ↑" badge) · Hover (violet border)

---

**Component 8: Rising Star Card (`<RisingStarCard>`)**

|                |                                                                         |
| -------------- | ----------------------------------------------------------------------- |
| **Purpose**    | Full-width highlight for the week's most-trending model or tool         |
| **Why custom** | Cherry-soft background card with stats row — unique to Newly Discovered |

_Anatomy:_ Tag (9px caps, "🔥 Rising Star") + name (17px bold) + sub-headline (12px cherry) + body text + stats row (4 metrics)

---

**Component 9: Completeness End Card (`<PatchnotesEndCard>`)**

|                |                                                                                     |
| -------------- | ----------------------------------------------------------------------------------- |
| **Purpose**    | Signals "You're caught up" at the end of Patchnotes — the anti-FOMO payoff          |
| **Why custom** | Novel pattern with no standard equivalent; only appears once per Patchnotes session |

_Anatomy:_ ✓ icon (30px) + title "You're caught up" (18px bold, cherry) + date range sub-text + 3-stat row (updates reviewed / areas changed / status)

_States:_ Default (appears when user scrolls to end) · Arrival animation (gentle fade-in scale) · Completed (persists on re-visit with grayed "already reviewed" state)

_Accessibility:_ `role="status"`, `aria-live="polite"`. Screen reader: "End of Patchnotes. You are caught up as of [date]."

---

**Component 10: Roadmap Graph (`<ConceptRoadmap>`)**

|                |                                                                                                      |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| **Purpose**    | Learning path visualization showing concept prerequisites, current position, and next steps          |
| **Why custom** | SVG-based directed graph with "YOU ARE HERE" highlighting; no library covers this specific structure |

_Anatomy:_ SVG with vertical track line + concept nodes (rectangles with level label + name) + branch nodes (dashed lines for subtopics/related) + Basics/Advanced divider + legend

_Current node:_ Cherry border (#C94B6E), cherry-soft fill, "YOU ARE HERE" label (9px caps, cherry)

_Advanced nodes:_ Violet border (#7B5EA7), violet-soft fill

_States:_ Default · Hover on node (cursor pointer, slight glow) · Click node (navigates to concept page)

---

**Component 11: Personalization Criteria Input (`<ScoringCriteriaInput>`)**

|                |                                                                                               |
| -------------- | --------------------------------------------------------------------------------------------- |
| **Purpose**    | Natural language → scoring weights. User describes preferences; AI interprets and shows chips |
| **Why custom** | Two-phase input: free text → AI parse → editable chip list                                    |

_Anatomy:_ Textarea (placeholder with example) → "Interpreted as:" chip row → each chip: label + up/down arrow weight control + remove × → Confirm CTA

_States:_ Idle (textarea focused) · Parsing (spinner in corner) · Chips shown (editable) · Confirmed (locked, edit link appears)

---

**Component 12: Category Filter Tabs (`<CategoryTabs>`)**

|                |                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------- |
| **Purpose**    | Filter content feed by category on dashboard and drill-down pages                              |
| **Why custom** | Each tab has a distinct active color per category (models = cherry, frameworks = violet, etc.) |

_Variants:_ All (cherry active) · Models (cherry-warm active) · Frameworks (violet active) · Case Studies (teal active) · Custom (extensible per section)

---

## 7. UX Pattern Decisions

### 7.1 Consistency Rules

Nine pattern categories establish consistent behavior across all screens.

---

**Button Hierarchy**

| Level     | Style                                              | Usage                                                        |
| --------- | -------------------------------------------------- | ------------------------------------------------------------ |
| Primary   | Cherry fill, white text                            | Account signup, newsletter generate, personalization confirm |
| Secondary | Surface bg + border, text color                    | Sidebar actions, secondary CTAs, cancel                      |
| Ghost     | Transparent, hover elevated bg                     | Nav items, icon buttons, tag filters                         |
| Danger    | Error-colored border + text                        | Delete draft, remove source                                  |
| Disabled  | `opacity-50`, `cursor-not-allowed` on all variants | Form incomplete, feature locked                              |

---

**Feedback Patterns**

| Event                | Pattern                      | Duration            | Rationale                                            |
| -------------------- | ---------------------------- | ------------------- | ---------------------------------------------------- |
| Content loaded       | No feedback (expected)       | —                   | Engineers expect instant; toasting "loaded" is noise |
| Item read / seen     | Subtle opacity change (70%)  | Persistent          | Visual progress without celebration                  |
| Account saved        | Bottom-right toast (success) | 4s auto-dismiss     | Account action warrants confirmation                 |
| Newsletter generated | Progress bar + status text   | Until complete      | Long operation needs visible progress                |
| Error (system)       | Toast (error, persistent)    | Until dismissed     | Errors must not auto-disappear                       |
| Error (form)         | Inline beneath field         | Until corrected     | Contextual is clearer than toast                     |
| Loading (page)       | Skeleton screens             | Until content ready | Holds layout, reduces perceived wait                 |

---

**Form Patterns**

| Decision          | Choice                                                 | Rationale                                             |
| ----------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| Label position    | Above input                                            | Consistent with shadcn/ui defaults; clearest for scan |
| Required fields   | No asterisk — all required unless labeled "(optional)" | Cherry forms are minimal; optional is the exception   |
| Validation timing | On blur                                                | Validate when user leaves field, not while typing     |
| Error display     | Inline beneath input, red icon + red text              | Contextual, impossible to miss                        |
| Help text         | Caption beneath input (always visible)                 | Engineers want to see examples without extra clicks   |

---

**Modal Patterns**

| Decision         | Choice                                                                   |
| ---------------- | ------------------------------------------------------------------------ |
| Size SM          | Confirmations, alerts — max 400px                                        |
| Size MD          | Forms (login, account setup, preferences) — max 560px                    |
| Size LG          | Newsletter editor preview, content selection — max 800px                 |
| Dismiss          | Click outside + Escape, EXCEPT destructive confirm (explicit close only) |
| Focus management | Auto-focus first interactive element; trap Tab within modal              |
| Stacking         | No nested modals — navigate within the modal instead                     |

---

**Navigation Patterns**

| Decision      | Choice                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Active state  | Cherry bg + cherry text (`knav-item.active`) for digest/section items; violet bg + violet text (`knav-item.active-v`) for concept pages |
| Breadcrumbs   | Shown in Dir 6 top bar when content is >1 level deep; not shown on top-level pages                                                      |
| Back button   | Browser native — app does not override `history.back()`                                                                                 |
| Deep links    | All pages deep-linkable: `/digest/highlight`, `/basics/rag`, `/newly-discovered/model-updates`, etc.                                    |
| URL structure | `/[section]/[subsection]` — clean, shareable, bookmarkable                                                                              |

---

**Empty State Patterns**

| Context                               | Message + Action                                                                      |
| ------------------------------------- | ------------------------------------------------------------------------------------- |
| First visit (no history)              | "Welcome to Cherry. Start with This Week's Highlight →"                               |
| No search results                     | "No results for '[query]' — try a related concept" + suggested links                  |
| My Feed (no preferences)              | "Set your scoring criteria to see a personalized feed" + CTA to Personalization Setup |
| Newly Discovered (no items this week) | "Nothing passed our quality threshold this week. Check back next week."               |

---

**Confirmation Patterns**

| Action                                       | Confirmation Level                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| Delete newsletter draft                      | Modal with draft title — "Delete '[Draft Name]'? This cannot be undone." |
| Leave newsletter editor with unsaved changes | Modal: "Save your draft?" → Save / Discard / Cancel                      |
| Remove custom source                         | Inline confirmation row: "Remove [source name]? [Yes] [Cancel]"          |
| Export newsletter                            | No confirmation needed — exports can be regenerated                      |
| Account deletion                             | Two-step: type "DELETE" in field, then confirm button                    |

---

**Notification Patterns**

| Decision           | Choice                                                            |
| ------------------ | ----------------------------------------------------------------- |
| Placement          | Bottom-right corner (desktop); bottom center (mobile)             |
| Auto-dismiss       | Success: 4s · Info: 5s · Warning: persistent · Error: persistent  |
| Max stacked        | 3 at once; oldest auto-dismissed when 4th appears                 |
| Priority hierarchy | Error > Warning > Success > Info (higher priority always visible) |

---

**Search Patterns (⌘K Command Palette)**

| Decision     | Choice                                                                     |
| ------------ | -------------------------------------------------------------------------- |
| Trigger      | `⌘K` / `Ctrl+K` keyboard shortcut, or click search icon in sidebar         |
| Results      | Instant, debounced 150ms — no submit needed                                |
| Result types | Concept pages (Basics/Advanced) · Newly Discovered items · Recent searches |
| Filters      | Not in search — category browsing done via sidebar nav                     |
| No results   | "No results found" + "Browse [closest section] →" suggestion               |

---

**Date/Time Patterns**

| Context                | Format                                                       |
| ---------------------- | ------------------------------------------------------------ |
| Recent items (≤7 days) | `Feb 25` — month + day only (same year implied)              |
| Older items (>7 days)  | `Feb 25, 2026` — full date                                   |
| Patchnotes range       | `Feb 17 → Feb 28` (date → date, always in Patchnotes banner) |
| No relative times      | Avoid "3 days ago" — engineers prefer specific dates         |

---

## 8. Responsive Design & Accessibility

### 8.1 Responsive Strategy

**Platform Decision:** Mobile-first (commute reading) with desktop-optimized deep work sessions.

**Breakpoints:**

| Breakpoint | Range       | Layout                    | Navigation                                                                      |
| ---------- | ----------- | ------------------------- | ------------------------------------------------------------------------------- |
| Mobile     | 0–767px     | 4-column, full-width      | Bottom tab bar (Digest / Patchnotes / Learn / My Feed) + hamburger for full nav |
| Tablet     | 768–1023px  | 8-column, 768px container | Hamburger → overlay sidebar (same 4-section nav)                                |
| Desktop    | 1024–1439px | 12-column, max 1280px     | Persistent left sidebar (220px)                                                 |
| Wide       | 1440px+     | Same as desktop, centered | Sidebar fixed; content container max 1280px                                     |

**Adaptation Patterns per Component:**

| Element           | Mobile                                                              | Tablet                             | Desktop                                |
| ----------------- | ------------------------------------------------------------------- | ---------------------------------- | -------------------------------------- |
| Sidebar           | Hidden; accessible via hamburger overlay                            | Overlay on demand                  | Persistent (220px)                     |
| Treemap           | 2×2 grid, 72px/52px rows, abbreviated labels                        | 2×2 grid, 100px/70px rows          | 2×2 grid, 128px/88px rows, full labels |
| Concept Reader    | Single column (no roadmap graph) — graph behind "Learning Path" tab | 2-column (nav + reading, no graph) | 3-column (nav + reading + graph)       |
| Leaderboard grid  | Single column (cards stacked)                                       | 2-column                           | 3-column                               |
| Metrics strip     | 2×2 grid                                                            | Full 4-column row                  | Full 4-column row                      |
| Patchnotes        | Single column, compact timeline dots                                | Single column                      | Single column, generous max-width      |
| Newsletter Studio | Not available on mobile (enterprise deep work only)                 | Tablet: simplified editor          | Full 3-panel editor                    |
| Modals            | Full-screen sheet                                                   | Centered modal                     | Centered modal                         |
| Touch targets     | Minimum 44×44px all interactive elements                            | 44×44px minimum                    | 32×32px minimum (pointer accuracy)     |

---

### 8.2 Accessibility Strategy

**Target: WCAG 2.1 Level AA**

Rationale: Cherry is a public web application with commercial intent. Level AA is the practical standard, legally expected for EU deployments, and achievable without sacrificing Cherry's visual identity.

**Color Contrast Audit:**

| Pair                                                     | Ratio  | Requirement      | Status                                              |
| -------------------------------------------------------- | ------ | ---------------- | --------------------------------------------------- |
| `--color-text` (#E8E4F0) on `--color-bg` (#13111A)       | ~14:1  | 4.5:1            | ✓ Pass                                              |
| `--color-cherry` (#C94B6E) on `--color-bg` (#13111A)     | ~4.8:1 | 4.5:1            | ✓ Pass                                              |
| `--color-muted` (#8B849E) on `--color-surface` (#1C1927) | ~3.2:1 | 4.5:1            | ⚠ Fail — use only for non-essential decorative text |
| `--color-muted` on `--color-bg`                          | ~3.5:1 | 3:1 (large text) | ✓ Pass for 18px+                                    |

_Action item:_ Replace muted text (#8B849E) with a higher-contrast muted where AA is required for essential information. Recommend `#A09DB8` (~4.6:1 on `--color-bg`).

**Key Requirements:**

| Requirement            | Implementation                                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Keyboard navigation    | All interactive elements reachable via Tab; logical order follows visual reading order                           |
| Focus indicators       | 2px cherry outline (`outline: 2px solid var(--cherry); outline-offset: 2px`) on all interactive elements         |
| Skip link              | "Skip to main content" visible on focus at top of page                                                           |
| Semantic HTML          | `<nav>` sidebar, `<main>` content, `<article>` concept pages, `<aside>` roadmap panel, `<section>` page sections |
| ARIA labels            | `aria-label` on treemap sectors, keyword pills, nav sections without visible headings                            |
| ARIA live regions      | `aria-live="polite"` on toast notifications; `role="status"` on Patchnotes end card                              |
| Screen reader end-card | "End of Patchnotes. You are caught up as of [date range]." announced on arrival                                  |
| Alt text               | All meaningful images and SVG elements have descriptive labels                                                   |
| Form labels            | All form inputs have associated `<label>` elements or `aria-label`                                               |
| Error identification   | Form errors identified with `role="alert"` and linked to input with `aria-describedby`                           |

**Testing Strategy:**

| Type            | Tool                             | When                |
| --------------- | -------------------------------- | ------------------- |
| Automated       | Lighthouse (CI/CD pipeline)      | Every pull request  |
| Automated       | axe DevTools browser extension   | Developer workflow  |
| Manual keyboard | Tab-through all 5 user journeys  | Before each release |
| Screen reader   | NVDA + Chrome (Windows)          | Sprint end          |
| Screen reader   | VoiceOver + Safari (macOS + iOS) | Sprint end          |

---

## 9. Implementation Guidance

### 9.1 Completion Summary

Cherry's UX Design Specification is complete. All decisions were made collaboratively with rationale documented for future reference.

**What was created:**

| Area              | Decision                                                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Design System     | shadcn/ui (v2) + Tailwind CSS v4 — composable, accessible, full ownership                                                  |
| Color Theme       | Obsidian Night — dark-mode native, treemap-forward, cherry-red singular accent                                             |
| Typography        | Inter + JetBrains Mono — sharp headers, comfortable body, monospace for code                                               |
| Design Direction  | Left sidebar (4-section nav) + context-appropriate content layouts                                                         |
| Novel Pattern     | Completeness Signal (end-card) — Patchnotes only                                                                           |
| User Journeys     | 5 flows: Browse Highlight, Read Concept, Patchnotes Catch-up, Signup + Personalization, Newsletter Studio                  |
| Custom Components | 12 custom components beyond shadcn/ui baseline                                                                             |
| UX Patterns       | 9 consistency categories: buttons, feedback, forms, modals, navigation, empty states, confirmations, notifications, search |
| Responsive        | 3 breakpoints — mobile bottom nav, tablet overlay sidebar, desktop persistent sidebar                                      |
| Accessibility     | WCAG 2.1 Level AA — contrast audit done, keyboard nav, screen reader requirements defined                                  |

**Deliverables:**

- UX Design Document: `docs/ux-design-specification.md`
- Interactive Color Themes: `docs/ux-color-themes.html`
- Design Direction Mockups: `docs/ux-design-directions.html`

**What happens next:**

- Developers can implement with the design system foundation and component specs as reference
- Each custom component has states, anatomy, and accessibility requirements defined
- User journeys inform story/epic breakdown in the BMAD development phase
- The architecture document and this UX spec together provide the full implementation blueprint

### 9.2 Implementation Notes for Developers

**CSS Variable Setup:** Override shadcn/ui's default `--background`, `--foreground`, etc. with Cherry's Obsidian Night tokens. Full mapping:

```
--background: 13111A    (--color-bg)
--card: 1C1927          (--color-surface)
--popover: 241F32       (--color-elevated)
--border: 2A2535        (--color-border)
--foreground: E8E4F0    (--color-text)
--muted-foreground: A09DB8  (high-contrast muted — see accessibility note)
--primary: C94B6E       (--color-cherry)
--secondary: 7B5EA7     (--color-violet)
--destructive: 8A2E3E   (--color-error)
```

**Component Priority for MVP:**

1. `<SidebarNav>` — navigation is the foundation of all journeys
2. `<BuzzTreemap>` — hero element of the dashboard; Cherry's most distinctive UI
3. `<NewsItem>` — used everywhere in feeds
4. `<ConceptCard>` + `<ProgressiveRef>` — concept page reading experience
5. `<PatchnotesEndCard>` — the anti-FOMO payoff (high impact, low complexity)
6. `<ConceptRoadmap>` — roadmap graph (high value, higher complexity)
7. `<ScoringCriteriaInput>` + `<CategoryTabs>` — paid tier features, phase 2

---

## Appendix

### Related Documents

- Product Requirements: `docs/PRD.md`
- Architecture: `docs/architecture.md`

### Core Interactive Deliverables

This UX Design Specification was created through visual collaboration:

- **Color Theme Visualizer**: `docs/ux-color-themes.html`
  - Interactive HTML showing all color theme options explored
  - Live UI component examples in each theme
  - Side-by-side comparison and semantic color usage

- **Design Direction Mockups**: `docs/ux-design-directions.html`
  - Interactive HTML with direction screens (Dashboard, Patchnotes, Newly Discovered, Mobile, Concept Reader)
  - Full-screen mockups with all 4 nav sections
  - Design philosophy and rationale for each screen

### Version History

| Date       | Version | Changes                                                                                                   | Author |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------- | ------ |
| 2026-02-28 | 1.0     | Initial UX Design Specification                                                                           | HK     |
| 2026-02-28 | 1.1     | Completed Steps 4–9: design direction, user journeys, components, UX patterns, responsive + accessibility | HK     |

---

_This UX Design Specification was created through collaborative design facilitation, not template generation. All decisions were made with user input and are documented with rationale._
