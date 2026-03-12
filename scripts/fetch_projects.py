#!/usr/bin/env python3
"""
Fetch GitHub repos for iideas18 via the GitHub API and write
projects/data/repos.json.  Run from the repository root.

Uses GITHUB_TOKEN env var if present (5000 req/hr) — fine without it too
since a single user's repos only needs a handful of requests.
"""
import json
import os

import requests

USER     = "iideas18"
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "projects", "data")
OUT_FILE = os.path.join(DATA_DIR, "repos.json")

TOKEN = os.environ.get("GITHUB_TOKEN", "")
HEADERS = {"Accept": "application/vnd.github+json",
           "X-GitHub-Api-Version": "2022-11-28"}
if TOKEN:
    HEADERS["Authorization"] = f"Bearer {TOKEN}"


def fetch_repos() -> list[dict]:
    repos, page = [], 1
    while True:
        url = (f"https://api.github.com/users/{USER}/repos"
               f"?per_page=100&sort=updated&page={page}")
        resp = requests.get(url, headers=HEADERS, timeout=20)
        resp.raise_for_status()
        batch = resp.json()
        repos.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return repos


def slim(repo: dict) -> dict:
    """Keep only the fields the projects page actually uses."""
    return {
        "id":               repo["id"],
        "name":             repo["name"],
        "html_url":         repo["html_url"],
        "description":      repo.get("description") or "",
        "language":         repo.get("language") or "",
        "stargazers_count": repo.get("stargazers_count", 0),
        "forks_count":      repo.get("forks_count", 0),
        "pushed_at":        repo.get("pushed_at", ""),
        "fork":             repo.get("fork", False),
        "archived":         repo.get("archived", False),
    }


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"Fetching repos for {USER}…")
    repos = fetch_repos()
    slimmed = [slim(r) for r in repos]
    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump({"repos": slimmed, "updated": __import__("datetime").datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")}, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Wrote {len(slimmed)} repos → {OUT_FILE}")


if __name__ == "__main__":
    main()
