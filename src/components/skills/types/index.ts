// Re-export types from global types
export * from '../../../types'

// Also export the old path for backwards compatibility during migration
export type {
  OnboardingVariant,
  OnboardingGroup,
  OnboardingPlan,
  ToolOption,
  ToolInfoDto,
  ToolStatusDto,
  ManagedSkill,
  GitSkillCandidate,
  LocalSkillCandidate,
  SkillFileEntry,
  InstallResultDto,
  UpdateResultDto,
  FeaturedSkillDto,
  OnlineSkillDto,
} from '../../../types'