#!/usr/bin/env bash
# scripts/collect_i18n_strings.sh
#
# Polyclaw 日本語化用 — リポジトリ全体から英語文字列を抽出して
# docs/i18n/inventory.csv に書き出すユーティリティ。
#
# 使い方:
#   bash scripts/collect_i18n_strings.sh         # 既存翻訳を保持して再生成
#   RESET=1 bash scripts/collect_i18n_strings.sh # 既存翻訳を破棄して完全再生成
#
# 出力:
#   docs/i18n/inventory.csv     (UTF-8, ヘッダ付き CSV)
#   docs/i18n/inventory.csv.bak (上書き前のバックアップ、存在時のみ)
#
# 進捗保持の挙動:
#   既存の inventory.csv があれば、"english" 列をキーに
#   proposed_ja / status / reviewer / notes をマージし、
#   Phase 1 以降の翻訳進捗を失わずに再生成できる。
#   ソースから消えた英文の翻訳は自動的に脱落する (掃除も兼ねる)。
#   RESET=1 で全件 pending として完全リセット可能。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
OUT_DIR="$REPO_ROOT/docs/i18n"
OUTPUT="$OUT_DIR/inventory.csv"
WORK_DIR="$OUT_DIR/.collect_i18n.$$"

mkdir -p "$OUT_DIR" "$WORK_DIR"
trap 'rm -rf "$WORK_DIR"' EXIT

FRONTEND_OUT="$WORK_DIR/frontend.csv"
BACKEND_OUT="$WORK_DIR/backend.csv"
TUI_OUT="$WORK_DIR/tui.csv"
TEMPLATE_OUT="$WORK_DIR/template.csv"
SKILL_OUT="$WORK_DIR/skill.csv"
ALL_ROWS="$WORK_DIR/all_rows.csv"

: > "$FRONTEND_OUT"
: > "$BACKEND_OUT"
: > "$TUI_OUT"
: > "$TEMPLATE_OUT"
: > "$SKILL_OUT"

write_csv_header() {
  printf 'id,layer,source_path,line,english,proposed_ja,status,reviewer,notes\n'
}

count_rows() {
  wc -l < "$1" | tr -d ' '
}

