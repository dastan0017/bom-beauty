# syntax=docker/dockerfile:1.7
# API and worker image (one image, two commands). Build from the repo root:
#   docker build -f backend/Dockerfile -t bom-api .
# Runs as the unprivileged `node` user. Commands: `node dist/main.js` (API), `node dist/main.js --worker`,
# `node_modules/.bin/prisma migrate deploy`, `node dist/seed/seed.js`, `node dist/cli.js create-admin ...`.

ARG NODE_IMAGE=node:24.22.0-alpine

FROM ${NODE_IMAGE} AS base
RUN corepack enable
WORKDIR /repo

# Only the packages the API needs, with their lockfile slice.
FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.11.9 prune @bom/backend --docker

FROM base AS build
# Prisma reads DATABASE_URL while loading its config; generation never connects.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY --from=prune /repo/out/json/ ./
COPY --from=prune /repo/out/pnpm-lock.yaml /repo/out/pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ ./
RUN pnpm turbo run build --filter=@bom/backend...
# Self-contained production tree: dist, prisma/ (migrations), runtime dependencies incl. @bom/shared.
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm --filter @bom/backend deploy --prod --legacy /out

FROM ${NODE_IMAGE} AS runtime
# openssl for Prisma's schema engine (migrate deploy); tini reaps and forwards signals.
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 4000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
