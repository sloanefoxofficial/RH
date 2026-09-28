// Shared application-localization infrastructure.
// Locale packs intentionally live under public/locales so a language can be
// cached by the PWA and loaded without exposing any translation credentials.

export const DEFAULT_UI_LANGUAGE = "en-AU";
// Bump this with any locale-pack release. Query-versioning prevents a browser
// that saw an older deployment from holding on to a partial static pack.
const LOCALE_PACK_VERSION = "2026-09-28-03";

export const UI_LANGUAGES = [
  { code: "en-AU", label: "English", nativeLabel: "English", htmlLang: "en-AU", speechCode: "en-AU", ttsCode: "en-AU", rtl: false },
  { code: "zh-CN", label: "Mandarin", nativeLabel: "中文（普通话）", htmlLang: "zh-Hans", speechCode: "zh-CN", ttsCode: "zh-CN", rtl: false },
  { code: "ar-SA", label: "Arabic", nativeLabel: "العربية", htmlLang: "ar", speechCode: "ar-SA", ttsCode: "ar-SA", rtl: true },
  { code: "vi-VN", label: "Vietnamese", nativeLabel: "Tiếng Việt", htmlLang: "vi", speechCode: "vi-VN", ttsCode: "vi-VN", rtl: false },
  { code: "yue-Hant-HK", label: "Cantonese", nativeLabel: "廣東話", htmlLang: "yue-Hant", speechCode: "yue-Hant-HK", ttsCode: "yue-Hant-HK", rtl: false },
  { code: "pa-IN", label: "Punjabi", nativeLabel: "ਪੰਜਾਬੀ", htmlLang: "pa", speechCode: "pa-IN", ttsCode: "pa-IN", rtl: false },
  { code: "el-GR", label: "Greek", nativeLabel: "Ελληνικά", htmlLang: "el", speechCode: "el-GR", ttsCode: "el-GR", rtl: false },
  { code: "it-IT", label: "Italian", nativeLabel: "Italiano", htmlLang: "it", speechCode: "it-IT", ttsCode: "it-IT", rtl: false },
  { code: "hi-IN", label: "Hindi", nativeLabel: "हिन्दी", htmlLang: "hi", speechCode: "hi-IN", ttsCode: "hi-IN", rtl: false },
  { code: "es-ES", label: "Spanish", nativeLabel: "Español", htmlLang: "es", speechCode: "es-ES", ttsCode: "es-ES", rtl: false },
  { code: "ne-NP", label: "Nepali", nativeLabel: "नेपाली", htmlLang: "ne", speechCode: "ne-NP", ttsCode: "ne-NP", rtl: false },
  { code: "tl-PH", label: "Tagalog", nativeLabel: "Tagalog", htmlLang: "tl", speechCode: "fil-PH", ttsCode: "fil-PH", rtl: false },
  { code: "ko-KR", label: "Korean", nativeLabel: "한국어", htmlLang: "ko", speechCode: "ko-KR", ttsCode: "ko-KR", rtl: false },
  { code: "ur-PK", label: "Urdu", nativeLabel: "اردو", htmlLang: "ur", speechCode: "ur-PK", ttsCode: "ur-PK", rtl: true },
  { code: "ta-IN", label: "Tamil", nativeLabel: "தமிழ்", htmlLang: "ta", speechCode: "ta-IN", ttsCode: "ta-IN", rtl: false },
  { code: "fil-PH", label: "Filipino", nativeLabel: "Filipino", htmlLang: "fil", speechCode: "fil-PH", ttsCode: "fil-PH", rtl: false },
  { code: "si-LK", label: "Sinhalese", nativeLabel: "සිංහල", htmlLang: "si", speechCode: "si-LK", ttsCode: "si-LK", rtl: false },
  { code: "gu-IN", label: "Gujarati", nativeLabel: "ગુજરાતી", htmlLang: "gu", speechCode: "gu-IN", ttsCode: "gu-IN", rtl: false },
  { code: "ml-IN", label: "Malayalam", nativeLabel: "മലയാളം", htmlLang: "ml", speechCode: "ml-IN", ttsCode: "ml-IN", rtl: false },
  { code: "id-ID", label: "Indonesian", nativeLabel: "Bahasa Indonesia", htmlLang: "id", speechCode: "id-ID", ttsCode: "id-ID", rtl: false },
  { code: "fa-AF", label: "Persian / Dari", nativeLabel: "فارسی / دری", htmlLang: "fa-AF", speechCode: "fa-IR", ttsCode: "fa-IR", rtl: true },
  { code: "fr-FR", label: "French", nativeLabel: "Français", htmlLang: "fr", speechCode: "fr-FR", ttsCode: "fr-FR", rtl: false },
  { code: "de-DE", label: "German", nativeLabel: "Deutsch", htmlLang: "de", speechCode: "de-DE", ttsCode: "de-DE", rtl: false },
  { code: "bn-BD", label: "Bengali", nativeLabel: "বাংলা", htmlLang: "bn", speechCode: "bn-BD", ttsCode: "bn-BD", rtl: false },
  { code: "pt-BR", label: "Portuguese", nativeLabel: "Português", htmlLang: "pt-BR", speechCode: "pt-BR", ttsCode: "pt-BR", rtl: false },
];

