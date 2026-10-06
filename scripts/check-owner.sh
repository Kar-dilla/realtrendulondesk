#!/usr/bin/env bash
# Usage: bash scripts/check-owner.sh p03
# Run AFTER pasting a dev's files and BEFORE committing.
# Lists every changed or new file, and flags any that sit outside that package's folders.
set -u
id="${1:-}"
if [ -z "$id" ]; then echo "Usage: bash scripts/check-owner.sh p03"; exit 2; fi

line=$(grep -E "^${id}[[:space:]]" scripts/ownership.txt || true)
if [ -z "$line" ]; then echo "Unknown package '$id'. See scripts/ownership.txt"; exit 2; fi
read -r -a owned <<< "${line#"$id"}"

bad=0
count=0
while IFS= read -r raw; do
  [ -z "$raw" ] && continue
  path="${raw:3}"
  path="${path##* -> }"      # renames: keep the new path
  path="${path#\"}"; path="${path%\"}"
  count=$((count + 1))
  allowed=0
  for prefix in "${owned[@]}"; do
    case "$path" in "$prefix"*) allowed=1; break ;; esac
  done
  if [ "$allowed" -eq 0 ]; then
    echo "OUTSIDE  $path"
    bad=$((bad + 1))
  fi
done < <(git status --porcelain -uall)

echo "-----"
echo "$count changed file(s), $bad outside $id's folders."
if [ "$bad" -gt 0 ]; then
  echo "Do NOT commit. Undo the OUTSIDE files (git checkout -- <file>  or  rm <file> if new) and ask the Lead."
  exit 1
fi
echo "Clean. Safe to run: npm run typecheck && npm test && npm run build"
