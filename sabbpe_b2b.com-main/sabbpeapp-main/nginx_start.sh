#!/bin/sh
set -e

# Cloud Run sets PORT env var (default 8080)
# NGINX config is hardcoded to 8080, so we don't need envsubst

echo "Starting NGINX on port 8080..."
exec nginx -g 'daemon off;'