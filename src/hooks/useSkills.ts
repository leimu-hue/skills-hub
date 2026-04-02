import { useState, useCallback, useEffect } from 'react'
import type { ManagedSkill, ToolStatusDto, ToolOption } from '../types'

interface UseSkillsOptions {
  invokeTauri: <T,>(command: string, args?: Record<string, unknown>) => Promise<T>
  isTauri: boolean
}

export interface UseSkillsReturn {
  managedSkills: ManagedSkill[]
  toolStatus: ToolStatusDto | null
  tools: ToolOption[]
  installedToolIds: string[]
  installedTools: ToolOption[]
  isInstalled: (id: string) => boolean
  uniqueToolIdsBySkillsDir: (toolIds: string[]) => string[]
  sharedToolIdsByToolId: Record<string, string[]>
  toolLabelById: Record<string, string>
  loadManagedSkills: () => Promise<void>
  toolInfos: { key: string; label: string; skills_dir: string }[]
}

export function useSkills({ invokeTauri, isTauri }: UseSkillsOptions): UseSkillsReturn {
  const [managedSkills, setManagedSkills] = useState<ManagedSkill[]>([])
  const [toolStatus, setToolStatus] = useState<ToolStatusDto | null>(null)

  const loadManagedSkills = useCallback(async () => {
    try {
      const result = await invokeTauri<ManagedSkill[]>('get_managed_skills')
      setManagedSkills(result)
    } catch (err) {
      console.error('Failed to load managed skills:', err)
    }
  }, [invokeTauri])

  useEffect(() => {
    if (!isTauri) return

    const load = async () => {
      try {
        const status = await invokeTauri<ToolStatusDto>('get_tool_status')
        setToolStatus(status)
      } catch (err) {
        console.warn('Failed to load tool status:', err)
      }
    }
    void load()
  }, [isTauri, invokeTauri])

  useEffect(() => {
    if (isTauri) {
      const load = async () => {
        await loadManagedSkills()
      }
      void load()
    }
  }, [isTauri, loadManagedSkills])

  const toolInfos = toolStatus?.tools ?? []

  const tools: ToolOption[] = toolInfos.map((info) => ({
    id: info.key,
    label: info.label,
  }))

  const toolLabelById: Record<string, string> = (() => {
    const out: Record<string, string> = {}
    for (const tool of tools) out[tool.id] = tool.label
    return out
  })()

  const sharedToolIdsByToolId: Record<string, string[]> = (() => {
    const byDir: Record<string, string[]> = {}
    for (const info of toolInfos) {
      const dir = info.skills_dir
      if (!byDir[dir]) byDir[dir] = []
      byDir[dir].push(info.key)
    }
    const out: Record<string, string[]> = {}
    for (const dir of Object.keys(byDir)) {
      const ids = byDir[dir]
      if (ids.length <= 1) continue
      for (const id of ids) out[id] = ids
    }
    return out
  })()

  const uniqueToolIdsBySkillsDir = (toolIds: string[]) => {
    const wanted = new Set(toolIds)
    const seen = new Set<string>()
    const out: string[] = []
    for (const tool of toolInfos) {
      if (!wanted.has(tool.key)) continue
      if (seen.has(tool.skills_dir)) continue
      seen.add(tool.skills_dir)
      out.push(tool.key)
    }
    return out
  }

  const installedToolIds = toolStatus?.installed ?? []

  const isInstalled = (id: string) => installedToolIds.includes(id)

  const installedTools = tools.filter((tool) => installedToolIds.includes(tool.id))

  return {
    managedSkills,
    toolStatus,
    tools,
    installedToolIds,
    installedTools,
    isInstalled,
    uniqueToolIdsBySkillsDir,
    sharedToolIdsByToolId,
    toolLabelById,
    loadManagedSkills,
    toolInfos,
  }
}