(function attachEditorStudioDashboardModules(globalScope) {
  function createStudioDashboardHelpers(deps) {
    const {
      state,
      workflowStages,
      getProject,
      getStudioScopedProjects,
      getCurrentStudioSummary,
      getWorkflowStage,
      getStageProgressPercent,
      formatProjectTypeLabel,
      escapeHtml
    } = deps;

    function studioSummary() {
      if (Array.isArray(state.dashboard.data?.studios) && state.dashboard.data.studios.length) {
        return state.dashboard.data.studios.map((studio) => ({
          name: studio.name || "Studio",
          role: studio.role || "Member",
          projectCount: Number(studio.project_count || 0)
        }));
      }

      const currentStudio = getCurrentStudioSummary();
      if (!currentStudio) {
        return [];
      }

      return [
        {
          name: currentStudio.name || "Studio",
          role: currentStudio.role || "Member",
          projectCount: getStudioScopedProjects(null).length
        }
      ];
    }

    function dashboardTasks() {
      if (Array.isArray(state.dashboard.data?.upcoming_tasks) && state.dashboard.data.upcoming_tasks.length) {
        return state.dashboard.data.upcoming_tasks.map((task) => ({
          title: task.title || "Task",
          detail: task.detail || "",
          tone: task.tone || "neutral",
          kind: task.kind || "task",
          projectId: task.project_id ? `platform-${task.project_type}-${task.project_id}` : "",
          platformId: task.project_id ? Number(task.project_id) : 0,
          platformType: task.project_type || ""
        }));
      }

      const activeProject = getProject();
      return [
        {
          title: activeProject ? `Continue ${activeProject.name}` : "Create your first project",
          detail: activeProject ? `Current stage: ${getWorkflowStage(activeProject).label}` : "Start a new local SocialArena project",
          tone: "accent",
          kind: "open_editor",
          projectId: activeProject?.id || ""
        }
      ];
    }

    function renderDashboard() {
      const activeProject = getProject();
      const studios = studioSummary();
      const tasks = dashboardTasks();
      const scopedProjects = getStudioScopedProjects();
      const recentProjects = Array.isArray(state.dashboard.data?.recent_projects) && state.dashboard.data.recent_projects.length
        ? state.dashboard.data.recent_projects.slice(0, 4).map((project) => ({
            id: `platform-${project.type}-${project.id}`,
            title: project.title,
            type: project.type,
            clipCount: Number(project.clip_count || 0),
            status: project.status || "Platform",
            remoteId: Number(project.id),
            remoteType: project.type
          }))
        : [...scopedProjects].slice(0, 4).map((project) => ({
            id: project.id,
            title: project.name,
            type: project.type,
            clipCount: Number(project.clipCount || 0),
            status: project.status || "Local",
            remoteId: project.remoteId || 0,
            remoteType: project.remoteType || ""
          }));
      const remoteProjects = state.platform.projects.slice(0, 4);
      const stats = state.dashboard.data?.stats || null;
      const activeStage = activeProject ? getWorkflowStage(activeProject) : workflowStages[0];

      return `
        <section class="dashboard-shell">
          <div class="dashboard-hero panel">
            <div>
              <div class="eyebrow">Creator Dashboard</div>
              <h2>Welcome back, ${escapeHtml(state.auth.user?.username || "Creator")}</h2>
              <p class="dashboard-copy">Use the standalone app as your SocialArena command center for planning, generation, editing, sync, and publishing.</p>
              <div class="dashboard-stage-summary">
                <span class="stage-chip">Current Stage: ${escapeHtml(activeStage.label)}</span>
                <span class="stage-chip muted">${getStageProgressPercent(activeProject)}% complete</span>
              </div>
              ${
                state.dashboard.loading
                  ? '<div class="dashboard-helper">Refreshing dashboard...</div>'
                  : state.dashboard.error
                    ? `<div class="dashboard-helper error">${escapeHtml(state.dashboard.error)}</div>`
                    : ""
              }
            </div>
            <div class="dashboard-hero-actions">
              <button class="accent-button" type="button" data-action="open-editor">Open Editor</button>
              <button class="ghost-button" type="button" data-action="open-platform-browser">Browse Platform</button>
              <button class="ghost-button" type="button" data-action="new-project" data-project-type="episode">New Project</button>
            </div>
          </div>

          <section class="dashboard-grid">
            <article class="panel dashboard-panel">
              <div class="panel-header">
                <h2>Upcoming Tasks</h2>
                <span class="panel-status">${tasks.length} queued</span>
              </div>
              <div class="dashboard-task-list">
                ${tasks.map((task) => `
                  <button class="dashboard-task-card tone-${escapeHtml(task.tone || "neutral")}" type="button"
                    ${task.kind === "open_editor" && task.projectId ? `data-action="dashboard-open-project" data-project-id="${escapeHtml(task.projectId)}"` : ""}
                    ${task.platformId && task.platformType ? `data-action="import-platform-project" data-platform-type="${escapeHtml(task.platformType)}" data-platform-id="${task.platformId}"` : ""}>
                    <strong>${escapeHtml(task.title)}</strong>
                    <span>${escapeHtml(task.detail)}</span>
                  </button>
                `).join("")}
              </div>
            </article>

            <article class="panel dashboard-panel">
              <div class="panel-header">
                <h2>Your Studios</h2>
                <span class="panel-status">${studios.length} connected</span>
              </div>
              <div class="dashboard-studio-list">
                ${
                  studios.length
                    ? studios.map((studio) => `
                      <div class="dashboard-studio-card">
                        <strong>${escapeHtml(studio.name)}</strong>
                        <span>${escapeHtml(studio.role)}</span>
                        <small>${escapeHtml(`${studio.projectCount || 0} projects`)}</small>
                      </div>
                    `).join("")
                    : '<div class="empty-state">No studio data available</div>'
                }
              </div>
            </article>

            <article class="panel dashboard-panel">
              <div class="panel-header">
                <h2>Recent Projects</h2>
                <span class="panel-status">${recentProjects.length ? "Local" : "Empty"}</span>
              </div>
              <div class="dashboard-project-list">
                ${
                  recentProjects.length
                    ? recentProjects
                        .map(
                          (project) => `
                            <button class="dashboard-project-card" type="button" data-action="${project.remoteId && project.remoteType ? "import-platform-project" : "dashboard-open-project"}" ${project.remoteId && project.remoteType ? `data-platform-type="${escapeHtml(project.remoteType)}" data-platform-id="${project.remoteId}"` : `data-project-id="${escapeHtml(project.id)}"`}>
                              <strong>${escapeHtml(project.title)}</strong>
                              <span>${escapeHtml(formatProjectTypeLabel(project.type))} · ${escapeHtml(`${project.clipCount || 0} clips`)}</span>
                              <small>${escapeHtml(project.status || "")}</small>
                            </button>
                          `
                        )
                        .join("")
                    : '<div class="empty-state">No recent projects yet</div>'
                }
              </div>
            </article>

            <article class="panel dashboard-panel">
              <div class="panel-header">
                <h2>Platform Projects</h2>
                <span class="panel-status">${state.platform.loading ? "Loading" : `${state.platform.projects.length} found`}</span>
              </div>
              <div class="dashboard-project-list">
                ${
                  state.platform.loading
                    ? '<div class="empty-state">Loading platform projects...</div>'
                    : state.platform.error
                      ? `<div class="auth-error">${escapeHtml(state.platform.error)}</div>`
                      : remoteProjects.length
                        ? remoteProjects
                            .map(
                              (project) => `
                                <button class="dashboard-project-card remote" type="button" data-action="import-platform-project" data-platform-type="${escapeHtml(project.type)}" data-platform-id="${project.id}">
                                  <strong>${escapeHtml(project.title)}</strong>
                                  <span>${escapeHtml(formatProjectTypeLabel(project.type))} · ${project.clip_count ?? 0} clips</span>
                                  <small>${escapeHtml(project.updated_at || "")}</small>
                                </button>
                              `
                            )
                            .join("")
                        : '<div class="empty-state">No platform projects available yet</div>'
                }
              </div>
            </article>

            <article class="panel dashboard-panel dashboard-panel-wide">
              <div class="panel-header">
                <h2>System Overview</h2>
                <span class="panel-status">Today</span>
              </div>
              <div class="dashboard-stats">
                <div class="dashboard-stat-card">
                  <span>Current project</span>
                  <strong>${escapeHtml(stats?.active_project || activeProject?.name || "No active project")}</strong>
                </div>
                <div class="dashboard-stat-card">
                  <span>Studios</span>
                  <strong>${stats?.studio_count ?? studios.length}</strong>
                </div>
                <div class="dashboard-stat-card">
                  <span>Current stage</span>
                  <strong>${escapeHtml(activeStage.label)}</strong>
                </div>
                <div class="dashboard-stat-card">
                  <span>Upcoming exports</span>
                  <strong>${stats?.queued_exports ?? 0} queued</strong>
                </div>
              </div>
            </article>
          </section>
        </section>
      `;
    }

    return {
      studioSummary,
      dashboardTasks,
      renderDashboard
    };
  }

  globalScope.EditorStudioModules = globalScope.EditorStudioModules || {};
  globalScope.EditorStudioModules.createDashboardHelpers = createStudioDashboardHelpers;
})(window);
