(function attachEditorWorkflowProjectPitchModules(globalScope) {
  function createProjectPitchWorkflowHelpers(deps) {
    const {
      PROJECT_FORMATS,
      createProjectPitchState,
      projectPitchFields,
      isProjectPromoted,
      getPromotionTargetLabel,
      formatProjectTypeLabel,
      escapeHtml
    } = deps;

    function renderProjectPitchWorkspace(project) {
      const projectPitch = createProjectPitchState(project.projectPitch || {});
      const checklist = projectPitchFields(project);
      const completeCount = checklist.filter((item) => item.complete).length;
      const promoted = isProjectPromoted(project);
      const promotionTarget = getPromotionTargetLabel(project);

      return `
        <section class="workflow-stage-shell">
          <section class="panel idea-board-panel">
            <div class="panel-header">
              <div>
                <h2>Project Pitch</h2>
                <div class="dashboard-helper">Condense the board into a tight creative brief before script writing.</div>
              </div>
              <div class="workflow-panel-actions">
                <button class="ghost-button compact-button" type="button" data-action="promote-project-idea">${promoted ? `Promoted to ${promotionTarget}` : `Promote to ${promotionTarget}`}</button>
                <button class="ghost-button compact-button" type="button" data-action="save-project-pitch">Save Pitch</button>
                <button class="accent-button compact-button" type="button" data-action="next-stage">Continue to Script</button>
              </div>
            </div>

            <div class="idea-board-grid">
              <label class="idea-field idea-field-wide">
                <span>Project Title</span>
                <input class="idea-input" type="text" value="${escapeHtml(project.name || "")}" data-pitch-input="projectName" placeholder="Untitled SocialArena Project" />
              </label>

              <label class="idea-field">
                <span>Format</span>
                <select class="idea-input" data-pitch-input="format">
                  ${PROJECT_FORMATS.map((format) => `<option value="${format.id}" ${project.type === format.id ? "selected" : ""}>${escapeHtml(format.label)}</option>`).join("")}
                </select>
              </label>

              <label class="idea-field">
                <span>Target Audience</span>
                <input class="idea-input" type="text" value="${escapeHtml(projectPitch.audience)}" data-pitch-input="audience" placeholder="Who is this for?" />
              </label>

              <label class="idea-field idea-field-wide">
                <span>Logline</span>
                <textarea class="idea-input idea-textarea idea-textarea-compact" data-pitch-input="logline" placeholder="One sentence that captures the core hook.">${escapeHtml(projectPitch.logline)}</textarea>
              </label>

              <label class="idea-field idea-field-wide">
                <span>Concept Brief</span>
                <textarea class="idea-input idea-textarea" data-pitch-input="concept" placeholder="Describe the premise, characters, conflict, and what makes it worth making.">${escapeHtml(projectPitch.concept)}</textarea>
              </label>

              <label class="idea-field">
                <span>Tone Tags</span>
                <input class="idea-input" type="text" value="${escapeHtml(projectPitch.tone.join(", "))}" data-pitch-input="tone" placeholder="cinematic, hopeful, mysterious" />
              </label>

              <label class="idea-field">
                <span>Visual Direction</span>
                <textarea class="idea-input idea-textarea idea-textarea-compact" data-pitch-input="visualStyle" placeholder="Lens, color palette, lighting, framing, references.">${escapeHtml(projectPitch.visualStyle)}</textarea>
              </label>

              <label class="idea-field idea-field-wide">
                <span>Reference Notes</span>
                <textarea class="idea-input idea-textarea idea-textarea-compact" data-pitch-input="references" placeholder="Key references, locations, existing assets, notes, links.">${escapeHtml(projectPitch.references)}</textarea>
              </label>

              <label class="idea-field idea-field-wide">
                <span>Definition of Success</span>
                <textarea class="idea-input idea-textarea idea-textarea-compact" data-pitch-input="successCriteria" placeholder="What should be true before this project moves to script?">${escapeHtml(projectPitch.successCriteria)}</textarea>
              </label>
            </div>
          </section>

          <aside class="panel stage-sidebar">
            <div class="stage-sidebar-section">
              <div class="panel-header">
                <h2>Pitch Health</h2>
                <span class="panel-status">${completeCount}/${checklist.length}</span>
              </div>
              <div class="idea-progress-shell">
                <div class="idea-progress-fill" style="width:${Math.round((completeCount / checklist.length) * 100)}%"></div>
              </div>
              <div class="dashboard-helper">This stage should read like a confident greenlight brief, not just raw ideas.</div>
            </div>

            <div class="stage-sidebar-section">
              <div class="panel-header">
                <h2>Checklist</h2>
                <span class="panel-status">Required</span>
              </div>
              <div class="idea-checklist">
                ${checklist
                  .map(
                    (item) => `
                      <div class="idea-check-item${item.complete ? " complete" : ""}">
                        <span class="idea-check-dot">${item.complete ? "Done" : "Open"}</span>
                        <strong>${escapeHtml(item.label)}</strong>
                      </div>
                    `
                  )
                  .join("")}
              </div>
            </div>

            <div class="stage-sidebar-section">
              <div class="panel-header">
                <h2>Promotion</h2>
                <span class="panel-status">${promoted ? "Ready" : "Pending"}</span>
              </div>
              <div class="sync-card">
                <strong>${promoted ? `${promotionTarget} created` : `Promote to ${promotionTarget}`}</strong>
                <span>${
                  promoted
                    ? `This idea is linked to SocialArena as a ${promotionTarget.toLowerCase()}${project.type === "series" && project.entryProjectId ? " with an episode scaffold" : ""}.`
                    : `Create the backing ${promotionTarget.toLowerCase()} before moving deeper into production workflow.`
                }</span>
              </div>
            </div>

            <div class="stage-sidebar-section">
              <div class="panel-header">
                <h2>Next Stage</h2>
                <span class="panel-status">Script</span>
              </div>
              <div class="sync-card">
                <strong>Build the scene plan</strong>
                <span>Use the approved pitch to create scenes, dialogue, and clip prompts.</span>
              </div>
            </div>
          </aside>
        </section>
      `;
    }

    function renderWorkflowPlaceholder(project, currentStage) {
      const stageCopy = {
        starting_images: {
          eyebrow: "Starting Images",
          title: "Approve visual keyframes",
          body: "Generate or select one anchor image per planned clip before clip generation.",
          next: "After image approval, move into Video Clips."
        },
        video_clips: {
          eyebrow: "Video Clips",
          title: "Generate production clips",
          body: "Queue, review, and approve the generated clips that will feed the timeline editor.",
          next: "After the clip set is approved, move into Edit."
        }
      }[currentStage.id];

      const projectPitch = createProjectPitchState(project.projectPitch || {});

      return `
        <section class="workflow-stage-shell">
          <section class="panel stage-placeholder-panel">
            <div class="eyebrow">${escapeHtml(stageCopy.eyebrow)}</div>
            <h2>${escapeHtml(stageCopy.title)}</h2>
            <p class="dashboard-copy">${escapeHtml(stageCopy.body)}</p>
            <div class="dashboard-stage-summary">
              <div class="stage-chip">Project: ${escapeHtml(project.name)}</div>
              <div class="stage-chip muted">Format: ${escapeHtml(formatProjectTypeLabel(project.type))}</div>
              <div class="stage-chip muted">Current stage: ${escapeHtml(currentStage.label)}</div>
            </div>
            <div class="workflow-panel-actions">
              <button class="ghost-button compact-button" type="button" data-action="previous-stage">Back</button>
              <button class="ghost-button compact-button" type="button" data-action="save-idea-board">Save Progress</button>
              <button class="accent-button compact-button" type="button" data-action="next-stage">Continue</button>
            </div>
          </section>

          <aside class="panel stage-sidebar">
            <div class="stage-sidebar-section">
              <div class="panel-header">
                <h2>Locked Input</h2>
                <span class="panel-status">From Idea Board</span>
              </div>
              <div class="sync-card">
                <strong>${escapeHtml(projectPitch.logline || "No logline yet")}</strong>
                <span>${escapeHtml(projectPitch.concept || "No concept brief captured yet.")}</span>
              </div>
            </div>

            <div class="stage-sidebar-section">
              <div class="panel-header">
                <h2>Direction</h2>
                <span class="panel-status">Visual</span>
              </div>
              <div class="sync-card">
                <strong>${escapeHtml(projectPitch.tone.join(", ") || "No tone tags yet")}</strong>
                <span>${escapeHtml(projectPitch.visualStyle || stageCopy.next)}</span>
              </div>
            </div>
          </aside>
        </section>
      `;
    }

    return {
      renderProjectPitchWorkspace,
      renderWorkflowPlaceholder
    };
  }

  globalScope.EditorWorkflowModules = globalScope.EditorWorkflowModules || {};
  globalScope.EditorWorkflowModules.createProjectPitchWorkflowHelpers = createProjectPitchWorkflowHelpers;
})(window);
