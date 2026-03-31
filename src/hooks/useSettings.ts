import { useState, useCallback, useEffect } from 'react'

interface UseSettingsOptions {
  invokeTauri: <T,>(command: string, args?: Record<string, unknown>) => Promise<T>
  isTauri: boolean
  t: (key: string, options?: Record<string, unknown>) => string
}

interface UseSettingsReturn {
  storagePath: string
  gitCacheCleanupDays: number
  gitCacheTtlSecs: number
  githubToken: string
  handlePickStoragePath: () => Promise<void>
  handleGitCacheCleanupDaysChange: (days: number) => Promise<void>
  handleGitCacheTtlSecsChange: (secs: number) => Promise<void>
  handleGithubTokenChange: (token: string) => Promise<void>
  handleClearGitCacheNow: () => Promise<void>
}

export function useSettings({ invokeTauri, isTauri, t }: UseSettingsOptions): UseSettingsReturn {
  const [storagePath, setStoragePath] = useState<string>(t('notAvailable'))
  const [gitCacheCleanupDays, setGitCacheCleanupDays] = useState<number>(30)
  const [gitCacheTtlSecs, setGitCacheTtlSecs] = useState<number>(60)
  const [githubToken, setGithubToken] = useState<string>('')

  useEffect(() => {
    if (!isTauri) return
    invokeTauri<string>('get_central_repo_path')
      .then((path) => setStoragePath(path))
      .catch((err) => console.error(err))
  }, [isTauri, invokeTauri])

  useEffect(() => {
    if (!isTauri) return
    invokeTauri<number>('get_git_cache_cleanup_days')
      .then((days) => setGitCacheCleanupDays(days))
      .catch((err) => console.error(err))
  }, [isTauri, invokeTauri])

  useEffect(() => {
    if (!isTauri) return
    invokeTauri<number>('get_git_cache_ttl_secs')
      .then((secs) => setGitCacheTtlSecs(secs))
      .catch((err) => console.error(err))
  }, [isTauri, invokeTauri])

  useEffect(() => {
    if (!isTauri) return
    invokeTauri<string>('get_github_token')
      .then((token) => setGithubToken(token))
      .catch(() => {})
  }, [isTauri, invokeTauri])

  const handlePickStoragePath = useCallback(async () => {
    if (!isTauri) return
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('selectStoragePath'),
      })
      if (!selected || Array.isArray(selected)) return
      const newPath = await invokeTauri<string>('set_central_repo_path', {
        path: selected,
      })
      setStoragePath(newPath)
    } catch (err) {
      console.error(err)
    }
  }, [invokeTauri, isTauri, t])

  const handleGitCacheCleanupDaysChange = useCallback(
    async (nextDays: number) => {
      const normalized = Math.max(0, Math.min(nextDays, 3650))
      setGitCacheCleanupDays(normalized)
      if (!isTauri) return
      try {
        const updated = await invokeTauri<number>('set_git_cache_cleanup_days', {
          days: normalized,
        })
        setGitCacheCleanupDays(updated)
      } catch (err) {
        console.error(err)
      }
    },
    [invokeTauri, isTauri],
  )

  const handleGitCacheTtlSecsChange = useCallback(
    async (nextSecs: number) => {
      const normalized = Math.max(0, Math.min(nextSecs, 3600))
      setGitCacheTtlSecs(normalized)
      if (!isTauri) return
      try {
        const updated = await invokeTauri<number>('set_git_cache_ttl_secs', {
          secs: normalized,
        })
        setGitCacheTtlSecs(updated)
      } catch (err) {
        console.error(err)
      }
    },
    [invokeTauri, isTauri],
  )

  const handleGithubTokenChange = useCallback(
    async (nextToken: string) => {
      setGithubToken(nextToken)
      if (!isTauri) return
      try {
        await invokeTauri('set_github_token', { token: nextToken })
      } catch (err) {
        console.error(err)
      }
    },
    [invokeTauri, isTauri],
  )

  const handleClearGitCacheNow = useCallback(async () => {
    if (!isTauri) return
    try {
      await invokeTauri<number>('clear_git_cache_now')
    } catch (err) {
      console.error(err)
    }
  }, [invokeTauri, isTauri])

  return {
    storagePath,
    gitCacheCleanupDays,
    gitCacheTtlSecs,
    githubToken,
    handlePickStoragePath,
    handleGitCacheCleanupDaysChange,
    handleGitCacheTtlSecsChange,
    handleGithubTokenChange,
    handleClearGitCacheNow,
  }
}