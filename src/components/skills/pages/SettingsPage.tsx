import { memo, useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import type { TFunction } from 'i18next'
import {
  canCheckForUpdatesAgain,
  type UpdateViewState,
} from '../../../logic/updateViewState'

type SettingsPageProps = {
  isTauri: boolean
  language: string
  storagePath: string
  gitCacheCleanupDays: number
  gitCacheTtlSecs: number
  themePreference: 'system' | 'light' | 'dark'
  githubToken: string
  onPickStoragePath: () => void
  onToggleLanguage: () => void
  onThemeChange: (nextTheme: 'system' | 'light' | 'dark') => void
  onGitCacheCleanupDaysChange: (nextDays: number) => void
  onGitCacheTtlSecsChange: (nextSecs: number) => void
  onClearGitCacheNow: () => void
  onGithubTokenChange: (token: string) => void
  appVersion: string | null
  updateViewState: UpdateViewState
  updateVersion: string | null
  updateError: string | null
  onCheckForUpdates: () => void
  onInstallUpdate: () => void
  onBack: () => void
  t: TFunction
}

const SettingsPage = ({
  isTauri,
  language,
  storagePath,
  gitCacheCleanupDays,
  gitCacheTtlSecs,
  themePreference,
  onPickStoragePath,
  onToggleLanguage,
  onThemeChange,
  onGitCacheCleanupDaysChange,
  onGitCacheTtlSecsChange,
  onClearGitCacheNow,
  githubToken,
  onGithubTokenChange,
  appVersion,
  updateViewState,
  updateVersion,
  updateError,
  onCheckForUpdates,
  onInstallUpdate,
  onBack,
  t,
}: SettingsPageProps) => {
  const [localToken, setLocalToken] = useState(githubToken)
  useEffect(() => {
    setLocalToken(githubToken)
  }, [githubToken])

  const versionText = (() => {
    if (!isTauri) return t('notAvailable')
    if (!appVersion) return t('unknown')
    return `v${appVersion}`
  })()

  return (
    <div className="settings-page">
      <div className="detail-header">
        <button className="detail-back-btn" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          {t('detail.back')}
        </button>
        <div className="detail-skill-name">{t('settings')}</div>
      </div>
      <div className="settings-page-body">
        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-language">
            {t('interfaceLanguage')}
          </label>
          <div className="settings-select-wrap">
            <select
              id="settings-language"
              className="settings-select"
              value={language}
              onChange={(event) => {
                if (event.target.value !== language) {
                  onToggleLanguage()
                }
              }}
            >
              <option value="en">{t('languageOptions.en')}</option>
              <option value="zh">{t('languageOptions.zh')}</option>
            </select>
            <svg
              className="settings-select-caret"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label" id="settings-theme-label">
            {t('themeMode')}
          </label>
          <div className="settings-theme-options" role="group" aria-labelledby="settings-theme-label">
            <button
              type="button"
              className={`settings-theme-btn ${
                themePreference === 'system' ? 'active' : ''
              }`}
              aria-pressed={themePreference === 'system'}
              onClick={() => onThemeChange('system')}
            >
              {t('themeOptions.system')}
            </button>
            <button
              type="button"
              className={`settings-theme-btn ${
                themePreference === 'light' ? 'active' : ''
              }`}
              aria-pressed={themePreference === 'light'}
              onClick={() => onThemeChange('light')}
            >
              {t('themeOptions.light')}
            </button>
            <button
              type="button"
              className={`settings-theme-btn ${
                themePreference === 'dark' ? 'active' : ''
              }`}
              aria-pressed={themePreference === 'dark'}
              onClick={() => onThemeChange('dark')}
            >
              {t('themeOptions.dark')}
            </button>
          </div>
        </div>

        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-storage">
            {t('skillsStoragePath')}
          </label>
          <div className="settings-input-row">
            <input
              id="settings-storage"
              className="settings-input mono"
              value={storagePath}
              readOnly
            />
            <button
              className="btn btn-secondary settings-browse"
              type="button"
              onClick={onPickStoragePath}
            >
              {t('browse')}
            </button>
          </div>
          <div className="settings-helper">{t('skillsStorageHint')}</div>
        </div>

        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-git-cache-days">
            {t('gitCacheCleanupDays')}
          </label>
          <div className="settings-input-row">
            <input
              id="settings-git-cache-days"
              className="settings-input"
              type="number"
              min={0}
              max={3650}
              step={1}
              value={gitCacheCleanupDays}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (!Number.isNaN(next)) {
                  onGitCacheCleanupDaysChange(next)
                }
              }}
            />
            <button
              className="btn btn-secondary settings-browse"
              type="button"
              onClick={onClearGitCacheNow}
            >
              {t('cleanNow')}
            </button>
          </div>
          <div className="settings-helper">{t('gitCacheCleanupHint')}</div>
        </div>

        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-git-cache-ttl">
            {t('gitCacheTtlSecs')}
          </label>
          <div className="settings-input-row">
            <input
              id="settings-git-cache-ttl"
              className="settings-input"
              type="number"
              min={0}
              max={3600}
              step={1}
              value={gitCacheTtlSecs}
              onChange={(event) => {
                const next = Number(event.target.value)
                if (!Number.isNaN(next)) {
                  onGitCacheTtlSecsChange(next)
                }
              }}
            />
          </div>
          <div className="settings-helper">{t('gitCacheTtlHint')}</div>
        </div>

        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-github-token">
            {t('githubToken')}
          </label>
          <div className="settings-input-row">
            <input
              id="settings-github-token"
              className="settings-input mono"
              type="password"
              placeholder={t('githubTokenPlaceholder')}
              value={localToken}
              onChange={(e) => setLocalToken(e.target.value)}
              onBlur={() => {
                if (localToken !== githubToken) {
                  onGithubTokenChange(localToken)
                }
              }}
            />
          </div>
          <div className="settings-helper">{t('githubTokenHint')}</div>
        </div>

        <div className="settings-field settings-update-section">
          <label className="settings-label">{t('appUpdates')}</label>
          <div className="settings-version-row">
            <span className="settings-version-text">
              {t('appName')} {versionText}
            </span>
            {isTauri && canCheckForUpdatesAgain(updateViewState) && (
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={onCheckForUpdates}
              >
                {t('checkForUpdates')}
              </button>
            )}
            {updateViewState === 'checking' && (
              <span className="settings-update-status">{t('checkingUpdates')}</span>
            )}
            {updateViewState === 'up-to-date' && (
              <span className="settings-update-status settings-update-ok">{t('updateNotAvailable')}</span>
            )}
          </div>
          {updateViewState === 'available' && updateVersion && (
            <div className="settings-update-available">
              <span>{t('updateAvailableWithVersion', { version: updateVersion })}</span>
              <button
                className="btn btn-primary btn-sm"
                type="button"
                onClick={onInstallUpdate}
              >
                {t('downloadAndInstall')}
              </button>
            </div>
          )}
          {updateViewState === 'installing' && (
            <div className="settings-update-status">{t('installingUpdate')}</div>
          )}
          {updateViewState === 'done' && (
            <div className="settings-update-ok">{t('updateInstalledRestart')}</div>
          )}
          {updateViewState === 'error' && (
            <div className="settings-update-error">
              <span>{updateError}</span>
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                onClick={onCheckForUpdates}
              >
                {t('checkForUpdates')}
              </button>
            </div>
          )}
          <div className="settings-helper">{t('updateHint')}</div>
        </div>

      </div>
    </div>
  )
}

export default memo(SettingsPage)
