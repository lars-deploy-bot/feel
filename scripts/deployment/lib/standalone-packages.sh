#!/bin/bash
# =============================================================================
# Standalone Packages Configuration
# =============================================================================
# Single source of truth for packages that must be copied to standalone builds.
#
# ⚠️  IMPORTANT: When adding a new internal workspace package that runtime imports,
#     add it to STANDALONE_PACKAGES below. Forgetting this will cause runtime
#     errors like "module not found" in production.
#
# These packages are copied to:
#   - standalone/packages/                         (single physical copy)
# Then linked from:
#   - standalone/apps/web/node_modules/{scope}/ (for app imports)
#
# Validation runs during build to catch missing packages.
# =============================================================================

# shellcheck disable=SC2034
# Packages to copy to standalone build
# Format: space-separated list of package names (from packages/ directory)
readonly -a STANDALONE_PACKAGES=(
    alrighty
    tools
    images
    shared
    sandbox
    worker-pool
    site-controller
    database
    runtime-auth
)

# shellcheck disable=SC2034
# Packages that have external dependencies needed in subprocess
# These get their node_modules copied too (via cp -rL)
readonly -a SUBPROCESS_PACKAGES=(
    worker-pool
)
