(function attachEditorStudioPickerModules(globalScope) {
  function createStudioPickerHelpers(deps) {
    const {
      state,
      app,
      escapeHtml
    } = deps;

    function renderStudioContextGate() {
      const studios = Array.isArray(state.auth.studios) ? state.auth.studios : [];
      const currentStudioId = state.auth.currentStudioId;

      app.innerHTML = `
        <div class="auth-shell">
          <section class="auth-card studio-context-card">
            <div class="eyebrow">Studio Context</div>
            <h1>Select Studio</h1>
            <p class="auth-copy">Choose the studio context for this editor session. All projects, assets, and permissions will be scoped to that studio.</p>
            <div class="studio-context-list">
              ${
                studios.length
                  ? studios.map((studio) => `
                    <button class="studio-context-option${Number(currentStudioId) === Number(studio.id) ? " active" : ""}" type="button" data-action="select-studio-context" data-studio-id="${studio.id}">
                      <strong>${escapeHtml(studio.name)}</strong>
                      <span>${escapeHtml(studio.role || "Member")}</span>
                    </button>
                  `).join("")
                  : `
                    <button class="studio-context-option${currentStudioId === null ? " active" : ""}" type="button" data-action="select-studio-context" data-studio-id="">
                      <strong>Personal Workspace</strong>
                      <span>Use the standalone editor without a connected team studio.</span>
                    </button>
                  `
              }
            </div>
          </section>
        </div>
      `;
    }

    return {
      renderStudioContextGate
    };
  }

  globalScope.EditorStudioModules = globalScope.EditorStudioModules || {};
  globalScope.EditorStudioModules.createStudioPickerHelpers = createStudioPickerHelpers;
})(window);