collect_frontend() {
  local out="$1"

  printf '[1/5] Collecting frontend...\n' >&2

  {
    grep -rEIn \
      --include='*.tsx' \
      --include='*.ts' \
      -e ">[[:space:]]*[A-Za-z][A-Za-z0-9 ,.'!?:;()/_-]{2,}[[:space:]]*<" \
      -e '(placeholder|title|aria-label|alt|label)="[^"]{3,}"' \
      -e "(placeholder|title|aria-label|alt|label)='[^']{3,}'" \
      -e '(toast[[:alnum:]_.]*|alert|throw[[:space:]]+new[[:space:]]+Error)[[:space:]]*\(' \
      -e '<button[^>]*>[^<]{3,}</button>' \
      "$REPO_ROOT/app/frontend/src" || true
  } | awk -v layer="frontend" -v root="$REPO_ROOT" '
function parse_grep_record(record, parts, i) {
  split(record, parts, ":")
  path = parts[1]
  line_no = parts[2]
  source = parts[3]
  for (i = 4; i <= length(parts); i++) source = source ":" parts[i]
}
function relpath(path) {
  if (index(path, root "/") == 1) return substr(path, length(root) + 2)
  return path
}
function clean(text) {
  gsub(/\\n/, " ", text)
  gsub(/\\t/, " ", text)
  gsub(/&nbsp;/, " ", text)
  gsub(/&amp;/, "\\&", text)
  gsub(/^[[:space:]]+/, "", text)
  gsub(/[[:space:]]+$/, "", text)
  gsub(/[[:space:]]+/, " ", text)
  return text
}
function should_emit(text) {
  if (text == "" || length(text) < 3) return 0
  if (text !~ /[A-Za-z]/ || text !~ /[a-z]/) return 0
  if (text ~ /[A-Z][A-Z0-9]+_[A-Z0-9_]+/) return 0
  if (text ~ /^[A-Z0-9_ .:;()\/-]+$/) return 0
  if (text ~ /^(https?|wss?):\/\//) return 0
  if (text ~ /^[[:alnum:][:punct:]_-]+$/ && text !~ /[[:space:]]/ && length(text) <= 3) return 0
  return 1
}
function emit(path, line_no, text, rel, key) {
  text = clean(text)
  if (!should_emit(text)) return
  rel = relpath(path)
  key = layer SUBSEP rel SUBSEP line_no SUBSEP text
  if (key in emitted) return
  emitted[key] = 1
  gsub(/"/, "\"\"", text)
  printf "%s,%s,%s,\"%s\",\"\",pending,,\n", layer, rel, line_no, text
}
function quoted_after_double(match_text, text) {
  text = match_text
  sub(/^[^"]*"/, "", text)
  sub(/"[^"]*$/, "", text)
  return text
}
function quoted_after_single(match_text, text) {
  text = match_text
  sub(/^[^\047]*\047/, "", text)
  sub(/\047[^\047]*$/, "", text)
  return text
}
function extract_jsx(s, rest, match_text, text) {
  rest = s
  while (match(rest, />[[:space:]]*[^<>{}]*[A-Za-z][^<>{}]*[[:space:]]*</)) {
    match_text = substr(rest, RSTART, RLENGTH)
    text = match_text
    sub(/^>[[:space:]]*/, "", text)
    sub(/[[:space:]]*<$/, "", text)
    emit(path, line_no, text)
    rest = substr(rest, RSTART + RLENGTH)
  }

  rest = s
  while (match(rest, /<button[^>]*>[^<]{3,}<\/button>/)) {
    match_text = substr(rest, RSTART, RLENGTH)
    text = match_text
    sub(/^<button[^>]*>/, "", text)
    sub(/<\/button>$/, "", text)
    emit(path, line_no, text)
    rest = substr(rest, RSTART + RLENGTH)
  }
}
function extract_attrs(s, rest, match_text, text) {
  rest = s
  while (match(rest, /(placeholder|title|aria-label|alt|label)="[^"]{3,}"/)) {
    match_text = substr(rest, RSTART, RLENGTH)
    text = quoted_after_double(match_text)
    emit(path, line_no, text)
    rest = substr(rest, RSTART + RLENGTH)
  }

  rest = s
  while (match(rest, /(placeholder|title|aria-label|alt|label)=\047[^\047]{3,}\047/)) {
    match_text = substr(rest, RSTART, RLENGTH)
    text = quoted_after_single(match_text)
    emit(path, line_no, text)
    rest = substr(rest, RSTART + RLENGTH)
  }
}
function extract_calls(s, rest, match_text, text) {
  rest = s
  while (match(rest, /(toast[[:alnum:]_.]*|alert)[[:space:]]*\([[:space:]]*"[^"]{3,}"/)) {
    match_text = substr(rest, RSTART, RLENGTH)
    text = quoted_after_double(match_text)
    emit(path, line_no, text)
    rest = substr(rest, RSTART + RLENGTH)
  }

  rest = s
  while (match(rest, /(toast[[:alnum:]_.]*|alert)[[:space:]]*\([[:space:]]*\047[^\047]{3,}\047/)) {
    match_text = substr(rest, RSTART, RLENGTH)
    text = quoted_after_single(match_text)
    emit(path, line_no, text)
    rest = substr(rest, RSTART + RLENGTH)
  }

  rest = s
  while (match(rest, /throw[[:space:]]+new[[:space:]]+Error[[:space:]]*\([[:space:]]*"[^"]{3,}"/)) {
    match_text = substr(rest, RSTART, RLENGTH)
    text = quoted_after_double(match_text)
    emit(path, line_no, text)
    rest = substr(rest, RSTART + RLENGTH)
  }

  rest = s
  while (match(rest, /throw[[:space:]]+new[[:space:]]+Error[[:space:]]*\([[:space:]]*\047[^\047]{3,}\047/)) {
    match_text = substr(rest, RSTART, RLENGTH)
    text = quoted_after_single(match_text)
    emit(path, line_no, text)
    rest = substr(rest, RSTART + RLENGTH)
  }
}
{
  parse_grep_record($0)
  if (path ~ /\/mock-server\.ts$/) next
  if (source ~ /^[[:space:]]*(import|from)[[:space:]]/) next
  if (source ~ /console\.log[[:space:]]*\(/) next

  extract_jsx(source)
  extract_attrs(source)
  extract_calls(source)
}' >> "$out"
}

collect_backend() {
  local out="$1"

  printf '[2/5] Collecting backend...\n' >&2

  {
    grep -rEIn \
      --include='*.py' \
      -e '(_reply|reply|error_response|notify|send_activity|web\.json_response)' \
      -e 'raise[[:space:]]+(ValueError|RuntimeError)[[:space:]]*\(' \
      -e '(toast|alert)' \
      "$REPO_ROOT/app/runtime" || true
  } | awk -v layer="backend" -v root="$REPO_ROOT" '
function parse_grep_record(record, parts, i) {
  split(record, parts, ":")
  path = parts[1]
  line_no = parts[2]
  source = parts[3]
  for (i = 4; i <= length(parts); i++) source = source ":" parts[i]
}
function relpath(path) {
  if (index(path, root "/") == 1) return substr(path, length(root) + 2)
  return path
}
function clean(text) {
  gsub(/\\n/, " ", text)
  gsub(/\\t/, " ", text)
  gsub(/^[[:space:]]+/, "", text)
  gsub(/[[:space:]]+$/, "", text)
  gsub(/[[:space:]]+/, " ", text)
  return text
}
function should_emit(text) {
  if (text == "" || length(text) < 3) return 0
  if (text !~ /[A-Za-z]/ || text !~ /[a-z]/) return 0
  if (text ~ /[A-Z][A-Z0-9]+_[A-Z0-9_]+/) return 0
  if (text ~ /^[A-Z0-9_ .:;()\/-]+$/) return 0
  if (text ~ /^(https?|wss?):\/\//) return 0
  return 1
}
function emit(path, line_no, text, rel, key) {
  text = clean(text)
  if (!should_emit(text)) return
  rel = relpath(path)
  key = layer SUBSEP rel SUBSEP line_no SUBSEP text
  if (key in emitted) return
  emitted[key] = 1
  gsub(/"/, "\"\"", text)
  printf "%s,%s,%s,\"%s\",\"\",pending,,\n", layer, rel, line_no, text
}
function quoted_double(match_text, text) {
  text = match_text
  sub(/^[^"]*"/, "", text)
  sub(/"[^"]*$/, "", text)
  return text
}
function quoted_single(match_text, text) {
  text = match_text
  sub(/^[^\047]*\047/, "", text)
  sub(/\047[^\047]*$/, "", text)
  return text
}
function extract_pattern_double(s, pattern, rest, match_text) {
  rest = s
  while (match(rest, pattern)) {
    match_text = substr(rest, RSTART, RLENGTH)
    emit(path, line_no, quoted_double(match_text))
    rest = substr(rest, RSTART + RLENGTH)
  }
}
function extract_pattern_single(s, pattern, rest, match_text) {
  rest = s
  while (match(rest, pattern)) {
    match_text = substr(rest, RSTART, RLENGTH)
    emit(path, line_no, quoted_single(match_text))
    rest = substr(rest, RSTART + RLENGTH)
  }
}
{
  parse_grep_record($0)
  if (path ~ /\/tests\//) next
  if (source ~ /^[[:space:]]*#/) next
  if (source ~ /^[[:space:]]*(import|from)[[:space:]]/) next
  if (source ~ /^[[:space:]]*[A-Z][A-Z0-9_]*[[:space:]]*=/) next
  if (source ~ /logger\.[a-z]+[[:space:]]*\(/) next
  if (source ~ /"""|\047\047\047/) next

  extract_pattern_double(source, "(_reply|reply|notify)[[:space:]]*\\([^\\042]*\\042[^\\042]{3,}\\042")
  extract_pattern_single(source, "(_reply|reply|notify)[[:space:]]*\\([^\\047]*\\047[^\\047]{3,}\\047")
  extract_pattern_double(source, "error_response[[:space:]]*\\([^\\042]*message[[:space:]]*=[[:space:]]*\\042[^\\042]{3,}\\042")
  extract_pattern_single(source, "error_response[[:space:]]*\\([^\\047]*message[[:space:]]*=[[:space:]]*\\047[^\\047]{3,}\\047")
  extract_pattern_double(source, "send_activity[[:space:]]*\\([^\\042]*text[[:space:]]*=[[:space:]]*\\042[^\\042]{3,}\\042")
  extract_pattern_single(source, "send_activity[[:space:]]*\\([^\\047]*text[[:space:]]*=[[:space:]]*\\047[^\\047]{3,}\\047")
  extract_pattern_double(source, "[\\042\\047]message[\\042\\047][[:space:]]*:[[:space:]]*\\042[^\\042]{3,}\\042")
  extract_pattern_single(source, "[\\042\\047]message[\\042\\047][[:space:]]*:[[:space:]]*\\047[^\\047]{3,}\\047")
  extract_pattern_double(source, "raise[[:space:]]+(ValueError|RuntimeError)[[:space:]]*\\([[:space:]]*\\042[^\\042]{3,}\\042")
  extract_pattern_single(source, "raise[[:space:]]+(ValueError|RuntimeError)[[:space:]]*\\([[:space:]]*\\047[^\\047]{3,}\\047")
  extract_pattern_double(source, "[A-Za-z_][A-Za-z0-9_]*(toast|notify|alert)[A-Za-z0-9_]*[[:space:]]*\\([^\\042]*\\042[^\\042]{3,}\\042")
  extract_pattern_single(source, "[A-Za-z_][A-Za-z0-9_]*(toast|notify|alert)[A-Za-z0-9_]*[[:space:]]*\\([^\\047]*\\047[^\\047]{3,}\\047")
}' >> "$out"
}

collect_tui() {
  local out="$1"

  printf '[3/5] Collecting TUI...\n' >&2

  {
    grep -rEIn \
      --include='*.ts' \
      -e 'console\.log[[:space:]]*\(' \
      -e '(setTitle|setText)[[:space:]]*\(' \
      -e "(label|description):[[:space:]]*['\"\`]" \
      -e "['\"\`][^'\"\`]*[[:space:]][^'\"\`]*['\"\`]" \
      "$REPO_ROOT/app/tui/src" || true
  } | awk -v layer="tui" -v root="$REPO_ROOT" '
function parse_grep_record(record, parts, i) {
  split(record, parts, ":")
  path = parts[1]
  line_no = parts[2]
  source = parts[3]
  for (i = 4; i <= length(parts); i++) source = source ":" parts[i]
}
function relpath(path) {
  if (index(path, root "/") == 1) return substr(path, length(root) + 2)
  return path
}
function clean(text) {
  gsub(/\\n/, " ", text)
  gsub(/\\t/, " ", text)
  gsub(/^[[:space:]]+/, "", text)
  gsub(/[[:space:]]+$/, "", text)
  gsub(/[[:space:]]+/, " ", text)
  return text
}
function should_emit(text) {
  if (text == "" || length(text) < 3) return 0
  if (text ~ /^\$/) return 0
  if (text !~ /[A-Za-z]/ || text !~ /[a-z]/) return 0
  if (text ~ /[A-Z][A-Z0-9]+_[A-Z0-9_]+/) return 0
  if (text ~ /^[A-Z0-9_ .:;()\/-]+$/) return 0
  if (text ~ /^(https?|wss?):\/\//) return 0
  if (text !~ /[[:space:]]/ && text ~ /^[a-z0-9_.:\/-]+$/) return 0
  return 1
}
function emit(path, line_no, text, rel, key) {
  text = clean(text)
  if (!should_emit(text)) return
  rel = relpath(path)
  key = layer SUBSEP rel SUBSEP line_no SUBSEP text
  if (key in emitted) return
  emitted[key] = 1
  gsub(/"/, "\"\"", text)
  printf "%s,%s,%s,\"%s\",\"\",pending,,\n", layer, rel, line_no, text
}
function emit_double(match_text, text) {
  text = match_text
  sub(/^"/, "", text)
  sub(/"$/, "", text)
  emit(path, line_no, text)
}
function emit_single(match_text, text) {
  text = match_text
  sub(/^\047/, "", text)
  sub(/\047$/, "", text)
  emit(path, line_no, text)
}
function emit_backtick(match_text, text) {
  text = match_text
  sub(/^`/, "", text)
  sub(/`$/, "", text)
  emit(path, line_no, text)
}
function extract_literals(s, rest, match_text) {
  rest = s
  while (match(rest, /"[^"]{3,}"/)) {
    match_text = substr(rest, RSTART, RLENGTH)
    emit_double(match_text)
    rest = substr(rest, RSTART + RLENGTH)
  }

  rest = s
  while (match(rest, /\047[^\047]{3,}\047/)) {
    match_text = substr(rest, RSTART, RLENGTH)
    emit_single(match_text)
    rest = substr(rest, RSTART + RLENGTH)
  }

  rest = s
  while (match(rest, /`[^`]{3,}`/)) {
    match_text = substr(rest, RSTART, RLENGTH)
    emit_backtick(match_text)
    rest = substr(rest, RSTART + RLENGTH)
  }
}
{
  parse_grep_record($0)
  if (source ~ /^[[:space:]]*import[[:space:]]/) next
  extract_literals(source)
}' >> "$out"
}

collect_templates() {
  local out="$1"

  printf '[4/5] Collecting templates...\n' >&2

  find "$REPO_ROOT/app/runtime/templates" -type f -name '*.md' -print | sort | while IFS= read -r file; do
    awk -v layer="template" -v root="$REPO_ROOT" -v path="$file" '
function relpath(path) {
  if (index(path, root "/") == 1) return substr(path, length(root) + 2)
  return path
}
function clean(text) {
  gsub(/^[[:space:]]+/, "", text)
  gsub(/[[:space:]]+$/, "", text)
  gsub(/[[:space:]]+/, " ", text)
  return text
}
function should_emit(text) {
  if (text == "" || text !~ /[A-Za-z]/ || text !~ /[a-z]/) return 0
  if (text ~ /^(---|```)/) return 0
  return 1
}
function emit(line_no, text, rel) {
  text = clean(text)
  if (!should_emit(text)) return
  rel = relpath(path)
  gsub(/"/, "\"\"", text)
  printf "%s,%s,%s,\"%s\",\"\",pending,,\n", layer, rel, line_no, text
}
/^```/ { in_code = !in_code; next }
!in_code { emit(FNR, $0) }
' "$file" >> "$out"
  done
}

collect_skills() {
  local out="$1"

  printf '[5/5] Collecting skills...\n' >&2

  find "$REPO_ROOT/skills" -type f -name 'SKILL.md' -print | sort | while IFS= read -r file; do
    awk -v layer="skill" -v root="$REPO_ROOT" -v path="$file" '
function relpath(path) {
  if (index(path, root "/") == 1) return substr(path, length(root) + 2)
  return path
}
function clean(text) {
  gsub(/^[[:space:]]+/, "", text)
  gsub(/[[:space:]]+$/, "", text)
  gsub(/[[:space:]]+/, " ", text)
  return text
}
function should_emit(text) {
  if (text == "" || text !~ /[A-Za-z]/ || text !~ /[a-z]/) return 0
  if (text ~ /^(---|```)/) return 0
  return 1
}
function emit(line_no, text, rel) {
  text = clean(text)
  if (!should_emit(text)) return
  rel = relpath(path)
  gsub(/"/, "\"\"", text)
  printf "%s,%s,%s,\"%s\",\"\",pending,,\n", layer, rel, line_no, text
}
BEGIN { frontmatter = 0; frontmatter_done = 0; in_code = 0 }
NR == 1 && $0 == "---" { frontmatter = 1; next }
frontmatter && $0 == "---" { frontmatter = 0; frontmatter_done = 1; next }
frontmatter {
  if ($0 ~ /^[[:space:]]*description:[[:space:]]*/) {
    text = $0
    sub(/^[[:space:]]*description:[[:space:]]*/, "", text)
    gsub(/^"/, "", text)
    gsub(/"$/, "", text)
    gsub(/^\047/, "", text)
    gsub(/\047$/, "", text)
    emit(FNR, text)
  }
  next
}
/^```/ { in_code = !in_code; next }
frontmatter_done && !in_code { emit(FNR, $0) }
' "$file" >> "$out"
  done
}

print_summary() {
  local frontend_count="$1"
  local backend_count="$2"
  local tui_count="$3"
  local template_count="$4"
  local skill_count="$5"
  local total_count="$6"
  local unique_count="$7"
  local merged_count="$8"
  local output_path

  output_path="${OUTPUT#"$REPO_ROOT/"}"

  {
    printf '=== Inventory Collection Summary ===\n'
    printf 'Frontend (JSX text + attrs):  %s entries\n' "$frontend_count"
    printf 'Backend  (user-visible msgs): %s entries\n' "$backend_count"
    printf 'TUI      (console + labels):  %s entries\n' "$tui_count"
    printf 'Templates (LLM prompts):       %s entries\n' "$template_count"
    printf 'Skills   (SKILL.md content):  %s entries\n' "$skill_count"
    printf '%s\n' '------------------------------------'
    printf 'Total entries:                %s\n' "$total_count"
    printf 'Unique English strings:       %s\n' "$unique_count"
    printf 'Translations carried over:    %s\n' "$merged_count"
    printf 'Output: %s\n' "$output_path"
  } >&2
}

collect_frontend "$FRONTEND_OUT"
collect_backend "$BACKEND_OUT"
collect_tui "$TUI_OUT"
collect_templates "$TEMPLATE_OUT"
collect_skills "$SKILL_OUT"

cat "$FRONTEND_OUT" "$BACKEND_OUT" "$TUI_OUT" "$TEMPLATE_OUT" "$SKILL_OUT" > "$ALL_ROWS"

# Backup existing inventory before overwrite (for merge step below and as user safety net)
BACKUP=""
if [[ -f "$OUTPUT" ]]; then
  BACKUP="$OUTPUT.bak"
  cp "$OUTPUT" "$BACKUP"
fi

write_csv_header > "$OUTPUT"
awk 'NF { printf "%d,%s\n", NR, $0 }' "$ALL_ROWS" >> "$OUTPUT"

MERGED_COUNT=0
if [[ -n "$BACKUP" ]] && [[ "${RESET:-0}" != "1" ]]; then
  # Merge user-edited translation columns from previous inventory.
  # Key: english string (column 5). Same english => same translation, regardless of location.
  MERGED_COUNT="$(python3 - "$BACKUP" "$OUTPUT" "$WORK_DIR/merged.csv" <<'PYEOF'
import csv, sys

backup_path, current_path, merged_path = sys.argv[1], sys.argv[2], sys.argv[3]

overrides = {}
with open(backup_path, encoding='utf-8', newline='') as f:
    for row in csv.DictReader(f):
        key = row.get('english', '')
        pj = row.get('proposed_ja', '') or ''
        st = row.get('status', 'pending') or 'pending'
        rv = row.get('reviewer', '') or ''
        nt = row.get('notes', '') or ''
        # Only carry over entries where a human has edited something
        if pj or st != 'pending' or rv or nt:
            overrides[key] = (pj, st, rv, nt)

merged = 0
with open(current_path, encoding='utf-8', newline='') as src, \
     open(merged_path, 'w', encoding='utf-8', newline='') as dst:
    reader = csv.reader(src)
    writer = csv.writer(dst)
    header = next(reader)
    writer.writerow(header)
    for row in reader:
        # Columns: id,layer,source_path,line,english,proposed_ja,status,reviewer,notes
        english = row[4] if len(row) > 4 else ''
        if english in overrides:
            pj, st, rv, nt = overrides[english]
            row[5], row[6], row[7], row[8] = pj, st, rv, nt
            merged += 1
        writer.writerow(row)

print(merged)
PYEOF
)"
  mv "$WORK_DIR/merged.csv" "$OUTPUT"
elif [[ "${RESET:-0}" == "1" ]] && [[ -n "$BACKUP" ]]; then
  printf '[merge] RESET=1: existing translations discarded, backup kept at %s\n' \
    "${BACKUP#"$REPO_ROOT/"}" >&2
fi

FRONTEND_COUNT="$(count_rows "$FRONTEND_OUT")"
BACKEND_COUNT="$(count_rows "$BACKEND_OUT")"
TUI_COUNT="$(count_rows "$TUI_OUT")"
TEMPLATE_COUNT="$(count_rows "$TEMPLATE_OUT")"
SKILL_COUNT="$(count_rows "$SKILL_OUT")"
TOTAL_COUNT="$(count_rows "$ALL_ROWS")"
UNIQUE_COUNT="$(awk '
{
  text = $0
  sub(/^[^,]*,[^,]*,[^,]*,"/, "", text)
  sub(/","",pending,,$/, "", text)
  gsub(/""/, "\"", text)
  if (text != "") seen[text] = 1
}
END {
  count = 0
  for (text in seen) count++
  print count
}' "$ALL_ROWS")"

print_summary \
  "$FRONTEND_COUNT" \
  "$BACKEND_COUNT" \
  "$TUI_COUNT" \
  "$TEMPLATE_COUNT" \
  "$SKILL_COUNT" \
  "$TOTAL_COUNT" \
  "$UNIQUE_COUNT" \
  "$MERGED_COUNT"
