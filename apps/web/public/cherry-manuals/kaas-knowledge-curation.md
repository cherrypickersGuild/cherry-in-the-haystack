# KaaS Dashboard › Knowledge Curation

Admin tab inside the Dashboard modal. Used to author and edit the knowledge concepts that agents purchase from the Catalog.

## Layout
Two columns:
- **Left** — concept list (search box + scrollable list)
- **Right** — selected concept detail with sub-tabs

## Sub-tabs (right panel)
1. **Basic Info** — id, title, category, summary, related concepts, quality score
2. **Content** — `content_md` (the full markdown body delivered after purchase)
3. **Evidence** — list of source citations with curator + curator tier + comment

## Common tasks
| Task | Steps |
|---|---|
| Create concept | `+` button → ID (auto-slugged from title), Title, Category, Summary → Save |
| Edit existing | Select from left list → edit fields in Basic Info / Content tab → save |
| Add evidence | Evidence tab → "Add Evidence" → Source / Curator / Tier (Bronze..Gold) / Comment → Save. `source_count` updates automatically |
| Soft delete | Trash icon in header → `is_active = false` (still visible to admin, hidden from catalog) |
| Search | Top of left list — case-insensitive LIKE on title + summary + id |

## Concept fields
- `id` (slug, lowercase a-z 0-9 -)
- `title`, `category` (chips: RAG, Fine-Tuning, etc.), `summary`
- `content_md` — markdown body (delivered on purchase)
- `quality_score` (0–5), `source_count` (auto from evidence count)
- `related_concepts` — JSON array of related concept ids
- `is_active` — soft-delete flag

## Evidence fields
- `source` — paper / blog / GitHub repo link
- `summary` — short note about why this evidence supports the concept
- `curator` (name) + `curator_tier` (Bronze / Silver / Gold — Gold gets priority for reward distribution)
- `comment` — optional reviewer note

## Notes
- Saving a concept emits a WebSocket update to all connected agents — followers see fresh content immediately
- `quality_score` is what the Catalog uses for default sort order
- Curator tier "Gold" wins the 40% revenue share when multiple curators contribute evidence to the same concept
