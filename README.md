# iideas.github.io

Personal blog repository for the site published at `https://iideas18.github.io`.

This repository currently behaves as a GitHub Pages publish branch: the committed files at the repository root are the generated static site that GitHub Pages serves directly.

## Repository Layout

- `index.html`, `archives/`, `tags/`, `categories/`, `about/`, `messageboard/`, `timeline/`: generated site pages.
- `css/`, `js/`, `img/`: static assets used by the published site.
- `_config.yml`: deployment target for Hexo.
- `hexo/`: local-only Hexo workspace used for drafting or rebuilding the site. This directory is ignored by git in the current setup.

## How This Repo Is Used

There are two distinct layers in the working tree:

1. The tracked root directory is the published output.
2. The optional local `hexo/` directory is a private editing workspace and is not part of the committed history.

If you only need to change a small static asset or generated page, you can edit the tracked files in the repository root.

If you want a normal Hexo authoring workflow, use the local `hexo/` workspace, generate the site there, and then sync the generated output back into the repository root before committing.

## Local Preview

Because the root of the repository is already a static site, the simplest local preview is any static file server run from the repository root.

Example with Python:

```bash
python3 -m http.server 4000
```

Then open `http://localhost:4000`.

## Hexo Workflow

If you maintain the site through Hexo locally, the usual flow is:

```bash
cd hexo
# edit posts, pages, theme, or config
# generate the site output
hexo generate
```

After generation, copy or sync the built output into the repository root, review the diff, and commit the updated static files.

## Git Branch Notes

- The remote repository publishes from `gh-pages`.
- In this local clone, `main` may be configured to track `origin/gh-pages` for convenience.

If `git pull` complains about `refs/heads/main` not existing on the remote, update the branch tracking so the local branch follows `origin/gh-pages` instead.

## Deployment

The root `_config.yml` currently points Hexo deployment at:

```yml
deploy:
	type: git
	repo: https://github.com/iideas18/iideas.github.io
```

In practice, the important part for this repository is that the generated static site committed at the root matches the branch GitHub Pages is serving.
