#!/usr/bin/env bash
set -euo pipefail

: "${REPO:?REPO must identify the repository}"
MANUAL_PR=${MANUAL_PR:-}
if [[ -n "$MANUAL_PR" && ! "$MANUAL_PR" =~ ^[1-9][0-9]*$ ]]; then
  echo '::error::pr_number must be a positive integer.'
  exit 1
fi

if [ -n "$MANUAL_PR" ]; then
  PRS=$(gh pr view "$MANUAL_PR" --repo "$REPO" --json number,headRefName,headRefOid,author,state | jq '[.]')
else
  PRS=$(gh pr list --repo "$REPO" --state open --limit 100 --json number,headRefName,headRefOid,author,state)
fi
# GraphQL/gh uses app/dependabot; REST-style fixtures may use dependabot[bot].
# Match exact identities, not a login merely containing "dependabot".
PRS=$(jq -c '.[] | select(.state == "OPEN") | select(.author.login == "app/dependabot" or .author.login == "dependabot[bot]")' <<< "$PRS")
if [ -z "$PRS" ]; then
  echo 'No open Dependabot PRs found.'
  exit 0
fi

remove_retry_label() {
  # Removing a label that is already absent must remain an idempotent no-op.
  gh pr edit "$PR_NUMBER" --remove-label retry-24h --repo "$REPO" 2>/dev/null || true
}

latest_ci_run() {
  # Never search only failed runs: that would resurrect failures even after a
  # later attempt or commit succeeded. Only pull-request CI can be retried.
  gh run list --repo "$REPO" --workflow ci.yml --event pull_request \
    --branch "$HEAD_REF" --limit 1 \
    --json databaseId,headSha,status,conclusion,attempt,updatedAt
}

while IFS= read -r pr; do
  PR_NUMBER=$(jq -r '.number' <<< "$pr")
  HEAD_REF=$(jq -r '.headRefName' <<< "$pr")
  HEAD_SHA=$(jq -r '.headRefOid' <<< "$pr")
  LATEST=$(latest_ci_run)
  RUN=$(jq -c '.[0] // empty' <<< "$LATEST")
  if [ -z "$RUN" ]; then
    continue
  fi
  if ! jq -e --arg sha "$HEAD_SHA" '.headSha == $sha and .status == "completed"' <<< "$RUN" >/dev/null; then
    continue
  fi
  if [ "$(jq -r '.conclusion' <<< "$RUN")" != failure ]; then
    remove_retry_label
    continue
  fi
  # At most four retries after the initial run, spaced at least six hours
  # apart. Do not download logs for a run that cannot yet be retried.
  if jq -e '.attempt >= 5' <<< "$RUN" >/dev/null; then
    echo "PR #$PR_NUMBER has reached the retry limit. Manual investigation is required."
    remove_retry_label
    continue
  fi
  if ! jq -e 'now - (.updatedAt | fromdateiso8601) >= 21600' <<< "$RUN" >/dev/null; then
    continue
  fi

  RUN_ID=$(jq -r '.databaseId' <<< "$RUN")
  JOBS=$(gh api --paginate --slurp "/repos/$REPO/actions/runs/$RUN_ID/jobs?per_page=100")
  FAILED_JOBS=$(jq -r '.[].jobs[] | select(.conclusion == "failure") | .id' <<< "$JOBS")
  IS_AGE_VIOLATION=false
  while IFS= read -r job_id; do
    [ -n "$job_id" ] || continue
    LOGS=$(gh api "/repos/$REPO/actions/jobs/$job_id/logs")
    # A here-string avoids the SIGPIPE caused by piping large logs to grep -q.
    if grep -q 'ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION' <<< "$LOGS"; then
      IS_AGE_VIOLATION=true
      break
    fi
  done <<< "$FAILED_JOBS"
  if [ "$IS_AGE_VIOLATION" = false ]; then
    remove_retry_label
    continue
  fi

  gh label create retry-24h \
    --description 'Waiting for packages to age past pnpm minimumReleaseAge policy' \
    --color fbca04 --repo "$REPO" 2>/dev/null || true
  gh pr edit "$PR_NUMBER" --add-label retry-24h --repo "$REPO"
  COMMENTS=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json comments)
  if ! jq -e '.comments[] | select(.author.login == "github-actions[bot]") | select(.body | contains("minimumReleaseAge violation"))' <<< "$COMMENTS" >/dev/null; then
    gh pr comment "$PR_NUMBER" --repo "$REPO" --body \
      $'### Supply Chain Protection Active\n\nCI reported a minimumReleaseAge violation. Dependency installation will be retried at least six hours apart, up to four retries after the initial run. If it still fails, manual investigation is required.\n\nThis policy guards against freshly published malicious packages.'
  fi

  # The PR or run may have changed while fetching logs/comments. Recheck both
  # immediately before the only expensive side effect: requesting another run.
  CURRENT_PR=$(gh pr view "$PR_NUMBER" --repo "$REPO" --json headRefOid)
  CURRENT=$(latest_ci_run)
  if ! jq -e --arg sha "$HEAD_SHA" '.headRefOid == $sha' <<< "$CURRENT_PR" >/dev/null; then
    continue
  fi
  if ! jq -e --argjson original "$RUN" '.[0] | .databaseId == $original.databaseId and .headSha == $original.headSha and .attempt == $original.attempt and .status == "completed" and .conclusion == "failure"' <<< "$CURRENT" >/dev/null; then
    continue
  fi
  gh run rerun "$RUN_ID" --failed --repo "$REPO"
  echo "Requested failed-jobs retry for PR #$PR_NUMBER, run $RUN_ID."
done <<< "$PRS"
