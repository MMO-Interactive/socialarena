(function attachV2ExportReleaseStageActions(globalScope) {
  function buildDraftFromDom(appElement, fallbackDraft) {
    const currentDraft = globalScope.CreatorAppV2ProjectWorkspace.createExportReleaseDraft(fallbackDraft || {});
    return {
      ...currentDraft,
      title: String(appElement.querySelector("[data-export-field=\"title\"]")?.value || currentDraft.title || "").trim(),
      exportType: String(appElement.querySelector("[data-export-field=\"exportType\"]")?.value || currentDraft.exportType || "draft").trim(),
      resolution: String(appElement.querySelector("[data-export-field=\"resolution\"]")?.value || currentDraft.resolution || "1920x1080").trim(),
      durationSeconds: Math.max(0, Number(currentDraft.durationSeconds || 0)),
      updatedAt: new Date().toISOString()
    };
  }

  function applyDraftFromDom(store, appElement) {
    const nextDraft = buildDraftFromDom(appElement, globalScope.CreatorAppV2ExportReleaseState.getExportReleaseDraft(store));
    globalScope.CreatorAppV2ProjectWorkspace.updateExportReleaseDraft(store, nextDraft);
    store.setState((state) => ({
      ...state,
      workflow: {
        ...state.workflow,
        notice: "Export and release plan applied."
      }
    }));
  }

  async function refreshExports(store) {
    const state = store.getState();
    const activeProject = state.projectWorkspace?.activeProject;
    if (!activeProject?.id || !activeProject?.type) {
      return;
    }

    globalScope.CreatorAppV2ProjectWorkspace.updateExportReleaseDraft(store, (draft) => ({
      ...draft,
      loading: true,
      error: "",
      updatedAt: new Date().toISOString()
    }), { dirty: false });

    try {
      const payload = await state.endpoints.exports.list(
        state.session.token,
        state.session.studioId,
        activeProject.type,
        activeProject.id
      );
      globalScope.CreatorAppV2ProjectWorkspace.updateExportReleaseDraft(store, (draft) => ({
        ...draft,
        exports: Array.isArray(payload?.exports)
          ? payload.exports.map((entry, index) => globalScope.CreatorAppV2ProjectWorkspace.createExportRecord(entry, index))
          : [],
        activeExportId: Number(payload?.exports?.[0]?.id || draft.activeExportId || 0),
        loading: false,
        error: "",
        updatedAt: new Date().toISOString()
      }), { dirty: false });
      store.setState((currentState) => ({
        ...currentState,
        workflow: {
          ...currentState.workflow,
          notice: "Export history refreshed."
        }
      }));
    } catch (error) {
      globalScope.CreatorAppV2ProjectWorkspace.updateExportReleaseDraft(store, (draft) => ({
        ...draft,
        loading: false,
        error: error.message || "Failed to load export history.",
        updatedAt: new Date().toISOString()
      }), { dirty: false });
    }
  }

  async function initExport(store, appElement) {
    const state = store.getState();
    const activeProject = state.projectWorkspace?.activeProject;
    if (!activeProject?.id || !activeProject?.type) {
      return;
    }

    const nextDraft = buildDraftFromDom(appElement, globalScope.CreatorAppV2ExportReleaseState.getExportReleaseDraft(store));
    globalScope.CreatorAppV2ProjectWorkspace.updateExportReleaseDraft(store, {
      ...nextDraft,
      loading: true,
      error: "",
      updatedAt: new Date().toISOString()
    }, { dirty: false });

    try {
      const payload = await state.endpoints.exports.init(state.session.token, state.session.studioId, {
        project_type: activeProject.type,
        project_id: activeProject.id,
        title: nextDraft.title,
        export_type: nextDraft.exportType,
        duration_seconds: nextDraft.durationSeconds,
        resolution: nextDraft.resolution
      });
      globalScope.CreatorAppV2ProjectWorkspace.updateExportReleaseDraft(store, (draft) => ({
        ...draft,
        loading: false,
        error: "",
        activeExportId: Number(payload?.export_id || draft.activeExportId || 0),
        exports: [
          globalScope.CreatorAppV2ProjectWorkspace.createExportRecord({
            id: payload?.export_id,
            title: nextDraft.title,
            export_type: nextDraft.exportType,
            duration_seconds: nextDraft.durationSeconds,
            resolution: nextDraft.resolution,
            status: "initialized",
            storage_path: payload?.storage_path || "",
            created_at: new Date().toISOString()
          }, 0),
          ...draft.exports.filter((entry) => Number(entry.id) !== Number(payload?.export_id || 0))
        ],
        updatedAt: new Date().toISOString()
      }), { dirty: false });
      store.setState((currentState) => ({
        ...currentState,
        workflow: {
          ...currentState.workflow,
          notice: "Export initialized in the V1 API."
        }
      }));
    } catch (error) {
      globalScope.CreatorAppV2ProjectWorkspace.updateExportReleaseDraft(store, (draft) => ({
        ...draft,
        loading: false,
        error: error.message || "Failed to initialize export.",
        updatedAt: new Date().toISOString()
      }), { dirty: false });
    }
  }

  async function completeExport(store, exportId) {
    const state = store.getState();
    if (!exportId) {
      return;
    }

    globalScope.CreatorAppV2ProjectWorkspace.updateExportReleaseDraft(store, (draft) => ({
      ...draft,
      loading: true,
      error: "",
      updatedAt: new Date().toISOString()
    }), { dirty: false });

    try {
      await state.endpoints.exports.complete(
        state.session.token,
        state.session.studioId,
        exportId,
        {
          file_size_bytes: 0,
          thumbnail_url: ""
        }
      );
      globalScope.CreatorAppV2ProjectWorkspace.updateExportReleaseDraft(store, (draft) => ({
        ...draft,
        loading: false,
        error: "",
        exports: draft.exports.map((entry) =>
          Number(entry.id) === Number(exportId)
            ? globalScope.CreatorAppV2ProjectWorkspace.createExportRecord({
                ...entry,
                status: "complete",
                completed_at: new Date().toISOString()
              })
            : entry
        ),
        activeExportId: Number(exportId),
        updatedAt: new Date().toISOString()
      }), { dirty: false });
      store.setState((currentState) => ({
        ...currentState,
        workflow: {
          ...currentState.workflow,
          notice: "Export marked complete."
        }
      }));
    } catch (error) {
      globalScope.CreatorAppV2ProjectWorkspace.updateExportReleaseDraft(store, (draft) => ({
        ...draft,
        loading: false,
        error: error.message || "Failed to complete export.",
        updatedAt: new Date().toISOString()
      }), { dirty: false });
    }
  }

  function selectExport(store, exportId) {
    globalScope.CreatorAppV2ProjectWorkspace.updateExportReleaseDraft(store, (draft) => ({
      ...draft,
      activeExportId: Number(exportId || 0),
      updatedAt: new Date().toISOString()
    }));
  }

  globalScope.CreatorAppV2ExportReleaseActions = {
    applyDraftFromDom,
    refreshExports,
    initExport,
    completeExport,
    selectExport
  };
})(window);
