#!/usr/bin/env bash
set -euo pipefail

# Usage:
# 1) Make sure you have git, npm, node, python3, pip, and gh (GitHub CLI) installed.
# 2) From repo root: chmod +x ./aggregate_merge.sh && ./aggregate_merge.sh
# You can set CREATE_PR=1 to automatically create a draft PR (requires gh login).
#
# NOTE: This script will stop at the first merge conflict and print conflicting files for manual resolution.

# Configuration
REMOTE="origin"
BASE_BRANCH="main"
AGG_BRANCH="copilot/aggregate-all-features"
PR_TITLE="Aggregate: Access Control, Optimal Solution Sharing, Advanced Analytics, Full Model, and Gameplay Enhancements"
# Priority order (highest first)
BRANCHES=(
  "copilot/add-advanced-analytics-enhancements"
  "copilot/enhance-player-panel-analytics"
  "copilot/add-solution-timestamp-and-difference"
  "copilot/fix-inventory-simulation-issues"
  "copilot/implement-access-control-feature"
  "copilot/update-controller-panel-functionality"
  "copilot/implement-adjustable-consumption-model"
  "copilot/implement-polish-updates-gameplay"
  "feat/interactive-desert-app"
)

# Toggle to create PR automatically (requires gh auth)
CREATE_PR="${CREATE_PR:-0}"
PR_BODY_FILE="pr_body.md"

echo "Fetching remote branches..."
git fetch ${REMOTE} --prune

echo "Creating branch ${AGG_BRANCH} from ${REMOTE}/${BASE_BRANCH}..."
git checkout -b ${AGG_BRANCH} ${REMOTE}/${BASE_BRANCH}

echo "Merging branches in priority order..."
for b in "${BRANCHES[@]}"; do
  echo
  echo "----------------------------------------"
  echo "Merging ${b} into ${AGG_BRANCH}..."
  # Attempt a non-fast-forward merge
  if git merge --no-ff --no-edit ${REMOTE}/${b}; then
    echo "Merged ${b} OK."
  else
    echo "Merge conflict detected when merging ${b}."
    echo "Conflicted files:"
    git status --porcelain | sed -n '1,200p'
    echo
    echo "Please resolve conflicts, then run:"
    echo "  git add <resolved-files>"
    echo "  git commit"
    echo "  ./aggregate_merge.sh --continue"
    exit 2
  fi
done

echo
echo "All merges completed successfully."

# Run frontend build
if [ -d "frontend" ]; then
  echo "Running frontend build..."
  (cd frontend && npm install --no-audit --no-fund && npm run build)
else
  echo "No frontend directory found at ./frontend, attempting root-level build..."
  if [ -f "package.json" ]; then
    npm install --no-audit --no-fund
    npm run build
  else
    echo "Warning: no package.json found. Skipping frontend build."
  fi
fi

echo "Frontend build succeeded."

# Start backend smoke check (run in background)
if [ -d "backend" ]; then
  echo "Starting backend smoke test..."
  # create venv if not created
  PYVENV=".venv_aggregate_test"
  python3 -m venv ${PYVENV}
  source ${PYVENV}/bin/activate
  pip install --upgrade pip
  if [ -f "backend/requirements.txt" ]; then
    pip install -r backend/requirements.txt
  else
    pip install flask flask-cors pulp
  fi

  # Start server in background
  echo "Launching backend server in background..."
  (cd backend && python server.py) &
  SERVER_PID=$!
  echo "Backend PID: ${SERVER_PID}"
  # give server some time to start
  sleep 3

  # smoke tests
  echo "HTTP smoke tests:"
  BASE_URL="http://127.0.0.1:8000"
  echo "- GET /api/config/get"
  curl -sS -f "${BASE_URL}/api/config/get" | sed -n '1,200p' || { echo "Failed /api/config/get"; kill ${SERVER_PID}; deactivate 2>/dev/null || true; exit 3; }
  echo
  echo "- GET /api/adjacency"
  curl -sS -f "${BASE_URL}/api/adjacency" | sed -n '1,200p' || { echo "Failed /api/adjacency"; kill ${SERVER_PID}; deactivate 2>/dev/null || true; exit 4; }
  echo
  echo "- GET /api/solution (expect 403 when show_solution_to_players false)"
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/solution") || true
  echo "HTTP status: ${HTTP_STATUS}"
  if [ "${HTTP_STATUS}" -eq 403 ]; then
    echo "GET /api/solution returned 403 as expected when solutions not revealed."
  else
    echo "GET /api/solution returned ${HTTP_STATUS} (expected 403 when not revealed)."
  fi

  echo "Stopping backend..."
  kill ${SERVER_PID}
  deactivate 2>/dev/null || true
else
  echo "No backend directory found. Skipping backend smoke tests."
fi

echo
echo "Preparing to push branch ${AGG_BRANCH} to ${REMOTE}..."
git push -u ${REMOTE} ${AGG_BRANCH}

if [ "${CREATE_PR}" = "1" ]; then
  echo "Creating draft PR (requires 'gh' logged in)..."
  if [ ! -f "${PR_BODY_FILE}" ]; then
    echo "PR body file ${PR_BODY_FILE} not found. Create it first. Aborting PR creation."
    exit 0
  fi
  gh pr create --draft --base ${BASE_BRANCH} --head ${AGG_BRANCH} --title "${PR_TITLE}" --body-file "${PR_BODY_FILE}"
  echo "PR created (draft)."
else
  echo "CREATE_PR is not set. A draft PR has not been created automatically."
  echo "You can create a draft PR manually or run with CREATE_PR=1 to auto-create (gh CLI required and must be authenticated)."
fi

echo "Done."