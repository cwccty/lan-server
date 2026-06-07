import {
  createLocalAccount,
  getAccountState,
  getAppSettings,
  loginLocalAccount,
  logoutLocalAccount,
  saveAppSettings,
  updateAccountNickname,
} from '../api/tauri';
import type {
  AppearanceBackgroundMode,
  AppearanceSettings,
  AppearanceTheme,
  UserAccountState,
} from '../types/settings';
import type { CSSProperties } from 'react';

const ACCOUNT_EVENT = 'lan-helper:account-updated';
const APPEARANCE_EVENT = 'lan-helper:appearance-updated';
const FALLBACK_ACCOUNT_KEY = 'lan-helper.preview.localAccount.v1';
const FALLBACK_APPEARANCE_KEY = 'lan-helper.preview.appearance.v1';

export const accentPresets = [
  { label: '琥珀', value: '#f59e0b' },
  { label: '蓝色', value: '#2563eb' },
  { label: '绿色', value: '#16a34a' },
  { label: '红色', value: '#dc2626' },
  { label: '紫色', value: '#7c3aed' },
  { label: '青色', value: '#0891b2' },
];

export function defaultAppearance(): AppearanceSettings {
  return {
    theme: 'system',
    accent: '#f59e0b',
    background_mode: 'default',
    background_value: '',
    background_strength: 0.35,
    background_blur: 0,
  };
}

export function normalizeAppearance(value?: Partial<AppearanceSettings> | null): AppearanceSettings {
  const base = defaultAppearance();
  const theme = ['system', 'light', 'dark', 'warm'].includes(String(value?.theme))
    ? value?.theme as AppearanceTheme
    : base.theme;
  const backgroundMode = ['default', 'gradient', 'custom'].includes(String(value?.background_mode))
    ? value?.background_mode as AppearanceBackgroundMode
    : base.background_mode;
  const accent = accentPresets.some((item) => item.value.toLowerCase() === String(value?.accent || '').toLowerCase())
    ? String(value?.accent)
    : base.accent;
  return {
    theme,
    accent,
    background_mode: backgroundMode,
    background_value: backgroundMode === 'custom' ? (value?.background_value || '') : '',
    background_strength: clampNumber(value?.background_strength, 0, 1, base.background_strength),
    background_blur: clampNumber(value?.background_blur, 0, 24, base.background_blur),
  };
}

export async function readAccountState(): Promise<UserAccountState> {
  try {
    return await getAccountState();
  } catch {
    return fallbackReadAccount();
  }
}

export async function createAccount(nickname: string, password: string, rememberMe: boolean) {
  try {
    const state = await createLocalAccount(nickname, password, rememberMe);
    dispatchAccountUpdated();
    return state;
  } catch (error) {
    if (!isTauriUnavailable(error)) throw error;
    const state = await fallbackCreateAccount(nickname, password, rememberMe);
    dispatchAccountUpdated();
    return state;
  }
}

export async function loginAccount(nickname: string, password: string, rememberMe: boolean) {
  try {
    const state = await loginLocalAccount(nickname, password, rememberMe);
    dispatchAccountUpdated();
    return state;
  } catch (error) {
    if (!isTauriUnavailable(error)) throw error;
    const state = await fallbackLoginAccount(nickname, password, rememberMe);
    dispatchAccountUpdated();
    return state;
  }
}

export async function logoutAccount() {
  try {
    const state = await logoutLocalAccount();
    dispatchAccountUpdated();
    return state;
  } catch (error) {
    if (!isTauriUnavailable(error)) throw error;
    const state = fallbackUpdateAccount({ logged_in: false, remember_me: false }, '已退出登录。');
    dispatchAccountUpdated();
    return state;
  }
}

export async function renameAccount(nickname: string) {
  try {
    const state = await updateAccountNickname(nickname);
    dispatchAccountUpdated();
    return state;
  } catch (error) {
    if (!isTauriUnavailable(error)) throw error;
    const normalized = normalizeNickname(nickname);
    const state = fallbackUpdateAccount({ nickname: normalized, avatar_initial: initialOf(normalized) }, '昵称已保存。');
    dispatchAccountUpdated();
    return state;
  }
}

