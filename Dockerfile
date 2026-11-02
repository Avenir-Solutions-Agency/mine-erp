# One image for the whole workspace: web, api, worker and the migration job differ only in their command
# (infra/docker-compose.test.yml). The packages run as TypeScript under Node type stripping, so they
# must stay at their workspace paths; a slim per-app image would need a bundler first.
# Debian, not Alpine: the Temporal worker's native core-bridge ships glibc binaries.
FROM node:22.23.3-bookworm-slim

ENV CI=true \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && mkdir /app && chown node:node /app
USER node
WORKDIR /app

# Dependencies first, so a code-only change reuses this layer.
COPY --chown=node:node pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm fetch

COPY --chown=node:node . .
RUN pnpm install --offline --frozen-lockfile \
 && pnpm turbo run build --filter=@mine-erp/web --filter=@mine-erp/api

ENV NODE_ENV=production
