use crate::core::featured_skills::{fetch_featured_skills, FeaturedSkill};
use crate::core::skill_store::SkillStore;
use crate::core::skills_search::{
    search_skills_online as search_skills_online_core, OnlineSkillResult,
};
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct FeaturedSkillDto {
    pub slug: String,
    pub name: String,
    pub summary: String,
    pub downloads: u64,
    pub stars: u64,
    pub source_url: String,
}

impl From<FeaturedSkill> for FeaturedSkillDto {
    fn from(s: FeaturedSkill) -> Self {
        Self {
            slug: s.slug,
            name: s.name,
            summary: s.summary,
            downloads: s.downloads,
            stars: s.stars,
            source_url: s.source_url,
        }
    }
}

#[tauri::command]
pub async fn get_featured_skills(
    store: State<'_, SkillStore>,
) -> Result<Vec<FeaturedSkillDto>, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let skills = fetch_featured_skills(&store)?;
        Ok::<_, anyhow::Error>(skills.into_iter().map(FeaturedSkillDto::from).collect())
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(super::format_anyhow_error)
}

#[derive(Debug, Serialize)]
pub struct OnlineSkillDto {
    pub name: String,
    pub installs: u64,
    pub source: String,
    pub source_url: String,
}

impl From<OnlineSkillResult> for OnlineSkillDto {
    fn from(r: OnlineSkillResult) -> Self {
        Self {
            name: r.name,
            installs: r.installs,
            source: r.source,
            source_url: r.source_url,
        }
    }
}

#[tauri::command]
pub async fn search_skills_online(
    query: String,
    limit: Option<u32>,
) -> Result<Vec<OnlineSkillDto>, String> {
    let limit = limit.unwrap_or(20) as usize;
    tauri::async_runtime::spawn_blocking(move || {
        let results = search_skills_online_core(&query, limit)?;
        Ok::<_, anyhow::Error>(results.into_iter().map(OnlineSkillDto::from).collect())
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(super::format_anyhow_error)
}
