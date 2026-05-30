/**
 * Smoke tests for bench tools + Anthropic client.
 * Run:  cd apps/api && npx ts-node src/modules/bench/smoke-test.ts
 *
 * No Nest bootstrap — pure function calls. Loads .env manually.
 */

import { config as loadDotenv } from 'dotenv'
// override: true — shell may pre-define ANTHROPIC_API_KEY as empty string.
loadDotenv({ override: true })

import { coingeckoTool } from './tools/coingecko.tool'
import { marketplaceTool } from './tools/marketplace.tool'
import { catalogTool } from './tools/catalog.tool'
import { buildToolDispatcher } from './tools/tool-registry'
import { callClaude } from './anthropic.client'
import { BENCH_SETS } from './sets/set-definitions'

function line(label: string) {
  console.log('\n' + '─'.repeat(70))
  console.log(label)
  console.log('─'.repeat(70))
}

async function main() {
  // ── Tool 1: CoinGecko ─────────────────────────────────────────────
  line('[Tool] get_crypto_price("BTC")')
  const btc = await coingeckoTool.execute({ symbol: 'BTC' })
  console.log(btc)

  // ── Tool 2: Marketplace ───────────────────────────────────────────
  line('[Tool] search_marketplace("LG Gram 16", 700, true)')
  const mk = await marketplaceTool.execute({
    query: 'LG Gram 16',
    max_price: 700,
    sealed_only: true,
  })
  console.log(JSON.stringify(mk, null, 2))
  const ids = (mk as any).listings.slice(0, 3).map((l: any) => l.id)
  console.log('top-3 ids:', ids)
  if (ids.join(',') !== 'gram-01,gram-02,gram-03') {
    throw new Error('[FAIL] marketplace top-3 mismatch')
  }

  // ── Tool 3: Catalog ───────────────────────────────────────────────
  line('[Tool] search_catalog("karma platinum bronze")')
  const cat = await catalogTool.execute({ query: 'karma platinum bronze' })
  const docs = (cat as any).docs
  console.log('matched docs:', docs.map((d: any) => d.id))
  console.log('first doc content length:', docs[0].content.length)
  if (!docs[0].content.includes('70%')) {
    throw new Error('[FAIL] catalog doc missing "70%"')
  }

  // ── Anthropic: baseline (no tools) ────────────────────────────────
  line('[Claude baseline] SET 1 task — no tools')
  const set1 = BENCH_SETS[0]
  const baseline = await callClaude({
    messages: [{ role: 'user', content: set1.task }],
    maxTokens: 400,
  })
  console.log(
    '[baseline] iters:',
    baseline.iterations,
    'tokens:',
    baseline.usage.totalTokens,
    'latency:',
    baseline.latencyMs + 'ms',
  )
  console.log('[baseline text]\n' + baseline.text)

  // ── Anthropic: enhanced (tool loop) ───────────────────────────────
  line('[Claude enhanced] SET 1 task — with CoinGecko tool')
  const dispatcher = buildToolDispatcher([coingeckoTool])
  const enhanced = await callClaude({
    system: set1.systemPrompt,
    tools: set1.tools,
    toolDispatcher: dispatcher,
    messages: [{ role: 'user', content: set1.task }],
    maxTokens: 600,
  })
  console.log(
    '[enhanced] iters:',
    enhanced.iterations,
    'tokens:',
    enhanced.usage.totalTokens,
    'tool calls:',
    enhanced.toolCalls.length,
    'latency:',
    enhanced.latencyMs + 'ms',
  )
  console.log('[tool calls]')
  for (const tc of enhanced.toolCalls) {
    console.log('  -', tc.name, JSON.stringify(tc.input), '→', JSON.stringify(tc.output))
  }
  console.log('[enhanced text]\n' + enhanced.text)

  console.log('\n✅ smoke test OK')
}

main().catch((err) => {
  console.error('\n❌ smoke test FAILED:', err)
  process.exit(1)
})
