import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Update } from '@tauri-apps/plugin-updater'
import './App.css'
import { useTranslation } from 'react-i18next'
import { Toaster, toast } from 'sonner'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import ExplorePage from './components/skills/pages/ExplorePage'
import FilterBar from './components/skills/components/FilterBar'
import SkillDetailView from './components/skills/components/SkillDetailView'
import Header from './components/skills/Header'
import LoadingOverlay from './components/skills/components/LoadingOverlay'
import SkillsList from './components/skills/components/SkillsList'
import AddSkillModal from './components/skills/modals/AddSkillModal'
import DeleteModal from './components/skills/modals/DeleteModal'
import GitPickModal from './components/skills/modals/GitPickModal'
import LocalPickModal from './components/skills/modals/LocalPickModal'
import ImportModal from './components/skills/modals/ImportModal'
import NewToolsModal from './components/skills/modals/NewToolsModal'
import SharedDirModal from './components/skills/modals/SharedDirModal'
import SettingsPage from './components/skills/pages/SettingsPage'
import type {
  FeaturedSkillDto,
  GitSkillCandidate,
  InstallResultDto,
  LocalSkillCandidate,
  ManagedSkill,
  OnboardingPlan,
  OnlineSkillDto,
  ToolOption,
  UpdateResultDto,
} from './types'
import {
  useTheme,
  useSkills,
  useSettings,
  useModals,
} from './hooks'

