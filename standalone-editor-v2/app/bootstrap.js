(async function bootstrapCreatorAppV2() {
  const startupContext = await window.creatorAppV2.getStartupContext();
  const apiClient = window.CreatorAppV2Api.createApiClient(startupContext);

  const initialState = {
    session: window.CreatorAppV2Session.createInitialSession(startupContext),
    ui: {
      currentView: "dashboard"
    },
    workspace: window.CreatorAppV2WorkspaceState.createInitialWorkspaceState(),
    projectWorkspace: window.CreatorAppV2ProjectWorkspace.createInitialProjectWorkspace(),
    workflow: window.CreatorAppV2Workflow.createInitialWorkflowState(),
    endpoints: {
      auth: window.CreatorAppV2Api.createAuthEndpoints(apiClient),
      projects: window.CreatorAppV2Api.createProjectEndpoints(apiClient),
      startingImages: window.CreatorAppV2Api.createStartingImageEndpoints(apiClient),
      videoClips: window.CreatorAppV2Api.createVideoClipEndpoints(apiClient),
      exports: window.CreatorAppV2Api.createExportEndpoints(apiClient)
    }
  };

  const store = window.CreatorAppV2State.createStore(initialState);
  const appElement = document.getElementById("app");

  function render() {
    appElement.innerHTML = window.CreatorAppV2AppShell.renderShell(store.getState());
  }

  store.subscribe(render);
  window.CreatorAppV2AppLifecycle.bindLifecycle(appElement, store);

  if (initialState.session.status === "studio_ready") {
    window.CreatorAppV2WorkspaceController.hydrateWorkspace(store);
  }

  render();
})();
