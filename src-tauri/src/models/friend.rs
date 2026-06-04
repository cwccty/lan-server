use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendAllocation {
    pub id: String,
    pub name: String,
    pub ip: String,
    pub status: String,
    pub created_at: String,
    pub updated_at: String,
    pub last_check_summary: Option<String>,
    pub last_checked_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendAllocationInput {
    pub name: String,
    pub ip: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FriendCheckInput {
    pub ip: String,
    pub summary: String,
}
