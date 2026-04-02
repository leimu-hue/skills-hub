# Skills Hub - Project Rules

## Overview

Skills Hub is a cross-platform desktop app built with Tauri 2 and React for managing AI Agent Skills and syncing them to many AI coding tools. Core concept: "Install once, sync everywhere."

## Tech Stack

- **Frontend**: React 19 + TypeScript 6 (strict) + Vite 8 + Tailwind CSS 4
- **Backend**: Rust (Edition 2021, MSRV 1.77.2) + Tauri 2
- **Database**: SQLite (`rusqlite`, bundled)
- **Git**: `git2` + vendored OpenSSL
- **HTTP**: `reqwest` with `rustls-tls` (blocking in core services)
- **Routing / Rendering**: React + Tauri IPC
- **i18n**: `i18next` (English / Chinese bilingual)
- **Notifications**: `sonner`
- **Markdown / Preview**: `react-markdown` + `remark-gfm`
- **Icons**: `lucide-react`

## Common Commands

```bash
npm run dev                         # Vite dev server (port 5173, strictPort)
npm run tauri:dev                   # Tauri dev window
npm run build                       # tsc -b + vite build
npm run lint                        # ESLint
npm run check                       # lint + build + rust fmt/clippy/test
npm run preview                     # Preview built frontend
npm run rust:test                   # cargo test
npm run rust:clippy                 # cargo clippy --all-targets --all-features -D warnings
npm run rust:fmt                    # cargo fmt --all
npm run rust:fmt:check              # cargo fmt --all -- --check
npm run version:check               # Verify package.json and tauri.conf.json versions match
npm run tauri:build                 # Production Tauri build
npm run tauri:build:win:exe         # Windows NSIS bundle
npm run tauri:build:win:msi         # Windows MSI bundle
npm run tauri:build:linux:deb       # Linux deb bundle
npm run tauri:build:linux:appimage  # Linux AppImage bundle
npm run tauri:build:mac:dmg         # macOS dmg bundle
```

Always run `npm run check` before committing.

## Directory Structure

```text
src/
├── App.tsx                         # Root app shell, view switching, modal orchestration, update flow
├── App.css                         # Global component styles
├── index.css                       # Theme variables + Tailwind entry
├── main.tsx                        # Frontend bootstrap
├── assets/
├── components/
│   ├── Layout.tsx
│   └── skills/
│       ├── Header.tsx
│       ├── components/            # Reusable skills UI pieces
│       │   ├── FilterBar.tsx
│       │   ├── LoadingOverlay.tsx
│       │   ├── SkillCard.tsx
│       │   ├── SkillDetailView.tsx
│       │   └── SkillsList.tsx
│       ├── modals/                # Add/import/delete/pick/shared-dir dialogs
│       ├── pages/                 # ExplorePage / SettingsPage
│       ├── ExplorePage.tsx        # Legacy compatibility export, prefer pages/
│       ├── SettingsPage.tsx       # Legacy compatibility export, prefer pages/
│       ├── FilterBar.tsx          # Legacy compatibility export, prefer components/
│       ├── LoadingOverlay.tsx     # Legacy compatibility export, prefer components/
│       ├── SkillCard.tsx          # Legacy compatibility export, prefer components/
│       ├── SkillDetailView.tsx    # Legacy compatibility export, prefer components/
│       ├── SkillsList.tsx         # Legacy compatibility export, prefer components/
│       ├── types/
│       │   └── index.ts
│       └── types.ts
├── contexts/
│   ├── AppContext.tsx
│   └── index.ts
├── hooks/
│   ├── useActions.ts
│   ├── useModals.ts
│   ├── useSettings.ts
│   ├── useSkills.ts
│   ├── useTheme.ts
│   └── index.ts
├── i18n/
│   ├── index.ts
│   └── resources.ts
├── pages/
│   └── Dashboard.tsx
└── types/
    └── index.ts                  # Frontend DTOs mirrored from Tauri commands

src-tauri/src/
├── main.rs                        # Entry point, calls app_lib::run
├── lib.rs                         # Tauri builder, plugin registration, DB setup, cleanup tasks
├── commands/
│   ├── mod.rs                     # Tauri command layer (currently 30 commands + DTOs)
│   └── tests/
└── core/
    ├── cache_cleanup.rs
    ├── cancel_token.rs            # Cancellation support for long-running operations
    ├── central_repo.rs
    ├── content_hash.rs
    ├── featured_skills.rs         # Featured skills data source / cache
    ├── git_fetcher.rs
    ├── github_download.rs
    ├── github_search.rs
    ├── installer.rs
    ├── onboarding.rs
    ├── skill_files.rs             # Skill file listing / reading for detail view
    ├── skill_store.rs             # SQLite ORM and settings persistence
    ├── skills_search.rs           # Online skills search
    ├── sync_engine.rs
    ├── temp_cleanup.rs
    ├── tool_adapters/
    │   └── mod.rs                 # Tool adapter registry (currently 42 tools)
    └── tests/                     # One test file per core module

scripts/                           # Versioning and packaging helper scripts
docs/                              # Project documentation
featured-skills.json               # Featured skills dataset bundled with the repo
```

