# Bom Beauty

Client site, owner admin and API for Bom Beauty, a Korean professional skincare shop in Kyrgyzstan.

## Quick start

Requirements: Node 24 (`.tool-versions` / `.nvmrc`), Docker, pnpm via corepack (`corepack enable pnpm`).

```sh
pnpm install
pnpm dev        # creates .env from infra/.env.example, starts Docker services and all apps
```

| URL                          | What                                                |
| ---------------------------- | --------------------------------------------------- |
| http://localhost:3100        | client site                                         |
| http://localhost:5173        | admin                                               |
| http://localhost:4000/health | API (routes under `/v1`)                            |
| http://localhost:9000        | S3 (SeaweedFS), buckets `bom-public`, `bom-private` |
| http://localhost:8025        | Mailpit (outgoing mail)                             |

Postgres listens on `localhost:5434`, Redis on `6379`.

Checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`. End-to-end flows (needs `pnpm dev` running, first time
`pnpm --filter @bom/frontend exec playwright install chromium`): `pnpm e2e`. They create real orders and leads in the
dev database.

## Docs

- [CLAUDE.md](CLAUDE.md): conventions
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): system, flows, decisions
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md), [docs/API.md](docs/API.md)
- [docs/TASKS.md](docs/TASKS.md): milestones
- [docs/HANDOFF.md](docs/HANDOFF.md): what the owner needs to provide (in Russian)
