use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillFileEntry {
    pub path: String,
    pub size: u64,
}

#[tauri::command]
pub async fn list_skill_files(central_path: String) -> Result<Vec<SkillFileEntry>, String> {
    let path = std::path::PathBuf::from(&central_path);
    tauri::async_runtime::spawn_blocking(move || {
        let entries = crate::core::skill_files::list_files(&path)?;
        Ok::<_, anyhow::Error>(
            entries
                .into_iter()
                .map(|e| SkillFileEntry {
                    path: e.path,
                    size: e.size,
                })
                .collect(),
        )
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(super::format_anyhow_error)
}

#[tauri::command]
pub async fn read_skill_file(central_path: String, file_path: String) -> Result<String, String> {
    let base = std::path::PathBuf::from(&central_path);
    tauri::async_runtime::spawn_blocking(move || {
        crate::core::skill_files::read_file(&base, &file_path)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(super::format_anyhow_error)
}