export async function readAppearance() {
  try {
    const settings = await getAppSettings();
    return normalizeAppearance(settings.appearance);
  } catch {
    return normalizeAppearance(readJson<AppearanceSettings>(FALLBACK_APPEARANCE_KEY));
  }
}

export async function saveAppearance(next: AppearanceSettings) {
  const normalized = normalizeAppearance(next);
  try {
    const settings = await getAppSettings();
    await saveAppSettings({ ...settings, appearance: normalized });
  } catch (error) {
    if (!isTauriUnavailable(error)) throw error;
    window.localStorage.setItem(FALLBACK_APPEARANCE_KEY, JSON.stringify(normalized));
  }
  dispatchAppearanceUpdated(normalized);
  return normalized;
}

export async function resetAppearance() {
  return saveAppearance(defaultAppearance());
}

export function onAccountUpdated(listener: () => void) {
  window.addEventListener(ACCOUNT_EVENT, listener);
  return () => window.removeEventListener(ACCOUNT_EVENT, listener);
}

export function onAppearanceUpdated(listener: (appearance: AppearanceSettings) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<AppearanceSettings>).detail);
  window.addEventListener(APPEARANCE_EVENT, handler);
  return () => window.removeEventListener(APPEARANCE_EVENT, handler);
}

export function appearanceRootStyle(appearance: AppearanceSettings): CSSProperties {
  const normalized = normalizeAppearance(appearance);
  const opacity = Math.round(normalized.background_strength * 100) / 100;
  const style: CSSProperties = {
    ['--product-accent' as string]: normalized.accent,
    ['--product-bg-opacity' as string]: String(opacity),
    ['--product-bg-blur' as string]: `${normalized.background_blur}px`,
  };
  if (normalized.background_mode === 'gradient') {
    style.backgroundImage = `linear-gradient(135deg, color-mix(in srgb, ${normalized.accent} 18%, white), rgba(248,250,252,0.96) 42%, rgba(241,245,249,0.9))`;
  }
  const customImageUrl = safeCustomBackgroundUrl(normalized.background_value);
  if (normalized.background_mode === 'custom' && customImageUrl) {
    style.backgroundImage = `linear-gradient(rgba(248,250,252,${1 - opacity}), rgba(248,250,252,${1 - opacity})), url("${cssEscapeUrl(customImageUrl)}")`;
    style.backgroundSize = 'cover';
    style.backgroundAttachment = 'fixed';
    style.backgroundPosition = 'center';
    style.backgroundRepeat = 'no-repeat';
  }
  return style;
}

export function safeCustomBackgroundUrl(value?: string | null) {
  const trimmed = value?.trim() || '';
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^data:image\//i.test(trimmed)) return trimmed;
  return '';
}

export function customBackgroundWarning(value?: string | null) {
  const trimmed = value?.trim() || '';
  if (!trimmed) return '';
  if (safeCustomBackgroundUrl(trimmed)) return '';
  if (/^[a-z]:\\/i.test(trimmed) || trimmed.startsWith('\\\\') || trimmed.startsWith('/')) {
    return '浏览器预览不能直接使用本机图片路径，已回退到安全背景。请使用 http(s) 图片 URL；桌面版后续会提供文件选择和路径检测。';
  }
  return '这个背景地址暂时不能识别，已回退到安全背景。请填写 http(s) 图片 URL。';
}

export function backgroundHelpText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '还没有填写自定义背景。会使用默认背景。';
  if (/^https?:\/\//i.test(trimmed)) return '将从这个图片地址读取背景；请避免使用包含私人信息的图片链接。';
  if (/^[a-z]:\\/i.test(trimmed) || trimmed.startsWith('\\\\') || trimmed.startsWith('/')) {
    return '浏览器预览不能直接读取本机图片路径，会先回退到安全背景；桌面版后续会加入文件选择和路径检测。';
  }
  return '建议填写 http(s) 图片地址，例如 https://example.com/bg.jpg。';
}

function dispatchAccountUpdated() {
  window.dispatchEvent(new CustomEvent(ACCOUNT_EVENT));
}

