import { useCallback } from 'react'
import { toast } from 'sonner'
import type {
  GitSkillCandidate,
  InstallResultDto,
  LocalSkillCandidate,
  ManagedSkill,
  OnboardingPlan,
  ToolOption,
  UpdateResultDto,
} from '../types'

interface UseSkillActionsOptions {
  invokeTauri: <T,>(command: string, args?: Record<string, unknown>) => Promise<T>
  tools: ToolOption[]
  syncTargets: Record<string, boolean>
  isInstalled: (id: string) => boolean
  uniqueToolIdsBySkillsDir: (toolIds: string[]) => string[]
  sharedToolIdsByToolId: Record<string, string[]>
  isSkillNameTaken: (name: string) => boolean
  loadManagedSkills: () => Promise<void>
  setLoading: (loading: boolean) => void
  setLoadingStartAt: (loadingStartAt: number | null) => void
  setError: (error: string | null) => void
  setActionMessage: (message: string | null) => void
  setSuccessToastMessage: (message: string | null) => void
  setShowAddModal: (show: boolean) => void
  setShowLocalPickModal: (show: boolean) => void
  setShowGitPickModal: (show: boolean) => void
  setLocalPath: (path: string) => void
  setLocalName: (name: string) => void
  setGitUrl: (url: string) => void
  setGitName: (name: string) => void
  setLocalCandidates: (candidates: LocalSkillCandidate[]) => void
  setLocalCandidatesBasePath: (path: string) => void
  setLocalCandidateSelected: (selected: Record<string, boolean>) => void
  setGitCandidates: (candidates: GitSkillCandidate[]) => void
  setGitCandidatesRepoUrl: (url: string) => void
  setGitCandidateSelected: (selected: Record<string, boolean>) => void
  t: (key: string, options?: Record<string, unknown>) => string
}

export interface UseSkillActionsReturn {
  handleImport: (params: {
    plan: OnboardingPlan
    selected: Record<string, boolean>
    variantChoice: Record<string, string>
    onComplete: () => void
  }) => Promise<void>
  handleCreateLocal: (params: {
    localPath: string
    localName: string
  }) => Promise<void>
  handleCreateGit: (params: {
    gitUrl: string
    gitName: string
    autoSelectSkillName: string | null
    syncTargetOverrides?: Record<string, boolean>
  }) => Promise<void>
  handleInstallSelectedLocalCandidates: (params: {
    selectedCandidates: LocalSkillCandidate[]
    localName: string
    localCandidatesBasePath: string
  }) => Promise<void>
  handleInstallSelectedGitCandidates: (params: {
    selectedCandidates: GitSkillCandidate[]
    gitName: string
    gitCandidatesRepoUrl: string
  }) => Promise<void>
  handleDeleteManaged: (skill: ManagedSkill, onComplete?: () => void) => Promise<void>
  handleSyncAllManagedToTools: (params: {
    managedSkills: ManagedSkill[]
    toolIds: string[]
  }) => Promise<void>
  handleToggleToolForSkill: (params: {
    skill: ManagedSkill
    toolId: string
    loading: boolean
    onSharedToggle: (skill: ManagedSkill, toolId: string) => void
  }) => Promise<void>
  runToggleToolForSkill: (skill: ManagedSkill, toolId: string) => Promise<void>
  handleUpdateManaged: (skill: ManagedSkill) => Promise<void>
}

