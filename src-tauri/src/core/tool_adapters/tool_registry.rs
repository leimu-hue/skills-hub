use std::collections::HashMap;
use std::sync::OnceLock;

use super::tool_data::{default_tool_adapters, ToolAdapter};
use super::tool_id::ToolId;

static ADAPTERS_BY_KEY: OnceLock<HashMap<String, ToolAdapter>> = OnceLock::new();
static ADAPTERS_BY_SKILLS_DIR: OnceLock<HashMap<&'static str, Vec<ToolAdapter>>> = OnceLock::new();

fn cached_adapters_by_key() -> &'static HashMap<String, ToolAdapter> {
    ADAPTERS_BY_KEY.get_or_init(|| {
        default_tool_adapters()
            .into_iter()
            .map(|a| (a.id.as_key().to_string(), a))
            .collect()
    })
}

fn cached_adapters_by_skills_dir() -> &'static HashMap<&'static str, Vec<ToolAdapter>> {
    ADAPTERS_BY_SKILLS_DIR.get_or_init(|| {
        let mut map: HashMap<&str, Vec<ToolAdapter>> = HashMap::new();
        for adapter in default_tool_adapters() {
            map.entry(adapter.relative_skills_dir)
                .or_default()
                .push(adapter);
        }
        map
    })
}

pub fn adapters_sharing_skills_dir(adapter: &ToolAdapter) -> Vec<ToolAdapter> {
    cached_adapters_by_skills_dir()
        .get(adapter.relative_skills_dir)
        .cloned()
        .unwrap_or_default()
}

pub fn adapter_by_key(key: &str) -> Option<ToolAdapter> {
    cached_adapters_by_key().get(key).cloned()
}
