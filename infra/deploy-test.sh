#!/bin/sh
# SSH forced command of the GitHub deploy key (docs/kitelepites-teszt.md): the key can run only this.
# Reads `git archive` output on stdin, replaces the source tree and rebuilds the test stack.
set -eu

APP=/opt/mine-erp/app
rm -rf "$APP.new"
mkdir -p "$APP.new"
tar -xzf - -C "$APP.new"
rm -rf "$APP"
mv "$APP.new" "$APP"

cd "$APP"
docker compose -f infra/docker-compose.test.yml up -d --build --remove-orphans
docker image prune -f
