(function attachEditorStudioProjectLibraryModules(globalScope) {
  function createStudioProjectLibraryHelpers(deps) {
    const {
      state,
      getProject,
      getStudioScopedProjects,
      getWorkflowStage,
      formatProjectTypeLabel,
      formatSeriesMeta,
      escapeHtml
    } = deps;

    function studioProjectRows() {
      return getStudioScopedProjects().map((project) => ({
        id: project.id,
        title: project.name,
        type: project.type,
        clipCount: Number(project.clipCount || 0),
        seasonCount: Number(project.seasonCount || project.seriesOutline?.season_count || 0),
        episodeCount: Number(project.episodeCount || project.seriesOutline?.episode_count || 0),
        entryProjectId: project.entryProjectId || null,
        stage: getWorkflowStage(project).label,
        source: project.remoteId ? "Platform-linked" : "Local"
      }));
    }

    function renderStudioProjectLibrary(project) {
      const localProjects = studioProjectRows();
      const remoteProjects = state.platform.projects.slice(0, 8);

      return `
        <section class="studio-shell">
          <div class="studio-hero panel">
            <div>
              <div class="eyebrow">Studio</div>
              <h2>Project Library</h2>
              <p class="dashboard-copy">Browse local and platform-backed projects, then jump into planning or editing.</p>
            </div>
            <div class="dashboard-hero-actions">
              <button class="accent-button" type="button" data-action="new-project">New Project</button>
              <button class="ghost-button" type="button" data-action="open-platform-browser">Browse Platform</button>
              <button class="ghost-button" type="button" data-action="open-editor">Open Editor</button>
            </div>
          </div>
          <section class="studio-grid studio-grid-two">
            <article class="panel studio-panel">
              <div class="panel-header">
                <h2>Local Projects</h2>
                <span class="panel-status">${localProjects.length}</span>
              </div>
              <div class="studio-card-list">
                ${localProjects.map((entry) => `
                  <button class="studio-card-button ${entry.id === project?.id ? "active" : ""}" type="button" data-action="dashboard-open-project" data-project-id="${escapeHtml(entry.id)}">
                    <strong>${escapeHtml(entry.title)}</strong>
                    <span>${escapeHtml(formatProjectTypeLabel(entry.type))} · ${escapeHtml(entry.type === "series" ? formatSeriesMeta(entry) : `${entry.clipCount} clips`)}</span>
                    <small>${escapeHtml(entry.stage)} | ${escapeHtml(entry.source)}</small>
                  </button>
                `).join("")}
              </div>
            </article>
            <article class="panel studio-panel">
              <div class="panel-header">
                <h2>Platform Projects</h2>
                <span class="panel-status">${state.platform.loading ? "Loading" : remoteProjects.length}</span>
              </div>
              <div class="studio-card-list">
                ${
                  state.platform.loading
                    ? '<div class="empty-state">Loading platform projects...</div>'
                    : state.platform.error
                      ? `<div class="auth-error">${escapeHtml(state.platform.error)}</div>`
                      : remoteProjects.length
                        ? remoteProjects.map((entry) => `
                          <button class="studio-card-button remote" type="button" data-action="import-platform-project" data-platform-type="${escapeHtml(entry.type)}" data-platform-id="${entry.id}">
                            <strong>${escapeHtml(entry.title)}</strong>
                            <span>${escapeHtml(formatProjectTypeLabel(entry.type))} · ${escapeHtml(entry.type === "series" ? formatSeriesMeta(entry) : `${entry.clip_count ?? 0} clips`)}</span>
                            <small>${escapeHtml(entry.updated_at || "")}</small>
                          </button>
                        `).join("")
                        : '<div class="empty-state">No platform projects available.</div>'
                }
              </div>
            </article>
          </section>
        </section>
      `;
    }

    function renderSeriesOutlineCard(seriesProject) {
      const outline = seriesProject?.seriesOutline;
      const seasons = Array.isArray(outline?.seasons) ? outline.seasons : [];

      return `
        <article class="panel studio-panel">
          <div class="panel-header">
            <h2>Series Outline</h2>
            <span class="panel-status">${escapeHtml(formatSeriesMeta(seriesProject))}</span>
          </div>
          <div class="inline-actions">
            <button class="ghost-button compact-button" type="button" data-action="create-series-season" data-project-id="${escapeHtml(seriesProject.id)}">Add Season</button>
            <button class="ghost-button compact-button" type="button" data-action="create-series-episode" data-project-id="${escapeHtml(seriesProject.id)}">Add Episode</button>
            ${
              seriesProject.entryProjectId
                ? `<button class="ghost-button compact-button" type="button" data-action="open-series-entry-episode" data-project-id="${escapeHtml(seriesProject.id)}" data-entry-project-id="${seriesProject.entryProjectId}">Open Entry Episode</button>`
                : ""
            }
          </div>
          <div class="studio-card-list">
            ${
              seasons.length
                ? seasons.map((season) => `
                  <div class="studio-info-card">
                    <strong>${escapeHtml(season.title || `Season ${season.season_number || ""}`.trim())}</strong>
                    <span>${escapeHtml((season.episodes || []).length ? `${season.episodes.length} episode${season.episodes.length === 1 ? "" : "s"}` : "No episodes yet")}</span>
                    <small>${escapeHtml(season.description || `Season ${season.season_number || 1}`)}</small>
                    <div class="inline-actions">
                      <button class="ghost-button compact-button" type="button" data-action="create-series-episode" data-project-id="${escapeHtml(seriesProject.id)}" data-season-id="${season.id}">Add Episode</button>
                    </div>
                    <div class="studio-card-list">
                      ${
                        (season.episodes || []).length
                          ? season.episodes.map((episode) => `
                            <button class="studio-info-card" type="button" data-action="open-series-episode" data-project-id="${escapeHtml(seriesProject.id)}" data-local-project-id="${escapeHtml(episode.local_project_id || "")}" data-entry-project-id="${escapeHtml(episode.entry_project_id || "")}" data-episode-id="${episode.id}">
                              <strong>${escapeHtml(episode.title || `Episode ${episode.episode_number || ""}`.trim())}</strong>
                              <span>${escapeHtml(`Episode ${episode.episode_number || 1}`)}</span>
                              <small>${escapeHtml(episode.description || "No description yet.")}</small>
                            </button>
                          `).join("")
                          : '<div class="empty-state">No episodes in this season yet.</div>'
                      }
                    </div>
                  </div>
                `).join("")
                : '<div class="empty-state">No seasons have been scaffolded yet.</div>'
            }
          </div>
        </article>
      `;
    }

    function renderStudioSeriesLibrary() {
      const localSeries = getStudioScopedProjects().filter((entry) => entry.type === "series");
      const remoteSeries = state.platform.projects.filter((entry) => entry.type === "series");
      const currentProject = getProject();
      const activeSeries = currentProject?.type === "series" ? currentProject : localSeries[0] || null;

      return `
        <section class="studio-shell">
          <div class="studio-hero panel">
            <div>
              <div class="eyebrow">Studio</div>
              <h2>Series</h2>
              <p class="dashboard-copy">Manage long-form projects as series containers with season and episode structure.</p>
            </div>
            <div class="dashboard-hero-actions">
              <button class="accent-button" type="button" data-action="new-project" data-project-type="series">New Series</button>
              <button class="ghost-button" type="button" data-action="open-platform-browser">Browse Platform</button>
            </div>
          </div>
          <section class="studio-grid studio-grid-two">
            <article class="panel studio-panel">
              <div class="panel-header">
                <h2>Local Series</h2>
                <span class="panel-status">${localSeries.length}</span>
              </div>
              <div class="studio-card-list">
                ${
                  localSeries.length
                    ? localSeries.map((entry) => `
                      <button class="studio-card-button ${activeSeries?.id === entry.id ? "active" : ""}" type="button" data-action="dashboard-open-project" data-project-id="${escapeHtml(entry.id)}">
                        <strong>${escapeHtml(entry.name)}</strong>
                        <span>${escapeHtml(formatSeriesMeta(entry))}</span>
                        <small>${escapeHtml(getWorkflowStage(entry).label)}</small>
                      </button>
                    `).join("")
                    : '<div class="empty-state">No local series projects yet.</div>'
                }
              </div>
            </article>
            <article class="panel studio-panel">
              <div class="panel-header">
                <h2>Platform Series</h2>
                <span class="panel-status">${state.platform.loading ? "Loading" : remoteSeries.length}</span>
              </div>
              <div class="studio-card-list">
                ${
                  state.platform.loading
                    ? '<div class="empty-state">Loading platform series...</div>'
                    : state.platform.error
                      ? `<div class="auth-error">${escapeHtml(state.platform.error)}</div>`
                      : remoteSeries.length
                        ? remoteSeries.map((entry) => `
                          <button class="studio-card-button remote" type="button" data-action="import-platform-project" data-platform-type="${escapeHtml(entry.type)}" data-platform-id="${entry.id}">
                            <strong>${escapeHtml(entry.title)}</strong>
                            <span>${escapeHtml(formatSeriesMeta(entry))}</span>
                            <small>${escapeHtml(entry.updated_at || "")}</small>
                          </button>
                        `).join("")
                        : '<div class="empty-state">No platform series found yet.</div>'
                }
              </div>
            </article>
          </section>
          ${
            activeSeries
              ? `<section class="studio-grid studio-grid-single">${renderSeriesOutlineCard(activeSeries)}</section>`
              : `
                <section class="studio-grid studio-grid-single">
                  <article class="panel studio-panel">
                    <div class="empty-state">Open or create a series to inspect its season and episode scaffold.</div>
                  </article>
                </section>
              `
          }
        </section>
      `;
    }

    function renderStudioEpisodeLibrary() {
      const localEpisodes = getStudioScopedProjects().filter((entry) => entry.type === "episode");
      const remoteEpisodes = state.platform.projects.filter((entry) => entry.type === "episode");
      const currentProject = getProject();

      return `
        <section class="studio-shell">
          <div class="studio-hero panel">
            <div>
              <div class="eyebrow">Studio</div>
              <h2>Episodes</h2>
              <p class="dashboard-copy">Episodes are the actual editing units for series work. Open one to write, generate, and cut it.</p>
            </div>
            <div class="dashboard-hero-actions">
              <button class="accent-button" type="button" data-action="new-project" data-project-type="episode">New Episode</button>
              <button class="ghost-button" type="button" data-action="open-studio-series">View Series</button>
            </div>
          </div>
          <section class="studio-grid studio-grid-two">
            <article class="panel studio-panel">
              <div class="panel-header">
                <h2>Local Episodes</h2>
                <span class="panel-status">${localEpisodes.length}</span>
              </div>
              <div class="studio-card-list">
                ${
                  localEpisodes.length
                    ? localEpisodes.map((entry) => `
                      <button class="studio-card-button ${currentProject?.id === entry.id ? "active" : ""}" type="button" data-action="dashboard-open-project" data-project-id="${escapeHtml(entry.id)}">
                        <strong>${escapeHtml(entry.name)}</strong>
                        <span>${escapeHtml(formatProjectTypeLabel(entry.type))} · ${escapeHtml(`${entry.clipCount || 0} clips`)}</span>
                        <small>${escapeHtml(getWorkflowStage(entry).label)}</small>
                      </button>
                    `).join("")
                    : '<div class="empty-state">No local episodes yet.</div>'
                }
              </div>
            </article>
            <article class="panel studio-panel">
              <div class="panel-header">
                <h2>Platform Episodes</h2>
                <span class="panel-status">${state.platform.loading ? "Loading" : remoteEpisodes.length}</span>
              </div>
              <div class="studio-card-list">
                ${
                  state.platform.loading
                    ? '<div class="empty-state">Loading platform episodes...</div>'
                    : state.platform.error
                      ? `<div class="auth-error">${escapeHtml(state.platform.error)}</div>`
                      : remoteEpisodes.length
                        ? remoteEpisodes.map((entry) => `
                          <button class="studio-card-button remote" type="button" data-action="import-platform-project" data-platform-type="${escapeHtml(entry.type)}" data-platform-id="${entry.id}">
                            <strong>${escapeHtml(entry.title)}</strong>
                            <span>${escapeHtml(formatProjectTypeLabel(entry.type))} · ${escapeHtml(`${entry.clip_count ?? 0} clips`)}</span>
                            <small>${escapeHtml(entry.updated_at || "")}</small>
                          </button>
                        `).join("")
                        : '<div class="empty-state">No platform episodes found yet.</div>'
                }
              </div>
            </article>
          </section>
        </section>
      `;
    }

    return {
      studioProjectRows,
      renderStudioProjectLibrary,
      renderSeriesOutlineCard,
      renderStudioSeriesLibrary,
      renderStudioEpisodeLibrary
    };
  }

  globalScope.EditorStudioModules = globalScope.EditorStudioModules || {};
  globalScope.EditorStudioModules.createProjectLibraryHelpers = createStudioProjectLibraryHelpers;
})(window);
