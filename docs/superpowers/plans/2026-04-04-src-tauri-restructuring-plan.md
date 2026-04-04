# src-tauri 目录架构重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `src-tauri/src/` 从混合结构重构为 3 层领域分类架构

**架构：** 按业务领域分为 `domain/`（install/sync/search/explore/manage/shared）、`infra/`（基础设施）、`tool/`（工具适配），测试统一到 `tests/` 目录

**技术栈：** Rust (Edition 2021), Tauri 2

---

## 文件变更概览

### 新建目录

| 目录 | 用途 |
|------|------|
| `src-tauri/src/core/domain/install/` | 安装领域 |
| `src-tauri/src/core/domain/sync/` | 同步领域 |
| `src-tauri/src/core/domain/search/` | 搜索领域 |
| `src-tauri/src/core/domain/explore/` | 发现领域 |
| `src-tauri/src/core/domain/manage/` | 管理领域 |
| `src-tauri/src/core/domain/shared/` | 共享领域 |
| `src-tauri/src/core/infra/` | 基础设施层 |
| `src-tauri/src/core/tool/` | 工具适配层 |
| `src-tauri/tests/` | 集成测试 |

### 文件迁移（15 个核心模块）

| 原路径 | 新路径 |
|--------|--------|
| `core/installer.rs` | `core/domain/install/installer.rs` |
| `core/sync_engine.rs` | `core/domain/sync/sync_engine.rs` |
| `core/git_fetcher.rs` | `core/domain/sync/git_fetcher.rs` |
| `core/github_search.rs` | `core/domain/search/github_search.rs` |
| `core/skills_search.rs` | `core/domain/search/skills_search.rs` |
| `core/featured_skills.rs` | `core/domain/explore/featured_skills.rs` |
| `core/github_download.rs` | `core/domain/explore/github_download.rs` |
| `core/skill_store.rs` | `core/domain/manage/skill_store.rs` |
| `core/skill_files.rs` | `core/domain/manage/skill_files.rs` |
| `core/onboarding.rs` | `core/domain/manage/onboarding.rs` |
| `core/content_hash.rs` | `core/domain/shared/content_hash.rs` |
| `core/central_repo.rs` | `core/domain/shared/central_repo.rs` |
| `core/cache_cleanup.rs` | `core/infra/cache_cleanup.rs` |
| `core/temp_cleanup.rs` | `core/infra/temp_cleanup.rs` |
| `core/cancel_token.rs` | `core/infra/cancel_token.rs` |

### 测试迁移（11 个测试）

| 原路径 | 新路径 |
|--------|--------|
| `core/tests/central_repo.rs` | `tests/central_repo_test.rs` |
| `core/tests/content_hash.rs` | `tests/content_hash_test.rs` |
| `core/tests/featured_skills.rs` | `tests/featured_skills_test.rs` |
| `core/tests/git_fetcher.rs` | `tests/git_fetcher_test.rs` |
| `core/tests/github_search.rs` | `tests/github_search_test.rs` |
| `core/tests/onboarding.rs` | `tests/onboarding_test.rs` |
| `core/tests/skill_store.rs` | `tests/skill_store_test.rs` |
| `core/tests/skills_search.rs` | `tests/skills_search_test.rs` |
| `core/tests/sync_engine.rs` | `tests/sync_engine_test.rs` |
| `core/tests/temp_cleanup.rs` | `tests/temp_cleanup_test.rs` |
| `core/tests/tool_adapters.rs` | `tests/tool_adapters_test.rs` |

### 需更新模块入口（删除 mod.rs，改用 lib.rs/mod.rs）

| 原文件 | 新文件 | 变化 |
|--------|--------|------|
| `core/mod.rs` | `core/lib.rs` | 转换为 lib.rs |
| `core/tool_adapters/mod.rs` | `core/tool/mod.rs` | 移除嵌套 |
| 各领域子模块 | `domain/*/mod.rs` | 新建聚合 mod.rs |
| - | `core/infra/mod.rs` | 新建聚合 mod.rs |

---

## 任务清单

### Phase 1: 创建目录结构和 lib.rs

- [ ] **1.1 创建 core/lib.rs**

**文件：**
- 创建：`src-tauri/src/core/lib.rs`

```rust
pub mod domain;
pub mod infra;
pub mod tool;

pub use domain::install::installer;
pub use domain::sync::{sync_engine, git_fetcher};
pub use domain::search::{github_search, skills_search};
pub use domain::explore::{featured_skills, github_download};
pub use domain::manage::{skill_store, skill_files, onboarding};
pub use domain::shared::{content_hash, central_repo};
pub use infra::{cache_cleanup, temp_cleanup, cancel_token};
pub use tool::{tool_id, tool_data, tool_detection, tool_registry};

pub const IGNORE_NAMES: &[&str] = &[".git", ".DS_Store", "Thumbs.db", ".gitignore"];

pub fn now_ms() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
```

