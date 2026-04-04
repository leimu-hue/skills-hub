pub mod domain;
pub mod infra;
pub mod tool;

pub use domain::explore::{featured_skills, github_download};
pub use domain::install::installer;
pub use domain::manage::{onboarding, skill_files, skill_store};
pub use domain::search::{github_search, skills_search};
pub use domain::shared::{central_repo, content_hash};
pub use domain::sync::{git_fetcher, sync_engine};
pub use infra::{cache_cleanup, cancel_token, temp_cleanup};

pub const IGNORE_NAMES: &[&str] = &[".git", ".DS_Store", "Thumbs.db", ".gitignore"];

pub fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
