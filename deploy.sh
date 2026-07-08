#!/usr/bin/env bash
# Deploy the IAAH Flash archive to Cloudflare Pages (project: dragable).
#
# Auth (either):
#   - wrangler OAuth session (npx wrangler login), or
#   - CLOUDFLARE_API_TOKEN [+ CLOUDFLARE_ACCOUNT_ID] in the environment,
#     optionally via ~/.config/cloudflare/dragable.env
#
# NOTE: run with node/npx, NOT bun — wrangler silently no-ops under bun.
set -euo pipefail
cd "$(dirname "$0")"

ENV_FILE="$HOME/.config/cloudflare/dragable.env"
[ -f "$ENV_FILE" ] && source "$ENV_FILE"

# Stage a clean copy: the museum + sites + ruffle, nothing else.
rm -rf _deploy && mkdir _deploy
rsync -a \
  --exclude .git \
  --exclude node_modules \
  --exclude _deploy \
  --exclude deploy.sh \
  --exclude .gitignore \
  --exclude package.json \
  --exclude package-lock.json \
  ./ _deploy/

npx -y wrangler pages deploy _deploy --project-name dragable --branch main --commit-dirty=true
