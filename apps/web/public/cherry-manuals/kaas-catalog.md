# KaaS Catalog

Public catalog of curated knowledge concepts that any registered agent can purchase.

## Layout
- **Left** — search box + category filter dropdown
- **Right** — grid of ConceptCard tiles
- **Modal** — clicking a card opens detail (max-h 90vh, internal scroll)

## ConceptCard
Each card shows:
- Title + category badge (color-coded by category)
- Summary (2-line clamp)
- Quality score (★ rating)
- Source count (number of evidence entries)
- Owned badge (✓ green) — only after running "Compare" against an agent
- Compare status badge — `up-to-date` / `outdated` / `gap`

## Detail modal
- Full description + content snippet (without `content_md`)
- Related concepts (clickable chips that open their detail)
- Evidence list — for each: source, summary, curator name, curator tier badge, comment
- "Purchase" / "Follow" buttons → trigger the floating Cherry Console with the chosen action

## Common tasks
| Task | Steps |
|---|---|
| Search | Top-left search box — case-insensitive on title + summary + id |
| Filter by category | Top-left dropdown |
| Open detail | Click a card |
| Compare button | Top-right of the Catalog page. When clicked, the selected agent self-reports its current knowledge; the page then tags each card with up-to-date / outdated / gap status. Only available on this page. |
| Purchase | Open detail → Purchase → console handles the on-chain flow (deposit check, consume credits, recordProvenance, optional Privacy Mode TEE relay) |

## Pricing
- **Purchase** — 20 credits (Karma tier discount applied: Bronze 0%, Silver 5%, Gold 15%, Platinum 30%)
- **Follow** — 25 credits (subscribe to all updates)

## Notes
- Owned badge only appears AFTER Compare runs (agent's `knowledge` field updated)
- Same content cannot be purchased twice (`ALREADY_OWNED` block) — UI shows "Purchase blocked" message

## Becoming a curator (selling knowledge)
The Catalog is a two-sided market — anyone can author concepts and earn from them.

- Open **Dashboard › Knowledge Curation** to create your own concept (id, title, category, summary, content_md)
- Add **Evidence** (sources you reviewed) under your name. `curator_tier` of `Gold` makes you the primary recipient when the concept is purchased
- **Revenue share**: 40% of every purchase of your concept is auto-distributed to your `curator_wallet` on-chain (Status Network or NEAR, depending on Chain Selector)
- Repeat purchases compound — there is no per-buyer cap, only a per-buyer-per-concept de-dupe (`ALREADY_OWNED`)
- Withdraw accumulated rewards from the **Wallet Panel** in the Dashboard
