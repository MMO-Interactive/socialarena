(function attachEditorAuthViewModules(globalScope) {
  const modules = globalScope.EditorUiModules || (globalScope.EditorUiModules = {});

  modules.createAuthViewHelpers = function createAuthViewHelpers(deps) {
    const { state, appName, escapeHtml } = deps;

    function renderAuthGateView() {
      const loading = state.auth.loading || state.auth.status === "checking";
      const buttonLabel = loading ? "Signing In..." : "Sign In";
      const helperText =
        state.auth.status === "checking"
          ? "Checking saved session..."
          : "Sign in with your SocialArena account to use the editor.";

      return `
        <div class="auth-shell">
          <section class="auth-card">
            <div class="eyebrow">Standalone Editor V1</div>
            <h1>${appName}</h1>
            <p class="auth-copy">${helperText}</p>
            <form class="auth-form" data-form="login">
              <label class="auth-field">
                <span>API Base URL</span>
                <input type="text" name="base_url" value="${escapeHtml(state.auth.baseUrl)}" />
              </label>
              <label class="auth-field">
                <span>Username</span>
                <input type="text" name="username" autocomplete="username" value="${escapeHtml(state.auth.usernameDraft || "")}" required />
              </label>
              <label class="auth-field">
                <span>Password</span>
                <input type="password" name="password" autocomplete="current-password" required />
              </label>
              ${state.auth.error ? `<div class="auth-error">${escapeHtml(state.auth.error)}</div>` : ""}
              <button class="accent-button auth-submit" type="submit" ${loading ? "disabled" : ""}>${buttonLabel}</button>
            </form>
          </section>
        </div>
      `;
    }

    return {
      renderAuthGateView
    };
  };
})(window);
