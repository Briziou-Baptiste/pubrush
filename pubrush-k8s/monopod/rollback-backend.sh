#!/usr/bin/env bash
# Rollback applicatif explicite ; conserver Recreate et HPA 1/1.
# Prérequis opérationnel : la révision SQL courante est reconnue par les deux
# images de migration. Ce script ne promet pas de réparer un schéma incompatible.
set -euo pipefail
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/deployment-common.sh"
parse_arguments "$@"
[[ -z "$STATE_ENV_FILE" || -z "$TARGET_IMAGE" ]] || { echo "Choisir --from-env OU --image." >&2; exit 1; }
prepare_workspace
validate_target
if [[ -z "$TARGET_IMAGE" ]]; then
  [[ -n "$STATE_ENV_FILE" ]] || STATE_ENV_FILE="$BACKUP_DIR/latest_pre_monopod_backup.env"
  validate_snapshot
  BACKEND_IMAGE=$(python3 "$STATE_TOOL" image "$STATE_ENV_FILE" backend)
  if [[ -n "$TARGET_MIGRATION_IMAGE" ]]; then
    MIGRATION_IMAGE=$(python3 "$STATE_TOOL" image-ref "$TARGET_MIGRATION_IMAGE")
  else
    MIGRATION_IMAGE=$(python3 "$STATE_TOOL" image "$STATE_ENV_FILE" migration)
  fi
else
  BACKEND_IMAGE=$(python3 "$STATE_TOOL" image-ref "$TARGET_IMAGE")
  if [[ -n "$TARGET_MIGRATION_IMAGE" ]]; then
    MIGRATION_IMAGE=$(python3 "$STATE_TOOL" image-ref "$TARGET_MIGRATION_IMAGE")
  else
    MIGRATION_IMAGE="$BACKEND_IMAGE"
  fi
fi
# Refuse a mixed/multipod target before changing either image.
require_monopod
kube set image deployment/pubrush-backend backend="$BACKEND_IMAGE" migration="$MIGRATION_IMAGE"
wait_convergence monopod
check_images "$BACKEND_IMAGE" "$MIGRATION_IMAGE"
printf 'Rollback monopod vérifié : backend=%s migration=%s\n' "$BACKEND_IMAGE" "$MIGRATION_IMAGE"
