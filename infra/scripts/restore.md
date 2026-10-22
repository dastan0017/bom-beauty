# Restore

Backups live in the backup bucket (`BACKUP_S3_BUCKET`, another Hetzner location), written by the `backup` service
(`infra/backup`): `db/<date>/bom.dump` and `db/<date>/umami.dump` nightly (pg_dump custom format),
`db/<date>-pre-migrate-<sha>/` taken by the deploy right before it applies new migrations (restore one of these to undo
a release whose migration went wrong), `buckets/<bucket>/` weekly mirrors, and `removed/<date>/<bucket>/` for files
deleted or replaced during the week before. All kept 30 days.

Run everything from `/opt/bom` on the server. The backup image has `pg_restore`, `psql` and `rclone`; its entrypoint
loads the remotes `src:` (site storage) and `dst:` (backups) from `.env`.

```sh
compose() { docker compose -f docker-compose.prod.yml "$@"; }
shell() { compose run --rm --entrypoint sh backup -c "JOB=restore; . /usr/local/bin/lib.sh; $*"; }
```

## Database

1. Pick the dump: `shell 'rclone lsf dst:$BACKUP_S3_BUCKET/db/'`.
2. Restore into a **new** database first and look at it:
   ```sh
   shell 'rclone copy dst:$BACKUP_S3_BUCKET/db/2026-10-17/bom.dump /tmp/r &&
     export PGPASSWORD=$POSTGRES_PASSWORD &&
     createdb -h postgres -U $POSTGRES_USER bom_restore &&
     pg_restore -h postgres -U $POSTGRES_USER -d bom_restore --no-owner --exit-on-error /tmp/r/bom.dump &&
     psql -h postgres -U $POSTGRES_USER -d bom_restore -c "select count(*) from orders"'
   ```
3. To switch over: stop the writers, swap the databases, start again.
   ```sh
   compose stop api worker web
   shell 'export PGPASSWORD=$POSTGRES_PASSWORD &&
     psql -h postgres -U $POSTGRES_USER -d postgres -c "alter database bom rename to bom_broken" &&
     psql -h postgres -U $POSTGRES_USER -d postgres -c "alter database bom_restore rename to bom"'
   compose up -d
   ```
   Drop `bom_broken` once the site and the admin look right. Umami restores the same way from `umami.dump` (as the
   `umami` role, `UMAMI_DB_PASSWORD`).

## Files

- One file: `shell 'rclone copy dst:$BACKUP_S3_BUCKET/removed/<date>/bom-public/p/<id> src:bom-public/p/<id>'` (or
  from `buckets/…` for the last weekly state).
- A whole bucket: `shell 'rclone sync dst:$BACKUP_S3_BUCKET/buckets/bom-public src:bom-public'`. Database rows point
  at file keys, so restore files and database from the same week.

## Drill log

| Date       | Where                                | What                                                                                                                                             | Result |
| ---------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| 2026-10-17 | dev stack (SeaweedFS as S3)          | `backup-db.sh`, `backup-buckets.sh`; restore `bom.dump` into `bom_restore`; row counts of 8 tables compared                                      | match  |
| 2026-10-18 | production (`bom-prod`, fsn1 → hel1) | Ops workflow: `backup-db`, `backup-buckets`, `restore-drill` (`db/2026-10-18/bom.dump` into `bom_restore`); row counts of all 19 tables compared | match  |

Repeat the drill on production after the first deploy and then every few months; add a row each time.
