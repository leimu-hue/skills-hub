# 代码拆分设计规格

**日期：** 2026-04-02
**目标：** 拆分 `commands/mod.rs` 和 `core/tool_adapters/mod.rs`

## 背景

两个文件承担职责过多：
- `commands/mod.rs`: 957 行，30 个 Tauri 命令 + DTOs
- `tool_adapters/mod.rs`: 530 行，42 个工具 ID 变体 + 适配器注册逻辑

---

## 方案一：`commands/mod.rs` 按功能领域拆分

### 目标结构

```
src-tauri/src/commands/
├── mod.rs                   # 聚合 re-export + 公共 DTOs
├── skill_cmds.rs            # 安装/导入技能相关命令
├── sync_cmds.rs             # 同步到工具相关命令
├── cache_cmds.rs            # Git 缓存清理设置命令
├── central_repo_cmds.rs     # 中央仓库路径管理命令
├── github_cmds.rs           # GitHub token 和搜索命令
├── managed_skills_cmds.rs   # 托管技能列表/删除命令
├── explore_cmds.rs          # Featured skills 和在线搜索命令
├── skill_files_cmds.rs     # 技能文件读取命令
└── meta_cmds.rs             # 工具状态/引导/取消命令
```

### 各模块职责

| 模块 | 命令 | 说明 |
|------|------|------|
| `skill_cmds.rs` | `install_local`, `install_local_selection`, `install_git`, `list_git_skills_cmd`, `install_git_selection`, `import_existing_skill`, `update_managed_skill` | 技能安装、更新 |
| `sync_cmds.rs` | `sync_skill_dir`, `sync_skill_to_tool`, `unsync_skill_from_tool` | 同步/取消同步到工具 |
| `cache_cmds.rs` | `get_git_cache_cleanup_days`, `set_git_cache_cleanup_days`, `clear_git_cache_now`, `get_git_cache_ttl_secs`, `set_git_cache_ttl_secs` | 缓存 TTL 配置 |
| `central_repo_cmds.rs` | `get_central_repo_path`, `set_central_repo_path` | 中央仓库路径 |
| `github_cmds.rs` | `search_github`, `get_github_token`, `set_github_token` | GitHub token 和搜索 |
| `managed_skills_cmds.rs` | `get_managed_skills`, `delete_managed_skill` | 托管技能管理 |
| `explore_cmds.rs` | `get_featured_skills`, `search_skills_online` | 探索功能 |
| `skill_files_cmds.rs` | `list_skill_files`, `read_skill_file` | 技能文件读取 |
| `meta_cmds.rs` | `get_tool_status`, `get_onboarding_plan`, `cancel_current_operation` | 元操作 |

### 保留在 `mod.rs` 中的内容

- DTO 结构体：`ToolInfoDto`, `ToolStatusDto`, `InstallResultDto`, `SyncResultDto`, `UpdateResultDto`, `ManagedSkillDto`, `SkillTargetDto`, `FeaturedSkillDto`, `OnlineSkillDto`, `SkillFileEntry`
- 公共函数：`format_anyhow_error`, `expand_home_path`, `remove_path_any`, `to_install_dto`, `get_managed_skills_impl`
- 聚合 re-export 所有子模块命令

---

## 方案二：`tool_adapters/mod.rs` 按职责分离

### 目标结构

```
src-tauri/src/core/tool_adapters/
├── mod.rs              # 聚合 re-export
├── tool_id.rs          # ToolId 枚举 + as_key()
├── tool_data.rs        # ToolAdapter/DetectedSkill 结构体 + default_tool_adapters()
├── tool_registry.rs    # 缓存 + adapter_by_key() + adapters_sharing_skills_dir()
└── tool_detection.rs   # 检测/扫描函数
```

### 各模块职责

| 模块 | 内容 |
|------|------|
| `tool_id.rs` | `ToolId` 枚举（42 个变体）+ `as_key()` 实现 |
| `tool_data.rs` | `ToolAdapter` 结构体、`DetectedSkill` 结构体、`default_tool_adapters()` 数据定义 |
| `tool_registry.rs` | `ADAPTERS_BY_KEY`、`ADAPTERS_BY_SKILLS_DIR` 缓存 + `cached_adapters_by_key()`、`cached_adapters_by_skills_dir()`、`adapter_by_key()`、`adapters_sharing_skills_dir()` |
| `tool_detection.rs` | `resolve_default_path`、`resolve_detect_path`、`is_tool_installed`、`scan_tool_dir`、`detect_link` |

---

## 实施步骤

### Phase 1: 拆分 `tool_adapters/mod.rs`

1. 创建 `tool_id.rs`，迁移 `ToolId` 枚举和 `as_key()`
2. 创建 `tool_data.rs`，迁移 `ToolAdapter`、`DetectedSkill` 和 `default_tool_adapters()`
3. 创建 `tool_registry.rs`，迁移缓存和查询函数
4. 创建 `tool_detection.rs`，迁移检测和扫描函数
5. 更新 `mod.rs` 为聚合 re-export
6. 更新所有 import 路径

### Phase 2: 拆分 `commands/mod.rs`

1. 创建 `commands/` 目录结构
2. 按功能领域创建各子模块文件
3. 迁移对应的命令实现
4. 更新 `mod.rs` 为聚合 re-export
5. 更新 `lib.rs` 中的 import

### Phase 3: 验证

1. 运行 `cargo check` 确保编译通过
2. 运行 `cargo test` 确保测试通过
3. 运行 `cargo clippy` 确保无 lint 警告
4. 运行 `cargo fmt` 确保格式一致

---

## 约束

- 保持所有公开 API 不变（前端调用方式不变）
- 保持 DTO 结构不变
- 保持错误处理逻辑不变
- 保持 `lib.rs` 中的命令注册方式不变
- 测试文件路径保持不变（`#[path = "../tests/..."]`）