function App() {
  const { t, i18n } = useTranslation()

  // Theme hook
  const {
    themePreference,
    setThemePreference,
    toggleLanguage,
    language,
  } = useTheme(i18n as unknown as { changeLanguage: (lang: string) => Promise<void>; resolvedLanguage?: string; language: string })

  // Tauri detection
  const isTauri =
    typeof window !== 'undefined' &&
    Boolean(
      (window as { __TAURI__?: unknown }).__TAURI__ ||
        (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
    )

  const invokeTauri = useCallback(
    async <T,>(command: string, args?: Record<string, unknown>) => {
      if (!isTauri) {
        throw new Error('Tauri API is not available')
      }
      const { invoke } = await import('@tauri-apps/api/core')
      return invoke<T>(command, args)
    },
    [isTauri],
  )

  // Skills hook
  const {
    managedSkills,
    toolStatus,
    tools,
    installedTools,
    isInstalled,
    uniqueToolIdsBySkillsDir,
    sharedToolIdsByToolId,
    toolLabelById,
    loadManagedSkills,
  } = useSkills({ invokeTauri, isTauri })

  // Settings hook
  const {
    storagePath,
    gitCacheCleanupDays,
    gitCacheTtlSecs,
    githubToken,
    handlePickStoragePath,
    handleGitCacheCleanupDaysChange,
    handleGitCacheTtlSecsChange,
    handleGithubTokenChange,
    handleClearGitCacheNow,
  } = useSettings({ invokeTauri, isTauri, t })

  // Modals hook
  const modals = useModals()
  const {
    showAddModal,
    showImportModal,
    showNewToolsModal,
    showGitPickModal,
    showLocalPickModal,
    pendingDeleteId,
    pendingSharedToggle,
    localPath,
    localName,
    gitUrl,
    gitName,
    addModalTab,
    gitCandidates,
    gitCandidatesRepoUrl,
    gitCandidateSelected,
    localCandidates,
    localCandidatesBasePath,
    localCandidateSelected,
    setShowAddModal,
    setShowImportModal,
    setShowNewToolsModal,
    setLocalPath,
    setLocalName,
    setGitUrl,
    setGitName,
    setAddModalTab,
    setGitCandidates,
    setGitCandidatesRepoUrl,
    setGitCandidateSelected,
    setLocalCandidates,
    setLocalCandidatesBasePath,
    setLocalCandidateSelected,
    setShowLocalPickModal,
    setShowGitPickModal,
    handleCloseAdd,
    handleCloseImport,
    handleCloseNewTools,
    handleCloseGitPick,
    handleCloseDelete,
    handleCancelGitPick,
    handleCloseLocalPick,
    handleCancelLocalPick,
    handleDeletePrompt,
    handleSharedCancel,
    setPendingDeleteId,
    setPendingSharedToggle,
  } = modals

  // Local state
  const [plan, setPlan] = useState<OnboardingPlan | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStartAt, setLoadingStartAt] = useState<number | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({})
  const [syncTargets, setSyncTargets] = useState<Record<string, boolean>>({})
  const [successToastMessage, setSuccessToastMessage] = useState<string | null>(null)
  const [updateAvailableVersion, setUpdateAvailableVersion] = useState<string | null>(null)
  const [updateBody, setUpdateBody] = useState<string | null>(null)
  const [updateInstalling, setUpdateInstalling] = useState(false)
  const [updateDone, setUpdateDone] = useState(false)
  const updateObjRef = useRef<Update | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'updated' | 'name'>('updated')
  const [activeView, setActiveView] = useState<'myskills' | 'explore' | 'detail' | 'settings'>('myskills')
  const [detailSkill, setDetailSkill] = useState<ManagedSkill | null>(null)
  const [featuredSkills, setFeaturedSkills] = useState<FeaturedSkillDto[]>([])
  const [featuredLoading, setFeaturedLoading] = useState(false)
  const [exploreFilter, setExploreFilter] = useState('')
  const [searchResults, setSearchResults] = useState<OnlineSkillDto[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [autoSelectSkillName, setAutoSelectSkillName] = useState<string | null>(null)
  const [exploreInstallTrigger, setExploreInstallTrigger] = useState(0)
  const exploreInstallUrlRef = useRef<string | null>(null)

  // Helper functions
  const isSkillNameTaken = useCallback(
    (name: string) =>
      managedSkills.some((skill) => skill.name.toLowerCase() === name.toLowerCase()),
    [managedSkills],
  )

  const formatRelative = (ms: number | null | undefined) => {
    if (!ms) return t('relative.empty')
    const diff = Date.now() - ms
    if (diff < 0) return t('relative.empty')
    const minutes = Math.floor(diff / 60000)
    if (minutes < 1) return t('relative.justNow')
    if (minutes < 60) {
      return t('relative.minutesAgo', { minutes })
    }
    const hours = Math.floor(minutes / 60)
    if (hours < 24) {
      return t('relative.hoursAgo', { hours })
    }
    const days = Math.floor(hours / 24)
    return t('relative.daysAgo', { days })
  }

  const getSkillSourceLabel = (skill: ManagedSkill) => {
    const key = skill.source_type.toLowerCase()
    if (key.includes('git') && skill.source_ref) {
      return skill.source_ref
    }
    return skill.central_path
  }

  const getGithubInfo = (url: string | null | undefined) => {
    if (!url) return null
    const normalized = url.replace(/^git\+/, '')
    try {
      const parsed = new URL(normalized)
      if (!parsed.hostname.includes('github.com')) return null
      const parts = parsed.pathname.split('/').filter(Boolean)
      const owner = parts[0]
      const repo = parts[1]?.replace(/\.git$/, '')
      if (!owner || !repo) return null
      return {
        label: `${owner}/${repo}`,
        href: `https://github.com/${owner}/${repo}`,
      }
    } catch {
      const match = normalized.match(/github\.com\/([^/]+)\/([^/#?]+)/i)
      if (!match) return null
      const owner = match[1]
      const repo = match[2].replace(/\.git$/, '')
      return {
        label: `${owner}/${repo}`,
        href: `https://github.com/${owner}/${repo}`,
      }
    }
  }

  // Load plan
  const loadPlan = useCallback(async () => {
    setLoading(true)
    setLoadingStartAt(Date.now())
    setError(null)
    try {
      const result = await invokeTauri<OnboardingPlan>('get_onboarding_plan')
      setPlan(result)
      const defaultSelected: Record<string, boolean> = {}
      const defaultChoice: Record<string, string> = {}
      result.groups.forEach((group) => {
        defaultSelected[group.name] = true
        const first = group.variants[0]
        if (first) {
          defaultChoice[group.name] = first.path
        }
      })
      setSelected(defaultSelected)
      setVariantChoice(defaultChoice)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      setLoading(false)
      setLoadingStartAt(null)
    }
  }, [invokeTauri])

  // Effects
  useEffect(() => {
    if (isTauri) {
      void loadPlan()
    }
  }, [isTauri, loadPlan])

  useEffect(() => {
    if (!successToastMessage) return
    toast.success(successToastMessage, { duration: 1800 })
    setSuccessToastMessage(null)
  }, [successToastMessage])

  useEffect(() => {
    if (!error) return
    if (error.includes('CANCELLED|')) {
      setError(null)
      setActionMessage(null)
      return
    }
    toast.error(error, { duration: 2600 })
    setError(null)
    setActionMessage(null)
  }, [error])

  // Update check effect
  useEffect(() => {
    if (!isTauri) return
    const ignoredVersion = localStorage.getItem('skills-ignored-update-version')
    import('@tauri-apps/plugin-updater')
      .then(({ check }) => check())
      .then(async (update) => {
        if (update && update.version !== ignoredVersion) {
          updateObjRef.current = update
          setUpdateAvailableVersion(update.version)
          try {
            const res = await fetch(
              `https://api.github.com/repos/qufei1993/skills-hub/releases/tags/v${update.version}`,
            )
            if (res.ok) {
              const data = await res.json()
              setUpdateBody(data.body ?? update.body ?? null)
            } else {
              setUpdateBody(update.body ?? null)
            }
          } catch {
            setUpdateBody(update.body ?? null)
          }
        }
      })
      .catch(() => {})
  }, [isTauri])

  // Tool status effect - set default sync targets
  useEffect(() => {
    if (!toolStatus) return
    setSyncTargets((prev) => {
      if (Object.keys(prev).length > 0) return prev
      const next: Record<string, boolean> = {}
      for (const t of toolStatus.tools) {
        next[t.key] = toolStatus.installed.includes(t.key)
      }
      return next
    })

    if (toolStatus.newly_installed.length > 0) {
      setShowNewToolsModal(true)
    }
  }, [toolStatus, setShowNewToolsModal])

  // Computed values
  const visibleSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const filtered = managedSkills.filter((skill) => {
      if (!query) return true
      return (
        skill.name.toLowerCase().includes(query) ||
        skill.central_path.toLowerCase().includes(query) ||
        skill.source_type.toLowerCase().includes(query)
      )
    })
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      }
      return (b.updated_at ?? 0) - (a.updated_at ?? 0)
    })
    return sorted
  }, [managedSkills, searchQuery, sortBy])

  const newlyInstalledToolsText = useMemo(() => {
    if (!toolStatus || toolStatus.newly_installed.length === 0) return ''
    return toolStatus.newly_installed
      .map((id) => tools.find((t) => t.id === id)?.label ?? id)
      .join('、')
  }, [toolStatus, tools])

  const pendingDeleteSkill = useMemo(
    () => managedSkills.find((skill) => skill.id === pendingDeleteId) ?? null,
    [managedSkills, pendingDeleteId],
  )

  const pendingSharedLabels = useMemo(() => {
    if (!pendingSharedToggle) return null
    const toolId = pendingSharedToggle.toolId
    const shared = sharedToolIdsByToolId[toolId] ?? []
    const others = shared.filter((id) => id !== toolId)
    return {
      toolLabel: toolLabelById[toolId] ?? toolId,
      otherLabels: others.map((id) => toolLabelById[id] ?? id).join(', '),
    }
  }, [pendingSharedToggle, sharedToolIdsByToolId, toolLabelById])

  // Handlers
  const handleCancelLoading = useCallback(() => {
    void invokeTauri('cancel_current_operation').catch(() => {})
    setLoading(false)
    setLoadingStartAt(null)
    setActionMessage(null)
  }, [invokeTauri])

  const handleOpenSettings = useCallback(() => {
    setActiveView('settings')
  }, [])

  const handleCloseSettings = useCallback(() => {
    setActiveView('myskills')
  }, [])

  const handleThemeChange = useCallback(
    (nextTheme: 'system' | 'light' | 'dark') => {
      setThemePreference(nextTheme)
    },
    [setThemePreference],
  )

  const loadFeaturedSkills = useCallback(async () => {
    if (featuredSkills.length > 0) return
    setFeaturedLoading(true)
    try {
      const result = await invokeTauri<FeaturedSkillDto[]>('get_featured_skills')
      setFeaturedSkills(result)
    } catch {
      // silent
    } finally {
      setFeaturedLoading(false)
    }
  }, [featuredSkills.length, invokeTauri])

  const handleViewChange = useCallback(
    (view: 'myskills' | 'explore') => {
      setActiveView(view)
      if (view === 'explore') {
        loadFeaturedSkills()
      }
      if (view === 'myskills') {
        setDetailSkill(null)
      }
    },
    [loadFeaturedSkills],
  )

  const handleOpenDetail = useCallback((skill: ManagedSkill) => {
    setDetailSkill(skill)
    setActiveView('detail')
  }, [])

  const handleBackToList = useCallback(() => {
    setDetailSkill(null)
    setActiveView('myskills')
  }, [])

  const handleExploreFilterChange = useCallback(
    (value: string) => {
      setExploreFilter(value)
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
        searchTimerRef.current = null
      }
      if (value.trim().length < 2) {
        setSearchResults([])
        setSearchLoading(false)
        return
      }
      setSearchLoading(true)
      searchTimerRef.current = setTimeout(async () => {
        try {
          const results = await invokeTauri<OnlineSkillDto[]>(
            'search_skills_online',
            { query: value.trim(), limit: 20 },
          )
          setSearchResults(results)
        } catch {
          toast.error(t('searchError'))
          setSearchResults([])
        } finally {
          setSearchLoading(false)
        }
      }, 500)
    },
    [invokeTauri, t],
  )

  const handleOpenAdd = useCallback(() => {
    setShowAddModal(true)
  }, [setShowAddModal])

  const handleSortChange = useCallback((value: 'updated' | 'name') => {
    setSortBy(value)
  }, [])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
  }, [])

  const handleSyncTargetChange = useCallback(
    (toolId: string, checked: boolean) => {
      const shared = sharedToolIdsByToolId[toolId] ?? [toolId]
      if (shared.length > 1) {
        const others = shared.filter((id) => id !== toolId)
        const otherLabels = others.map((id) => toolLabelById[id] ?? id).join(', ')
        const ok = window.confirm(
          t('sharedDirConfirm', {
            tool: toolLabelById[toolId] ?? toolId,
            others: otherLabels,
          }),
        )
        if (!ok) return
      }
      setSyncTargets((prev) => {
        const next = { ...prev }
        for (const id of shared) next[id] = checked
        return next
      })
    },
    [sharedToolIdsByToolId, t, toolLabelById],
  )

  const handleToggleAllGitCandidates = useCallback((checked: boolean) => {
    setGitCandidateSelected(
      Object.fromEntries(gitCandidates.map((c) => [c.subpath, checked])),
    )
  }, [gitCandidates, setGitCandidateSelected])

  const handleToggleAllLocalCandidates = useCallback(
    (checked: boolean) => {
      setLocalCandidateSelected(
        Object.fromEntries(
          localCandidates.map((c) => [c.subpath, c.valid && checked]),
        ),
      )
    },
    [localCandidates, setLocalCandidateSelected],
  )

  const handleToggleGitCandidate = useCallback(
    (subpath: string, checked: boolean) => {
      setGitCandidateSelected((prev: Record<string, boolean>) => ({
        ...prev,
        [subpath]: checked,
      }))
    },
    [setGitCandidateSelected],
  )

  const handleToggleLocalCandidate = useCallback(
    (subpath: string, checked: boolean) => {
      setLocalCandidateSelected((prev: Record<string, boolean>) => ({
        ...prev,
        [subpath]: checked,
      }))
    },
    [setLocalCandidateSelected],
  )

  const handleToggleGroup = useCallback((groupName: string, checked: boolean) => {
    setSelected((prev) => ({
      ...prev,
      [groupName]: checked,
    }))
  }, [])

  const handleSelectVariant = useCallback((groupName: string, path: string) => {
    setVariantChoice((prev) => ({
      ...prev,
      [groupName]: path,
    }))
  }, [])

  const handleRefresh = useCallback(() => {
    void loadManagedSkills()
  }, [loadManagedSkills])

  const handleReviewImport = useCallback(async () => {
    if (plan) {
      setShowImportModal(true)
      return
    }
    const result = await loadPlan()
    if (result) {
      setShowImportModal(true)
    }
  }, [loadPlan, plan, setShowImportModal])

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (!plan) return
      const next: Record<string, boolean> = {}
      plan.groups.forEach((group) => {
        next[group.name] = checked
      })
      setSelected(next)
    },
    [plan],
  )

  const handlePickLocalPath = useCallback(async () => {
    if (!isTauri) return
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('selectLocalFolder'),
      })
      if (!selected || Array.isArray(selected)) return
      setLocalPath(selected)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }, [isTauri, t, setLocalPath])

  // Import handler
  const handleImport = useCallback(async () => {
    if (!plan) return
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
          .map((t) => t.id)
        const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
          .map((id) => tools.find((t) => t.id === id))
          .filter(Boolean) as ToolOption[]
        for (const tool of targets) {
          setActionMessage(
            t('actions.syncing', { name: group.name, tool: tool.label }),
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
      await loadPlan()
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
        setShowImportModal(false)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setLoadingStartAt(null)
    }
  }, [
    plan,
    selected,
    variantChoice,
    tools,
    syncTargets,
    isInstalled,
    uniqueToolIdsBySkillsDir,
    sharedToolIdsByToolId,
    invokeTauri,
    loadManagedSkills,
    loadPlan,
    t,
    setShowImportModal,
  ])

  // Local skill creation
  const handleCreateLocal = useCallback(async () => {
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
            .map((t) => t.id)
          const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
            .map((id) => tools.find((t) => t.id === id))
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
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setLoadingStartAt(null)
    }
  }, [
    localPath,
    localName,
    invokeTauri,
    tools,
    syncTargets,
    isInstalled,
    uniqueToolIdsBySkillsDir,
    isSkillNameTaken,
    loadManagedSkills,
    t,
    setLocalPath,
    setLocalName,
    setLocalCandidates,
    setLocalCandidatesBasePath,
    setLocalCandidateSelected,
    setShowLocalPickModal,
    setShowAddModal,
  ])

  // Git skill creation
  const handleCreateGit = useCallback(async () => {
    if (!gitUrl.trim()) {
      setError(t('errors.requireGitUrl'))
      return
    }
    setLoading(true)
    setLoadingStartAt(Date.now())
    setError(null)
    setActionMessage(t('actions.creatingGitSkill'))
    try {
      const url = gitUrl.trim()
      const isFolderUrl = url.includes('/tree/') || url.includes('/blob/')

      if (isFolderUrl) {
        const created = await invokeTauri<InstallResultDto>('install_git', {
          repoUrl: url,
          name: gitName.trim() || undefined,
        })
        {
          const selectedInstalledIds = tools
            .filter((tool) => syncTargets[tool.id] && isInstalled(tool.id))
            .map((t) => t.id)
          const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
            .map((id) => tools.find((t) => t.id === id))
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
              .filter((tool) => syncTargets[tool.id] && isInstalled(tool.id))
              .map((t) => t.id)
            const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
              .map((id) => tools.find((t) => t.id === id))
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
        } else if (autoSelectSkillName) {
          const target = autoSelectSkillName.toLowerCase()
          const containMatches = candidates.filter((c) => {
            const n = c.name.toLowerCase()
            return target.includes(n) || n.includes(target)
          })
          const match =
            candidates.find((c) => c.name.toLowerCase() === target) ??
            (containMatches.length === 1 ? containMatches[0] : undefined)
          setAutoSelectSkillName(null)
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
                .filter((tool) => syncTargets[tool.id] && isInstalled(tool.id))
                .map((t) => t.id)
              const targets = uniqueToolIdsBySkillsDir(selectedInstalledIds)
                .map((id) => tools.find((t) => t.id === id))
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
  }, [
    gitUrl,
    gitName,
    autoSelectSkillName,
    invokeTauri,
    tools,
    syncTargets,
    isInstalled,
    uniqueToolIdsBySkillsDir,
    isSkillNameTaken,
    loadManagedSkills,
    t,
    setGitUrl,
    setGitName,
    setGitCandidates,
    setGitCandidatesRepoUrl,
    setGitCandidateSelected,
    setShowGitPickModal,
    setShowAddModal,
  ])

  // Explore install handler
  const handleExploreInstall = useCallback(
    (sourceUrl: string, skillName?: string) => {
      setGitUrl(sourceUrl)
      if (skillName) setAutoSelectSkillName(skillName)
      if (toolStatus) {
        const targets: Record<string, boolean> = {}
        for (const id of toolStatus.installed) {
          targets[id] = true
        }
        setSyncTargets(targets)
      }
      exploreInstallUrlRef.current = sourceUrl
      setExploreInstallTrigger((n) => n + 1)
    },
    [toolStatus, setGitUrl],
  )

  useEffect(() => {
    if (exploreInstallTrigger > 0 && exploreInstallUrlRef.current && !loading) {
      exploreInstallUrlRef.current = null
      void handleCreateGit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreInstallTrigger])

  // Install selected local candidates
  const handleInstallSelectedLocalCandidates = useCallback(async () => {
    const selected = localCandidates.filter(
      (c) => c.valid && localCandidateSelected[c.subpath],
    )
    if (selected.length === 0) {
      setError(t('errors.selectAtLeastOneSkill'))
      return
    }
    if (selected.length > 1 && localName.trim()) {
      setError(t('errors.multiSelectNoCustomName'))
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
        setError(t('errors.duplicateSelectedSkills', { name: dup.name }))
        return
      }
    }
    const desiredName =
      selected.length === 1 && localName.trim()
        ? localName.trim()
        : selected[0].name
    if (selected.length === 1 && isSkillNameTaken(desiredName)) {
      setError(t('errors.skillAlreadyExists', { name: desiredName }))
      return
    }
    const duplicated = selected.find((c) => isSkillNameTaken(c.name))
    if (selected.length > 1 && duplicated) {
      setError(t('errors.skillAlreadyExists', { name: duplicated.name }))
      return
    }

    setLoading(true)
    setLoadingStartAt(Date.now())
    setError(null)
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
              basePath: localCandidatesBasePath,
              subpath: candidate.subpath,
              name: localName.trim() || undefined,
            },
          )
          {
            const selectedInstalledIds = tools
              .filter((tool) => syncTargets[tool.id] && isInstalled(tool.id))
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
  }, [
    localCandidates,
    localCandidateSelected,
    localName,
    localCandidatesBasePath,
    invokeTauri,
    tools,
    syncTargets,
    isInstalled,
    uniqueToolIdsBySkillsDir,
    isSkillNameTaken,
    loadManagedSkills,
    t,
    setShowLocalPickModal,
    setLocalCandidates,
    setLocalCandidateSelected,
    setLocalCandidatesBasePath,
    setLocalPath,
    setLocalName,
    setShowAddModal,
  ])

  // Install selected git candidates
  const handleInstallSelectedCandidates = useCallback(async () => {
    const selected = gitCandidates.filter((c) => gitCandidateSelected[c.subpath])
    if (selected.length === 0) {
      setError(t('errors.selectAtLeastOneSkill'))
      return
    }
    const duplicated = selected.find((c) => isSkillNameTaken(c.name))
    if (duplicated) {
      setError(t('errors.skillAlreadyExists', { name: duplicated.name }))
      return
    }
    if (selected.length > 1 && gitName.trim()) {
      setError(t('errors.multiSelectNoCustomName'))
      return
    }

    setLoading(true)
    setLoadingStartAt(Date.now())
    setError(null)
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
              repoUrl: gitCandidatesRepoUrl,
              subpath: candidate.subpath,
              name: gitName.trim() || undefined,
            },
          )
          {
            const selectedInstalledIds = tools
              .filter((tool) => syncTargets[tool.id] && isInstalled(tool.id))
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
  }, [
    gitCandidates,
    gitCandidateSelected,
    gitName,
    gitCandidatesRepoUrl,
    invokeTauri,
    tools,
    syncTargets,
    isInstalled,
    uniqueToolIdsBySkillsDir,
    isSkillNameTaken,
    loadManagedSkills,
    t,
    setShowGitPickModal,
    setGitCandidates,
    setGitCandidateSelected,
    setGitCandidatesRepoUrl,
    setGitUrl,
    setGitName,
    setShowAddModal,
  ])

  // Delete managed skill
  const handleDeleteManaged = useCallback(async (skill: ManagedSkill) => {
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
      setPendingDeleteId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
      setLoadingStartAt(null)
    }
  }, [invokeTauri, loadManagedSkills, t, setPendingDeleteId])

  // Sync all managed to tools
  const handleSyncAllManagedToTools = useCallback(
    async (toolIds: string[]) => {
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
      managedSkills,
      t,
      tools,
      uniqueToolIdsBySkillsDir,
    ],
  )

  // Sync new tools
  const handleSyncAllNewTools = useCallback(() => {
    if (!toolStatus) return
    setSyncTargets((prev) => {
      const next = { ...prev }
      for (const id of toolStatus.newly_installed) {
        const shared = sharedToolIdsByToolId[id] ?? [id]
        for (const sid of shared) next[sid] = true
      }
      return next
    })
    setShowNewToolsModal(false)
    void handleSyncAllManagedToTools(toolStatus.newly_installed)
  }, [handleSyncAllManagedToTools, sharedToolIdsByToolId, toolStatus, setShowNewToolsModal])

  // Toggle tool for skill
  const runToggleToolForSkill = useCallback(
    async (skill: ManagedSkill, toolId: string) => {
      if (loading) return
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
    [invokeTauri, loadManagedSkills, loading, t, tools],
  )

  const handleToggleToolForSkill = useCallback(
    (skill: ManagedSkill, toolId: string) => {
      if (loading) return
      const shared = sharedToolIdsByToolId[toolId] ?? null
      if (shared && shared.length > 1) {
        setPendingSharedToggle({ skill, toolId })
        return
      }
      void runToggleToolForSkill(skill, toolId)
    },
    [loading, runToggleToolForSkill, sharedToolIdsByToolId, setPendingSharedToggle],
  )

  // Update managed skill
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
    [invokeTauri, loadManagedSkills, t],
  )

  const handleUpdateSkill = useCallback(
    (skill: ManagedSkill) => {
      void handleUpdateManaged(skill)
    },
    [handleUpdateManaged],
  )

  // Shared confirm
  const handleSharedConfirm = useCallback(() => {
    if (!pendingSharedToggle) return
    const payload = pendingSharedToggle
    setPendingSharedToggle(null)
    void runToggleToolForSkill(payload.skill, payload.toolId)
  }, [pendingSharedToggle, setPendingSharedToggle, runToggleToolForSkill])

  // Update handlers
  const handleDismissUpdate = useCallback(() => {
    setUpdateAvailableVersion(null)
    setUpdateBody(null)
  }, [])

  const handleDismissUpdateForever = useCallback(() => {
    if (updateAvailableVersion) {
      localStorage.setItem('skills-ignored-update-version', updateAvailableVersion)
    }
    setUpdateAvailableVersion(null)
    setUpdateBody(null)
  }, [updateAvailableVersion])

  const handleUpdateNow = useCallback(async () => {
    const update = updateObjRef.current
    if (!update) return
    setUpdateInstalling(true)
    try {
      await update.downloadAndInstall()
      setUpdateInstalling(false)
      setUpdateDone(true)
    } catch (err) {
      setUpdateInstalling(false)
      toast.error(err instanceof Error ? err.message : String(err), { duration: 3200 })
    }
  }, [])

  // Render
  return (
    <div className="skills-app">
      <Toaster
        position="top-right"
        richColors
        toastOptions={{ duration: 1800 }}
      />
      <LoadingOverlay
        loading={loading}
        actionMessage={actionMessage}
        loadingStartAt={loadingStartAt}
        onCancel={handleCancelLoading}
        t={t}
      />

      <Header
        language={language}
        loading={loading}
        activeView={activeView}
        onToggleLanguage={toggleLanguage}
        onOpenSettings={handleOpenSettings}
        onViewChange={handleViewChange}
        t={t}
      />

      <main className="skills-main">
        {activeView === 'detail' && detailSkill ? (
          <SkillDetailView
            skill={detailSkill}
            onBack={handleBackToList}
            invokeTauri={invokeTauri}
            formatRelative={formatRelative}
            t={t}
          />
        ) : activeView === 'myskills' ? (
          <div className="dashboard-stack">
            <FilterBar
              sortBy={sortBy}
              searchQuery={searchQuery}
              loading={loading}
              onSortChange={handleSortChange}
              onSearchChange={handleSearchChange}
              onRefresh={handleRefresh}
              t={t}
            />
            <SkillsList
              plan={plan}
              visibleSkills={visibleSkills}
              installedTools={installedTools}
              loading={loading}
              getGithubInfo={getGithubInfo}
              getSkillSourceLabel={getSkillSourceLabel}
              formatRelative={formatRelative}
              onReviewImport={handleReviewImport}
              onUpdateSkill={handleUpdateSkill}
              onDeleteSkill={handleDeletePrompt}
              onToggleTool={handleToggleToolForSkill}
              onOpenDetail={handleOpenDetail}
              t={t}
            />
          </div>
        ) : activeView === 'settings' ? (
          <SettingsPage
            isTauri={isTauri}
            language={language}
            storagePath={storagePath}
            gitCacheCleanupDays={gitCacheCleanupDays}
            gitCacheTtlSecs={gitCacheTtlSecs}
            themePreference={themePreference}
            onPickStoragePath={handlePickStoragePath}
            onToggleLanguage={toggleLanguage}
            onThemeChange={handleThemeChange}
            onGitCacheCleanupDaysChange={handleGitCacheCleanupDaysChange}
            onGitCacheTtlSecsChange={handleGitCacheTtlSecsChange}
            onClearGitCacheNow={handleClearGitCacheNow}
            githubToken={githubToken}
            onGithubTokenChange={handleGithubTokenChange}
            onBack={handleCloseSettings}
            t={t}
          />
        ) : (
          <ExplorePage
            featuredSkills={featuredSkills}
            featuredLoading={featuredLoading}
            exploreFilter={exploreFilter}
            searchResults={searchResults}
            searchLoading={searchLoading}
            managedSkills={managedSkills}
            loading={loading}
            onExploreFilterChange={handleExploreFilterChange}
            onInstallSkill={handleExploreInstall}
            onOpenManualAdd={handleOpenAdd}
            t={t}
          />
        )}
      </main>

      <AddSkillModal
        open={showAddModal}
        loading={loading}
        canClose={!loading}
        addModalTab={addModalTab}
        localPath={localPath}
        localName={localName}
        gitUrl={gitUrl}
        gitName={gitName}
        syncTargets={syncTargets}
        installedTools={installedTools}
        toolStatus={toolStatus}
        onRequestClose={handleCloseAdd}
        onTabChange={setAddModalTab}
        onLocalPathChange={setLocalPath}
        onPickLocalPath={handlePickLocalPath}
        onLocalNameChange={setLocalName}
        onGitUrlChange={setGitUrl}
        onGitNameChange={setGitName}
        onSyncTargetChange={handleSyncTargetChange}
        onSubmit={addModalTab === 'local' ? handleCreateLocal : handleCreateGit}
        t={t}
      />

      {showImportModal && plan ? (
        <ImportModal
          open={showImportModal}
          loading={loading}
          plan={plan}
          selected={selected}
          variantChoice={variantChoice}
          onRequestClose={handleCloseImport}
          onToggleAll={toggleAll}
          onToggleGroup={handleToggleGroup}
          onSelectVariant={handleSelectVariant}
          onImport={handleImport}
          t={t}
        />
      ) : null}

      <SharedDirModal
        open={Boolean(pendingSharedToggle)}
        loading={loading}
        toolLabel={pendingSharedLabels?.toolLabel ?? ''}
        otherLabels={pendingSharedLabels?.otherLabels ?? ''}
        onRequestClose={handleSharedCancel}
        onConfirm={handleSharedConfirm}
        t={t}
      />

      <NewToolsModal
        open={Boolean(showNewToolsModal && newlyInstalledToolsText)}
        loading={loading}
        toolsLabelText={newlyInstalledToolsText}
        onLater={handleCloseNewTools}
        onSyncAll={handleSyncAllNewTools}
        t={t}
      />

      <DeleteModal
        open={Boolean(pendingDeleteId)}
        loading={loading}
        skillName={pendingDeleteSkill?.name ?? null}
        onRequestClose={handleCloseDelete}
        onConfirm={() => {
          if (pendingDeleteSkill) void handleDeleteManaged(pendingDeleteSkill)
        }}
        t={t}
      />

      <LocalPickModal
        open={showLocalPickModal}
        loading={loading}
        localCandidates={localCandidates}
        localCandidateSelected={localCandidateSelected}
        onRequestClose={handleCloseLocalPick}
        onCancel={handleCancelLocalPick}
        onToggleAll={handleToggleAllLocalCandidates}
        onToggleCandidate={handleToggleLocalCandidate}
        onInstall={handleInstallSelectedLocalCandidates}
        t={t}
      />

      <GitPickModal
        open={showGitPickModal}
        loading={loading}
        gitCandidates={gitCandidates}
        gitCandidateSelected={gitCandidateSelected}
        onRequestClose={handleCloseGitPick}
        onCancel={handleCancelGitPick}
        onToggleAll={handleToggleAllGitCandidates}
        onToggleCandidate={handleToggleGitCandidate}
        onInstall={handleInstallSelectedCandidates}
        t={t}
      />

      {updateAvailableVersion && (
        <div className="modal-backdrop" onClick={updateInstalling ? undefined : handleDismissUpdate}>
          <div
            className="modal update-modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            {!updateInstalling && !updateDone && (
              <button
                className="modal-close update-modal-close"
                type="button"
                onClick={handleDismissUpdate}
                aria-label={t('close')}
              >
                ✕
              </button>
            )}
            <div className="update-modal-body">
              <div className="update-modal-title">
                {updateDone ? t('updateInstalledRestart') : t('updateAvailable')}
              </div>
              {!updateDone && (
                <div className="update-modal-text">
                  {t('updateBannerText', { version: updateAvailableVersion })}
                </div>
              )}
              {!updateDone && updateBody && (
                <div className="update-modal-notes">
                  <Markdown remarkPlugins={[remarkGfm]}>{updateBody}</Markdown>
                </div>
              )}
            </div>
            <div className="update-modal-actions">
              {updateDone ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={handleDismissUpdate}
                >
                  {t('done')}
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={updateInstalling}
                    onClick={handleUpdateNow}
                  >
                    {updateInstalling ? t('installingUpdate') : t('updateNow')}
                  </button>
                  {!updateInstalling && (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={handleDismissUpdateForever}
                    >
                      {t('updateBannerDismiss')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App