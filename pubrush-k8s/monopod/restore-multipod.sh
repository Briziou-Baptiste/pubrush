#!/usr/bin/env bash
# Restaure les paramètres sauvegardés, jamais le template ni les images.
# Le retour multipod réintroduit l'isolation des WebSockets sans relais partagé.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deployment-common.sh"
parse_arguments "$@"
[[ -n "$STATE_ENV_FILE" && -z "$TARGET_IMAGE" ]] || { echo "Utiliser --from-env snapshot.json explicitement." >&2; exit 1; }
prepare_workspace
validate_target
validate_snapshot

# Generate both patches before the first mutation. Do not source backup data.
DEPLOYMENT_PATCH=$(python3 "$STATE_TOOL" deployment-patch "$STATE_ENV_FILE")
HPA_PATCH=$(python3 "$STATE_TOOL" hpa-patch "$STATE_ENV_FILE")
mkdir -p "$BACKUP_DIR"
RESTORE_BACKUP=$(mktemp "$BACKUP_DIR/before_restore_XXXXXXXX")
capture_snapshot "$RESTORE_BACKUP"
# Set saved replicas/strategy while the current HPA is still clamped, then restore
# the entire saved HPA spec. No web resource or Deployment template is written.
kube patch deployment pubrush-backend --type=merge --patch "$DEPLOYMENT_PATCH"
kube patch hpa pubrush-backend-hpa --type=json --patch "$HPA_PATCH"
wait_convergence "$STATE_ENV_FILE"
printf 'Paramètres backend restaurés exactement ; images préservées. Sauvegarde : %s\n' "$RESTORE_BACKUP"
