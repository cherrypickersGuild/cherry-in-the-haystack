# KaaS Dashboard

The Dashboard is the control panel for the agents that buy knowledge from Cherry. It is an overlay modal opened from the sidebar.

## Layout

Three areas:
- **Left — My Agents (Agent Panel)**: list of registered agents and the selected agent's detail
- **Right — Wallet Panel**: credit balance + Deposit / Withdraw
- **Top tabs**: Dashboard / Knowledge Curation / Prompt Templates

## Key components

### Agent registration
Click the `+` button next to "My Agents" → opens a form with:
- **Name** + **Icon** (emoji)
- **Wallet address** — the on-chain address that will receive provenance receipts and curator rewards (optional, can connect MetaMask)
- **LLM provider / model** — claude-opus-4-6 / gpt-4o / etc. Used when the console asks the agent to summarize a purchased concept.
- **LLM API key** — optional, agent uses its own key for free chat

After register, the dashboard returns an **API Key** (`ck_live_…`) — this is what MCP / external clients pass to authenticate.

### My Agents list (agent cards)
Each agent card in the list shows:
- **Icon + name** (left) — click to select and show detail panel
- **📚 Diff button** (orange border, sienna text) — triggers the agent's live Knowledge Diff self-report. Result appears **inline inside the floating Cherry Console** (bottom-right of the screen), not in a modal. See "Knowledge Diff (Learning History)" below.
- **Credit balance** (right) — quick view of current `cr`

### Selected agent detail
Shows for the highlighted agent:
- **Wallet + Karma** — short address (`0x742d…F4a8`) combined with the wallet's on-chain Karma (Karma is a wallet-level property on Status Network, not agent-level).
   - Loads **automatically** when the agent is selected: `balanceOf(wallet)` → `getTierIdByKarmaBalance` → tier name (`none` / `entry` / `newbie` / `basic` / `active` / `regular` / `power` / `pro` / `high-throughput` / `s-tier` / `legendary`). Also shows `txPerEpoch` (gasless allowance) and a link to the Karma contract on hoodiscan.
   - If two agents share the same wallet they see the same Karma tier — it is the wallet that holds Karma.
   - "🔗 Refresh onchain" button (top-right of the Wallet block) forces a re-read if needed (e.g. after minting new Karma from the faucet).
- **MCP Server** — green dot if `cherry-kaas.mcp.server` HTTP endpoint is reachable (polled every 10s)
- **Claude Code Connection** — copy-paste command:
   ```
   claude mcp add cherry-kaas /Users/.../start-mcp.sh --env KAAS_AGENT_API_KEY=ck_live_… --env ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
   ```
   Run this in a terminal to register Cherry KaaS as an MCP server inside Claude Code. After running, Claude Code can call Cherry's MCP tools (search_catalog, purchase_concept, etc.) using this agent's identity. A remove command is shown next to it.

### Wallet Panel (right)
- **Credits balance** — `kaas.credit_ledger` SUM (deposits − consumes)
- **Deposit / Withdraw** — sends a tx through the configured chain adapter (Status Network on Sepolia today, NEAR Protocol L1 also supported via the Chain Selector)
- **Total deposited / consumed** — lifetime totals

### Privacy Mode toggle
- Located in the dashboard header
- When **ON**, sensitive payloads (knowledge content, purchase intent, free chat questions) are routed through the NEAR AI Cloud TEE (`cloud-api.near.ai/v1`, model `Qwen/Qwen3-30B-A3B-Instruct-2507`) before reaching the Cherry server
- The console shows a `🔒 Privacy` badge on responses that went through TEE
- Toggle persists in localStorage

### Chain Selector
Header dropdown — choose between **Status Network** (Sepolia, gasless EVM L2) and **NEAR Protocol** (L1, `tomatojams.testnet`). All on-chain operations (deposit, consume, distributeReward, recordProvenance) route to the chosen chain.

### Knowledge Diff (Learning History)
**How to trigger**: click the **📚 Diff** button on any agent card in the "My Agents" list (orange-outlined, small button on the right of the card).

**Where the result appears**: inline inside the floating **Cherry Console** in the bottom-right of the screen. It is **not** a modal — the console opens (if not already) and appends an `agent-report` message showing the self-report payload. You can keep working in the dashboard while reading it.

**What the self-report shows** (rendered by the shared `SelfReportLog` component):
- **Current Knowledge** — topics the agent currently holds (each with last-updated date)
- **Diff vs previous report** — added / modified / unchanged topics since the agent's last self-report
- **Timeline** — recent purchase / follow events: date, action, concept title, ★ quality score, credits consumed, chain (`status` / `status-hoodi` / `near`), tx hash with explorer link
- **Summary** — total events, total credits spent, breakdown by action and by chain
- **Meta** — reporter (the agent process), reported_at, session uptime, PID, signature (proof that the report came from the live agent process, not the Cherry server)
- **On-chain status** — if the agent pushed the report via WebSocket and the Cherry server wrote the provenance hash on-chain, a tx hash + explorer link is shown. Otherwise a discreet "on-chain skipped" notice.

**Requirements**:
- The agent must be running its MCP process (Claude Code with `cherry-kaas` registered, or any other MCP client connected via HTTP/stdio). If MCP is not connected, the console shows a polite fallback message explaining what to do.
- All content in the report is generated **live by the agent's own process** — Cherry server does not fabricate it.

**How it works under the hood**: the 📚 button dispatches a `kaas-self-report` custom event; the console listens and either (a) reads the last WebSocket push (`agent_report_pushed`) or (b) HTTP-fetches `/v1/kaas/agents/:id/self-report` as a fallback, which in turn asks the agent over MCP (`compare_knowledge` + `generate_self_report` skill).

### Delete Agent
Bottom of the selected-agent panel. Confirms via browser prompt before removing the agent + its credit ledger from `kaas.agent`.

## Common tasks
| Task | Steps |
|---|---|
| Register a new agent | + button → fill form → save → API key shown |
| Connect to Claude Code | Select agent → copy "Claude Code Connection" command → paste in terminal. Cherry KaaS becomes a registered MCP server in Claude Code. |
| See what an agent has learned | Click the **📚 Diff** button on that agent's card in "My Agents" → self-report appears in the floating Cherry Console (bottom-right) |
| Refresh on-chain Karma | Select agent → click "🔗 Refresh onchain" in the Wallet + Karma block |
| Deposit credits | Select agent → Wallet Panel → Deposit → enter amount → tx submitted on selected chain |
| View credit history (deposits + consumes) | Wallet Panel → **Ledger** tab → full timeline with tx explorer links |
| Toggle privacy | Header → Privacy Mode toggle (ON = route via NEAR AI TEE) |

## Notes
- Agents are tied to the system user (`00000000-0000-0000-0000-000000000000`) — there is no per-user auth in the demo
- API keys are 256-bit hex with prefix `ck_live_`
- MCP server is started by `apps/api/start-mcp.sh` (stdio); HTTP variant is at `/api/v1/kaas/mcp`
