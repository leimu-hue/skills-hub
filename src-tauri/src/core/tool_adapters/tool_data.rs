use std::path::PathBuf;

pub use crate::core::tool_adapters::tool_id::ToolId;

#[derive(Clone, Debug)]
pub struct ToolAdapter {
    pub id: ToolId,
    pub display_name: &'static str,
    pub relative_skills_dir: &'static str,
    pub relative_detect_dir: &'static str,
}

#[derive(Clone, Debug)]
pub struct DetectedSkill {
    pub tool: ToolId,
    pub name: String,
    pub path: PathBuf,
    pub is_link: bool,
    pub link_target: Option<PathBuf>,
}

pub fn default_tool_adapters() -> Vec<ToolAdapter> {
    vec![
        ToolAdapter {
            id: ToolId::Cursor,
            display_name: "Cursor",
            relative_skills_dir: ".cursor/skills",
            relative_detect_dir: ".cursor",
        },
        ToolAdapter {
            id: ToolId::ClaudeCode,
            display_name: "Claude Code",
            relative_skills_dir: ".claude/skills",
            relative_detect_dir: ".claude",
        },
        ToolAdapter {
            id: ToolId::Codex,
            display_name: "Codex",
            relative_skills_dir: ".codex/skills",
            relative_detect_dir: ".codex",
        },
        ToolAdapter {
            id: ToolId::OpenCode,
            display_name: "OpenCode",
            relative_skills_dir: ".config/opencode/skills",
            relative_detect_dir: ".config/opencode",
        },
        ToolAdapter {
            id: ToolId::Antigravity,
            display_name: "Antigravity",
            relative_skills_dir: ".gemini/antigravity/global_skills",
            relative_detect_dir: ".gemini/antigravity",
        },
        ToolAdapter {
            id: ToolId::Amp,
            display_name: "Amp",
            relative_skills_dir: ".config/agents/skills",
            relative_detect_dir: ".config/agents",
        },
        ToolAdapter {
            id: ToolId::KimiCli,
            display_name: "Kimi Code CLI",
            relative_skills_dir: ".config/agents/skills",
            relative_detect_dir: ".config/agents",
        },
        ToolAdapter {
            id: ToolId::Augment,
            display_name: "Augment",
            relative_skills_dir: ".augment/rules",
            relative_detect_dir: ".augment",
        },
        ToolAdapter {
            id: ToolId::OpenClaw,
            display_name: "OpenClaw",
            relative_skills_dir: ".openclaw/skills",
            relative_detect_dir: ".openclaw",
        },
        ToolAdapter {
            id: ToolId::Cline,
            display_name: "Cline",
            relative_skills_dir: ".cline/skills",
            relative_detect_dir: ".cline",
        },
        ToolAdapter {
            id: ToolId::CodeBuddy,
            display_name: "CodeBuddy",
            relative_skills_dir: ".codebuddy/skills",
            relative_detect_dir: ".codebuddy",
        },
        ToolAdapter {
            id: ToolId::CommandCode,
            display_name: "Command Code",
            relative_skills_dir: ".commandcode/skills",
            relative_detect_dir: ".commandcode",
        },
        ToolAdapter {
            id: ToolId::Continue,
            display_name: "Continue",
            relative_skills_dir: ".continue/skills",
            relative_detect_dir: ".continue",
        },
        ToolAdapter {
            id: ToolId::Crush,
            display_name: "Crush",
            relative_skills_dir: ".config/crush/skills",
            relative_detect_dir: ".config/crush",
        },
        ToolAdapter {
            id: ToolId::Junie,
            display_name: "Junie",
            relative_skills_dir: ".junie/skills",
            relative_detect_dir: ".junie",
        },
        ToolAdapter {
            id: ToolId::IflowCli,
            display_name: "iFlow CLI",
            relative_skills_dir: ".iflow/skills",
            relative_detect_dir: ".iflow",
        },
        ToolAdapter {
            id: ToolId::KiroCli,
            display_name: "Kiro CLI",
            relative_skills_dir: ".kiro/skills",
            relative_detect_dir: ".kiro",
        },
        ToolAdapter {
            id: ToolId::Kode,
            display_name: "Kode",
            relative_skills_dir: ".kode/skills",
            relative_detect_dir: ".kode",
        },
        ToolAdapter {
            id: ToolId::McpJam,
            display_name: "MCPJam",
            relative_skills_dir: ".mcpjam/skills",
            relative_detect_dir: ".mcpjam",
        },
        ToolAdapter {
            id: ToolId::MistralVibe,
            display_name: "Mistral Vibe",
            relative_skills_dir: ".vibe/skills",
            relative_detect_dir: ".vibe",
        },
        ToolAdapter {
            id: ToolId::Mux,
            display_name: "Mux",
            relative_skills_dir: ".mux/skills",
            relative_detect_dir: ".mux",
        },
        ToolAdapter {
            id: ToolId::OpenClaude,
            display_name: "OpenClaude IDE",
            relative_skills_dir: ".openclaude/skills",
            relative_detect_dir: ".openclaude",
        },
        ToolAdapter {
            id: ToolId::OpenHands,
            display_name: "OpenHands",
            relative_skills_dir: ".openhands/skills",
            relative_detect_dir: ".openhands",
        },
        ToolAdapter {
            id: ToolId::Pi,
            display_name: "Pi",
            relative_skills_dir: ".pi/agent/skills",
            relative_detect_dir: ".pi",
        },
        ToolAdapter {
            id: ToolId::Qoder,
            display_name: "Qoder",
            relative_skills_dir: ".qoder/skills",
            relative_detect_dir: ".qoder",
        },
        ToolAdapter {
            id: ToolId::QoderWork,
            display_name: "QoderWork",
            relative_skills_dir: ".qoderwork/skills",
            relative_detect_dir: ".qoderwork",
        },
        ToolAdapter {
            id: ToolId::QwenCode,
            display_name: "Qwen Code",
            relative_skills_dir: ".qwen/skills",
            relative_detect_dir: ".qwen",
        },
        ToolAdapter {
            id: ToolId::Trae,
            display_name: "Trae",
            relative_skills_dir: ".trae/skills",
            relative_detect_dir: ".trae",
        },
        ToolAdapter {
            id: ToolId::TraeCn,
            display_name: "Trae CN",
            relative_skills_dir: ".trae-cn/skills",
            relative_detect_dir: ".trae-cn",
        },
        ToolAdapter {
            id: ToolId::Zencoder,
            display_name: "Zencoder",
            relative_skills_dir: ".zencoder/skills",
            relative_detect_dir: ".zencoder",
        },
        ToolAdapter {
            id: ToolId::Neovate,
            display_name: "Neovate",
            relative_skills_dir: ".neovate/skills",
            relative_detect_dir: ".neovate",
        },
        ToolAdapter {
            id: ToolId::Pochi,
            display_name: "Pochi",
            relative_skills_dir: ".pochi/skills",
            relative_detect_dir: ".pochi",
        },
        ToolAdapter {
            id: ToolId::AdaL,
            display_name: "AdaL",
            relative_skills_dir: ".adal/skills",
            relative_detect_dir: ".adal",
        },
        ToolAdapter {
            id: ToolId::KiloCode,
            display_name: "Kilo Code",
            relative_skills_dir: ".kilocode/skills",
            relative_detect_dir: ".kilocode",
        },
        ToolAdapter {
            id: ToolId::RooCode,
            display_name: "Roo Code",
            relative_skills_dir: ".roo/skills",
            relative_detect_dir: ".roo",
        },
        ToolAdapter {
            id: ToolId::Goose,
            display_name: "Goose",
            relative_skills_dir: ".config/goose/skills",
            relative_detect_dir: ".config/goose",
        },
        ToolAdapter {
            id: ToolId::GeminiCli,
            display_name: "Gemini CLI",
            relative_skills_dir: ".gemini/skills",
            relative_detect_dir: ".gemini",
        },
        ToolAdapter {
            id: ToolId::GithubCopilot,
            display_name: "GitHub Copilot",
            relative_skills_dir: ".copilot/skills",
            relative_detect_dir: ".copilot",
        },
        ToolAdapter {
            id: ToolId::Clawdbot,
            display_name: "Clawdbot",
            relative_skills_dir: ".clawdbot/skills",
            relative_detect_dir: ".clawdbot",
        },
        ToolAdapter {
            id: ToolId::Droid,
            display_name: "Droid",
            relative_skills_dir: ".factory/skills",
            relative_detect_dir: ".factory",
        },
        ToolAdapter {
            id: ToolId::Windsurf,
            display_name: "Windsurf",
            relative_skills_dir: ".codeium/windsurf/skills",
            relative_detect_dir: ".codeium/windsurf",
        },
        ToolAdapter {
            id: ToolId::Moltbot,
            display_name: "MoltBot",
            relative_skills_dir: ".moltbot/skills",
            relative_detect_dir: ".moltbot",
        },
    ]
}
