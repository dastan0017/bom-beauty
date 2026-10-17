# syntax=docker/dockerfile:1.7
# Admin SPA: static files behind an unprivileged nginx. Build from the repo root:
#   docker build -f admin/Dockerfile --build-arg VITE_API_URL=... -t bom-admin .
# VITE_* values are inlined at build time and also shape the CSP written into index.html (admin/csp.ts).

ARG NODE_IMAGE=node:24.22.0-alpine

FROM ${NODE_IMAGE} AS base
RUN corepack enable
WORKDIR /repo

FROM base AS prune
COPY . .
RUN pnpm dlx turbo@2.11.9 prune @bom/admin --docker

FROM base AS build
ARG VITE_API_URL
ARG VITE_SITE_URL
ARG VITE_MEDIA_URL
ARG VITE_UPLOAD_ORIGIN
ENV VITE_API_URL=${VITE_API_URL} \
    VITE_SITE_URL=${VITE_SITE_URL} \
    VITE_MEDIA_URL=${VITE_MEDIA_URL} \
    VITE_UPLOAD_ORIGIN=${VITE_UPLOAD_ORIGIN}
COPY --from=prune /repo/out/json/ ./
COPY --from=prune /repo/out/pnpm-lock.yaml /repo/out/pnpm-workspace.yaml ./
COPY patches ./patches
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
COPY --from=prune /repo/out/full/ ./
RUN pnpm turbo run build --filter=@bom/admin...

FROM nginxinc/nginx-unprivileged:1.29-alpine AS runtime
COPY admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/admin/dist /usr/share/nginx/html
EXPOSE 8080