function dispatchAppearanceUpdated(appearance: AppearanceSettings) {
  window.dispatchEvent(new CustomEvent(APPEARANCE_EVENT, { detail: appearance }));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function isTauriUnavailable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || '');
  return message.includes('Tauri') || message.includes('__TAURI__') || message.includes('IPC') || message.includes('后端');
}

function normalizeNickname(value: string) {
  const nickname = value.trim();
  if (!nickname) throw new Error('昵称不能为空。');
  if (nickname.length > 24) throw new Error('昵称太长，请控制在 24 个字符以内。');
  return nickname;
}

function validatePassword(password: string) {
  if (password.length < 6) throw new Error('密码至少需要 6 个字符。');
}

interface FallbackAccountRecord extends UserAccountState {
  salt: string;
  password_hash: string;
}

function fallbackReadAccount(message = '账号状态已读取。'): UserAccountState {
  const record = readJson<FallbackAccountRecord>(FALLBACK_ACCOUNT_KEY);
  if (!record?.password_hash) {
    return {
      has_account: false,
      logged_in: false,
      remember_me: false,
      message: '本机还没有本地账号。',
    };
  }
  return publicFallback(record, message);
}

async function fallbackCreateAccount(nickname: string, password: string, rememberMe: boolean) {
  const normalized = normalizeNickname(nickname);
  validatePassword(password);
  if (readJson<FallbackAccountRecord>(FALLBACK_ACCOUNT_KEY)?.password_hash) {
    throw new Error('本机已经创建过本地账号，请直接登录。');
  }
  const salt = randomSalt();
  const record: FallbackAccountRecord = {
    has_account: true,
    logged_in: true,
    nickname: normalized,
    remember_me: rememberMe,
    avatar_initial: initialOf(normalized),
    updated_at: new Date().toISOString(),
    message: '本地账号已创建。',
    salt,
    password_hash: await sha256(`${salt}:lan-helper-local-account:${password}`),
  };
  window.localStorage.setItem(FALLBACK_ACCOUNT_KEY, JSON.stringify(record));
  return publicFallback(record, '本地账号已创建。');
}

async function fallbackLoginAccount(nickname: string, password: string, rememberMe: boolean) {
  const normalized = normalizeNickname(nickname);
  const record = readJson<FallbackAccountRecord>(FALLBACK_ACCOUNT_KEY);
  if (!record?.password_hash) throw new Error('还没有本地账号，请先创建账号。');
  if (record.nickname !== normalized) throw new Error('昵称不匹配，请输入创建账号时使用的昵称。');
  const passwordHash = await sha256(`${record.salt}:lan-helper-local-account:${password}`);
  if (passwordHash !== record.password_hash) throw new Error('密码不正确，请重新输入。');
  record.logged_in = true;
  record.remember_me = rememberMe;
  record.updated_at = new Date().toISOString();
  window.localStorage.setItem(FALLBACK_ACCOUNT_KEY, JSON.stringify(record));
  return publicFallback(record, '已登录本地账号。');
}

function fallbackUpdateAccount(patch: Partial<UserAccountState>, message: string): UserAccountState {
  const record = readJson<FallbackAccountRecord>(FALLBACK_ACCOUNT_KEY);
  if (!record?.password_hash) {
    return {
      has_account: false,
      logged_in: false,
      remember_me: false,
      message: '本机还没有本地账号。',
    };
  }
  const next = {
    ...record,
    ...patch,
    updated_at: new Date().toISOString(),
    message,
  };
  window.localStorage.setItem(FALLBACK_ACCOUNT_KEY, JSON.stringify(next));
  return publicFallback(next, message);
}

function publicFallback(record: FallbackAccountRecord, message: string): UserAccountState {
  return {
    has_account: true,
    logged_in: Boolean(record.logged_in || record.remember_me),
    nickname: record.nickname,
    remember_me: Boolean(record.remember_me),
    avatar_initial: record.avatar_initial || initialOf(record.nickname || ''),
    updated_at: record.updated_at,
    message,
  };
}

function initialOf(nickname: string) {
  return nickname.trim().charAt(0).toUpperCase() || '我';
}

function readJson<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function cssEscapeUrl(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
