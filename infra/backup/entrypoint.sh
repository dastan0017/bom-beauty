#!/bin/sh
# busybox crond starts jobs with an empty environment: hand them the container's settings through a file only the
# `backup` user can read. Then run crond (or the given command, e.g. a manual backup).
set -eu
env | grep -E '^(S3_|BACKUP_|POSTGRES_|UMAMI_DB_PASSWORD=|TELEGRAM_BOT_TOKEN=|TZ=)' \
  | sed "s/'/'\\\\''/g; s/=/='/; s/\$/'/; s/^/export /" > /etc/backup.env
chown backup:backup /etc/backup.env
chmod 0400 /etc/backup.env
exec "$@"
