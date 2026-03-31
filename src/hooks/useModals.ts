import { useState, useCallback } from 'react'
import type { ManagedSkill } from '../types'

interface UseModalsReturn {
  // Modal states
  showAddModal: boolean
  showImportModal: boolean
  showNewToolsModal: boolean
  showGitPickModal: boolean
  showLocalPickModal: boolean
  pendingDeleteId: string | null
  pendingSharedToggle: { skill: ManagedSkill; toolId: string } | null

  // Modal setters
  setShowAddModal: (show: boolean) => void
  setShowImportModal: (show: boolean) => void
  setShowNewToolsModal: (show: boolean) => void
  setShowGitPickModal: (show: boolean) => void
  setShowLocalPickModal: (show: boolean) => void
  setPendingDeleteId: (id: string | null) => void
  setPendingSharedToggle: (val: { skill: ManagedSkill; toolId: string } | null) => void

  // Modal handlers
  handleCloseAdd: () => void
  handleCloseImport: () => void
  handleCloseNewTools: () => void
  handleCloseGitPick: () => void
  handleCloseDelete: () => void
  handleCancelGitPick: () => void
  handleCloseLocalPick: () => void
  handleCancelLocalPick: () => void
  handleDeletePrompt: (skillId: string) => void
  handleSharedCancel: () => void

  // Modal form states
  localPath: string
  localName: string
  gitUrl: string
  gitName: string
  addModalTab: 'local' | 'git'
  setLocalPath: (path: string) => void
  setLocalName: (name: string) => void
  setGitUrl: (url: string) => void
  setGitName: (name: string) => void
  setAddModalTab: (tab: 'local' | 'git') => void

  // Git candidates
  gitCandidates: { subpath: string; name: string }[]
  gitCandidatesRepoUrl: string
  gitCandidateSelected: Record<string, boolean>
  setGitCandidates: (candidates: { subpath: string; name: string }[] | ((prev: { subpath: string; name: string }[]) => { subpath: string; name: string }[])) => void
  setGitCandidatesRepoUrl: (url: string) => void
  setGitCandidateSelected: (selected: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void

  // Local candidates
  localCandidates: { subpath: string; name: string; valid: boolean }[]
  localCandidatesBasePath: string
  localCandidateSelected: Record<string, boolean>
  setLocalCandidates: (candidates: { subpath: string; name: string; valid: boolean }[] | ((prev: { subpath: string; name: string; valid: boolean }[]) => { subpath: string; name: string; valid: boolean }[])) => void
  setLocalCandidatesBasePath: (path: string) => void
  setLocalCandidateSelected: (selected: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void
}

export function useModals(): UseModalsReturn {
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showNewToolsModal, setShowNewToolsModal] = useState(false)
  const [showGitPickModal, setShowGitPickModal] = useState(false)
  const [showLocalPickModal, setShowLocalPickModal] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingSharedToggle, setPendingSharedToggle] = useState<{
    skill: ManagedSkill
    toolId: string
  } | null>(null)

  // Modal form states
  const [localPath, setLocalPath] = useState('')
  const [localName, setLocalName] = useState('')
  const [gitUrl, setGitUrl] = useState('')
  const [gitName, setGitName] = useState('')
  const [addModalTab, setAddModalTab] = useState<'local' | 'git'>('git')

  // Git candidates
  const [gitCandidates, setGitCandidates] = useState<{ subpath: string; name: string }[]>([])
  const [gitCandidatesRepoUrl, setGitCandidatesRepoUrl] = useState('')
  const [gitCandidateSelected, setGitCandidateSelected] = useState<Record<string, boolean>>({})

  // Local candidates
  const [localCandidates, setLocalCandidates] = useState<{
    subpath: string
    name: string
    valid: boolean
  }[]>([])
  const [localCandidatesBasePath, setLocalCandidatesBasePath] = useState('')
  const [localCandidateSelected, setLocalCandidateSelected] = useState<Record<string, boolean>>({})

  // Modal handlers
  const handleCloseAdd = useCallback(() => setShowAddModal(false), [])
  const handleCloseImport = useCallback(() => setShowImportModal(false), [])
  const handleCloseNewTools = useCallback(() => setShowNewToolsModal(false), [])
  const handleCloseGitPick = useCallback(() => setShowGitPickModal(false), [])
  const handleCloseDelete = useCallback(() => setPendingDeleteId(null), [])
  const handleCloseLocalPick = useCallback(() => setShowLocalPickModal(false), [])

  const handleCancelGitPick = useCallback(() => {
    setShowGitPickModal(false)
    setGitCandidates([])
    setGitCandidateSelected({})
    setGitCandidatesRepoUrl('')
  }, [])

  const handleCancelLocalPick = useCallback(() => {
    setShowLocalPickModal(false)
    setLocalCandidates([])
    setLocalCandidateSelected({})
    setLocalCandidatesBasePath('')
  }, [])

  const handleDeletePrompt = useCallback((skillId: string) => {
    setPendingDeleteId(skillId)
  }, [])

  const handleSharedCancel = useCallback(() => {
    setPendingSharedToggle(null)
  }, [])

  return {
    // Modal states
    showAddModal,
    showImportModal,
    showNewToolsModal,
    showGitPickModal,
    showLocalPickModal,
    pendingDeleteId,
    pendingSharedToggle,

    // Modal setters
    setShowAddModal,
    setShowImportModal,
    setShowNewToolsModal,
    setShowGitPickModal,
    setShowLocalPickModal,
    setPendingDeleteId,
    setPendingSharedToggle,

    // Modal handlers
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

    // Modal form states
    localPath,
    localName,
    gitUrl,
    gitName,
    addModalTab,
    setLocalPath,
    setLocalName,
    setGitUrl,
    setGitName,
    setAddModalTab,

    // Git candidates
    gitCandidates,
    gitCandidatesRepoUrl,
    gitCandidateSelected,
    setGitCandidates,
    setGitCandidatesRepoUrl,
    setGitCandidateSelected,

    // Local candidates
    localCandidates,
    localCandidatesBasePath,
    localCandidateSelected,
    setLocalCandidates,
    setLocalCandidatesBasePath,
    setLocalCandidateSelected,
  }
}