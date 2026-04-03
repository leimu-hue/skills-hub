
import { MessageCircle, Plus, Compass } from 'lucide-react'
import type { TFunction } from 'i18next'
import type { ManagedSkill, OnboardingPlan, ToolOption } from '../../../types'
import SkillCard from './SkillCard'

type GithubInfo = {
  label: string
  href: string
}

type SkillsListProps = {
  plan: OnboardingPlan | null
  visibleSkills: ManagedSkill[]
  installedTools: ToolOption[]
  loading: boolean
  getGithubInfo: (url: string | null | undefined) => GithubInfo | null
  getSkillSourceLabel: (skill: ManagedSkill) => string
  formatRelative: (ms: number | null | undefined) => string
  onReviewImport: () => void
  onAddSkill: () => void
  onExplore: () => void
  onUpdateSkill: (skill: ManagedSkill) => void
  onDeleteSkill: (skillId: string) => void
  onToggleTool: (skill: ManagedSkill, toolId: string) => void
  onOpenDetail: (skill: ManagedSkill) => void
  t: TFunction
}

const SkillsList = ({
  plan,
  visibleSkills,
  installedTools,
  loading,
  getGithubInfo,
  getSkillSourceLabel,
  formatRelative,
  onReviewImport,
  onAddSkill,
  onExplore,
  onUpdateSkill,
  onDeleteSkill,
  onToggleTool,
  onOpenDetail,
  t,
}: SkillsListProps) => {
  return (
    <div className="skills-list">
      {plan && plan.total_skills_found > 0 ? (
        <div className="discovered-banner">
          <div className="banner-left">
            <div className="banner-icon">
              <MessageCircle size={18} />
            </div>
            <div className="banner-content">
              <div className="banner-title">{t('discoveredTitle')}</div>
              <div className="banner-subtitle">
                {t('discoveredCount', { count: plan.total_skills_found })}
              </div>
            </div>
          </div>
          <button
            className="btn btn-warning"
            type="button"
            onClick={onReviewImport}
            disabled={loading}
          >
            {t('reviewImport')}
          </button>
        </div>
      ) : null}

      {visibleSkills.length === 0 ? (
        <div className="empty">
          <div className="empty-illustration">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
              <rect width="80" height="80" rx="20" fill="url(#gradient)" fillOpacity="0.1"/>
              <rect x="20" y="20" width="40" height="40" rx="8" stroke="url(#gradient)" strokeWidth="2" fill="none"/>
              <path d="M32 40L40 32L48 40L40 48L32 40Z" stroke="url(#gradient)" strokeWidth="2" fill="none"/>
              <circle cx="40" cy="40" r="6" fill="url(#gradient)" fillOpacity="0.3"/>
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="80" y2="80">
                  <stop offset="0%" stopColor="#2563eb"/>
                  <stop offset="50%" stopColor="#9333ea"/>
                  <stop offset="100%" stopColor="#ea580c"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="empty-title">{t('skillsEmpty')}</div>
          <div className="empty-desc">
            {plan && plan.total_skills_found > 0
              ? t('discoveredHint')
              : t('skillsEmptyHint')}
          </div>
          <div className="empty-actions">
            <button
              className="btn btn-primary"
              type="button"
              onClick={onAddSkill}
            >
              <Plus size={16} />
              {t('addSkill')}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={onExplore}
            >
              <Compass size={16} />
              {t('navExplore')}
            </button>
          </div>
        </div>
      ) : (
        <>
          {visibleSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              installedTools={installedTools}
              loading={loading}
              getGithubInfo={getGithubInfo}
              getSkillSourceLabel={getSkillSourceLabel}
              formatRelative={formatRelative}
              onUpdate={onUpdateSkill}
              onDelete={onDeleteSkill}
              onToggleTool={onToggleTool}
              onOpenDetail={onOpenDetail}
              t={t}
            />
          ))}
        </>
      )}
    </div>
  )
}

export default SkillsList
