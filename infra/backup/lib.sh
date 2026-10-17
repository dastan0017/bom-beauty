#!/bin/sh
# Shared setup for the backup jobs: rclone remotes from the environment, logging, failure alert.
set -eu
# Written by entrypoint.sh (cron jobs get no environment of their own).
if [ -r /etc/backup.env ]; then . /etc/backup.env; fi

: "${S3_ENDPOINT:?}" "${S3_ACCESS_KEY:?}" "${S3_SECRET_KEY:?}" "${S3_REGION:=us-east-1}"
: "${BACKUP_S3_ENDPOINT:?}" "${BACKUP_S3_ACCESS_KEY:?}" "${BACKUP_S3_SECRET_KEY:?}" "${BACKUP_S3_BUCKET:?}"
: "${BACKUP_S3_REGION:=us-east-1}" "${BACKUP_RETENTION_DAYS:=30}"

# `src:` is the site's storage, `dst:` the backup bucket in another location.
export RCLONE_CONFIG_SRC_TYPE=s3 RCLONE_CONFIG_SRC_PROVIDER=Other RCLONE_CONFIG_SRC_ENDPOINT="$S3_ENDPOINT" \
  RCLONE_CONFIG_SRC_ACCESS_KEY_ID="$S3_ACCESS_KEY" RCLONE_CONFIG_SRC_SECRET_ACCESS_KEY="$S3_SECRET_KEY" \
  RCLONE_CONFIG_SRC_REGION="$S3_REGION" RCLONE_CONFIG_SRC_FORCE_PATH_STYLE="${S3_FORCE_PATH_STYLE:-false}"
export RCLONE_CONFIG_DST_TYPE=s3 RCLONE_CONFIG_DST_PROVIDER=Other RCLONE_CONFIG_DST_ENDPOINT="$BACKUP_S3_ENDPOINT" \
  RCLONE_CONFIG_DST_ACCESS_KEY_ID="$BACKUP_S3_ACCESS_KEY" RCLONE_CONFIG_DST_SECRET_ACCESS_KEY="$BACKUP_S3_SECRET_KEY" \
  RCLONE_CONFIG_DST_REGION="$BACKUP_S3_REGION" RCLONE_CONFIG_DST_FORCE_PATH_STYLE="${BACKUP_S3_FORCE_PATH_STYLE:-false}"

log() { echo "$(date -Iseconds) [$JOB] $*"; }

# Telegram message to the owner's chat when a job fails (optional: needs TELEGRAM_BOT_TOKEN and BACKUP_ALERT_CHAT_ID).
alert() {
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${BACKUP_ALERT_CHAT_ID:-}" ]; then
    curl -fsS -m 10 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${BACKUP_ALERT_CHAT_ID}" \
      --data-urlencode "text=Bom Beauty: резервная копия не создана (${JOB}). Проверьте сервер." >/dev/null || true
  fi
}

# Jobs may override cleanup (temp files); the exit status is read before it runs.
cleanup() { :; }
on_exit() {
  status=$?
  cleanup
  if [ "$status" -ne 0 ]; then
    log "failed with status $status"
    alert
  fi
}
trap on_exit EXIT
