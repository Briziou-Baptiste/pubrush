#!/usr/bin/env bash
# Shared safety checks for the three operational scripts and the deployment CI.
# This trusted file is sourced; backup files are parsed as JSON, never executed.
set -Eeuo pipefail

TARGET_CONTEXT="${KUBE_CONTEXT:-default}"
TARGET_NAMESPACE="${KUBE_NAMESPACE:-default}"
EXPECTED_CLUSTER="${EXPECTED_CLUSTER:-default}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_TOOL="$SCRIPT_DIR/deployment_state.py"
BACKUP_DIR="${PUBRUSH_BACKUP_DIR:-$SCRIPT_DIR/backups}"
STATE_ENV_FILE=""
TARGET_IMAGE=""

parse_arguments() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --context|--namespace|--expected-cluster|--from-env|--image)
        [[ $# -ge 2 && -n "$2" && "$2" != --* ]] || { echo "Valeur manquante pour $1" >&2; return 1; }
        case "$1" in
          --context) TARGET_CONTEXT="$2" ;;
          --namespace) TARGET_NAMESPACE="$2" ;;
          --expected-cluster) EXPECTED_CLUSTER="$2" ;;
          --from-env) STATE_ENV_FILE="$2" ;;
          --image) TARGET_IMAGE="$2" ;;
        esac
        shift 2 ;;
      -h|--help)
        echo "Usage: $0 [--context ctx] [--namespace ns] [--expected-cluster cluster] [--from-env snapshot.json] [--image repo@sha256:...]"
        exit 0 ;;
      *) echo "Option inconnue : $1" >&2; return 1 ;;
    esac
  done
}

prepare_workspace() {
  umask 077
  WORK_DIR=$(mktemp -d)
  trap 'rm -rf "$WORK_DIR"' EXIT
}

kube() {
  kubectl --context="$TARGET_CONTEXT" -n "$TARGET_NAMESPACE" "$@"
}

validate_target() {
  [[ -n "$TARGET_CONTEXT" && -n "$TARGET_NAMESPACE" && -n "$EXPECTED_CLUSTER" ]] || return 1
  kubectl config view -o json > "$WORK_DIR/config.json"
  kube get namespace "$TARGET_NAMESPACE" -o json > "$WORK_DIR/namespace.json"
  python3 "$STATE_TOOL" target "$WORK_DIR/config.json" "$WORK_DIR/namespace.json" \
    "$TARGET_CONTEXT" "$TARGET_NAMESPACE" "$EXPECTED_CLUSTER" > "$WORK_DIR/target.json"
}

validate_snapshot() {
  # No assignment to the requested target is taken from the snapshot.
  python3 "$STATE_TOOL" validate "$STATE_ENV_FILE" "$WORK_DIR/target.json"
}

read_backend() {
  kube get deployment pubrush-backend -o json > "$WORK_DIR/deployment.json"
  kube get hpa pubrush-backend-hpa -o json > "$WORK_DIR/hpa.json"
  kube get pods -l app=pubrush-backend -o json > "$WORK_DIR/pods.json"
}

capture_snapshot() {
  read_backend
  python3 "$STATE_TOOL" capture "$WORK_DIR" > "$1"
  python3 "$STATE_TOOL" validate "$1" "$WORK_DIR/target.json"
}

wait_convergence() {
  local expected="$1" count elapsed=0
  kube rollout status deployment/pubrush-backend --timeout=120s
  while :; do
    # A zero count is successful. pipefail still propagates a kubectl failure.
    count=$(kube get pods -l app=pubrush-backend -o json | python3 "$STATE_TOOL" terminating)
    [[ "$count" -ne 0 ]] || break
    [[ "$elapsed" -lt 60 ]] || { echo "Des pods restent terminants." >&2; return 1; }
    sleep 2
    elapsed=$((elapsed + 2))
  done
  read_backend
  kube get endpoints backend-service -o json > "$WORK_DIR/endpoints.json"
  python3 "$STATE_TOOL" verify "$WORK_DIR" "$expected"
}

check_monopod() {
  read_backend
  kube get endpoints backend-service -o json > "$WORK_DIR/endpoints.json"
  python3 "$STATE_TOOL" verify "$WORK_DIR" monopod
}

require_monopod() {
  read_backend
  python3 "$STATE_TOOL" monopod-config "$WORK_DIR"
}

check_images() {
  kube get deployment pubrush-backend -o json > "$WORK_DIR/deployment.json"
  python3 "$STATE_TOOL" images-match "$WORK_DIR/deployment.json" "$1" "$2"
}
