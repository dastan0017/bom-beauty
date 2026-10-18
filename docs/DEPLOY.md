# Deploy and operations

How Bom Beauty runs in production, how to set it up the first time, and how to operate it. Architecture background is
in `ARCHITECTURE.md` §3, §8, §12; what the owner has to provide is in `HANDOFF.md` §4.

## 1. Shape

One Hetzner Cloud VPS runs everything with Docker Compose (`infra/docker-compose.prod.yml`); Cloudflare sits in front of
every host; files live in Hetzner Object Storage; videos in Bunny Stream.

| Host                   | Through Caddy to                                      | Image / service                  |
| ---------------------- | ----------------------------------------------------- | -------------------------------- |
| `bom-beauty.com`       | `web:3000` (Next standalone); `/s/*` → Umami          | `ghcr.io/<owner>/bom-web`        |
| `www.bom-beauty.com`   | 301 to the apex                                       |                                  |
| `admin.bom-beauty.com` | `admin:8080` (static SPA, nginx unprivileged)         | `ghcr.io/<owner>/bom-admin`      |
| `api.bom-beauty.com`   | `api:4000`                                            | `ghcr.io/<owner>/bom-api`        |
| `media.bom-beauty.com` | the public bucket (GET/HEAD only)                     | Hetzner Object Storage           |
| `stats.bom-beauty.com` | `umami:3000`                                          | `ghcr.io/umami-software/umami`   |
| (internal)             | `worker` (BullMQ jobs), `postgres`, `redis`, `backup` | `bom-api --worker`, `bom-backup` |

Caddy terminates TLS with a Cloudflare Origin CA certificate, accepts the visitor's IP only from Cloudflare's ranges
(`CF-Connecting-IP`) and hands it to the apps as the only `X-Forwarded-For` entry (the API trusts one hop).

Images are built by GitHub Actions and pushed to GHCR. The site and admin images carry the public URLs, so a change of
domain means a rebuild (re-run the deploy workflow after changing the repository variables).

## 2. One-time setup

### 2.1 Cloudflare and the domain

1. The domain is registered with Cloudflare Registrar (registrant: the shop owner; renews yearly on 18 October), so the
   zone is on Cloudflare's nameservers already. With another registrar: add the zone (free plan) and switch the
   registrar's nameservers to Cloudflare's.
2. DNS, all **proxied** (orange cloud): `A` records for `@`, `www`, `admin`, `api`, `media`, `stats` → the server's
   IPv4 (and `AAAA` → IPv6 if the server has one).
3. SSL/TLS → mode **Full (strict)**; Edge certificates → **Always Use HTTPS** on, minimum TLS 1.2.
4. SSL/TLS → Origin Server → create an Origin CA certificate for `bom-beauty.com, *.bom-beauty.com` (RSA, 15 years). Save
   the certificate as `/opt/bom/certs/origin.pem` and the key as `/opt/bom/certs/origin-key.pem` (`chmod 600`).
5. Caching → Cache Rules: for hostname `media.bom-beauty.com`, "Eligible for cache", respect origin TTL (objects carry
   `max-age=31536000, immutable`). Leave the other hosts at the default (HTML and JSON are not cached).
6. Optional: Turnstile widget for `bom-beauty.com` (managed mode) → site key and secret into `.env`, then switch it on in
   the admin (Настройки → Поиск и аналитика).
7. Keep off everything that injects scripts into the pages (it breaks the CSP and React hydration): Speed → Rocket
   Loader, Scrape Shield → Email Address Obfuscation, and Web Analytics automatic setup for this hostname.

Everything above except the registration can be done with an API token scoped to the zone (Zone Read, DNS Edit, Zone
Settings Edit, SSL and Certificates Edit, Cache Rules Edit, Account Turnstile Edit).

### 2.2 Hetzner server

