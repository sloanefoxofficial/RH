#!/usr/bin/env python3
"""Generate static Resilience Hub locale packs through the configured sandbox LLM.

The packs are reviewed programmatically for key coverage and preserve all source
strings verbatim as keys. They are static PWA assets; no text is sent from a
member's device to a translator at runtime.
"""
from __future__ import annotations

import concurrent.futures as futures
import json
import os
import re
import sys
import time
from pathlib import Path

from openai import OpenAI

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "locales"
PUBLIC.mkdir(parents=True, exist_ok=True)

LANGUAGES = [
    ("zh-CN", "Mandarin Chinese, Simplified Chinese script"),
    ("ar-SA", "Arabic, Modern Standard Arabic suitable for Australian community services"),
    ("vi-VN", "Vietnamese"),
    ("yue-Hant-HK", "Cantonese, Traditional Chinese script with natural Cantonese wording"),
    ("pa-IN", "Punjabi, Gurmukhi script"),
    ("el-GR", "Greek"),
    ("it-IT", "Italian"),
    ("hi-IN", "Hindi, Devanagari script"),
    ("es-ES", "Spanish, plain neutral Spanish"),
    ("ne-NP", "Nepali, Devanagari script"),
    ("tl-PH", "Tagalog"),
    ("ko-KR", "Korean"),
    ("ur-PK", "Urdu"),
    ("ta-IN", "Tamil"),
    ("fil-PH", "Filipino"),
    ("si-LK", "Sinhalese / Sinhala"),
    ("gu-IN", "Gujarati"),
    ("ml-IN", "Malayalam"),
    ("id-ID", "Indonesian"),
    ("fa-AF", "Persian / Dari, using clear Dari-friendly wording"),
    ("fr-FR", "French"),
    ("de-DE", "German"),
    ("bn-BD", "Bengali"),
    ("pt-BR", "Portuguese, Brazilian Portuguese"),
]

SPEECH_SOURCE = {
    "toolkit": "Welcome to the Toolkit — a collection of things that can help, whenever you need them. Take your time, look around, and choose whatever feels right today.",
    "guides": "Welcome to your guides — AI guided support from a team you can turn to whenever you need it. Choose the voice that feels right for you today.",
    "plan": "This is your tailor-made 8-week plan, shaped around what you told us about your life, your energy, and what you want to work towards. It grows week by week, starting gently and building practical steps at a pace that fits you. I’m here to help you understand each week, answer your questions, and help you notice your progress without pressure or judgement.",
    "program": "Hi, I’m Juan, the founder of The Resilience Hub. This program is free and built around you. We listen to where you’re at, shape practical support at your pace, and connect you with the right people. If you need help, use Message Juan to reach the real me, talk with an AI guide, or use Safety First for urgent human support.",
    "planChoice": "Before we go any further, would you like Carlos to put together a personalised 8-week plan for you? I’ll ask a handful of questions so he can shape it around what you’re dealing with. If you’d rather use the guides and Toolkit for now, that’s completely fine.",
    "chat": "Hi, I’m your AI guide. Take your time — we can talk things through at your pace.",
}

# Source strings that clearly came from code/CSS extraction rather than a rendered
# text or accessibility attribute. Keeping output quality high matters more than
# pursuing impossible dynamic-code translation here.
CODE_RE = re.compile(r"(?:=>|&&|\|\||===|Date\.|\.slice\(|\.join\(|\b(?:position|padding|margin|background|border|font|color|display|alignItems|boxSizing|cursor)\s*:|rgba\(|linear-gradient|^\d+(?:px|%|\s)|^[:=,.)]|^\)|^\+|^\\s|^\w+\s*:\s*\w+)")

def source_strings() -> list[str]:
    candidates: set[str] = set()
    for filename in ("/tmp/rh-ui-visible-text.json", "/tmp/rh-ui-static-attributes.json"):
        try:
            candidates.update(json.loads(Path(filename).read_text()))
        except FileNotFoundError:
            pass
    result = []
    for value in candidates:
        value = str(value).strip()
        if not value or len(value) > 340 or CODE_RE.search(value):
            continue
        # Preserve literal words that are visible in branded third-party names.
        result.append(value)
    return sorted(set(result))


