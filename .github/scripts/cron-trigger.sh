#!/usr/bin/env bash
set -euo pipefail

ENDPOINT="${1:?Usage: cron-trigger.sh /api/cron/endpoint}"

if [ -z "${API_BASE_URL:-}" ]; then
  echo "::error::API_BASE_URL secret is not set."
  echo "Set GitHub Actions secret API_BASE_URL to https://crm-fly1.vercel.app (no trailing slash)."
  exit 1
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo "::error::CRON_SECRET secret is not set."
  echo "Set GitHub Actions secret CRON_SECRET to the same value as on the Vercel API project."
  exit 1
fi

url="${API_BASE_URL%/}${ENDPOINT}"
echo "POST ${url}"

resp=$(curl -sS -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  "${url}")
body=$(echo "$resp" | head -n -1)
code=$(echo "$resp" | tail -n 1)

echo "HTTP ${code}"
echo "${body}"

case "${code}" in
  200) exit 0 ;;
  401)
    echo "::error::Unauthorized — CRON_SECRET does not match the Vercel API project."
    exit 1
    ;;
  404)
    echo "::error::Not found — check API_BASE_URL (expected https://crm-fly1.vercel.app)."
    exit 1
    ;;
  503)
    echo "::error::Cron not configured on API — set CRON_SECRET on the Vercel API project."
    exit 1
    ;;
  *)
    echo "::error::Cron trigger failed with HTTP ${code}."
    exit 1
    ;;
esac
