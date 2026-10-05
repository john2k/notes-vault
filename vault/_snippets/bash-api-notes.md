---
id: snip-bash-curl
title: Bash — API notes
tags:
  - snippet
  - bash
color: blue
---

```bash
curl -s http://127.0.0.1:3000/api/notes | jq '.notes[].title'
```
