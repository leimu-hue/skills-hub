# 代码拆分实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `commands/mod.rs`（957行）和 `tool_adapters/mod.rs`（530行）按功能领域/职责拆分为小而专注的模块

**架构：** Phase 1 拆分 tool_adapters（tool_id、tool_data、tool_registry、tool_detection），Phase 2 拆分 commands（skill_cmds、sync_cmds 等 9 个子模块），最后聚合到各自的 mod.rs

**技术栈：** Rust (Edition 2021), Tauri 2

---

## 文件结构

### Phase 1: tool_adapters 拆分

```
src-tauri/src/core/tool_adapters/
├── mod.rs              # 聚合 re-export（新建）
├── tool_id.rs          # ToolId 枚举 + as_key()（新建）
├── tool_data.rs        # ToolAdapter/DetectedSkill + default_tool_adapters()（新建）
├── tool_registry.rs    # 缓存 + adapter_by_key() + adapters_sharing_skills_dir()（新建）
└── tool_detection.rs   # 检测/扫描函数（新建）
```

### Phase 2: commands 拆分

```
src-tauri/src/commands/
├── mod.rs                   # 聚合 re-export + 公共 DTOs（改造自现有）
├── skill_cmds.rs            # 技能安装命令（新建）
├── sync_cmds.rs             # 同步命令（新建）
├── cache_cmds.rs            # 缓存配置命令（新建）
├── central_repo_cmds.rs     # 中央仓库命令（新建）
├── github_cmds.rs           # GitHub 命令（新建）
├── managed_skills_cmds.rs   # 托管技能命令（新建）
├── explore_cmds.rs          # 探索命令（新建）
├── skill_files_cmds.rs      # 技能文件命令（新建）
└── meta_cmds.rs             # 元命令（新建）
```

---

## 实施任务

### Phase 1: 拆分 tool_adapters

#### 任务 1：创建 tool_id.rs

**文件：**
- 创建：`src-tauri/src/core/tool_adapters/tool_id.rs`

- [ ] **步骤 1：创建 tool_id.rs，迁移 ToolId 枚举**

```rust
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use anyhow::{Context, Result};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ToolId {
    Cursor,
    ClaudeCode,
    Codex,
    // ... (所有 42 个变体)
}

impl ToolId {
    pub fn as_key(&self) -> &'static str {
        match self {
            ToolId::Cursor => "cursor",
            // ... (所有 match arm)
        }
    }
}
```

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/core/tool_adapters/tool_id.rs
git commit -m "refactor(tool_adapters): extract ToolId to tool_id.rs"
```

---

#### 任务 2：创建 tool_data.rs

**文件：**
- 创建：`src-tauri/src/core/tool_adapters/tool_data.rs`

- [ ] **步骤 1：创建 tool_data.rs，迁移 ToolAdapter、DetectedSkill 和 default_tool_adapters()**

```rust
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

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
        // ... (所有 42 个工具适配器)
    ]
}
```

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/core/tool_adapters/tool_data.rs
git commit -m "refactor(tool_adapters): extract ToolAdapter data to tool_data.rs"
```

---

#### 任务 3：创建 tool_registry.rs

**文件：**
- 创建：`src-tauri/src/core/tool_adapters/tool_registry.rs`

- [ ] **步骤 1：创建 tool_registry.rs，迁移缓存和查询函数**

```rust
use std::collections::HashMap;
use std::sync::OnceLock;

use super::tool_data::default_tool_adapters;
use super::tool_id::ToolId;
use super::{ToolAdapter, ToolId};

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
```

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/core/tool_adapters/tool_registry.rs
git commit -m "refactor(tool_adapters): extract registry to tool_registry.rs"
```

---

#### 任务 4：创建 tool_detection.rs

**文件：**
- 创建：`src-tauri/src/core/tool_adapters/tool_detection.rs`

- [ ] **步骤 1：创建 tool_detection.rs，迁移检测和扫描函数**

```rust
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

use super::tool_data::ToolAdapter;
use super::{DetectedSkill, ToolId};

pub fn resolve_default_path(adapter: &ToolAdapter) -> Result<PathBuf> {
    let home = dirs::home_dir().context("failed to resolve home directory")?;
    Ok(home.join(adapter.relative_skills_dir))
}

pub fn resolve_detect_path(adapter: &ToolAdapter) -> Result<PathBuf> {
    let home = dirs::home_dir().context("failed to resolve home directory")?;
    Ok(home.join(adapter.relative_detect_dir))
}

pub fn is_tool_installed(adapter: &ToolAdapter) -> Result<bool> {
    Ok(resolve_detect_path(adapter)?.exists())
}

