(function attachEditorPlatformProjectModules(globalScope) {
  function createPlatformProjectHelpers(deps) {
    const {
      state,
      projectsRef,
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
    } = deps;

    async function fetchDashboardSummary() {
      state.dashboard.loading = true;
      state.dashboard.error = "";
      try {
        const result = await apiRequest("editor/dashboard");
        state.dashboard.data = result?.dashboard || null;
      } catch (error) {
        state.dashboard.data = null;
        state.dashboard.error = error.message || "Failed to load dashboard.";
      } finally {
        state.dashboard.loading = false;
      }
    }

    async function fetchPlatformProjects() {
      state.platform.loading = true;
      state.platform.error = "";
      try {
        const result = await apiRequest("editor/projects");
        state.platform.projects = Array.isArray(result.projects) ? result.projects : [];
      } catch (error) {
        state.platform.error = error.message || "Failed to load platform projects.";
      } finally {
        state.platform.loading = false;
      }
    }

    async function importPlatformProject(projectSummary) {
      const [projectPayload, assetsPayload, timelinePayload, ideaBoardPayload] = await Promise.all([
        apiRequest(`editor/projects/${projectSummary.type}/${projectSummary.id}`),
        apiRequest(`editor/projects/${projectSummary.type}/${projectSummary.id}/assets`),
        apiRequest(`editor/projects/${projectSummary.type}/${projectSummary.id}/timeline`),
        apiRequest(`editor/projects/${projectSummary.type}/${projectSummary.id}/idea-board`)
      ]);

      const remoteAssets = Array.isArray(assetsPayload?.assets) ? assetsPayload.assets : [];
      const projectDetail = projectPayload?.project || projectSummary;
      const localProject = normalizePlatformProject({
        ...projectSummary,
        ...projectDetail,
        clip_count: projectSummary.clip_count ?? projectDetail.asset_count ?? projectDetail.clip_count ?? 0
      });
      const normalizedBoard = normalizePlatformIdeaBoard(ideaBoardPayload?.idea_board || null);
      localProject.assets = remoteAssets.map((asset) => normalizePlatformAsset(asset));
      localProject.clipCount = localProject.assets.length;
      localProject.timeline = normalizePlatformTimeline(timelinePayload?.timeline_project, remoteAssets);
      localProject.ideaBoard = normalizedBoard.board;
      localProject.ideaBoardMeta = normalizedBoard.meta;
      localProject.fps = localProject.timeline.fps || localProject.fps;
      localProject.previewLabel = `${localProject.fps} fps Sync`;
      localProject.selectedLabel = localProject.assets.length ? "Asset Selected" : "No Selection";

      const projects = projectsRef.get();
      const existingIndex = projects.findIndex((project) => project.id === localProject.id);
      if (existingIndex >= 0) {
        projects[existingIndex] = localProject;
      } else {
        projects.unshift(localProject);
      }

      state.selectedProjectId = localProject.id;
      resetSelectionForProject(localProject);
      state.currentSeconds = 0;
      syncCurrentProjectTimecode();
      state.platform.modalOpen = false;
      setNotice(`Imported ${localProject.name} from SocialArena`, "success");
      autosaveProjects();
    }

    async function ensurePlatformBackedProject(project) {
      if (project?.remoteType && project?.remoteId) {
        return project;
      }

      const pitch = createProjectPitchState(project?.projectPitch || {});
      const created = await apiRequest("editor/projects", "POST", {
        title: project?.name || "Untitled SocialArena Project",
        description: pitch.concept || "",
        project_type: ["film", "series", "episode"].includes(project?.type) ? project.type : "episode",
        story_description: pitch.logline || pitch.concept || "",
        genre: "Fantasy",
        setting: "Undisclosed Setting",
        visibility: "private"
      });

      const remoteProject = created?.project;
      if (!remoteProject?.id || !remoteProject?.type) {
        throw new Error("Platform backing project could not be created.");
      }

      project.remoteSeriesId = remoteProject.series_id != null ? Number(remoteProject.series_id) : null;
      project.remoteSeasonId = remoteProject.season_id != null ? Number(remoteProject.season_id) : null;
      project.remoteEpisodeId = remoteProject.episode_id != null ? Number(remoteProject.episode_id) : null;
      project.entryProjectId = remoteProject.entry_project_id != null ? Number(remoteProject.entry_project_id) : null;
      project.studioId = normalizeStudioId(project.studioId ?? state.auth.currentStudioId);
      project.remoteStudioId = normalizeStudioId(project.remoteStudioId ?? state.auth.currentStudioId);
      if (remoteProject.type === "series" && remoteProject.entry_project_id) {
        project.remoteType = "episode";
        project.remoteId = Number(remoteProject.entry_project_id);
      } else {
        project.remoteType = remoteProject.type;
        project.remoteId = Number(remoteProject.id);
      }
      project.status = remoteProject.status || "Platform";
      project.syncLabel = "Linked to SocialArena";
      project.clipCount = Number(remoteProject.clip_count || project.clipCount || 0);
      project.selectedLabel = project.selectedLabel || "No Selection";

      state.platform.projects = Array.isArray(state.platform.projects) ? state.platform.projects : [];
      const exists = state.platform.projects.some((entry) => entry.type === remoteProject.type && Number(entry.id) === Number(remoteProject.id));
      if (!exists) {
        state.platform.projects.unshift(remoteProject);
      }

      if (project.ideaBoard?.cards?.length) {
        try {
          await savePlatformIdeaBoard(project);
        } catch (error) {
          setNotice("Platform project created, but Idea Board sync failed", "error");
        }
      }

      return project;
    }

    return {
      fetchDashboardSummary,
      fetchPlatformProjects,
      importPlatformProject,
      ensurePlatformBackedProject
    };
  }

  globalScope.EditorApiModules = globalScope.EditorApiModules || {};
  globalScope.EditorApiModules.createPlatformProjectHelpers = createPlatformProjectHelpers;
})(window);
