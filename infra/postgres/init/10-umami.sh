#!/bin/sh
# First start only (empty data directory): a separate database and role for Umami.
set -eu
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE ROLE umami LOGIN PASSWORD '${UMAMI_DB_PASSWORD}';
CREATE DATABASE umami OWNER umami;
SQL
