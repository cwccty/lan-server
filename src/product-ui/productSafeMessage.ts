const DISCONNECTED_PATTERNS = [
  /(?:\u6ca1\u6709\u8fde\u63a5\u5230|\u672a\u8fde\u63a5).{0,24}Tauri.{0,24}(?:\u540e\u7aef|\u670d\u52a1)/i,
  /__TAURI_INTERNALS__/i,
  /window\.__TAURI__/i,
  /reading ['"]?invoke['"]?/i,
  /\bIPC\b/i,
  /\u666e\u901a\u6d4f\u89c8\u5668\u9884\u89c8/i,
  /lan-helper\.exe/i
];

const DISCONNECTED_MESSAGE =
  '\u672c\u673a\u670d\u52a1\u672a\u8fde\u63a5\u3002\u8bf7\u6253\u5f00\u8054\u673a\u52a9\u624b\u5ba2\u6237\u7aef\u540e\u91cd\u8bd5\u3002';

const LABEL_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bn2n diagnostics\b/gi, '\u7ec4\u7f51\u72b6\u6001'],
  [/\bn2n last config\b/gi, '\u6700\u8fd1\u7ec4\u7f51\u8bbe\u7f6e'],
  [/\bnetwork backends\b/gi, '\u8fde\u63a5\u65b9\u5f0f'],
  [/\bgame scan\b/gi, '\u6e38\u620f\u626b\u63cf'],
  [/\bgame adapters\b/gi, '\u6e38\u620f\u65b9\u6848'],
  [/\bdiagnostic report\b/gi, '\u8bca\u65ad\u62a5\u544a'],
  [/\bserver session\b/gi, '\u6e38\u620f\u670d\u52a1\u7aef'],
  [/\bport proxies\b/gi, '\u7aef\u53e3\u8f6c\u53d1'],
  [/\budp proxies\b/gi, 'UDP \u8f6c\u53d1'],
  [/\budp broadcast bridges\b/gi, '\u5c40\u57df\u7f51\u53d1\u73b0\u8f85\u52a9'],
  [/\bdiagnostics\b/gi, '\u8bca\u65ad'],
  [/\bruntime\b/gi, '\u8fd0\u884c\u72b6\u6001'],
  [/\bbackend\b/gi, '\u672c\u673a\u670d\u52a1'],
  [/ACK\/PONG/gi, '\u8054\u673a\u786e\u8ba4'],
  [/\bSupernode\b/gi, '\u4e2d\u7ee7\u5730\u5740'],
  [/\bsupernode\b/gi, '\u4e2d\u7ee7\u5730\u5740'],
  [/edge\.exe/gi, '\u7ec4\u7f51\u7a0b\u5e8f'],
  [/\bedge\b/gi, '\u7ec4\u7f51\u7a0b\u5e8f'],
  [/\bn2n\b/gi, '\u7ec4\u7f51\u670d\u52a1'],
  [/\u865a\u62df\s*IP/g, '\u8054\u673a\u5730\u5740'],
  [/\bvirtual\s*ip\b/gi, '\u8054\u673a\u5730\u5740'],
  [/\bTAP\b/g, '\u865a\u62df\u7f51\u5361'],
  [/Tauri\s*\u540e\u7aef/gi, '\u672c\u673a\u670d\u52a1'],
  [/Tauri/gi, '\u5ba2\u6237\u7aef'],
  [/\u771f\u5b9e\s*EXE/g, '\u5ba2\u6237\u7aef'],
  [/\u95ed\u73af\u81ea\u68c0/g, '\u9a8c\u8bc1\u8be6\u60c5'],
  [/\u53d1\u5e03\u68c0\u67e5/g, '\u9a8c\u8bc1\u8be6\u60c5']
];

function normalizeWhitespace(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export function isDisconnectedRuntimeMessage(text?: string | null) {
  const raw = String(text || '');
  return DISCONNECTED_PATTERNS.some((pattern) => pattern.test(raw));
}

export function toProductSafeMessage(text?: string | null) {
  const raw = normalizeWhitespace(String(text || ''));
  if (!raw) return '';
  if (isDisconnectedRuntimeMessage(raw)) return DISCONNECTED_MESSAGE;

  return LABEL_REPLACEMENTS.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), raw);
}

export function toProductSafeToastMessage(text?: string | null) {
  const safe = toProductSafeMessage(text);
  if (!safe) return '';
  return safe.length > 140 ? `${safe.slice(0, 137)}...` : safe;
}