const byCode = new Map(UI_LANGUAGES.map((language) => [language.code, language]));
const packCache = new Map();
let activePack = { strings: {}, speech: {} };

function normalizeSource(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function getUiLanguage(code) {
  return byCode.get(code) || byCode.get(DEFAULT_UI_LANGUAGE);
}

export function isUiLanguage(code) {
  return byCode.has(code);
}

export function defaultPack() {
  return { strings: {}, speech: {} };
}

export async function loadLocalePack(code) {
  if (code === DEFAULT_UI_LANGUAGE) return defaultPack();
  if (packCache.has(code)) return packCache.get(code);
  const request = fetch(`/locales/${encodeURIComponent(code)}.json?v=${LOCALE_PACK_VERSION}`)
    .then(async (response) => {
      if (!response.ok) throw new Error(`locale_${response.status}`);
      const payload = await response.json();
      return {
        strings: payload && typeof payload.strings === "object" && payload.strings ? payload.strings : {},
        speech: payload && typeof payload.speech === "object" && payload.speech ? payload.speech : {},
      };
    })
    .catch(() => defaultPack());
  packCache.set(code, request);
  return request;
}

export function setActiveLocalePack(pack) {
  activePack = pack || defaultPack();
}

export function localizedSpeech(key, fallback) {
  return activePack?.speech?.[key] || fallback;
}

function sourceForText(node, strings) {
  const current = node.nodeValue || "";
  const saved = node.__rhLocaleSource;
  if (saved) return saved;
  node.__rhLocaleSourceRaw = current;
  return normalizeSource(current);
}

function sourceForAttribute(element, name, strings) {
  const saved = element.__rhLocaleAttributeSources?.[name];
  const current = element.getAttribute(name) || "";
  if (saved) return saved;
  return normalizeSource(current);
}

function preserveNodeWhitespace(node, value) {
  const raw = node.__rhLocaleSourceRaw || node.nodeValue || "";
  const leading = raw.match(/^\s+/)?.[0] || "";
  const trailing = raw.match(/\s+$/)?.[0] || "";
  return `${leading}${value}${trailing}`;
}

function shouldSkipTextNode(node) {
  const parent = node.parentElement;
  if (!parent) return true;
  const tag = parent.tagName;
  return parent.isContentEditable || parent.closest("[data-rh-no-localize]") || ["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA", "OPTION", "SVG"].includes(tag);
}

export function localizeDom(root, pack) {
  if (!root || !pack?.strings) return;
  const strings = pack.strings;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  for (const node of textNodes) {
    if (shouldSkipTextNode(node)) continue;
    const source = sourceForText(node, strings);
    const translated = strings[source];
    if (!translated || translated === source) {
      if (node.__rhLocaleSource && node.nodeValue !== node.__rhLocaleSourceRaw) node.nodeValue = node.__rhLocaleSourceRaw;
      continue;
    }
    node.__rhLocaleSource = source;
    const localized = preserveNodeWhitespace(node, translated);
    if (node.nodeValue !== localized) node.nodeValue = localized;
  }
  const attributes = ["aria-label", "placeholder", "title", "alt"];
  for (const element of root.querySelectorAll("*")) {
    if (element.closest("[data-rh-no-localize]") || ["SCRIPT", "STYLE", "SVG"].includes(element.tagName)) continue;
    for (const name of attributes) {
      if (!element.hasAttribute(name)) continue;
      const source = sourceForAttribute(element, name, strings);
      const translated = strings[source];
      if (!translated || translated === source) {
        if (element.__rhLocaleAttributes?.[name] && element.getAttribute(name) !== element.__rhLocaleAttributes[name]) element.setAttribute(name, element.__rhLocaleAttributes[name]);
        continue;
      }
      if (!element.__rhLocaleAttributes) element.__rhLocaleAttributes = {};
      if (!element.__rhLocaleAttributeSources) element.__rhLocaleAttributeSources = {};
      element.__rhLocaleAttributes[name] = element.getAttribute(name) || "";
      element.__rhLocaleAttributeSources[name] = source;
      if (element.getAttribute(name) !== translated) element.setAttribute(name, translated);
    }
  }
}
