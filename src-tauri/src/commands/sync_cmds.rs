use serde::Serialize;
use tauri::State;

use crate::core::now_ms;
use crate::core::skill_store::{SkillStore, SkillTargetRecord};
use crate::core::sync_engine::{sync_dir_for_tool_with_overwrite, sync_dir_hybrid};
use crate::core::tool_adapters::{adapter_by_key, is_tool_installed, resolve_default_path};
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct SyncResultDto {
    pub mode_used: String,
    pub target_path: String,
}

#[tauri::command]
pub async fn sync_skill_dir(
    source_path: String,
    target_path: String,
) -> Result<SyncResultDto, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let result = sync_dir_hybrid(source_path.as_ref(), target_path.as_ref())?;
        Ok::<_, anyhow::Error>(SyncResultDto {
            mode_used: result.mode_used.as_str().to_string(),
            target_path: result.target_path.to_string_lossy().to_string(),
        })
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(super::format_anyhow_error)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn sync_skill_to_tool(
    store: State<'_, SkillStore>,
    sourcePath: String,
    skillId: String,
    tool: String,
    name: String,
    overwrite: Option<bool>,
) -> Result<SyncResultDto, String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let adapter = adapter_by_key(&tool).ok_or_else(|| anyhow::anyhow!("unknown tool"))?;
        if !is_tool_installed(&adapter)? {
            anyhow::bail!("TOOL_NOT_INSTALLED|{}", adapter.id.as_key());
        }
        let tool_root = resolve_default_path(&adapter)?;
        if let Err(err) = std::fs::create_dir_all(&tool_root) {
            if err.kind() == std::io::ErrorKind::PermissionDenied {
                anyhow::bail!(
                    "TOOL_NOT_WRITABLE|{}|{}",
                    adapter.display_name,
                    tool_root.to_string_lossy()
                );
            }
            anyhow::bail!("failed to create skills dir {:?}: {}", tool_root, err);
        }
        let target = tool_root.join(&name);
        let overwrite = overwrite.unwrap_or(false);
        let result =
            sync_dir_for_tool_with_overwrite(&tool, sourcePath.as_ref(), &target, overwrite)
                .map_err(|err| {
                    let msg = err.to_string();
                    if msg.contains("target already exists") {
                        anyhow::anyhow!("TARGET_EXISTS|{}", target.to_string_lossy())
                    } else if msg.contains("os error 5")
                        || msg.contains("Access is denied")
                        || msg.contains("Permission denied")
                    {
                        anyhow::anyhow!(
                            "TOOL_NOT_WRITABLE|{}|{}",
                            adapter.display_name,
                            tool_root.to_string_lossy()
                        )
                    } else {
                        anyhow::anyhow!(msg)
                    }
                })?;

        let group = crate::core::tool_adapters::adapters_sharing_skills_dir(&adapter);
        for a in group {
            if !is_tool_installed(&a)? {
                continue;
            }
            let record = SkillTargetRecord {
                id: Uuid::new_v4().to_string(),
                skill_id: skillId.clone(),
                tool: a.id.as_key().to_string(),
                target_path: result.target_path.to_string_lossy().to_string(),
                mode: result.mode_used.as_str().to_string(),
                status: "ok".to_string(),
                last_error: None,
                synced_at: Some(now_ms()),
            };
            store.upsert_skill_target(&record)?;
        }

        Ok::<_, anyhow::Error>(SyncResultDto {
            mode_used: result.mode_used.as_str().to_string(),
            target_path: result.target_path.to_string_lossy().to_string(),
        })
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(super::format_anyhow_error)
}

#[tauri::command]
#[allow(non_snake_case)]
pub async fn unsync_skill_from_tool(
    store: State<'_, SkillStore>,
    skillId: String,
    tool: String,
) -> Result<(), String> {
    let store = store.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let group_tool_keys: Vec<String> = if let Some(adapter) = adapter_by_key(&tool) {
            let group = crate::core::tool_adapters::adapters_sharing_skills_dir(&adapter);
            let mut any_installed = false;
            for a in &group {
                if is_tool_installed(a)? {
                    any_installed = true;
                    break;
                }
            }
            if !any_installed {
                return Ok::<_, anyhow::Error>(());
            }
            group
                .into_iter()
                .map(|a| a.id.as_key().to_string())
                .collect()
        } else {
            vec![tool.clone()]
        };

        let mut removed = false;
        for k in &group_tool_keys {
            if let Some(target) = store.get_skill_target(&skillId, k)? {
                if !removed {
                    remove_path_any(&target.target_path).map_err(anyhow::Error::msg)?;
                    removed = true;
                }
                store.delete_skill_target(&skillId, k)?;
            }
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
