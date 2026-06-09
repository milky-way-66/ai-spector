#!/usr/bin/env bash
# Publish ai-spector to a registry.
# Prompts for npm login when not authenticated.
#
# Usage (from repo root):
#   cp .env.example .env   # first time only (custom registry)
#   npm run deploy              # internal Verdaccio (from .env)
#   npm run deploy:npm          # public npm registry
#   npm run deploy -- --npm     # same as deploy:npm
#
# Environment:
#   DEPLOY_TARGET=npm | custom  — registry target (default: custom)
#   SKIP_BUMP=1   — skip version bump
#   SKIP_TEST=1   — skip tests before publish
#   BUMP=patch    — patch | minor | major (default: patch)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

cd "$ROOT"

DEPLOY_TARGET="${DEPLOY_TARGET:-custom}"

for arg in "$@"; do
  case "$arg" in
    --npm|-npm|npm)
      DEPLOY_TARGET="npm"
      ;;
    --custom|-custom|custom)
      DEPLOY_TARGET="custom"
      ;;
    -h|--help)
      cat <<'EOF'
Publish ai-spector to a registry.

Usage:
  npm run deploy              Publish to custom registry (.env REGISTRY)
  npm run deploy:npm          Publish to public npm registry
  npm run deploy -- --npm     Same as deploy:npm
  npm run deploy -- --custom  Force custom registry

Environment:
  DEPLOY_TARGET=npm|custom  Registry target (default: custom)
  SKIP_BUMP=1               Skip version bump
  SKIP_TEST=1               Skip tests before publish
  BUMP=patch|minor|major    Version bump type (default: patch)
EOF
      exit 0
      ;;
  esac
done

if [[ "$DEPLOY_TARGET" == "custom" ]]; then
  if [[ ! -f "$ENV_FILE" ]]; then
    echo "ERROR: ${ENV_FILE} not found."
    echo "Run: cp .env.example .env"
    echo "Or publish to npm: npm run deploy:npm"
    exit 1
  fi

  # shellcheck disable=SC1090
  source "$ENV_FILE"
  REGISTRY="${REGISTRY:-${DEFAULT_REGISTRY:-http://localhost:4873}}"
else
  REGISTRY="https://registry.npmjs.org"
fi

PKG_NAME="$(node --input-type=module -e "import p from './package.json' with { type: 'json' }; console.log(p.name)")"
PKG_VERSION="$(node --input-type=module -e "import p from './package.json' with { type: 'json' }; console.log(p.version)")"
BUMP_TYPE="${BUMP:-patch}"

ensure_npm_auth() {
  echo "==> Target:   ${DEPLOY_TARGET} (${REGISTRY})"
  echo "==> Package:  ${PKG_NAME}@${PKG_VERSION}"

  if [[ "$DEPLOY_TARGET" == "npm" ]]; then
    if npm whoami >/dev/null 2>&1; then
      echo "==> npm auth OK ($(npm whoami))"
      return 0
    fi

    echo "==> Not logged in to ${REGISTRY}"
    echo "    npm will prompt for username, password, and email."
    npm login

    if ! npm whoami >/dev/null 2>&1; then
      echo "ERROR: npm login failed — run: npm login"
      exit 1
    fi

    echo "==> Logged in as: $(npm whoami)"
    return 0
  fi

  if npm whoami --registry "${REGISTRY}" >/dev/null 2>&1; then
    echo "==> npm auth OK ($(npm whoami --registry "${REGISTRY}"))"
    return 0
  fi

  echo "==> Not logged in to ${REGISTRY}"
  echo "    npm will prompt for username, password, and email."
  npm login --registry "${REGISTRY}"

  if ! npm whoami --registry "${REGISTRY}" >/dev/null 2>&1; then
    echo "ERROR: npm login failed — run: npm login --registry ${REGISTRY}"
    exit 1
  fi

  echo "==> Logged in as: $(npm whoami --registry "${REGISTRY}")"
}

registry_has_version() {
  local published
  if [[ "$DEPLOY_TARGET" == "npm" ]]; then
    published="$(npm view "${PKG_NAME}" version 2>/dev/null || true)"
  else
    published="$(npm view "${PKG_NAME}" version --registry "${REGISTRY}" 2>/dev/null || true)"
  fi
  [[ -n "$published" && "$published" == "$PKG_VERSION" ]]
}

maybe_bump_version() {
  if [[ "${SKIP_BUMP:-0}" == "1" ]]; then
    echo "==> SKIP_BUMP=1 — skipping version bump"
    return 0
  fi

  if registry_has_version; then
    echo "==> ${PKG_NAME}@${PKG_VERSION} already on registry — bump required"
    read -r -p "Bump version (${BUMP_TYPE})? [Y/n] " reply
    reply="${reply:-Y}"
    if [[ ! "$reply" =~ ^[Yy]$ ]]; then
      echo "ERROR: cannot publish — version already exists on registry"
      exit 1
    fi
  else
    read -r -p "Bump version (${BUMP_TYPE}) before publish? [Y/n] " reply
    reply="${reply:-Y}"
    if [[ ! "$reply" =~ ^[Yy]$ ]]; then
      echo "==> Skipping version bump"
      return 0
    fi
  fi

  echo "==> Bumping ${BUMP_TYPE}"
  npm version "${BUMP_TYPE}" --no-git-tag-version
  PKG_VERSION="$(node --input-type=module -e "import p from './package.json' with { type: 'json' }; console.log(p.version)")"
  echo "==> New version: ${PKG_NAME}@${PKG_VERSION}"
}

ensure_npm_auth
maybe_bump_version

if [[ "${SKIP_TEST:-0}" != "1" ]]; then
  echo "==> Running tests"
  npm test
else
  echo "==> SKIP_TEST=1 — skipping tests"
fi

echo "==> Publishing ${PKG_NAME}@${PKG_VERSION} to ${REGISTRY}"
if [[ "$DEPLOY_TARGET" == "npm" ]]; then
  npm publish --access public
else
  npm publish --registry "${REGISTRY}"
fi

echo ""
echo "==> Verify:"
if [[ "$DEPLOY_TARGET" == "npm" ]]; then
  echo "    npm view ${PKG_NAME} version"
else
  echo "    npm view ${PKG_NAME} version --registry ${REGISTRY}"
fi
echo "==> Deploy complete."
