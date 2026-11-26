#!/usr/bin/env python3
"""Validate Razor's data files before they reach the live site.

Checks purchase/products.json, vouches.json and status.json for JSON syntax,
required fields, sane values, duplicate IDs, broken cross-references and
missing image/video files. Standard library only.

Usage:  python3 tools/validate_data.py        (from the repo root)
Exit code 0 = everything valid, 1 = problems found (listed one per line).
"""
from __future__ import annotations

import json
import re
import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
STATUSES = {"operational", "maintenance", "degraded", "outage", "down", "offline"}
INCIDENT_STATUSES = {"resolved", "monitoring", "investigating", "identified"}

errors: list[str] = []
warnings: list[str] = []


def err(where: str, msg: str) -> None:
    errors.append(f"{where}: {msg}")


def warn(where: str, msg: str) -> None:
    warnings.append(f"{where}: {msg}")


def load(rel: str):
    path = ROOT / rel
    if not path.is_file():
        err(rel, "file is missing")
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        err(rel, f"invalid JSON at line {e.lineno}, column {e.colno}: {e.msg}")
        return None


def media_exists(where: str, ref: object) -> None:
    if not isinstance(ref, str) or not ref.strip():
        err(where, "media path must be a non-empty string")
        return
    if ref.startswith(("http://", "https://")):
        return
    if not (ROOT / ref.lstrip("/")).is_file():
        err(where, f"file not found: {ref}  (paths are case-sensitive on GitHub Pages)")


def valid_date(where: str, value: object, field: str) -> None:
    if not isinstance(value, str) or not DATE_RE.match(value):
        err(where, f"{field} must be YYYY-MM-DD, got {value!r}")
        return
    try:
        d = date.fromisoformat(value)
    except ValueError:
        err(where, f"{field} is not a real date: {value}")
        return
    if d > date.today():
        warn(where, f"{field} {value} is in the future")


def is_text(v: object) -> bool:
    return isinstance(v, str) and v.strip() != ""


def check_products() -> None:
    rel = "purchase/products.json"
    data = load(rel)
    if data is None:
        return
    if not isinstance(data, list) or not data:
        err(rel, "must be a non-empty array of products")
        return
    ids: set[str] = set()
    for i, p in enumerate(data):
        where = f"{rel}[{i}]"
        if not isinstance(p, dict):
            err(where, "each product must be an object")
            continue
        pid = p.get("id")
        where = f"{rel} '{pid}'" if is_text(pid) else where
        if not is_text(pid) or not ID_RE.match(pid):
            err(where, "id must be lowercase letters, digits or dashes")
        elif pid in ids:
            err(where, "duplicate id")
        else:
            ids.add(pid)
        for field in ("title", "description", "category"):
            if not is_text(p.get(field)):
                err(where, f"{field} is required")
        rating = p.get("rating", 5)
        if not isinstance(rating, (int, float)) or not 0 <= rating <= 5:
            err(where, "rating must be a number from 0 to 5")
        images = p.get("images")
        if not isinstance(images, list) or not images:
            err(where, "images must be a non-empty list")
        else:
            for img in images:
                media_exists(where, img)
        variants = p.get("variants")
        if not isinstance(variants, list) or not variants:
            err(where, "variants must be a non-empty list")
        else:
            names = set()
            for j, v in enumerate(variants):
                vw = f"{where} variant {j}"
                if not isinstance(v, dict) or not is_text(v.get("name")):
                    err(vw, "needs a name")
                    continue
                if v["name"] in names:
                    err(vw, f"duplicate variant name '{v['name']}'")
                names.add(v["name"])
                price = v.get("price")
                if isinstance(price, bool) or not isinstance(price, (int, float)) or price < 0 or price > 100000:
                    err(vw, f"price must be a number from 0 to 100000, got {price!r}")
            prices = [v.get("price") for v in variants if isinstance(v, dict) and isinstance(v.get("price"), (int, float))]
            start = p.get("startingPrice")
            if prices and isinstance(start, (int, float)) and abs(start - min(prices)) > 0.001:
                warn(where, f"startingPrice {start} differs from cheapest variant {min(prices)} (the site shows the cheapest variant)")
    for p in data:
        if isinstance(p, dict):
            for r in p.get("related", []) or []:
                if r not in ids:
                    err(f"{rel} '{p.get('id')}'", f"related id '{r}' does not exist")
                elif r == p.get("id"):
                    warn(f"{rel} '{p.get('id')}'", "lists itself as related")
    if not any(isinstance(p, dict) and p.get("featured") for p in data):
        warn(rel, "no product is featured, so the homepage Featured section will be empty")


def check_vouches() -> None:
    rel = "vouches.json"
    data = load(rel)
    if data is None:
        return
    if not isinstance(data, list):
        err(rel, "must be an array of vouches")
        return
    for i, v in enumerate(data):
        where = f"{rel}[{i}]"
        if not isinstance(v, dict):
            err(where, "each vouch must be an object")
            continue
        if is_text(v.get("username")):
            where += f" @{v['username']}"
        else:
            err(where, "username is required")
        if v.get("type") not in ("+", "-"):
            err(where, f"type must be '+' or '-', got {v.get('type')!r}")
        if not isinstance(v.get("message"), str):
            err(where, "message must be text")
        valid_date(where, v.get("date"), "date")
        for field in ("image", "video", "poster"):
            if v.get(field):
                media_exists(where, v[field])


def check_status() -> None:
    rel = "status.json"
    data = load(rel)
    if data is None:
        return
    if isinstance(data, list):
        services, incidents = data, []
    elif isinstance(data, dict):
        services, incidents = data.get("services"), data.get("incidents", [])
        if data.get("updated") is not None:
            valid_date(rel, data["updated"], "updated")
    else:
        err(rel, "must be an array of services or an object with 'services'")
        return
    if not isinstance(services, list) or not services:
        err(rel, "services must be a non-empty list")
        return
    for i, s in enumerate(services):
        where = f"{rel} service {i}"
        if not isinstance(s, dict):
            err(where, "must be an object")
            continue
        for field in ("service", "status", "description"):
            if not is_text(s.get(field)):
                err(where, f"{field} is required")
        if is_text(s.get("status")) and s["status"].lower() not in STATUSES:
            warn(where, f"unknown status '{s['status']}' will show as a disruption (use Operational, Maintenance or Degraded)")
    if not isinstance(incidents, list):
        err(rel, "incidents must be a list")
        return
    for i, inc in enumerate(incidents):
        where = f"{rel} incident {i}"
        if not isinstance(inc, dict) or not is_text(inc.get("title")):
            err(where, "needs a title")
            continue
        valid_date(where, inc.get("date"), "date")
        if is_text(inc.get("status")) and inc["status"].lower() not in INCIDENT_STATUSES:
            warn(where, f"unknown incident status '{inc['status']}' (use Resolved, Monitoring, Investigating or Identified)")


def main() -> int:
    check_products()
    check_vouches()
    check_status()
    for w in warnings:
        print(f"warning  {w}")
    for e in errors:
        print(f"ERROR    {e}")
    if errors:
        print(f"\n{len(errors)} error(s), {len(warnings)} warning(s). Fix the errors before pushing.")
        return 1
    print(f"Data OK ({len(warnings)} warning(s)).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
