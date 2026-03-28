(function attachEditorEventModules(globalScope) {
  const modules = globalScope.EditorUiModules || (globalScope.EditorUiModules = {});

  modules.createEventHelpers = function createEventHelpers(deps) {
    const {
      state,
      localStorage,
      authStorageKey,
      defaultApiBaseUrl,
      render,
      renderAuthGate,
      applyAuthSession,
      synchronizeProjectSelectionToStudio,
      fetchPlatformProjects,
      fetchDashboardSummary,
      clearAuthState,
      refreshAuthSession,
      normalizeStudioId
    } = deps;

    function handleKeydown(event) {
      if (event.key === "Escape" && state.exportModal.open && !state.exportModal.inProgress) {
        state.exportModal.open = false;
        state.exportModal.progress = 0;
        state.exportModal.stage = "";
        render();
        return;
      }

      if (event.key === "Escape" && state.ideaContextMenu.open) {
        state.ideaContextMenu.open = false;
        render();
        return;
      }

      if (event.key === "Escape" && state.linkingIdeaCardId) {
        state.linkingIdeaCardId = "";
        state.notice = "Node connection cancelled";
        state.noticeTone = "neutral";
        render();
        return;
      }

      if (event.key === "Escape" && state.previewAssetId) {
        state.previewAssetId = "";
        render();
      }
    }

    function isEditableElementFocused(documentRef = document) {
      const active = documentRef.activeElement;
      if (!active) {
        return false;
      }

      const tagName = String(active.tagName || "").toLowerCase();
      return (
        active.isContentEditable
        || tagName === "input"
        || tagName === "textarea"
        || tagName === "select"
      );
    }

    function bindAuthEvents() {
      const form = document.querySelector("[data-form='login']");
      if (!form) {
        return;
      }

      const usernameInput = form.querySelector("[name='username']");
      const baseUrlInput = form.querySelector("[name='base_url']");

      usernameInput?.addEventListener("input", () => {
        state.auth.usernameDraft = usernameInput.value;
      });

      baseUrlInput?.addEventListener("input", () => {
        state.auth.baseUrl = baseUrlInput.value;
      });

      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const formData = new FormData(form);
        const username = String(formData.get("username") || state.auth.usernameDraft || "").trim();
        const password = String(formData.get("password") || "");
        const baseUrl = String(formData.get("base_url") || "").trim().replace(/\/+$/, "");

        state.auth.usernameDraft = username;
        state.auth.baseUrl = baseUrl || defaultApiBaseUrl;
        state.auth.loading = true;
        state.auth.error = "";
        renderAuthGate();

        try {
          const result = await globalScope.editorShell.apiLogin({
            baseUrl: state.auth.baseUrl,
            username,
            password
          });
          applyAuthSession(result);
          if (state.auth.currentStudioId !== null || !state.auth.studios.length) {
            synchronizeProjectSelectionToStudio(state.auth.currentStudioId);
            await Promise.all([fetchPlatformProjects(), fetchDashboardSummary()]);
          } else {
            state.auth.studioPickerOpen = true;
          }
          render();
        } catch (error) {
          state.auth.loading = false;
          state.auth.status = "guest";
          state.auth.error = error.message || "Login failed.";
          renderAuthGate();
        }
      });
    }

    async function initializeAuth() {
      const raw = localStorage.getItem(authStorageKey);
      if (!raw) {
        state.auth.status = "guest";
        render();
        return;
      }

      try {
        const saved = JSON.parse(raw);
        state.auth.baseUrl = saved.baseUrl || defaultApiBaseUrl;
        state.auth.usernameDraft = saved.usernameDraft || saved.user?.username || "";
        state.auth.token = saved.token || "";
        state.auth.user = saved.user || null;
        state.auth.studios = Array.isArray(saved.studios) ? saved.studios : [];
        state.auth.currentStudioId = normalizeStudioId(saved.currentStudioId);
        if (!state.auth.token) {
          throw new Error("Missing saved session token.");
        }

        await refreshAuthSession();
        if (state.auth.currentStudioId !== null || !state.auth.studios.length) {
          synchronizeProjectSelectionToStudio(state.auth.currentStudioId);
          await Promise.all([fetchPlatformProjects(), fetchDashboardSummary()]);
        } else {
          state.auth.studioPickerOpen = true;
        }
      } catch (error) {
        clearAuthState();
      }

      render();
    }

    return {
      handleKeydown,
      isEditableElementFocused,
      bindAuthEvents,
      initializeAuth
    };
  };
})(window);
