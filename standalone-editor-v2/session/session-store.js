(function attachV2SessionStore(globalScope) {
  function createInitialSession(startupContext) {
    return {
      appName: startupContext?.appName || "SocialArena Creator App V2",
      apiBaseUrl: startupContext?.apiBaseUrl || "http://localhost/adventure/api/v1",
      studioId: "",
      requestedStudioId: String(startupContext?.studioId || ""),
      startedAt: startupContext?.startedAt || new Date().toISOString(),
      status: "auth_required",
      user: null,
      token: "",
      studios: [],
      error: ""
    };
  }

  function setAuthenticatedSession(store, payload = {}) {
    const studios = Array.isArray(payload.studios) ? payload.studios : [];
    const requestedStudioId = String(store.getState().session.requestedStudioId || "");
    const payloadStudioId = String(payload.current_studio_id || payload.currentStudioId || "");
    const resolvedStudioId = payloadStudioId || requestedStudioId;
    const hasResolvedStudio = studios.some((studio) => String(studio.id) === String(resolvedStudioId));

    store.setState((state) => ({
      ...state,
      session: {
        ...state.session,
        user: payload.user || null,
        token: payload.token || payload.session_token || state.session.token || "",
        studios,
        studioId: hasResolvedStudio ? resolvedStudioId : "",
        status: hasResolvedStudio ? "studio_ready" : "studio_selection_required",
        error: ""
      }
    }));
  }

  function setStudioContext(store, studioId) {
    store.setState((state) => ({
      ...state,
      session: {
        ...state.session,
        studioId: String(studioId || ""),
        status: studioId ? "studio_ready" : "studio_selection_required",
        error: ""
      }
    }));
  }

  function applyStudioSelection(store, payload = {}) {
    const studios = Array.isArray(payload.studios) ? payload.studios : store.getState().session.studios;
    const resolvedStudioId = String(payload.current_studio_id || payload.currentStudioId || "");
    const hasResolvedStudio = studios.some((studio) => String(studio.id) === resolvedStudioId);

    store.setState((state) => ({
      ...state,
      session: {
        ...state.session,
        studios,
        studioId: hasResolvedStudio ? resolvedStudioId : "",
        status: hasResolvedStudio ? "studio_ready" : "studio_selection_required",
        error: ""
      }
    }));
  }

  function setSessionError(store, message) {
    store.setState((state) => ({
      ...state,
      session: {
        ...state.session,
        error: String(message || "Unknown session error")
      }
    }));
  }

  globalScope.CreatorAppV2Session = {
    createInitialSession,
    setAuthenticatedSession,
    setStudioContext,
    applyStudioSelection,
    setSessionError
  };
})(window);
