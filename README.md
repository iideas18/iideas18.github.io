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

```bash
cd hexo
npm install            # first time only

# Option A — write a post directly
# Create hexo/source/_posts/<category>/<title>.md with front matter:
# ---
# title: "My Post"
# date: 2026-03-13 10:00:00
# categories:
#   - "MyCategory"
# ---

# Option B — import from Notes/
python3 ../scripts/import_notes.py

# Build
npm run generate       # rebuilds public/ into hexo/public/
npm run publish-root   # generate + rsync output to repo root
```

## Deployment

```bash
git add -A && git commit -m "build: site update $(date -u '+%Y-%m-%d')"
git push origin gh-pages
```

The CI workflow (`.github/workflows/publish-site.yml`) also runs automatically on push to `gh-pages`.
