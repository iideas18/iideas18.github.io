#!/usr/bin/env python3
"""
Fetch GitHub "trending" repos via GitHub Search API and write JSON snapshots
into trending/data/.  Run from the repository root.

Uses GITHUB_TOKEN if set (5000 req/hr); falls back to anonymous (60 req/hr).
Queries repos *created* within each window, sorted by stars descending.
This surfaces newly-popular repositories rather than all-time heavyweights.
"""
import json
import os
import time
from datetime import datetime, timezone, timedelta

import requests

# (period_name, days_back, min_stars)
PERIODS = [
    ("daily",    2,   5),
    ("weekly",   7,  50),
    ("monthly", 30, 200),
]
DATA_DIR   = os.path.join(os.path.dirname(__file__), "..", "trending", "data")
INDEX_FILE = os.path.join(DATA_DIR, "index.json")
TODAY      = (datetime.now(timezone.utc) + timedelta(hours=8)).strftime("%Y-%m-%d")
TOKEN      = os.environ.get("GITHUB_TOKEN", "")
HEADERS    = {"Accept": "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28"}
if TOKEN:
    HEADERS["Authorization"] = f"Bearer {TOKEN}"


def fetch_period(period: str, days: int, min_stars: int) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    resp = requests.get(
        "https://api.github.com/search/repositories",
        headers=HEADERS,
        params={"q": f"created:>{since} stars:>{min_stars}",
                "sort": "stars", "order": "desc", "per_page": 25},
        timeout=20,
    )
    resp.raise_for_status()
    items = resp.json().get("items", [])
    return [{
        "author":      item["owner"]["login"],
        "name":        item["name"],
        "url":         item["html_url"],
        "description": item.get("description") or "",
        "language":    item.get("language") or "",
        "stars":       item.get("stargazers_count", 0),
        "forks":       item.get("forks_count", 0),
        "stars_today": None,
    } for item in items]


def load_index() -> dict:
    if os.path.exists(INDEX_FILE):
        with open(INDEX_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {"dates": []}


def save_json(path: str, data) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def main():
    index = load_index()
    for period, days, min_stars in PERIODS:
        print(f"Fetching {period} (created past {days}d, stars>{min_stars})…", flush=True)
        try:
            repos = fetch_period(period, days, min_stars)
        except Exception as exc:
            print(f"  ERROR: {exc}")
            continue
        print(f"  → {len(repos)} repos")
        save_json(os.path.join(DATA_DIR, f"{TODAY}-{period}.json"), {
            "date":     TODAY,
            "period":   period,
            "snapshot": datetime.now(timezone.utc).isoformat(),
            "repos":    repos,
        })
        time.sleep(1)

    if TODAY not in index["dates"]:
        index["dates"].append(TODAY)
        index["dates"].sort(reverse=True)
    save_json(INDEX_FILE, index)
    print(f"Done. Index now has {len(index['dates'])} date(s).")


if __name__ == "__main__":
    main()