pub fn scan_tool_dir(tool: &ToolAdapter, dir: &Path) -> Result<Vec<DetectedSkill>> {
    // ... 实现
}

fn detect_link(path: &Path) -> (bool, Option<PathBuf>) {
    // ... 实现
}
```

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/core/tool_adapters/tool_detection.rs
git commit -m "refactor(tool_adapters): extract detection to tool_detection.rs"
```

---

#### 任务 5：改造 tool_adapters/mod.rs 为聚合 re-export

**文件：**
- 修改：`src-tauri/src/core/tool_adapters/mod.rs`

- [ ] **步骤 1：将原 mod.rs 改为聚合 re-export**

```rust
mod tool_id;
mod tool_data;
mod tool_registry;
mod tool_detection;

pub use tool_id::{ToolId, ToolIdVariant}; // 根据需要
pub use tool_data::{ToolAdapter, DetectedSkill, default_tool_adapters};
pub use tool_registry::{adapter_by_key, adapters_sharing_skills_dir};
pub use tool_detection::{resolve_default_path, resolve_detect_path, is_tool_installed, scan_tool_dir};

#[cfg(test)]
#[path = "../tests/tool_adapters.rs"]
mod tests;
```

- [ ] **步骤 2：运行 cargo check 验证编译**

运行：`cd src-tauri && cargo check`
预期：无编译错误

- [ ] **步骤 3：Commit**

```bash
git add src-tauri/src/core/tool_adapters/mod.rs
git commit -m "refactor(tool_adapters): split into tool_id, tool_data, tool_registry, tool_detection"
```

---

### Phase 2: 拆分 commands

#### 任务 6：创建 commands/skill_cmds.rs

**文件：**
- 创建：`src-tauri/src/commands/skill_cmds.rs`

- [ ] **步骤 1：迁移 install_local, install_local_selection, install_git, list_git_skills_cmd, install_git_selection, import_existing_skill, update_managed_skill**

从 `commands/mod.rs` 迁移这些命令及相关 DTO（`InstallResultDto`, `UpdateResultDto`）

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/commands/skill_cmds.rs
git commit -m "refactor(commands): extract skill_cmds"
```

---

#### 任务 7：创建 commands/sync_cmds.rs

**文件：**
- 创建：`src-tauri/src/commands/sync_cmds.rs`

- [ ] **步骤 1：迁移 sync_skill_dir, sync_skill_to_tool, unsync_skill_from_tool**

从 `commands/mod.rs` 迁移这些命令及相关 DTO（`SyncResultDto`）

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/commands/sync_cmds.rs
git commit -m "refactor(commands): extract sync_cmds"
```

---

#### 任务 8：创建 commands/cache_cmds.rs

**文件：**
- 创建：`src-tauri/src/commands/cache_cmds.rs`

- [ ] **步骤 1：迁移 get_git_cache_cleanup_days, set_git_cache_cleanup_days, clear_git_cache_now, get_git_cache_ttl_secs, set_git_cache_ttl_secs**

从 `commands/mod.rs` 迁移

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/commands/cache_cmds.rs
git commit -m "refactor(commands): extract cache_cmds"
```

---

#### 任务 9：创建 commands/central_repo_cmds.rs

**文件：**
- 创建：`src-tauri/src/commands/central_repo_cmds.rs`

- [ ] **步骤 1：迁移 get_central_repo_path, set_central_repo_path**

从 `commands/mod.rs` 迁移

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/commands/central_repo_cmds.rs
git commit -m "refactor(commands): extract central_repo_cmds"
```

---

#### 任务 10：创建 commands/github_cmds.rs

**文件：**
- 创建：`src-tauri/src/commands/github_cmds.rs`

- [ ] **步骤 1：迁移 search_github, get_github_token, set_github_token**

从 `commands/mod.rs` 迁移

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/commands/github_cmds.rs
git commit -m "refactor(commands): extract github_cmds"
```

---

#### 任务 11：创建 commands/managed_skills_cmds.rs

**文件：**
- 创建：`src-tauri/src/commands/managed_skills_cmds.rs`

- [ ] **步骤 1：迁移 get_managed_skills, delete_managed_skill, get_managed_skills_impl**

从 `commands/mod.rs` 迁移及相关 DTO（`ManagedSkillDto`, `SkillTargetDto`）

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/commands/managed_skills_cmds.rs
git commit -m "refactor(commands): extract managed_skills_cmds"
```

---

#### 任务 12：创建 commands/explore_cmds.rs

**文件：**
- 创建：`src-tauri/src/commands/explore_cmds.rs`

- [ ] **步骤 1：迁移 get_featured_skills, search_skills_online**

