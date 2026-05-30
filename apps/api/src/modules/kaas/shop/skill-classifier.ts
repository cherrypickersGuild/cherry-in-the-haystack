/**
 * Slug → kind classifier for Agent Trade.
 *
 * Self-report exposes folder names like `cherry-019dac…`, `cherry-p-hunter`,
 * `cherry-build-meta`. Agent Trade lets a user buy any of those individual
 * files for a flat 5 credits — this module decides what each slug *is* so
 * the buy endpoint can route to the right install path.
 */

export type SkillKind = 'concept' | 'card' | 'meta' | 'unknown'

export interface ClassifiedSkill {
  slug: string
  kind: SkillKind
  /** Optional human-readable label. Filled by the service when concept lookup
   *  succeeds; otherwise the slug itself is shown. */
  title?: string
  summary?: string
}

const UUID_V7_RE = /^019[a-f0-9-]{29,}$/

export function classifySlug(slug: string): ClassifiedSkill {
  // Workshop card: cherry-p-XX, cherry-s-XX, cherry-m-XX, cherry-o-XX, cherry-me-XX
  // Folder slug after the "cherry-" prefix is removed → "p-hunter", "me-short"…
  if (/^(p|s|m|o|me)-/.test(slug)) {
    return { slug, kind: 'card', title: slug }
  }
  // Knowledge market concept (UUIDv7)
  if (UUID_V7_RE.test(slug)) {
    return { slug, kind: 'concept', title: slug }
  }
  // Workshop build meta — purely informational, never resold individually
  if (slug === 'build-meta') {
    return { slug, kind: 'meta', title: 'Build metadata' }
  }
  return { slug, kind: 'unknown', title: slug }
}

/** Flat per-file price for Agent Trade. Tier-based pricing lives in
 *  Shop By Domain (set bundles); this lane is intentionally simpler. */
export const AGENT_TRADE_FLAT_PRICE = 5
