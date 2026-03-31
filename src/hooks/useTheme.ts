/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react'

export type ThemePreference = 'system' | 'light' | 'dark'
export type SystemTheme = 'light' | 'dark'

interface UseThemeReturn {
  themePreference: ThemePreference
  systemTheme: SystemTheme
  setThemePreference: (pref: ThemePreference) => void
  toggleLanguage: () => void
  language: string
  languageStorageKey: string
  themeStorageKey: string
}

export function useTheme(i18n: {
  changeLanguage: (lang: string) => Promise<void>
  resolvedLanguage?: string
  language: string
}): UseThemeReturn {
  const themeStorageKey = 'skills-theme'
  const languageStorageKey = 'skills-language'
  const language = i18n.resolvedLanguage ?? i18n.language ?? 'en'

  const [themePreference, setThemePreference] = useState<ThemePreference>('system')
  const [systemTheme, setSystemTheme] = useState<SystemTheme>('light')

  const toggleLanguage = useCallback(() => {
    void i18n.changeLanguage(language === 'en' ? 'zh' : 'en')
  }, [i18n, language])

  // Load theme from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(themeStorageKey)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      setThemePreference(stored)
    }
  }, [themeStorageKey])

  // Listen for system theme changes
  useEffect(() => {
    if (typeof window === 'undefined') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => {
      setSystemTheme(media.matches ? 'dark' : 'light')
    }
    update()
    if (media.addEventListener) {
      media.addEventListener('change', update)
    } else {
      media.addListener(update)
    }
    return () => {
      if (media.removeEventListener) {
        media.removeEventListener('change', update)
      } else {
        media.removeListener(update)
      }
    }
  }, [])

  // Apply theme to document
  useEffect(() => {
    if (typeof document === 'undefined') return
    const resolvedTheme = themePreference === 'system' ? systemTheme : themePreference
    document.documentElement.dataset.theme = resolvedTheme
    document.documentElement.style.colorScheme = resolvedTheme
    try {
      window.localStorage.setItem(themeStorageKey, themePreference)
    } catch {
      // ignore storage failures
    }
  }, [systemTheme, themePreference, themeStorageKey])

  // Save language to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (language !== 'en' && language !== 'zh') return
    try {
      window.localStorage.setItem(languageStorageKey, language)
    } catch {
      // ignore storage failures
    }
  }, [language, languageStorageKey])

  return {
    themePreference,
    systemTheme,
    setThemePreference,
    toggleLanguage,
    language,
    languageStorageKey,
    themeStorageKey,
  }
}