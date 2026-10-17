# Backups (docs/DEPLOY.md §Backups): nightly pg_dump of the app and Umami databases, weekly copy of both buckets,
# all to a backup bucket in another Hetzner location. Build from the repo root:
#   docker build -f infra/backup/Dockerfile -t bom-backup .
FROM alpine:3.22
RUN apk add --no-cache postgresql16-client rclone tzdata curl \
    && addgroup -S backup && adduser -S -G backup backup \
    # Remotes come from RCLONE_CONFIG_* variables (lib.sh); an empty file keeps rclone from asking for one.
    && mkdir -p /home/backup/.config/rclone /root/.config/rclone \
    && touch /home/backup/.config/rclone/rclone.conf /root/.config/rclone/rclone.conf \
    && chown -R backup:backup /home/backup/.config
COPY infra/backup/backup-db.sh infra/backup/backup-buckets.sh infra/backup/lib.sh infra/backup/entrypoint.sh /usr/local/bin/
COPY infra/backup/crontab /etc/crontabs/backup
RUN chmod 0755 /usr/local/bin/*.sh
ENV TZ=Asia/Bishkek
# busybox crond needs root to switch to the job's user; the jobs themselves run as `backup`.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["crond", "-f", "-l", "8"]
