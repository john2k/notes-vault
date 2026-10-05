# Notes Vault

Local-first, resilient markdown notes app built with Next.js.  
Application de notes markdown local-first et résiliente, basée sur Next.js.

**File-Over-App** — plain `.md` / JSON files in `vault/` are the source of truth. SQLite is only a disposable FTS5 cache.  
**File-Over-App** — les fichiers `.md` / JSON dans `vault/` sont la source de vérité. SQLite n’est qu’un cache FTS5 jetable.

## Stack

- Next.js 15 · React 19 · Tailwind · Tiptap
- better-sqlite3 (FTS5) · Chokidar · gray-matter
- tldraw canvas · PDF annotations · audio capture
- Embed routes for future HomeHub widgets

## Quick start / Démarrage rapide

```bash
pnpm install
pnpm approve-builds --all -y   # allow native builds (sharp, better-sqlite3, …)
cp .env.example .env.local     # optional HOMEHUB_API_TOKEN
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Vault layout / Structure du coffre

```
vault/
  Travail/
  Personnel/
  _inbox/
  _trash/
  _attachments/audio/
```

Writes are atomic (`.tmp` → rename) to avoid truncated files on crash.  
Les écritures sont atomiques (`.tmp` → rename) pour éviter les fichiers tronqués.

## API (headless)

| Route | Role |
|-------|------|
| `GET/POST /api/notes` | List / create |
| `GET/PUT/DELETE /api/notes/[...path]` | Read / update / trash |
| `GET /api/search?q=` | FTS5 search + snippets |
| `POST /api/quick-capture` | Append to `_inbox/YYYY-MM-DD-inbox.md` |
| `POST /api/upload-media` | Audio / binary attachments |
| `GET/PUT /api/canvas` | Infinite canvas `.canvas` JSON |
| `GET/PUT /api/annotations` | PDF companion `.annotations.json` |

When `HOMEHUB_API_TOKEN` is set, send `Authorization: Bearer <token>`.  
Si `HOMEHUB_API_TOKEN` est défini, envoyer `Authorization: Bearer <token>`.

## Embeds (HomeHub)

- `/embed/note/<path>?minimal=true&theme=dark` — interactive checkboxes
- `/embed/scratchpad` — send to inbox

## Backups (Proxmox LXC)

See [`scripts/systemd-setup.md`](scripts/systemd-setup.md).

- Unraid mirror: `\\10.1.1.201\Backup\Notes-JD` → mount `/mnt/unraid_backups/notes`
- Script: [`scripts/backup-sync.sh`](scripts/backup-sync.sh) (git + rsync + rclone)
- Timer: every **4 hours**

## Deploy notes / Notes de déploiement

Typical LXC on Proxmox node `pve` (`10.1.1.6`):

1. Create Debian 12 LXC `notes-vault` (nesting on)
2. Install Node 22 + pnpm, clone this repo to `/opt/notes-vault`
3. `pnpm i && pnpm build && systemctl enable --now notes-vault`
4. Mount Unraid share + enable backup timer

**Do not commit secrets** (`.env`, SMB credentials, rclone tokens, private notes).  
**Ne pas committer de secrets** (`.env`, credentials SMB, jetons rclone, notes privées).

## License

Private use / usage personnel — adjust as needed.
