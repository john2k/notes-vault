# systemd setup for Notes Vault backups (Proxmox LXC / Debian-Ubuntu)
# Configuration systemd pour les sauvegardes Notes Vault (LXC Proxmox)

## Prerequisites / Prérequis

- App deployed under `/opt/notes-vault`
- Unraid share mounted at `/mnt/unraid_backups/notes`  
  SMB source: `//10.1.1.201/Backup/Notes-JD` (`\\10.1.1.201\Backup\Notes-JD`)
- `rclone` configured with remote `gdrive_encrypted`
- Optional: `git init` inside `/opt/notes-vault/vault` for local history commits

### Example Unraid mount (`/etc/fstab`)

```fstab
//10.1.1.201/Backup/Notes-JD  /mnt/unraid_backups/notes  cifs  credentials=/root/.smbcredentials-notes,uid=0,gid=0,iocharset=utf8,file_mode=0644,dir_mode=0755  0  0
```

Create `/root/.smbcredentials-notes` on the LXC (never commit secrets):

```
username=YOUR_USER
password=YOUR_PASSWORD
```

## Service unit — `/etc/systemd/system/notes-vault-backup.service`

```ini
[Unit]
Description=Notes Vault backup (git + Unraid rsync + rclone)
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
WorkingDirectory=/opt/notes-vault
Environment=VAULT_DIR=/opt/notes-vault/vault
Environment=UNRAID_BACKUP_MOUNT=/mnt/unraid_backups/notes
Environment=RCLONE_REMOTE=gdrive_encrypted:NotesVault
ExecStart=/bin/bash /opt/notes-vault/scripts/backup-sync.sh
Nice=10
```

## Timer unit — every 4 hours — `/etc/systemd/system/notes-vault-backup.timer`

```ini
[Unit]
Description=Run Notes Vault backup every 4 hours

[Timer]
OnBootSec=10min
OnUnitActiveSec=4h
Persistent=true
Unit=notes-vault-backup.service

[Install]
WantedBy=timers.target
```

## Enable / Activer

```bash
chmod +x /opt/notes-vault/scripts/backup-sync.sh
systemctl daemon-reload
systemctl enable --now notes-vault-backup.timer
systemctl list-timers | grep notes-vault
systemctl start notes-vault-backup.service
journalctl -u notes-vault-backup.service -n 50 --no-pager
```
