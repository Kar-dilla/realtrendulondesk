#!/usr/bin/env bash
# usage: bash scripts/collect.sh file1 file2 ...   -> writes .bundle.txt
out=.bundle.txt
: > "$out"
for f in "$@"; do
  if [ -f "$f" ]; then
    printf '\n===== FILE: %s =====\n' "$f" >> "$out"
    cat "$f" >> "$out"
  else
    echo "MISSING: $f"
  fi
done
echo "bundle: $(wc -l < "$out") lines -> $out"
