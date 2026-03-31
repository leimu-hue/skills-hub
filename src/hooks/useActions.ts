import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import type {
  ManagedSkill,
  ToolOption,
  OnboardingPlan,
  InstallResultDto,
  GitSkillCandidate,
  LocalSkillCandidate,
  UpdateResultDto,
} from '../types'

interface UseActionsOptions {
  invokeTauri: <T,>(command: string, args?: Record<string, unknown>) => Promise<T>
  loadManagedSkills: () => Promise<void>
  loadPlan: () => Promise<OnboardingPlan | null>
  tools: ToolOption[]
  isInstalled: (id: string) => boolean
  uniqueToolIdsBySkillsDir: (toolIds: string[]) => string[]
  sharedToolIdsByToolId: Record<string, string[]>
  toolLabelById: Record<string, string>
  isSkillNameTaken: (name: string) => boolean
  t: (key: string, options?: Record<string, unknown>) => string
}

interface UseActionsReturn {
  loading: boolean
  loadingStartAt: number | null
  actionMessage: string | null
  formatErrorMessage: (raw: string) => string
  showActionErrors: (errors: { title: string; message: string }[]) => void
  setLoading: (loading: boolean) => void
  setLoadingStartAt: (time: number | null) => void
  setActionMessage: (message: string | null) => void
  setError: (error: string | null) => void
  setSuccessToastMessage: (message: string | null) => void

  // Action handlers
  handleCancelLoading: () => void
  handleImport: (plan: OnboardingPlan, selected: Record<string, boolean>, variantChoice: Record<string, string>) => Promise<void>
  handleCreateLocal: (localPath: string, localName: string) => Promise<{ candidates: LocalSkillCandidate[]; basePath: string } | void>
  handleCreateGit: (gitUrl: string, gitName: string) => Promise<{ candidates: GitSkillCandidate[]; repoUrl: string } | void>
  handleInstallSelectedLocalCandidates: (candidates: LocalSkillCandidate[], basePath: string, selectedSubpaths: Record<string, boolean>, name?: string) => Promise<void>
  handleInstallSelectedCandidates: (candidates: GitSkillCandidate[], repoUrl: string, selectedSubpaths: Record<string, boolean>, name?: string) => Promise<void>
  handleDeleteManaged: (skill: ManagedSkill) => Promise<void>
  handleSyncAllManagedToTools: (toolIds: string[], managedSkills: ManagedSkill[]) => Promise<void>
  handleUpdateManaged: (skill: ManagedSkill) => Promise<void>
  runToggleToolForSkill: (skill: ManagedSkill, toolId: string) => Promise<void>
}

