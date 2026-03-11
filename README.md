# iideas.github.io

Personal blog published at <https://iideas18.github.io>.

## Repository Layout

This repository uses the `gh-pages` branch directly as the GitHub Pages source — no CI build is needed.

| Path | Purpose |
|------|---------|
| `index.html`, `archives/`, `tags/`, `categories/`, `about/`, `css/`, `js/`, `img/` | Generated static site served by GitHub Pages |
| `hexo/` | Local-only Hexo workspace (gitignored) |

## Local Preview

```bash
python3 -m http.server 4000
# open http://localhost:4000
```

## Hexo Authoring Workflow

```bash
cd hexo
# edit posts under source/_posts/
hexo generate          # rebuilds public/ output
```

After generation, copy the output back into the repository root, review the diff, and commit.

## Deployment

Commit generated static files to `gh-pages` and push:

```bash
git add -A && git commit -m "Site updated: $(date -u '+%Y-%m-%d')"
git push origin gh-pages
```
