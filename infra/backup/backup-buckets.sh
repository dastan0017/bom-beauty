#!/bin/sh
# Weekly: mirror both buckets to dst:<bucket>/buckets/<name>/. Files deleted or replaced since the last run move to
# dst:<bucket>/removed/<date>/ and are kept BACKUP_RETENTION_DAYS, so a mistaken delete in the admin can be undone.
JOB=buckets
. /usr/local/bin/lib.sh

: "${S3_PUBLIC_BUCKET:?}" "${S3_PRIVATE_BUCKET:?}"
day=$(date +%F)
for bucket in "$S3_PUBLIC_BUCKET" "$S3_PRIVATE_BUCKET"; do
  rclone sync "src:$bucket" "dst:$BACKUP_S3_BUCKET/buckets/$bucket" \
    --backup-dir "dst:$BACKUP_S3_BUCKET/removed/$day/$bucket" --s3-no-check-bucket --fast-list
done
rclone delete "dst:$BACKUP_S3_BUCKET/removed" --min-age "${BACKUP_RETENTION_DAYS}d" --s3-no-check-bucket || true
rclone rmdirs "dst:$BACKUP_S3_BUCKET/removed" --leave-root --s3-no-check-bucket || true
log "ok: $S3_PUBLIC_BUCKET, $S3_PRIVATE_BUCKET → buckets/"
