#!/usr/bin/env bash
# Activation temporaire autorisée séparément par le propriétaire.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deployment-common.sh"
parse_arguments "$@"
[[ -z "$STATE_ENV_FILE" && -z "$TARGET_IMAGE" ]] || { echo "La bascule ne charge aucune sauvegarde/image." >&2; exit 1; }
prepare_workspace
validate_target

mkdir -p "$BACKUP_DIR"
STATE_FILE=$(mktemp "$BACKUP_DIR/monopod_state_XXXXXXXX")
capture_snapshot "$STATE_FILE"
# Keep the first baseline on repeated activation; print each explicit snapshot.
if [[ ! -e "$BACKUP_DIR/latest_pre_monopod_backup.env" ]]; then
  ln -s "$STATE_FILE" "$BACKUP_DIR/latest_pre_monopod_backup.env"
fi
printf 'Sauvegarde pré-bascule : %s\n' "$STATE_FILE"

# Namespace is explicit; no manifest with a hard-coded namespace is applied.
kube patch hpa pubrush-backend-hpa --type=merge --patch '{"spec":{"minReplicas":1,"maxReplicas":1}}'
kube patch deployment pubrush-backend --type=merge --patch-file "$SCRIPT_DIR/deployment-patch-recreate.yaml"
wait_convergence monopod
printf 'Monopod validé. Rollback applicatif : %s/rollback-backend.sh --from-env %s\n' "$SCRIPT_DIR" "$STATE_FILE"