从 `commands/mod.rs` 迁移及相关 DTO（`FeaturedSkillDto`, `OnlineSkillDto`）

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/commands/explore_cmds.rs
git commit -m "refactor(commands): extract explore_cmds"
```

---

#### 任务 13：创建 commands/skill_files_cmds.rs

**文件：**
- 创建：`src-tauri/src/commands/skill_files_cmds.rs`

- [ ] **步骤 1：迁移 list_skill_files, read_skill_file**

从 `commands/mod.rs` 迁移及相关 DTO（`SkillFileEntry`）

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/commands/skill_files_cmds.rs
git commit -m "refactor(commands): extract skill_files_cmds"
```

---

#### 任务 14：创建 commands/meta_cmds.rs

**文件：**
- 创建：`src-tauri/src/commands/meta_cmds.rs`

- [ ] **步骤 1：迁移 get_tool_status, get_onboarding_plan, cancel_current_operation**

从 `commands/mod.rs` 迁移及相关 DTO（`ToolInfoDto`, `ToolStatusDto`）

- [ ] **步骤 2：Commit**

```bash
git add src-tauri/src/commands/meta_cmds.rs
git commit -m "refactor(commands): extract meta_cmds"
```

---

#### 任务 15：改造 commands/mod.rs 为聚合 re-export

**文件：**
- 修改：`src-tauri/src/commands/mod.rs`

- [ ] **步骤 1：将原 mod.rs 改为聚合 re-export + 保留公共 DTOs 和工具函数**

```rust
mod skill_cmds;
mod sync_cmds;
mod cache_cmds;
mod central_repo_cmds;
mod github_cmds;
mod managed_skills_cmds;
mod explore_cmds;
mod skill_files_cmds;
mod meta_cmds;

pub use skill_cmds::*;
pub use sync_cmds::*;
pub use cache_cmds::*;
pub use central_repo_cmds::*;
pub use github_cmds::*;
pub use managed_skills_cmds::*;
pub use explore_cmds::*;
pub use skill_files_cmds::*;
pub use meta_cmds::*;

pub use crate::core::tool_adapters::{adapter_by_key, is_tool_installed, resolve_default_path};

// 保留的公共 DTOs 和工具函数
pub struct ToolInfoDto { ... }
pub struct ToolStatusDto { ... }
pub struct InstallResultDto { ... }
pub struct SyncResultDto { ... }
pub struct UpdateResultDto { ... }
pub struct ManagedSkillDto { ... }
pub struct SkillTargetDto { ... }
pub struct FeaturedSkillDto { ... }
pub struct OnlineSkillDto { ... }
pub struct SkillFileEntry { ... }

fn format_anyhow_error(err: anyhow::Error) -> String { ... }
fn expand_home_path(input: &str) -> Result<std::path::PathBuf, anyhow::Error> { ... }
fn remove_path_any(path: &str) -> Result<(), String> { ... }
fn to_install_dto(result: InstallResult) -> InstallResultDto { ... }
fn get_managed_skills_impl(store: &SkillStore) -> Result<Vec<ManagedSkillDto>, String> { ... }
```

- [ ] **步骤 2：运行 cargo check 验证编译**

运行：`cd src-tauri && cargo check`
预期：无编译错误

- [ ] **步骤 3：Commit**

```bash
git add src-tauri/src/commands/mod.rs
git commit -m "refactor(commands): split into 9 submodules"
```

---

### Phase 3: 验证

#### 任务 16：全面验证

- [ ] **步骤 1：运行 cargo check**

运行：`cd src-tauri && cargo check`
预期：PASS

- [ ] **步骤 2：运行 cargo test**

运行：`cd src-tauri && cargo test`
预期：所有测试通过

- [ ] **步骤 3：运行 cargo clippy**

运行：`cd src-tauri && cargo clippy --all-targets --all-features -D warnings`
预期：无警告

- [ ] **步骤 4：运行 cargo fmt**

运行：`cd src-tauri && cargo fmt --all`
预期：代码格式一致

- [ ] **步骤 5：提交最终 commit**

```bash
git add -A && git commit -m "refactor: complete code splitting for commands and tool_adapters"
```

---

## 依赖关系

```
Phase 1 (可独立执行):
  task 1 → task 2 → task 3 → task 4 → task 5

Phase 2 (依赖 Phase 1 完成):
  task 6-14 可并行执行
  task 15 依赖 task 6-14

Phase 3:
  task 16 依赖 Phase 2 完成
```

---

## 注意事项

- 拆分过程中保持所有公开 API 不变
- 保持 DTO 结构不变
- 保持错误处理逻辑不变
- 保持 lib.rs 中的命令注册方式不变
- 测试文件路径保持不变
- 每个任务完成后立即 commit，便于回滚
