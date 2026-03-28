(function attachV2AppShell(globalScope) {
  function withIcon(icon, label, iconOnly = false) {
    return iconOnly
      ? `<span class="v2-icon" aria-hidden="true">${icon}</span><span class="v2-visually-hidden">${label}</span>`
      : `<span class="v2-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
  }

  function getCurrentStudioSummary(session) {
    const studios = Array.isArray(session?.studios) ? session.studios : [];
    return studios.find((studio) => String(studio.id) === String(session?.studioId)) || null;
  }

  function renderCompactTopbar(options) {
    const {
      appName,
      eyebrow = "Standalone Editor V2",
      username = "Unknown",
      studioLabel = "No Studio",
      sessionPath = "",
      notice = "",
      actions = []
    } = options;

    return `
      <header class="v2-app-topbar">
        <div class="v2-app-brand">
          <div class="v2-eyebrow">${eyebrow}</div>
          <h1 class="v2-app-title">${appName}</h1>
          <div class="v2-app-auth-row">
            <span class="v2-app-chip">Signed in as ${username}</span>
            <span class="v2-app-chip">Studio: ${studioLabel}</span>
          </div>
        </div>
        <div class="v2-app-session">
          <div class="v2-app-session-path">${sessionPath}</div>
          <div class="v2-app-session-notice">${notice}</div>
        </div>
        <div class="v2-app-actions">
          ${actions.join("")}
        </div>
      </header>
    `;
  }

  function renderWorkflowStageNav(workflow, currentStageId) {
    return `
      <div class="v2-workflow-stage-nav">
        ${workflow.stages.map((stage) => `
          <button class="v2-workflow-stage-pill ${stage.id === currentStageId ? "active" : ""}" type="button" data-stage-id="${stage.id}">
            <span>Step ${stage.stepNumber}</span>
            <strong>${stage.label}</strong>
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderStageRail(workflow, currentStageId, interactive) {
    return `
      <div class="v2-stage-list">
        ${workflow.stages.map((stage) => `
          <${interactive ? "button" : "div"} class="v2-stage-button ${stage.id === currentStageId ? "active" : ""}" ${interactive ? `type="button" data-stage-id="${stage.id}"` : ""}>
            <span class="v2-stage-signal"></span>
            <span class="v2-stage-index">Step ${stage.stepNumber}</span>
            <span class="v2-stage-label">${stage.label}</span>
            <span class="v2-stage-status">${stage.summary}</span>
          </${interactive ? "button" : "div"}>
        `).join("")}
      </div>
    `;
  }

  function renderDashboard(state) {
    const { session, workflow, workspace } = state;
    const studio = getCurrentStudioSummary(session);
    const studioLabel = studio?.name || `Studio ${session.studioId}`;
    const dashboard = workspace?.dashboard || { loading: false, error: "", data: null };
    const projects = workspace?.projects || { loading: false, error: "", items: [] };
    const summary = dashboard.data?.summary || {};
    const studios = Array.isArray(dashboard.data?.studios) ? dashboard.data.studios : [];
    const recentProjects = Array.isArray(dashboard.data?.recent_projects) ? dashboard.data.recent_projects : [];
    const upcomingTasks = Array.isArray(dashboard.data?.upcoming_tasks) ? dashboard.data.upcoming_tasks : [];
    return `
      <div class="v2-shell">
        ${renderCompactTopbar({
          appName: session.appName,
          username: session.user?.username || "Unknown",
          studioLabel,
          sessionPath: "Dashboard",
          notice: workflow.notice,
          actions: [
            `<button class="v2-button-ghost v2-toolbar-button v2-button-has-icon" type="button" data-action="open-workflow">${withIcon("▶", "Workflow")}</button>`,
            `<button class="v2-button-ghost v2-toolbar-button v2-button-has-icon" type="button" data-action="open-studio-selector">${withIcon("◎", "Switch Studio")}</button>`,
            `<button class="v2-button-ghost v2-toolbar-button v2-button-has-icon" type="button" data-action="refresh">${withIcon("↻", "Refresh")}</button>`
          ]
        })}

        <div class="v2-foundation">
          <aside class="v2-panel v2-rail-panel">
            <div class="v2-panel-header">
              <div class="v2-eyebrow">Production Rail</div>
              <h2>Seven-Step Foundation</h2>
            </div>
            <p class="v2-panel-copy">The creator app exists to move work cleanly through the canonical production loop. Every major feature must strengthen this rail first.</p>
            ${renderStageRail(workflow, workflow.currentStageId, false)}
            <div class="v2-rail-note">
              Idea Board, Idea Pitch, Script, Starting Images, Clip Generation, Edit, and Export/Release are the non-negotiable foundation.
            </div>
          </aside>

          <main class="v2-stage-panel v2-stage-panel-dashboard">
            <div class="v2-stage-header v2-stage-header-cinematic">
              <div>
                <div class="v2-eyebrow">Creator Command Deck</div>
                <h2>Next-Gen AI Film Editor</h2>
                <p>The first screen after authentication and studio resolution should feel like entering a future production floor: clear command of the studio, visible control of the AI pipeline, and immediate access to the canonical workflow.</p>
              </div>
              <div class="v2-stage-kicker">
                <span>Dashboard First</span>
                <strong>Workflow unlocked only from command context</strong>
              </div>
            </div>
            <div class="v2-stage-body">
              <div class="v2-card-grid v2-card-grid-dashboard">
                <article class="v2-card v2-feature-card">
                  <div class="v2-card-eyebrow">Active Container</div>
                  <h3>${studioLabel}</h3>
                  <p>The active studio is the session’s top-level domain for projects, assets, AI generation, permissions, and release readiness.</p>
                </article>
                <article class="v2-card v2-feature-card">
                  <div class="v2-card-eyebrow">Creator Focus</div>
                  <h3>Idea-to-Release Loop</h3>
                  <p>Enter the workflow rail and move from story formation into image generation, clip generation, edit, and release without fragmenting the creative process.</p>
                </article>
                <article class="v2-card v2-feature-card">
                  <div class="v2-card-eyebrow">AI Identity</div>
                  <h3>Generation Is Native</h3>
                  <p>AI is not a side tool. It is embedded into the film-making pipeline itself, with scene context, shot planning, generation, edit, and release all connected.</p>
                </article>
                <article class="v2-card v2-feature-card">
                  <div class="v2-card-eyebrow">Platform Boundary</div>
                  <h3>Desktop for Creation</h3>
                  <p>Studio operations, review, analytics, and release management remain on Web. Creation lives here in the creator app.</p>
                </article>
              </div>
              <div class="v2-dashboard-actions">
                <button class="v2-button" type="button" data-action="create-project" data-project-type="film">New Film</button>
                <button class="v2-button-ghost" type="button" data-action="create-project" data-project-type="series">New Series</button>
                <button class="v2-button-ghost" type="button" data-action="create-project" data-project-type="episode">New Episode</button>
              </div>
              <div class="v2-card-grid v2-card-grid-metrics">
                <article class="v2-card v2-metric-card">
                  <div class="v2-card-eyebrow">Studio Projects</div>
                  <h3>${summary.project_count ?? projects.items.length ?? 0}</h3>
                  <p>Projects currently visible inside the active studio scope.</p>
                </article>
                <article class="v2-card v2-metric-card">
                  <div class="v2-card-eyebrow">Upcoming Tasks</div>
                  <h3>${summary.task_count ?? upcomingTasks.length ?? 0}</h3>
                  <p>Operational tasks remain review-side, but the creator app should still see immediate studio pressure.</p>
                </article>
                <article class="v2-card v2-metric-card">
                  <div class="v2-card-eyebrow">Exports Queued</div>
                  <h3>${summary.queued_exports ?? 0}</h3>
                  <p>Release readiness should stay visible from the first creator screen.</p>
                </article>
                <article class="v2-card v2-metric-card">
                  <div class="v2-card-eyebrow">Studios Available</div>
                  <h3>${studios.length || session.studios.length}</h3>
                  <p>The authenticated user’s accessible studio network for this session.</p>
                </article>
              </div>
              <div class="v2-card-grid v2-card-grid-data">
                <article class="v2-card v2-list-card">
                  <div class="v2-card-eyebrow">Recent Studio Projects</div>
                  <h3>Creator Targets</h3>
                  ${
                    projects.loading
                      ? `<div class="v2-note">Loading studio projects...</div>`
                      : projects.error
                        ? `<div class="v2-note v2-note-error">${projects.error}</div>`
                        : recentProjects.length || projects.items.length
                          ? `<div class="v2-data-list">${
                              (recentProjects.length ? recentProjects : projects.items.slice(0, 5)).map((project) => `
                                <div class="v2-data-row">
                                  <div class="v2-data-row-copy">
                                    <strong>${project.title || project.name || "Untitled Project"}</strong>
                                    <span>${project.type || project.project_type || "project"}</span>
                                  </div>
                                  <button
                                    class="v2-button-ghost v2-button-inline v2-button-has-icon"
                                    type="button"
                                    data-action="open-project"
                                    data-project-id="${project.id}"
                                    data-project-type="${project.type || project.project_type || "episode"}"
                                    data-project-title="${project.title || project.name || "Untitled Project"}"
                                  >
                                    ${withIcon("↗", "Open")}
                                  </button>
                                </div>
                              `).join("")
                            }</div>`
                          : `<div class="v2-note">No studio projects available yet.</div>`
                  }
                </article>
                <article class="v2-card v2-list-card">
                  <div class="v2-card-eyebrow">Operational Signal</div>
                  <h3>Studio Pressure</h3>
                  ${
                    dashboard.loading
                      ? `<div class="v2-note">Loading dashboard telemetry...</div>`
                      : dashboard.error
                        ? `<div class="v2-note v2-note-error">${dashboard.error}</div>`
                        : upcomingTasks.length
                          ? `<div class="v2-data-list">${
                              upcomingTasks.slice(0, 5).map((task) => `
                                <div class="v2-data-row">
                                  <strong>${task.title || task.name || "Untitled Task"}</strong>
                                  <span>${task.status || task.priority || "Open"}</span>
                                </div>
                              `).join("")
                            }</div>`
                          : `<div class="v2-note">No urgent task pressure is visible for this studio right now.</div>`
                  }
                </article>
              </div>
              <div class="v2-note v2-notice-band">System notice: ${workflow.notice}</div>
            </div>
          </main>
        </div>
      </div>
    `;
  }

  function renderAuthGate(state) {
    const { session } = state;
    return `
      <div class="v2-shell">
        ${renderCompactTopbar({
          appName: session.appName,
          username: "Not authenticated",
          studioLabel: "Studio required",
          sessionPath: "Authentication",
          notice: "Login is required before studio resolution and workflow access.",
          actions: [
            `<button class="v2-button-ghost v2-toolbar-button" type="button" disabled>Auth Required</button>`
          ]
        })}

        <section class="v2-stage-panel v2-gate-panel">
          <div class="v2-stage-header">
            <div>
              <div class="v2-eyebrow">Login</div>
              <h2>Authenticate to Continue</h2>
              <p>After login, V2 should immediately resolve the user’s studio list and then require explicit studio selection before the workflow loads.</p>
            </div>
          </div>
          <div class="v2-stage-body">
            <div class="v2-card-grid">
              <article class="v2-card v2-feature-card">
                <h3>Required Entry Sequence</h3>
                <p>Login, studio selection, dashboard, then the creator workflow.</p>
              </article>
              <article class="v2-card v2-feature-card">
                <h3>Top-Level Container</h3>
                <p>Studios are the top-level session container for projects, assets, permissions, generation state, and release pathways.</p>
              </article>
            </div>
            ${session.error ? `<div class="v2-note v2-note-error">${session.error}</div>` : ""}
            <div class="v2-auth-form">
              <input class="v2-studio-input" type="text" placeholder="Username" data-auth-username />
              <input class="v2-studio-input" type="password" placeholder="Password" data-auth-password />
              <button class="v2-button" type="button" data-action="login">Sign In</button>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function renderStudioSelectionGate(state) {
    const { session } = state;
    return `
      <div class="v2-shell">
        ${renderCompactTopbar({
          appName: session.appName,
          username: session.user?.username || "Unknown",
          studioLabel: "Studio required",
          sessionPath: "Studio Selection",
          notice: "Choose a studio before entering the creator workflow.",
          actions: [
            `<button class="v2-button-ghost v2-toolbar-button" type="button" disabled>Workflow Locked</button>`
          ]
        })}

        <section class="v2-stage-panel v2-gate-panel">
          <div class="v2-stage-header">
            <div>
              <div class="v2-eyebrow">Studio Selection</div>
              <h2>Select Studio Context</h2>
              <p>V2 must not enter the creator workflow without a studio. Select the authenticated studio context that should own the session.</p>
            </div>
          </div>
          <div class="v2-stage-body">
            <div class="v2-card-grid">
              <article class="v2-card v2-feature-card">
                <h3>Studio Is Required</h3>
                <p>There is no fallback personal workspace in V2. Every authenticated session must choose a studio container before work begins.</p>
              </article>
              <article class="v2-card v2-feature-card">
                <h3>Why This Matters</h3>
                <p>Projects, assets, permissions, approvals, cast, locations, and generation state must all resolve inside one studio scope.</p>
              </article>
            </div>
            ${session.error ? `<div class="v2-note v2-note-error">${session.error}</div>` : ""}
            <div class="v2-note v2-notice-band">
              Select one of the authenticated user’s studios to continue into the creator system.
            </div>
            <div class="v2-studio-list">
              ${
                Array.isArray(session.studios) && session.studios.length
                  ? session.studios.map((studio) => `
                      <button class="v2-studio-button ${String(studio.id) === String(session.studioId) ? "active" : ""}" type="button" data-action="set-studio-context" data-studio-id="${studio.id}">
                        <div class="v2-studio-button-copy">
                          <strong>${studio.name || `Studio ${studio.id}`}</strong>
                          <span>${studio.role || "Member"}</span>
                        </div>
                        <span class="v2-studio-button-signal"></span>
                      </button>
                    `).join("")
                  : `<div class="v2-note">No studios are available for this account yet.</div>`
              }
            </div>
          </div>
        </section>
      </div>
    `;
  }

  function renderStageBody(stage, state) {
    const stageRenderers = {
      idea_board: globalScope.CreatorAppV2Stages.renderIdeaBoardStage,
      idea_pitch: globalScope.CreatorAppV2Stages.renderIdeaPitchStage,
      script: globalScope.CreatorAppV2Stages.renderScriptStage,
      starting_images: globalScope.CreatorAppV2Stages.renderStartingImagesStage,
      clip_generation: globalScope.CreatorAppV2Stages.renderClipGenerationStage,
      edit: globalScope.CreatorAppV2Stages.renderEditStage,
      export_release: globalScope.CreatorAppV2Stages.renderExportReleaseStage
    };

    return stageRenderers[stage.id]?.(stage, state) || `<div class="v2-note">Stage view not implemented.</div>`;
  }

  function renderShell(state) {
    const { session, workflow, ui } = state;
    if (session.status === "auth_required") {
      return renderAuthGate(state);
    }

    const studioReady = session.status === "studio_ready";
    if (!studioReady) {
      return renderStudioSelectionGate(state);
    }

    if (ui?.currentView !== "workflow") {
      return renderDashboard(state);
    }

    const activeStage = globalScope.CreatorAppV2Workflow.getStageById(workflow.currentStageId);
    const studio = getCurrentStudioSummary(session);
    const studioLabel = studio?.name || `Studio ${session.studioId}`;
    const projectTitle = state.projectWorkspace?.activeProject?.title || "No active project";

    return `
      <div class="v2-shell">
        ${renderCompactTopbar({
          appName: session.appName,
          username: session.user?.username || "Unknown",
          studioLabel,
          sessionPath: `${projectTitle} / ${activeStage.label}`,
          notice: workflow.notice,
          actions: [
            `<button class="v2-button-ghost v2-toolbar-button v2-button-has-icon" type="button" data-stage-id="idea_board">${withIcon("◫", "Idea Board")}</button>`,
            `<button class="v2-button-ghost v2-toolbar-button v2-button-has-icon" type="button" data-stage-id="script">${withIcon("✎", "Script")}</button>`,
            `<button class="v2-button-ghost v2-toolbar-button v2-button-has-icon" type="button" data-stage-id="edit">${withIcon("✂", "Edit")}</button>`,
            `<button class="v2-button-ghost v2-toolbar-button v2-button-has-icon" type="button" data-action="open-dashboard">${withIcon("⌂", "Dashboard")}</button>`,
            `<button class="v2-button-ghost v2-toolbar-button v2-button-has-icon" type="button" data-action="open-studio-selector">${withIcon("◎", "Switch Studio")}</button>`,
            `<button class="v2-button-ghost v2-toolbar-button v2-button-has-icon" type="button" data-action="refresh">${withIcon("↻", "Refresh")}</button>`
          ]
        })}

        <div class="v2-foundation v2-foundation-workflow">
          <main class="v2-stage-panel v2-stage-panel-workflow v2-stage-panel-workflow-full">
            ${renderWorkflowStageNav(workflow, workflow.currentStageId)}
            ${renderStageBody(activeStage, state)}
            <footer class="v2-stage-footer">
              <div class="v2-stage-footer-copy">Rewrite status: ${workflow.rewriteStatus}. Current notice: ${workflow.notice}</div>
              <button class="v2-button-ghost" type="button" data-action="refresh">Refresh Shell</button>
            </footer>
          </main>
        </div>
      </div>
    `;
  }

  globalScope.CreatorAppV2AppShell = {
    renderShell,
    renderStudioSelectionGate,
    renderAuthGate,
    renderDashboard
  };
})(window);
