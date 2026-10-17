#!/bin/sh
# Nightly: custom-format dumps of the app and Umami databases to dst:<bucket>/db/<date>/, kept BACKUP_RETENTION_DAYS.
JOB=db
. /usr/local/bin/lib.sh

: "${POSTGRES_HOST:=postgres}" "${POSTGRES_USER:?}" "${POSTGRES_PASSWORD:?}" "${POSTGRES_DB:?}"
day=$(date +%F)
work=$(mktemp -d)
cleanup() { rm -rf "$work"; }

export PGPASSWORD="$POSTGRES_PASSWORD"
pg_dump -h "$POSTGRES_HOST" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -Z 6 -f "$work/$POSTGRES_DB.dump"
if [ -n "${UMAMI_DB_PASSWORD:-}" ]; then
  PGPASSWORD="$UMAMI_DB_PASSWORD" pg_dump -h "$POSTGRES_HOST" -U umami -d umami -Fc -Z 6 -f "$work/umami.dump"
fi
rclone copy "$work" "dst:$BACKUP_S3_BUCKET/db/$day" --s3-no-check-bucket
rclone delete "dst:$BACKUP_S3_BUCKET/db" --min-age "${BACKUP_RETENTION_DAYS}d" --s3-no-check-bucket
rclone rmdirs "dst:$BACKUP_S3_BUCKET/db" --leave-root --s3-no-check-bucket || true
log "ok: $(ls "$work" | tr '\n' ' ')→ db/$day"
