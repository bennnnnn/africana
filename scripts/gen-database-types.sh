#!/usr/bin/env bash
# Regenerate Supabase Database types without CLI banner lines in the output file.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/src/types/database.ts"
supabase gen types typescript --linked 2>/dev/null \
  | grep -v '^A new version of Supabase CLI' \
  | grep -v '^We recommend updating regularly' \
  > "$OUT"
echo "Wrote $OUT ($(wc -l < "$OUT") lines)"
