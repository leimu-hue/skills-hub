mod tool_data;
mod tool_detection;
mod tool_id;
mod tool_registry;

pub use tool_data::{default_tool_adapters, DetectedSkill, ToolAdapter};
pub use tool_detection::{
    is_tool_installed, resolve_default_path, resolve_detect_path, scan_tool_dir,
};
pub use tool_id::ToolId;
pub use tool_registry::{adapter_by_key, adapters_sharing_skills_dir};

#[cfg(test)]
#[path = "../tests/tool_adapters.rs"]
mod tests;