- [ ] **1.2 创建 core/domain/mod.rs**

**文件：**
- 创建：`src-tauri/src/core/domain/mod.rs`

```rust
pub mod install;
pub mod sync;
pub mod search;
pub mod explore;
pub mod manage;
pub mod shared;
```

- [ ] **1.3 创建核心领域 mod.rs 文件**

**文件：**
- 创建：`src-tauri/src/core/domain/install/mod.rs`
- 创建：`src-tauri/src/core/domain/sync/mod.rs`
- 创建：`src-tauri/src/core/domain/search/mod.rs`
- 创建：`src-tauri/src/core/domain/explore/mod.rs`
- 创建：`src-tauri/src/core/domain/manage/mod.rs`
- 创建：`src-tauri/src/core/domain/shared/mod.rs`

**每个文件内容类似：**
```rust
pub mod installer; // 或对应模块名
```

- [ ] **1.4 创建 core/infra/mod.rs**

**文件：**
- 创建：`src-tauri/src/core/infra/mod.rs`

```rust
pub mod cache_cleanup;
pub mod temp_cleanup;
pub mod cancel_token;
```

- [ ] **1.5 创建 core/tool/mod.rs**

**文件：**
- 创建：`src-tauri/src/core/tool/mod.rs`

```rust
#![allow(unused_imports)]

pub mod tool_data;
pub mod tool_detection;
pub mod tool_id;
pub mod tool_registry;

pub use tool_data::{default_tool_adapters, DetectedSkill, ToolAdapter};
pub use tool_detection::{
    is_tool_installed, resolve_default_path, resolve_detect_path, scan_tool_dir,
};
pub use tool_id::ToolId;
pub use tool_registry::{adapter_by_key, adapters_sharing_skills_dir};
```

---

### Phase 2: 迁移核心模块文件

- [ ] **2.1 迁移 install 领域**

**文件：**
- 创建：`src-tauri/src/core/domain/install/installer.rs`
- 内容：从 `core/installer.rs` 迁移，注意更新内部 `mod core` 引用为 `use crate::core`

- [ ] **2.2 迁移 sync 领域**

**文件：**
- 创建：`src-tauri/src/core/domain/sync/sync_engine.rs`
- 创建：`src-tauri/src/core/domain/sync/git_fetcher.rs`
- 更新内部 `use core::` 引用

- [ ] **2.3 迁移 search 领域**

**文件：**
- 创建：`src-tauri/src/core/domain/search/github_search.rs`
- 创建：`src-tauri/src/core/domain/search/skills_search.rs`

- [ ] **2.4 迁移 explore 领域**

**文件：**
- 创建：`src-tauri/src/core/domain/explore/featured_skills.rs`
- 创建：`src-tauri/src/core/domain/explore/github_download.rs`

- [ ] **2.5 迁移 manage 领域**

**文件：**
- 创建：`src-tauri/src/core/domain/manage/skill_store.rs`
- 创建：`src-tauri/src/core/domain/manage/skill_files.rs`
- 创建：`src-tauri/src/core/domain/manage/onboarding.rs`

- [ ] **2.6 迁移 shared 领域**

**文件：**
- 创建：`src-tauri/src/core/domain/shared/content_hash.rs`
- 创建：`src-tauri/src/core/domain/shared/central_repo.rs`

- [ ] **2.7 迁移 infra 层**

**文件：**
- 创建：`src-tauri/src/core/infra/cache_cleanup.rs`
- 创建：`src-tauri/src/core/infra/temp_cleanup.rs`
- 创建：`src-tauri/src/core/infra/cancel_token.rs`

- [ ] **2.8 迁移 tool 层**

**文件：**
- 创建：`src-tauri/src/core/tool/tool_data.rs`
- 创建：`src-tauri/src/core/tool/tool_detection.rs`
- 创建：`src-tauri/src/core/tool/tool_id.rs`
- 创建：`src-tauri/src/core/tool/tool_registry.rs`

**注意：** 更新 `tool_data.rs` 中的 `pub use crate::core::tool_adapters::tool_id::ToolId;` 为 `pub use super::tool_id::ToolId;`

---

### Phase 3: 迁移测试到 tests/

- [ ] **3.1 创建 tests/common/mod.rs（如需要）**

**文件：**
- 创建：`src-tauri/tests/common/mod.rs`（如测试需要共享代码）

- [ ] **3.2 迁移各领域测试**

