use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};

use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::models::settings::UserAccountState;
use crate::storage::settings_store::settings_dir_path;

const ACCOUNT_FILE: &str = "account.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct LocalAccountRecord {
    nickname: String,
    password_hash: String,
    salt: String,
    remember_me: bool,
    logged_in: bool,
    updated_at: String,
}

pub fn get_account_state() -> Result<UserAccountState, String> {
    Ok(public_state(read_account_record().ok().flatten(), "账号状态已读取。"))
}

pub fn create_local_account(
    nickname: String,
    password: String,
    remember_me: bool,
) -> Result<UserAccountState, String> {
    let nickname = normalize_nickname(&nickname)?;
    validate_password(&password)?;
    if read_account_record()?.is_some() {
        return Err("本机已经创建过本地账号，请直接登录或先退出后联系管理员重置本机数据。".to_string());
    }
    let salt = new_salt(&nickname);
    let record = LocalAccountRecord {
        nickname,
        password_hash: hash_password(&salt, &password),
        salt,
        remember_me,
        logged_in: true,
        updated_at: Utc::now().to_rfc3339(),
    };
    write_account_record(&record)?;
    Ok(public_state(Some(record), "本地账号已创建。"))
}

pub fn login_local_account(
    nickname: String,
    password: String,
    remember_me: bool,
) -> Result<UserAccountState, String> {
    let nickname = normalize_nickname(&nickname)?;
    let Some(mut record) = read_account_record()? else {
        return Err("还没有本地账号，请先创建账号。".to_string());
    };
    if record.nickname != nickname {
        return Err("昵称不匹配，请输入创建账号时使用的昵称。".to_string());
    }
    if record.password_hash != hash_password(&record.salt, &password) {
        return Err("密码不正确，请重新输入。".to_string());
    }
    record.remember_me = remember_me;
    record.logged_in = true;
    record.updated_at = Utc::now().to_rfc3339();
    write_account_record(&record)?;
    Ok(public_state(Some(record), "已登录本地账号。"))
}

pub fn logout_local_account() -> Result<UserAccountState, String> {
    let Some(mut record) = read_account_record()? else {
        return Ok(public_state(None, "本机还没有本地账号。"));
    };
    record.logged_in = false;
    record.remember_me = false;
    record.updated_at = Utc::now().to_rfc3339();
    write_account_record(&record)?;
    Ok(public_state(Some(record), "已退出登录。"))
}

pub fn update_account_nickname(nickname: String) -> Result<UserAccountState, String> {
    let nickname = normalize_nickname(&nickname)?;
    let Some(mut record) = read_account_record()? else {
        return Err("还没有本地账号，请先创建账号。".to_string());
    };
    record.nickname = nickname;
    record.updated_at = Utc::now().to_rfc3339();
    write_account_record(&record)?;
    Ok(public_state(Some(record), "昵称已保存。"))
}

fn normalize_nickname(value: &str) -> Result<String, String> {
    let nickname = value.trim();
    if nickname.is_empty() {
        return Err("昵称不能为空。".to_string());
    }
    if nickname.chars().count() > 24 {
        return Err("昵称太长，请控制在 24 个字符以内。".to_string());
    }
    Ok(nickname.to_string())
}

fn validate_password(password: &str) -> Result<(), String> {
    if password.chars().count() < 6 {
        return Err("密码至少需要 6 个字符。".to_string());
    }
    Ok(())
}

fn account_file_path() -> Result<std::path::PathBuf, String> {
    Ok(settings_dir_path()?.join(ACCOUNT_FILE))
}

fn read_account_record() -> Result<Option<LocalAccountRecord>, String> {
    let path = account_file_path()?;
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(&path)
        .map_err(|err| format!("读取账号失败: {err}"))?;
    let record = serde_json::from_str::<LocalAccountRecord>(&content)
        .map_err(|err| format!("解析账号失败: {err}"))?;
    Ok(Some(record))
}

fn write_account_record(record: &LocalAccountRecord) -> Result<(), String> {
    let path = account_file_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|err| format!("创建账号目录失败: {err}"))?;
    }
    let content = serde_json::to_string_pretty(record)
        .map_err(|err| format!("序列化账号失败: {err}"))?;
    fs::write(path, content).map_err(|err| format!("保存账号失败: {err}"))
}

fn new_salt(nickname: &str) -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_nanos())
        .unwrap_or_default();
    let mut hasher = Sha256::new();
    hasher.update(format!("{nickname}:{now}:{}", std::process::id()).as_bytes());
    format!("{:x}", hasher.finalize())
}

fn hash_password(salt: &str, password: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(salt.as_bytes());
    hasher.update(b":lan-helper-local-account:");
    hasher.update(password.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn public_state(record: Option<LocalAccountRecord>, message: &str) -> UserAccountState {
    if let Some(record) = record {
        let initial = record
            .nickname
            .chars()
            .find(|item| !item.is_whitespace())
            .map(|item| item.to_uppercase().to_string());
        UserAccountState {
            has_account: true,
            logged_in: record.logged_in || record.remember_me,
            nickname: Some(record.nickname),
            remember_me: record.remember_me,
            avatar_initial: initial,
            updated_at: Some(record.updated_at),
            message: message.to_string(),
        }
    } else {
        UserAccountState {
            has_account: false,
            logged_in: false,
            nickname: None,
            remember_me: false,
            avatar_initial: None,
            updated_at: None,
            message: message.to_string(),
        }
    }
}
