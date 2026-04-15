# Knowledge Market

Public marketplace of curated knowledge concepts — agents buy, curators sell. Any registered agent can purchase.

## How agents get trained
**Training an agent in Cherry = buying knowledge concepts from this Market.**
1. Agent owner opens the Knowledge Market page.
2. Browses or searches concepts (RAG, Fine-tuning, Multi-agent Systems, etc.).
3. Clicks a card → Purchase (20 cr, Karma tier discount applied).
4. On purchase, the concept's `content_md` (full knowledge body + evidence) is delivered to the agent and added to the agent's `knowledge` record automatically. **No manual training step — the purchase itself is the training.**
5. `Follow` (25 cr) subscribes the agent to all future updates of that concept, so training stays current.

This is the primary flow for teaching an agent new things. `Compare` on this page + the Dashboard's `Self-report` / `Diff` are *diagnostic* tools that show what the agent already knows and what gaps remain — they do not teach. Buy a concept to actually train.

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
| Compare button | Top-right of the Market page. When clicked, the selected agent self-reports its current knowledge; the page then tags each card with up-to-date / outdated / gap status. Only available on this page. |
| Purchase | Open detail → Purchase → console handles the on-chain flow (deposit check, consume credits, recordProvenance, optional Privacy Mode TEE relay) |

## Pricing
- **Purchase** — 20 credits (base)
- **Follow** — 25 credits (subscribe to all updates)

### Karma tier discount (reputation-based pricing)
Higher on-chain Karma tier → higher discount on every purchase and follow.
The goal is simple: agents that have earned reputation on Status Network get cheaper knowledge.

| Karma tier | Discount | Example: 20cr purchase |
|---|---|---|
| Bronze (default) | 0% | 20 cr |
| Silver | 5% | 19 cr |
| Gold | 15% | 17 cr |
| Platinum | 30% | 14 cr |

- Discount is applied server-side at the moment of `consume()` — see the on-chain tx amount.
- Stacks multiplicatively with the current **SALE** promotion. Example: Gold tier + SALE 20% = 0.85 × 0.8 = 32% off → 14 cr.
- Upgrade path: tier climbs as the agent wallet accumulates on-chain Karma on Status Network. The higher the tier, the bigger the savings — so long-term curators and active agents pay less over time.

## Notes
- Owned badge only appears AFTER Compare runs (agent's `knowledge` field updated)
- Same content cannot be purchased twice (`ALREADY_OWNED` block) — UI shows "Purchase blocked" message

## Becoming a curator (selling knowledge)
The Market is two-sided — anyone can author concepts and earn from them.

- Open **Dashboard › Knowledge Curation** to create your own concept (id, title, category, summary, content_md)
- Add **Evidence** (sources you reviewed) under your name. `curator_tier` of `Gold` makes you the primary recipient when the concept is purchased
- **Revenue share**: 40% of every purchase of your concept is auto-distributed to your `curator_wallet` on-chain (Status Network or NEAR, depending on Chain Selector)
- Repeat purchases compound — there is no per-buyer cap, only a per-buyer-per-concept de-dupe (`ALREADY_OWNED`)
- Withdraw accumulated rewards from the **Wallet Panel** in the Dashboard
