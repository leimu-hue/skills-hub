import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";
import "./App.css";
import { useTranslation } from "react-i18next";
import { Toaster, toast } from "sonner";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ExplorePage from "./components/skills/pages/ExplorePage";
import FilterBar from "./components/skills/components/FilterBar";
import SkillDetailView from "./components/skills/components/SkillDetailView";
import Header from "./components/skills/Header";
import LoadingOverlay from "./components/skills/components/LoadingOverlay";
import SkillsList from "./components/skills/components/SkillsList";
import AddSkillModal from "./components/skills/modals/AddSkillModal";
import DeleteModal from "./components/skills/modals/DeleteModal";
import GitPickModal from "./components/skills/modals/GitPickModal";
import LocalPickModal from "./components/skills/modals/LocalPickModal";
import ImportModal from "./components/skills/modals/ImportModal";
import NewToolsModal from "./components/skills/modals/NewToolsModal";
import SharedDirModal from "./components/skills/modals/SharedDirModal";
import SettingsPage from "./components/skills/pages/SettingsPage";
import type {
  FeaturedSkillDto,
  ManagedSkill,
  OnboardingPlan,
  OnlineSkillDto,
} from "./types";
import {
  useTheme,
  useSkills,
  useSettings,
  useModals,
  useSkillActions,
} from "./hooks";
import { buildExploreInstallState } from "./logic/exploreInstall";
import {
  getSettingsAvailableVersion,
  shouldShowSharedUpdateModal,
  shouldShowUpdateModal,
} from "./logic/updateAvailability";
import { getUpdateViewState } from "./logic/updateViewState";
import {
  getSkillSourceLabel,
  getGithubInfo,
  createFormatRelative,
} from "./logic/skillHelpers";

