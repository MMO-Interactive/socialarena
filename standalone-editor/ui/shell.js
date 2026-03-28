(function attachAppShellModules(globalScope) {
  function createShellHelpers(deps) {
    const {
      state,
      appName,
      escapeHtml,
      renderUiIcon,
      getCurrentStudioSummary,
      formatProjectTypeLabel,
      formatAssetMeta,
      renderAssetModalContent,
      renderWorkflowRail,
      renderExportModal,
      renderBridgeClipModal,
      formatHistoryTimestamp
    } = deps;

    function renderPlatformModal() {
      if (!state.platform.modalOpen) {
        return "";
      }

      return `
        <div class="media-modal-backdrop" data-action="close-platform-browser">
          <div class="media-modal platform-modal" role="dialog" aria-modal="true" aria-label="Platform Projects" onclick="event.stopPropagation()">
            <div class="media-modal-header">
              <div>
                <strong>SocialArena Projects</strong>
                <span>Import projects and assets from the platform</span>
              </div>
              <button class="ghost-button compact-button" type="button" data-action="close-platform-browser">Close</button>
            </div>
            <div class="media-modal-body platform-modal-body">
              ${
                state.platform.loading
                  ? '<div class="empty-state">Loading platform projects...</div>'
                  : state.platform.error
                    ? `<div class="auth-error">${escapeHtml(state.platform.error)}</div>`
                    : state.platform.projects.length
                      ? state.platform.projects
                          .map(
                            (remoteProject) => `
                              <button
                                class="platform-project-card"
                                type="button"
                                data-action="import-platform-project"
                                data-platform-type="${escapeHtml(remoteProject.type)}"
                                data-platform-id="${remoteProject.id}"
                              >
                                <strong>${escapeHtml(remoteProject.title)}</strong>
                                <span>${escapeHtml(formatProjectTypeLabel(remoteProject.type))} · ${remoteProject.clip_count ?? 0} clips</span>
                                <small>${escapeHtml(remoteProject.updated_at || "")}</small>
                              </button>
                            `
                          )
                          .join("")
                      : '<div class="empty-state">No platform projects found</div>'
              }
            </div>
          </div>
        </div>
      `;
    }

    function renderAssetPreviewModal(previewAsset, project, modalClass = "") {
      if (!previewAsset) {
        return "";
      }

      const className = modalClass ? `media-modal ${modalClass}` : "media-modal";
      return `
        <div class="media-modal-backdrop" data-action="close-asset-preview">
          <div class="${className}" role="dialog" aria-modal="true" aria-label="Asset Preview" onclick="event.stopPropagation()">
            <div class="media-modal-header">
              <div>
                <strong>${escapeHtml(previewAsset.name)}</strong>
                <span>${escapeHtml(formatAssetMeta(previewAsset))}</span>
              </div>
              <button class="ghost-button compact-button" type="button" data-action="close-asset-preview">Close</button>
            </div>
            <div class="media-modal-body">
              ${renderAssetModalContent(previewAsset, project)}
            </div>
          </div>
        </div>
      `;
    }

    function renderIdeaPromptModal() {
      if (!state.ideaPromptModal.open) {
        return "";
      }

      return `
        <div class="media-modal-backdrop" data-action="close-idea-prompt">
          <div class="media-modal" role="dialog" aria-modal="true" aria-label="Prompt Preview" onclick="event.stopPropagation()">
            <div class="media-modal-header">
              <div>
                <strong>${escapeHtml(state.ideaPromptModal.title)}</strong>
                <span>Platform-generated prompt preview</span>
              </div>
              <button class="ghost-button compact-button" type="button" data-action="close-idea-prompt">Close</button>
            </div>
            <div class="media-modal-body">
              <pre class="idea-prompt-preview">${escapeHtml(state.ideaPromptModal.content || "")}</pre>
            </div>
          </div>
        </div>
      `;
    }

    function renderIdeaHistoryModal() {
      if (!state.ideaHistoryModal.open) {
        return "";
      }

      return `
        <div class="media-modal-backdrop" data-action="close-idea-history">
          <div class="media-modal" role="dialog" aria-modal="true" aria-label="Generation History" onclick="event.stopPropagation()">
            <div class="media-modal-header">
              <div>
                <strong>${escapeHtml(state.ideaHistoryModal.title)}</strong>
                <span>Recent idea-board generations</span>
              </div>
              <button class="ghost-button compact-button" type="button" data-action="close-idea-history">Close</button>
            </div>
            <div class="media-modal-body history-modal-body">
              ${
                state.ideaHistoryModal.generations.length
                  ? state.ideaHistoryModal.generations
                      .map((generation) => {
                        const links = state.ideaHistoryModal.linksByGeneration?.[generation.id] || [];
                        return `
                          <article class="history-card">
                            <div class="history-card-header">
                              <strong>${escapeHtml(generation.status || "queued")}</strong>
                              <span>${escapeHtml(formatHistoryTimestamp(generation.created_at || generation.completed_at || ""))}</span>
                            </div>
                            ${generation.image_url ? `<a class="idea-node-anchor" href="${escapeHtml(generation.image_url)}" target="_blank" rel="noreferrer">Open output</a>` : ""}
                            ${generation.prompt_text ? `<pre class="idea-history-prompt">${escapeHtml(generation.prompt_text)}</pre>` : ""}
                            ${generation.error ? `<div class="auth-error">${escapeHtml(generation.error)}</div>` : ""}
                            ${
                              links.length
                                ? `<div class="idea-node-links">Sources: ${links.map((link) => escapeHtml(link.source_title || link.source_type || "source")).join(", ")}</div>`
                                : ""
                            }
                          </article>
                        `;
                      })
                      .join("")
                  : '<div class="empty-state">No generation history yet</div>'
              }
            </div>
          </div>
        </div>
      `;
    }

    function renderDashboardApp(projectPathLabel, dashboardContent) {
      return `
        <div class="app-shell">
          <header class="topbar">
            <div>
              <div class="eyebrow">Standalone Editor V1</div>
              <h1 id="title">${appName}</h1>
              <div class="auth-chip">Signed in as ${escapeHtml(state.auth.user?.username || "Unknown")}</div>
              <div class="auth-chip studio-chip">Studio: ${escapeHtml(getCurrentStudioSummary()?.name || "Not selected")}</div>
            </div>
            <div class="session-strip">
              <div class="session-path">${projectPathLabel}</div>
              <div class="session-notice ${state.noticeTone}" title="${escapeHtml(state.notice)}">${escapeHtml(state.notice)}</div>
            </div>
            <div class="topbar-actions">
              <button class="ghost-button" type="button" data-action="open-studio-selector">${escapeHtml(getCurrentStudioSummary()?.name || "Select Studio")}</button>
              <button class="ghost-button" type="button" data-action="open-editor">Editor</button>
              <button class="ghost-button" type="button" data-action="open-platform-browser">Browse Platform</button>
              <button class="ghost-button" type="button" data-action="new-project">New Project</button>
              <button class="ghost-button" type="button" data-action="logout">Log Out</button>
            </div>
          </header>
          ${dashboardContent}
          ${renderPlatformModal()}
        </div>
      `;
    }

    function renderSecondaryViewApp(projectPathLabel, nonEditorContent, previewAsset, project) {
      return `
        <div class="app-shell">
          <header class="topbar">
            <div>
              <div class="eyebrow">Standalone Editor V1</div>
              <h1 id="title">${appName}</h1>
              <div class="auth-chip">Signed in as ${escapeHtml(state.auth.user?.username || "Unknown")}</div>
              <div class="auth-chip studio-chip">Studio: ${escapeHtml(getCurrentStudioSummary()?.name || "Not selected")}</div>
            </div>
            <div class="session-strip">
              <div class="session-path">${projectPathLabel}</div>
              <div class="session-notice ${state.noticeTone}" title="${escapeHtml(state.notice)}">${escapeHtml(state.notice)}</div>
            </div>
            <div class="topbar-actions">
              <button class="ghost-button toolbar-button toolbar-button-strong" type="button" data-action="open-dashboard" title="Dashboard" aria-label="Dashboard">
                <span class="button-icon" aria-hidden="true">${renderUiIcon("dashboard")}</span>
                <span class="button-label">Dashboard</span>
              </button>
              <button class="ghost-button toolbar-button" type="button" data-action="open-studio-selector" title="Switch Studio" aria-label="Switch Studio">
                <span class="button-label">${escapeHtml(getCurrentStudioSummary()?.name || "Studio")}</span>
              </button>
              <button class="ghost-button toolbar-button" type="button" data-action="open-platform-browser" title="Browse Platform" aria-label="Browse Platform">
                <span class="button-icon" aria-hidden="true">${renderUiIcon("browse")}</span>
                <span class="button-label">Platform</span>
              </button>
              <button class="ghost-button toolbar-button" type="button" data-action="new-project" title="New Project" aria-label="New Project">
                <span class="button-icon" aria-hidden="true">${renderUiIcon("new")}</span>
                <span class="button-label">New</span>
              </button>
              <button class="ghost-button toolbar-button" type="button" data-action="open-project" title="Open Project" aria-label="Open Project">
                <span class="button-icon" aria-hidden="true">${renderUiIcon("open")}</span>
                <span class="button-label">Open</span>
              </button>
              <button class="ghost-button toolbar-button" type="button" data-action="save-project" title="Save Project" aria-label="Save Project">
                <span class="button-icon" aria-hidden="true">${renderUiIcon("save")}</span>
                <span class="button-label">Save</span>
              </button>
              <button class="ghost-button icon-button" type="button" data-action="sync-project" title="Sync" aria-label="Sync">${renderUiIcon("sync")}</button>
              <button class="ghost-button icon-button" type="button" data-action="logout" title="Log Out" aria-label="Log Out">${renderUiIcon("logout")}</button>
            </div>
          </header>
          ${nonEditorContent}
          ${renderPlatformModal()}
          ${renderAssetPreviewModal(previewAsset, project, "asset-preview-modal")}
        </div>
      `;
    }

    function renderEditorApp(project, context) {
      const {
        saveLabel,
        projectPathLabel,
        seriesEditingLabel,
        currentStage,
        previousStage,
        nextStage,
        workspaceContent,
        previewAsset
      } = context;

      return `
        <div class="app-shell">
          <header class="topbar">
            <div>
              <div class="eyebrow">Standalone Editor V1</div>
              <h1 id="title">${appName}</h1>
              <div class="auth-chip">Signed in as ${escapeHtml(state.auth.user?.username || "Unknown")}</div>
              <div class="auth-chip studio-chip">Studio: ${escapeHtml(getCurrentStudioSummary()?.name || "Not selected")}</div>
              ${seriesEditingLabel ? `<div class="auth-chip">${escapeHtml(seriesEditingLabel)}</div>` : ""}
            </div>
            <div class="session-strip">
              <div class="session-path">${projectPathLabel}</div>
              <div class="session-notice ${state.noticeTone}" title="${escapeHtml(state.notice)}">${escapeHtml(state.notice)}</div>
            </div>
            <div class="topbar-actions">
              <button class="ghost-button toolbar-button toolbar-button-strong" type="button" data-action="open-dashboard" title="Dashboard" aria-label="Dashboard">
                <span class="button-icon" aria-hidden="true">${renderUiIcon("dashboard")}</span>
                <span class="button-label">Dashboard</span>
              </button>
              <button class="ghost-button toolbar-button" type="button" data-action="open-studio-selector" title="Switch Studio" aria-label="Switch Studio">
                <span class="button-label">${escapeHtml(getCurrentStudioSummary()?.name || "Studio")}</span>
              </button>
              <button class="ghost-button toolbar-button" type="button" data-action="open-platform-browser" title="Browse Platform" aria-label="Browse Platform">
                <span class="button-icon" aria-hidden="true">${renderUiIcon("browse")}</span>
                <span class="button-label">Platform</span>
              </button>
              <button class="ghost-button toolbar-button" type="button" data-action="new-project" title="New Project" aria-label="New Project">
                <span class="button-icon" aria-hidden="true">${renderUiIcon("new")}</span>
                <span class="button-label">New</span>
              </button>
              <button class="ghost-button toolbar-button" type="button" data-action="open-project" title="Open Project" aria-label="Open Project">
                <span class="button-icon" aria-hidden="true">${renderUiIcon("open")}</span>
                <span class="button-label">Open</span>
              </button>
              <button class="ghost-button toolbar-button" type="button" data-action="save-project" title="${saveLabel}" aria-label="${saveLabel}">
                <span class="button-icon" aria-hidden="true">${renderUiIcon("save")}</span>
                <span class="button-label">Save</span>
              </button>
              <button class="ghost-button icon-button" type="button" data-action="sync-project" title="Sync" aria-label="Sync">${renderUiIcon("sync")}</button>
              <button class="ghost-button icon-button" type="button" data-action="logout" title="Log Out" aria-label="Log Out">${renderUiIcon("logout")}</button>
              <button class="accent-button toolbar-button toolbar-button-accent" type="button" data-action="export-project" title="Export" aria-label="Export">
                <span class="button-icon" aria-hidden="true">${renderUiIcon("export")}</span>
                <span class="button-label">Export</span>
              </button>
            </div>
          </header>

          <section class="panel workflow-panel">
            <div class="workflow-panel-header">
              <div>
                <div class="eyebrow">Creation Flow</div>
                <strong>${escapeHtml(currentStage.label)}</strong>
              </div>
              <div class="workflow-panel-actions">
                <button class="ghost-button compact-button" type="button" data-action="previous-stage" ${previousStage?.id === currentStage.id ? "disabled" : ""}>Previous Stage</button>
                <button class="ghost-button compact-button" type="button" data-action="next-stage" ${nextStage?.id === currentStage.id ? "disabled" : ""}>Next Stage</button>
              </div>
            </div>
            ${renderWorkflowRail(project)}
          </section>

          <section class="workspace">
            ${workspaceContent}
          </section>
          ${renderPlatformModal()}
          ${renderAssetPreviewModal(previewAsset, project)}
          ${state.exportModal.open ? renderExportModal(project) : ""}
          ${state.bridgeClipModal.open ? renderBridgeClipModal(project) : ""}
          ${renderIdeaPromptModal()}
          ${renderIdeaHistoryModal()}
        </div>
      `;
    }

    return {
      renderDashboardApp,
      renderSecondaryViewApp,
      renderEditorApp
    };
  }

  globalScope.AppShellModules = {
    createShellHelpers
  };
})(window);
