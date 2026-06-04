export interface FriendAllocation {
  id: string;
  name: string;
  ip: string;
  status: 'reserved' | 'selected' | 'removed' | string;
  created_at: string;
  updated_at: string;
  last_check_summary?: string | null;
  last_checked_at?: string | null;
}

export interface FriendAllocationInput {
  name: string;
  ip: string;
}

export interface FriendCheckInput {
  ip: string;
  summary: string;
}
