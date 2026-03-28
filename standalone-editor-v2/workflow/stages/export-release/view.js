(function attachV2ExportReleaseStage(globalScope) {
  function formatDuration(seconds) {
    const value = Math.max(0, Number(seconds || 0));
    const minutes = Math.floor(value / 60);
    const remainder = Math.floor(value % 60);
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function renderExportRow(entry, selectedExport) {
    return `
      <button class="v2-data-row v2-export-row ${selectedExport?.id === entry.id ? "active" : ""}" type="button" data-action="select-export-record" data-export-id="${entry.id}">
        <div class="v2-data-row-copy">
          <strong>${entry.title}</strong>
          <span>${entry.status} · ${entry.resolution} · ${formatDuration(entry.durationSeconds)}</span>
        </div>
      </button>
    `;
  }

  function renderExportReleaseStage(stage, state) {
    const activeProject = state?.projectWorkspace?.activeProject;
    const draft = globalScope.CreatorAppV2ExportReleaseState.getExportReleaseDraft({ getState: () => state });
    const selectedExport = globalScope.CreatorAppV2ExportReleaseState.getSelectedExport({ getState: () => state });
    const checklist = globalScope.CreatorAppV2ExportReleaseState.getExportChecklist({ getState: () => state });
    const completeCount = checklist.filter((item) => item.complete).length;

    if (!activeProject) {
      return `
        <div class="v2-stage-header">
          <div>
            <div class="v2-eyebrow">Step 7</div>
            <h2>${stage.label}</h2>
            <p>${stage.summary}</p>
          </div>
          <button class="v2-button" type="button" data-action="open-dashboard">Open Dashboard</button>
        </div>
        <div class="v2-stage-body">
          <div class="v2-note">Open a project first. Export and release should only happen after the prior six stages are coherent.</div>
        </div>
      `;
    }

    return `
      <div class="v2-stage-header">
        <div>
          <div class="v2-eyebrow">Step 7</div>
          <h2>${stage.label}</h2>
          <p>${stage.summary}</p>
        </div>
        <div class="v2-topbar-actions">
          <button class="v2-button" type="button" data-action="apply-export-draft">Apply Export Plan</button>
          <button class="v2-button-ghost" type="button" data-action="init-export">Initialize Export</button>
          <button class="v2-button-ghost" type="button" data-action="refresh-export-history">Refresh History</button>
          <button class="v2-button-ghost" type="button" data-action="complete-export" ${selectedExport ? `data-export-id="${selectedExport.id}"` : "disabled"}>Mark Complete</button>
          <button class="v2-button-ghost" type="button" data-stage-id="idea_board">Return to Idea Board</button>
        </div>
      </div>
      <div class="v2-stage-body">
        <div class="v2-card-grid v2-card-grid-dashboard">
          <article class="v2-card v2-feature-card">
            <div class="v2-card-eyebrow">Release Target</div>
            <h3>${activeProject.title}</h3>
            <p>The release stage remains thin and dependable, but it is real: export records, release readiness, and final handoff should all originate here.</p>
          </article>
          <article class="v2-card v2-feature-card">
            <div class="v2-card-eyebrow">Release Health</div>
            <h3>${completeCount}/${checklist.length}</h3>
            <p>${draft.loading ? "Syncing export state with the V1 API." : "The final stage is driven by export readiness, not by placeholder copy."}</p>
          </article>
        </div>
        <div class="v2-card-grid v2-card-grid-metrics">
          ${checklist.map((item) => `
            <article class="v2-card v2-metric-card">
              <div class="v2-card-eyebrow">${item.label}</div>
              <h3>${item.complete ? "Ready" : "Open"}</h3>
              <p>${item.complete ? "This requirement is satisfied." : "This requirement still needs work."}</p>
            </article>
          `).join("")}
        </div>
        ${draft.error ? `<div class="v2-note v2-note-error">${draft.error}</div>` : ""}
        <div class="v2-card-grid v2-card-grid-data">
          <section class="v2-card v2-list-card">
            <div class="v2-card-eyebrow">Export Plan</div>
            <h3>Release Configuration</h3>
            <div class="v2-script-grid">
              <input class="v2-studio-input" type="text" value="${draft.title}" data-export-field="title" placeholder="Export title" />
              <select class="v2-studio-input" data-export-field="exportType">
                <option value="draft" ${draft.exportType === "draft" ? "selected" : ""}>Draft</option>
                <option value="review" ${draft.exportType === "review" ? "selected" : ""}>Review</option>
                <option value="final" ${draft.exportType === "final" ? "selected" : ""}>Final</option>
              </select>
              <select class="v2-studio-input" data-export-field="resolution">
                <option value="1920x1080" ${draft.resolution === "1920x1080" ? "selected" : ""}>1920x1080</option>
                <option value="3840x2160" ${draft.resolution === "3840x2160" ? "selected" : ""}>3840x2160</option>
                <option value="1080x1920" ${draft.resolution === "1080x1920" ? "selected" : ""}>1080x1920</option>
              </select>
              <div class="v2-card">
                <div class="v2-card-eyebrow">Estimated Runtime</div>
                <h3>${formatDuration(draft.durationSeconds)}</h3>
                <p>Derived from the current rough cut assembled in the edit stage.</p>
              </div>
            </div>
          </section>
          <section class="v2-card v2-list-card">
            <div class="v2-card-eyebrow">Export History</div>
            <h3>API-Backed Release Records</h3>
            ${
              draft.exports.length
                ? `<div class="v2-data-list">${draft.exports.map((entry) => renderExportRow(entry, selectedExport)).join("")}</div>`
                : `<div class="v2-note">No export records exist yet for this project.</div>`
            }
          </section>
        </div>
        ${
          selectedExport
            ? `
              <div class="v2-card">
                <div class="v2-card-eyebrow">Selected Export</div>
                <h3>${selectedExport.title}</h3>
                <p>Status: ${selectedExport.status} · Resolution: ${selectedExport.resolution} · Runtime: ${formatDuration(selectedExport.durationSeconds)}</p>
                <p>Storage path: ${selectedExport.storagePath || "Pending allocation"}</p>
              </div>
            `
            : ""
        }
        <div class="v2-note">${stage.foundation}</div>
      </div>
    `;
  }

  globalScope.CreatorAppV2Stages = globalScope.CreatorAppV2Stages || {};
  globalScope.CreatorAppV2Stages.renderExportReleaseStage = renderExportReleaseStage;
})(window);
