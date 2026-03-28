(function attachEditorApiModules(globalScope) {
  function createClient(deps) {
    const {
      state,
      clearAuthState,
      renderAuthGate,
      refreshAuthSession,
      isStudioScopeError,
      handleStudioScopeError
    } = deps;

    async function apiRequest(path, method = "GET", body, options = {}) {
      const requestPath = String(path || "");
      const isAuthRoute = requestPath.startsWith("auth/");
      const currentStudioId = state.auth.currentStudioId;
      let finalPath = requestPath;
      let finalBody = body;

      if (!isAuthRoute && currentStudioId !== null && currentStudioId !== undefined && currentStudioId !== "") {
        if (String(method || "GET").toUpperCase() === "GET") {
          finalPath += (finalPath.includes("?") ? "&" : "?") + `studio_id=${encodeURIComponent(currentStudioId)}`;
        } else if (body && typeof body === "object" && !Array.isArray(body) && !("studio_id" in body)) {
          finalBody = {
            ...body,
            studio_id: currentStudioId
          };
        }
      }

      try {
        return await globalScope.editorShell.apiRequest({
          baseUrl: state.auth.baseUrl,
          token: state.auth.token,
          path: finalPath,
          method,
          body: finalBody
        });
      } catch (error) {
        if (error?.status === 401 && options.retryAuth !== false && state.auth.token) {
          try {
            await refreshAuthSession();
            return await apiRequest(path, method, body, { retryAuth: false });
          } catch (refreshError) {
            clearAuthState();
            renderAuthGate();
            throw refreshError;
          }
        }

        if (!isAuthRoute && isStudioScopeError(error)) {
          handleStudioScopeError(error);
        }

        throw error;
      }
    }

    return {
      apiRequest
    };
  }

  globalScope.EditorApiModules = {
    createClient
  };
})(window);