export function useSkillActions({
  invokeTauri,
  tools,
  syncTargets,
  isInstalled,
  uniqueToolIdsBySkillsDir,
  sharedToolIdsByToolId,
  isSkillNameTaken,
  loadManagedSkills,
  setLoading,
  setLoadingStartAt,
  setError,
  setActionMessage,
  setSuccessToastMessage,
  setShowAddModal,
  setShowLocalPickModal,
  setShowGitPickModal,
  setLocalPath,
  setLocalName,
  setGitUrl,
  setGitName,
  setLocalCandidates,
  setLocalCandidatesBasePath,
  setLocalCandidateSelected,
  setGitCandidates,
  setGitCandidatesRepoUrl,
  setGitCandidateSelected,
  t,
}: UseSkillActionsOptions): UseSkillActionsReturn {
  const handleImport = useCallback(
    async (params: {
      plan: OnboardingPlan
      selected: Record<string, boolean>
      variantChoice: Record<string, string>
      onComplete: () => void
    }) => {
      const { plan, selected, variantChoice, onComplete } = params
      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      setActionMessage(null)
      try {
        const collectedErrors: { title: string; message: string }[] = []
        for (const group of plan.groups) {
          if (!selected[group.name]) continue
          const chosenPath = variantChoice[group.name] ?? group.variants[0]?.path
          if (!chosenPath) continue
          const chosenVariantTool =
            group.variants.find((v) => v.path === chosenPath)?.tool ?? null

          setActionMessage(t('actions.importExisting', { name: group.name }))
          const installResult = await invokeTauri<{
            skill_id: string
            central_path: string
          }>('import_existing_skill', {
            sourcePath: chosenPath,
            name: group.name,
          })

          const selectedInstalledIds = tools
            .filter((tool) => syncTargets[tool.id] && isInstalled(tool.id))
            .map((tool) => tool.id)
          const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
            .map((id) => tools.find((tool) => tool.id === id))
            .filter(Boolean) as ToolOption[]
          for (let i = 0; i < targets.length; i++) {
            const tool = targets[i]
            try {
              const overwrite = Boolean(
                chosenVariantTool &&
                  (chosenVariantTool === tool.id ||
                    (sharedToolIdsByToolId[chosenVariantTool] ?? []).includes(
                      tool.id,
                    )),
              )
              await invokeTauri('sync_skill_to_tool', {
                sourcePath: installResult.central_path,
                skillId: installResult.skill_id,
                tool: tool.id,
                name: group.name,
                overwrite,
              })
            } catch (err) {
              const raw = err instanceof Error ? err.message : String(err)
              if (raw.startsWith('TARGET_EXISTS|')) {
                const targetPath = raw.split('|')[1] ?? ''
                collectedErrors.push({
                  title: t('errors.syncFailedTitle', {
                    name: group.name,
                    tool: tool.label,
                  }),
                  message: t('errors.syncTargetExistsMessage', {
                    path: targetPath,
                  }),
                })
              } else {
                collectedErrors.push({
                  title: t('errors.syncFailedTitle', {
                    name: group.name,
                    tool: tool.label,
                  }),
                  message: raw,
                })
              }
            }
          }
        }

        setActionMessage(t('status.importCompleted'))
        setSuccessToastMessage(t('status.importCompleted'))
        setActionMessage(null)
        await loadManagedSkills()
        if (collectedErrors.length > 0) {
          toast.error(
            `${collectedErrors[0].title}: ${collectedErrors[0].message}${
              collectedErrors.length > 1
                ? t('errors.moreCount', { count: collectedErrors.length - 1 })
                : ''
            }`,
            { duration: 3200 },
          )
        } else {
          onComplete()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      tools,
      syncTargets,
      isInstalled,
      uniqueToolIdsBySkillsDir,
      sharedToolIdsByToolId,
      loadManagedSkills,
      setLoading,
      setLoadingStartAt,
      setError,
      setActionMessage,
      setSuccessToastMessage,
      t,
    ],
  )

  const handleCreateLocal = useCallback(
    async (params: { localPath: string; localName: string }) => {
      const { localPath, localName } = params
      if (!localPath.trim()) {
        setError(t('errors.requireLocalPath'))
        return
      }
      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      setActionMessage(t('actions.creatingLocalSkill'))
      try {
        const basePath = localPath.trim()
        const candidates = await invokeTauri<LocalSkillCandidate[]>(
          'list_local_skills_cmd',
          { basePath },
        )
        if (candidates.length === 0) {
          throw new Error(t('errors.noSkillsFoundLocal'))
        }
        if (candidates.length === 1 && candidates[0].valid) {
          const desiredName = localName.trim() || candidates[0].name
          if (isSkillNameTaken(desiredName)) {
            setError(t('errors.skillAlreadyExists', { name: desiredName }))
            return
          }
          const created = await invokeTauri<InstallResultDto>(
            'install_local_selection',
            {
              basePath,
              subpath: candidates[0].subpath,
              name: localName.trim() || undefined,
            },
          )
          {
            const selectedInstalledIds = tools
              .filter((tool) => syncTargets[tool.id] && isInstalled(tool.id))
              .map((tool) => tool.id)
            const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
              .map((id) => tools.find((tool) => tool.id === id))
              .filter(Boolean) as ToolOption[]
            if (targets.length === 0) {
              setError(t('errors.noSyncTargets'))
            } else {
              const collectedErrors: { title: string; message: string }[] = []
              for (let i = 0; i < targets.length; i++) {
                const tool = targets[i]
                setActionMessage(
                  t('actions.syncStep', {
                    index: i + 1,
                    total: targets.length,
                    name: created.name,
                    tool: tool.label,
                  }),
                )
                try {
                  await invokeTauri('sync_skill_to_tool', {
                    sourcePath: created.central_path,
                    skillId: created.skill_id,
                    tool: tool.id,
                    name: created.name,
                  })
                } catch (err) {
                  const raw = err instanceof Error ? err.message : String(err)
                  collectedErrors.push({
                    title: t('errors.syncFailedTitle', {
                      name: created.name,
                      tool: tool.label,
                    }),
                    message: raw,
                  })
                }
              }
              if (collectedErrors.length > 0) {
                toast.error(
                  `${collectedErrors[0].title}: ${collectedErrors[0].message}`,
                  { duration: 3200 },
                )
              }
            }
          }
          setLocalPath('')
          setLocalName('')
          setActionMessage(t('status.localSkillCreated'))
          setSuccessToastMessage(t('status.localSkillCreated'))
          setActionMessage(null)
          setShowAddModal(false)
          await loadManagedSkills()
        } else {
          setLocalCandidatesBasePath(basePath)
          setLocalCandidates(candidates)
          setLocalCandidateSelected(
            Object.fromEntries(candidates.map((c) => [c.subpath, c.valid])),
          )
          setShowLocalPickModal(true)
          setActionMessage(null)
          setLoading(false)
          setLoadingStartAt(null)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      tools,
      syncTargets,
      isInstalled,
      uniqueToolIdsBySkillsDir,
      isSkillNameTaken,
      loadManagedSkills,
      setLoading,
      setLoadingStartAt,
      setError,
      setActionMessage,
      setSuccessToastMessage,
      setShowAddModal,
      setShowLocalPickModal,
      setLocalCandidates,
      setLocalCandidatesBasePath,
      setLocalCandidateSelected,
      setLocalPath,
      setLocalName,
      t,
    ],
  )

  const handleCreateGit = useCallback(
    async (params: {
      gitUrl: string
      gitName: string
      autoSelectSkillName: string | null
      syncTargetOverrides?: Record<string, boolean>
    }) => {
      const { gitUrl, gitName, autoSelectSkillName, syncTargetOverrides } = params
      const effectiveGitUrl = gitUrl
      const effectiveAutoSelectSkillName = autoSelectSkillName
      const effectiveSyncTargets = syncTargetOverrides ?? syncTargets

      if (!effectiveGitUrl.trim()) {
        setError(t('errors.requireGitUrl'))
        return
      }
      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      setActionMessage(t('actions.creatingGitSkill'))
      try {
        const url = effectiveGitUrl.trim()
        const isFolderUrl = url.includes('/tree/') || url.includes('/blob/')

        if (isFolderUrl) {
          const created = await invokeTauri<InstallResultDto>('install_git', {
            repoUrl: url,
            name: gitName.trim() || undefined,
          })
          {
            const selectedInstalledIds = tools
              .filter((tool) => syncTargets[tool.id] && isInstalled(tool.id))
              .map((tool) => tool.id)
            const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
              .map((id) => tools.find((tool) => tool.id === id))
              .filter(Boolean) as ToolOption[]
            if (targets.length === 0) {
              setError(t('errors.noSyncTargets'))
            } else {
              const collectedErrors: { title: string; message: string }[] = []
              for (let i = 0; i < targets.length; i++) {
                const tool = targets[i]
                setActionMessage(
                  t('actions.syncStep', {
                    index: i + 1,
                    total: targets.length,
                    name: created.name,
                    tool: tool.label,
                  }),
                )
                try {
                  await invokeTauri('sync_skill_to_tool', {
                    sourcePath: created.central_path,
                    skillId: created.skill_id,
                    tool: tool.id,
                    name: created.name,
                  })
                } catch (err) {
                  const raw = err instanceof Error ? err.message : String(err)
                  collectedErrors.push({
                    title: t('errors.syncFailedTitle', {
                      name: created.name,
                      tool: tool.label,
                    }),
                    message: raw,
                  })
                }
              }
              if (collectedErrors.length > 0) {
                toast.error(
                  `${collectedErrors[0].title}: ${collectedErrors[0].message}`,
                  { duration: 3200 },
                )
              }
            }
          }
        } else {
          const candidates = await invokeTauri<GitSkillCandidate[]>(
            'list_git_skills_cmd',
            { repoUrl: url },
          )
          if (candidates.length === 0) {
            throw new Error(t('errors.noSkillsFoundWithHint'))
          }
          if (candidates.length === 1) {
            if (isSkillNameTaken(candidates[0].name)) {
              setError(t('errors.skillAlreadyExists', { name: candidates[0].name }))
              return
            }
            const created = await invokeTauri<InstallResultDto>(
              'install_git_selection',
              {
                repoUrl: url,
                subpath: candidates[0].subpath,
                name: gitName.trim() || undefined,
              },
            )
            {
              const selectedInstalledIds = tools
                .filter((tool) => effectiveSyncTargets[tool.id] && isInstalled(tool.id))
                .map((tool) => tool.id)
              const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
                .map((id) => tools.find((tool) => tool.id === id))
                .filter(Boolean) as ToolOption[]
              if (targets.length === 0) {
                setError(t('errors.noSyncTargets'))
              } else {
                const collectedErrors: { title: string; message: string }[] = []
                for (let i = 0; i < targets.length; i++) {
                  const tool = targets[i]
                  setActionMessage(
                    t('actions.syncStep', {
                      index: i + 1,
                      total: targets.length,
                      name: created.name,
                      tool: tool.label,
                    }),
                  )
                  try {
                    await invokeTauri('sync_skill_to_tool', {
                      sourcePath: created.central_path,
                      skillId: created.skill_id,
                      tool: tool.id,
                      name: created.name,
                    })
                  } catch (err) {
                    const raw = err instanceof Error ? err.message : String(err)
                    collectedErrors.push({
                      title: t('errors.syncFailedTitle', {
                        name: created.name,
                        tool: tool.label,
                      }),
                      message: raw,
                    })
                  }
                }
                if (collectedErrors.length > 0) {
                  toast.error(
                    `${collectedErrors[0].title}: ${collectedErrors[0].message}`,
                    { duration: 3200 },
                  )
                }
              }
            }
          } else if (effectiveAutoSelectSkillName) {
            const target = effectiveAutoSelectSkillName.toLowerCase()
            const containMatches = candidates.filter((c) => {
              const n = c.name.toLowerCase()
              return target.includes(n) || n.includes(target)
            })
            const match =
              candidates.find((c) => c.name.toLowerCase() === target) ??
              (containMatches.length === 1 ? containMatches[0] : undefined)
            if (match) {
              if (isSkillNameTaken(match.name)) {
                setError(t('errors.skillAlreadyExists', { name: match.name }))
                return
              }
              const created = await invokeTauri<InstallResultDto>(
                'install_git_selection',
                {
                  repoUrl: url,
                  subpath: match.subpath,
                  name: gitName.trim() || undefined,
                },
              )
              {
                const selectedInstalledIds = tools
                  .filter((tool) => effectiveSyncTargets[tool.id] && isInstalled(tool.id))
                  .map((tool) => tool.id)
                const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
                  .map((id) => tools.find((tool) => tool.id === id))
                  .filter(Boolean) as ToolOption[]
                if (targets.length === 0) {
                  setError(t('errors.noSyncTargets'))
                } else {
                  const collectedErrors: { title: string; message: string }[] = []
                  for (let i = 0; i < targets.length; i++) {
                    const tool = targets[i]
                    setActionMessage(
                      t('actions.syncStep', {
                        index: i + 1,
                        total: targets.length,
                        name: created.name,
                        tool: tool.label,
                      }),
                    )
                    try {
                      await invokeTauri('sync_skill_to_tool', {
                        sourcePath: created.central_path,
                        skillId: created.skill_id,
                        tool: tool.id,
                        name: created.name,
                      })
                    } catch (err) {
                      const raw = err instanceof Error ? err.message : String(err)
                      collectedErrors.push({
                        title: t('errors.syncFailedTitle', {
                          name: created.name,
                          tool: tool.label,
                        }),
                        message: raw,
                      })
                    }
                  }
                  if (collectedErrors.length > 0) {
                    toast.error(
                      `${collectedErrors[0].title}: ${collectedErrors[0].message}`,
                      { duration: 3200 },
                    )
                  }
                }
              }
            } else {
              setGitCandidatesRepoUrl(url)
              setGitCandidates(candidates)
              setGitCandidateSelected(
                Object.fromEntries(candidates.map((c) => [c.subpath, true])),
              )
              setShowGitPickModal(true)
              setActionMessage(null)
              setLoading(false)
              setLoadingStartAt(null)
              return
            }
          } else {
            setGitCandidatesRepoUrl(url)
            setGitCandidates(candidates)
            setGitCandidateSelected(
              Object.fromEntries(candidates.map((c) => [c.subpath, true])),
            )
            setShowGitPickModal(true)
            setActionMessage(null)
            setLoading(false)
            setLoadingStartAt(null)
            return
          }
        }
        setGitUrl('')
        setGitName('')
        setActionMessage(t('status.gitSkillCreated'))
        setSuccessToastMessage(t('status.gitSkillCreated'))
        setActionMessage(null)
        setShowAddModal(false)
        await loadManagedSkills()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      tools,
      syncTargets,
      isInstalled,
      uniqueToolIdsBySkillsDir,
      isSkillNameTaken,
      loadManagedSkills,
      setLoading,
      setLoadingStartAt,
      setError,
      setActionMessage,
      setSuccessToastMessage,
      setShowAddModal,
      setShowGitPickModal,
      setGitCandidates,
      setGitCandidatesRepoUrl,
      setGitCandidateSelected,
      setGitUrl,
      setGitName,
      t,
    ],
  )

  const handleInstallSelectedLocalCandidates = useCallback(
    async (params: {
      selectedCandidates: LocalSkillCandidate[]
      localName: string
      localCandidatesBasePath: string
    }) => {
      const { selectedCandidates, localName, localCandidatesBasePath } = params
      if (selectedCandidates.length === 0) {
        setError(t('errors.selectAtLeastOneSkill'))
        return
      }
      if (selectedCandidates.length > 1 && localName.trim()) {
        setError(t('errors.multiSelectNoCustomName'))
        return
      }
      if (selectedCandidates.length > 1) {
        const seen = new Set<string>()
        const dup = selectedCandidates.find((c) => {
          if (seen.has(c.name)) return true
          seen.add(c.name)
          return false
        })
        if (dup) {
          setError(t('errors.duplicateSelectedSkills', { name: dup.name }))
          return
        }
      }
      const desiredName =
        selectedCandidates.length === 1 && localName.trim()
          ? localName.trim()
          : selectedCandidates[0].name
      if (selectedCandidates.length === 1 && isSkillNameTaken(desiredName)) {
        setError(t('errors.skillAlreadyExists', { name: desiredName }))
        return
      }
      const duplicated = selectedCandidates.find((c) => isSkillNameTaken(c.name))
      if (selectedCandidates.length > 1 && duplicated) {
        setError(t('errors.skillAlreadyExists', { name: duplicated.name }))
        return
      }

      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      try {
        const collectedErrors: { title: string; message: string }[] = []
        for (let i = 0; i < selectedCandidates.length; i++) {
          const candidate = selectedCandidates[i]
          setActionMessage(
            t('actions.importStep', {
              index: i + 1,
              total: selectedCandidates.length,
              name: candidate.name,
            }),
          )
          try {
            const created = await invokeTauri<InstallResultDto>(
              'install_local_selection',
              {
                basePath: localCandidatesBasePath,
                subpath: candidate.subpath,
                name: localName.trim() || undefined,
              },
            )
            {
              const selectedInstalledIds = tools
                .filter((tool) => syncTargets[tool.id] && isInstalled(tool.id))
                .map((tool) => tool.id)
              const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
                .map((id) => tools.find((tool) => tool.id === id))
                .filter(Boolean) as ToolOption[]
              if (targets.length === 0) {
                collectedErrors.push({
                  title: t('errors.unsyncedTitle', { name: created.name }),
                  message: t('errors.noSyncTargets'),
                })
              } else {
                for (let ti = 0; ti < targets.length; ti++) {
                  const tool = targets[ti]
                  setActionMessage(
                    t('actions.syncStep', {
                      index: ti + 1,
                      total: targets.length,
                      name: created.name,
                      tool: tool.label,
                    }),
                  )
                  try {
                    await invokeTauri('sync_skill_to_tool', {
                      sourcePath: created.central_path,
                      skillId: created.skill_id,
                      tool: tool.id,
                      name: created.name,
                    })
                  } catch (err) {
                    const raw = err instanceof Error ? err.message : String(err)
                    collectedErrors.push({
                      title: t('errors.syncFailedTitle', {
                        name: created.name,
                        tool: tool.label,
                      }),
                      message: raw,
                    })
                  }
                }
              }
            }
          } catch (err) {
            const raw = err instanceof Error ? err.message : String(err)
            collectedErrors.push({
              title: t('errors.importFailedTitle', { name: candidate.name }),
              message: raw,
            })
          }
        }

        setShowLocalPickModal(false)
        setLocalCandidates([])
        setLocalCandidateSelected({})
        setLocalCandidatesBasePath('')
        setLocalPath('')
        setLocalName('')
        setActionMessage(t('status.selectedSkillsInstalled'))
        setSuccessToastMessage(t('status.selectedSkillsInstalled'))
        setActionMessage(null)
        setShowAddModal(false)
        await loadManagedSkills()
        if (collectedErrors.length > 0) {
          toast.error(
            `${collectedErrors[0].title}: ${collectedErrors[0].message}`,
            { duration: 3200 },
          )
        }
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      tools,
      syncTargets,
      isInstalled,
      uniqueToolIdsBySkillsDir,
      isSkillNameTaken,
      loadManagedSkills,
      setLoading,
      setLoadingStartAt,
      setError,
      setActionMessage,
      setSuccessToastMessage,
      setShowAddModal,
      setShowLocalPickModal,
      setLocalCandidates,
      setLocalCandidateSelected,
      setLocalCandidatesBasePath,
      setLocalPath,
      setLocalName,
      t,
    ],
  )

  const handleInstallSelectedGitCandidates = useCallback(
    async (params: {
      selectedCandidates: GitSkillCandidate[]
      gitName: string
      gitCandidatesRepoUrl: string
    }) => {
      const { selectedCandidates, gitName, gitCandidatesRepoUrl } = params
      if (selectedCandidates.length === 0) {
        setError(t('errors.selectAtLeastOneSkill'))
        return
      }
      const duplicated = selectedCandidates.find((c) => isSkillNameTaken(c.name))
      if (duplicated) {
        setError(t('errors.skillAlreadyExists', { name: duplicated.name }))
        return
      }
      if (selectedCandidates.length > 1 && gitName.trim()) {
        setError(t('errors.multiSelectNoCustomName'))
        return
      }

      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      try {
        const collectedErrors: { title: string; message: string }[] = []
        for (let i = 0; i < selectedCandidates.length; i++) {
          const candidate = selectedCandidates[i]
          setActionMessage(
            t('actions.importStep', {
              index: i + 1,
              total: selectedCandidates.length,
              name: candidate.name,
            }),
          )
          try {
            const created = await invokeTauri<InstallResultDto>(
              'install_git_selection',
              {
                repoUrl: gitCandidatesRepoUrl,
                subpath: candidate.subpath,
                name: gitName.trim() || undefined,
              },
            )
            {
              const selectedInstalledIds = tools
                .filter((tool) => syncTargets[tool.id] && isInstalled(tool.id))
                .map((tool) => tool.id)
              const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
                .map((id) => tools.find((tool) => tool.id === id))
                .filter(Boolean) as ToolOption[]
              if (targets.length === 0) {
                collectedErrors.push({
                  title: t('errors.unsyncedTitle', { name: created.name }),
                  message: t('errors.noSyncTargets'),
                })
              } else {
                for (let ti = 0; ti < targets.length; ti++) {
                  const tool = targets[ti]
                  setActionMessage(
                    t('actions.syncStep', {
                      index: ti + 1,
                      total: targets.length,
                      name: created.name,
                      tool: tool.label,
                    }),
                  )
                  try {
                    await invokeTauri('sync_skill_to_tool', {
                      sourcePath: created.central_path,
                      skillId: created.skill_id,
                      tool: tool.id,
                      name: created.name,
                    })
                  } catch (err) {
                    const raw = err instanceof Error ? err.message : String(err)
                    collectedErrors.push({
                      title: t('errors.syncFailedTitle', {
                        name: created.name,
                        tool: tool.label,
                      }),
                      message: raw,
                    })
                  }
                }
              }
            }
          } catch (err) {
            const raw = err instanceof Error ? err.message : String(err)
            collectedErrors.push({
              title: t('errors.importFailedTitle', { name: candidate.name }),
              message: raw,
            })
          }
        }

        setShowGitPickModal(false)
        setGitCandidates([])
        setGitCandidateSelected({})
        setGitCandidatesRepoUrl('')
        setGitUrl('')
        setGitName('')
        setActionMessage(t('status.selectedSkillsInstalled'))
        setSuccessToastMessage(t('status.selectedSkillsInstalled'))
        setActionMessage(null)
        setShowAddModal(false)
        await loadManagedSkills()
        if (collectedErrors.length > 0) {
          toast.error(
            `${collectedErrors[0].title}: ${collectedErrors[0].message}`,
            { duration: 3200 },
          )
        }
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      tools,
      syncTargets,
      isInstalled,
      uniqueToolIdsBySkillsDir,
      isSkillNameTaken,
      loadManagedSkills,
      setLoading,
      setLoadingStartAt,
      setError,
      setActionMessage,
      setSuccessToastMessage,
      setShowAddModal,
      setShowGitPickModal,
      setGitCandidates,
      setGitCandidateSelected,
      setGitCandidatesRepoUrl,
      setGitUrl,
      setGitName,
      t,
    ],
  )

  const handleDeleteManaged = useCallback(
    async (skill: ManagedSkill, onComplete?: () => void) => {
      setLoading(true)
      setLoadingStartAt(Date.now())
      setActionMessage(t('actions.removing', { name: skill.name }))
      setError(null)
      try {
        await invokeTauri('delete_managed_skill', { skillId: skill.id })
        setActionMessage(t('status.skillRemoved'))
        setSuccessToastMessage(t('status.skillRemoved'))
        setActionMessage(null)
        await loadManagedSkills()
        onComplete?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [invokeTauri, loadManagedSkills, setLoading, setLoadingStartAt, setError, setActionMessage, setSuccessToastMessage, t],
  )

  const runToggleToolForSkill = useCallback(
    async (skill: ManagedSkill, toolId: string) => {
      const toolLabel = tools.find((t) => t.id === toolId)?.label ?? toolId
      const target = skill.targets.find((t) => t.tool === toolId)
      const synced = Boolean(target)

      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      try {
        if (synced) {
          setActionMessage(
            t('actions.unsyncing', { name: skill.name, tool: toolLabel }),
          )
          await invokeTauri('unsync_skill_from_tool', {
            skillId: skill.id,
            tool: toolId,
          })
        } else {
          setActionMessage(
            t('actions.syncing', { name: skill.name, tool: toolLabel }),
          )
          await invokeTauri('sync_skill_to_tool', {
            sourcePath: skill.central_path,
            skillId: skill.id,
            tool: toolId,
            name: skill.name,
          })
        }
        const statusText = synced
          ? t('status.syncDisabled')
          : t('status.syncEnabled')
        setActionMessage(statusText)
        setSuccessToastMessage(statusText)
        setActionMessage(null)
        await loadManagedSkills()
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err)
        if (raw.startsWith('TARGET_EXISTS|')) {
          const targetPath = raw.split('|')[1] ?? ''
          setError(t('errors.targetExistsDetail', { path: targetPath }))
        } else if (raw.startsWith('TOOL_NOT_INSTALLED|')) {
          setError(t('errors.toolNotInstalled'))
        } else if (raw.startsWith('TOOL_NOT_WRITABLE|')) {
          const parts = raw.split('|')
          setError(t('errors.toolNotWritable', { tool: parts[1] ?? '', path: parts[2] ?? '' }))
        } else {
          setError(raw)
        }
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [invokeTauri, loadManagedSkills, setLoading, setLoadingStartAt, setError, setActionMessage, setSuccessToastMessage, t, tools],
  )

  const handleSyncAllManagedToTools = useCallback(
    async (params: { managedSkills: ManagedSkill[]; toolIds: string[] }) => {
      const { managedSkills, toolIds } = params
      if (managedSkills.length === 0) return
      const installedIds = uniqueToolIdsBySkillsDir(
        toolIds.filter((id) => isInstalled(id)),
      )
      if (installedIds.length === 0) return

      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      try {
        const collectedErrors: { title: string; message: string }[] = []
        for (let si = 0; si < managedSkills.length; si++) {
          const skill = managedSkills[si]
          for (let ti = 0; ti < installedIds.length; ti++) {
            const toolId = installedIds[ti]
            const toolLabel = tools.find((t) => t.id === toolId)?.label ?? toolId
            setActionMessage(
              t('actions.syncStep', {
                index: si + 1,
                total: managedSkills.length,
                name: skill.name,
                tool: toolLabel,
              }),
            )
            try {
              await invokeTauri('sync_skill_to_tool', {
                sourcePath: skill.central_path,
                skillId: skill.id,
                tool: toolId,
                name: skill.name,
              })
            } catch (err) {
              const raw = err instanceof Error ? err.message : String(err)
              if (raw.startsWith('TOOL_NOT_INSTALLED|') || raw.startsWith('TOOL_NOT_WRITABLE|')) continue
              collectedErrors.push({
                title: t('errors.syncFailedTitle', {
                  name: skill.name,
                  tool: toolLabel,
                }),
                message: raw,
              })
            }
          }
        }

        setActionMessage(t('status.syncCompleted'))
        setSuccessToastMessage(t('status.syncCompleted'))
        setActionMessage(null)
        await loadManagedSkills()
        if (collectedErrors.length > 0) {
          toast.error(
            `${collectedErrors[0].title}: ${collectedErrors[0].message}`,
            { duration: 3200 },
          )
        }
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      isInstalled,
      loadManagedSkills,
      tools,
      uniqueToolIdsBySkillsDir,
      setLoading,
      setLoadingStartAt,
      setError,
      setActionMessage,
      setSuccessToastMessage,
      t,
    ],
  )

  const handleToggleToolForSkill = useCallback(
    async (params: {
      skill: ManagedSkill
      toolId: string
      loading: boolean
      onSharedToggle: (skill: ManagedSkill, toolId: string) => void
    }) => {
      const { skill, toolId, loading, onSharedToggle } = params
      if (loading) return
      const shared = sharedToolIdsByToolId[toolId] ?? null
      if (shared && shared.length > 1) {
        onSharedToggle(skill, toolId)
        return
      }
      await runToggleToolForSkill(skill, toolId)
    },
    [runToggleToolForSkill, sharedToolIdsByToolId],
  )

  const handleUpdateManaged = useCallback(
    async (skill: ManagedSkill) => {
      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      try {
        setActionMessage(t('actions.updating', { name: skill.name }))
        await invokeTauri<UpdateResultDto>('update_managed_skill', { skillId: skill.id })
        const updatedText = t('status.updated', { name: skill.name })
        setActionMessage(updatedText)
        setSuccessToastMessage(updatedText)
        setActionMessage(null)
        await loadManagedSkills()
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err)
        setError(raw)
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [invokeTauri, loadManagedSkills, setLoading, setLoadingStartAt, setError, setActionMessage, setSuccessToastMessage, t],
  )

  return {
    handleImport,
    handleCreateLocal,
    handleCreateGit,
    handleInstallSelectedLocalCandidates,
    handleInstallSelectedGitCandidates,
    handleDeleteManaged,
    handleSyncAllManagedToTools,
    handleToggleToolForSkill,
    runToggleToolForSkill,
    handleUpdateManaged,
  }
}