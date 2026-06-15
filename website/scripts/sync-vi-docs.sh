#!/usr/bin/env bash
# Docusaurus i18n requires a folder at i18n/vi/.../current — mirror from website/docs/vi (do not edit the mirror).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/vi"
DEST="$ROOT/i18n/vi/docusaurus-plugin-content-docs/current"

if [ ! -d "$SRC" ]; then
  echo "Missing $SRC — edit website/docs/vi/" >&2
  exit 1
fi

mkdir -p "$(dirname "$DEST")"
rsync -a --delete "$SRC/" "$DEST/"
echo "Synced website/docs/vi → i18n mirror (edit website/docs/vi only)"
