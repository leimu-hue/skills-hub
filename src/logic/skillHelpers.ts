import type { ManagedSkill } from '../types'

export function getSkillSourceLabel(skill: ManagedSkill): string {
  const key = skill.source_type.toLowerCase()
  if (key.includes('git') && skill.source_ref) {
    return skill.source_ref
  }
  return skill.central_path
}

export function getGithubInfo(url: string | null | undefined): {
  label: string
  href: string
} | null {
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

export type FormatRelativeFn = (ms: number | null | undefined) => string

export function createFormatRelative(t: (key: string, options?: Record<string, unknown>) => string): FormatRelativeFn {
  return (ms: number | null | undefined): string => {
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
}
