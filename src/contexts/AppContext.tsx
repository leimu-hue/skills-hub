/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react'
import type { ManagedSkill, ToolOption, OnboardingPlan, FeaturedSkillDto, OnlineSkillDto } from '../types'

// App State Types
export interface AppState {
  // View state
  activeView: 'myskills' | 'explore' | 'detail' | 'settings'
  searchQuery: string
  sortBy: 'updated' | 'name'
  detailSkill: ManagedSkill | null
  
  // Explore state
  featuredSkills: FeaturedSkillDto[]
  featuredLoading: boolean
  exploreFilter: string
  searchResults: OnlineSkillDto[]
  searchLoading: boolean
  exploreInstallTrigger: number
  
  // Loading state
  loading: boolean
  loadingStartAt: number | null
  actionMessage: string | null
  error: string | null
  
  // Update state
  updateAvailableVersion: string | null
  updateBody: string | null
  updateInstalling: boolean
  updateDone: boolean
}

export interface AppActions {
  setActiveView: (view: AppState['activeView']) => void
  setSearchQuery: (query: string) => void
  setSortBy: (sort: AppState['sortBy']) => void
  setDetailSkill: (skill: ManagedSkill | null) => void
  setFeaturedSkills: (skills: FeaturedSkillDto[]) => void
  setFeaturedLoading: (loading: boolean) => void
  setExploreFilter: (filter: string) => void
  setSearchResults: (results: OnlineSkillDto[]) => void
  setSearchLoading: (loading: boolean) => void
  setExploreInstallTrigger: (trigger: number) => void
  setLoading: (loading: boolean) => void
  setLoadingStartAt: (time: number | null) => void
  setActionMessage: (message: string | null) => void
  setError: (error: string | null) => void
  setUpdateAvailableVersion: (version: string | null) => void
  setUpdateBody: (body: string | null) => void
  setUpdateInstalling: (installing: boolean) => void
  setUpdateDone: (done: boolean) => void
}

export interface AppContextValue {
  state: AppState
  actions: AppActions
}

// Default values
const defaultState: AppState = {
  activeView: 'myskills',
  searchQuery: '',
  sortBy: 'updated',
  detailSkill: null,
  featuredSkills: [],
  featuredLoading: false,
  exploreFilter: '',
  searchResults: [],
  searchLoading: false,
  exploreInstallTrigger: 0,
  loading: false,
  loadingStartAt: null,
  actionMessage: null,
  error: null,
  updateAvailableVersion: null,
  updateBody: null,
  updateInstalling: false,
  updateDone: false,
}

const defaultActions: AppActions = {
  setActiveView: () => {},
  setSearchQuery: () => {},
  setSortBy: () => {},
  setDetailSkill: () => {},
  setFeaturedSkills: () => {},
  setFeaturedLoading: () => {},
  setExploreFilter: () => {},
  setSearchResults: () => {},
  setSearchLoading: () => {},
  setExploreInstallTrigger: () => {},
  setLoading: () => {},
  setLoadingStartAt: () => {},
  setActionMessage: () => {},
  setError: () => {},
  setUpdateAvailableVersion: () => {},
  setUpdateBody: () => {},
  setUpdateInstalling: () => {},
  setUpdateDone: () => {},
}

// Create context
const AppContext = createContext<AppContextValue>({
  state: defaultState,
  actions: defaultActions,
})

// Provider props
interface AppProviderProps {
  children: ReactNode
  value: AppContextValue
}

export function AppProvider({ children, value }: AppProviderProps) {
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// Hook
export function useAppContext() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider')
  }
  return context
}

// Re-export types for convenience
export type { ManagedSkill, ToolOption, OnboardingPlan, FeaturedSkillDto, OnlineSkillDto }