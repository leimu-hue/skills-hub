export function shouldShowUpdateModal(input: {
  availableVersion: string | null
  ignoredVersion: string | null
  checkSource: 'startup' | 'manual'
}): boolean {
  if (!input.availableVersion) return false
  if (input.checkSource === 'manual') return false
  return input.availableVersion !== input.ignoredVersion
}

export function getSettingsAvailableVersion(input: {
  availableVersion: string | null
  ignoredVersion: string | null
}): string | null {
  return input.availableVersion
}

export function shouldShowSharedUpdateModal(input: {
  modalVersion: string | null
  isInstalling: boolean
  isDone: boolean
}): boolean {
  return Boolean(input.modalVersion || input.isInstalling || input.isDone)
}
