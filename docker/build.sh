#!/bin/bash

# Parse arguments
PUSH_OPTION=""
FORCE_OPTION=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    --debug)
      shift
      DEBUG="--progress=plain"
      ;;
    --platform)
      shift
      PLATFORMS="$1"
      shift
      ;;
    --push)
      PUSH_OPTION="--push"
      shift
      ;;
    --force)
      FORCE_OPTION="--no-cache"
      shift
    ;;
    --release)
      shift
      RELEASE_TAG="$1"
      shift
    ;;
    *)
      shift
      ;;
  esac
done

# Validate release tag
if [ -z "${RELEASE_TAG}" ]; then
  echo "Error: Release tag is required. Please provide it using --release parameter."
  exit 1
fi

export $(xargs < .env) && \
IMAGE_TAG="${DOCKER_REGISTRY_URI}/device-integration-api:${RELEASE_TAG}-node${BASE_IMAGE_VERSION}" && \
LATEST_TAG="${DOCKER_REGISTRY_URI}/device-integration-api:latest-node${BASE_IMAGE_VERSION}"

# Build command
export $(xargs < .env) && \
sed -e "s/BASE_IMAGE_VERSION/${BASE_IMAGE_VERSION}/g" \
    -e "s/BASE_BUILD_IMAGE_VERSION/${BASE_BUILD_IMAGE_VERSION}/g" Dockerfile | \
docker buildx build ${DEBUG} ${FORCE_OPTION} \
  ${PLATFORMS:+--platform "$PLATFORMS"} \
  -t "${IMAGE_TAG}" \
  -t "${LATEST_TAG}" \
  --build-arg GITHUB_REPO="${GITHUB_REPO}" \
  --build-arg RELEASE_TAG="${RELEASE_TAG}" \
  --secret id=GITHUB_AUTH,src=secrets/.github_auth \
  -f - \
  ${PUSH_OPTION} \
  .