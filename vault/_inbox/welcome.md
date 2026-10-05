---
id: welcome
title: Welcome / Bienvenue
tags:
  - inbox
  - setup
color: blue
pinned: true
---

# Notes Vault

Local-first markdown notes. The `vault/` folder is the **source of truth**.

Coffre de notes markdown local-first. Le dossier `vault/` est la **source de vérité**.

## Checklist

- [x] Project scaffolded / Projet initialisé
- [x] Color themes + syntax highlighting / Thèmes couleur + coloration
- [ ] Deploy tunings (SMB Unraid + rclone)
- [ ] HomeHub embeds

## PowerShell

```powershell
Get-ChildItem -Path C:\Users\John\Project\Notes-JD\vault -Recurse |
  Where-Object { $_.Extension -eq '.md' } |
  Select-Object FullName, Length
```

## Bash

```bash
curl -s http://10.1.1.131:3000/api/notes | jq '.notes[].title'
```

## JSON

```json
{
  "title": "Quick capture",
  "tags": ["inbox", "homelab"],
  "color": "orange"
}
```

## INI

```ini
[notes-vault]
host=10.1.1.131
port=3000
vault=/opt/notes-vault/vault
```

## YAML

```yaml
service:
  name: notes-vault
  image: local
  ports:
    - "3000:3000"
  env:
    HOMEHUB_API_TOKEN: "${HOMEHUB_API_TOKEN}"
```
