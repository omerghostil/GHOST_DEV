#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
K6="${K6_BIN:-k6}"
BASE_URL="${BASE_URL:-http://localhost:8787}"
LOAD_LEVEL="${LOAD_LEVEL:-medium}"

RESULTS_DIR="$SCRIPT_DIR/results"
REPORTS_DIR="$SCRIPT_DIR/reports"

rm -rf "$RESULTS_DIR"
mkdir -p "$RESULTS_DIR" "$REPORTS_DIR"

echo "========================================"
echo "  בדיקות עומס — Ghost Stress Tests"
echo "  רמת עומס: $LOAD_LEVEL"
echo "  שרת: $BASE_URL"
echo "========================================"
echo ""

# דגימת בריאות לפני הבדיקות
echo ">> דוגם מטריקות בריאות (לפני)..."
curl -s "$BASE_URL/api/health" > "$RESULTS_DIR/health-before.json" 2>/dev/null || echo '{}' > "$RESULTS_DIR/health-before.json"

TESTS=(
  "auth-flow"
  "channels-crud"
  "admin-dashboard"
  "ai-endpoints"
  "websocket-load"
  "mixed-workload"
  "payload-limits"
)

PASSED=0
FAILED=0

for TEST in "${TESTS[@]}"; do
  SCRIPT="$SCRIPT_DIR/$TEST.js"
  if [ ! -f "$SCRIPT" ]; then
    echo "  [!] סקריפט לא נמצא: $SCRIPT — מדלג"
    continue
  fi

  echo ""
  echo ">> מריץ: $TEST (רמה: $LOAD_LEVEL)..."
  echo "----------------------------------------"

  if "$K6" run \
    --env BASE_URL="$BASE_URL" \
    --env LOAD_LEVEL="$LOAD_LEVEL" \
    --summary-export "$RESULTS_DIR/$TEST.json" \
    --quiet \
    "$SCRIPT"; then
    echo "  [V] $TEST — עבר"
    PASSED=$((PASSED + 1))
  else
    echo "  [X] $TEST — נכשל (threshold חורג)"
    FAILED=$((FAILED + 1))
  fi
done

# דגימת בריאות אחרי הבדיקות
echo ""
echo ">> דוגם מטריקות בריאות (אחרי)..."
curl -s "$BASE_URL/api/health" > "$RESULTS_DIR/health-after.json" 2>/dev/null || echo '{}' > "$RESULTS_DIR/health-after.json"

echo ""
echo "========================================"
echo "  סיכום: $PASSED עברו, $FAILED נכשלו"
echo "========================================"

# הפקת דוח
echo ""
echo ">> מייצר דוח סיכום..."
node "$SCRIPT_DIR/helpers/report-generator.js" \
  "$RESULTS_DIR" \
  "$REPORTS_DIR" \
  "$RESULTS_DIR/health-before.json" \
  "$RESULTS_DIR/health-after.json"

LATEST_REPORT=$(ls -t "$REPORTS_DIR"/stress-report-*.md 2>/dev/null | head -1)
if [ -n "$LATEST_REPORT" ]; then
  echo ""
  echo "========================================"
  echo "  דוח מלא:"
  echo "  $LATEST_REPORT"
  echo "========================================"
  echo ""
  cat "$LATEST_REPORT"
fi
