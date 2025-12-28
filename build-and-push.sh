#!/bin/bash

# Build and optionally push Docker images for RAGentic services.
# Usage: ./build-and-push.sh <registry> <version>
#   registry: dockerhub (default) | ghcr
#   version:  semantic tag (default: latest)
# Environment:
#   DOCKER_USERNAME   -> required; your Docker Hub or GHCR username/namespace
#   SERVICES          -> optional space-separated list (e.g. "backend frontend")
#                        defaults to all TypeScript services

set -euo pipefail

REGISTRY="${1:-dockerhub}"
VERSION="${2:-latest}"
DOCKER_USERNAME="${DOCKER_USERNAME:-}"

if [[ -z "$DOCKER_USERNAME" || "$DOCKER_USERNAME" == "yourusername" ]]; then
  echo "❌ Please export DOCKER_USERNAME with your container registry username." >&2
  echo "   Example: export DOCKER_USERNAME=myorg" >&2
  exit 1
fi

REGISTRY_URL=""
IMAGE_PREFIX=""

case "$REGISTRY" in
  dockerhub)
    IMAGE_PREFIX="$DOCKER_USERNAME"
    echo "📦 Using Docker Hub (hub.docker.com)"
    ;;
  ghcr)
    IMAGE_PREFIX="ghcr.io/$DOCKER_USERNAME"
    REGISTRY_URL="ghcr.io"
    echo "📦 Using GitHub Container Registry"
    ;;
  *)
    echo "❌ Unknown registry: $REGISTRY"
    echo "Usage: $0 <registry> <version>"
    echo "Registries: dockerhub, ghcr"
    exit 1
    ;;
esac

# serviceName|contextPath|dockerfile|imageSuffix
ALL_SERVICES=(
  "backend|backend|backend/Dockerfile|ragentic-backend"
  "frontend|frontend|frontend/Dockerfile|ragentic-frontend"
  "ingestion-agent|agents/ingestion-agent|agents/ingestion-agent/Dockerfile|ragentic-ingestion-agent"
  "query-parser-agent|agents/query-parser-agent|agents/query-parser-agent/Dockerfile|ragentic-query-parser-agent"
  "retrieval-agent|agents/retrieval-agent|agents/retrieval-agent/Dockerfile|ragentic-retrieval-agent"
  "ranking-agent|agents/ranking-agent|agents/ranking-agent/Dockerfile|ragentic-ranking-agent"
  "generation-agent|agents/generation-agent|agents/generation-agent/Dockerfile|ragentic-generation-agent"
  "validation-agent|agents/validation-agent|agents/validation-agent/Dockerfile|ragentic-validation-agent"
)

SELECTED_SERVICES=()

if [[ -n "${SERVICES:-}" ]]; then
  for requested in $SERVICES; do
    matched="false"
    for entry in "${ALL_SERVICES[@]}"; do
      IFS='|' read -r name _ <<< "$entry"
      if [[ "$name" == "$requested" ]]; then
        SELECTED_SERVICES+=("$entry")
        matched="true"
        break
      fi
    done
    if [[ "$matched" != "true" ]]; then
      echo "❌ Unknown service in SERVICES env: $requested" >&2
      exit 1
    fi
  done
else
  SELECTED_SERVICES=("${ALL_SERVICES[@]}")
fi

if [[ ${#SELECTED_SERVICES[@]} -eq 0 ]]; then
  echo "❌ No services selected for build" >&2
  exit 1
fi

echo "🏗️  Building images for version: $VERSION"
echo "🔧 Registry prefix: $IMAGE_PREFIX"
echo "🧩 Services:"
for entry in "${SELECTED_SERVICES[@]}"; do
  IFS='|' read -r name _ _ imageSuffix <<< "$entry"
  echo "  - $name -> ${IMAGE_PREFIX}/${imageSuffix}"
done
echo

BUILT_IMAGES=()

for entry in "${SELECTED_SERVICES[@]}"; do
  IFS='|' read -r name context dockerfile imageSuffix <<< "$entry"
  IMAGE_NAME="${IMAGE_PREFIX}/${imageSuffix}"
  echo "🔨 Building $name ($IMAGE_NAME)..."
  docker build \
    -t "$IMAGE_NAME:$VERSION" \
    -t "$IMAGE_NAME:latest" \
    -f "$dockerfile" \
    "$context"
  BUILT_IMAGES+=("$IMAGE_NAME")
  echo
done

echo "✅ Images built successfully"
echo
echo "📋 Built tags:"
for image in "${BUILT_IMAGES[@]}"; do
  echo "  - $image:$VERSION"
  echo "  - $image:latest"
done
echo

read -p "🚀 Push images to $REGISTRY? (y/N) " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "🔐 Checking registry login..."
  if [[ -z "$REGISTRY_URL" ]]; then
    docker login || exit 1
  else
    docker login "$REGISTRY_URL" || exit 1
  fi

  for image in "${BUILT_IMAGES[@]}"; do
    echo "📤 Pushing $image:$VERSION"
    docker push "$image:$VERSION"
    echo "📤 Pushing $image:latest"
    docker push "$image:latest"
  done

  echo
  echo "✅ Images pushed successfully"
  echo "🎉 Published tags:"
  for image in "${BUILT_IMAGES[@]}"; do
    echo "   $image:$VERSION"
    echo "   $image:latest"
  done
else
  echo
  echo "⏭️  Skipped pushing. Images are available locally."
  echo "To push later, run for each image:"
  for image in "${BUILT_IMAGES[@]}"; do
    echo "  docker push $image:$VERSION"
    echo "  docker push $image:latest"
  done
fi

echo
echo "✨ Done!"
