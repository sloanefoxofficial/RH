#!/usr/bin/env python3
"""Extend completed locale packs with rendered resource/card data.

This intentionally supplements, rather than overwrites, the first-pass packs.
It targets natural-language literals that flow through resource data structures
as well as direct JSX, while leaving member-created content and model prompts
outside runtime translation entirely.
"""
from __future__ import annotations
import concurrent.futures as futures
import json
import re
import sys
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from generate_locales import LANGUAGES, request_translation

PUBLIC = ROOT / "public" / "locales"
CODE_RE = re.compile(r"(?:=>|&&|\|\||===|Date\.|\.slice\(|\.join\(|\b(?:position|padding|margin|background|border|font|color|display|alignItems|boxSizing|cursor)\s*:|rgba\(|linear-gradient|^\d+(?:px|%|\s)|^[:=,.)]|^\)|^\+|^\\s|^\w+\s*:\s*\w+)")
DIRECT_JSX_CODE_RE = re.compile(r"(?:=>|&&|\|\||===|rgba\(|linear-gradient|^\w+\s*:\s*\w+)")
PROMPT_MARKERS = (
    "You ARE ", "You are the ", "You are Carlos", "You are Mick", "You are Lila", "You do NOT", "IMPORTANT:",
    "Respond with ONLY", "Return ONLY", "Current notes:", "Recent conversation:", "System instruction",
)
EXTRA = {
    "App language",
    "Choose your language",
    "The Hub, voice, microphone, and AI guides will use this language.",
    "Choose app language",
    "One choice changes the Hub’s visible interface, guide replies, voice language, and the language the microphone listens for. Your own notes and messages always stay exactly as you wrote them.",
    "Your own notes and messages always stay exactly as you wrote them.",
}

def all_natural_literals() -> list[str]:
    raw = json.loads(Path("/tmp/rh-ui-copy-candidates.json").read_text())
    out = set(EXTRA)
    for value in raw:
        value = str(value).strip()
        if not value or len(value) > 360 or CODE_RE.search(value):
            continue
        if value.startswith(PROMPT_MARKERS):
            continue
        # Reject schema/property snippets that made it through the broad first
        # pass, but retain ordinary resource labels, long descriptions, and
        # form questions that may be rendered from data objects.
        if re.fullmatch(r"[a-z][a-z0-9_]{2,}", value):
            continue
        out.add(value)
    # The broad literal extractor is intentionally conservative around newline
    # and JSX formatting. Direct text segments in a rich sentence (for example
    # text before/after a <strong> element) still need their own locale key, so
    # collect every static JSX text node as a second source of truth.
    source = (ROOT / "App.jsx").read_text()
    for value in re.findall(r">([^<>{}]{1,1800})<", source, flags=re.S):
        value = " ".join(value.split())
        # This path processes actual JSX text nodes. Unlike broad literal
        # extraction, a visible continuation may begin with punctuation after
        # an inline <strong> or <em> element, so do not reject comma-led prose.
        if not value or len(value) > 1800 or DIRECT_JSX_CODE_RE.search(value):
            continue
        if value.startswith(PROMPT_MARKERS) or re.fullmatch(r"[a-z][a-z0-9_]{2,}", value):
            continue
        out.add(value)
    return sorted(out)

def chunks(values, max_items=48, max_chars=7600):
    groups, current, used = [], [], 0
    for value in values:
        if current and (len(current) >= max_items or used + len(value) > max_chars):
            groups.append(current); current, used = [], 0
        current.append(value); used += len(value)
    if current: groups.append(current)
    return groups

def extend_one(code, language, desired):
    path = PUBLIC / f"{code}.json"
    payload = json.loads(path.read_text())
    strings = payload.setdefault("strings", {})
    missing = [value for value in desired if value not in strings]
    if not missing:
        return code, 0
    from openai import OpenAI
    client = OpenAI()
    for group in chunks(missing):
        strings.update(request_translation(client, language, group))
        # Checkpoint after each bounded request. A network timeout can then be
        # resumed without re-translating completed work or losing progress.
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    return code, len(missing)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--codes", help="Comma-separated locale codes to resume")
    parser.add_argument("--workers", type=int, default=2, help="Concurrent locale workers (default: 2)")
    args = parser.parse_args()
    desired = all_natural_literals()
    print(f"Supplementing locale packs with {len(desired)} eligible static literals", flush=True)
    selected = LANGUAGES
    if args.codes:
        wanted = {code.strip() for code in args.codes.split(",") if code.strip()}
        selected = [(code, language) for code, language in LANGUAGES if code in wanted]
        unknown = wanted - {code for code, _ in selected}
        if unknown: raise SystemExit(f"Unknown locale code(s): {', '.join(sorted(unknown))}")
    failures=[]
    with futures.ThreadPoolExecutor(max_workers=max(1, min(args.workers, 4))) as pool:
        todo={pool.submit(extend_one, code, language, desired):(code,language) for code,language in selected}
        for future in futures.as_completed(todo):
            code, language=todo[future]
            try:
                _, count=future.result(); print(f"{code}: added {count}", flush=True)
            except Exception as exc:
                failures.append(f"{code}: {exc}"); print(f"FAILED {code}: {exc}", flush=True)
    if failures:
        raise SystemExit("\n".join(failures))

if __name__ == "__main__":
    main()
