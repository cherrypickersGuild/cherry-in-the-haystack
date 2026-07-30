# ---- Build Stage ----
FROM node:20-alpine AS builder

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Copy workspace manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/

# Install dependencies (api only)
RUN pnpm install --frozen-lockfile --filter=api...

# Copy source and build
COPY apps/api ./apps/api
RUN cd apps/api && ./node_modules/.bin/nest build

# ---- Production Stage ----
FROM node:20-alpine AS runner

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace manifests for prod install
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --filter=api... --prod

# Copy built output
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy seed config data (Frameworks/Prompting Landscape + Overview config JSON).
# DATA_DIR 환경변수를 /app/apps/api/storage 로 지정해 이 경로를 읽게 한다.
# (영속 편집이 필요하면 이 경로에 퍼시스턴트 볼륨을 마운트)
COPY apps/api/storage ./apps/api/storage

EXPOSE 4000

CMD ["node", "apps/api/dist/main"]
