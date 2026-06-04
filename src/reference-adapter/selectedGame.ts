import type { GameSummary } from '../types/game';

const SELECTED_GAME_KEY = 'lan-helper.referenceSelectedGame';
export const SELECTED_GAME_EVENT = 'lan-helper:reference-selected-game-changed';

export interface ReferenceSelectedGame {
  game_id: string;
  display_name: string;
  selected_at: string;
}

function normalizeSelectedGame(value: unknown): ReferenceSelectedGame | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<ReferenceSelectedGame>;
  if (!item.game_id || !item.display_name) return null;
  return {
    game_id: String(item.game_id),
    display_name: String(item.display_name),
    selected_at: String(item.selected_at || new Date().toISOString())
  };
}

export function getReferenceSelectedGame(): ReferenceSelectedGame | null {
  try {
    const raw = window.localStorage.getItem(SELECTED_GAME_KEY);
    if (!raw) return null;
    return normalizeSelectedGame(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function setReferenceSelectedGame(game: Pick<GameSummary, 'game_id' | 'display_name'>) {
  const selected: ReferenceSelectedGame = {
    game_id: game.game_id,
    display_name: game.display_name,
    selected_at: new Date().toISOString()
  };
  window.localStorage.setItem(SELECTED_GAME_KEY, JSON.stringify(selected));
  window.dispatchEvent(new CustomEvent<ReferenceSelectedGame>(SELECTED_GAME_EVENT, { detail: selected }));
  return selected;
}

export function subscribeReferenceSelectedGame(listener: (game: ReferenceSelectedGame | null) => void) {
  const handle = () => listener(getReferenceSelectedGame());
  window.addEventListener(SELECTED_GAME_EVENT, handle);
  window.addEventListener('storage', handle);
  return () => {
    window.removeEventListener(SELECTED_GAME_EVENT, handle);
    window.removeEventListener('storage', handle);
  };
}
