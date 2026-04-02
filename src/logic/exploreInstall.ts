export type ExploreInstallState = {
  gitUrl: string
  autoSelectSkillName: string | null
  syncTargets: Record<string, boolean>
}

export function buildExploreInstallState(options: {
  sourceUrl: string
  skillName?: string
  installedToolIds: string[]
}): ExploreInstallState {
  const syncTargets: Record<string, boolean> = {}
  for (const id of options.installedToolIds) {
    syncTargets[id] = true
  }

  return {
    gitUrl: options.sourceUrl,
    autoSelectSkillName: options.skillName ?? null,
    syncTargets,
  }
}
