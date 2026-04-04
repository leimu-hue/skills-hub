# src-tauri 目录架构重构设计

**日期**: 2026-04-04
**状态**: 已批准
**目标**: 优化 `src-tauri/src/` 目录结构，提升可维护性

## 背景

当前 `src-tauri/src/` 存在以下问题：
- `mod.rs` 多层嵌套，增加路由复杂度
- 测试散落在 `core/tests/` 子目录，通过 `#[path]` 引用，不符合 Rust 标准
- `commands/` 和 `core/` 两层模块树，层级偏深
- `tool_adapters/` 嵌套过深（4 层才能到达具体文件）

## 设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 模块层级深度 | 3 层精细分类 | 支持未来扩展 |
| 测试组织 | 集成测试独立到 `tests/` | Rust 标准位置 |
| 重构优先级 | 可维护性优先 | 减少认知负担 |

## 目标结构

```
src-tauri/src/
├── main.rs
├── lib.rs                    # 入口
├── commands/                 # Layer 1: Tauri 命令边界
│   ├── mod.rs               # 聚合导出所有命令
│   ├── cache_cmds.rs
│   ├── skill_cmds.rs
│   ├── sync_cmds.rs
│   ├── explore_cmds.rs
│   ├── github_cmds.rs
│   ├── managed_skills_cmds.rs
│   ├── central_repo_cmds.rs
│   ├── skill_files_cmds.rs
│   ├── meta_cmds.rs
│   └── close_splashscreen_cmds.rs
├── core/                     # Layer 2: 核心业务模块
│   ├── lib.rs               # core 模块入口，公共导出
│   ├── domain/              # Layer 3: 业务领域
│   │   ├── install/         # 安装领域
│   │   │   ├── mod.rs
│   │   │   └── installer.rs
│   │   ├── sync/            # 同步领域
│   │   │   ├── mod.rs
│   │   │   ├── sync_engine.rs
│   │   │   └── git_fetcher.rs
│   │   ├── search/          # 搜索领域
│   │   │   ├── mod.rs
│   │   │   ├── github_search.rs
│   │   │   └── skills_search.rs
│   │   ├── explore/         # 发现领域
│   │   │   ├── mod.rs
│   │   │   ├── featured_skills.rs
│   │   │   └── github_download.rs
│   │   ├── manage/          # 管理领域
│   │   │   ├── mod.rs
│   │   │   ├── skill_store.rs
│   │   │   ├── skill_files.rs
│   │   │   └── onboarding.rs
│   │   └── shared/          # 共享领域
│   │       ├── mod.rs
│   │       ├── content_hash.rs
│   │       └── central_repo.rs
│   ├── infra/               # 基础设施层
│   │   ├── mod.rs
│   │   ├── cache_cleanup.rs
│   │   ├── temp_cleanup.rs
│   │   └── cancel_token.rs
│   └── tool/                # 工具适配层
│       ├── mod.rs
│       ├── tool_id.rs
│       ├── tool_data.rs
│       ├── tool_detection.rs
│       └── tool_registry.rs
└── tests/                    # 集成测试（Rust 标准位置）
    ├── central_repo_test.rs
    ├── content_hash_test.rs
    ├── featured_skills_test.rs
    ├── git_fetcher_test.rs
    ├── github_search_test.rs
    ├── onboarding_test.rs
    ├── skill_store_test.rs
    ├── skills_search_test.rs
    ├── sync_engine_test.rs
    ├── temp_cleanup_test.rs
    └── tool_adapters_test.rs
```

## 层级职责

| 层级 | 目录 | 职责 |
|------|------|------|
| Layer 1 | `commands/` | Tauri IPC 命令入口，负责 DTO 映射和错误格式化 |
| Layer 2 | `core/domain/` | 业务领域逻辑，按职责分组 |
| Layer 2 | `core/infra/` | 可复用的基础设施（缓存、临时文件、取消令牌） |
| Layer 2 | `core/tool/` | AI 工具适配器（42 个工具的检测和同步） |

## 领域分组

| 领域 | 模块 | 说明 |
|------|------|------|
| **install** | `installer.rs` | 本地/Git 安装逻辑 |
| **sync** | `sync_engine.rs`, `git_fetcher.rs` | 技能同步到工具目录 |
| **search** | `github_search.rs`, `skills_search.rs` | GitHub 搜索 |
| **explore** | `featured_skills.rs`, `github_download.rs` | 精选技能和下载 |
| **manage** | `skill_store.rs`, `skill_files.rs`, `onboarding.rs` | 技能存储和文件读取 |
| **shared** | `content_hash.rs`, `central_repo.rs` | 各领域共享的类型 |
| **infra** | `cache_cleanup.rs`, `temp_cleanup.rs`, `cancel_token.rs` | 清理和生命周期管理 |

## 测试迁移

| 原位置 | 新位置 | 说明 |
|--------|--------|------|
| `core/tests/*.rs` | `tests/*.rs` | 迁移并重命名为 `*_test.rs` |
| `core/tool_adapters/mod.rs` 内的 `#[path]` 测试 | `tests/tool_adapters_test.rs` | 独立集成测试 |

## mod.rs 处理

| 原文件 | 新文件 | 变化 |
|--------|--------|------|
| `commands/mod.rs` | 保留 `commands/mod.rs` | 聚合导出，职责不变 |
| `core/mod.rs` | `core/lib.rs` | 转换为 lib.rs |
| `core/tool_adapters/mod.rs` | `core/tool/mod.rs` | 移除嵌套，合并到 `core/tool/mod.rs` |

## 迁移步骤

1. 创建新目录结构（`core/domain/`, `core/infra/`, `core/tool/`, `tests/`）
2. 迁移 `core/domain/` 各领域模块
3. 迁移 `core/infra/` 模块
4. 迁移 `core/tool/` 模块
5. 迁移 `tests/` 集成测试
6. 更新 `lib.rs` 和各 `mod.rs` 的模块声明
7. 删除旧的 `core/tests/` 目录
8. 运行 `cargo check` 验证

## 验证清单

- [ ] `cargo check` 通过
- [ ] `cargo test` 通过
- [ ] 所有命令仍可通过 `tauri::generate_handler!` 正常调用
- [ ] `npm run check` 通过（lint + build）
