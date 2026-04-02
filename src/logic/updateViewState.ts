export type UpdateViewState =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'installing'
  | 'done'
  | 'error'

export function getUpdateViewState(input: {
  isChecking: boolean
  isInstalling: boolean
  isDone: boolean
  error: string | null
  availableVersion: string | null
  manualCheckCompleted: boolean
}): UpdateViewState {
  if (input.isInstalling) return 'installing'
  if (input.isDone) return 'done'
  if (input.error) return 'error'
  if (input.availableVersion) return 'available'
  if (input.isChecking) return 'checking'
  if (input.manualCheckCompleted) return 'up-to-date'
  return 'idle'
}

export function canCheckForUpdatesAgain(state: UpdateViewState): boolean {
  return state === 'idle' || state === 'up-to-date' || state === 'error'
}
