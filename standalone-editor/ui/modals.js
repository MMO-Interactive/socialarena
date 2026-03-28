(function attachEditorModalModules(globalScope) {
  const modules = globalScope.EditorUiModules || (globalScope.EditorUiModules = {});

  modules.createModalHelpers = function createModalHelpers(deps) {
    const {
      state,
      escapeHtml,
      createExportSettings,
      getBridgeContext
    } = deps;

    function renderExportModal(project) {
      const exportState = state.exportModal;
      const settings = createExportSettings(exportState.settings || {});
      const exportDisabled = exportState.inProgress;

      return `
        <div class="media-modal-backdrop" data-action="${exportState.inProgress ? "" : "close-export-modal"}">
          <div class="media-modal export-modal" role="dialog" aria-modal="true" aria-label="Export Settings" onclick="event.stopPropagation()">
            <div class="media-modal-header">
              <div>
                <strong>Export ${escapeHtml(project.name)}</strong>
                <span>Choose export settings, then render the current timeline to MP4.</span>
              </div>
              <button class="ghost-button compact-button" type="button" data-action="close-export-modal" ${exportDisabled ? "disabled" : ""}>Close</button>
            </div>
            <div class="media-modal-body export-modal-body">
              <div class="export-settings-grid">
                <label class="idea-field">
                  <span>Resolution</span>
                  <select class="idea-input" data-export-setting="resolution" ${exportDisabled ? "disabled" : ""}>
                    ${[
                      ["1920x1080", "1920x1080 (Landscape)"],
                      ["1280x720", "1280x720 (Fast Preview)"],
                      ["1080x1920", "1080x1920 (Vertical)"]
                    ]
                      .map(([value, label]) => `<option value="${value}" ${settings.resolution === value ? "selected" : ""}>${escapeHtml(label)}</option>`)
                      .join("")}
                  </select>
                </label>
                <label class="idea-field">
                  <span>Frame Rate</span>
                  <select class="idea-input" data-export-setting="fps" ${exportDisabled ? "disabled" : ""}>
                    ${["24", "30", "60"]
                      .map((value) => `<option value="${value}" ${settings.fps === value ? "selected" : ""}>${value} fps</option>`)
                      .join("")}
                  </select>
                </label>
                <label class="idea-field">
                  <span>Quality</span>
                  <select class="idea-input" data-export-setting="quality" ${exportDisabled ? "disabled" : ""}>
                    ${[
                      ["high", "High Quality"],
                      ["balanced", "Balanced"],
                      ["fast", "Fast Draft"]
                    ]
                      .map(([value, label]) => `<option value="${value}" ${settings.quality === value ? "selected" : ""}>${escapeHtml(label)}</option>`)
                      .join("")}
                  </select>
                </label>
                <label class="export-checkbox">
                  <input type="checkbox" data-export-setting="includeAudio" ${settings.includeAudio ? "checked" : ""} ${exportDisabled ? "disabled" : ""} />
                  <span>Include audio mix</span>
                </label>
              </div>
              <div class="export-progress-card">
                <div class="panel-header">
                  <h2>Progress</h2>
                  <span class="panel-status">${Math.round(exportState.progress || 0)}%</span>
                </div>
                <div class="idea-progress-shell export-progress-shell">
                  <div class="idea-progress-fill" style="width:${Math.max(0, Math.min(100, exportState.progress || 0))}%"></div>
                </div>
                <div class="dashboard-helper">${escapeHtml(exportState.stage || "Ready to export.")}</div>
              </div>
              <div class="workflow-panel-actions">
                <button class="ghost-button compact-button" type="button" data-action="close-export-modal" ${exportDisabled ? "disabled" : ""}>Cancel</button>
                <button class="accent-button compact-button" type="button" data-action="confirm-export" ${exportDisabled ? "disabled" : ""}>${exportDisabled ? "Exporting..." : "Export MP4"}</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function renderBridgeClipModal(project) {
      if (!state.bridgeClipModal.open) {
        return "";
      }

      const context = getBridgeContext(project);
      if (!context) {
        return "";
      }

      return `
        <div class="media-modal-backdrop" data-action="close-bridge-clip-modal">
          <div class="media-modal export-modal bridge-clip-modal" role="dialog" aria-modal="true" aria-label="Create Bridge Clip" onclick="event.stopPropagation()">
            <div class="media-modal-header">
              <div>
                <strong>Create Bridge Clip</strong>
                <span>Build a connector between ${escapeHtml(context.beforeItem.name)} and ${escapeHtml(context.afterItem.name)}.</span>
              </div>
              <button class="ghost-button compact-button" type="button" data-action="close-bridge-clip-modal">Close</button>
            </div>
            <div class="media-modal-body export-modal-body">
              <div class="bridge-clip-context">
                <div class="sync-card">
                  <strong>From</strong>
                  <span>${escapeHtml(context.beforeItem.name)}</span>
                </div>
                <div class="sync-card">
                  <strong>To</strong>
                  <span>${escapeHtml(context.afterItem.name)}</span>
                </div>
              </div>
              <label class="idea-field idea-field-wide">
                <span>Bridge Prompt</span>
                <textarea class="idea-input idea-textarea idea-textarea-compact" data-bridge-input="prompt" placeholder="Describe what should happen between these clips.">${escapeHtml(state.bridgeClipModal.prompt)}</textarea>
              </label>
              <label class="idea-field">
                <span>Duration (seconds)</span>
                <input class="idea-input" type="number" min="0.6" max="8" step="0.1" value="${escapeHtml(String(state.bridgeClipModal.durationSeconds || 2))}" data-bridge-input="durationSeconds" />
              </label>
              <div class="dashboard-helper">V1 generates a local bridge clip from the boundary frames and stores the prompt for later AI bridge workflows.</div>
              <div class="workflow-panel-actions">
                <button class="ghost-button compact-button" type="button" data-action="close-bridge-clip-modal">Cancel</button>
                <button class="accent-button compact-button" type="button" data-action="generate-bridge-clip">Generate Bridge</button>
              </div>
            </div>
          </div>
        </div>
      `;
    }

    return {
      renderExportModal,
      renderBridgeClipModal
    };
  };
})(window);
