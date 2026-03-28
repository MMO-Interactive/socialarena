(function attachEditorProjectPersistenceModules(globalScope) {
  function createProjectPersistenceHelpers(deps) {
    const {
      state,
      autosaveKey,
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
      setProjects
    } = deps;

    function snapshotProjectFile(projectsCollection) {
      const scopedProjects = hasStudioScopedSession() ? getStudioScopedProjects(projectsCollection) : projectsCollection;
      const activeProjectId = scopedProjects.some((project) => project.id === state.selectedProjectId)
        ? state.selectedProjectId
        : scopedProjects[0]?.id || "";
      return JSON.stringify(
        {
          schema_version: 1,
          saved_at: new Date().toISOString(),
          active_project_id: activeProjectId,
          projects: scopedProjects
        },
        null,
        2
      );
    }

    function applyProjectDocumentInternal(document) {
      if (!document || !Array.isArray(document.projects) || document.projects.length === 0) {
        throw new Error("Project file does not contain any projects.");
      }

      const normalizedProjects = document.projects.map((project) => normalizeProjectShape(project));
      setProjects(normalizedProjects);
      const scopedProjects = getStudioScopedProjects(normalizedProjects);
      const requestedProjectId = document.active_project_id || document.projects[0].id;
      state.selectedProjectId = scopedProjects.some((project) => project.id === requestedProjectId)
        ? requestedProjectId
        : scopedProjects[0]?.id || requestedProjectId;
      const project = getProject() || scopedProjects[0] || null;
      resetSelectionForProject(project);
      state.currentSeconds = 0;
      syncCurrentProjectTimecode();
      state.playing = false;
      stopPlaybackTimer();
      autosaveProjects();
      return {
        visibleProjectCount: scopedProjects.length,
        activeProjectId: state.selectedProjectId
      };
    }

    function createNewProjectDocument(projectType = "episode") {
      const document = structuredClone(templateProjectDocument);
      const project = document.projects[0];
      const stamp = Date.now();
      const normalizedType = normalizeProjectFormat(projectType, "episode");
      const typeLabel = formatProjectTypeLabel(normalizedType);
      project.id = `project-${stamp}`;
      project.type = normalizedType;
      project.name = `Untitled SocialArena ${typeLabel}`;
      project.studioId = normalizeStudioId(state.auth.currentStudioId);
      if (project.projectPitch) {
        project.projectPitch.format = normalizedType;
      }
      document.active_project_id = project.id;
      document.saved_at = new Date().toISOString();
      return document;
    }

    function loadAutosave() {
      try {
        const raw = localStorage.getItem(autosaveKey);
        if (!raw) {
          return false;
        }

        const document = JSON.parse(raw);
        const applied = applyProjectDocumentInternal(document);
        state.projectFilePath = document.project_file_path || "";
        if (applied?.visibleProjectCount) {
          setNotice("Recovered autosaved session", "success");
        } else {
          setNotice("Recovered autosave, but no projects matched the current studio.", "neutral");
        }
        return true;
      } catch (error) {
        setNotice("Autosave recovery failed", "error");
        return false;
      }
    }

    return {
      snapshotProjectFile,
      applyProjectDocument: applyProjectDocumentInternal,
      createNewProjectDocument,
      loadAutosave
    };
  }

  globalScope.EditorStateModules = globalScope.EditorStateModules || {};
  globalScope.EditorStateModules.createProjectPersistenceHelpers = createProjectPersistenceHelpers;
})(window);