export function useActions({
  invokeTauri,
  loadManagedSkills,
  loadPlan,
  tools,
  isInstalled,
  uniqueToolIdsBySkillsDir,
  sharedToolIdsByToolId,
  isSkillNameTaken,
  t,
}: UseActionsOptions): UseActionsReturn {
  const [loading, setLoading] = useState(false)
  const [loadingStartAt, setLoadingStartAt] = useState<number | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [, setError] = useState<string | null>(null)
  const [, setErrorMessage] = useState<string | null>(null)
  const [, setSuccessMsg] = useState<string | null>(null)

  const formatErrorMessage = useCallback(
    (raw: string) => {
      if (raw.includes('CANCELLED|')) {
        return '' // Silently ignore cancelled operations
      }
      if (raw.includes('skill already exists in central repo')) {
        const pathMatch = raw.match(/central repo:\s*"?([^"]+)"?/)
        if (pathMatch) {
          const skillName = pathMatch[1].split('/').pop() ?? ''
          if (skillName) {
            return t('errors.skillExistsInHubNamed', { name: skillName })
          }
        }
        return t('errors.skillExistsInHub')
      }
      if (raw.startsWith('TARGET_EXISTS|')) {
        return t('errors.targetExists')
      }
      if (raw.startsWith('TOOL_NOT_INSTALLED|')) {
        return t('errors.toolNotInstalled')
      }
      if (raw.startsWith('TOOL_NOT_WRITABLE|')) {
        const parts = raw.split('|')
        return t('errors.toolNotWritable', { tool: parts[1] ?? '', path: parts[2] ?? '' })
      }
      if (raw.includes('未在该仓库中发现可导入的 Skills')) {
        return t('errors.noSkillsFoundInRepo')
      }
      return raw
    },
    [t],
  )

  const showActionErrors = useCallback(
    (errors: { title: string; message: string }[]) => {
      if (errors.length === 0) return
      const head = errors[0]
      const more =
        errors.length > 1
          ? t('errors.moreCount', { count: errors.length - 1 })
          : ''
      toast.error(
        `${formatErrorMessage(`${head.title}\n${head.message}`)}${more}`,
        { duration: 3200 },
      )
    },
    [formatErrorMessage, t],
  )

  const showSuccess = useCallback(
    (message: string) => {
      toast.success(message, { duration: 1800 })
    },
    [],
  )



  const handleCancelLoading = useCallback(() => {
    void invokeTauri('cancel_current_operation').catch(() => {})
    setLoading(false)
    setLoadingStartAt(null)
    setActionMessage(null)
  }, [invokeTauri])

  const syncToTools = useCallback(
    async (
      created: { central_path: string; skill_id: string; name: string },
      chosenVariantTool: string | null,
      targets: ToolOption[],
    ) => {
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
          const overwrite = Boolean(
            chosenVariantTool &&
              (chosenVariantTool === tool.id ||
                (sharedToolIdsByToolId[chosenVariantTool] ?? []).includes(
                  tool.id,
                )),
          )
          await invokeTauri('sync_skill_to_tool', {
            sourcePath: created.central_path,
            skillId: created.skill_id,
            tool: tool.id,
            name: created.name,
            overwrite,
          })
        } catch (err) {
          const raw = err instanceof Error ? err.message : String(err)
          if (raw.startsWith('TARGET_EXISTS|')) {
            const targetPath = raw.split('|')[1] ?? ''
            collectedErrors.push({
              title: t('errors.syncFailedTitle', {
                name: created.name,
                tool: tool.label,
              }),
              message: t('errors.syncTargetExistsMessage', {
                path: targetPath,
              }),
            })
          } else {
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
      return collectedErrors
    },
    [invokeTauri, sharedToolIdsByToolId, t, setActionMessage],
  )

  const handleImport = useCallback(
    async (
      plan: OnboardingPlan,
      selected: Record<string, boolean>,
      variantChoice: Record<string, string>,
    ) => {
      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      setErrorMessage(null)
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
            .filter((tool) => isInstalled(tool.id))
            .map((t) => t.id)
          const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
            .map((id) => tools.find((t) => t.id === id))
            .filter(Boolean) as ToolOption[]

          const errors = await syncToTools(
            { ...installResult, name: group.name },
            chosenVariantTool,
            targets,
          )
          collectedErrors.push(...errors)
        }

        setActionMessage(t('status.importCompleted'))
        showSuccess(t('status.importCompleted'))
        setActionMessage(null)
        await loadManagedSkills()
        await loadPlan()
        if (collectedErrors.length > 0) {
          showActionErrors(collectedErrors)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setErrorMessage(msg)
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      tools,
      isInstalled,
      uniqueToolIdsBySkillsDir,
      syncToTools,
      loadManagedSkills,
      loadPlan,
      t,
      setLoading,
      setLoadingStartAt,
      setActionMessage,
      showActionErrors,
      showSuccess,
    ],
  )

  const handleCreateLocal = useCallback(
    async (localPath: string, localName: string) => {
      if (!localPath.trim()) {
        const msg = t('errors.requireLocalPath')
        setError(msg)
        setErrorMessage(msg)
        return
      }
      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      setErrorMessage(null)
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
            const msg = t('errors.skillAlreadyExists', { name: desiredName })
            setError(msg)
            setErrorMessage(msg)
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

          const selectedInstalledIds = tools
            .filter((tool) => isInstalled(tool.id))
            .map((t) => t.id)
          const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
            .map((id) => tools.find((t) => t.id === id))
            .filter(Boolean) as ToolOption[]
          if (targets.length === 0) {
            const msg = t('errors.noSyncTargets')
            setError(msg)
            setErrorMessage(msg)
          } else {
            const collectedErrors = await syncToTools(created, null, targets)
            if (collectedErrors.length > 0) showActionErrors(collectedErrors)
          }

          setActionMessage(t('status.localSkillCreated'))
          showSuccess(t('status.localSkillCreated'))
          setActionMessage(null)
          await loadManagedSkills()
        } else {
          return { candidates, basePath }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setErrorMessage(msg)
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      tools,
      isInstalled,
      uniqueToolIdsBySkillsDir,
      syncToTools,
      isSkillNameTaken,
      loadManagedSkills,
      t,
      setLoading,
      setLoadingStartAt,
      setActionMessage,
      showActionErrors,
      showSuccess,
    ],
  )

  const handleCreateGit = useCallback(
    async (gitUrl: string, gitName: string) => {
      if (!gitUrl.trim()) {
        const msg = t('errors.requireGitUrl')
        setError(msg)
        setErrorMessage(msg)
        return
      }
      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      setErrorMessage(null)
      setActionMessage(t('actions.creatingGitSkill'))
      try {
        const url = gitUrl.trim()
        const isFolderUrl = url.includes('/tree/') || url.includes('/blob/')

        if (isFolderUrl) {
          const created = await invokeTauri<InstallResultDto>('install_git', {
            repoUrl: url,
            name: gitName.trim() || undefined,
          })

          const selectedInstalledIds = tools
            .filter((tool) => isInstalled(tool.id))
            .map((t) => t.id)
          const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
            .map((id) => tools.find((t) => t.id === id))
            .filter(Boolean) as ToolOption[]
          if (targets.length === 0) {
            const msg = t('errors.noSyncTargets')
            setError(msg)
            setErrorMessage(msg)
          } else {
            const collectedErrors = await syncToTools(created, null, targets)
            if (collectedErrors.length > 0) showActionErrors(collectedErrors)
          }
        } else {
          const candidates = await invokeTauri<GitSkillCandidate[]>(
            'list_git_skills_cmd',
            { repoUrl: url },
          )
          if (candidates.length === 0) {
            throw new Error(t('errors.noSkillsFoundWithHint'))
          }
          return { candidates, repoUrl: url }
        }

        setActionMessage(t('status.gitSkillCreated'))
        showSuccess(t('status.gitSkillCreated'))
        setActionMessage(null)
        await loadManagedSkills()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setErrorMessage(msg)
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      tools,
      isInstalled,
      uniqueToolIdsBySkillsDir,
      syncToTools,
      loadManagedSkills,
      t,
      setLoading,
      setLoadingStartAt,
      setActionMessage,
      showActionErrors,
      showSuccess,
    ],
  )

  const handleInstallSelectedLocalCandidates = useCallback(
    async (
      candidates: LocalSkillCandidate[],
      basePath: string,
      selectedSubpaths: Record<string, boolean>,
      name?: string,
    ) => {
      const selected = candidates.filter(
        (c) => c.valid && selectedSubpaths[c.subpath],
      )
      if (selected.length === 0) {
        const msg = t('errors.selectAtLeastOneSkill')
        setError(msg)
        setErrorMessage(msg)
        return
      }
      if (selected.length > 1 && name?.trim()) {
        const msg = t('errors.multiSelectNoCustomName')
        setError(msg)
        setErrorMessage(msg)
        return
      }
      if (selected.length > 1) {
        const seen = new Set<string>()
        const dup = selected.find((c) => {
          if (seen.has(c.name)) return true
          seen.add(c.name)
          return false
        })
        if (dup) {
          const msg = t('errors.duplicateSelectedSkills', { name: dup.name })
          setError(msg)
          setErrorMessage(msg)
          return
        }
      }
      const desiredName =
        selected.length === 1 && name?.trim()
          ? name.trim()
          : selected[0].name
      if (selected.length === 1 && isSkillNameTaken(desiredName)) {
        const msg = t('errors.skillAlreadyExists', { name: desiredName })
        setError(msg)
        setErrorMessage(msg)
        return
      }
      const duplicated = selected.find((c) => isSkillNameTaken(c.name))
      if (selected.length > 1 && duplicated) {
        const msg = t('errors.skillAlreadyExists', { name: duplicated.name })
        setError(msg)
        setErrorMessage(msg)
        return
      }

      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      setErrorMessage(null)
      try {
        const collectedErrors: { title: string; message: string }[] = []
        for (let i = 0; i < selected.length; i++) {
          const candidate = selected[i]
          setActionMessage(
            t('actions.importStep', {
              index: i + 1,
              total: selected.length,
              name: candidate.name,
            }),
          )
          try {
            const created = await invokeTauri<InstallResultDto>(
              'install_local_selection',
              {
                basePath,
                subpath: candidate.subpath,
                name: name?.trim() || undefined,
              },
            )

            const selectedInstalledIds = tools
              .filter((tool) => isInstalled(tool.id))
              .map((t) => t.id)
            const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
              .map((id) => tools.find((t) => t.id === id))
              .filter(Boolean) as ToolOption[]
            if (targets.length === 0) {
              collectedErrors.push({
                title: t('errors.unsyncedTitle', { name: created.name }),
                message: t('errors.noSyncTargets'),
              })
            } else {
              const errors = await syncToTools(created, null, targets)
              collectedErrors.push(...errors)
            }
          } catch (err) {
            const raw = err instanceof Error ? err.message : String(err)
            collectedErrors.push({
              title: t('errors.importFailedTitle', { name: candidate.name }),
              message: raw,
            })
          }
        }

        setActionMessage(t('status.selectedSkillsInstalled'))
        showSuccess(t('status.selectedSkillsInstalled'))
        setActionMessage(null)
        await loadManagedSkills()
        if (collectedErrors.length > 0) showActionErrors(collectedErrors)
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      tools,
      isInstalled,
      uniqueToolIdsBySkillsDir,
      syncToTools,
      isSkillNameTaken,
      loadManagedSkills,
      t,
      setLoading,
      setLoadingStartAt,
      setActionMessage,
      showActionErrors,
      showSuccess,
    ],
  )

  const handleInstallSelectedCandidates = useCallback(
    async (
      candidates: GitSkillCandidate[],
      repoUrl: string,
      selectedSubpaths: Record<string, boolean>,
      name?: string,
    ) => {
      const selected = candidates.filter((c) => selectedSubpaths[c.subpath])
      if (selected.length === 0) {
        const msg = t('errors.selectAtLeastOneSkill')
        setError(msg)
        setErrorMessage(msg)
        return
      }
      const duplicated = selected.find((c) => isSkillNameTaken(c.name))
      if (duplicated) {
        const msg = t('errors.skillAlreadyExists', { name: duplicated.name })
        setError(msg)
        setErrorMessage(msg)
        return
      }
      if (selected.length > 1 && name?.trim()) {
        const msg = t('errors.multiSelectNoCustomName')
        setError(msg)
        setErrorMessage(msg)
        return
      }

      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      setErrorMessage(null)
      try {
        const collectedErrors: { title: string; message: string }[] = []
        for (let i = 0; i < selected.length; i++) {
          const candidate = selected[i]
          setActionMessage(
            t('actions.importStep', {
              index: i + 1,
              total: selected.length,
              name: candidate.name,
            }),
          )
          try {
            const created = await invokeTauri<InstallResultDto>(
              'install_git_selection',
              {
                repoUrl,
                subpath: candidate.subpath,
                name: name?.trim() || undefined,
              },
            )

            const selectedInstalledIds = tools
              .filter((tool) => isInstalled(tool.id))
              .map((t) => t.id)
            const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
              .map((id) => tools.find((t) => t.id === id))
              .filter(Boolean) as ToolOption[]
            if (targets.length === 0) {
              collectedErrors.push({
                title: t('errors.unsyncedTitle', { name: created.name }),
                message: t('errors.noSyncTargets'),
              })
            } else {
              const errors = await syncToTools(created, null, targets)
              collectedErrors.push(...errors)
            }
          } catch (err) {
            const raw = err instanceof Error ? err.message : String(err)
            collectedErrors.push({
              title: t('errors.importFailedTitle', { name: candidate.name }),
              message: raw,
            })
          }
        }

        setActionMessage(t('status.selectedSkillsInstalled'))
        showSuccess(t('status.selectedSkillsInstalled'))
        setActionMessage(null)
        await loadManagedSkills()
        if (collectedErrors.length > 0) showActionErrors(collectedErrors)
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      tools,
      isInstalled,
      uniqueToolIdsBySkillsDir,
      syncToTools,
      isSkillNameTaken,
      loadManagedSkills,
      t,
      setLoading,
      setLoadingStartAt,
      setActionMessage,
      showActionErrors,
      showSuccess,
    ],
  )

  const handleDeleteManaged = useCallback(
    async (skill: ManagedSkill) => {
      setLoading(true)
      setLoadingStartAt(Date.now())
      setActionMessage(t('actions.removing', { name: skill.name }))
      setError(null)
      setErrorMessage(null)
      try {
        await invokeTauri('delete_managed_skill', { skillId: skill.id })
        setActionMessage(t('status.skillRemoved'))
        showSuccess(t('status.skillRemoved'))
        setActionMessage(null)
        await loadManagedSkills()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setError(msg)
        setErrorMessage(msg)
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [invokeTauri, loadManagedSkills, t, setLoading, setLoadingStartAt, setActionMessage, showSuccess],
  )

  const handleSyncAllManagedToTools = useCallback(
    async (toolIds: string[], managedSkills: ManagedSkill[]) => {
      if (managedSkills.length === 0) return
      const installedIds = uniqueToolIdsBySkillsDir(
        toolIds.filter((id) => isInstalled(id)),
      )
      if (installedIds.length === 0) return

      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      setErrorMessage(null)
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
              if (
                raw.startsWith('TOOL_NOT_INSTALLED|') ||
                raw.startsWith('TOOL_NOT_WRITABLE|')
              )
                continue
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
        showSuccess(t('status.syncCompleted'))
        setActionMessage(null)
        await loadManagedSkills()
        if (collectedErrors.length > 0) showActionErrors(collectedErrors)
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      isInstalled,
      loadManagedSkills,
      showActionErrors,
      t,
      tools,
      uniqueToolIdsBySkillsDir,
      setLoading,
      setLoadingStartAt,
      setActionMessage,
      showSuccess,
    ],
  )

  const handleUpdateManaged = useCallback(
    async (skill: ManagedSkill) => {
      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      setErrorMessage(null)
      try {
        setActionMessage(t('actions.updating', { name: skill.name }))
        await invokeTauri<UpdateResultDto>('update_managed_skill', {
          skillId: skill.id,
        })
        const updatedText = t('status.updated', { name: skill.name })
        setActionMessage(updatedText)
        showSuccess(updatedText)
        setActionMessage(null)
        await loadManagedSkills()
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err)
        setError(raw)
        setErrorMessage(raw)
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [invokeTauri, loadManagedSkills, t, setLoading, setLoadingStartAt, setActionMessage, showSuccess],
  )

  const runToggleToolForSkill = useCallback(
    async (skill: ManagedSkill, toolId: string) => {
      const toolLabel = tools.find((t) => t.id === toolId)?.label ?? toolId
      const target = skill.targets.find((t) => t.tool === toolId)
      const synced = Boolean(target)

      setLoading(true)
      setLoadingStartAt(Date.now())
      setError(null)
      setErrorMessage(null)
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
        showSuccess(statusText)
        setActionMessage(null)
        await loadManagedSkills()
      } catch (err) {
        const raw = err instanceof Error ? err.message : String(err)
        if (raw.startsWith('TARGET_EXISTS|')) {
          const targetPath = raw.split('|')[1] ?? ''
          const msg = t('errors.targetExistsDetail', { path: targetPath })
          setError(msg)
          setErrorMessage(msg)
        } else if (raw.startsWith('TOOL_NOT_INSTALLED|')) {
          const msg = t('errors.toolNotInstalled')
          setError(msg)
          setErrorMessage(msg)
        } else if (raw.startsWith('TOOL_NOT_WRITABLE|')) {
          const parts = raw.split('|')
          const msg = t('errors.toolNotWritable', {
            tool: parts[1] ?? '',
            path: parts[2] ?? '',
          })
          setError(msg)
          setErrorMessage(msg)
        } else {
          setError(raw)
          setErrorMessage(raw)
        }
      } finally {
        setLoading(false)
        setLoadingStartAt(null)
      }
    },
    [
      invokeTauri,
      loadManagedSkills,
      tools,
      t,
      setLoading,
      setLoadingStartAt,
      setActionMessage,
      showSuccess,
    ],
  )

  return {
    loading,
    loadingStartAt,
    actionMessage,
    formatErrorMessage,
    showActionErrors,
    setLoading,
    setLoadingStartAt,
    setActionMessage,
    setError,
    setSuccessToastMessage: setSuccessMsg,
    handleCancelLoading,
    handleImport,
    handleCreateLocal,
    handleCreateGit,
    handleInstallSelectedLocalCandidates,
    handleInstallSelectedCandidates,
    handleDeleteManaged,
    handleSyncAllManagedToTools,
    handleUpdateManaged,
    runToggleToolForSkill,
  }
}