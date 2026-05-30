# ---- Build Stage ----
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/

# Install dependencies (web only)
RUN pnpm install --frozen-lockfile --filter=my-project...

# Copy source and build
COPY apps/web ./apps/web

ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Skew Protection: 배포마다 고유 deploymentId.
# 핵심: 빌드 시점과 런타임 시점이 같은 값을 가져야 함 (다르면 client/server mismatch → 무한 reload 루프).
# 빌드 시 한 번 결정해서 파일로 저장 → 런타임 컨테이너에 복사 → 서버 시작 시 env로 주입.
ARG NEXT_DEPLOYMENT_ID=""
RUN DEPLOY_ID="${NEXT_DEPLOYMENT_ID:-build-$(date +%s)}" && \
    echo "$DEPLOY_ID" > /tmp/deployment-id && \
    NEXT_DEPLOYMENT_ID="$DEPLOY_ID" pnpm --filter=my-project run build

# ---- Production Stage ----
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# standalone output includes everything needed
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# 빌드 시 결정된 deploymentId 파일을 런타임으로 가져옴
COPY --from=builder --chown=nextjs:nodejs /tmp/deployment-id ./deployment-id

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# 시작 시 파일에서 deploymentId 읽어서 env로 주입 → next.config.mjs 가 빌드 때와 같은 값을 보게 됨.
CMD ["sh", "-c", "export NEXT_DEPLOYMENT_ID=$(cat ./deployment-id) && exec node apps/web/server.js"]
