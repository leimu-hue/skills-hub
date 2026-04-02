use crate::core::github_search::{search_github_repos, RepoSummary};
use crate::core::skill_store::SkillStore;
use tauri::State;

#[tauri::command]
pub async fn search_github(
    store: State<'_, SkillStore>,
    query: String,
    limit: Option<u32>,
) -> Result<Vec<RepoSummary>, String> {
    let store = store.inner().clone();
    let limit = limit.unwrap_or(10) as usize;
    tauri::async_runtime::spawn_blocking(move || {
        let token = store.get_setting("github_token")?.unwrap_or_default();
        let token_opt = if token.is_empty() {
            None
        } else {
            Some(token.as_str())
        };
        search_github_repos(&query, limit, token_opt)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(super::format_anyhow_error)
}

#[tauri::command]
pub async fn get_github_token(store: State<'_, SkillStore>) -> Result<String, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        Ok::<_, anyhow::Error>(store.get_setting("github_token")?.unwrap_or_default())
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(super::format_anyhow_error)
}

#[tauri::command]
pub async fn set_github_token(store: State<'_, SkillStore>, token: String) -> Result<(), String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let trimmed = token.trim();
        if trimmed.is_empty() {
            store.set_setting("github_token", "")?;
        } else {
            store.set_setting("github_token", trimmed)?;
        }
        Ok::<_, anyhow::Error>(())
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(super::format_anyhow_error)
}