def chunks(values: list[str], size: int = 56) -> list[list[str]]:
    return [values[i : i + size] for i in range(0, len(values), size)]


def request_translation(client: OpenAI, language: str, chunk: list[str], speech: bool = False) -> dict[str, str]:
    instructions = (
        "You translate interface copy for The Resilience Hub, an Australian community mental-health and suicide-prevention support app. "
        f"Translate every JSON value into {language}. Return ONLY a single JSON object mapping the original keys to translated strings. "
        "Keep every JSON key byte-for-byte identical. Preserve all phone numbers, dates, URLs, abbreviations, proper names (Juan, Carlos, Nicolas, Mick, Lila, Rex, The Resilience Hub, Safety First, Lifeline, MensLine, Triple Zero, 000), emojis, emoji placement, and HTML-like tags exactly. "
        "Keep the tone brief, warm, agency-centred, trauma-informed, and non-clinical. Do not invent claims. Do not translate product names or service organisation names unless they are generic labels. "
        "A value that begins with punctuation may be a visible continuation after a bold label; translate its prose normally rather than returning English unchanged. "
        "Do not remove variables or punctuation. If a source is already a name, number, or universal brand label, return it unchanged."
    )
    body = {str(i): text for i, text in enumerate(chunk)}
    for attempt in range(3):
        try:
            response = client.chat.completions.create(
                model="gpt-5-mini",
                messages=[
                    {"role": "system", "content": instructions},
                    {"role": "user", "content": json.dumps(body, ensure_ascii=False)},
                ],
                max_completion_tokens=12000,
                extra_body={"reasoning": {"effort": "minimal"}},
                timeout=45.0,
            )
            raw = response.choices[0].message.content or "{}"
            raw = raw.strip()
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw, flags=re.I)
            parsed = json.loads(raw)
            if not isinstance(parsed, dict): raise ValueError("translation_not_object")
            translated = {}
            for index, source in body.items():
                value = parsed.get(index)
                if not isinstance(value, str) or not value.strip():
                    raise ValueError(f"missing_translation_{index}")
                translated[source] = value.strip()
            return translated
        except Exception as error:
            if attempt >= 2:
                raise RuntimeError(f"{language}: {error}") from error
            time.sleep(1.2 * (attempt + 1))
    raise RuntimeError(language)


def generate_one(code: str, language: str, strings: list[str]) -> tuple[str, dict]:
    client = OpenAI()
    translated: dict[str, str] = {}
    for group in chunks(strings):
        translated.update(request_translation(client, language, group))
    speech = request_translation(client, language, list(SPEECH_SOURCE.values()))
    speech_by_key = {key: speech[source] for key, source in SPEECH_SOURCE.items()}
    return code, {"language": code, "strings": translated, "speech": speech_by_key}


def main() -> int:
    strings = source_strings()
    if not strings:
        print("No source strings found; run the extraction steps first.", file=sys.stderr)
        return 2
    print(f"Generating {len(strings)} source strings across {len(LANGUAGES)} locale packs", flush=True)
    failures = []
    with futures.ThreadPoolExecutor(max_workers=4) as pool:
        pending = {pool.submit(generate_one, code, language, strings): (code, language) for code, language in LANGUAGES}
        for future in futures.as_completed(pending):
            code, language = pending[future]
            try:
                out_code, payload = future.result()
                target = PUBLIC / f"{out_code}.json"
                target.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
                print(f"{out_code}: {len(payload['strings'])} UI strings + {len(payload['speech'])} spoken strings", flush=True)
            except Exception as error:
                failures.append(f"{code} ({language}): {error}")
                print(f"FAILED {code}: {error}", file=sys.stderr, flush=True)
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
