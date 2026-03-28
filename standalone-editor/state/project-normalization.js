(function attachEditorProjectNormalizationModules(globalScope) {
  function createProjectNormalizationHelpers(deps) {
    const {
      state,
      workflowStages,
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
    } = deps;

    function normalizeProjectShape(project) {
      if (!project) {
        return null;
      }

      const validStageIds = new Set(workflowStages.map((stage) => stage.id));
      const currentStage = validStageIds.has(project.workflow?.currentStage)
        ? project.workflow.currentStage
        : Array.isArray(project.assets) && project.assets.length
          ? "edit"
          : "idea_board";
      const completedStages = Array.isArray(project.workflow?.completedStages)
        ? project.workflow.completedStages.filter((stageId) => validStageIds.has(stageId))
        : [];

      const legacyPitch =
        project.projectPitch
          ? project.projectPitch
          : project.ideaBoard && (
              "logline" in project.ideaBoard ||
              "concept" in project.ideaBoard ||
              "audience" in project.ideaBoard ||
              "visualStyle" in project.ideaBoard
            )
            ? project.ideaBoard
            : {};

      project.workflow = {
        currentStage,
        completedStages,
        updatedAt: project.workflow?.updatedAt || new Date().toISOString()
      };
      project.studioId = normalizeStudioId(project.studioId ?? project.studio_id ?? project.remoteStudioId ?? null);
      project.remoteStudioId = normalizeStudioId(project.remoteStudioId ?? project.studioId ?? project.studio_id ?? null);
      project.type = normalizeProjectFormat(project.type || project.projectPitch?.format || legacyPitch.format || "episode");
      project.name = normalizeProjectContainerTitle(project.type, project.name);
      project.ideaBoard = createIdeaBoardState(project.ideaBoard?.cards ? project.ideaBoard : {});
      project.projectPitch = createProjectPitchState({
        ...legacyPitch,
        format: project.projectPitch?.format || legacyPitch.format || project.type || "episode"
      });
      project.seriesOutline = project.seriesOutline && typeof project.seriesOutline === "object"
        ? {
            season_count: Number(project.seriesOutline.season_count || 0),
            episode_count: Number(project.seriesOutline.episode_count || 0),
            seasons: Array.isArray(project.seriesOutline.seasons) ? project.seriesOutline.seasons : []
          }
        : project.type === "series"
          ? { season_count: 0, episode_count: 0, seasons: [] }
          : null;
      project.seasonCount = Number(project.seasonCount || project.seriesOutline?.season_count || 0);
      project.episodeCount = Number(project.episodeCount || project.seriesOutline?.episode_count || 0);
      project.promotedAt = project.promotedAt || null;
      project.script = createScriptState(project.script || {});
      project.startingImages = createStartingImagesState(project.startingImages || {});
      project.videoClips = createVideoClipsState(project.videoClips || {});
      project.assets = Array.isArray(project.assets) ? project.assets : [];
      project.assets = project.assets.map((asset, index) => ({
        id: asset.id || `asset-${index + 1}`,
        name: asset.name || `Asset ${index + 1}`,
        kind: asset.kind || "video",
        meta: asset.meta || "",
        sourceUrl: asset.sourceUrl || asset.url || "",
        sourcePath: asset.sourcePath || "",
        durationSeconds: Number.isFinite(asset.durationSeconds) ? asset.durationSeconds : undefined,
        tags: Array.isArray(asset.tags) ? asset.tags : [],
        reviewStatus: asset.reviewStatus || "pending",
        generated: asset.generated === true,
        sourceType: asset.sourceType || (asset.generated ? "generated" : "imported")
      }));
      project.timeline = project.timeline && Array.isArray(project.timeline.tracks)
        ? project.timeline
        : defaultTimeline(Number(project.fps || 24), 30);
      project.timeline.tracks = Array.isArray(project.timeline.tracks) ? project.timeline.tracks : [];
      project.timeline.tracks.forEach((track) => {
        track.items = Array.isArray(track.items) ? track.items : [];
        track.items.forEach((item) => {
          item.transition = normalizeTransition(item.transition);
        });
      });
      project.timeline.zoom = Number(project.timeline.zoom || 28);
      project.timeline.markers = Array.isArray(project.timeline.markers) ? project.timeline.markers : [];
      return project;
    }

    function hasStudioScopedSession() {
      return state.auth.status === "authenticated" && Array.isArray(state.auth.studios) && state.auth.studios.length > 0;
    }

    function projectBelongsToStudio(project, studioId = state.auth.currentStudioId) {
      if (!project) {
        return false;
      }
      if (!hasStudioScopedSession()) {
        return true;
      }
      const projectStudioId = normalizeStudioId(project.studioId ?? project.studio_id ?? project.remoteStudioId ?? null);
      const effectiveStudioId = normalizeStudioId(studioId);
      if (effectiveStudioId === null) {
        return projectStudioId === null;
      }
      return Number(projectStudioId) === Number(effectiveStudioId);
    }

    function projectBelongsToCurrentStudio(project) {
      return projectBelongsToStudio(project, state.auth.currentStudioId);
    }

    function getStudioScopedProjects(projectsCollection, studioId = state.auth.currentStudioId) {
      const normalizedProjects = (Array.isArray(projectsCollection) ? projectsCollection : [])
        .map((project) => normalizeProjectShape(project));
      if (!hasStudioScopedSession()) {
        return normalizedProjects;
      }
      return normalizedProjects.filter((project) => projectBelongsToStudio(project, studioId));
    }

    return {
      normalizeProjectShape,
      hasStudioScopedSession,
      projectBelongsToStudio,
      projectBelongsToCurrentStudio,
      getStudioScopedProjects
    };
  }

  globalScope.EditorStateModules = globalScope.EditorStateModules || {};
  globalScope.EditorStateModules.createProjectNormalizationHelpers = createProjectNormalizationHelpers;
})(window);