**文件：**
- 创建：`src-tauri/tests/central_repo_test.rs`（原 `core/tests/central_repo.rs`）
- 创建：`src-tauri/tests/content_hash_test.rs`
- 创建：`src-tauri/tests/featured_skills_test.rs`
- 创建：`src-tauri/tests/git_fetcher_test.rs`
- 创建：`src-tauri/tests/github_search_test.rs`
- 创建：`src-tauri/tests/onboarding_test.rs`
- 创建：`src-tauri/tests/skill_store_test.rs`
- 创建：`src-tauri/tests/skills_search_test.rs`
- 创建：`src-tauri/tests/sync_engine_test.rs`
- 创建：`src-tauri/tests/temp_cleanup_test.rs`
- 创建：`src-tauri/tests/tool_adapters_test.rs`

**注意：** 测试文件需更新 `mod` 引用路径。例如：
```rust
// 原 core/tests/skill_store.rs
#[path = "../skill_store.rs"]
mod skill_store; // 删除这行，改为直接 use

use crate::core::skill_store::SkillStore; // 直接引用
```

---

### Phase 4: 更新 lib.rs 和删除旧文件

- [ ] **4.1 更新 src-tauri/src/lib.rs**

**文件：**
- 修改：`src-tauri/src/lib.rs`

将 `mod core;` 改为引用新的 `core::lib`
（Rust 2018+ 风格下 `mod core` 会自动找 `core/lib.rs` 或 `core/mod.rs`）

```rust
// 确保 lib.rs 位于 src/core/lib.rs
mod commands;
mod core; // 这个仍然有效，因为 core/lib.rs 存在
```

- [ ] **4.2 更新 src-tauri/src/commands/mod.rs**

**文件：**
- 修改：`src-tauri/src/commands/mod.rs`

更新 `use core::` 路径引用为新结构。例如：
```rust
// 原
use core::skill_store::{default_db_path, migrate_legacy_db_if_needed, SkillStore};
use core::installer::backfill_skill_descriptions;

// 改为
use crate::core::skill_store::{default_db_path, migrate_legacy_db_if_needed, SkillStore};
use crate::core::domain::install::installer::backfill_skill_descriptions;
// 或通过 lib.rs 重新导出
```

- [ ] **4.3 删除旧模块文件**

**文件：**
- 删除：`src-tauri/src/core/mod.rs`
- 删除：`src-tauri/src/core/tool_adapters/mod.rs`
- 删除：`src-tauri/src/core/installer.rs`
- 删除：`src-tauri/src/core/sync_engine.rs`
- 删除：`src-tauri/src/core/git_fetcher.rs`
- 删除：`src-tauri/src/core/github_search.rs`
- 删除：`src-tauri/src/core/skills_search.rs`
- 删除：`src-tauri/src/core/featured_skills.rs`
- 删除：`src-tauri/src/core/github_download.rs`
- 删除：`src-tauri/src/core/skill_store.rs`
- 删除：`src-tauri/src/core/skill_files.rs`
- 删除：`src-tauri/src/core/onboarding.rs`
- 删除：`src-tauri/src/core/content_hash.rs`
- 删除：`src-tauri/src/core/central_repo.rs`
- 删除：`src-tauri/src/core/cache_cleanup.rs`
- 删除：`src-tauri/src/core/temp_cleanup.rs`
- 删除：`src-tauri/src/core/cancel_token.rs`
- 删除：`src-tauri/src/core/tool_adapters/tool_data.rs`
- 删除：`src-tauri/src/core/tool_adapters/tool_detection.rs`
- 删除：`src-tauri/src/core/tool_adapters/tool_id.rs`
- 删除：`src-tauri/src/core/tool_adapters/tool_registry.rs`
- 删除：`src-tauri/src/core/tests/` 目录及所有文件

---

### Phase 5: 验证

- [ ] **5.1 运行 cargo check**

```bash
cd src-tauri && cargo check
```

- [ ] **5.2 运行 cargo test**

```bash
cd src-tauri && cargo test
```

- [ ] **5.3 运行 npm run check**

```bash
npm run check
```

---

## 关键注意事项

1. **模块路径更新**：每个迁移的文件需要更新内部 `use` 路径
2. **`pub use` 重新导出**：在 `core/lib.rs` 中重新导出以便外部（如 `commands/`）引用
3. **测试路径**：`#[path]` 属性不再需要，测试直接 `use crate::core::`
4. **lib.rs vs mod.rs**：核心模块入口使用 `lib.rs`，子模块聚合使用 `mod.rs`

## 验证清单

- [ ] `cargo check` 通过
- [ ] `cargo test` 通过
- [ ] `npm run check` 通过
- [ ] 所有 Tauri 命令仍可正常调用