1. A Hetzner project of its own ("Bom Beauty"). Cloud server: Ubuntu 24.04, `CX23` (2 vCPU, 4 GB, x86; the CX22 is no
   longer sold) or larger, location `fsn1` (same as the buckets), with the deploy key `~/.ssh/bom_deploy` and
   `infra/cloud-init.yml` as user data (replace `__DEPLOY_PUBKEY__`). Cloud-init installs Docker, creates `deploy` (in
   the `docker` group, key-only), `/opt/bom{,/certs,/postgres}`, turns password login off and enables unattended
   upgrades and fail2ban; it touches `/var/lib/cloud/instance/bom-ready` when done (about 3 minutes). Keep the primary
   IPs with auto-delete off, so a rebuilt server keeps its address and the DNS records stay valid. Enable backups of the
   server itself if the budget allows (the app backups below do not depend on it).
2. Firewall `bom-web`: TCP 80 and 443 only from Cloudflare's ranges (https://www.cloudflare.com/ips/, the same list as
   the Caddyfile), TCP 22 open with key-only auth (GitHub Actions runners have no fixed IPs), ICMP.
3. `DEPLOY_KNOWN_HOSTS` must hold the server's real host key (`ssh-keyscan -t ed25519 <server IP>` from a machine you
   trust, or pre-seed the host key through cloud-init `ssh_keys` as was done for the first deploy).
4. Create `/opt/bom/.env` (2.5, `chmod 600`, owned by `deploy`) and the certificates in `/opt/bom/certs` with `scp` as
   `deploy`. The deploy workflow uploads `docker-compose.prod.yml`, `Caddyfile` and `postgres/` on every run.

### 2.3 Object Storage (Hetzner)

Three buckets; two locations so a backup survives the loss of one:

| Bucket        | Location | Access                     | Holds                                                      |
| ------------- | -------- | -------------------------- | ---------------------------------------------------------- |
| `bom-public`  | `fsn1`   | public read                | photo variants `p/…`, PDFs `d/…` (served as `media.`)      |
| `bom-private` | `fsn1`   | private                    | uploads in flight `incoming/…`, originals `orig/…`         |
| `bom-backups` | `hel1`   | private, separate key pair | `db/<date>/`, `buckets/`, `removed/<date>/` (infra/backup) |

- `bom-public` bucket policy: allow `s3:GetObject` for everyone on `arn:aws:s3:::bom-public/*`.
- `bom-private` CORS (the admin uploads straight to it with a presigned POST):
  ```json
  [
    {
      "AllowedOrigins": ["https://admin.bom-beauty.com"],
      "AllowedMethods": ["POST"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```
- **Check before launch** (ARCHITECTURE §16): upload a photo from the admin. If Hetzner rejects the presigned POST
  policy or CORS, switch to presigned PUT + `HeadObject` size check (media.service).
- `S3_FORCE_PATH_STYLE=false` in production; `VITE_UPLOAD_ORIGIN` is then the private bucket's host,
  `https://bom-private.fsn1.your-objectstorage.com`.

### 2.4 Services the owner signs up for

- **Bunny Stream**: create a video library. Into `.env`: Library ID (`BUNNY_LIBRARY_ID`), API key (`BUNNY_API_KEY`),
  CDN hostname (`BUNNY_CDN_HOST`, `vz-….b-cdn.net`). In the library settings: **MP4 fallback** on (720p), webhook URL
  `https://api.bom-beauty.com/v1/webhooks/bunny`.
- **Telegram bot**: @BotFather → `/newbot` → token into `TELEGRAM_BOT_TOKEN`. The owner writes to the bot (or adds it
  to a group); the chat id from `https://api.telegram.org/bot<token>/getUpdates` goes into the admin (Настройки →
  Уведомления), then "Проверить уведомления". Put the same chat id into `BACKUP_ALERT_CHAT_ID` for backup alerts.
- **Email** (fallback channel): any SMTP provider (Resend, Mailgun, Brevo) → `SMTP_URL`, `MAIL_FROM` on a verified
  domain.

### 2.5 Server `.env`

Start from `infra/.env.example`: the whole file, with production values. Generate secrets with `openssl rand -hex 32`.

