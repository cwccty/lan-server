import {
  listFriendAllocations,
  removeFriendAllocation,
  selectFriendAllocation,
  updateFriendCheck,
  upsertFriendAllocation
} from '../api/tauri';
import type { FriendAllocation } from '../types/friend';

const FRIEND_ALLOCATIONS_KEY = 'lan-helper.referenceFriendAllocations';
const SELECTED_FRIEND_KEY = 'lan-helper.referenceSelectedFriend';
export const FRIEND_ALLOCATIONS_EVENT = 'lan-helper:reference-friend-allocations-changed';

export interface ReferenceFriendAllocation {
  id: string;
  name: string;
  ip: string;
  status: 'reserved' | 'selected' | 'removed';
  created_at: string;
  updated_at: string;
  last_check_summary?: string;
  last_checked_at?: string;
}

function fromBackend(item: FriendAllocation): ReferenceFriendAllocation {
  return {
    id: item.id,
    name: item.name,
    ip: item.ip,
    status: item.status === 'selected' || item.status === 'removed' ? item.status : 'reserved',
    created_at: item.created_at,
    updated_at: item.updated_at,
    last_check_summary: item.last_check_summary || undefined,
    last_checked_at: item.last_checked_at || undefined
  };
}

function persistBackendSnapshot(items: ReferenceFriendAllocation[]) {
  window.localStorage.setItem(FRIEND_ALLOCATIONS_KEY, JSON.stringify(items));
  const selected = items.find((item) => item.status === 'selected') ?? items[0];
  if (selected) window.localStorage.setItem(SELECTED_FRIEND_KEY, selected.id);
  emit();
}

function nowIso() {
  return new Date().toISOString();
}

function normalize(value: unknown): ReferenceFriendAllocation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const row = item as Partial<ReferenceFriendAllocation>;
      if (!row.name || !row.ip) return null;
      return {
        id: String(row.id || `friend_${Date.now()}`),
        name: String(row.name),
        ip: String(row.ip),
        status: row.status === 'selected' || row.status === 'removed' ? row.status : 'reserved',
        created_at: String(row.created_at || nowIso()),
        updated_at: String(row.updated_at || row.created_at || nowIso()),
        last_check_summary: row.last_check_summary ? String(row.last_check_summary) : undefined,
        last_checked_at: row.last_checked_at ? String(row.last_checked_at) : undefined
      } satisfies ReferenceFriendAllocation;
    })
    .filter(Boolean) as ReferenceFriendAllocation[];
}

function emit() {
  window.dispatchEvent(new CustomEvent(FRIEND_ALLOCATIONS_EVENT, { detail: listReferenceFriendAllocations() }));
}

export function listReferenceFriendAllocations() {
  try {
    return normalize(JSON.parse(window.localStorage.getItem(FRIEND_ALLOCATIONS_KEY) || '[]'))
      .filter((item) => item.status !== 'removed');
  } catch {
    return [];
  }
}

function saveAll(items: ReferenceFriendAllocation[]) {
  window.localStorage.setItem(FRIEND_ALLOCATIONS_KEY, JSON.stringify(items));
  emit();
}

export function getReferenceSelectedFriend() {
  const selectedId = window.localStorage.getItem(SELECTED_FRIEND_KEY);
  const items = listReferenceFriendAllocations();
  return items.find((item) => item.id === selectedId) ?? items[items.length - 1] ?? null;
}

export function upsertReferenceFriendAllocation(name: string, ip: string) {
  const cleanName = name.trim();
  const cleanIp = ip.trim();
  if (!cleanName) throw new Error('请输入好友昵称。');
  if (!/^10\.\d+\.\d+\.\d+$/.test(cleanIp)) throw new Error('好友虚拟 IP 必须是 10.x.x.x 网段地址。');

  const items = listReferenceFriendAllocations();
  const existing = items.find((item) => item.ip === cleanIp || item.name === cleanName);
  const next: ReferenceFriendAllocation = {
    id: existing?.id || `friend_${Date.now()}`,
    name: cleanName,
    ip: cleanIp,
    status: 'selected',
    created_at: existing?.created_at || nowIso(),
    updated_at: nowIso(),
    last_check_summary: existing?.last_check_summary,
    last_checked_at: existing?.last_checked_at
  };
  const merged = [next, ...items.filter((item) => item.id !== next.id && item.ip !== cleanIp && item.name !== cleanName)]
    .map((item) => item.id === next.id ? next : { ...item, status: item.status === 'selected' ? 'reserved' : item.status });
  saveAll(merged);
  window.localStorage.setItem(SELECTED_FRIEND_KEY, next.id);
  return next;
}

