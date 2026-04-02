# Update Logic Consolidation Design

## Goal

Consolidate frontend app-update behavior into a single state source so the app no longer maintains separate update state machines in `App.tsx` and `SettingsPage.tsx`.

## Current Problem

The frontend currently keeps two overlapping update flows:

- `App.tsx` checks for updates on startup, stores ignored versions, fetches release notes, shows a global modal, and installs updates.
- `SettingsPage.tsx` separately checks for updates, tracks its own install state, and renders a second update flow.

This creates drift risk because the two flows already expose different features and can diverge further over time.

## Design

Use `App.tsx` as the only update state owner for now.

`App.tsx` will continue to own:

- startup update check
- ignored-version handling
- release note fetch state
- update availability
- installing/done state
- update install action

`SettingsPage.tsx` will become a presentational consumer of this state. It will receive update data and callbacks from `App.tsx` and render the update section without maintaining its own update-specific state machine.

## Shared Update State Contract

`App.tsx` will expose a single UI-facing update state contract to `SettingsPage.tsx`.

The allowed states are:

- `idle`: no manual check is in progress and no transient message is being shown in settings
- `checking`: a manual check is currently running
- `up-to-date`: the latest manual check completed and no update is available
- `available`: an update is available for install
- `installing`: download and install are in progress
- `done`: install completed and restart is required
- `error`: the latest manual action failed

State precedence for rendering is:

1. `installing`
2. `done`
3. `error`
4. `available`
5. `checking`
6. `up-to-date`
7. `idle`

Reset rules:

- a successful manual check with no update sets `up-to-date`
- a successful check with an update sets `available`
- starting a new manual check clears prior `error` and `up-to-date`
- starting install clears prior `error`
- install success sets `done`
- install failure sets `error`

The settings page must render directly from this contract and must not derive its own competing update states.

## Scope

### In Scope

- remove duplicated update state from `SettingsPage.tsx`
- pass update status and actions from `App.tsx` into `SettingsPage.tsx`
- keep current global update modal behavior intact
- keep current ignore-version behavior intact
- keep release notes owned by `App.tsx`

### Out of Scope

- extracting a new `useAppUpdate` hook
- changing update UI copy or interaction model beyond what is needed for consolidation
- changing backend or Tauri updater integration

## Component Responsibilities

### `App.tsx`

- remains the single update controller
- derives the UI-facing update state passed into `SettingsPage`
- exposes callbacks for check/install/dismiss behaviors

### `SettingsPage.tsx`

- renders current version and update status
- calls the provided callbacks
- does not import updater APIs directly
- does not keep local update state beyond regular form-local state such as the GitHub token input buffer

## Data Flow

1. `App.tsx` runs the startup update check.
2. `App.tsx` stores update metadata and install status.
3. `App.tsx` passes a flattened update view model plus callbacks into `SettingsPage`.
4. `SettingsPage` renders whatever state it receives.
5. User actions in `SettingsPage` call back into `App.tsx`, which remains the only place that talks to the updater plugin.

## Manual Check Rules

- manual checks triggered from settings must be handled by `App.tsx`
- manual checks must ignore the local "ignored version" suppression used for automatic startup prompting
- if a user manually checks and the ignored version is still the latest version, settings must still show that update as `available`
- manual checks with no update available must show `up-to-date`
- manual check failures must show `error` and allow retry from settings

This keeps startup prompting and manual user intent separate: ignored versions suppress automatic nagging, not explicit user checks.

## Modal And Settings Synchronization

- the global modal and settings section read from the same underlying update data in `App.tsx`
- if an update is available, both surfaces may reflect that availability at the same time
- install started from either surface must move both surfaces into the shared installing/done state
- ignoring or dismissing the global modal only affects whether the modal is shown automatically; it must not erase the update metadata needed by the settings page
- settings should not own a separate dismiss or ignore mechanism in this cleanup

This keeps the modal as the automatic prompt surface while settings remains the manual control surface.

## Release Notes Rules

- `App.tsx` remains the only owner of release-note fetch behavior
- release-note fetch failure must not hide an otherwise valid `available` update state
- updater-check failure and release-note-fetch failure must be treated separately
- `SettingsPage` does not need to render release notes in this cleanup unless already available through the shared state without extra local logic

## Error Handling

- updater failures remain owned by `App.tsx`
- `SettingsPage` only renders error text supplied by `App.tsx`
- no duplicate retry logic in `SettingsPage`

## Testing Strategy

- verify manual check transitions: `idle -> checking -> up-to-date|available|error`
- verify ignored versions still suppress startup prompting but not manual checks
- verify install started from settings uses the shared installing/done state
- verify release-note fetch failure does not block `available`
- verify with `npm test`, `npm run lint`, and `npm run build`

If lightweight automated coverage is added, it should focus on shared state derivation or state transition helpers rather than broad UI snapshot coverage.

## Files

- Modify: `src/App.tsx`
- Modify: `src/components/skills/pages/SettingsPage.tsx`

## Expected Outcome

After this change, the frontend has one update state machine instead of two. `SettingsPage.tsx` becomes a pure consumer of update state, which reduces drift and makes later extraction to a dedicated hook much safer.
