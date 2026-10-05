---
id: snip-ps1-list
title: PowerShell — list vault
tags:
  - snippet
  - powershell
color: orange
---

```powershell
Get-ChildItem -Path .\vault -Recurse -Filter *.md |
  Select-Object FullName, Length, LastWriteTime
```