## Architecture

### Frontend ↔ Backend Communication

- Frontend uses Tauri IPC via `invoke(...)`.
- Backend commands live in `src-tauri/src/commands/mod.rs` and must also be registered in `src-tauri/src/lib.rs` inside `generate_handler!`.
- Frontend DTOs live in `src/types/index.ts` and must stay aligned with Rust DTOs in `commands/mod.rs`.
- When adding a new command, update all of: Rust command, registration, frontend invoke site, DTOs, and translations if UI text changes.

### Frontend Organization

- `App.tsx` is still the main orchestration layer, but state is now split with custom hooks such as `useSkills`, `useSettings`, `useTheme`, and `useModals`.
- `contexts/AppContext.tsx` defines shared app state contracts; check whether an existing hook or context should own new state before adding more top-level `useState`.
- Skills UI is organized by feature under `src/components/skills/`, with `components/`, `pages/`, and `modals/` subfolders.
- Data refresh pattern is still to re-fetch from Tauri after mutating operations, especially via `loadManagedSkills()`.

### Backend Layering

- `commands/` is the Tauri boundary: DTO mapping, command signatures, async wrapping, and frontend-facing error formatting.
- `core/` contains business logic and should remain independently testable.
- Long-running synchronous work is wrapped with `tauri::async_runtime::spawn_blocking`.
- Shared app state is injected with `app.manage(...)`, notably `SkillStore` and `Arc<CancelToken>`.

### Error Handling

- Backend uses `anyhow::Result<T>` internally and converts errors to strings with `format_anyhow_error()`.
- Frontend logic relies on prefixed backend errors for special flows, including `MULTI_SKILLS|`, `TARGET_EXISTS|`, `TOOL_NOT_INSTALLED|`, `TOOL_NOT_WRITABLE|`, and cancellation signaling.
- Frontend surfaces operational errors with `sonner` toasts and sometimes custom follow-up UI.

## Coding Conventions

### TypeScript

- Strict mode is enabled. Treat unused locals/params and type drift as build-breaking.
- Component files use PascalCase.
- Props types use `ComponentNameProps`.
- CSS class names use kebab-case.
- Modal components should still use `if (!open) return null` for full unmounting.
- Keep user-facing text in i18n resources. Any new text must include both English and Chinese translations.
- Prefer existing hooks and shared types over duplicating state logic.
- Keep legacy compatibility re-export files working unless you intentionally migrate all imports.

### Rust

- Functions and methods use snake_case.
- Constants use SCREAMING_SNAKE_CASE.
- Tauri command parameters exposed to the frontend use camelCase where needed.
- Add `anyhow::Context` to non-trivial fallible operations.
- Export new core modules from `src-tauri/src/core/mod.rs`.
- Add or update focused tests in `src-tauri/src/core/tests/` or `src-tauri/src/commands/tests/`.

### Styling

- Global component styling lives in `src/App.css`.
- Theme variables and dark mode tokens live in `src/index.css`.
- Tailwind utilities and semantic CSS classes are both used; follow surrounding patterns instead of forcing one style.

## Development Workflow

1. Before implementing, briefly describe the approach and list the files to be modified. Wait for confirmation before writing code.
2. Implement features end-to-end. If a change touches frontend and backend, update both sides in one pass.
3. Keep DTOs, command registration, translations, and any affected tests in sync.
4. Run `npm run check` after implementation and fix failures before presenting the result.
5. Keep changes minimal. Do not refactor or clean up unrelated code unless explicitly requested.

## Important Notes

- Path handling must support `~` expansion through backend helpers such as `expand_home_path()`.
- Sync strategy uses fallback order: symlink -> junction on Windows -> copy.
- Some tools share the same skills directory; check shared-dir behavior before changing sync or unsync flows.
- Version numbers must stay in sync between `package.json` and `src-tauri/tauri.conf.json`; validate with `npm run version:check`.
- Rust crate name is `app_lib`; use `app_lib::...` imports where applicable.
- Database initialization includes legacy migration support via `migrate_legacy_db_if_needed`; schema changes must account for upgrades.
- Tool definitions live in `src-tauri/src/core/tool_adapters/mod.rs`; adding a new tool requires a `ToolId` variant, adapter entry, and any shared-directory handling.
- `featured-skills.json` and the related backend modules power the Explore experience; keep repository data format and DTOs aligned if you change featured skills behavior.
