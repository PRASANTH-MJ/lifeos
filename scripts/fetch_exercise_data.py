#!/usr/bin/env python3
"""Fetch exercise data from wger (canonical source, public, no key) and optionally
enrich it with GIF/video media from ExerciseDB (requires a RapidAPI key).

wger is the same source Flowsy's existing bundled 228-exercise library already came
from — this refreshes/expands that dataset rather than replacing it with something new.
ExerciseDB's real production API sits behind RapidAPI; its unauthenticated "playground"
endpoints are explicitly documented as not for production use, so media enrichment is
skipped (not faked) when no key is configured.

Usage:
    python3 scripts/fetch_exercise_data.py [--limit N] [--out PATH]

Env:
    EXERCISEDB_API_KEY   RapidAPI key for ExerciseDB. If unset, the script still runs
                          end-to-end using wger data alone — gif_url/video_url are left
                          null rather than fabricated.

Output: a normalized JSON array written to scripts/output/exercises_normalized.json
(or --out), safe to inspect before anything gets seeded into SQLite or Firestore.
"""

import argparse
import html
import json
import re
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional

WGER_BASE = "https://wger.de/api/v2"
WGER_ENGLISH_LANGUAGE_ID = 2
EXERCISEDB_HOST = "exercisedb.p.rapidapi.com"
REQUEST_TIMEOUT = 20
PAGE_SIZE = 100


def slugify(name: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
    return slug or "exercise"


def strip_html(text: Optional[str]) -> str:
    if not text:
        return ""
    return html.unescape(re.sub(r"<[^>]+>", " ", text)).strip()


def http_get_json(url: str, headers: Optional[Dict[str, str]] = None):
    request = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_wger_exercises(limit: Optional[int] = None) -> List[dict]:
    """Paginates wger's public exerciseinfo endpoint. No API key required."""
    results: List[dict] = []
    url = f"{WGER_BASE}/exerciseinfo/?limit={PAGE_SIZE}&format=json"
    while url:
        print(f"  fetching {url}", file=sys.stderr)
        try:
            page = http_get_json(url)
        except urllib.error.URLError as error:
            print(f"  wger request failed: {error} — stopping pagination here", file=sys.stderr)
            break
        results.extend(page.get("results", []))
        if limit and len(results) >= limit:
            results = results[:limit]
            break
        url = page.get("next")
        if url:
            time.sleep(0.2)  # wger is a free community API — be a polite caller
    return results


def normalize_wger(raw: dict) -> Optional[dict]:
    translation = next(
        (t for t in raw.get("translations", []) if t.get("language") == WGER_ENGLISH_LANGUAGE_ID and t.get("name")),
        None,
    )
    if not translation:
        return None  # no English translation — not usable in an English-only app UI

    main_image = next((img for img in raw.get("images", []) if img.get("is_main")), None)
    if not main_image and raw.get("images"):
        main_image = raw["images"][0]

    name = translation["name"].strip()
    return {
        "key": slugify(name),
        "name": name,
        "category": (raw.get("category") or {}).get("name", "Other"),
        "muscles": [m.get("name_en") or m.get("name") for m in raw.get("muscles", [])],
        "muscles_secondary": [m.get("name_en") or m.get("name") for m in raw.get("muscles_secondary", [])],
        "equipment": [e.get("name") for e in raw.get("equipment", [])],
        "description": strip_html(translation.get("description")),
        "image_url": main_image.get("image") if main_image else None,
        "gif_url": None,
        "video_url": None,
        "source": "wger",
        "source_id": str(raw.get("id")),
    }


def fetch_exercisedb_exercises(api_key: Optional[str]) -> List[dict]:
    """Only runs against ExerciseDB's real (RapidAPI-hosted) production endpoint — the
    unauthenticated playground is explicitly documented as unstable/not for production,
    so this deliberately does not fall back to it. Returns [] (not fake data) if no key."""
    if not api_key:
        print(
            "  EXERCISEDB_API_KEY not set — skipping ExerciseDB media enrichment "
            "(exercises will still be seeded from wger; gif_url/video_url stay null).",
            file=sys.stderr,
        )
        return []

    results: List[dict] = []
    offset = 0
    headers = {"X-RapidAPI-Key": api_key, "X-RapidAPI-Host": EXERCISEDB_HOST}
    while True:
        url = f"https://{EXERCISEDB_HOST}/exercises?limit={PAGE_SIZE}&offset={offset}"
        print(f"  fetching {url}", file=sys.stderr)
        try:
            page = http_get_json(url, headers=headers)
        except urllib.error.URLError as error:
            print(f"  ExerciseDB request failed: {error} — stopping here", file=sys.stderr)
            break
        batch = page if isinstance(page, list) else page.get("data", [])
        if not batch:
            break
        results.extend(batch)
        offset += PAGE_SIZE
        time.sleep(0.2)
    return results


def normalize_exercisedb(raw: dict) -> dict:
    return {
        "name": raw.get("name", ""),
        "gif_url": raw.get("gifUrl") or raw.get("imageUrl"),
        "video_url": raw.get("videoUrl"),
        "source_id": str(raw.get("exerciseId", "")),
    }


def merge_media(wger_exercises: List[dict], exercisedb_exercises: List[dict]) -> List[dict]:
    """wger stays the canonical exercise identity (key, muscles, category) — matching the
    existing in-app library. ExerciseDB entries only ever attach gif_url/video_url onto a
    name match; they never introduce a competing exercise record."""
    by_name = {e["name"].strip().lower(): e for e in exercisedb_exercises if e.get("name")}
    matched = 0
    for exercise in wger_exercises:
        media = by_name.get(exercise["name"].strip().lower())
        if media:
            exercise["gif_url"] = media.get("gif_url")
            exercise["video_url"] = media.get("video_url")
            matched += 1
    print(f"  matched ExerciseDB media onto {matched}/{len(wger_exercises)} wger exercises by exact name", file=sys.stderr)
    return wger_exercises


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--limit", type=int, default=None, help="Cap the number of wger exercises fetched (for a quick test run)")
    parser.add_argument("--out", type=Path, default=Path(__file__).parent / "output" / "exercises_normalized.json")
    parser.add_argument("--exercisedb-key", default=None, help="Overrides EXERCISEDB_API_KEY env var")
    args = parser.parse_args()

    import os

    print("Fetching wger exercises...", file=sys.stderr)
    wger_raw = fetch_wger_exercises(limit=args.limit)
    normalized = [n for n in (normalize_wger(r) for r in wger_raw) if n is not None]
    print(f"  {len(normalized)} exercises with an English translation", file=sys.stderr)

    api_key = args.exercisedb_key or os.environ.get("EXERCISEDB_API_KEY")
    print("Fetching ExerciseDB media...", file=sys.stderr)
    exercisedb_raw = fetch_exercisedb_exercises(api_key)
    exercisedb_normalized = [normalize_exercisedb(r) for r in exercisedb_raw]

    merged = merge_media(normalized, exercisedb_normalized)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(merged, indent=2, ensure_ascii=False))
    print(f"\nWrote {len(merged)} exercises to {args.out}", file=sys.stderr)
    with_media = sum(1 for e in merged if e.get("gif_url") or e.get("video_url"))
    print(f"  {with_media}/{len(merged)} have gif/video media", file=sys.stderr)
    print("Review this file before running the seeding scripts.", file=sys.stderr)


if __name__ == "__main__":
    main()
