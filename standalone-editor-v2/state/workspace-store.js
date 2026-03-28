(function attachV2WorkspaceStore(globalScope) {
  function createInitialWorkspaceState() {
    return {
      dashboard: {
        loading: false,
        error: "",
        data: null
      },
      projects: {
        loading: false,
        error: "",
        items: []
      }
    };
  }

  function setDashboardLoading(store, loading) {
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        dashboard: {
          ...state.workspace.dashboard,
          loading,
          error: loading ? "" : state.workspace.dashboard.error
        }
      }
    }));
  }

  function setDashboardData(store, data) {
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        dashboard: {
          loading: false,
          error: "",
          data: data || null
        }
      }
    }));
  }

  function setDashboardError(store, message) {
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        dashboard: {
          ...state.workspace.dashboard,
          loading: false,
          error: String(message || "Failed to load dashboard data.")
        }
      }
    }));
  }

  function setProjectsLoading(store, loading) {
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        projects: {
          ...state.workspace.projects,
          loading,
          error: loading ? "" : state.workspace.projects.error
        }
      }
    }));
  }

  function setProjectsData(store, items) {
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        projects: {
          loading: false,
          error: "",
          items: Array.isArray(items) ? items : []
        }
      }
    }));
  }

  function setProjectsError(store, message) {
    store.setState((state) => ({
      ...state,
      workspace: {
        ...state.workspace,
        projects: {
          ...state.workspace.projects,
          loading: false,
          error: String(message || "Failed to load projects.")
        }
      }
    }));
  }

  function clearWorkspace(store) {
    store.setState((state) => ({
      ...state,
      workspace: createInitialWorkspaceState()
    }));
  }

  globalScope.CreatorAppV2WorkspaceState = {
    createInitialWorkspaceState,
    setDashboardLoading,
    setDashboardData,
    setDashboardError,
    setProjectsLoading,
    setProjectsData,
    setProjectsError,
    clearWorkspace
  };
})(window);
