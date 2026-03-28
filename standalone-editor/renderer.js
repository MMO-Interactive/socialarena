if (typeof document !== "undefined") {
  const appName = window.editorShell?.appName || "SocialArena Editor";
  const app = document.getElementById("app");
  const AUTH_STORAGE_KEY = "socialarena-editor-auth-v1";
  const DEFAULT_API_BASE_URL = "http://localhost/adventure/api/v1";
  const WORKFLOW_STAGES = [
    { id: "idea_board", label: "Idea Board", shortLabel: "Idea" },
    { id: "project_pitch", label: "Project Pitch", shortLabel: "Pitch" },
    { id: "script", label: "Script", shortLabel: "Script" },
    { id: "starting_images", label: "Starting Images", shortLabel: "Images" },
    { id: "video_clips", label: "Video Clips", shortLabel: "Clips" },
    { id: "edit", label: "Edit", shortLabel: "Edit" }
  ];
  const PROJECT_FORMATS = [
    { id: "series", label: "Series" },
    { id: "episode", label: "Episode" },
    { id: "film", label: "Film" },
    { id: "trailer", label: "Trailer" },
    { id: "clip", label: "Clip" }
  ];
  const IDEA_BOARD_CATEGORIES = [
    { id: "note", label: "Note", quickLabel: "Add Note", group: "core" },
    { id: "image", label: "Image", quickLabel: "Add Image", group: "core" },
    { id: "link", label: "Link", quickLabel: "Add Link", group: "core" },
    { id: "style", label: "Style", quickLabel: "Add Style", group: "core" },
    { id: "style_selector", label: "Style Selector", quickLabel: "Add Style Selector", group: "core" },
    { id: "character", label: "Virtual Cast", quickLabel: "Add Character", group: "story" },
    { id: "location", label: "Sets & Locations", quickLabel: "Add Location", group: "story" },
    { id: "scene", label: "Scenes", quickLabel: "Add Scene", group: "story" },
    { id: "clip", label: "Clips", quickLabel: "Add Clip", group: "story" },
    { id: "camera", label: "Camera", quickLabel: "Add Camera", group: "production" },
    { id: "lighting", label: "Lighting", quickLabel: "Add Lighting", group: "production" },
    { id: "vfx", label: "VFX", quickLabel: "Add VFX", group: "production" },
    { id: "prop", label: "Props", quickLabel: "Add Prop", group: "production" },
    { id: "wardrobe", label: "Wardrobe", quickLabel: "Add Wardrobe", group: "production" },
    { id: "audio", label: "Audio", quickLabel: "Add Audio", group: "production" },
    { id: "dialogue", label: "Dialogue", quickLabel: "Add Dialogue", group: "production" },
    { id: "beat", label: "Beats", quickLabel: "Add Beat", group: "production" }
  ];

  const IDEA_CATEGORY_ALIASES = {
    virtual_cast: "character",
    sets_locations: "location",
    scenes: "scene",
    clips: "clip",
    props: "prop",
    beats: "beat"
  };

  function normalizeProjectFormat(value, fallback = "episode") {
    const normalized = String(value || "").trim().toLowerCase();
    return PROJECT_FORMATS.some((entry) => entry.id === normalized) ? normalized : fallback;
  }

  function formatProjectTypeLabel(value) {
    const normalized = normalizeProjectFormat(value, "");
    return PROJECT_FORMATS.find((entry) => entry.id === normalized)?.label || "Project";
  }

  function normalizeProjectContainerTitle(type, title) {
    const normalizedType = normalizeProjectFormat(type, "episode");
    const rawTitle = String(title || "").trim();
    if (!rawTitle) {
      return `Untitled SocialArena ${formatProjectTypeLabel(normalizedType)}`;
    }
    if (
      normalizedType === "series"
      && /untitled\s+socialarena\s+episode/i.test(rawTitle)
    ) {
      return "Untitled SocialArena Series";
    }
    return rawTitle;
  }

  function createWorkflowState(currentStage = "idea_board") {
    return {
      currentStage,
      completedStages: [],
      updatedAt: new Date().toISOString()
    };
  }

  function createIdeaBoardState(seed = {}) {
    return {
      cards: Array.isArray(seed.cards)
        ? seed.cards.map((card, index) => ({
            id: card.id || `idea-card-${index + 1}`,
            category: IDEA_BOARD_CATEGORIES.some((entry) => entry.id === card.category)
              ? card.category
              : IDEA_CATEGORY_ALIASES[String(card.category || "")] || "clip",
            title: card.title || "",
            description: card.description || "",
            status: card.status || "draft",
            influencedBy: Array.isArray(card.influencedBy) ? card.influencedBy : [],
            x: Number.isFinite(card.x) ? Number(card.x) : 120 + (index % 3) * 320,
            y: Number.isFinite(card.y) ? Number(card.y) : 120 + Math.floor(index / 3) * 220
          }))
        : [],
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
  }

  function createProjectPitchState(seed = {}) {
    const tone =
      Array.isArray(seed.tone) ? seed.tone : typeof seed.tone === "string" ? seed.tone.split(/[,\n]+/) : [];

    return {
      format: normalizeProjectFormat(seed.format, "episode"),
      logline: seed.logline || "",
      concept: seed.concept || "",
      audience: seed.audience || "",
      tone: tone.map((value) => String(value).trim()).filter(Boolean),
      visualStyle: seed.visualStyle || "",
      references: seed.references || "",
      successCriteria: seed.successCriteria || "",
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
  }

  function getPromotionTargetLabel(project) {
    const normalized = normalizeProjectFormat(project?.type || project?.projectPitch?.format || "episode");
    if (normalized === "series") {
      return "Series";
    }
    if (normalized === "film") {
      return "Film";
    }
    if (normalized === "episode") {
      return "Episode";
    }
    return formatProjectTypeLabel(normalized);
  }

  function isProjectPromoted(project) {
    return Boolean(project?.remoteType && project?.remoteId);
  }

  function shouldRequirePromotionBeforeScript(project) {
    return Boolean(
      project
      && state.auth.status === "authenticated"
      && (state.auth.currentStudioId !== null || !state.auth.studios.length)
      && !isProjectPromoted(project)
      && ["film", "series", "episode"].includes(normalizeProjectFormat(project.type || project?.projectPitch?.format || "episode"))
    );
  }

  function createScriptScene(scene = {}, index = 0) {
    const clips = Array.isArray(scene.clips) && scene.clips.length
      ? scene.clips.map((clip, clipIndex) => createScriptClip(clip, clipIndex))
      : scene.clipPrompt || scene.dialogue
        ? [createScriptClip({ title: "Clip 1", prompt: scene.clipPrompt, dialogue: scene.dialogue }, 0)]
        : [];
    return {
      id: scene.id || `script-scene-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      title: scene.title || `Scene ${index + 1}`,
      slug: scene.slug || "",
      summary: scene.summary || "",
      dialogue: clips.map((clip) => String(clip.dialogue || "").trim()).filter(Boolean).join("\n\n"),
      clipPrompt: scene.clipPrompt || clips.map((clip) => clip.prompt).filter(Boolean).join("\n\n"),
      clips,
      objective: scene.objective || "",
      location: scene.location || "",
      characters: Array.isArray(scene.characters)
        ? scene.characters.map((value) => String(value).trim()).filter(Boolean)
        : typeof scene.characters === "string"
          ? scene.characters.split(/[,\n]+/).map((value) => String(value).trim()).filter(Boolean)
          : [],
      mood: Array.isArray(scene.mood)
        ? scene.mood.map((value) => String(value).trim()).filter(Boolean)
        : typeof scene.mood === "string"
          ? scene.mood.split(/[,\n]+/).map((value) => String(value).trim()).filter(Boolean)
          : [],
      timeOfDay: scene.timeOfDay || "",
      cameraStyle: scene.cameraStyle || "",
      visualReferences: scene.visualReferences || "",
      status: scene.status || "draft"
    };
  }

  function createScriptClip(clip = {}, index = 0) {
    return {
      id: clip.id || `script-clip-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      title: clip.title || `Clip ${index + 1}`,
      prompt: clip.prompt || "",
      dialogue: clip.dialogue || "",
      status: clip.status || "draft"
    };
  }

  function createScriptState(seed = {}) {
    const scenes = Array.isArray(seed.scenes) ? seed.scenes.map((scene, index) => createScriptScene(scene, index)) : [];
    return {
      title: seed.title || "",
      premise: seed.premise || "",
      structureNotes: seed.structureNotes || "",
      scenes,
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
  }

  function createStartingImageScene(scene = {}, index = 0) {
    return {
      id: scene.id || `starting-image-scene-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      scriptSceneId: scene.scriptSceneId || "",
      title: scene.title || `Scene ${index + 1}`,
      prompt: scene.prompt || "",
      shotNotes: scene.shotNotes || "",
      status: scene.status || "not_started",
      boardItemId: scene.boardItemId || scene.board_item_id || "",
      generationStatus: scene.generationStatus || scene.generation_status || "idle",
      generationCount: Number(scene.generationCount || scene.generation_count || 0),
      promptId: scene.promptId || scene.prompt_id || "",
      lastGeneratedAt: scene.lastGeneratedAt || scene.last_generated_at || "",
      lastError: scene.lastError || scene.last_error || "",
      approvedAssetId: scene.approvedAssetId || "",
      approvedVariationId: scene.approvedVariationId || "",
      variations: Array.isArray(scene.variations)
        ? scene.variations.map((variation, variationIndex) => ({
            id: variation.id || `starting-image-variation-${Date.now()}-${index}-${variationIndex}`,
            source: variation.source || "generated",
            label: variation.label || `Variation ${variationIndex + 1}`,
            imageUrl: variation.imageUrl || "",
            assetId: variation.assetId || "",
            status: variation.status || "draft",
            createdAt: variation.createdAt || new Date().toISOString()
          }))
        : [],
      updatedAt: scene.updatedAt || new Date().toISOString()
    };
  }

  function createStartingImagesState(seed = {}) {
    const scenes = Array.isArray(seed.scenes)
      ? seed.scenes.map((scene, index) => createStartingImageScene(scene, index))
      : [];

    return {
      scenes,
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
  }

  function createVideoClipScene(scene = {}, index = 0) {
    const clips = Array.isArray(scene.clips) && scene.clips.length
      ? scene.clips.map((clip, clipIndex) => createVideoClipRequest(clip, clipIndex))
      : [
          createVideoClipRequest(
            {
              title: scene.primaryClipTitle || "Clip 1",
              clipPrompt: scene.clipPrompt || "",
              shotNotes: scene.shotNotes || "",
              boardItemId: scene.boardItemId || scene.board_item_id || "",
              generationStatus: scene.generationStatus || scene.generation_status || "idle",
              generationCount: Number(scene.generationCount || scene.generation_count || 0),
              promptId: scene.promptId || scene.prompt_id || "",
              lastGeneratedAt: scene.lastGeneratedAt || scene.last_generated_at || "",
              lastError: scene.lastError || scene.last_error || "",
              status: scene.status || "not_ready",
              approvedClipId: scene.approvedClipId || "",
              generatedClips: scene.generatedClips || []
            },
            0
          )
        ];

    return {
      id: scene.id || `video-clip-scene-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      scriptSceneId: scene.scriptSceneId || "",
      title: scene.title || `Scene ${index + 1}`,
      clipPrompt: scene.clipPrompt || clips[0]?.clipPrompt || "",
      shotNotes: scene.shotNotes || clips[0]?.shotNotes || "",
      startingImageUrl: scene.startingImageUrl || "",
      startingVariationId: scene.startingVariationId || "",
      boardItemId: scene.boardItemId || scene.board_item_id || "",
      generationStatus: scene.generationStatus || scene.generation_status || "idle",
      generationCount: Number(scene.generationCount || scene.generation_count || 0),
      promptId: scene.promptId || scene.prompt_id || "",
      lastGeneratedAt: scene.lastGeneratedAt || scene.last_generated_at || "",
      lastError: scene.lastError || scene.last_error || "",
      status: scene.status || "not_ready",
      approvedClipId: scene.approvedClipId || clips[0]?.approvedClipId || "",
      plannedShots: Array.isArray(scene.plannedShots)
        ? scene.plannedShots.map((shot, shotIndex) => ({
            id: shot.id || `planned-shot-${Date.now()}-${index}-${shotIndex}`,
            title: shot.title || `Shot ${shotIndex + 1}`,
            prompt: shot.prompt || "",
            shotType: shot.shotType || "coverage",
            status: shot.status || "planned"
          }))
        : [],
      clips,
      generatedClips: clips.flatMap((clip) => clip.generatedClips || []),
      updatedAt: scene.updatedAt || new Date().toISOString()
    };
  }

  function createVideoClipRequest(clip = {}, index = 0) {
    return {
      id: clip.id || `video-slot-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      title: clip.title || `Clip ${index + 1}`,
      clipPrompt: clip.clipPrompt || clip.prompt || "",
      shotNotes: clip.shotNotes || "",
      boardItemId: clip.boardItemId || clip.board_item_id || "",
      generationStatus: clip.generationStatus || clip.generation_status || "idle",
      generationCount: Number(clip.generationCount || clip.generation_count || 0),
      promptId: clip.promptId || clip.prompt_id || "",
      lastGeneratedAt: clip.lastGeneratedAt || clip.last_generated_at || "",
      lastError: clip.lastError || clip.last_error || "",
      status: clip.status || "not_ready",
      approvedClipId: clip.approvedClipId || "",
      generatedClips: Array.isArray(clip.generatedClips)
        ? clip.generatedClips.map((entry, clipIndex) => ({
            id: entry.id || `video-clip-${Date.now()}-${index}-${clipIndex}`,
            label: entry.label || `Generated ${clipIndex + 1}`,
            videoUrl: entry.videoUrl || entry.generated_video_url || entry.url || "",
            thumbnailUrl: entry.thumbnailUrl || entry.thumbnail_url || entry.videoUrl || entry.generated_video_url || entry.url || "",
            assetId: entry.assetId || "",
            status: entry.status || "generated",
            createdAt: entry.createdAt || new Date().toISOString()
          }))
        : [],
      updatedAt: clip.updatedAt || new Date().toISOString()
    };
  }

  function createVideoClipsState(seed = {}) {
    const scenes = Array.isArray(seed.scenes)
      ? seed.scenes.map((scene, index) => createVideoClipScene(scene, index))
      : [];

    return {
      scenes,
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
  }

  function createExportSettings(seed = {}) {
    return {
      resolution: seed.resolution || "1920x1080",
      fps: String(seed.fps || "24"),
      quality: seed.quality || "balanced",
      includeAudio: seed.includeAudio !== false
    };
  }

  function normalizeTransition(transition = {}) {
    const validTypes = new Set(["cut", "crossfade", "dip_black", "wipe_left"]);
    const type = validTypes.has(transition?.type) ? transition.type : "cut";
    const duration = Math.max(0.05, Math.min(2, Number(transition?.duration || 0.4)));
    return { type, duration };
  }

  function renderUiIcon(name) {
    const icons = {
      dashboard: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5v8a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 20v-5h6v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
      logout: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 8l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18 12H9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      browse: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 4a12 12 0 0 1 0 16M12 4a12 12 0 0 0 0 16M4 12h16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
      new: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
      open: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H10l2 2h6.5A1.5 1.5 0 0 1 20 10.5v7A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
      save: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5h10l3 3v11H5V6a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 5v5h7V5M8 19v-5h8v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
      sync: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8a6 6 0 0 1 10-1l1.5 1.5M17 16a6 6 0 0 1-10 1L5.5 15.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 5.5v3h-3M5.5 18.5v-3h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      export: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v10M8 8l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 15v3.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      import: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V10M8 16l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 9V5.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5V9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      addTimeline: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="7" width="16" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 9.5v5M9.5 12h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      zoomOut: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-5.5-5.5M8 10.5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      zoomIn: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="5.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M20 20l-5.5-5.5M10.5 8v5M8 10.5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
      marker: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20V8M8 8l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      left: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      right: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      split: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M7 8l3 3-3 3M17 8l-3 3 3 3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      duplicate: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="5" y="5" width="10" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>',
      delete: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12M9 7V5.5h6V7M8 7l1 11h6l1-11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    };

    return icons[name] || "";
  }
  const phase3AppStateHelpers = window.EditorStateModules?.createAppStateHelpers?.({
    appName,
    defaultApiBaseUrl: DEFAULT_API_BASE_URL,
    createWorkflowState,
    createIdeaBoardState,
    createProjectPitchState,
    createScriptState,
    createExportSettings
  }) || null;
  const defaultProjects = phase3AppStateHelpers?.defaultProjects || [];
  const templateProjectDocument = phase3AppStateHelpers?.templateProjectDocument || { projects: [] };
  const state = phase3AppStateHelpers?.state || {};
  const AUTOSAVE_KEY = "socialarena-editor-autosave-v1";
  let projects = structuredClone(defaultProjects);
  let playbackTimer = null;
  let startingImagePollTimer = null;
  let startingImagePollInFlight = false;
  let videoClipPollTimer = null;
  let videoClipPollInFlight = false;
  let phase3ProjectNormalizationHelpers = null;
  let phase3AuthSessionHelpers = null;
  let phase3ApiClient = null;
  let phase3PlatformProjectHelpers = null;
  let phase3ProjectPersistenceHelpers = null;
  let phase3ProjectSelectionHelpers = null;
  let phase3WorkflowStateHelpers = null;
  let phase3StudioDashboardHelpers = null;
  let phase3StudioProjectLibraryHelpers = null;
  let phase3SeriesManagementHelpers = null;
  let phase3StudioPickerHelpers = null;
  let phase3StudioViewHelpers = null;
  let phase3AssetLibraryHelpers = null;
  let phase3ProjectPitchWorkflowHelpers = null;
  let phase3ScriptWorkflowHelpers = null;
  let phase3MediaGenerationWorkflowHelpers = null;
  let phase3IdeaBoardWorkflowHelpers = null;
  let phase3EditorStateHelpers = null;
  let phase3EditorSelectionHelpers = null;
  let phase3TimelineHelpers = null;
  let phase3InspectorHelpers = null;
  let phase3PlaybackHelpers = null;
  let phase3EditorActionHelpers = null;
  let phase3EditorEditingHelpers = null;
  let phase3EditorWorkspaceHelpers = null;
  let phase3AppShellHelpers = null;
  let phase3UiRenderHelpers = null;
  let phase3UiModalHelpers = null;
  let phase3AuthViewHelpers = null;
  let phase3UiEventHelpers = null;
  let phase3UiActionDispatchHelpers = null;
  let phase3UiBindingHelpers = null;
  let playbackView = {
    activePreviewItemId: "",
    activeAudioItemId: ""
  };
  let ideaDragState = null;
  let timelineTrimState = null;

  function ensureProjectsCollection() {
    if (phase3ProjectSelectionHelpers) {
      phase3ProjectSelectionHelpers.ensureProjectsCollection();
      return;
    }
    if (!Array.isArray(projects) || projects.length === 0) {
      const document = createNewProjectDocument();
      projects = document.projects;
      state.selectedProjectId = document.active_project_id;
    }
  }

  function normalizeProjectShape(project) {
    if (!phase3ProjectNormalizationHelpers) {
      return project;
    }
    return phase3ProjectNormalizationHelpers.normalizeProjectShape(project);
  }

  function normalizeStudioId(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function hasStudioScopedSession() {
    return phase3ProjectNormalizationHelpers
      ? phase3ProjectNormalizationHelpers.hasStudioScopedSession()
      : state.auth.status === "authenticated" && Array.isArray(state.auth.studios) && state.auth.studios.length > 0;
  }

  function projectBelongsToStudio(project, studioId = state.auth.currentStudioId) {
    return phase3ProjectNormalizationHelpers
      ? phase3ProjectNormalizationHelpers.projectBelongsToStudio(project, studioId)
      : true;
  }

  function projectBelongsToCurrentStudio(project) {
    return phase3ProjectNormalizationHelpers
      ? phase3ProjectNormalizationHelpers.projectBelongsToCurrentStudio(project)
      : projectBelongsToStudio(project, state.auth.currentStudioId);
  }

  function getStudioScopedProjects(studioId = state.auth.currentStudioId) {
    ensureProjectsCollection();
    return phase3ProjectNormalizationHelpers
      ? phase3ProjectNormalizationHelpers.getStudioScopedProjects(projects, studioId)
      : projects.map((project) => normalizeProjectShape(project));
  }

  function getProject() {
    if (phase3ProjectSelectionHelpers) {
      return phase3ProjectSelectionHelpers.getProject();
    }
    ensureProjectsCollection();
    const availableProjects = hasStudioScopedSession() ? getStudioScopedProjects() : projects.map((project) => normalizeProjectShape(project));
    return normalizeProjectShape(
      availableProjects.find((project) => project.id === state.selectedProjectId) || availableProjects[0] || null
    );
  }

  function getStageIndex(stageId) {
    return Math.max(0, WORKFLOW_STAGES.findIndex((stage) => stage.id === stageId));
  }

  function getWorkflowStage(project) {
    const stageId = project?.workflow?.currentStage || "idea_board";
    return WORKFLOW_STAGES[getStageIndex(stageId)] || WORKFLOW_STAGES[0];
  }

  function getCompletedStageIds(project) {
    return Array.isArray(project?.workflow?.completedStages) ? project.workflow.completedStages : [];
  }

  function getStageProgressPercent(project) {
    const currentIndex = getStageIndex(project?.workflow?.currentStage || "idea_board");
    return Math.round(((currentIndex + 1) / WORKFLOW_STAGES.length) * 100);
  }

  function getNextStage(project) {
    const currentIndex = getStageIndex(project?.workflow?.currentStage || "idea_board");
    return WORKFLOW_STAGES[Math.min(currentIndex + 1, WORKFLOW_STAGES.length - 1)] || null;
  }

  function getPreviousStage(project) {
    const currentIndex = getStageIndex(project?.workflow?.currentStage || "idea_board");
    return WORKFLOW_STAGES[Math.max(currentIndex - 1, 0)] || null;
  }

  function setProjectStage(project, targetStageId) {
    if (!project) {
      return;
    }

    const targetIndex = getStageIndex(targetStageId);
    project.workflow.currentStage = WORKFLOW_STAGES[targetIndex].id;
    project.workflow.completedStages = WORKFLOW_STAGES
      .slice(0, targetIndex)
      .map((stage) => stage.id);
    project.workflow.updatedAt = new Date().toISOString();
  }

  function updateProjectPitch(project, field, value) {
    phase3WorkflowStateHelpers.updateProjectPitch(project, field, value);
  }

  function projectPitchFields(project) {
    return phase3WorkflowStateHelpers.projectPitchFields(project);
  }

  function buildScriptSeed(project) {
    return phase3WorkflowStateHelpers.buildScriptSeed(project);
  }

  function ensureScriptDraft(project) {
    phase3WorkflowStateHelpers.ensureScriptDraft(project);
  }

  function updateScriptField(project, field, value) {
    phase3WorkflowStateHelpers.updateScriptField(project, field, value);
  }

  function addScriptScene(project) {
    return phase3WorkflowStateHelpers.addScriptScene(project);
  }

  function updateScriptScene(project, sceneId, field, value) {
    phase3WorkflowStateHelpers.updateScriptScene(project, sceneId, field, value);
  }

  function deriveSceneClipPrompt(scene) {
    return phase3WorkflowStateHelpers.deriveSceneClipPrompt(scene);
  }

  function deriveSceneDialogue(scene) {
    return phase3WorkflowStateHelpers.deriveSceneDialogue(scene);
  }

  function addScriptClip(project, sceneId) {
    return phase3WorkflowStateHelpers.addScriptClip(project, sceneId);
  }

  function updateScriptClip(project, sceneId, clipId, field, value) {
    phase3WorkflowStateHelpers.updateScriptClip(project, sceneId, clipId, field, value);
  }

  function removeScriptClip(project, sceneId, clipId) {
    phase3WorkflowStateHelpers.removeScriptClip(project, sceneId, clipId);
  }

  function syncSceneInspectorDraft(project, selection) {
    phase3WorkflowStateHelpers.syncSceneInspectorDraft(project, selection);
  }

  function applySceneInspectorDraft(project, scriptSceneId) {
    return phase3WorkflowStateHelpers.applySceneInspectorDraft(project, scriptSceneId);
  }

  function removeScriptScene(project, sceneId) {
    phase3WorkflowStateHelpers.removeScriptScene(project, sceneId);
  }

  function getSelectedScriptScene(project) {
    return phase3WorkflowStateHelpers.getSelectedScriptScene(project);
  }

  function scriptChecklist(project) {
    return phase3WorkflowStateHelpers.scriptChecklist(project);
  }

  function getPrimaryScriptClipPrompt(scene) {
    return phase3WorkflowStateHelpers.getPrimaryScriptClipPrompt(scene);
  }

  function formatScriptExport(project) {
    return phase3ScriptWorkflowHelpers.formatScriptExport(project);
  }

  function renderScriptWorkspace(project) {
    return phase3ScriptWorkflowHelpers.renderScriptWorkspace(project);
  }

  function ensureStartingImagesDraft(project) {
    phase3WorkflowStateHelpers.ensureStartingImagesDraft(project);
  }

  function ensureVideoClipsDraft(project) {
    phase3WorkflowStateHelpers.ensureVideoClipsDraft(project);
  }

  function getSelectedVideoClipScene(project) {
    return phase3WorkflowStateHelpers.getSelectedVideoClipScene(project);
  }

  function getSelectedVideoClipRequest(project, scene = null) {
    return phase3WorkflowStateHelpers.getSelectedVideoClipRequest(project, scene);
  }

  function recomputeVideoClipSceneAggregate(scene) {
    return phase3WorkflowStateHelpers.recomputeVideoClipSceneAggregate(scene);
  }

  function updateVideoClipRequest(project, sceneId, requestId, field, value) {
    phase3WorkflowStateHelpers.updateVideoClipRequest(project, sceneId, requestId, field, value);
  }

  function addGeneratedVideoClip(project, sceneId, requestId, clip) {
    return phase3WorkflowStateHelpers.addGeneratedVideoClip(project, sceneId, requestId, clip);
  }

  function approveGeneratedVideoClip(project, sceneId, requestId, clipId) {
    return phase3WorkflowStateHelpers.approveGeneratedVideoClip(project, sceneId, requestId, clipId);
  }

  function ensureGeneratedClipAsset(project, scene, request, clip) {
    return phase3WorkflowStateHelpers.ensureGeneratedClipAsset(project, scene, request, clip);
  }

  function getSelectedStartingImageScene(project) {
    return phase3WorkflowStateHelpers.getSelectedStartingImageScene(project);
  }

  function updateStartingImageScene(project, sceneId, field, value) {
    phase3WorkflowStateHelpers.updateStartingImageScene(project, sceneId, field, value);
  }

  function addStartingImageVariation(project, sceneId, variation) {
    return phase3WorkflowStateHelpers.addStartingImageVariation(project, sceneId, variation);
  }

  function approveStartingImageVariation(project, sceneId, variationId) {
    return phase3WorkflowStateHelpers.approveStartingImageVariation(project, sceneId, variationId);
  }

  function removeStartingImageVariation(project, sceneId, variationId) {
    return phase3WorkflowStateHelpers.removeStartingImageVariation(project, sceneId, variationId);
  }

  function createStartingImageDraft(scene, project) {
    return phase3WorkflowStateHelpers.createStartingImageDraft(scene, project);
  }

  function startingImagesChecklist(project) {
    return phase3WorkflowStateHelpers.startingImagesChecklist(project);
  }

  function renderStartingImageThumb(variation, scene) {
    if (variation.imageUrl) {
      return `<img src="${escapeHtml(variation.imageUrl)}" alt="${escapeHtml(variation.label || scene.title)}" />`;
    }

    return `
      <div class="starting-image-placeholder">
        <strong>${escapeHtml((scene.title || "Scene").slice(0, 24))}</strong>
        <span>${escapeHtml(variation.label || "Draft frame")}</span>
      </div>
    `;
  }

  function renderStartingImagesWorkspace(project) {
    return phase3MediaGenerationWorkflowHelpers.renderStartingImagesWorkspace(project);
  }

  function renderVideoClipsWorkspace(project) {
    return phase3MediaGenerationWorkflowHelpers.renderVideoClipsWorkspace(project);
  }

  function createIdeaCard(categoryId) {
    const category = IDEA_BOARD_CATEGORIES.find((entry) => entry.id === categoryId);
    const existingCards = getProject()?.ideaBoard?.cards || [];
    const categoryIndex = IDEA_BOARD_CATEGORIES.findIndex((entry) => entry.id === categoryId);
    const siblingCount = existingCards.filter((entry) => entry.category === categoryId).length;
    const column = Math.max(0, categoryIndex % 3);
    const row = Math.floor(Math.max(0, categoryIndex) / 3);
    return {
      id: `idea-card-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      category: categoryId,
      title: "",
      description: "",
      status: "draft",
      influencedBy: [],
      x: 120 + column * 420 + (siblingCount % 3) * 48,
      y: 120 + row * 280 + Math.floor(siblingCount / 3) * 220 + (siblingCount % 3) * 24
    };
  }

  function updateIdeaCard(project, cardId, field, value) {
    const card = project?.ideaBoard?.cards?.find((entry) => entry.id === cardId);
    if (!card) {
      return;
    }

    card[field] = value;
    project.ideaBoard.updatedAt = new Date().toISOString();
  }

  function updateIdeaCardStructuredField(project, cardId, field, value) {
    const card = project?.ideaBoard?.cards?.find((entry) => entry.id === cardId);
    if (!card) {
      return;
    }

    const parsed = parseIdeaCardContent(card);
    parsed[field] = value;
    card.description = JSON.stringify(parsed);
    project.ideaBoard.updatedAt = new Date().toISOString();
  }

  function moveIdeaCard(project, cardId, x, y) {
    const card = project?.ideaBoard?.cards?.find((entry) => entry.id === cardId);
    if (!card) {
      return;
    }

    card.x = Math.max(24, Math.min(2200, Math.round(x)));
    card.y = Math.max(24, Math.min(1600, Math.round(y)));
    project.ideaBoard.updatedAt = new Date().toISOString();
  }

  function connectIdeaCards(project, sourceId, targetId) {
    if (!project || !sourceId || !targetId || sourceId === targetId) {
      return false;
    }

    const target = project.ideaBoard?.cards?.find((entry) => entry.id === targetId);
    if (!target) {
      return false;
    }

    target.influencedBy = Array.isArray(target.influencedBy) ? target.influencedBy : [];
    if (!target.influencedBy.includes(sourceId)) {
      target.influencedBy.push(sourceId);
      project.ideaBoard.updatedAt = new Date().toISOString();
      return true;
    }

    return false;
  }

  function addIdeaCard(project, categoryId) {
    if (!project) {
      return null;
    }
    project.ideaBoard = createIdeaBoardState(project.ideaBoard || {});
    const card = createIdeaCard(categoryId);
    project.ideaBoard.cards.push(card);
    project.ideaBoard.updatedAt = new Date().toISOString();
    return card;
  }

  function removeIdeaCard(project, cardId) {
    if (!project?.ideaBoard?.cards) {
      return;
    }
    project.ideaBoard.cards = project.ideaBoard.cards.filter((entry) => entry.id !== cardId);
    project.ideaBoard.updatedAt = new Date().toISOString();
  }

  function ideaBoardChecklist(project) {
    return phase3IdeaBoardWorkflowHelpers.ideaBoardChecklist(project);
  }

  function renderIdeaBoardWorkspace(project) {
    return phase3IdeaBoardWorkflowHelpers.renderIdeaBoardWorkspace(project);
  }

  function parseIdeaCardContent(card) {
    return phase3IdeaBoardWorkflowHelpers.parseIdeaCardContent(card);
  }

  function renderNodeField(label, inputHtml) {
    return phase3IdeaBoardWorkflowHelpers.renderNodeField(label, inputHtml);
  }

  function renderIdeaNodeBody(card) {
    return phase3IdeaBoardWorkflowHelpers.renderIdeaNodeBody(card);
  }

  function renderIdeaNode(card) {
    return phase3IdeaBoardWorkflowHelpers.renderIdeaNode(card);
  }

  function renderProjectPitchWorkspace(project) {
    return phase3ProjectPitchWorkflowHelpers.renderProjectPitchWorkspace(project);
  }

  function renderWorkflowPlaceholder(project, currentStage) {
    return phase3ProjectPitchWorkflowHelpers.renderWorkflowPlaceholder(project, currentStage);
  }

  function renderWorkflowRail(project) {
    const currentIndex = getStageIndex(project?.workflow?.currentStage || "idea_board");

    return `
      <div class="workflow-rail">
        ${WORKFLOW_STAGES
          .map((stage, index) => {
            const stateClass =
              index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
            return `
              <button
                class="workflow-step ${stateClass}"
                type="button"
                data-action="jump-stage"
                data-stage-id="${stage.id}"
              >
                <span class="workflow-step-index">${index + 1}</span>
                <span class="workflow-step-label">${stage.shortLabel}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    `;
  }

  function studioSummary() {
    if (phase3StudioDashboardHelpers) {
      return phase3StudioDashboardHelpers.studioSummary();
    }

    return [];
  }

  function dashboardTasks() {
    if (phase3StudioDashboardHelpers) {
      return phase3StudioDashboardHelpers.dashboardTasks();
    }

    return [];
  }

  async function fetchDashboardSummary() {
    if (!phase3PlatformProjectHelpers) {
      return;
    }
    return phase3PlatformProjectHelpers.fetchDashboardSummary();
  }

  function renderDashboard() {
    if (phase3StudioDashboardHelpers) {
      return phase3StudioDashboardHelpers.renderDashboard();
    }
    return `
      <section class="dashboard-shell">
        <div class="dashboard-hero panel">
          <div>
            <div class="eyebrow">Creator Dashboard</div>
            <h2>Dashboard unavailable</h2>
            <p class="dashboard-copy">Studio dashboard module is not loaded.</p>
          </div>
        </div>
      </section>
    `;
  }
  function studioViewMeta(view) {
    const map = {
      "studio-project-library": {
        title: "Project Library"
      },
      "studio-story-board": {
        title: "Story Board"
      },
      "studio-scene-planner": {
        title: "Scene Planner"
      },
      "studio-clip-composer": {
        title: "Clip Composer"
      },
      "studio-studios": {
        title: "Studios"
      },
      "studio-series": {
        title: "Series"
      },
      "studio-episodes": {
        title: "Episodes"
      },
      "studio-talent": {
        title: "Talent"
      },
      "studio-locations": {
        title: "Locations"
      },
      "studio-props": {
        title: "Props"
      }
    };
    return map[view] || { title: "Workspace" };
  }

  function assetViewMeta(view) {
    return phase3AssetLibraryHelpers.assetViewMeta(view);
  }

  function getSelectedAsset(project) {
    return project?.assets?.find((asset) => asset.id === state.selectedAssetId) || null;
  }

  function filterAssetByReview(asset, reviewFilter) {
    return phase3AssetLibraryHelpers.filterAssetByReview(asset, reviewFilter);
  }

  function filterAssetsForBrowser(assets) {
    return phase3AssetLibraryHelpers.filterAssetsForBrowser(assets);
  }

  function assetBadgeLabel(asset) {
    return phase3AssetLibraryHelpers.assetBadgeLabel(asset);
  }

  function assetFilterForView(view, asset) {
    return phase3AssetLibraryHelpers.assetFilterForView(view, asset);
  }

  function renderAssetManagementView(project) {
    return phase3AssetLibraryHelpers.renderAssetManagementView(project);
  }
  function getBoardCardsByCategory(project, category) {
    return phase3StudioViewHelpers.getBoardCardsByCategory(project, category);
  }

  function studioProjectRows() {
    return phase3StudioProjectLibraryHelpers.studioProjectRows();
  }

  function renderStudioEntityList(title, items, emptyCopy) {
    return phase3StudioViewHelpers.renderStudioEntityList(title, items, emptyCopy);
  }

  function renderStudioStoryBoard(project) {
    return phase3StudioViewHelpers.renderStudioStoryBoard(project);
  }

  function renderStudioScenePlanner(project) {
    return phase3StudioViewHelpers.renderStudioScenePlanner(project);
  }

  function renderStudioClipComposer(project) {
    return phase3StudioViewHelpers.renderStudioClipComposer(project);
  }

  function renderStudioStudios() {
    return phase3StudioViewHelpers.renderStudioStudios();
  }

  function renderStudioProjectLibrary(project) {
    return phase3StudioProjectLibraryHelpers.renderStudioProjectLibrary(project);
  }
  function renderSeriesOutlineCard(seriesProject) {
    return phase3StudioProjectLibraryHelpers.renderSeriesOutlineCard(seriesProject);
  }
  function renderStudioSeriesLibrary() {
    return phase3StudioProjectLibraryHelpers.renderStudioSeriesLibrary();
  }
  function renderStudioEpisodeLibrary() {
    return phase3StudioProjectLibraryHelpers.renderStudioEpisodeLibrary();
  }
  function syncSeriesProjectCounts(project) {
    phase3SeriesManagementHelpers.syncSeriesProjectCounts(project);
  }

  function createLocalEpisodeProjectForSeries(seriesProject, season, episode) {
    return phase3SeriesManagementHelpers.createLocalEpisodeProjectForSeries(seriesProject, season, episode);
  }

  function addLocalSeriesSeason(project) {
    return phase3SeriesManagementHelpers.addLocalSeriesSeason(project);
  }

  function addLocalSeriesEpisode(project, seasonId = "") {
    return phase3SeriesManagementHelpers.addLocalSeriesEpisode(project, seasonId);
  }

  async function refreshSeriesProjectOutline(project) {
    return phase3SeriesManagementHelpers.refreshSeriesProjectOutline(project);
  }

  async function createSeriesSeason(project) {
    return phase3SeriesManagementHelpers.createSeriesSeason(project);
  }

  async function createSeriesEpisode(project, seasonId = "") {
    return phase3SeriesManagementHelpers.createSeriesEpisode(project, seasonId);
  }

  function linkLocalEpisodeIntoSeriesOutline(seriesProject, remoteEpisodeId, localProjectId) {
    phase3SeriesManagementHelpers.linkLocalEpisodeIntoSeriesOutline(seriesProject, remoteEpisodeId, localProjectId);
  }

  async function openSeriesEpisodeTarget(project, localProjectId = "", entryProjectId = 0, episodeTitle = "") {
    return phase3SeriesManagementHelpers.openSeriesEpisodeTarget(project, localProjectId, entryProjectId, episodeTitle);
  }

  function renderStudioView(project) {
    if (state.currentView === "studio-project-library") {
      return renderStudioProjectLibrary(project);
    }
    if (state.currentView === "studio-story-board") {
      return renderStudioStoryBoard(project);
    }
    if (state.currentView === "studio-scene-planner") {
      return renderStudioScenePlanner(project);
    }
    if (state.currentView === "studio-clip-composer") {
      return renderStudioClipComposer(project);
    }
    if (state.currentView === "studio-studios") {
      return renderStudioStudios();
    }
    if (state.currentView === "studio-series") {
      return renderStudioSeriesLibrary();
    }
    if (state.currentView === "studio-episodes") {
      return renderStudioEpisodeLibrary();
    }
    if (state.currentView === "studio-talent") {
      return phase3StudioViewHelpers
        ? phase3StudioViewHelpers.renderStudioBoardEntityView(project, "Talent", "character", "No talent entries on the current idea board.")
        : renderStudioEntityList(
            "Talent",
            getBoardCardsByCategory(project, "character").map((card) => ({ title: card.title || "Untitled character", subtitle: "Idea Board", meta: card.description || "" })),
            "No talent entries on the current idea board."
          );
    }
    if (state.currentView === "studio-locations") {
      return phase3StudioViewHelpers
        ? phase3StudioViewHelpers.renderStudioBoardEntityView(project, "Locations", "location", "No location entries on the current idea board.")
        : renderStudioEntityList(
            "Locations",
            getBoardCardsByCategory(project, "location").map((card) => ({ title: card.title || "Untitled location", subtitle: "Idea Board", meta: card.description || "" })),
            "No location entries on the current idea board."
          );
    }
    if (state.currentView === "studio-props") {
      return phase3StudioViewHelpers
        ? phase3StudioViewHelpers.renderStudioBoardEntityView(project, "Props", "prop", "No prop entries on the current idea board.")
        : renderStudioEntityList(
            "Props",
            getBoardCardsByCategory(project, "prop").map((card) => ({ title: card.title || "Untitled prop", subtitle: "Idea Board", meta: card.description || "" })),
            "No prop entries on the current idea board."
          );
    }
    return renderStudioProjectLibrary(project);
  }

  function defaultTimeline(fps = 24, duration = 30) {
    return {
      duration,
      fps,
      zoom: 28,
      markers: [],
      tracks: [
        {
          id: "video-1",
          label: "V1",
          items: []
        },
        {
          id: "audio-1",
          label: "A1",
          items: []
        }
      ]
    };
  }

  phase3ProjectNormalizationHelpers = window.EditorStateModules?.createProjectNormalizationHelpers?.({
    state,
    workflowStages: WORKFLOW_STAGES,
    createIdeaBoardState,
    createProjectPitchState,
    createScriptState,
    createStartingImagesState,
    createVideoClipsState,
    normalizeStudioId,
    normalizeProjectFormat,
    normalizeProjectContainerTitle,
    normalizeTransition,
    defaultTimeline
  }) || null;

  phase3AuthSessionHelpers = window.EditorAuthSessionModules?.createAuthSessionHelpers?.({
    state,
    authStorageKey: AUTH_STORAGE_KEY,
    normalizeStudioId
  }) || null;

  async function refreshAuthSession() {
    if (!state.auth.token) {
      throw new Error("Authentication is required.");
    }

    const refreshed = await window.editorShell.apiRefresh({
      baseUrl: state.auth.baseUrl,
      token: state.auth.token
    });
    applyAuthSession(refreshed);
    return refreshed;
  }

  async function apiRequest(path, method = "GET", body, options = {}) {
    if (!phase3ApiClient) {
      throw new Error("API client is not initialized.");
    }
    return phase3ApiClient.apiRequest(path, method, body, options);
  }

  function getScopeErrorCode(error) {
    return String(
      error?.payload?.error?.code
      || error?.payload?.code
      || error?.code
      || ""
    ).toUpperCase();
  }

  function isStudioScopeError(error) {
    const code = getScopeErrorCode(error);
    const message = String(error?.message || "").toUpperCase();
    return [
      "STUDIO_REQUIRED",
      "STUDIO_FORBIDDEN",
      "RESOURCE_NOT_IN_STUDIO"
    ].includes(code)
      || message.includes("STUDIO_REQUIRED")
      || message.includes("STUDIO_FORBIDDEN")
      || message.includes("RESOURCE_NOT_IN_STUDIO");
  }

  function handleStudioScopeError(error) {
    const code = getScopeErrorCode(error);
    if (code === "STUDIO_FORBIDDEN") {
      state.auth.currentStudioId = null;
    }
    state.auth.studioPickerOpen = Array.isArray(state.auth.studios) && state.auth.studios.length > 0;
    resetStateForStudioSwitch(state.auth.currentStudioId);
    if (code === "RESOURCE_NOT_IN_STUDIO") {
      setNotice("That project or resource does not belong to the current studio.", "error");
    } else {
      setNotice("Select a valid studio to continue.", "error");
    }
    persistAuth();
    render();
  }

  phase3ApiClient = window.EditorApiModules?.createClient?.({
    state,
    clearAuthState,
    renderAuthGate,
    refreshAuthSession,
    isStudioScopeError,
    handleStudioScopeError
  }) || null;

  phase3PlatformProjectHelpers = window.EditorApiModules?.createPlatformProjectHelpers?.({
    state,
    projectsRef: {
      get() {
        return projects;
      }
    },
    apiRequest,
    normalizePlatformProject,
    normalizePlatformIdeaBoard,
    normalizePlatformAsset,
    normalizePlatformTimeline,
    createProjectPitchState,
    savePlatformIdeaBoard,
    resetSelectionForProject,
    syncCurrentProjectTimecode,
    autosaveProjects,
    setNotice,
    normalizeStudioId
  }) || null;

  function normalizePlatformProject(project) {
    const normalizedType = normalizeProjectFormat(project.type || "episode");
    const entryProjectId = project.entry_project_id != null ? Number(project.entry_project_id) : null;
    const effectiveRemoteType = normalizedType === "series" && entryProjectId ? "episode" : normalizedType;
    const effectiveRemoteId = normalizedType === "series" && entryProjectId ? entryProjectId : Number(project.id);
    const studioId = normalizeStudioId(project.studio_id ?? state.auth.currentStudioId ?? null);
    return {
      id: `platform-${normalizedType}-${project.id}`,
      remoteType: effectiveRemoteType,
      remoteId: effectiveRemoteId,
      studioId,
      remoteStudioId: studioId,
      remoteSeriesId: project.series_id != null ? Number(project.series_id) : null,
      remoteSeasonId: project.season_id != null ? Number(project.season_id) : null,
      remoteEpisodeId: project.episode_id != null ? Number(project.episode_id) : null,
      entryProjectId,
      seasonCount: Number(project.season_count || 0),
      episodeCount: Number(project.episode_count || 0),
      seriesOutline: project.series_outline || (Array.isArray(project.seasons) ? {
        season_count: Number(project.season_count || project.seasons.length || 0),
        episode_count: Number(project.episode_count || 0),
        seasons: project.seasons
      } : null),
      name: normalizeProjectContainerTitle(normalizedType, project.title),
      type: normalizedType,
      clipCount: Number(project.clip_count || 0),
      workflow: createWorkflowState("edit"),
      ideaBoard: createIdeaBoardState({
        cards: []
      }),
      projectPitch: createProjectPitchState({
        format: normalizedType
      }),
      ideaBoardMeta: null,
      fps: 24,
      status: project.status || "Platform",
      syncLabel: "Imported from SocialArena",
      previewLabel: "1080p Draft",
      timecode: "00:00:00:00",
      selectedLabel: "No Selection",
      assets: [],
      timeline: defaultTimeline(24, 30)
    };
  }

  function normalizePlatformIdeaBoard(ideaBoard) {
    if (!ideaBoard) {
      return {
        meta: null,
        board: createIdeaBoardState({ cards: [] })
      };
    }

    const cards = Array.isArray(ideaBoard.items)
      ? ideaBoard.items.map((item) => ({
          id: String(item.id),
          category: IDEA_BOARD_CATEGORIES.some((entry) => entry.id === item.item_type) ? item.item_type : IDEA_CATEGORY_ALIASES[item.item_type] || "note",
          title: item.title || "",
          description: item.content || "",
          status: item.generation_status || "draft",
          influencedBy: [],
          x: Number(item.pos_x ?? 20),
          y: Number(item.pos_y ?? 20),
          width: Number(item.width ?? 240),
          height: Number(item.height ?? 160),
          imageUrl: item.image_url || item.generated_image_url || "",
          generatedImageUrl: item.generated_image_url || "",
          generationStatus: item.generation_status || "idle",
          generationCount: Number(item.generation_count || 0),
          lastGeneratedAt: item.last_generated_at || "",
          lastError: item.last_error || "",
          promptText: item.prompt_text || "",
          promptId: item.prompt_id || "",
          linkUrl: item.link_url || ""
        }))
      : [];

    const cardMap = new Map(cards.map((card) => [String(card.id), card]));
    if (Array.isArray(ideaBoard.links)) {
      ideaBoard.links.forEach((link) => {
        const target = cardMap.get(String(link.target_item_id));
        if (target) {
          target.influencedBy = Array.isArray(target.influencedBy) ? target.influencedBy : [];
          target.influencedBy.push(String(link.source_item_id));
        }
      });
    }

    return {
      meta: {
        id: Number(ideaBoard.id),
        title: ideaBoard.title || "",
        description: ideaBoard.description || "",
        visibility: ideaBoard.visibility || "private",
        updatedAt: ideaBoard.updated_at || ""
      },
      board: createIdeaBoardState({ cards })
    };
  }

  function serializeIdeaBoardForPlatform(project) {
    const cards = Array.isArray(project?.ideaBoard?.cards) ? project.ideaBoard.cards : [];
    const items = cards.map((card) => ({
      id: /^\d+$/.test(String(card.id || "")) ? Number(card.id) : String(card.id || ""),
      item_type: card.category || "note",
      title: card.title || "",
      content: card.description || "",
      image_url: card.imageUrl || "",
      link_url: card.linkUrl || "",
      pos_x: Number(card.x ?? 20),
      pos_y: Number(card.y ?? 20),
      width: Number(card.width ?? 240),
      height: Number(card.height ?? 160)
    }));
    const links = cards.flatMap((card) =>
      (Array.isArray(card.influencedBy) ? card.influencedBy : []).map((sourceId) => ({
        source_item_id: /^\d+$/.test(String(sourceId || "")) ? Number(sourceId) : String(sourceId || ""),
        target_item_id: /^\d+$/.test(String(card.id || "")) ? Number(card.id) : String(card.id || ""),
        link_type: "note"
      }))
    );

    return {
      title: project.ideaBoardMeta?.title || `${project.name} Idea Board`,
      description: project.ideaBoardMeta?.description || project.description || "",
      items,
      links
    };
  }

  function normalizePlatformAsset(asset) {
    const kind = asset.asset_type === "audio" ? "audio" : asset.asset_type === "image" ? "image" : "video";
    return {
      id: String(asset.id),
      name: asset.title || "Untitled Asset",
      kind,
      meta:
        typeof asset.duration_seconds === "number"
          ? formatDurationLabel(Number(asset.duration_seconds))
          : kind === "image"
            ? "remote image"
            : kind === "audio"
              ? "remote audio"
              : "remote video",
      sourceUrl: asset.url || "",
      thumbnailUrl: asset.thumbnail_url || asset.url || "",
      durationSeconds: typeof asset.duration_seconds === "number" ? Number(asset.duration_seconds) : undefined
    };
  }

  function normalizePlatformTimeline(timelineProject, remoteAssets) {
    if (!timelineProject?.timeline_json || !Array.isArray(timelineProject.timeline_json.tracks)) {
      return defaultTimeline(24, 30);
    }

    const fps = Number(timelineProject.timeline_json.fps || 24);
    const duration = Number(timelineProject.timeline_json.duration || 30);
    const assetMap = new Map(remoteAssets.map((asset) => [String(asset.source_id), asset]));

    return {
      duration,
      fps,
      tracks: timelineProject.timeline_json.tracks.map((track, trackIndex) => ({
        id: String(track.id || `${track.type || "video"}-${trackIndex + 1}`),
        label:
          track.type === "audio"
            ? `A${trackIndex + 1}`
            : track.type === "video"
              ? `V${trackIndex + 1}`
              : String(track.id || `T${trackIndex + 1}`),
        items: Array.isArray(track.items)
          ? track.items.map((item, itemIndex) => {
              const remoteAsset = item.asset_id ? assetMap.get(String(item.asset_id)) : null;
              const durationSeconds = Number(item.duration || remoteAsset?.duration_seconds || 5);
              return {
                id: String(item.id || `${track.id || "track"}-item-${itemIndex + 1}`),
                name: remoteAsset?.title || item.name || `Item ${itemIndex + 1}`,
                kind:
                  track.type === "audio"
                    ? "audio"
                    : remoteAsset?.asset_type === "image"
                      ? "title"
                      : "video",
                width: `${Math.max(12, Math.min(78, (durationSeconds / Math.max(duration, 1)) * 100))}%`,
                sourceIn: formatTimecode(Number(item.source_in || 0), fps),
                sourceOut: formatDurationLabel(durationSeconds),
                sourceUrl: remoteAsset?.url || "",
                durationSeconds,
                volume: Number(item.volume ?? 100)
              };
            })
          : []
      }))
    };
  }

  async function fetchPlatformProjects() {
    if (!phase3PlatformProjectHelpers) {
      return;
    }
    return phase3PlatformProjectHelpers.fetchPlatformProjects();
  }

  async function savePlatformIdeaBoard(project) {
    if (!project?.remoteType || !project?.remoteId) {
      return null;
    }

    const payload = serializeIdeaBoardForPlatform(project);
    const result = await apiRequest(
      `editor/projects/${project.remoteType}/${project.remoteId}/idea-board`,
      "POST",
      payload
    );
    const normalized = normalizePlatformIdeaBoard(result?.idea_board || null);
    project.ideaBoard = normalized.board;
    project.ideaBoardMeta = normalized.meta;
    return normalized.meta;
  }

  async function runIdeaBoardItemAction(project, cardId, actionSlug) {
    if (!project?.remoteType || !project?.remoteId) {
      throw new Error("Idea board actions require a platform-backed project.");
    }

    const numericCardId = Number(cardId);
    if (!Number.isFinite(numericCardId)) {
      throw new Error("This node must be saved to the platform before running generation actions.");
    }

    return apiRequest(
      `editor/projects/${project.remoteType}/${project.remoteId}/idea-board/items/${numericCardId}/${actionSlug}`,
      "POST",
      {}
    );
  }

  async function refreshPlatformIdeaBoard(project) {
    if (!project?.remoteType || !project?.remoteId) {
      return;
    }

    const result = await apiRequest(
      `editor/projects/${project.remoteType}/${project.remoteId}/idea-board`
    );
    const normalized = normalizePlatformIdeaBoard(result?.idea_board || null);
    project.ideaBoard = normalized.board;
    project.ideaBoardMeta = normalized.meta;
  }

  async function generateStartingImageForScene(project, sceneId) {
    if (!project?.remoteType || !project?.remoteId) {
      throw new Error("Starting image generation requires a platform-backed project.");
    }

    ensureStartingImagesDraft(project);
    const scene = project?.startingImages?.scenes?.find((entry) => entry.id === sceneId);
    if (!scene) {
      throw new Error("Starting image scene could not be found.");
    }

    const selectedImageAsset = project.assets?.find((asset) => asset.id === state.selectedAssetId && asset.kind === "image") || null;
    const result = await apiRequest(
      `editor/projects/${project.remoteType}/${project.remoteId}/starting-images/generate`,
      "POST",
      {
        scene_id: scene.scriptSceneId || scene.id,
        scene_title: scene.title,
        prompt: scene.prompt,
        shot_notes: scene.shotNotes,
        reference_image_url: selectedImageAsset?.sourceUrl || selectedImageAsset?.thumbnailUrl || "",
        board_item_id: scene.boardItemId || undefined
      }
    );

    const payload = result?.starting_image || {};
    scene.boardItemId = String(payload.board_item_id || scene.boardItemId || "");
    scene.generationStatus = payload.generation_status || "queued";
    scene.generationCount = Number(payload.generation_count || scene.generationCount || 0);
    scene.promptId = payload.prompt_id || scene.promptId || "";
    scene.lastGeneratedAt = payload.last_generated_at || scene.lastGeneratedAt || "";
    scene.lastError = payload.last_error || "";
    scene.status = payload.generated_image_url ? "ready" : "queued";
    scene.updatedAt = new Date().toISOString();
    project.startingImages.updatedAt = scene.updatedAt;

    if (payload.generated_image_url && !scene.variations.some((variation) => variation.imageUrl === payload.generated_image_url)) {
      addStartingImageVariation(project, sceneId, {
        source: "generated",
        label: `Generated ${scene.generationCount || scene.variations.length + 1}`,
        imageUrl: payload.generated_image_url,
        status: "generated"
      });
      scene.status = "ready";
    }

    return result;
  }

  function applyStartingImagePayload(project, sceneId, payload = {}) {
    ensureStartingImagesDraft(project);
    const scene = project?.startingImages?.scenes?.find((entry) => entry.id === sceneId);
    if (!scene) {
      return false;
    }

    const previousStatus = scene.status;
    const previousGeneratedImage = scene.variations.find((variation) => variation.source === "generated")?.imageUrl || "";

    scene.boardItemId = String(payload.board_item_id || scene.boardItemId || "");
    scene.generationStatus = payload.generation_status || scene.generationStatus || "idle";
    scene.generationCount = Number(payload.generation_count || scene.generationCount || 0);
    scene.promptId = payload.prompt_id || scene.promptId || "";
    scene.lastGeneratedAt = payload.last_generated_at || scene.lastGeneratedAt || "";
    scene.lastError = payload.last_error || "";

    if (payload.generated_image_url) {
      if (!scene.variations.some((variation) => variation.imageUrl === payload.generated_image_url)) {
        addStartingImageVariation(project, sceneId, {
          source: "generated",
          label: `Generated ${scene.generationCount || scene.variations.length + 1}`,
          imageUrl: payload.generated_image_url,
          status: "generated"
        });
      }
      scene.status = "ready";
    } else if (scene.generationStatus === "failed") {
      scene.status = "failed";
    } else if (scene.generationStatus === "queued") {
      scene.status = "queued";
    }

    scene.updatedAt = new Date().toISOString();
    project.startingImages.updatedAt = scene.updatedAt;

    return previousStatus !== scene.status || previousGeneratedImage !== (payload.generated_image_url || previousGeneratedImage);
  }

  async function refreshStartingImageForScene(project, sceneId) {
    if (!project?.remoteType || !project?.remoteId) {
      throw new Error("Starting image refresh requires a platform-backed project.");
    }

    ensureStartingImagesDraft(project);
    const scene = project?.startingImages?.scenes?.find((entry) => entry.id === sceneId);
    if (!scene) {
      throw new Error("Starting image scene could not be found.");
    }
    if (!scene.boardItemId) {
      throw new Error("This scene has not been queued for generation yet.");
    }

    const result = await apiRequest(
      `editor/projects/${project.remoteType}/${project.remoteId}/starting-images/refresh`,
      "POST",
      {
        board_item_id: scene.boardItemId
      }
    );

    applyStartingImagePayload(project, sceneId, result?.starting_image || {});
    return result;
  }

  function queuedStartingImageScenes(project) {
    ensureStartingImagesDraft(project);
    return (project?.startingImages?.scenes || []).filter((scene) => {
      const status = String(scene.generationStatus || scene.status || "").toLowerCase();
      return Boolean(scene.boardItemId) && (status === "queued" || status === "processing" || status === "generating");
    });
  }

  function stopStartingImagePolling() {
    if (startingImagePollTimer) {
      clearInterval(startingImagePollTimer);
      startingImagePollTimer = null;
    }
    startingImagePollInFlight = false;
  }

  async function pollQueuedStartingImages() {
    if (startingImagePollInFlight) {
      return;
    }

    if (state.auth.status !== "authenticated" || state.currentView !== "editor") {
      stopStartingImagePolling();
      return;
    }

    const project = getProject();
    if (!project || getWorkflowStage(project).id !== "starting_images" || !project.remoteType || !project.remoteId) {
      stopStartingImagePolling();
      return;
    }

    const queuedScenes = queuedStartingImageScenes(project);
    if (!queuedScenes.length) {
      stopStartingImagePolling();
      return;
    }

    startingImagePollInFlight = true;
    let updated = false;
    let readySceneTitle = "";

    try {
      for (const scene of queuedScenes) {
        const result = await refreshStartingImageForScene(project, scene.id);
        const payload = result?.starting_image || {};
        if (payload.generated_image_url) {
          updated = true;
          readySceneTitle = readySceneTitle || scene.title || "scene";
        } else if (payload.generation_status === "failed" && payload.last_error) {
          updated = true;
          setNotice(payload.last_error, "error");
        }
      }
    } catch (error) {
      setNotice(error.message || "Failed to refresh starting image generation", "error");
      updated = true;
    } finally {
      startingImagePollInFlight = false;
    }

    if (updated) {
      autosaveProjects();
      if (readySceneTitle) {
        setNotice(`Starting image ready for ${readySceneTitle}`, "success");
      }
      render();
    }
  }

  function syncStartingImagePolling(project) {
    if (
      state.auth.status === "authenticated"
      && state.currentView === "editor"
      && project
      && getWorkflowStage(project).id === "starting_images"
      && project.remoteType
      && project.remoteId
      && queuedStartingImageScenes(project).length > 0
    ) {
      if (!startingImagePollTimer) {
        startingImagePollTimer = setInterval(() => {
          pollQueuedStartingImages().catch(() => {});
        }, 5000);
      }
      return;
    }

    stopStartingImagePolling();
  }

  function queuedVideoClipRequests(project) {
    ensureVideoClipsDraft(project);
    return (project?.videoClips?.scenes || []).flatMap((scene) =>
      (scene.clips || [])
        .filter((clip) => {
          const status = String(clip.generationStatus || clip.status || "").toLowerCase();
          return Boolean(clip.boardItemId) && (status === "queued" || status === "processing" || status === "generating");
        })
        .map((clip) => ({ scene, clip }))
    );
  }

  function stopVideoClipPolling() {
    if (videoClipPollTimer) {
      clearInterval(videoClipPollTimer);
      videoClipPollTimer = null;
    }
    videoClipPollInFlight = false;
  }

  async function pollQueuedVideoClips() {
    if (videoClipPollInFlight) {
      return;
    }

    if (state.auth.status !== "authenticated" || state.currentView !== "editor") {
      stopVideoClipPolling();
      return;
    }

    const project = getProject();
    if (!project || getWorkflowStage(project).id !== "video_clips" || !project.remoteType || !project.remoteId) {
      stopVideoClipPolling();
      return;
    }

    const queuedRequests = queuedVideoClipRequests(project);
    if (!queuedRequests.length) {
      stopVideoClipPolling();
      return;
    }

    videoClipPollInFlight = true;
    let updated = false;
    let readySceneTitle = "";

    try {
      for (const entry of queuedRequests) {
        const result = await refreshVideoClipForScene(project, entry.scene.id, entry.clip.id);
        const payload = result?.video_clip || {};
        if (payload.generated_video_url) {
          updated = true;
          readySceneTitle = readySceneTitle || `${entry.scene.title || "scene"} / ${entry.clip.title || "clip"}`;
        } else if (payload.generation_status === "failed" && payload.last_error) {
          updated = true;
          setNotice(payload.last_error, "error");
        }
      }
    } catch (error) {
      setNotice(error.message || "Failed to refresh video clip generation", "error");
      updated = true;
    } finally {
      videoClipPollInFlight = false;
    }

    if (updated) {
      autosaveProjects();
      if (readySceneTitle) {
        setNotice(`Video clip ready for ${readySceneTitle}`, "success");
      }
      render();
    }
  }

  function syncVideoClipPolling(project) {
    if (
      state.auth.status === "authenticated"
      && state.currentView === "editor"
      && project
      && getWorkflowStage(project).id === "video_clips"
      && project.remoteType
      && project.remoteId
      && queuedVideoClipRequests(project).length > 0
    ) {
      if (!videoClipPollTimer) {
        videoClipPollTimer = setInterval(() => {
          pollQueuedVideoClips().catch(() => {});
        }, 5000);
      }
      return;
    }

    stopVideoClipPolling();
  }

  async function generateVideoClipForScene(project, sceneId, requestId = "") {
    if (!project?.remoteType || !project?.remoteId) {
      throw new Error("Video clip generation requires a platform-backed project.");
    }

    ensureVideoClipsDraft(project);
    const scene = project?.videoClips?.scenes?.find((entry) => entry.id === sceneId);
    const request = scene?.clips?.find((entry) => entry.id === requestId) || scene?.clips?.[0];
    if (!scene) {
      throw new Error("Video clip scene could not be found.");
    }
    if (!request) {
      throw new Error("Video clip request could not be found.");
    }
    if (!scene.startingImageUrl) {
      throw new Error("Approve a starting image first.");
    }

    const startingScene = project?.startingImages?.scenes?.find((entry) => entry.scriptSceneId === scene.scriptSceneId || entry.id === sceneId);
    if (!startingScene?.boardItemId) {
      throw new Error("Starting image scene has not been linked to the platform yet.");
    }

    const result = await apiRequest(
      `editor/projects/${project.remoteType}/${project.remoteId}/video-clips/generate`,
      "POST",
      {
        scene_id: `${scene.scriptSceneId || scene.id}::${request.id}`,
        scene_title: `${scene.title}${request.title ? ` - ${request.title}` : ""}`,
        clip_prompt: request.clipPrompt,
        shot_notes: request.shotNotes,
        scene_board_item_id: startingScene.boardItemId,
        board_item_id: request.boardItemId || undefined
      }
    );

    const payload = result?.video_clip || {};
    request.boardItemId = String(payload.board_item_id || request.boardItemId || "");
    request.generationStatus = payload.generation_status || "queued";
    request.generationCount = Number(payload.generation_count || request.generationCount || 0);
    request.promptId = payload.prompt_id || request.promptId || "";
    request.lastGeneratedAt = payload.last_generated_at || request.lastGeneratedAt || "";
    request.lastError = payload.last_error || "";
    request.status = payload.generated_video_url ? "generated" : "queued";
    request.updatedAt = new Date().toISOString();
    recomputeVideoClipSceneAggregate(scene);
    project.videoClips.updatedAt = scene.updatedAt;

    if (payload.generated_video_url) {
      const clip = addGeneratedVideoClip(project, sceneId, request.id, {
        label: `${request.title || "Clip"} ${request.generationCount || request.generatedClips.length + 1}`,
        videoUrl: payload.generated_video_url,
        thumbnailUrl: payload.generated_video_url,
        status: "generated"
      });
      ensureGeneratedClipAsset(project, scene, request, clip);
      if (timelineHasContent(project)) {
        syncApprovedGeneratedClipIntoTimeline(project, sceneId, request.id);
      }
    }

    return result;
  }

  async function refreshVideoClipForScene(project, sceneId, requestId = "") {
    if (!project?.remoteType || !project?.remoteId) {
      throw new Error("Video clip refresh requires a platform-backed project.");
    }

    ensureVideoClipsDraft(project);
    const scene = project?.videoClips?.scenes?.find((entry) => entry.id === sceneId);
    const request = scene?.clips?.find((entry) => entry.id === requestId) || scene?.clips?.[0];
    if (!scene) {
      throw new Error("Video clip scene could not be found.");
    }
    if (!request) {
      throw new Error("Video clip request could not be found.");
    }
    if (!request.boardItemId) {
      throw new Error("This scene has not been queued for clip generation yet.");
    }

    const result = await apiRequest(
      `editor/projects/${project.remoteType}/${project.remoteId}/video-clips/refresh`,
      "POST",
      {
        board_item_id: request.boardItemId
      }
    );

    const payload = result?.video_clip || {};
    request.boardItemId = String(payload.board_item_id || request.boardItemId || "");
    request.generationStatus = payload.generation_status || request.generationStatus || "idle";
    request.generationCount = Number(payload.generation_count || request.generationCount || 0);
    request.promptId = payload.prompt_id || request.promptId || "";
    request.lastGeneratedAt = payload.last_generated_at || request.lastGeneratedAt || "";
    request.lastError = payload.last_error || "";

    if (payload.generated_video_url) {
      if (!request.generatedClips.some((clip) => clip.videoUrl === payload.generated_video_url)) {
        const clip = addGeneratedVideoClip(project, sceneId, request.id, {
          label: `${request.title || "Clip"} ${request.generationCount || request.generatedClips.length + 1}`,
          videoUrl: payload.generated_video_url,
          thumbnailUrl: payload.generated_video_url,
          status: "generated"
        });
        ensureGeneratedClipAsset(project, scene, request, clip);
        if (timelineHasContent(project)) {
          syncApprovedGeneratedClipIntoTimeline(project, sceneId, request.id);
        }
      }
      request.status = "generated";
    } else if (request.generationStatus === "failed") {
      request.status = "failed";
    } else if (request.generationStatus === "queued") {
      request.status = "queued";
    }

    request.updatedAt = new Date().toISOString();
    recomputeVideoClipSceneAggregate(scene);
    project.videoClips.updatedAt = scene.updatedAt;
    return result;
  }

  async function importPlatformProject(projectSummary) {
    if (!phase3PlatformProjectHelpers) {
      throw new Error("Platform project helpers are not initialized.");
    }
    return phase3PlatformProjectHelpers.importPlatformProject(projectSummary);
  }

  async function ensurePlatformBackedProject(project) {
    if (!phase3PlatformProjectHelpers) {
      throw new Error("Platform project helpers are not initialized.");
    }
    return phase3PlatformProjectHelpers.ensurePlatformBackedProject(project);
  }

  function deprecatedFormatSeriesMeta(projectLike) {
    const seasonCount = Number(projectLike?.seasonCount || projectLike?.season_count || 0);
    const episodeCount = Number(projectLike?.episodeCount || projectLike?.episode_count || 0);
    const parts = [];
    if (seasonCount) {
      parts.push(`${seasonCount} season${seasonCount === 1 ? "" : "s"}`);
    }
    if (episodeCount) {
      parts.push(`${episodeCount} episode${episodeCount === 1 ? "" : "s"}`);
    }
    return parts.join(" · ") || "No seasons yet";
  }

  function deprecatedFormatSeriesMetaResolved(projectLike) {
    const seasonCount = Number(projectLike?.seasonCount || projectLike?.season_count || projectLike?.seriesOutline?.season_count || 0);
    const episodeCount = Number(projectLike?.episodeCount || projectLike?.episode_count || projectLike?.seriesOutline?.episode_count || 0);
    const parts = [];
    if (seasonCount) {
      parts.push(`${seasonCount} season${seasonCount === 1 ? "" : "s"}`);
    }
    if (episodeCount) {
      parts.push(`${episodeCount} episode${episodeCount === 1 ? "" : "s"}`);
    }
    return parts.join(" · ") || "No seasons yet";
  }

  function formatSeriesMeta(projectLike) {
    const seasonCount = Number(projectLike?.seasonCount || projectLike?.season_count || projectLike?.seriesOutline?.season_count || 0);
    const episodeCount = Number(projectLike?.episodeCount || projectLike?.episode_count || projectLike?.seriesOutline?.episode_count || 0);
    const parts = [];
    if (seasonCount) {
      parts.push(`${seasonCount} season${seasonCount === 1 ? "" : "s"}`);
    }
    if (episodeCount) {
      parts.push(`${episodeCount} episode${episodeCount === 1 ? "" : "s"}`);
    }
    return parts.join(" · ") || "No seasons yet";
  }

  function authStoragePayload() {
    return phase3AuthSessionHelpers
      ? phase3AuthSessionHelpers.authStoragePayload()
      : JSON.stringify({
          token: state.auth.token,
          user: state.auth.user,
          studios: state.auth.studios,
          currentStudioId: state.auth.currentStudioId,
          baseUrl: state.auth.baseUrl,
          usernameDraft: state.auth.usernameDraft
        });
  }

  function persistAuth() {
    localStorage.setItem(AUTH_STORAGE_KEY, authStoragePayload());
  }

  function clearAuthStorage() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }

  function applyAuthSession(payload) {
    if (phase3AuthSessionHelpers) {
      phase3AuthSessionHelpers.applyAuthSession(payload);
      return;
    }
    state.auth.token = payload.token || "";
    state.auth.user = payload.user || null;
    state.auth.studios = Array.isArray(payload.studios) ? payload.studios : state.auth.studios || [];
    state.auth.currentStudioId = Object.prototype.hasOwnProperty.call(payload || {}, "current_studio_id")
      ? normalizeStudioId(payload.current_studio_id)
      : normalizeStudioId(state.auth.currentStudioId);
    state.auth.studioPickerOpen = false;
    state.auth.usernameDraft = payload.user?.username || state.auth.usernameDraft || "";
    state.auth.status = "authenticated";
    state.auth.error = "";
    state.auth.loading = false;
    persistAuth();
  }

  function clearAuthState() {
    if (phase3AuthSessionHelpers) {
      phase3AuthSessionHelpers.clearAuthState();
      return;
    }
    state.auth.token = "";
    state.auth.user = null;
    state.auth.studios = [];
    state.auth.currentStudioId = null;
    state.auth.studioPickerOpen = false;
    state.auth.status = "guest";
    state.auth.error = "";
    state.auth.loading = false;
    clearAuthStorage();
  }

  function resetStateForStudioSwitch(nextStudioId = state.auth.currentStudioId) {
    state.playing = false;
    stopPlaybackTimer();
    stopStartingImagePolling();
    stopVideoClipPolling();
    closeBridgeClipModal();
    state.platform.modalOpen = false;
    state.platform.error = "";
    state.platform.projects = [];
    state.dashboard.data = null;
    state.dashboard.error = "";
    state.selectedAssetId = "";
    state.selectedSceneSegmentId = "";
    state.selectedTimelineItemId = "";
    state.selectedStartingImageSceneId = "";
    state.selectedVideoClipSceneId = "";
    state.selectedScriptSceneId = "";
    state.timelineDropIndicator.trackId = "";
    state.timelineDropIndicator.seconds = 0;
    state.currentSeconds = 0;
    playbackView.activePreviewItemId = "";
    playbackView.activeAudioItemId = "";

    const scopedProjects = getStudioScopedProjects(nextStudioId);
    const selectedProjectStillValid = scopedProjects.some((project) => project.id === state.selectedProjectId);
    state.selectedProjectId = selectedProjectStillValid ? state.selectedProjectId : (scopedProjects[0]?.id || "");
    if (!selectedProjectStillValid) {
      state.projectFilePath = "";
    }

    if (state.selectedProjectId) {
      const project = scopedProjects.find((entry) => entry.id === state.selectedProjectId) || getProject();
      resetSelectionForProject(project || null);
      syncCurrentProjectTimecode();
    } else {
      resetSelectionForProject(null);
    }

    state.currentView = "dashboard";
  }

  function synchronizeProjectSelectionToStudio(nextStudioId = state.auth.currentStudioId) {
    phase3ProjectSelectionHelpers.synchronizeProjectSelectionToStudio(nextStudioId);
  }

  function getCurrentStudioSummary() {
    const studios = Array.isArray(state.auth.studios) ? state.auth.studios : [];
    const current = studios.find((studio) => Number(studio.id) === Number(state.auth.currentStudioId));
    if (current) {
      return current;
    }

    if (!studios.length) {
      return {
        id: null,
        name: "Personal Workspace",
        role: "Owner"
      };
    }

    return null;
  }

  phase3StudioDashboardHelpers = window.EditorStudioModules?.createDashboardHelpers?.({
    state,
    workflowStages: WORKFLOW_STAGES,
    getProject,
    getStudioScopedProjects,
    getCurrentStudioSummary,
    getWorkflowStage,
    getStageProgressPercent,
    formatProjectTypeLabel,
    escapeHtml
  }) || null;

  phase3StudioProjectLibraryHelpers = window.EditorStudioModules?.createProjectLibraryHelpers?.({
    state,
    getProject,
    getStudioScopedProjects,
    getWorkflowStage,
    formatProjectTypeLabel,
    formatSeriesMeta,
    escapeHtml
  }) || null;

  phase3SeriesManagementHelpers = window.EditorStudioModules?.createSeriesManagementHelpers?.({
    state,
    projectsRef: {
      get() {
        return projects;
      }
    },
    normalizeProjectShape,
    createNewProjectDocument,
    normalizeStudioId,
    apiRequest,
    getStudioScopedProjects,
    importPlatformProject,
    getProject,
    resetSelectionForProject,
    setNotice,
    autosaveProjects
  }) || null;

  phase3StudioPickerHelpers = window.EditorStudioModules?.createStudioPickerHelpers?.({
    state,
    app,
    escapeHtml
  }) || null;

  phase3StudioViewHelpers = window.EditorStudioModules?.createStudioViewHelpers?.({
    state,
    studioSummary,
    getBoardCardsByCategory,
    getWorkflowStage,
    assetClass,
    renderAssetThumbnail,
    formatAssetMeta,
    escapeHtml
  }) || null;

  phase3AssetLibraryHelpers = window.EditorAssetModules?.createAssetLibraryHelpers?.({
    state,
    getSelectedAsset,
    assetClass,
    renderAssetThumbnail,
    formatAssetMeta,
    escapeHtml
  }) || null;

  phase3ProjectPitchWorkflowHelpers = window.EditorWorkflowModules?.createProjectPitchWorkflowHelpers?.({
    PROJECT_FORMATS,
    createProjectPitchState,
    projectPitchFields,
    isProjectPromoted,
    getPromotionTargetLabel,
    formatProjectTypeLabel,
    escapeHtml
  }) || null;

  phase3ScriptWorkflowHelpers = window.EditorWorkflowModules?.createScriptWorkflowHelpers?.({
    createScriptState,
    ensureScriptDraft,
    getSelectedScriptScene,
    scriptChecklist,
    createProjectPitchState,
    createIdeaBoardState,
    escapeHtml
  }) || null;

  phase3MediaGenerationWorkflowHelpers = window.EditorWorkflowModules?.createMediaGenerationWorkflowHelpers?.({
    state,
    createStartingImagesState,
    createVideoClipsState,
    ensureStartingImagesDraft,
    ensureVideoClipsDraft,
    getSelectedStartingImageScene,
    getSelectedVideoClipScene,
    getSelectedVideoClipRequest,
    startingImagesChecklist,
    renderStartingImageThumb,
    formatAssetMeta,
    getVideoClipCompletion,
    escapeHtml
  }) || null;

  phase3IdeaBoardWorkflowHelpers = window.EditorWorkflowModules?.createIdeaBoardWorkflowHelpers?.({
    state,
    IDEA_BOARD_CATEGORIES,
    createIdeaBoardState,
    escapeHtml
  }) || null;

  phase3EditorStateHelpers = window.EditorStateModules?.createEditorStateHelpers?.({
    state,
    documentRef: document,
    getProject,
    inferAssetKind,
    getSelectedSceneSegment,
    getSceneContext,
    getItemSegment,
    getItemDuration,
    formatDurationLabel,
    ensureVideoClipsDraft,
    setNotice,
    autosaveProjects,
    normalizeTransition
  }) || null;

  phase3EditorSelectionHelpers = window.EditorSelectionModules?.createSelectionHelpers?.({
    state,
    getSelectedSceneSegment,
    getAdjacentSceneContexts,
    getSceneCompleteness,
    formatDurationLabel,
    formatTimecode
  }) || null;

  phase3UiRenderHelpers = window.EditorUiModules?.createRenderUtilsHelpers?.({
    escapeHtml
  }) || null;

  phase3TimelineHelpers = window.EditorTimelineModules?.createTimelineHelpers?.({
    state,
    getProject,
    escapeHtml,
    clipClass,
    getItemDuration,
    getTimelinePixelsPerSecond,
    getTimelineCanvasWidth,
    getProjectDuration,
    getTimelineSceneSegments,
    normalizeTransition
  }) || null;

  phase3InspectorHelpers = window.EditorInspectorModules?.createInspectorHelpers?.({
    state,
    getBoardCardsByCategory,
    deriveSceneDialogue,
    getItemDuration,
    ensureVideoClipsDraft,
    setProjectStage,
    setNotice,
    getItemSegment
  }) || null;

  phase3PlaybackHelpers = window.EditorPlaybackModules?.createPlaybackHelpers?.({
    state,
    playbackView,
    escapeHtml,
    getProject,
    getActiveSegment,
    getProjectDuration,
    formatTimecode,
    setNotice,
    render,
    syncTimelinePlayheads,
    timerRef: {
      get() {
        return playbackTimer;
      },
      set(nextValue) {
        playbackTimer = nextValue;
      }
    }
  }) || null;

  phase3EditorActionHelpers = window.EditorActionModules?.createActionHelpers?.({
    state,
    playbackView,
    getProject,
    setProjectStage,
    ensureVideoClipsDraft,
    ensureTrack,
    appendAssetToTrack,
    replaceTimelineClipForScene,
    createTimelineClipFromAsset,
    recalculateTimelineDuration,
    getSelectedSceneSegment,
    getSceneScriptSceneIdAtSeconds,
    getTimelinePixelsPerSecond,
    getProjectDuration,
    getItemDuration,
    getSelectedTimelineItemContext,
    getTimelineItemContextById,
    getItemSegment,
    getActiveSegment,
    syncCurrentProjectTimecode,
    normalizeTransition,
    normalizeProjectShape,
    editorShell: window.editorShell
  }) || null;

  phase3EditorEditingHelpers = window.EditorEditingModules?.createEditingHelpers?.({
    state,
    getProject,
    getSelectedTimelineItem,
    getTimelineItemContextById,
    getItemSegment,
    getItemDuration,
    getProjectDuration,
    getTimelinePixelsPerSecond,
    formatDurationLabel,
    formatTimecode,
    normalizeTransition,
    syncCurrentProjectTimecode,
    getActiveSegment,
    playbackView,
    setNotice,
    autosaveProjects,
    render
  }) || null;

  phase3EditorWorkspaceHelpers = window.EditorWorkspaceModules?.createWorkspaceHelpers?.({
    state,
    escapeHtml,
    getStudioScopedProjects,
    renderUiIcon,
    assetClass,
    renderAssetThumbnail,
    formatAssetMeta,
    formatTimecode,
    getTimelinePixelsPerSecond,
    renderTimelineRuler,
    renderTimelineTracks,
    renderPreviewContent,
    renderHiddenAudioContent,
    renderInspectorSelectionSummary,
    getSelectedAsset,
    formatProjectTypeLabel
  }) || null;

  phase3UiModalHelpers = window.EditorUiModules?.createModalHelpers?.({
    state,
    escapeHtml,
    createExportSettings,
    getBridgeContext
  }) || null;

  phase3AppShellHelpers = window.AppShellModules?.createShellHelpers?.({
    state,
    appName,
    escapeHtml,
    renderUiIcon,
    getCurrentStudioSummary,
    formatProjectTypeLabel,
    formatAssetMeta,
    renderAssetModalContent,
    renderWorkflowRail,
    renderExportModal,
    renderBridgeClipModal,
    formatHistoryTimestamp
  }) || null;

  phase3AuthViewHelpers = window.EditorUiModules?.createAuthViewHelpers?.({
    state,
    appName,
    escapeHtml
  }) || null;

  phase3UiEventHelpers = window.EditorUiModules?.createEventHelpers?.({
    state,
    localStorage,
    authStorageKey: AUTH_STORAGE_KEY,
    defaultApiBaseUrl: DEFAULT_API_BASE_URL,
    render,
    renderAuthGate,
    applyAuthSession,
    synchronizeProjectSelectionToStudio,
    fetchPlatformProjects,
    fetchDashboardSummary,
    clearAuthState,
    refreshAuthSession,
    normalizeStudioId
  }) || null;

  phase3UiActionDispatchHelpers = window.EditorUiModules?.createActionDispatchHelpers?.({
    state,
    playbackView,
    editorShell: window.editorShell,
    render,
    setNotice,
    autosaveProjects,
    getProject,
    getWorkflowStage,
    timelineHasContent,
    availableGeneratedClipCount,
    buildRoughCutFromGeneratedClips,
    getVideoClipCompletion,
    setProjectStage,
    getSelectedSceneSegment,
    generateShotsForScene,
    getBoardCardsByCategory,
    bindSceneSegmentToScriptScene,
    applySceneInspectorDraft,
    getSceneContext,
    routeSceneShotsToVideoClips,
    buildEntireSceneShotPlan,
    buildSceneCoverageSuggestions,
    getSelectedTimelineItem,
    buildNextShotFromClip,
    buildCutawayFromClip,
    buildExtensionFromClip,
    ensureVideoClipSceneForScriptScene,
    getSelectedAsset,
    savePlatformIdeaBoard,
    ensurePlatformBackedProject,
    getPromotionTargetLabel,
    runIdeaBoardItemAction,
    refreshPlatformIdeaBoard,
    getNextStage,
    shouldRequirePromotionBeforeScript,
    getPreviousStage,
    getStudioScopedProjects,
    projectBelongsToCurrentStudio,
    resetSelectionForProject,
    pausePlayback,
    syncCurrentProjectTimecode,
    importPlatformProject,
    clearAuthState,
    fetchPlatformProjects,
    createNewProjectDocument,
    snapshotProjectFile,
    formatProjectTypeLabel,
    assetViewMeta,
    studioViewMeta,
    selectStudioContext,
    normalizeProjectFormat,
    createSeriesSeason,
    createSeriesEpisode,
    openSeriesEpisodeTarget,
    importAssetsIntoProject,
    addSelectedAssetToTimeline,
    addIdeaCard,
    removeIdeaCard,
    addScriptScene,
    removeScriptScene,
    addScriptClip,
    removeScriptClip,
    ensureVideoClipsDraft,
    recomputeVideoClipSceneAggregate,
    generateVideoClipForScene,
    refreshVideoClipForScene,
    sendGeneratedClipToEdit,
    approveGeneratedVideoClip,
    ensureStartingImagesDraft,
    generateStartingImageForScene,
    refreshStartingImageForScene,
    addStartingImageVariation,
    approveStartingImageVariation,
    removeStartingImageVariation,
    startPlayback,
    stopPlayback,
    stepPlayback,
    adjustTimelineZoom,
    addTimelineMarker,
    moveSelectedClipInTrack,
    moveSelectedClipAcrossTracks,
    splitSelectedTimelineItem,
    duplicateSelectedTimelineItem,
    removeSelectedTimelineItem,
    formatTimecode,
    getActiveSegment,
    syncPreviewSelectionView,
    togglePreviewFullscreen,
    createExportSettings,
    openBridgeClipModal,
    closeBridgeClipModal,
    createBridgeClip,
    isEditableElementFocused,
    applyProjectDocument,
    syncApprovedGeneratedClipIntoTimeline
  }) || null;

  phase3UiBindingHelpers = window.EditorUiModules?.createBindingHelpers?.({
    state,
    playbackView,
    editorShell: window.editorShell,
    render,
    setNotice,
    autosaveProjects,
    getProject,
    resetSelectionForProject,
    pausePlayback,
    syncCurrentProjectTimecode,
    connectIdeaCards,
    getSelection,
    getTimelineItemContextById,
    getTimelinePixelsPerSecond,
    trimTimelineItem,
    setPlayheadFromTimelinePosition,
    addAssetToTimelineAtPosition,
    moveTimelineItemToPosition,
    updateSelectedTimelineItem,
    updateSelectedTimelineTransition,
    updateProjectPitch,
    updateScriptField,
    updateScriptScene,
    updateScriptClip,
    updateStartingImageScene,
    updateVideoClipRequest,
    createExportSettings,
    updateIdeaCard,
    updateIdeaCardStructuredField,
    moveIdeaCard,
    syncPreviewSelectionView,
    handleAction: (action, options = {}) => phase3UiActionDispatchHelpers.handleAction(action, options),
    trimStateRef: {
      get current() {
        return timelineTrimState;
      },
      set current(value) {
        timelineTrimState = value;
      }
    },
    ideaDragStateRef: {
      get current() {
        return ideaDragState;
      },
      set current(value) {
        ideaDragState = value;
      }
    }
  }) || null;

  function shouldShowStudioContextGate() {
    return state.auth.status === "authenticated" && (state.auth.studioPickerOpen || (!state.auth.currentStudioId && Array.isArray(state.auth.studios) && state.auth.studios.length > 0));
  }

  async function selectStudioContext(studioId) {
    const studioPayload = studioId === null || studioId === "" ? null : Number(studioId);
    const result = await apiRequest("auth/select-studio", "POST", {
      studio_id: studioPayload
    });
    state.auth.studios = Array.isArray(result?.studios) ? result.studios : state.auth.studios;
    state.auth.currentStudioId = result?.current_studio_id ?? studioPayload;
    state.auth.studioPickerOpen = false;
    resetStateForStudioSwitch(state.auth.currentStudioId);
    persistAuth();
    await Promise.all([fetchPlatformProjects(), fetchDashboardSummary()]);
  }

  function getSelectedAsset(project = getProject()) {
    if (!project || !Array.isArray(project.assets)) {
      return null;
    }

    return project.assets.find((asset) => asset.id === state.selectedAssetId) || null;
  }

  function getSelectedTimelineItem(project = getProject()) {
    if (!project || !project.timeline || !Array.isArray(project.timeline.tracks)) {
      return null;
    }

    for (const track of project.timeline.tracks) {
      const item = track.items.find((entry) => entry.id === state.selectedTimelineItemId);
      if (item) {
        return item;
      }
    }

    return null;
  }

  function getSelectedTimelineItemContext(project = getProject()) {
    if (!project?.timeline?.tracks) {
      return null;
    }

    for (const track of project.timeline.tracks) {
      const itemIndex = track.items.findIndex((entry) => entry.id === state.selectedTimelineItemId);
      if (itemIndex >= 0) {
        return {
          track,
          trackIndex: project.timeline.tracks.indexOf(track),
          item: track.items[itemIndex],
          itemIndex
        };
      }
    }

    return null;
  }

  function getSelectedTransitionState(project = getProject()) {
    const context = getSelectedTimelineItemContext(project);
    if (!context) {
      return null;
    }

    if (!context.track.id.startsWith("video")) {
      return {
        editable: false,
        reason: "Transitions are currently supported on video clips only."
      };
    }

    const nextItem = context.track.items[context.itemIndex + 1] || null;
    if (!nextItem) {
      return {
        editable: false,
        reason: "This clip has no next clip to transition into."
      };
    }

    context.item.transition = normalizeTransition(context.item.transition);

    return {
      editable: true,
      transition: context.item.transition,
      nextItem
    };
  }

  function getTimelineItemContextById(project, itemId) {
    if (!project?.timeline?.tracks) {
      return null;
    }

    for (const track of project.timeline.tracks) {
      const itemIndex = track.items.findIndex((entry) => entry.id === itemId);
      if (itemIndex >= 0) {
        return {
          track,
          trackIndex: project.timeline.tracks.indexOf(track),
          item: track.items[itemIndex],
          itemIndex
        };
      }
    }

    return null;
  }

  function resetSelectionForProject(project) {
    phase3ProjectSelectionHelpers.resetSelectionForProject(project);
  }

  function setNotice(message, tone = "neutral") {
    state.notice = String(message || "");
    state.noticeTone = tone;
  }

  function parseDurationSeconds(value, fallback = 3) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value !== "string") {
      return fallback;
    }

    const trimmed = value.trim();
    const secondsMatch = trimmed.match(/([\d.]+)\s*sec/i);
    if (secondsMatch) {
      return Number(secondsMatch[1]);
    }

    const parts = trimmed.split(":").map((part) => Number(part));
    if (parts.every((part) => Number.isFinite(part))) {
      if (parts.length === 4) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 24;
      }
      if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
      }
      if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
      }
    }

    return fallback;
  }

  function autosaveProjects() {
    try {
      localStorage.setItem(
        AUTOSAVE_KEY,
        JSON.stringify({
          schema_version: 1,
          saved_at: new Date().toISOString(),
          active_project_id: state.selectedProjectId,
          projects,
          project_file_path: state.projectFilePath
        })
      );
    } catch (error) {
      setNotice("Autosave failed", "error");
    }
  }

  function loadAutosave() {
    if (!phase3ProjectPersistenceHelpers) {
      return false;
    }
    return phase3ProjectPersistenceHelpers.loadAutosave();
  }

  function inferAssetKind(extension) {
    if ([".mp3", ".wav"].includes(extension)) {
      return "audio";
    }
    if ([".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
      return "image";
    }
    return "video";
  }

  function formatAssetMeta(asset) {
    return phase3UiRenderHelpers.formatAssetMeta(asset);
  }

  function formatDurationLabel(seconds, fallback = "3.0 sec") {
    return phase3UiRenderHelpers.formatDurationLabel(seconds, fallback);
  }

  function formatHistoryTimestamp(value) {
    return phase3UiRenderHelpers.formatHistoryTimestamp(value);
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function renderAssetThumbnail(asset) {
    return phase3UiRenderHelpers.renderAssetThumbnail(asset);
  }

  function renderPreviewContent(selection, project) {
    return phase3PlaybackHelpers.renderPreviewContent(selection, project);
  }

  function renderAssetModalContent(asset, project) {
    return phase3UiRenderHelpers.renderAssetModalContent(asset, project);
  }

  function renderExportModal(project) {
    return phase3UiModalHelpers.renderExportModal(project);
  }

  function renderBridgeClipModal(project) {
    return phase3UiModalHelpers.renderBridgeClipModal(project);
  }

  function renderAuthGate() {
    app.innerHTML = phase3AuthViewHelpers.renderAuthGateView();
    bindAuthEvents();
  }

  function renderTimelineClipContent(item) {
    return phase3TimelineHelpers.renderTimelineClipContent(item);
  }

  function renderInspectorSelectionSummary(selection) {
    return phase3TimelineHelpers.renderInspectorSelectionSummary(selection);
  }

  function getTimelinePixelsPerSecond(project) {
    return Math.max(12, Number(project?.timeline?.zoom || 28));
  }

  function getTimelineCanvasWidth(project) {
    return Math.max(900, Math.ceil(getProjectDuration(project) * getTimelinePixelsPerSecond(project)));
  }

  function getTrackSegments(project, trackPrefix) {
    const track = project.timeline.tracks.find((entry) => entry.id.startsWith(trackPrefix));
    if (!track) {
      return [];
    }

    let cursor = 0;
    return track.items.map((item) => {
      const duration = getItemDuration(item);
      const segment = {
        item,
        start: cursor,
        end: cursor + duration
      };
      cursor += duration;
      return segment;
    });
  }

  function getItemSegment(project, itemId) {
    for (const track of project?.timeline?.tracks || []) {
      let cursor = 0;
      for (const item of track.items || []) {
        const duration = getItemDuration(item);
        if (item.id === itemId) {
          return { track, item, start: cursor, end: cursor + duration };
        }
        cursor += duration;
      }
    }
    return null;
  }

  function getSceneContext(project, scriptSceneId) {
    return phase3InspectorHelpers.getSceneContext(project, scriptSceneId);
  }

  function getAdjacentSceneContexts(project, scriptSceneId) {
    return phase3InspectorHelpers.getAdjacentSceneContexts(project, scriptSceneId);
  }

  function getSceneCompleteness(context) {
    return phase3InspectorHelpers.getSceneCompleteness(context);
  }

  function getTimelineSceneSegments(project) {
    return phase3InspectorHelpers.getTimelineSceneSegments(project);
  }

  function getSelectedSceneSegment(project) {
    return phase3InspectorHelpers.getSelectedSceneSegment(project);
  }

  function getSceneScriptSceneIdAtSeconds(project, seconds) {
    return phase3InspectorHelpers.getSceneScriptSceneIdAtSeconds(project, seconds);
  }

  function bindSceneSegmentToScriptScene(project, segment, scriptSceneId) {
    return phase3InspectorHelpers.bindSceneSegmentToScriptScene(project, segment, scriptSceneId);
  }

  function renderTimelineSceneTrack(project) {
    return phase3TimelineHelpers.renderTimelineSceneTrack(project);
  }

  function renderTimelineRuler(project) {
    return phase3TimelineHelpers.renderTimelineRuler(project);
  }

  function renderTimelineTracks(project) {
    return phase3TimelineHelpers.renderTimelineTracks(project);
  }

  function formatTimecode(totalSeconds, fps) {
    return phase3TimelineHelpers.formatTimecode(totalSeconds, fps);
  }

  function getProjectDuration(project) {
    const explicitDuration = project.timeline?.duration || 0;
    const computedDuration = project.timeline?.tracks?.reduce((maxDuration, track) => {
      const trackDuration = track.items.reduce((cursor, item) => cursor + getItemDuration(item), 0);
      return Math.max(maxDuration, trackDuration);
    }, 0) || 0;

    return Math.max(explicitDuration, computedDuration, 60);
  }

  function getItemDuration(item) {
    if (!item) {
      return 0;
    }

    if (typeof item.durationSeconds === "number") {
      return item.durationSeconds;
    }

    if (item.sourceOut) {
      return parseDurationSeconds(item.sourceOut, item.kind === "image" || item.kind === "title" ? 3 : 5);
    }

    return item.kind === "image" || item.kind === "title" ? 3 : 5;
  }

  function getTrackSegments(project, trackPrefix) {
    const track = project.timeline.tracks.find((entry) => entry.id.startsWith(trackPrefix));
    if (!track) {
      return [];
    }

    let cursor = 0;
    return track.items.map((item) => {
      const duration = getItemDuration(item);
      const segment = {
        item,
        start: cursor,
        end: cursor + duration
      };
      cursor += duration;
      return segment;
    });
  }

  function getActiveSegment(project, trackPrefix, seconds) {
    return (
      getTrackSegments(project, trackPrefix).find(
        (segment) => seconds >= segment.start && seconds < segment.end
      ) || null
    );
  }

  function syncCurrentProjectTimecode() {
    phase3PlaybackHelpers.syncCurrentProjectTimecode();
  }

  phase3ProjectSelectionHelpers = window.EditorStateModules?.createProjectSelectionHelpers?.({
    state,
    projectsRef: {
      get() {
        return projects;
      },
      set(nextProjects) {
        projects = nextProjects;
      }
    },
    createNewProjectDocument,
    hasStudioScopedSession,
    getStudioScopedProjects,
    normalizeProjectShape,
    ensureStartingImagesDraft,
    ensureVideoClipsDraft,
    syncCurrentProjectTimecode
  }) || null;

  phase3WorkflowStateHelpers = window.EditorStateModules?.createWorkflowStateHelpers?.({
    state,
    normalizeProjectFormat,
    createProjectPitchState,
    createScriptScene,
    createScriptClip,
    createScriptState,
    createStartingImagesState,
    createStartingImageScene,
    createVideoClipsState,
    createVideoClipScene,
    createVideoClipRequest
  }) || null;

  function syncTimelinePlayheads() {
    phase3TimelineHelpers.syncTimelinePlayheads();
  }

  function stopPlaybackTimer() {
    phase3PlaybackHelpers.stopPlaybackTimer();
  }

  phase3ProjectPersistenceHelpers = window.EditorStateModules?.createProjectPersistenceHelpers?.({
    state,
    autosaveKey: AUTOSAVE_KEY,
    hasStudioScopedSession,
    getStudioScopedProjects,
    normalizeProjectFormat,
    normalizeStudioId,
    formatProjectTypeLabel,
    templateProjectDocument,
    normalizeProjectShape,
    resetSelectionForProject,
    syncCurrentProjectTimecode,
    stopPlaybackTimer,
    autosaveProjects,
    setNotice,
    getProject,
    setProjects(nextProjects) {
      projects = nextProjects;
    }
  }) || null;

  function getPreviewSelection(project) {
    return phase3PlaybackHelpers.getPreviewSelection(project, getSelectedTimelineItem, getSelection);
  }

  function renderHiddenAudioContent(project) {
    return phase3PlaybackHelpers.renderHiddenAudioContent(project);
  }

  function syncPlaybackView() {
    phase3PlaybackHelpers.syncPlaybackView();
  }

  function syncPreviewSelectionView() {
    phase3PlaybackHelpers.syncPreviewSelectionView(getSelectedTimelineItem, getSelection);
  }

  function syncTransportButtons() {
    phase3PlaybackHelpers.syncTransportButtons();
  }

  async function togglePreviewFullscreen() {
    const previewShell = document.querySelector("[data-preview-shell]");
    if (!previewShell) {
      throw new Error("Preview monitor is not available.");
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await previewShell.requestFullscreen();
  }

  function updatePlaybackFrame() {
    phase3PlaybackHelpers.updatePlaybackFrame(syncPreviewSelectionView);
  }

  function startPlayback() {
    phase3PlaybackHelpers.startPlayback(syncPreviewSelectionView);
  }

  function pausePlayback() {
    phase3PlaybackHelpers.pausePlayback();
  }

  function stopPlayback() {
    phase3PlaybackHelpers.stopPlayback();
  }

  function stepPlayback() {
    phase3PlaybackHelpers.stepPlayback(syncPreviewSelectionView);
  }

  function snapshotProjectFile() {
    if (!phase3ProjectPersistenceHelpers) {
      throw new Error("Project persistence helpers are not initialized.");
    }
    return phase3ProjectPersistenceHelpers.snapshotProjectFile(projects);
  }

  function applyProjectDocument(document) {
    if (!phase3ProjectPersistenceHelpers) {
      throw new Error("Project persistence helpers are not initialized.");
    }
    return phase3ProjectPersistenceHelpers.applyProjectDocument(document);
  }

  function createNewProjectDocument(projectType = "episode") {
    if (!phase3ProjectPersistenceHelpers) {
      throw new Error("Project persistence helpers are not initialized.");
    }
    return phase3ProjectPersistenceHelpers.createNewProjectDocument(projectType);
  }

  function getSelection(project) {
    return phase3EditorSelectionHelpers.getSelection(project);
  }

  function ensureTrack(project, type) {
    return phase3EditorStateHelpers.ensureTrack(project, type);
  }

  function estimateWidth(asset, project) {
    return phase3EditorStateHelpers.estimateWidth(asset, project);
  }

  function loadImportedAssetMetadata(asset) {
    return phase3EditorStateHelpers.loadImportedAssetMetadata(asset);
  }

  async function importAssetsIntoProject(files) {
    return phase3EditorStateHelpers.importAssetsIntoProject(files);
  }

  function addSelectedAssetToTimeline() {
    phase3EditorStateHelpers.addSelectedAssetToTimeline();
  }

  function createTimelineClipFromAsset(asset, project, scriptSceneId = "", generatedFromSceneClipId = "") {
    return phase3EditorStateHelpers.createTimelineClipFromAsset(asset, project, scriptSceneId, generatedFromSceneClipId);
  }

  function findSceneInsertIndex(track, scriptSceneId) {
    return phase3EditorStateHelpers.findSceneInsertIndex(track, scriptSceneId);
  }

  function recalculateTimelineDuration(project) {
    return phase3EditorStateHelpers.recalculateTimelineDuration(project);
  }

  function appendAssetToTrack(project, asset, track, options = {}) {
    return phase3EditorStateHelpers.appendAssetToTrack(project, asset, track, options);
  }

  function replaceTimelineClipForScene(project, scriptSceneId, asset, generatedFromSceneClipId = "") {
    return phase3EditorStateHelpers.replaceTimelineClipForScene(project, scriptSceneId, asset, generatedFromSceneClipId);
  }

  function syncApprovedGeneratedClipIntoTimeline(project, sceneId, requestId = "") {
    return phase3EditorActionHelpers.syncApprovedGeneratedClipIntoTimeline(project, sceneId, requestId);
  }

  function buildRoughCutFromGeneratedClips(project) {
    return phase3EditorActionHelpers.buildRoughCutFromGeneratedClips(project);
  }

  function sendGeneratedClipToEdit(project, sceneId, requestId, clipId) {
    return phase3EditorActionHelpers.sendGeneratedClipToEdit(project, sceneId, requestId, clipId);
  }

  function timelineHasContent(project) {
    return phase3EditorActionHelpers.timelineHasContent(project);
  }

  function availableGeneratedClipCount(project) {
    return phase3EditorActionHelpers.availableGeneratedClipCount(project);
  }

  function videoClipRequestHasPreferredClip(clipRequest) {
    return phase3EditorActionHelpers.videoClipRequestHasPreferredClip(clipRequest);
  }

  function getVideoClipCompletion(project) {
    return phase3EditorActionHelpers.getVideoClipCompletion(project);
  }

  function buildPlannedShotsForScene(sceneContext) {
    return phase3InspectorHelpers.buildPlannedShotsForScene(sceneContext);
  }

  function buildSceneCoverageSuggestions(sceneContext) {
    return phase3InspectorHelpers.buildSceneCoverageSuggestions(sceneContext);
  }

  function buildEntireSceneShotPlan(sceneContext) {
    return phase3InspectorHelpers.buildEntireSceneShotPlan(sceneContext);
  }

  function ensureVideoClipSceneForScriptScene(project, scriptSceneId) {
    return phase3EditorStateHelpers.ensureVideoClipSceneForScriptScene(project, scriptSceneId);
  }

  function appendPlannedShots(scene, shots = []) {
    return phase3EditorStateHelpers.appendPlannedShots(scene, shots);
  }

  function routeSceneShotsToVideoClips(project, scriptSceneId, shots, noticeLabel) {
    return phase3InspectorHelpers.routeSceneShotsToVideoClips(project, scriptSceneId, shots, noticeLabel);
  }

  function getTimelineNeighbors(project, itemId) {
    return phase3EditorStateHelpers.getTimelineNeighbors(project, itemId);
  }

  function buildNextShotFromClip(project, item) {
    return phase3EditorStateHelpers.buildNextShotFromClip(project, item);
  }

  function buildCutawayFromClip(project, item) {
    return phase3EditorStateHelpers.buildCutawayFromClip(project, item);
  }

  function buildExtensionFromClip(project, item) {
    return phase3EditorStateHelpers.buildExtensionFromClip(project, item);
  }

  function getContinuityWarnings(project, selection) {
    return phase3InspectorHelpers.getContinuityWarnings(project, selection);
  }

  function generateShotsForScene(project, scriptSceneId) {
    return phase3InspectorHelpers.generateShotsForScene(project, scriptSceneId);
  }

  function openBridgeClipModal(trackId, beforeItemId, afterItemId) {
    phase3EditorActionHelpers.openBridgeClipModal(trackId, beforeItemId, afterItemId);
  }

  function closeBridgeClipModal() {
    phase3EditorActionHelpers.closeBridgeClipModal();
  }

  function getBridgeContext(project) {
    return phase3EditorActionHelpers.getBridgeContext(project);
  }

  async function createBridgeClip(project) {
    return phase3EditorActionHelpers.createBridgeClip(project);
  }

  function addAssetToTimelineAtPosition(project, assetId, targetTrackId, dropSeconds = 0) {
    return phase3EditorActionHelpers.addAssetToTimelineAtPosition(project, assetId, targetTrackId, dropSeconds);
  }

  function adjustTimelineZoom(project, direction) {
    phase3EditorActionHelpers.adjustTimelineZoom(project, direction);
  }

  function addTimelineMarker(project) {
    return phase3EditorActionHelpers.addTimelineMarker(project);
  }

  function moveSelectedClipInTrack(project, direction) {
    return phase3EditorActionHelpers.moveSelectedClipInTrack(project, direction);
  }

  function moveSelectedClipAcrossTracks(project, direction) {
    return phase3EditorActionHelpers.moveSelectedClipAcrossTracks(project, direction);
  }

  function moveTimelineItemToPosition(project, itemId, targetTrackId, dropSeconds) {
    return phase3EditorActionHelpers.moveTimelineItemToPosition(project, itemId, targetTrackId, dropSeconds);
  }

  function setPlayheadFromTimelinePosition(project, offsetX) {
    phase3EditorActionHelpers.setPlayheadFromTimelinePosition(project, offsetX);
  }

  function duplicateSelectedTimelineItem(project) {
    return phase3EditorActionHelpers.duplicateSelectedTimelineItem(project);
  }

  function removeSelectedTimelineItem(project) {
    return phase3EditorActionHelpers.removeSelectedTimelineItem(project);
  }

  function splitSelectedTimelineItem(project) {
    return phase3EditorEditingHelpers.splitSelectedTimelineItem(project);
  }

  function updateSelectedTimelineItem(field, value) {
    return phase3EditorEditingHelpers.updateSelectedTimelineItem(field, value);
  }

  function updateSelectedTimelineTransition(field, value) {
    return phase3EditorEditingHelpers.updateSelectedTimelineTransition(field, value);
  }

  function trimTimelineItem(itemId, edge, deltaSeconds, baseDuration, baseSourceIn) {
    return phase3EditorEditingHelpers.trimTimelineItem(itemId, edge, deltaSeconds, baseDuration, baseSourceIn);
  }

  function clipClass(kind) {
    return phase3EditorEditingHelpers.clipClass(kind);
  }

  function assetClass(kind) {
    return phase3EditorEditingHelpers.assetClass(kind);
  }

  function formatInspector(selection) {
    return phase3EditorEditingHelpers.formatInspector(selection);
  }

  function render() {
    stopStartingImagePolling();
    stopVideoClipPolling();

    if (state.auth.status !== "authenticated") {
      renderAuthGate();
      return;
    }

    if (shouldShowStudioContextGate()) {
      renderStudioContextGate();
      bindEvents();
      return;
    }

    if (state.currentView === "dashboard") {
      const projectPathLabel = state.projectFilePath || "Unsaved local session";
      app.innerHTML = phase3AppShellHelpers.renderDashboardApp(projectPathLabel, renderDashboard());
      bindEvents();
      return;
    }
    const project = getProject() || getStudioScopedProjects()[0] || projects[0] || null;
    if (!project) {
      app.innerHTML = phase3AppShellHelpers.renderDashboardApp("Unsaved local session", renderDashboard());
      bindEvents();
      return;
    }

    const projectPathLabel = state.projectFilePath || "Unsaved local session";
    const previewAsset = state.assetPreview.assetId
      ? project.assets?.find((asset) => asset.id === state.assetPreview.assetId) || getSelectedAsset(project)
      : getSelectedAsset(project);

    if (state.currentView.startsWith("studio-") || state.currentView.startsWith("assets-")) {
      const nonEditorContent = state.currentView.startsWith("assets-")
        ? renderAssetManagementView(project)
        : renderStudioView(project);
      app.innerHTML = phase3AppShellHelpers.renderSecondaryViewApp(projectPathLabel, nonEditorContent, previewAsset, project);
      bindEvents();
      return;
    }

    const currentStage = getWorkflowStage(project);
    const previousStage = getPreviousStage(project);
    const nextStage = getNextStage(project);
    let workspaceContent = "";

    if (currentStage.id === "idea_board") {
      workspaceContent = renderIdeaBoardWorkspace(project);
    } else if (currentStage.id === "project_pitch") {
      workspaceContent = renderProjectPitchWorkspace(project);
    } else if (currentStage.id === "script") {
      workspaceContent = renderScriptWorkspace(project);
    } else if (currentStage.id === "starting_images") {
      workspaceContent = renderStartingImagesWorkspace(project);
    } else if (currentStage.id === "video_clips") {
      workspaceContent = renderVideoClipsWorkspace(project);
    } else if (currentStage.id === "edit") {
      const selection = getSelection(project);
      syncSceneInspectorDraft(project, selection);
      const isSceneSelection = selection?.kind === "scene";
      const selectedTimelineItem = getSelectedTimelineItem(project);
      const canEditTimelineItem = Boolean(selectedTimelineItem);
      const inspector = formatInspector(selection);
      const continuityWarnings = getContinuityWarnings(project, selection);
      const transitionState = getSelectedTransitionState(project);
      const previewSelection = getPreviewSelection(project);
      workspaceContent = phase3EditorWorkspaceHelpers.renderEditWorkspace(project, {
        selection,
        inspector,
        sceneInspectorDraft: state.sceneInspectorDraft,
        canEditTimelineItem,
        isSceneSelection,
        continuityWarnings,
        transitionState,
        previewSelection,
        selectedTimelineItem
      });
    } else {
      workspaceContent = renderWorkflowPlaceholder(project, currentStage);
    }

    const saveLabel = project.remoteId ? "Save & Sync Project" : "Save Project";
    const seriesEditingLabel = project.type === "episode" && project.remoteSeriesId
      ? `Editing Episode${project.remoteEpisodeId ? ` #${project.remoteEpisodeId}` : ""} in Series`
      : "";

    app.innerHTML = phase3AppShellHelpers.renderEditorApp(project, {
      saveLabel,
      projectPathLabel,
      seriesEditingLabel,
      currentStage,
      previousStage,
      nextStage,
      workspaceContent,
      previewAsset
    });
    bindEvents();
    syncPreviewSelectionView();
  }

  function bindEvents() {
    phase3UiBindingHelpers.bindDomEvents();
  }

  function handleKeydown(event) {
    phase3UiEventHelpers.handleKeydown(event);
  }

  function isEditableElementFocused() {
    return phase3UiEventHelpers.isEditableElementFocused(document);
  }

  function bindAuthEvents() {
    phase3UiEventHelpers.bindAuthEvents();
  }

  async function initializeAuth() {
    await phase3UiEventHelpers.initializeAuth();
  }

  syncCurrentProjectTimecode();
  if (!loadAutosave()) {
    autosaveProjects();
  }
  document.addEventListener("keydown", handleKeydown);
  window.editorShell?.onExportProgress?.((payload) => {
    state.exportModal.open = true;
    state.exportModal.inProgress = true;
    state.exportModal.progress = Number(payload?.progress || 0);
    state.exportModal.stage = payload?.stage || "Exporting";
    render();
  });
  renderAuthGate();
  initializeAuth().then(() => {
    syncPlaybackView();
  });
}

