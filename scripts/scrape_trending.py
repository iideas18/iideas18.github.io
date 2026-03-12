#!/usr/bin/env python3
"""
Fetch GitHub "trending" repos via GitHub Search API and write JSON snapshots
into trending/data/.  Run from the repository root.

Uses GITHUB_TOKEN if set (5000 req/hr); falls back to anonymous (60 req/hr).
Uses 'pushed:>DATE' window sorted by stars as a trending approximation.
"""
import json
import os
import time
from datetime import datetime, timezone, timedelta

import requests

PERIODS = [
    ("daily",   3,  "Active past 3 days"),
    ("weekly",  14, "Active past 14 days"),
    ("monthly", 60, "Active past 60 days"),
]
DATA_DIR   = os.path.join(os.path.dirname(__file__), "..", "trending", "data")
INDEX_FILE = os.path.join(DATA_DIR, "index.json")
TODAY      = (datetime.now(timezone.utc) + timedelta(hours=8)).strftime("%Y-%m-%d")
TOKEN      = os.environ.get("GITHUB_TOKEN", "")
HEADERS    = {"Accept": "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28"}
if TOKEN:
    HEADERS["Authorization"] = f"Bearer {TOKEN}"


def fetch_period(period: str, days: int) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    resp = requests.get(
        "https://api.github.com/search/repositories",
        headers=HEADERS,
        params={"q": f"pushed:>{since} stars:>50",
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
    for period, days, _ in PERIODS:
        print(f"Fetching {period} ({days}-day window)…", flush=True)
        try:
            repos = fetch_period(period, days)
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
