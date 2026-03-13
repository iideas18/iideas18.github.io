---
name: import-notes-to-hexo
description: 'Import markdown notes from the Notes/ directory into the Hexo blog as published posts. Use when: publishing new notes, re-syncing notes to the blog, adding notes with images, converting markdown files to Hexo posts with correct front matter and dates.'
argument-hint: 'Optional: subdirectory to import (e.g. "Linux" or "Docker")'
---

# Import Notes to Hexo

Converts raw markdown notes in `Notes/` into properly formatted Hexo blog posts with front matter, correct post dates (from file mtime), and associated images.

## When to Use

- Publishing new or updated notes to the blog
- Re-syncing the `Notes/` directory after adding files
- Importing notes along with their diagrams and screenshots
- Setting post date automatically from file modification time

## Key Paths

| Path | Purpose |
|------|---------|
| `Notes/` | Source markdown notes (organized by topic folder) |
| `hexo/source/_posts/` | Hexo posts output (mirrors `Notes/` folder structure) |
| `hexo/source/YYYY/MM/DD/{slug}/` | Copied image assets per post |
| `scripts/import_notes.py` | Main import script |
| `hexo/tools/generate.js` | Custom Hexo build script |

## Procedure

### Step 1 — Run the import script

```bash
python3 scripts/import_notes.py
```

What this does for each `.md` file under `Notes/`:

1. **Skips**: `README.md`, `.git/`, temp files (`.~*`), non-`.md` files
2. **Front matter**: injects `title` (from first H1 heading, or filename stem), `date` (from file **mtime**), `categories` (from folder path), `slug` (filename stem)
3. **Strips** any existing front matter before injecting new one
4. **Writes** post to `hexo/source/_posts/<relative-path>.md`
5. **Images**: if a same-name folder exists alongside the `.md` (e.g. `Const/` next to `Const.md`), copies it to `hexo/source/YYYY/MM/DD/Const/`, **excluding PDF files**
6. **Rewrites** image paths in the markdown body — strips the `stem/` prefix so images resolve from the post's asset folder

### Step 2 — Build the site

```bash
cd hexo && node tools/generate.js
```

This runs `hexo clean` + `hexo generate` then copies non-post source assets into `public/`.

To also sync `public/` back to the repo root (for GitHub Pages):

```bash
cd hexo && node tools/generate.js --sync-root
```

## Rules & Constraints

- **Date = file mtime** — do not override unless the user explicitly requests a different date
- **No PDFs** — PDF files are always excluded from image asset copies
- **Slug = filename stem** — keeps asset folder names predictable and stable
- **Categories = folder hierarchy** — e.g. `Notes/Docker/Docker架构.md` → `categories: ["Docker"]`
- **Idempotent** — re-running the script overwrites existing posts and refreshes image folders cleanly

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Images broken after import | Check that a same-name folder exists next to the `.md`; verify the `stem/` prefix was present in `![alt](stem/img.png)` |
| Wrong post date | Check file mtime: `stat Notes/path/to/file.md` |
| `hexo generate` shows "unknown command" | Use `node tools/generate.js` — this repo uses a custom build script, not bare `hexo` CLI |
| Encoding errors | Script falls back to `latin-1`; if content is garbled, manually fix encoding before importing |

## Script Reference

[scripts/import_notes.py](../../../scripts/import_notes.py)
