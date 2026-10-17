# syntax=docker/dockerfile:1.7
# Client site: Next.js standalone server. Build from the repo root:
#   docker build -f frontend/Dockerfile --build-arg NEXT_PUBLIC_SITE_URL=... -t bom-web .
# NEXT_PUBLIC_* values are inlined at build time (they also shape the CSP); everything else is read at runtime.

ARG NODE_IMAGE=node:24.22.0-alpine

FROM ${NODE_IMAGE} AS base
RUN corepack enable
WORKDIR /repo

FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.11.9 prune @bom/frontend --docker

FROM base AS build
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MEDIA_URL
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_MEDIA_URL=${NEXT_PUBLIC_MEDIA_URL} \
    NEXT_TELEMETRY_DISABLED=1 \
    # Only to pass the env check while building; the real values come from the runtime environment.
    INTERNAL_API_URL=http://api:4000/v1 \
    REVALIDATE_SECRET=build-time-placeholder
COPY --from=prune /repo/out/json/ ./
COPY --from=prune /repo/out/pnpm-lock.yaml /repo/out/pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ ./
RUN pnpm turbo run build --filter=@bom/frontend...

FROM ${NODE_IMAGE} AS runtime
RUN apk add --no-cache tini
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
# outputFileTracingRoot is the repo root, so the server lives at frontend/server.js inside the standalone tree.
COPY --from=build --chown=node:node /repo/frontend/.next/standalone ./
COPY --from=build --chown=node:node /repo/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=node:node /repo/frontend/public ./frontend/public
USER node
EXPOSE 3000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "frontend/server.js"]