| Variable                                                               | Production value                                                                          |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `POSTGRES_USER`, `POSTGRES_DB`                                         | `bom`, `bom`                                                                              |
| `POSTGRES_PASSWORD`, `UMAMI_DB_PASSWORD`                               | generated                                                                                 |
| `DATABASE_URL`                                                         | `postgresql://bom:<POSTGRES_PASSWORD>@postgres:5432/bom`                                  |
| `REDIS_URL`                                                            | `redis://redis:6379`                                                                      |
| `LOG_LEVEL`                                                            | `info`                                                                                    |
| `WEB_ORIGIN`, `ADMIN_ORIGIN`                                           | `https://bom-beauty.com`, `https://admin.bom-beauty.com`                                  |
| `SESSION_SECRET`, `IP_HASH_SALT`, `REVALIDATE_SECRET`                  | generated (changing `SESSION_SECRET` logs everyone out)                                   |
| `S3_ENDPOINT`, `S3_REGION`                                             | `https://fsn1.your-objectstorage.com`, `fsn1`                                             |
| `S3_ACCESS_KEY`, `S3_SECRET_KEY`                                       | the `fsn1` key pair                                                                       |
| `S3_FORCE_PATH_STYLE`                                                  | `false`                                                                                   |
| `MEDIA_PUBLIC_URL`                                                     | `https://media.bom-beauty.com`                                                            |
| `MEDIA_UPSTREAM`                                                       | `bom-public.fsn1.your-objectstorage.com`                                                  |
| `BACKUP_S3_*`                                                          | the `hel1` endpoint, region and its own key pair                                          |
| `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_MEDIA_URL` | `https://bom-beauty.com`, `https://api.bom-beauty.com/v1`, `https://media.bom-beauty.com` |
| `GHCR_OWNER`                                                           | the GitHub user or organisation that owns the repository                                  |
| `INDEXNOW_KEY`                                                         | 32 random hex characters                                                                  |
| `SEED_OWNER_*`                                                         | leave empty: the owner account is created with the CLI (§3)                               |

Compose sets `NODE_ENV`, `API_PORT`, `TRUST_PROXY`, `RUN_WORKER_IN_API`, `WEB_INTERNAL_URL` and `INTERNAL_API_URL`
itself. `.env` stays on the server only (`chmod 600`); it never goes into the repository or GitHub.

### 2.6 GitHub

Repository → Settings:

- **Variables**: `SITE_URL=https://bom-beauty.com`, `API_URL=https://api.bom-beauty.com`, `MEDIA_URL=https://media.bom-beauty.com`,
  `ADMIN_URL=https://admin.bom-beauty.com`, `UPLOAD_ORIGIN=https://bom-private.fsn1.your-objectstorage.com`,
  `DEPLOY_HOST=<server IP>`, `DEPLOY_USER=deploy`.
- **Secrets**: `DEPLOY_SSH_KEY` (private key of a pair made for deploys only), `DEPLOY_KNOWN_HOSTS`
  (`ssh-keyscan <server IP>`), `GHCR_READ_TOKEN` (a token with `read:packages`, used by the server to pull images).
- **Environments**: `production` (add required reviewers if deploys should wait for approval).

## 3. First deploy

1. Push `main` (or run **Deploy** manually). CI must pass; the workflow builds the four images, uploads the infra files,
   pulls, runs `prisma migrate deploy` and starts the stack. It fails if `/health/ready`, the site or the admin do not
   answer.
2. Load the starting catalog and texts from the design (idempotent; never touches rows the owner has changed):
   ```sh
   cd /opt/bom && docker compose -f docker-compose.prod.yml run --rm api node dist/seed/seed.js
   ```
3. Create the owner account; the password is printed once:
   ```sh
   docker compose -f docker-compose.prod.yml run --rm api node dist/cli.js create-admin --email <owner email> --name "Нурайым Бекиева"
   ```
   Without an SSH session, steps 2 and 3 (and backups, the restore drill and a status check) run through the **Ops**
   workflow: `gh workflow run ops.yml -f task=seed`, or `-f task=create-admin -f email=… -f name=… -f pubkey_b64=…`.
   The generated password then appears in the job log only encrypted to that RSA public key (decrypt command in the
   workflow header).
4. Umami: open `https://stats.bom-beauty.com`, log in as `admin` / `umami`, **change the password**, add the website
   `bom-beauty.com`, and paste its website id into the admin (Настройки → Поиск и аналитика).
