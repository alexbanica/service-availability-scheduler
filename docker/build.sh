#!/bin/bash

set -eu

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
IMAGE_NAME="service-availability-scheduler"
DOCKERFILE_PATH="docker/Dockerfile"

RELEASE_TAG=""
PLATFORM_INPUT=""
REGISTRY_OVERRIDE=""
NO_LATEST=0
PUSH=0
FORCE_NO_CACHE=0
DEBUG=0
EMIT_MATRIX=0

# shellcheck disable=SC1090
load_config() {
  local env_file="${SCRIPT_DIR}/.env"

  if [ ! -f "$env_file" ]; then
    echo "Error: Required configuration file is missing: ${env_file}" >&2
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "$env_file"
  set +a

  if [ -z "${BASE_IMAGE_VERSION:-}" ] || [ -z "${DOCKER_REGISTRY_URI:-}" ]; then
    echo "Error: Environment variable BASE_IMAGE_VERSION or DOCKER_REGISTRY_URI is missing." >&2
    exit 1
  fi
}

usage() {
  echo "Usage: docker/build.sh --release <tag> [--registry <registry>] [--platform <platform>] [--no-latest] [--push] [--force] [--debug]"
  echo "Usage: docker/build.sh --emit-github-matrix --release <tag> --registry forgejo.alexlab.nl/alexlab --platform linux/arm64 --no-latest"
}

error() {
  echo "Error: $1" >&2
  usage >&2
  exit 1
}

read_arg_value() {
  local option_name="$1"
  local value="${2:-}"

  if [ -z "$value" ] || [[ "$value" == --* ]]; then
    error "${option_name} requires a value."
  fi
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --debug)
      DEBUG=1
      shift
      ;;
    --platform)
      shift
      read_arg_value "--platform" "$1"
      PLATFORM_INPUT="$1"
      shift
      ;;
    --push)
      PUSH=1
      shift
      ;;
    --force)
      FORCE_NO_CACHE=1
      shift
      ;;
    --release)
      shift
      read_arg_value "--release" "$1"
      RELEASE_TAG="$1"
      shift
      ;;
    --registry)
      shift
      read_arg_value "--registry" "$1"
      REGISTRY_OVERRIDE="$1"
      shift
      ;;
    --no-latest)
      NO_LATEST=1
      shift
      ;;
    --emit-github-matrix)
      EMIT_MATRIX=1
      shift
      ;;
    *)
      error "Unknown option: $1"
      ;;
  esac
done

if [ -z "${RELEASE_TAG}" ]; then
  error "Release tag is required. Please provide it using --release parameter."
fi

load_config

REGISTRY="${REGISTRY_OVERRIDE:-${DOCKER_REGISTRY_URI}}"

validate_matrix_tag() {
  if [[ ! "$RELEASE_TAG" =~ ^[a-z0-9_][a-z0-9_.-]*$ ]]; then
    echo "Error: Invalid tag '${RELEASE_TAG}'. Allowed pattern is ^[a-z0-9_][a-z0-9_.-]*$." >&2
    return 1
  fi

  VERSIONED_TAG="${RELEASE_TAG}-node${BASE_IMAGE_VERSION}"
  if [ "${#VERSIONED_TAG}" -gt 128 ]; then
    echo "Error: Versioned image tag exceeds Docker limit: ${VERSIONED_TAG}" >&2
    return 1
  fi
}

emit_matrix() {
  if [ "$EMIT_MATRIX" -eq 0 ]; then
    return 0
  fi

  if [ "$NO_LATEST" -eq 0 ] || [ -z "$PLATFORM_INPUT" ] || [ -z "$REGISTRY_OVERRIDE" ] || [ "$PUSH" -eq 1 ] || [ "$FORCE_NO_CACHE" -eq 1 ] || [ "$DEBUG" -eq 1 ]; then
    error "Metadata mode requires --no-latest, --platform, --registry, and forbids push/debug/force options."
  fi

  if [ "$REGISTRY_OVERRIDE" != "forgejo.alexlab.nl/alexlab" ]; then
    echo "Error: Metadata mode requires registry forgejo.alexlab.nl/alexlab." >&2
    return 1
  fi

  if [ "$PLATFORM_INPUT" != "linux/arm64" ]; then
    echo "Error: Metadata mode requires platform linux/arm64." >&2
    return 1
  fi

  if ! validate_matrix_tag; then
    return 1
  fi

  local github_output_path="${GITHUB_OUTPUT:-}"
  if [ -z "$github_output_path" ] || [ ! -f "$github_output_path" ] || [ ! -w "$github_output_path" ]; then
    echo "Error: GITHUB_OUTPUT must point to an existing writable file." >&2
    return 1
  fi

  local versioned_tag="${RELEASE_TAG}-node${BASE_IMAGE_VERSION}"
  local image="${REGISTRY}/${IMAGE_NAME}:${versioned_tag}"
  local normalized_platform="${PLATFORM_INPUT//\//-}"
  local cache_scope="${IMAGE_NAME}-${normalized_platform}"

  cat <<EOF >> "$github_output_path"
matrix={"include":[{"image_name":"${IMAGE_NAME}","image":"${image}","context":"${REPOSITORY_ROOT}","dockerfile":"${DOCKERFILE_PATH}","platform":"${PLATFORM_INPUT}","app_version":"${RELEASE_TAG}","cache_scope":"${cache_scope}"}]}
EOF

  echo "Emitted release matrix for ${image}" >&2
  return 0
}

build_release() {
  local versioned_tag="${RELEASE_TAG}-node${BASE_IMAGE_VERSION}"
  local image="${REGISTRY}/${IMAGE_NAME}:${versioned_tag}"
  local latest_image="${REGISTRY}/${IMAGE_NAME}:latest-node${BASE_IMAGE_VERSION}"
  local -a build_args=()

  if [ -n "$PLATFORM_INPUT" ]; then
    build_args+=(--platform "$PLATFORM_INPUT")
  fi

  if [ "$DEBUG" -eq 1 ]; then
    build_args+=(--progress=plain)
  fi

  if [ "$FORCE_NO_CACHE" -eq 1 ]; then
    build_args+=(--no-cache)
  fi

  build_args+=(-t "$image")
  if [ "$NO_LATEST" -eq 0 ]; then
    build_args+=(-t "$latest_image")
  fi

  if [ "$PUSH" -eq 1 ]; then
    build_args+=(--push)
  else
    build_args+=(--load)
  fi

  cd "$REPOSITORY_ROOT"

  sed -e "s/BASE_IMAGE_VERSION/${BASE_IMAGE_VERSION}/g" \
      -e "s/BASE_BUILD_IMAGE_VERSION/${BASE_BUILD_IMAGE_VERSION}/g" \
      "$DOCKERFILE_PATH" | \
    docker buildx build \
      "${build_args[@]}" \
      --build-arg GITHUB_REPO="${GITHUB_REPO}" \
      --build-arg RELEASE_TAG="${RELEASE_TAG}" \
      --build-arg APP_VERSION="${RELEASE_TAG}" \
      -f - \
      .
}

if [ "$EMIT_MATRIX" -eq 1 ]; then
  emit_matrix
  exit $?
fi

build_release
