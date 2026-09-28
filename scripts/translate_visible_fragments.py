#!/usr/bin/env python3
"""Correct rare visible prose fragments a translator left unchanged.

Rich JSX often splits a sentence around <strong> text. This script deliberately
limits itself to punctuation-led natural prose and excludes source-code snippets,
resource names, and member content.
"""
from __future__ import annotations
import concurrent.futures as futures
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from generate_locales import LANGUAGES, request_translation

PUBLIC = ROOT / "public" / "locales"
CODE = re.compile(r"(?:=>|&&|\|\||[{}]|;\s*(?:return|const)|\.match\(|Date\.|https?://|/i;|\[\[)")


def is_visible_fragment(value: str) -> bool:
    words = re.findall(r"[A-Za-z]{2,}", value)
    return value[:1] in ",." and len(words) >= 5 and not CODE.search(value)


def one(code: str, language: str):
    path = PUBLIC / f"{code}.json"
    payload = json.loads(path.read_text())
    strings = payload.get("strings", {})
    targets = [key for key, value in strings.items() if value == key and is_visible_fragment(key)]
    if targets:
        from openai import OpenAI
        strings.update(request_translation(OpenAI(), language, targets))
        path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    return code, len(targets)


def main():
    with futures.ThreadPoolExecutor(max_workers=4) as pool:
        pending = {pool.submit(one, code, language): code for code, language in LANGUAGES}
        for future in futures.as_completed(pending):
            code, count = future.result()
            print(f"{code}: corrected {count}", flush=True)

if __name__ == "__main__":
    main()
