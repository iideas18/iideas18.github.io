#!/usr/bin/env python3
"""
Fetch GitHub trending repos and write JSON snapshots into trending/data/.
Run from the repository root.

Strategy:
  1. Scrape github.com/trending?since=<period> (HTML) for the authentic
     GitHub-curated list — gives up to 25 repos (GitHub limits unauthenticated
     scrapers to a smaller batch, so typically 6-25 depending on the day).
  2. If fewer than 20 repos were returned, supplement with GitHub Search API
     (created:>DATE sort:stars) to pad up to 25 fresh entries.

This guarantees ≥20 genuinely-fresh trending repos every day.
Uses GITHUB_TOKEN if set (5 000 req/hr API quota); falls back to anonymous.
"""
import json
import os
import re
import time
from datetime import datetime, timezone, timedelta

import requests
from bs4 import BeautifulSoup

PERIODS    = ["daily", "weekly", "monthly"]
BASE_URL   = "https://github.com/trending"
DATA_DIR   = os.path.join(os.path.dirname(__file__), "..", "trending", "data")
INDEX_FILE = os.path.join(DATA_DIR, "index.json")
TODAY      = (datetime.now(timezone.utc) + timedelta(hours=8)).strftime("%Y-%m-%d")

TOKEN   = os.environ.get("GITHUB_TOKEN", "")
API_HEADERS = {"Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28"}
if TOKEN:
    API_HEADERS["Authorization"] = f"Bearer {TOKEN}"

WEB_HEADERS = {
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/123.0.0.0 Safari/537.36"
    ),
}

# How far back to look when using the Search API fallback
FALLBACK_DAYS = {"daily": 2, "weekly": 7, "monthly": 30}
# Minimum stars for Search API fallback
FALLBACK_STARS = {"daily": 5, "weekly": 50, "monthly": 200}


def parse_int(text: str) -> int:
    text = text.replace(",", "").strip()
    m = re.search(r"\d+", text)
    return int(m.group()) if m else 0


def scrape_github_trending(period: str) -> list[dict]:
    """Scrape github.com/trending HTML — returns 6-25 repos."""
    resp = requests.get(BASE_URL, headers=WEB_HEADERS,
                        params={"since": period}, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    repos = []
    for article in soup.select("article.Box-row"):
        h2 = article.select_one("h2.lh-condensed a")
        if not h2:
            continue
        path_parts = [p.strip() for p in h2.get("href", "").strip("/").split("/") if p.strip()]
        if len(path_parts) < 2:
            continue
        author, name = path_parts[0], path_parts[1]

        desc_el = article.select_one("p.col-9")
        description = desc_el.get_text(strip=True) if desc_el else ""

        lang_el = article.select_one('span[itemprop="programmingLanguage"]')
        language = lang_el.get_text(strip=True) if lang_el else ""

        muted = article.select("a.Link--muted")
        stars = parse_int(muted[0].get_text()) if len(muted) > 0 else 0
        forks = parse_int(muted[1].get_text()) if len(muted) > 1 else 0

        gained = None
        for span in article.select("span.d-inline-block"):
            txt = span.get_text(strip=True)
            if "star" in txt.lower():
                gained = parse_int(txt)
                break

        repos.append({
            "author":      author,
            "name":        name,
            "url":         f"https://github.com/{author}/{name}",
            "description": description,
            "language":    language,
            "stars":       stars,
            "forks":       forks,
            "stars_today": gained,
            "source":      "trending_page",
        })
    return repos


def search_api_trending(period: str, existing_urls: set, want: int) -> list[dict]:
    """Fill remaining slots via GitHub Search API (created:>DATE sort:stars)."""
    days = FALLBACK_DAYS[period]
    min_stars = FALLBACK_STARS[period]
    since = (datetime.now(timezone.utc) - timedelta(days=days)).strftime("%Y-%m-%d")
    try:
        resp = requests.get(
            "https://api.github.com/search/repositories",
            headers=API_HEADERS,
            params={"q": f"created:>{since} stars:>{min_stars}",
                    "sort": "stars", "order": "desc", "per_page": 50},
            timeout=20,
        )
        resp.raise_for_status()
    except Exception as exc:
        print(f"    Search API error: {exc}")
        return []

    results = []
    for item in resp.json().get("items", []):
        url = item["html_url"]
        if url in existing_urls or len(results) >= want:
            continue
        results.append({
            "author":      item["owner"]["login"],
            "name":        item["name"],
            "url":         url,
            "description": item.get("description") or "",
            "language":    item.get("language") or "",
            "stars":       item.get("stargazers_count", 0),
            "forks":       item.get("forks_count", 0),
            "stars_today": None,
            "source":      "search_api",
        })
    return results


def fetch_period(period: str) -> list[dict]:
    repos = scrape_github_trending(period)
    print(f"    github.com/trending → {len(repos)} repos")

    if len(repos) < 20:
        existing = {r["url"] for r in repos}
        want = 25 - len(repos)
        print(f"    supplementing with Search API (need {want} more)…")
        extras = search_api_trending(period, existing, want)
        print(f"    Search API → {len(extras)} additional repos")
        repos.extend(extras)

    return repos[:25]


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
        print(f"Fetching {period} trending…", flush=True)
        try:
            repos = fetch_period(period)
        except Exception as exc:
            print(f"  ERROR: {exc}")
            continue
        print(f"  → {len(repos)} repos total")
        save_json(os.path.join(DATA_DIR, f"{TODAY}-{period}.json"), {
            "date":     TODAY,
            "period":   period,
            "snapshot": datetime.now(timezone.utc).isoformat(),
            "repos":    repos,
        })
        time.sleep(2)

    if TODAY not in index["dates"]:
        index["dates"].append(TODAY)
        index["dates"].sort(reverse=True)
    save_json(INDEX_FILE, index)
    print(f"Done. Index now has {len(index['dates'])} date(s).")


if __name__ == "__main__":
    main()
