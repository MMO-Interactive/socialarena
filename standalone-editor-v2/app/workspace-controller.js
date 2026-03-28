(function attachV2WorkspaceController(globalScope) {
  function appendStudioId(path, studioId) {
    const normalizedPath = String(path || "");
    const normalizedStudioId = String(studioId || "").trim();
    if (!normalizedStudioId) {
      return normalizedPath;
    }

    const separator = normalizedPath.includes("?") ? "&" : "?";
    return `${normalizedPath}${separator}studio_id=${encodeURIComponent(normalizedStudioId)}`;
  }

  async function loadDashboard(store) {
    const state = store.getState();
    const { session, endpoints } = state;

    if (session.status !== "studio_ready" || !session.token || !session.studioId) {
      globalScope.CreatorAppV2WorkspaceState.clearWorkspace(store);
      return null;
    }

    globalScope.CreatorAppV2WorkspaceState.setDashboardLoading(store, true);
    try {
      const payload = await endpoints.projects.getDashboard(session.token, session.studioId);
      globalScope.CreatorAppV2WorkspaceState.setDashboardData(store, payload?.dashboard || null);
      return payload?.dashboard || null;
    } catch (error) {
      globalScope.CreatorAppV2WorkspaceState.setDashboardError(store, error.message || "Failed to load dashboard.");
      return null;
    }
  }

  async function loadProjects(store) {
    const state = store.getState();
    const { session, endpoints } = state;

    if (session.status !== "studio_ready" || !session.token || !session.studioId) {
      globalScope.CreatorAppV2WorkspaceState.clearWorkspace(store);
      return [];
    }

    globalScope.CreatorAppV2WorkspaceState.setProjectsLoading(store, true);
    try {
      const payload = await endpoints.projects.listProjects(session.token, session.studioId);
      const items = Array.isArray(payload?.projects) ? payload.projects : [];
      globalScope.CreatorAppV2WorkspaceState.setProjectsData(store, items);
      return items;
    } catch (error) {
      globalScope.CreatorAppV2WorkspaceState.setProjectsError(store, error.message || "Failed to load projects.");
      return [];
    }
  }

  async function hydrateWorkspace(store) {
    const state = store.getState();
    if (state.session.status !== "studio_ready") {
      globalScope.CreatorAppV2WorkspaceState.clearWorkspace(store);
      return;
    }

    await Promise.all([
      loadDashboard(store),
      loadProjects(store)
    ]);
  }

  globalScope.CreatorAppV2WorkspaceController = {
    appendStudioId,
    loadDashboard,
    loadProjects,
    hydrateWorkspace
  };
})(window);