5. Check, in this order:
   - [ ] Site pages at 390 px and 1280 px; an order from a product opens WhatsApp and shows up in the admin.
   - [ ] Admin login; upload a product photo (proves presigned POST and CORS on Hetzner) and a protocol PDF.
   - [ ] Upload a short video (Bunny): it turns "Загружено" within minutes and plays on the program page.
   - [ ] Настройки → Уведомления → "Проверить уведомления" reaches Telegram (and email if set).
   - [ ] Change a price in the admin: the site shows it within seconds (revalidation).
   - [ ] `curl -I https://bom-beauty.com` shows the CSP and HSTS; `https://admin.bom-beauty.com` refuses framing.
   - [ ] Backups: `docker compose -f docker-compose.prod.yml exec backup su backup -s /bin/sh -c backup-db.sh`, then
         the restore drill in `infra/scripts/restore.md` once.
   - [ ] Search: Google Search Console and Yandex Webmaster verification codes into the admin, submit
         `https://bom-beauty.com/sitemap.xml`.
   - [ ] An external uptime monitor (UptimeRobot, Better Stack free tier) on `https://bom-beauty.com/health` and
         `https://api.bom-beauty.com/health/ready`. Optional on-box Uptime Kuma: `--profile monitoring`, reachable
         through an SSH tunnel to `127.0.0.1:3001`.

## 4. Operations

**Deploy**: every push to `main` that passes CI. Images are tagged with the commit SHA; `/opt/bom/.deployed` records the
running one.

**Image storage**: the four GHCR packages (`bom-api`, `bom-web`, `bom-admin`, `bom-backup`) are public, so they do not
count against GitHub Packages storage (the code in them is not secret; secrets live only in the server's `.env`). The
deploy still keeps the three newest versions of each image (`prune-images`). If the repository and packages are ever
made private again, the 500 MB Free plan limit applies (one release is about 330 MB compressed, mostly shared layers).

**Rollback**: `cd /opt/bom && IMAGE_TAG=<previous sha> docker compose -f docker-compose.prod.yml up -d`. Migrations
only go forward: keep schema changes additive (new columns nullable, drop in a later release), so the previous image
still runs on the new schema. If data was damaged, restore the database (`infra/scripts/restore.md`).

**Logs**: `docker compose -f docker-compose.prod.yml logs -f --tail=200 api worker web`. The API logs JSON with request
ids and never logs phones, names, addresses, cookies or tokens. Docker keeps 5 × 10 MB per container.

**Backups**: nightly at 03:30 Bishkek time (database, 30 days), Sundays at 04:00 (both buckets mirrored; files deleted
or replaced in the week stay 30 days under `removed/<date>/`). A failed job writes to the container log and, with
`BACKUP_ALERT_CHAT_ID`, to Telegram. Bunny keeps its own copies of the videos.

**Secrets**: rotate in `.env`, then `docker compose -f docker-compose.prod.yml up -d`. `SESSION_SECRET` logs everyone
out; `REVALIDATE_SECRET` must match for `web` and `api` (both read the same `.env`).

**Cloudflare ranges**: the Caddyfile lists them (matched with https://www.cloudflare.com/ips/ on 2026-10-17); update the
list and the server firewall together when Cloudflare announces a change.

**Postgres major upgrade**: dump with the backup job, start a new data volume on the new version, restore
(`restore.md`), switch.

| Symptom                                 | Look at                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| Site shows "Что-то пошло не так"        | `api` health and logs; `web` reaches it as `http://api:4000/v1`                               |
| Admin changes do not appear on the site | `worker` logs (`web.revalidate`); `REVALIDATE_SECRET` equal for both                          |
| Photos stuck on "Обрабатываем…"         | `worker` logs (`media.process`), bucket keys and endpoint                                     |
| Uploads fail in the admin               | browser console: CORS on `bom-private`, or `VITE_UPLOAD_ORIGIN` not matching the CSP          |
| Every visitor rate-limited at once      | `TRUST_PROXY=1` and Caddy's `trusted_proxies`; the API must see visitor IPs, not Cloudflare's |
| No Telegram messages                    | Настройки → Уведомления → test; `TELEGRAM_BOT_TOKEN`; the owner must have written to the bot  |
