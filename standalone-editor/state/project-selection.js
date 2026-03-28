(function attachEditorProjectSelectionModules(globalScope) {
  function createProjectSelectionHelpers(deps) {
    const {
      state,
      projectsRef,
      createNewProjectDocument,
      hasStudioScopedSession,
      getStudioScopedProjects,
      normalizeProjectShape,
      ensureStartingImagesDraft,
      ensureVideoClipsDraft,
      syncCurrentProjectTimecode
    } = deps;

    function ensureProjectsCollection() {
      const projects = projectsRef.get();
      if (!Array.isArray(projects) || projects.length === 0) {
        const document = createNewProjectDocument();
        projectsRef.set(document.projects);
        state.selectedProjectId = document.active_project_id;
      }
    }

    function getProject() {
      ensureProjectsCollection();
      const projects = projectsRef.get();
      const availableProjects = hasStudioScopedSession()
        ? getStudioScopedProjects(state.auth.currentStudioId)
        : projects.map((project) => normalizeProjectShape(project));
      return normalizeProjectShape(
        availableProjects.find((project) => project.id === state.selectedProjectId) || availableProjects[0] || null
      );
    }

    function resetSelectionForProject(project) {
      if (!project) {
        state.selectedAssetId = "";
        state.selectedSceneSegmentId = "";
        state.selectedTimelineItemId = "";
        state.selectedStartingImageSceneId = "";
        state.selectedVideoClipSceneId = "";
        return;
      }

      state.selectedAssetId = project.assets?.[0]?.id || "";
      state.selectedSceneSegmentId = "";
      state.selectedTimelineItemId = project.timeline?.tracks?.[0]?.items?.[0]?.id || "";
      ensureStartingImagesDraft(project);
      ensureVideoClipsDraft(project);
      state.selectedStartingImageSceneId = project.startingImages?.scenes?.[0]?.id || "";
      state.selectedVideoClipSceneId = project.videoClips?.scenes?.[0]?.id || "";
    }

    function synchronizeProjectSelectionToStudio(nextStudioId = state.auth.currentStudioId) {
      const scopedProjects = getStudioScopedProjects(nextStudioId);
      const selectedProjectStillValid = scopedProjects.some((project) => project.id === state.selectedProjectId);
      state.selectedProjectId = selectedProjectStillValid ? state.selectedProjectId : (scopedProjects[0]?.id || "");
      resetSelectionForProject(
        state.selectedProjectId
          ? scopedProjects.find((project) => project.id === state.selectedProjectId) || null
          : null
      );
      state.currentSeconds = 0;
      syncCurrentProjectTimecode();
    }

    return {
      ensureProjectsCollection,
      getProject,
      resetSelectionForProject,
      synchronizeProjectSelectionToStudio
    };
  }

  globalScope.EditorStateModules = globalScope.EditorStateModules || {};
  globalScope.EditorStateModules.createProjectSelectionHelpers = createProjectSelectionHelpers;
})(window);
