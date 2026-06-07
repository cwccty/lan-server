import { useEffect, useState } from 'react';
import { LogIn, LogOut, Save, UserRound } from 'lucide-react';
import type { UserAccountState } from '../types/settings';
import {
  createAccount,
  loginAccount,
  logoutAccount,
  onAccountUpdated,
  readAccountState,
  renameAccount,
} from './accountAppearance';

interface ProductAccountPanelProps {
  onTriggerToast: (msg: string) => void;
  compact?: boolean;
}

function emptyAccount(): UserAccountState {
  return {
    has_account: false,
    logged_in: false,
    remember_me: false,
    message: '本机还没有本地账号。',
  };
}

export function ProductAccountPanel({ onTriggerToast, compact = false }: ProductAccountPanelProps) {
  const [account, setAccount] = useState<UserAccountState>(() => emptyAccount());
  const [mode, setMode] = useState<'login' | 'create'>('login');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [editName, setEditName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'info' | 'success' | 'error'; text: string }>(() => ({
    type: 'info',
    text: '首次使用请先创建本地账号；已有账号时请直接登录。',
  }));

  const load = async () => {
    const state = await readAccountState();
    setAccount(state);
    setNickname(state.nickname || '');
    setEditName(state.nickname || '');
    setRememberMe(state.remember_me || false);
    setNotice({ type: 'info', text: state.message || '账号状态已读取。' });
    if (!state.has_account) {
      setMode('create');
    } else if (!state.logged_in) {
      setMode('login');
    }
  };

  useEffect(() => {
    load();
    return onAccountUpdated(load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (label: string, task: () => Promise<UserAccountState>) => {
    setBusy(true);
    try {
      const state = await task();
      setAccount(state);
      setEditName(state.nickname || '');
      setPassword('');
      setNotice({ type: 'success', text: state.message || `${label}完成。` });
      onTriggerToast(state.message || `${label}完成。`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNotice({ type: 'error', text: message });
      onTriggerToast(message);
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <button
        onClick={() => onTriggerToast(account.logged_in ? `当前本地账号：${account.nickname}` : '还未登录本地账号，可到设置页创建或登录。')}
        className="flex min-w-0 items-center gap-2 rounded-full border border-slate-200 bg-white/85 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-white"
        title={account.logged_in ? `当前用户：${account.nickname}` : '未登录'}
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] text-white">
          {account.logged_in ? account.avatar_initial || '我' : <UserRound className="h-3.5 w-3.5" />}
        </span>
        <span className="max-w-28 truncate">{account.logged_in ? account.nickname : '登录'}</span>
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm" data-account-panel="local">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-bold text-white">本地账号</span>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${account.logged_in ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {account.logged_in ? '已登录' : account.has_account ? '未登录' : '未创建'}
            </span>
          </div>
          <h3 className="text-base font-bold text-slate-900">我的账号</h3>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500">
            当前版本是本机账号，只保存在这台电脑上。密码会以 hash 和 salt 保存，不会写入明文。将来如果接入云端同步，会在这里明确提示。
          </p>
        </div>
        {account.logged_in ? (
          <div className="flex shrink-0 items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
              {account.avatar_initial || '我'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">{account.nickname}</p>
              <p className="text-[11px] text-slate-500">{account.remember_me ? '下次自动进入' : '本次登录'}</p>
            </div>
          </div>
        ) : null}
      </div>

      {account.logged_in ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px]">
          <label className="block text-xs font-semibold text-slate-600">
            昵称
            <input
              value={editName}
              onChange={(event) => setEditName(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400"
              placeholder="输入新的昵称"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <button
              onClick={() => run('保存昵称', () => renameAccount(editName))}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              保存昵称
            </button>
            <button
              onClick={() => run('退出登录', logoutAccount)}
              disabled={busy}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-100 bg-white px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
            >
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_220px]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-1">
              <button
                onClick={() => setMode('login')}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                登录
              </button>
              <button
                onClick={() => setMode('create')}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${mode === 'create' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                创建账号
              </button>
            </div>
            <label className="block text-xs font-semibold text-slate-600">
              昵称
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400"
                placeholder="例如 小明"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-600">
              密码
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400"
                placeholder="至少 6 个字符"
              />
            </label>
            <label className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              <input type="checkbox" checked={rememberMe} onChange={(event) => setRememberMe(event.target.checked)} className="mt-0.5" />
              <span>记住我，下次打开联机助手时直接进入本地账号。</span>
            </label>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => run(mode === 'create' ? '创建账号' : '登录', () => mode === 'create' ? createAccount(nickname, password, rememberMe) : loginAccount(nickname, password, rememberMe))}
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              {mode === 'create' ? '创建并登录' : '登录本地账号'}
            </button>
            <p className="rounded-xl bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
              {account.has_account
                ? '本机已经有账号，请使用创建时的昵称和密码登录。'
                : '首次使用请先创建账号。这个账号只用于本机保存偏好，不会上传。'}
            </p>
          </div>
        </div>
      )}
      <p
        className={`mt-4 rounded-xl p-3 text-[11px] leading-relaxed ${
          notice.type === 'error'
            ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100'
            : notice.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100'
              : 'bg-slate-50 text-slate-600 ring-1 ring-slate-100'
        }`}
        role={notice.type === 'error' ? 'alert' : 'status'}
      >
        {notice.text}
      </p>
    </section>
  );
}
