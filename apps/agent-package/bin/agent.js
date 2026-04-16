#!/usr/bin/env node
/**
 * cherry-kaas-agent — Cherry KaaS 에이전트 MCP 서버
 *
 * Claude Code에서 실행. 서버와 HTTP + WebSocket으로 통신.
 * DB 직접 접속 없음. 프로젝트 파일 불필요.
 *
 * 환경변수:
 *   KAAS_AGENT_API_KEY — 에이전트 인증 키 (대시보드에서 발급)
 *   KAAS_WS_URL — 서버 주소 (기본: https://solteti.site)
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('@modelcontextprotocol/sdk/server/mcp.js').z || require('zod');
const { registerTools, setSocket } = require('../lib/mcp-tools.js');
const { connectWebSocket } = require('../lib/ws-client.js');

const API_KEY = process.env.KAAS_AGENT_API_KEY;
const BASE_URL = process.env.KAAS_WS_URL ?? 'https://solteti.site';

if (!API_KEY) {
  process.stderr.write('[cherry-kaas-agent] ERROR: KAAS_AGENT_API_KEY not set.\n');
  process.stderr.write('Register an agent at your Cherry KaaS dashboard, then pass the key via --env.\n');
  process.exit(1);
}

process.stderr.write(`[cherry-kaas-agent] Starting... (server: ${BASE_URL})\n`);

async function main() {
  const server = new McpServer({
    name: 'cherry-kaas',
    version: '1.0.0',
  });

  // MCP 도구 등록 (HTTP API 호출)
  registerTools(server, API_KEY, BASE_URL);

  // WebSocket 연결 (self-report, compare, 3자 대화)
  const socket = connectWebSocket(API_KEY, BASE_URL);
  setSocket(socket);

  // stdio 전송 시작
  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write('[cherry-kaas-agent] MCP server ready (stdio)\n');
}

main().catch((err) => {
  process.stderr.write(`[cherry-kaas-agent] Fatal: ${err.message}\n`);
  process.exit(1);
});
