#!/usr/bin/env bash
# Build the app and package it as a prebuilt deploy zip: the built site plus
# nginx.conf and a compose file that serves it with the stock nginx image, so the
# target machine builds nothing (any CPU type). See deploy/DEPLOY.txt.
#   npm run package:deploy            -> scorm-editor-deploy-<commit>.zip
#   npm run package:deploy -- out.zip -> out.zip
set -euo pipefail
cd "$(dirname "$0")/.."

npm run build
out="${1:-scorm-editor-deploy-$(git rev-parse --short HEAD).zip}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
pkg="$tmp/scorm-editor-deploy"
mkdir -p "$pkg"
cp -R dist "$pkg/site"
cp nginx.conf "$pkg/nginx.conf"
cp deploy/docker-compose.yml deploy/DEPLOY.txt "$pkg/"
rm -f "$out"
(cd "$tmp" && zip -qrX - scorm-editor-deploy -x '*.DS_Store') > "$out"
echo "Wrote $out"
