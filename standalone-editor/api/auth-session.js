(function attachEditorAuthSessionModules(globalScope) {
  function createAuthSessionHelpers(deps) {
    const {
      state,
      authStorageKey,
      normalizeStudioId
    } = deps;

    function authStoragePayload() {
      return JSON.stringify({
        token: state.auth.token,
        user: state.auth.user,
        studios: state.auth.studios,
        currentStudioId: state.auth.currentStudioId,
        baseUrl: state.auth.baseUrl,
        usernameDraft: state.auth.usernameDraft
      });
    }

    function applyAuthSession(payload) {
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
      localStorage.setItem(authStorageKey, authStoragePayload());
    }

    function clearAuthState() {
      state.auth.token = "";
      state.auth.user = null;
      state.auth.studios = [];
      state.auth.currentStudioId = null;
      state.auth.studioPickerOpen = false;
      state.auth.status = "guest";
      state.auth.error = "";
      state.auth.loading = false;
      localStorage.removeItem(authStorageKey);
    }

    return {
      authStorageKey,
      authStoragePayload,
      applyAuthSession,
      clearAuthState
    };
  }

  globalScope.EditorAuthSessionModules = {
    createAuthSessionHelpers
  };
})(window);
