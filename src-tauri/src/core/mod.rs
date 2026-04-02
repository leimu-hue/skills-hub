pub mod cache_cleanup;
pub mod cancel_token;
pub mod central_repo;
pub mod content_hash;
pub mod featured_skills;
pub mod git_fetcher;
pub mod github_download;
pub mod github_search;
pub mod installer;
pub mod onboarding;
pub mod skill_files;
pub mod skill_store;
pub mod skills_search;
pub mod sync_engine;
pub mod temp_cleanup;
pub mod tool_adapters;

use std::time::{SystemTime, UNIX_EPOCH};

pub const IGNORE_NAMES: &[&str] = &[".git", ".DS_Store", "Thumbs.db", ".gitignore"];

pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