function App() {
  const { t, i18n } = useTranslation();

  // Theme hook
  const {
    themePreference,
    systemTheme,
    setThemePreference,
    toggleLanguage,
    language,
  } = useTheme(
    i18n as unknown as {
      changeLanguage: (lang: string) => Promise<void>;
      resolvedLanguage?: string;
      language: string;
    },
  );

  // Tauri detection
  const isTauri =
    typeof window !== "undefined" &&
    Boolean(
      (window as { __TAURI__?: unknown }).__TAURI__ ||
      (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
    );

  const invokeTauri = useCallback(
    async <T,>(command: string, args?: Record<string, unknown>) => {
      if (!isTauri) {
        throw new Error("Tauri API is not available");
      }
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<T>(command, args);
    },
    [isTauri],
  );

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
  } = useSkills({ invokeTauri, isTauri });

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
  } = useSettings({ invokeTauri, isTauri, t });

  // Modals hook
  const modals = useModals();
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
  } = modals;

  // Local state
  const [plan, setPlan] = useState<OnboardingPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStartAt, setLoadingStartAt] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>(
    {},
  );
  const [syncTargets, setSyncTargets] = useState<Record<string, boolean>>({});
  const [successToastMessage, setSuccessToastMessage] = useState<string | null>(
    null,
  );
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [updateAvailableVersion, setUpdateAvailableVersion] = useState<
    string | null
  >(null);
  const [updateBody, setUpdateBody] = useState<string | null>(null);
  const [updateModalVersion, setUpdateModalVersion] = useState<string | null>(
    null,
  );
  const [ignoredUpdateVersion, setIgnoredUpdateVersion] = useState<
    string | null
  >(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("skills-ignored-update-version");
  });
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [updateDone, setUpdateDone] = useState(false);
  const [updateCheckCompleted, setUpdateCheckCompleted] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const updateObjRef = useRef<Update | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"updated" | "name">("updated");
  const [activeView, setActiveView] = useState<
    "myskills" | "explore" | "detail" | "settings"
  >("myskills");
  const [detailSkill, setDetailSkill] = useState<ManagedSkill | null>(null);
  const [featuredSkills, setFeaturedSkills] = useState<FeaturedSkillDto[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [exploreFilter, setExploreFilter] = useState("");
  const [searchResults, setSearchResults] = useState<OnlineSkillDto[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoSelectSkillName, setAutoSelectSkillName] = useState<string | null>(
    null,
  );

  // Helper functions
  const isSkillNameTaken = useCallback(
    (name: string) =>
      managedSkills.some(
        (skill) => skill.name.toLowerCase() === name.toLowerCase(),
      ),
    [managedSkills],
  );

  const formatRelative = useMemo(() => createFormatRelative(t), [t]);

  // Skill actions hook
  const skillActions = useSkillActions({
    invokeTauri,
    tools,
    syncTargets,
    isInstalled,
    uniqueToolIdsBySkillsDir,
    sharedToolIdsByToolId,
    isSkillNameTaken,
    loadManagedSkills,
    setLoading,
    setLoadingStartAt,
    setError,
    setActionMessage,
    setSuccessToastMessage,
    setShowAddModal,
    setShowLocalPickModal,
    setShowGitPickModal,
    setLocalPath,
    setLocalName,
    setGitUrl,
    setGitName,
    setLocalCandidates,
    setLocalCandidatesBasePath,
    setLocalCandidateSelected,
    setGitCandidates,
    setGitCandidatesRepoUrl,
    setGitCandidateSelected,
    t,
  });

  // Load plan
  const loadPlan = useCallback(async () => {
    setLoading(true);
    setLoadingStartAt(Date.now());
    setError(null);
    try {
      const result = await invokeTauri<OnboardingPlan>("get_onboarding_plan");
      setPlan(result);
      const defaultSelected: Record<string, boolean> = {};
      const defaultChoice: Record<string, string> = {};
      result.groups.forEach((group) => {
        defaultSelected[group.name] = true;
        const first = group.variants[0];
        if (first) {
          defaultChoice[group.name] = first.path;
        }
      });
      setSelected(defaultSelected);
      setVariantChoice(defaultChoice);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    } finally {
      setLoading(false);
      setLoadingStartAt(null);
    }
  }, [invokeTauri]);

  // Effects
  useEffect(() => {
    if (isTauri) {
      void loadPlan();
    }
  }, [isTauri, loadPlan]);

  useEffect(() => {
    if (!successToastMessage) return;
    toast.success(successToastMessage, { duration: 1800 });
    setSuccessToastMessage(null);
  }, [successToastMessage]);

  useEffect(() => {
    if (!error) return;
    if (error.includes("CANCELLED|")) {
      setError(null);
      setActionMessage(null);
      return;
    }
    toast.error(error, { duration: 2600 });
    setError(null);
    setActionMessage(null);
  }, [error]);

  const loadUpdateBody = useCallback(async (update: Update) => {
    try {
      const res = await fetch(
        `https://api.github.com/repos/qufei1993/skills-hub/releases/tags/v${update.version}`,
      );
      if (res.ok) {
        const data = await res.json();
        setUpdateBody(data.body ?? update.body ?? null);
        return;
      }
    } catch {
      // Release note loading failure should not hide update availability.
    }

    setUpdateBody(update.body ?? null);
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    if (!isTauri) return;

    setUpdateChecking(true);
    setUpdateCheckCompleted(false);
    setUpdateError(null);
    setUpdateDone(false);

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (update) {
        updateObjRef.current = update;
        setUpdateAvailableVersion(update.version);
        await loadUpdateBody(update);
      } else {
        updateObjRef.current = null;
        setUpdateAvailableVersion(null);
        setUpdateBody(null);
      }

      setUpdateCheckCompleted(true);
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : String(err));
      updateObjRef.current = null;
      setUpdateCheckCompleted(false);
    } finally {
      setUpdateChecking(false);
    }
  }, [isTauri, loadUpdateBody]);

  // Update check effect
  useEffect(() => {
    if (!isTauri) return;
    import("@tauri-apps/plugin-updater")
      .then(({ check }) => check())
      .then(async (update) => {
        if (update) {
          updateObjRef.current = update;
          setUpdateAvailableVersion(update.version);
          setUpdateCheckCompleted(false);
          setUpdateError(null);

          if (
            shouldShowUpdateModal({
              availableVersion: update.version,
              ignoredVersion: ignoredUpdateVersion,
              checkSource: "startup",
            })
          ) {
            setUpdateModalVersion(update.version);
          }

          await loadUpdateBody(update);
        }
      })
      .catch(() => {});
  }, [ignoredUpdateVersion, isTauri, loadUpdateBody]);

  useEffect(() => {
    if (!isTauri) {
      setAppVersion(null);
      return;
    }

    let cancelled = false;
    import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then((version) => {
        if (!cancelled) {
          setAppVersion(version);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppVersion(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isTauri]);

  // Tool status effect - set default sync targets
  useEffect(() => {
    if (!toolStatus) return;
    setSyncTargets((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const next: Record<string, boolean> = {};
      for (const t of toolStatus.tools) {
        next[t.key] = toolStatus.installed.includes(t.key);
      }
      return next;
    });

    if (toolStatus.newly_installed.length > 0) {
      setShowNewToolsModal(true);
    }
  }, [toolStatus, setShowNewToolsModal]);

  // Computed values
  const visibleSkills = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const filtered = managedSkills.filter((skill) => {
      if (!query) return true;
      return (
        skill.name.toLowerCase().includes(query) ||
        skill.central_path.toLowerCase().includes(query) ||
        skill.source_type.toLowerCase().includes(query)
      );
    });
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }
      return (b.updated_at ?? 0) - (a.updated_at ?? 0);
    });
    return sorted;
  }, [managedSkills, searchQuery, sortBy]);

  const newlyInstalledToolsText = useMemo(() => {
    if (!toolStatus || toolStatus.newly_installed.length === 0) return "";
    return toolStatus.newly_installed
      .map((id) => tools.find((t) => t.id === id)?.label ?? id)
      .join("、");
  }, [toolStatus, tools]);

  const pendingDeleteSkill = useMemo(
    () => managedSkills.find((skill) => skill.id === pendingDeleteId) ?? null,
    [managedSkills, pendingDeleteId],
  );

  const pendingSharedLabels = useMemo(() => {
    if (!pendingSharedToggle) return null;
    const toolId = pendingSharedToggle.toolId;
    const shared = sharedToolIdsByToolId[toolId] ?? [];
    const others = shared.filter((id) => id !== toolId);
    return {
      toolLabel: toolLabelById[toolId] ?? toolId,
      otherLabels: others.map((id) => toolLabelById[id] ?? id).join(", "),
    };
  }, [pendingSharedToggle, sharedToolIdsByToolId, toolLabelById]);

  const settingsAvailableVersion = useMemo(
    () =>
      getSettingsAvailableVersion({
        availableVersion: updateAvailableVersion,
        ignoredVersion: ignoredUpdateVersion,
      }),
    [ignoredUpdateVersion, updateAvailableVersion],
  );

  const updateViewState = useMemo(
    () =>
      getUpdateViewState({
        isChecking: updateChecking,
        isInstalling: updateInstalling,
        isDone: updateDone,
        error: updateError,
        availableVersion: settingsAvailableVersion,
        manualCheckCompleted: updateCheckCompleted,
      }),
    [
      settingsAvailableVersion,
      updateCheckCompleted,
      updateChecking,
      updateDone,
      updateError,
      updateInstalling,
    ],
  );

  const showSharedUpdateModal = useMemo(
    () =>
      shouldShowSharedUpdateModal({
        modalVersion: updateModalVersion,
        isInstalling: updateInstalling,
        isDone: updateDone,
      }),
    [updateDone, updateInstalling, updateModalVersion],
  );

  // Handlers
  const handleCancelLoading = useCallback(() => {
    void invokeTauri("cancel_current_operation").catch(() => {});
    setLoading(false);
    setLoadingStartAt(null);
    setActionMessage(null);
  }, [invokeTauri]);

  const handleOpenSettings = useCallback(() => {
    setActiveView("settings");
  }, []);

  const handleCloseSettings = useCallback(() => {
    setActiveView("myskills");
  }, []);

  const handleThemeChange = useCallback(
    (nextTheme: "system" | "light" | "dark") => {
      setThemePreference(nextTheme);
    },
    [setThemePreference],
  );

  const loadFeaturedSkills = useCallback(async () => {
    if (featuredSkills.length > 0) return;
    setFeaturedLoading(true);
    try {
      const result = await invokeTauri<FeaturedSkillDto[]>(
        "get_featured_skills",
      );
      setFeaturedSkills(result);
    } catch {
      // silent
    } finally {
      setFeaturedLoading(false);
    }
  }, [featuredSkills.length, invokeTauri]);

  const handleViewChange = useCallback(
    (view: "myskills" | "explore") => {
      setActiveView(view);
      if (view === "explore") {
        loadFeaturedSkills();
      }
      if (view === "myskills") {
        setDetailSkill(null);
      }
    },
    [loadFeaturedSkills],
  );

  const handleOpenDetail = useCallback((skill: ManagedSkill) => {
    setDetailSkill(skill);
    setActiveView("detail");
  }, []);

  const handleBackToList = useCallback(() => {
    setDetailSkill(null);
    setActiveView("myskills");
  }, []);

  const handleExploreFilterChange = useCallback(
    (value: string) => {
      setExploreFilter(value);
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
      if (value.trim().length < 2) {
        setSearchResults([]);
        setSearchLoading(false);
        return;
      }
      setSearchLoading(true);
      searchTimerRef.current = setTimeout(async () => {
        try {
          const results = await invokeTauri<OnlineSkillDto[]>(
            "search_skills_online",
            { query: value.trim(), limit: 20 },
          );
          setSearchResults(results);
        } catch {
          toast.error(t("searchError"));
          setSearchResults([]);
        } finally {
          setSearchLoading(false);
        }
      }, 500);
    },
    [invokeTauri, t],
  );

  const handleOpenAdd = useCallback(() => {
    setShowAddModal(true);
  }, [setShowAddModal]);

  const handleSortChange = useCallback((value: "updated" | "name") => {
    setSortBy(value);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const handleSyncTargetChange = useCallback(
    (toolId: string, checked: boolean) => {
      const shared = sharedToolIdsByToolId[toolId] ?? [toolId];
      if (shared.length > 1) {
        const others = shared.filter((id) => id !== toolId);
        const otherLabels = others
          .map((id) => toolLabelById[id] ?? id)
          .join(", ");
        const ok = window.confirm(
          t("sharedDirConfirm", {
            tool: toolLabelById[toolId] ?? toolId,
            others: otherLabels,
          }),
        );
        if (!ok) return;
      }
      setSyncTargets((prev) => {
        const next = { ...prev };
        for (const id of shared) next[id] = checked;
        return next;
      });
    },
    [sharedToolIdsByToolId, t, toolLabelById],
  );

  const handleToggleAllGitCandidates = useCallback(
    (checked: boolean) => {
      setGitCandidateSelected(
        Object.fromEntries(gitCandidates.map((c) => [c.subpath, checked])),
      );
    },
    [gitCandidates, setGitCandidateSelected],
  );

  const handleToggleAllLocalCandidates = useCallback(
    (checked: boolean) => {
      setLocalCandidateSelected(
        Object.fromEntries(
          localCandidates.map((c) => [c.subpath, c.valid && checked]),
        ),
      );
    },
    [localCandidates, setLocalCandidateSelected],
  );

  const handleToggleGitCandidate = useCallback(
    (subpath: string, checked: boolean) => {
      setGitCandidateSelected((prev: Record<string, boolean>) => ({
        ...prev,
        [subpath]: checked,
      }));
    },
    [setGitCandidateSelected],
  );

  const handleToggleLocalCandidate = useCallback(
    (subpath: string, checked: boolean) => {
      setLocalCandidateSelected((prev: Record<string, boolean>) => ({
        ...prev,
        [subpath]: checked,
      }));
    },
    [setLocalCandidateSelected],
  );

  const handleToggleGroup = useCallback(
    (groupName: string, checked: boolean) => {
      setSelected((prev) => ({
        ...prev,
        [groupName]: checked,
      }));
    },
    [],
  );

  const handleSelectVariant = useCallback((groupName: string, path: string) => {
    setVariantChoice((prev) => ({
      ...prev,
      [groupName]: path,
    }));
  }, []);

  const handleRefresh = useCallback(() => {
    void loadManagedSkills();
  }, [loadManagedSkills]);

  const handleReviewImport = useCallback(async () => {
    if (plan) {
      setShowImportModal(true);
      return;
    }
    const result = await loadPlan();
    if (result) {
      setShowImportModal(true);
    }
  }, [loadPlan, plan, setShowImportModal]);

  const toggleAll = useCallback(
    (checked: boolean) => {
      if (!plan) return;
      const next: Record<string, boolean> = {};
      plan.groups.forEach((group) => {
        next[group.name] = checked;
      });
      setSelected(next);
    },
    [plan],
  );

  const handlePickLocalPath = useCallback(async () => {
    if (!isTauri) return;
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: t("selectLocalFolder"),
      });
      if (!selected || Array.isArray(selected)) return;
      setLocalPath(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [isTauri, t, setLocalPath]);

  // Import handler
  const handleImport = useCallback(async () => {
    if (!plan) return;
    await skillActions.handleImport({
      plan,
      selected,
      variantChoice,
      onComplete: () => setShowImportModal(false),
    });
    await loadPlan();
  }, [
    plan,
    selected,
    variantChoice,
    skillActions,
    loadPlan,
    setShowImportModal,
  ]);

  // Local skill creation
  const handleCreateLocal = useCallback(async () => {
    await skillActions.handleCreateLocal({
      localPath,
      localName,
    });
  }, [localPath, localName, skillActions]);

  // Git skill creation
  const handleCreateGit = useCallback(async () => {
    await skillActions.handleCreateGit({
      gitUrl,
      gitName,
      autoSelectSkillName,
    });
  }, [gitUrl, gitName, autoSelectSkillName, skillActions]);

  // Explore install handler
  const handleExploreInstall = useCallback(
    (sourceUrl: string, skillName?: string) => {
      const nextState = buildExploreInstallState({
        sourceUrl,
        skillName,
        installedToolIds: toolStatus?.installed ?? [],
      });

      setGitUrl(nextState.gitUrl);
      setAutoSelectSkillName(nextState.autoSelectSkillName);
      setSyncTargets(nextState.syncTargets);
      void skillActions.handleCreateGit({
        gitUrl: nextState.gitUrl,
        gitName: "",
        autoSelectSkillName: nextState.autoSelectSkillName,
        syncTargetOverrides: nextState.syncTargets,
      });
    },
    [toolStatus, skillActions, setGitUrl],
  );

  // Install selected local candidates
  const handleInstallSelectedLocalCandidates = useCallback(async () => {
    const selectedCandidates = localCandidates.filter(
      (c) => c.valid && localCandidateSelected[c.subpath],
    );
    await skillActions.handleInstallSelectedLocalCandidates({
      selectedCandidates,
      localName,
      localCandidatesBasePath,
    });
  }, [
    localCandidates,
    localCandidateSelected,
    localName,
    localCandidatesBasePath,
    skillActions,
  ]);

  // Install selected git candidates
  const handleInstallSelectedCandidates = useCallback(async () => {
    const selectedCandidates = gitCandidates.filter(
      (c) => gitCandidateSelected[c.subpath],
    );
    await skillActions.handleInstallSelectedGitCandidates({
      selectedCandidates,
      gitName,
      gitCandidatesRepoUrl,
    });
  }, [
    gitCandidates,
    gitCandidateSelected,
    gitName,
    gitCandidatesRepoUrl,
    skillActions,
  ]);

  // Delete managed skill
  const handleDeleteManaged = useCallback(
    async (skill: ManagedSkill) => {
      await skillActions.handleDeleteManaged(skill, () =>
        setPendingDeleteId(null),
      );
    },
    [skillActions, setPendingDeleteId],
  );

  // Sync all managed to tools
  const handleSyncAllManagedToTools = useCallback(
    async (toolIds: string[]) => {
      await skillActions.handleSyncAllManagedToTools({
        managedSkills,
        toolIds,
      });
    },
    [managedSkills, skillActions],
  );

  // Sync new tools
  const handleSyncAllNewTools = useCallback(() => {
    if (!toolStatus) return;
    setSyncTargets((prev) => {
      const next = { ...prev };
      for (const id of toolStatus.newly_installed) {
        const shared = sharedToolIdsByToolId[id] ?? [id];
        for (const sid of shared) next[sid] = true;
      }
      return next;
    });
    setShowNewToolsModal(false);
    void handleSyncAllManagedToTools(toolStatus.newly_installed);
  }, [
    handleSyncAllManagedToTools,
    sharedToolIdsByToolId,
    toolStatus,
    setShowNewToolsModal,
  ]);

  // Toggle tool for skill
  const handleToggleToolForSkill = useCallback(
    (skill: ManagedSkill, toolId: string) => {
      void skillActions.handleToggleToolForSkill({
        skill,
        toolId,
        loading,
        onSharedToggle: (s, t) =>
          setPendingSharedToggle({ skill: s, toolId: t }),
      });
    },
    [loading, skillActions, setPendingSharedToggle],
  );

  // Update managed skill
  const handleUpdateManaged = useCallback(
    async (skill: ManagedSkill) => {
      await skillActions.handleUpdateManaged(skill);
    },
    [skillActions],
  );

  const handleUpdateSkill = useCallback(
    (skill: ManagedSkill) => {
      void handleUpdateManaged(skill);
    },
    [handleUpdateManaged],
  );

  // Shared confirm
  const handleSharedConfirm = useCallback(() => {
    if (!pendingSharedToggle) return;
    const payload = pendingSharedToggle;
    setPendingSharedToggle(null);
    void skillActions.runToggleToolForSkill(payload.skill, payload.toolId);
  }, [pendingSharedToggle, setPendingSharedToggle, skillActions]);

  // Update handlers
  const handleDismissUpdate = useCallback(() => {
    setUpdateModalVersion(null);
  }, []);

  const handleDismissUpdateForever = useCallback(() => {
    if (updateAvailableVersion) {
      localStorage.setItem(
        "skills-ignored-update-version",
        updateAvailableVersion,
      );
      setIgnoredUpdateVersion(updateAvailableVersion);
    }
    setUpdateModalVersion(null);
  }, [updateAvailableVersion]);

  const handleUpdateNow = useCallback(async () => {
    const update = updateObjRef.current;
    if (!update) return;
    setUpdateInstalling(true);
    setUpdateError(null);
    try {
      await update.downloadAndInstall();
      setUpdateInstalling(false);
      setUpdateDone(true);
    } catch (err) {
      setUpdateInstalling(false);
      const message = err instanceof Error ? err.message : String(err);
      setUpdateError(message);
      toast.error(message, { duration: 3200 });
    }
  }, []);

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
        {activeView === "detail" && detailSkill ? (
          <SkillDetailView
            skill={detailSkill}
            onBack={handleBackToList}
            invokeTauri={invokeTauri}
            formatRelative={formatRelative}
            t={t}
            isDark={
              themePreference === "system"
                ? systemTheme === "dark"
                : themePreference === "dark"
            }
          />
        ) : activeView === "myskills" ? (
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
        ) : activeView === "settings" ? (
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
            appVersion={appVersion}
            updateViewState={updateViewState}
            updateVersion={settingsAvailableVersion}
            updateError={updateError}
            onCheckForUpdates={handleCheckForUpdates}
            onInstallUpdate={handleUpdateNow}
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
        onSubmit={addModalTab === "local" ? handleCreateLocal : handleCreateGit}
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
        toolLabel={pendingSharedLabels?.toolLabel ?? ""}
        otherLabels={pendingSharedLabels?.otherLabels ?? ""}
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
          if (pendingDeleteSkill) void handleDeleteManaged(pendingDeleteSkill);
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

      {showSharedUpdateModal && (
        <div
          className="modal-backdrop"
          onClick={updateInstalling ? undefined : handleDismissUpdate}
        >
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
                aria-label={t("close")}
              >
                ✕
              </button>
            )}
            <div className="update-modal-body">
              <div className="update-modal-title">
                {updateDone
                  ? t("updateInstalledRestart")
                  : t("updateAvailable")}
              </div>
              {!updateDone && (
                <div className="update-modal-text">
                  {t("updateBannerText", { version: updateModalVersion })}
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
                  {t("done")}
                </button>
              ) : (
                <>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={updateInstalling}
                    onClick={handleUpdateNow}
                  >
                    {updateInstalling ? t("installingUpdate") : t("updateNow")}
                  </button>
                  {!updateInstalling && (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={handleDismissUpdateForever}
                    >
                      {t("updateBannerDismiss")}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