export function selectReferenceFriendAllocation(name: string, ip: string) {
  const existing = listReferenceFriendAllocations().find((item) => item.ip === ip || item.name === name);
  const selected = existing ?? upsertReferenceFriendAllocation(name, ip);
  const items = listReferenceFriendAllocations().map((item) => ({
    ...item,
    status: item.id === selected.id ? 'selected' as const : 'reserved' as const,
    updated_at: item.id === selected.id ? nowIso() : item.updated_at
  }));
  saveAll(items);
  window.localStorage.setItem(SELECTED_FRIEND_KEY, selected.id);
  return items.find((item) => item.id === selected.id) ?? selected;
}

export function removeReferenceFriendAllocation(name: string, ip?: string) {
  const items = listReferenceFriendAllocations();
  const target = items.find((item) => item.ip === ip || item.name === name);
  if (!target) throw new Error(`没有找到要回收的好友席位：${name}`);
  const remaining = items.filter((item) => item.id !== target.id);
  saveAll(remaining);
  if (window.localStorage.getItem(SELECTED_FRIEND_KEY) === target.id) {
    window.localStorage.removeItem(SELECTED_FRIEND_KEY);
  }
  return target;
}

export function updateReferenceFriendCheck(ip: string, summary: string) {
  const items = listReferenceFriendAllocations();
  const next = items.map((item) => item.ip === ip ? {
    ...item,
    last_check_summary: summary,
    last_checked_at: nowIso(),
    updated_at: nowIso()
  } : item);
  saveAll(next);
  return next.find((item) => item.ip === ip) ?? null;
}

export async function listReferenceFriendAllocationsBackendFirst() {
  try {
    const items = (await listFriendAllocations()).map(fromBackend);
    persistBackendSnapshot(items);
    return items;
  } catch {
    return listReferenceFriendAllocations();
  }
}

export async function upsertReferenceFriendAllocationBackendFirst(name: string, ip: string) {
  try {
    const friend = fromBackend(await upsertFriendAllocation({ name, ip }));
    const items = [
      friend,
      ...listReferenceFriendAllocations().filter((item) => item.id !== friend.id && item.ip !== friend.ip && item.name !== friend.name)
    ].map((item) => item.id === friend.id ? friend : { ...item, status: item.status === 'selected' ? 'reserved' as const : item.status });
    persistBackendSnapshot(items);
    window.localStorage.setItem(SELECTED_FRIEND_KEY, friend.id);
    return friend;
  } catch {
    return upsertReferenceFriendAllocation(name, ip);
  }
}

export async function selectReferenceFriendAllocationBackendFirst(name: string, ip: string) {
  try {
    const friend = fromBackend(await selectFriendAllocation({ name, ip }));
    const items = listReferenceFriendAllocations().map((item) => ({
      ...item,
      status: item.id === friend.id ? 'selected' as const : 'reserved' as const,
      updated_at: item.id === friend.id ? friend.updated_at : item.updated_at
    }));
    const merged = items.some((item) => item.id === friend.id) ? items : [friend, ...items];
    persistBackendSnapshot(merged);
    window.localStorage.setItem(SELECTED_FRIEND_KEY, friend.id);
    return friend;
  } catch {
    return selectReferenceFriendAllocation(name, ip);
  }
}

export async function removeReferenceFriendAllocationBackendFirst(name: string, ip?: string) {
  try {
    const friend = fromBackend(await removeFriendAllocation(name, ip || null));
    const remaining = listReferenceFriendAllocations().filter((item) => item.id !== friend.id);
    persistBackendSnapshot(remaining);
    if (window.localStorage.getItem(SELECTED_FRIEND_KEY) === friend.id) {
      window.localStorage.removeItem(SELECTED_FRIEND_KEY);
    }
    return friend;
  } catch {
    return removeReferenceFriendAllocation(name, ip);
  }
}

export async function updateReferenceFriendCheckBackendFirst(ip: string, summary: string) {
  try {
    const updated = await updateFriendCheck({ ip, summary });
    if (!updated) return updateReferenceFriendCheck(ip, summary);
    const friend = fromBackend(updated);
    const items = listReferenceFriendAllocations().map((item) => item.ip === ip ? friend : item);
    persistBackendSnapshot(items);
    return friend;
  } catch {
    return updateReferenceFriendCheck(ip, summary);
  }
}

export function subscribeReferenceFriendAllocations(listener: (items: ReferenceFriendAllocation[]) => void) {
  const handle = () => listener(listReferenceFriendAllocations());
  window.addEventListener(FRIEND_ALLOCATIONS_EVENT, handle);
  window.addEventListener('storage', handle);
  return () => {
    window.removeEventListener(FRIEND_ALLOCATIONS_EVENT, handle);
    window.removeEventListener('storage', handle);
  };
}
