#!/usr/bin/env python3
"""
Import Notes markdown files into Hexo _posts directory.

For each .md file in Notes/:
  - Adds Hexo front matter (title, date from mtime, categories, slug)
  - Writes to hexo/source/_posts/{relative-path}.md
  - Copies associated image folder to hexo/source/{YYYY}/{MM}/{DD}/{slug}/
  - Adjusts image paths in markdown (strips the {stem}/ prefix)

Skips: README.md, temp files (.~*), .git/, PDF files
"""

import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

_REPO_ROOT = Path(__file__).resolve().parent.parent
NOTES_DIR = _REPO_ROOT / 'Notes'
HEXO_DIR  = _REPO_ROOT / 'hexo'
POSTS_DIR = HEXO_DIR / 'source' / '_posts'
SOURCE_DIR = HEXO_DIR / 'source'


def get_title_from_content(content: str) -> str | None:
    """Return the text of the first H1 heading, or None."""
    m = re.search(r'^#\s+(.+)', content, re.MULTILINE)
    return m.group(1).strip() if m else None


def yaml_str(value: str) -> str:
    """Quote a string for YAML front matter."""
    # Use double-quoted string; escape backslashes and double-quotes
    escaped = value.replace('\\', '\\\\').replace('"', '\\"')
    return f'"{escaped}"'


def strip_existing_frontmatter(content: str) -> str:
    """If content starts with ---, strip the front matter block."""
    if not content.startswith('---'):
        return content
    end = content.find('\n---', 4)
    if end == -1:
        return content
    # Skip past the closing --- and the following newline
    after = content[end + 4:]
    if after.startswith('\n'):
        after = after[1:]
    return after


def rewrite_image_paths(content: str, stem: str) -> str:
    """
    Replace image references of the form  ![alt](stem/img.ext)  (plain or URL-encoded stem)
    with                                   ![alt](img.ext)
    Leave all other image references unchanged.
    """
    prefix = stem + '/'

    def replacer(m):
        alt  = m.group(1)
        path = m.group(2)
        # Decode URL-encoded paths (e.g. Docker%20%E9%95%... → Docker 镜像管理/...)
        decoded_path = unquote(path)
        if decoded_path.startswith(prefix):
            return f'![{alt}]({decoded_path[len(prefix):] })'
        return m.group(0)

    return re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', replacer, content)


def process_note(md_file: Path) -> Path:
    """Process a single markdown file into a Hexo post."""
    # --- read content ---
    try:
        raw = md_file.read_text(encoding='utf-8')
    except UnicodeDecodeError:
        raw = md_file.read_text(encoding='latin-1')

    body = strip_existing_frontmatter(raw)

    # --- metadata ---
    mtime    = md_file.stat().st_mtime
    dt       = datetime.fromtimestamp(mtime)
    date_str = dt.strftime('%Y-%m-%d %H:%M:%S')
    year, month, day = dt.strftime('%Y'), dt.strftime('%m'), dt.strftime('%d')

    stem  = md_file.stem                          # e.g. "Const"
    title = get_title_from_content(body) or stem  # prefer H1

    # categories = all directory components between Notes/ and the file
    rel_parts = md_file.relative_to(NOTES_DIR).parts  # e.g. ('C++', 'Const.md')
    categories = list(rel_parts[:-1])                  # e.g. ['C++']

    # --- build front matter ---
    fm_lines = ['---', f'title: {yaml_str(title)}', f'date: {date_str}']
    if stem != title:
        # keep slug = filename stem so image folder path is predictable
        fm_lines.append(f'slug: {yaml_str(stem)}')
    if categories:
        fm_lines.append('categories:')
        for cat in categories:
            fm_lines.append(f'  - {yaml_str(cat)}')
    fm_lines += ['---', '']
    front_matter = '\n'.join(fm_lines) + '\n'

    # The slug used in the permalink (:title) — Hexo uses slug if set, else title
    permalink_slug = stem  # always use stem for consistency

    # --- rewrite image paths ---
    new_body = rewrite_image_paths(body, stem)

    # --- write post ---
    rel_path = md_file.relative_to(NOTES_DIR)   # e.g. C++/Const.md
    post_path = POSTS_DIR / rel_path
    post_path.parent.mkdir(parents=True, exist_ok=True)
    post_path.write_text(front_matter + new_body, encoding='utf-8')

    # --- copy images ---
    img_src = md_file.parent / stem              # e.g. Notes/C++/Const/
    if img_src.is_dir():
        # Post URL: /:year/:month/:day/<category-subdirs>/:slug/
        # so images must live under the same path for relative refs to resolve
        img_dst = SOURCE_DIR.joinpath(year, month, day, *categories, permalink_slug)
        if img_dst.exists():
            shutil.rmtree(img_dst)
        shutil.copytree(img_src, img_dst,
                        ignore=shutil.ignore_patterns('*.pdf'))

    return post_path


def collect_notes(notes_dir: Path) -> list[Path]:
    results = []
    for f in notes_dir.rglob('*.md'):
        if '.git' in f.parts:
            continue
        if f.name == 'README.md':
            continue
        if f.name.startswith('.~'):
            continue
        results.append(f)
    results.sort()
    return results


def main():
    POSTS_DIR.mkdir(parents=True, exist_ok=True)

    notes = collect_notes(NOTES_DIR)
    print(f'Found {len(notes)} markdown files under {NOTES_DIR}\n')

    ok, skip = 0, 0
    for md_file in notes:
        rel = md_file.relative_to(NOTES_DIR)
        try:
            post_path = process_note(md_file)
            print(f'  OK  {rel}  →  {post_path.relative_to(POSTS_DIR)}')
            ok += 1
        except Exception as exc:
            print(f'  ERR {rel}  —  {exc}')
            skip += 1

    print(f'\nDone: {ok} imported, {skip} errors')


if __name__ == '__main__':
    main()
