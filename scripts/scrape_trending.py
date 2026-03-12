#!/usr/bin/env python3
"""
Scrape GitHub Trending for daily/weekly/monthly periods and write JSON snapshots
into trending/data/.  Run from the repository root.
"""
import json
import os
import time
from datetime import datetime, timezone, timedelta

import requests
from bs4 import BeautifulSoup

# ── constants ────────────────────────────────────────────────────────────────
BASE_URL = "https://github.com/trending"
PERIODS  = ["daily", "weekly", "monthly"]
HEADERS  = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "trending", "data")
INDEX_FILE = os.path.join(DATA_DIR, "index.json")

# Date in CST (UTC+8)
TODAY = (datetime.now(timezone.utc) + timedelta(hours=8)).strftime("%Y-%m-%d")


def scrape_period(period: str) -> list[dict]:
    url = f"{BASE_URL}?since={period}"
    resp = requests.get(url, headers=HEADERS, timeout=20)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    repos = []
    for article in soup.select("article.Box-row"):
        # author / name
        h2 = article.select_one("h2.h3 a")
        if not h2:
            continue
        parts = [p.strip() for p in h2.get_text("/").split("/") if p.strip()]
        author = parts[0] if len(parts) > 0 else ""
        name   = parts[1] if len(parts) > 1 else parts[0]
        url_path = h2.get("href", "").lstrip("/")
        repo_url = f"https://github.com/{url_path}"

        # description
        desc_el = article.select_one("p")
        description = desc_el.get_text(strip=True) if desc_el else ""

        # language
        lang_el = article.select_one("[itemprop='programmingLanguage']")
        language = lang_el.get_text(strip=True) if lang_el else ""

        # stars / forks
        def parse_num(selector):
            el = article.select_one(selector)
            if not el:
                return 0
            txt = el.get_text(strip=True).replace(",", "")
            try:
                return int(txt)
            except ValueError:
                return 0

        stars = parse_num("a[href$='/stargazers']")
        forks = parse_num("a[href$='/forks']")

        # stars gained today
        gained_el = article.select_one("span.d-inline-block.float-sm-right")
        gained = 0
        if gained_el:
            txt = gained_el.get_text(strip=True).replace(",", "").split()[0]
            try:
                gained = int(txt)
            except ValueError:
                gained = 0

        repos.append({
            "author":      author,
            "name":        name,
            "url":         repo_url,
            "description": description,
            "language":    language,
            "stars":       stars,
            "forks":       forks,
            "gained":      gained,
        })

    return repos


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

    for period in PERIODS:
        print(f"Scraping {period}…", flush=True)
        try:
            repos = scrape_period(period)
        except Exception as exc:
            print(f"  ERROR: {exc}")
            continue

        print(f"  → {len(repos)} repos")
        out_path = os.path.join(DATA_DIR, f"{TODAY}-{period}.json")
        save_json(out_path, {
            "date":      TODAY,
            "period":    period,
            "snapshot":  datetime.now(timezone.utc).isoformat(),
            "repos":     repos,
        })
        time.sleep(2)   # be polite

    # update index
    if TODAY not in index["dates"]:
        index["dates"].append(TODAY)
        index["dates"].sort(reverse=True)

    save_json(INDEX_FILE, index)
    print(f"Done. Index now has {len(index['dates'])} date(s).")


if __name__ == "__main__":
    main()
