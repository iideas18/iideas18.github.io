# iideas.github.io

Personal blog published at <https://iideas18.github.io>.

## Repository Layout

This repository uses the `gh-pages` branch directly as the GitHub Pages source.

| Path | Purpose |
|------|---------|
| `index.html`, `archives/`, `tags/`, `categories/`, `about/`, `css/`, `js/`, `img/` | Generated static site served by GitHub Pages |
| `hexo/` | Hexo 8 workspace — source posts, layouts, and build tooling |
| `hexo/source/_posts/` | Markdown posts (organised by category subfolder) |
| `hexo/themes/reconstructed/` | Custom theme with EJS layouts (`post.ejs`, `index.ejs`, `archive.ejs`) |
| `Notes/` | Raw markdown notes; imported into `_posts/` via `scripts/import_notes.py` |
| `scripts/` | Helper scripts (import notes, fetch projects, scrape trending) |
| `.github/workflows/` | CI workflows: publish site, fetch projects, scrape trending |

## Prerequisites

- Node.js 22+
- Python 3.11+

## Local Preview

```bash
# From the repo root after generating:
python3 -m http.server 4000
# open http://localhost:4000
```

## Hexo Authoring Workflow

### Where are the source files?

`Notes/` is the **canonical source** of all posts. Do not edit `hexo/source/_posts/` directly — it is overwritten by the import script.

```
Notes/
  Linux/
    epoll.md          ← edit here
  C++/
    虚函数.md
  Docker/
    ...
```

### Adding or editing a post

```bash
# 1. Edit (or create) a file in Notes/
vim Notes/Linux/epoll.md

# 2. Rebuild — import from Notes/ and generate happen automatically
cd hexo
npm run generate

# 3. Preview
cd ..
python3 -m http.server 4000
```

### Front matter

If you create a new note, the import script auto-generates front matter from the filename and mtime. You can also add it manually at the top of the file and the script will respect it:

```markdown
---
title: "My Post Title"
date: 2026-03-13 10:00:00
categories:
  - "Linux"
---

Content starts here...
```

### Full publish

```bash
cd hexo
npm run publish-root   # generate + rsync output to repo root
cd ..
git add -A && git commit -m "build: site update $(date -u '+%Y-%m-%d')"
git push origin gh-pages
```

The CI workflow (`.github/workflows/publish-site.yml`) also runs automatically on push to `gh-pages`.
