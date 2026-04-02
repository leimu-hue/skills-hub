use crate::core::skill_store::SkillStore;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
pub struct ManagedSkillDto {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub source_type: String,
    pub source_ref: Option<String>,
    pub central_path: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub last_sync_at: Option<i64>,
    pub status: String,
    pub targets: Vec<SkillTargetDto>,
}

#[derive(Debug, Serialize)]
pub struct SkillTargetDto {
    pub tool: String,
    pub mode: String,
    pub status: String,
    pub target_path: String,
    pub synced_at: Option<i64>,
}

#[tauri::command]
pub fn get_managed_skills(store: State<'_, SkillStore>) -> Result<Vec<ManagedSkillDto>, String> {
    get_managed_skills_impl(store.inner())
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn delete_managed_skill(
    store: State<'_, SkillStore>,
    skillId: String,
) -> Result<(), String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        println!("[delete_managed_skill] skillId={}", skillId);

        let targets = store.list_skill_targets(&skillId)?;

        let mut remove_failures: Vec<String> = Vec::new();
        for target in targets {
            if let Err(err) = remove_path_any(&target.target_path) {
                remove_failures.push(format!("{}: {}", target.target_path, err));
            }
        }

        let record = store.get_skill_by_id(&skillId)?;
        if let Some(skill) = record {
            let path = std::path::PathBuf::from(skill.central_path);
            if path.exists() {
                std::fs::remove_dir_all(&path)?;
            }
            store.delete_skill(&skillId)?;
        }

        if !remove_failures.is_empty() {
            anyhow::bail!(
                "已删除托管记录，但清理部分工具目录失败：\n- {}",
                remove_failures.join("\n- ")
            );
        }

        Ok::<_, anyhow::Error>(())
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(super::format_anyhow_error)
}

fn remove_path_any(path: &str) -> Result<(), String> {
    let p = std::path::Path::new(path);
    if !p.exists() {
        return Ok(());
    }

    let meta = std::fs::symlink_metadata(p).map_err(|err| err.to_string())?;
    let ft = meta.file_type();

    if ft.is_symlink() {
        std::fs::remove_file(p).map_err(|err| err.to_string())?;
        return Ok(());
    }

    if ft.is_dir() {
        std::fs::remove_dir_all(p).map_err(|err| err.to_string())?;
        return Ok(());
    }

    std::fs::remove_file(p).map_err(|err| err.to_string())?;
    Ok(())
}

pub fn get_managed_skills_impl(store: &SkillStore) -> Result<Vec<ManagedSkillDto>, String> {
    let skills_with_targets = store
        .list_skills_with_targets()
        .map_err(|e| e.to_string())?;
    Ok(skills_with_targets
        .into_iter()
        .map(|(skill, targets)| {
            let targets = targets
                .into_iter()
                .map(|target| SkillTargetDto {
                    tool: target.tool,
                    mode: target.mode,
                    status: target.status,
                    target_path: target.target_path,
                    synced_at: target.synced_at,
                })
                .collect();

            ManagedSkillDto {
                id: skill.id,
                name: skill.name,
                description: skill.description,
                source_type: skill.source_type,
                source_ref: skill.source_ref,
                central_path: skill.central_path,
                created_at: skill.created_at,
                updated_at: skill.updated_at,
                last_sync_at: skill.last_sync_at,
                status: skill.status,
                targets,
            }
        })
        .collect())
}
