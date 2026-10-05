#!/usr/bin/env bash
# backup-sync.sh — vault backup: git commit → rsync Unraid → rclone Google Drive
# Sauvegarde vault : commit git → rsync Unraid → rclone Google Drive
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VAULT_DIR="${VAULT_DIR:-${ROOT_DIR}/vault}"
UNRAID_BACKUP_MOUNT="${UNRAID_BACKUP_MOUNT:-/mnt/unraid_backups/notes}"
RCLONE_REMOTE="${RCLONE_REMOTE:-gdrive_encrypted:NotesVault}"
LOG_PREFIX="[notes-vault-backup]"

log() { echo "${LOG_PREFIX} $(date -Is) $*"; }

# --- 1) Git commit inside vault/ when files changed ---
# --- 1) Commit git dans vault/ si des fichiers ont changé ---
if [[ -d "${VAULT_DIR}/.git" ]]; then
  pushd "${VAULT_DIR}" >/dev/null
  if [[ -n "$(git status --porcelain)" ]]; then
    git add -A
    git commit -m "vault backup $(date -u +%Y-%m-%dT%H:%M:%SZ)" || true
    log "git commit created in vault/"
  else
    log "vault/ clean — no git commit"
  fi
  popd >/dev/null
else
  log "vault/ is not a git repo — skipping commit (init with: git -C vault init)"
fi

# --- 2) Mirror to Unraid SMB mount: //10.1.1.201/Backup/Notes-JD ---
# --- 2) Miroir vers le montage Unraid ---
if [[ ! -d "${UNRAID_BACKUP_MOUNT}" ]]; then
  log "ERROR: Unraid mount missing: ${UNRAID_BACKUP_MOUNT}"
  exit 1
fi

mkdir -p "${UNRAID_BACKUP_MOUNT}/current"
rsync -a --delete \
  --exclude '.git/' \
  --exclude '*.tmp' \
  "${VAULT_DIR}/" "${UNRAID_BACKUP_MOUNT}/current/"
log "rsync mirror OK → ${UNRAID_BACKUP_MOUNT}/current/"

# --- 3) Encrypted Google Drive sync with versioned backup-dir ---
# --- 3) Sync Google Drive chiffré avec dossier d'archives ---
if command -v rclone >/dev/null 2>&1; then
  STAMP="$(date -u +%Y%m%d-%H%M%S)"
  rclone sync "${VAULT_DIR}" "${RCLONE_REMOTE}" \
    --backup-dir "${RCLONE_REMOTE}-archive/${STAMP}" \
    --exclude '.git/**' \
    --exclude '*.tmp' \
    --fast-list
  log "rclone sync OK → ${RCLONE_REMOTE}"
else
  log "WARN: rclone not installed — skipped Google Drive sync"
fi

log "backup finished"
