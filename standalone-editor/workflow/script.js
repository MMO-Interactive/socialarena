(function attachEditorWorkflowScriptModules(globalScope) {
  function createScriptWorkflowHelpers(deps) {
    const {
      createScriptState,
      ensureScriptDraft,
      getSelectedScriptScene,
      scriptChecklist,
      createProjectPitchState,
      createIdeaBoardState,
      escapeHtml
    } = deps;

    function formatScriptExport(project) {
      const script = createScriptState(project?.script || {});
      const title = script.title || project?.name || "Untitled SocialArena Project";
      const lines = [title, "=".repeat(title.length), ""];

      if (script.premise?.trim()) {
        lines.push("PREMISE");
        lines.push(script.premise.trim());
        lines.push("");
      }

      if (script.structureNotes?.trim()) {
        lines.push("STRUCTURE NOTES");
        lines.push(script.structureNotes.trim());
        lines.push("");
      }

      script.scenes.forEach((scene, index) => {
        const heading = `SCENE ${index + 1}: ${scene.title || `Scene ${index + 1}`}`;
        lines.push(heading);
        lines.push("-".repeat(heading.length));
        if (scene.slug?.trim()) {
          lines.push(`Slug: ${scene.slug.trim()}`);
        }
        if (Array.isArray(scene.characters) && scene.characters.length) {
          lines.push(`Characters: ${scene.characters.join(", ")}`);
        }
        if (scene.location?.trim()) {
          lines.push(`Location: ${scene.location.trim()}`);
        }
        if (scene.timeOfDay?.trim()) {
          lines.push(`Time of Day: ${scene.timeOfDay.trim()}`);
        }
        if (scene.objective?.trim()) {
          lines.push(`Objective: ${scene.objective.trim()}`);
        }
        if (Array.isArray(scene.mood) && scene.mood.length) {
          lines.push(`Mood: ${scene.mood.join(", ")}`);
        }
        lines.push("");

        if (scene.summary?.trim()) {
          lines.push("Summary:");
          lines.push(scene.summary.trim());
          lines.push("");
        }

        if (Array.isArray(scene.clips) && scene.clips.length) {
          lines.push("Planned Clips:");
          scene.clips.forEach((clip, clipIndex) => {
            lines.push(`  ${clipIndex + 1}. ${clip.title || `Clip ${clipIndex + 1}`}`);
            if (clip.prompt?.trim()) {
              lines.push(`     Prompt: ${clip.prompt.trim()}`);
            }
            if (clip.dialogue?.trim()) {
              lines.push(`     Dialogue: ${clip.dialogue.trim()}`);
            }
          });
          lines.push("");
        }
      });

      return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
    }

    function renderScriptWorkspace(project) {
      ensureScriptDraft(project);
      const script = createScriptState(project.script || {});
      const activeScene = getSelectedScriptScene(project);
      const checklist = scriptChecklist(project);
      const completeCount = checklist.filter((item) => item.complete).length;
      const pitch = createProjectPitchState(project.projectPitch || {});
      const board = createIdeaBoardState(project.ideaBoard || {});
      const boardSummary = {
        characters: board.cards.filter((card) => card.category === "character" && card.title.trim()).map((card) => card.title.trim()).slice(0, 4),
        locations: board.cards.filter((card) => card.category === "location" && card.title.trim()).map((card) => card.title.trim()).slice(0, 4),
        scenes: board.cards.filter((card) => card.category === "scene" && card.title.trim()).map((card) => card.title.trim()).slice(0, 4)
      };

      return `
        <section class="workflow-stage-shell">
          <section class="panel script-workspace">
            <div class="panel-header">
              <div>
                <h2>Script</h2>
                <div class="dashboard-helper">Turn the board and pitch into a scene-by-scene working script that can feed image and clip generation.</div>
              </div>
              <div class="workflow-panel-actions">
                <button class="ghost-button compact-button" type="button" data-action="save-script">Save Script</button>
                <button class="ghost-button compact-button" type="button" data-action="export-script">Export Script</button>
                <button class="ghost-button compact-button" type="button" data-action="add-script-scene">Add Scene</button>
                <button class="accent-button compact-button" type="button" data-action="next-stage">Continue to Starting Images</button>
              </div>
            </div>

            <div class="script-workspace-grid">
              <section class="script-main">
                <div class="script-overview">
                  <label class="idea-field script-title-field">
                    <span>Script Title</span>
                    <input class="idea-input" type="text" value="${escapeHtml(script.title || project.name || "")}" data-script-input="title" placeholder="Project script title" />
                  </label>
                  <label class="idea-field">
                    <span>Premise</span>
                    <textarea class="idea-input idea-textarea idea-textarea-compact" data-script-input="premise" placeholder="Summarize the story engine this script needs to execute.">${escapeHtml(script.premise)}</textarea>
                  </label>
                  <label class="idea-field">
                    <span>Structure Notes</span>
                    <textarea class="idea-input idea-textarea idea-textarea-compact" data-script-input="structureNotes" placeholder="Act beats, emotional turn, pacing notes, episode structure, or constraints.">${escapeHtml(script.structureNotes)}</textarea>
                  </label>
                </div>

                <div class="script-scene-list">
                  <div class="script-scene-nav">
                    ${script.scenes
                      .map(
                        (scene, index) => `
                          <button class="script-scene-tab${activeScene?.id === scene.id ? " active" : ""}" type="button" data-action="select-script-scene" data-script-scene-id="${scene.id}">
                            <strong>Scene ${index + 1}</strong>
                            <span>${escapeHtml(scene.title || "Untitled Scene")}</span>
                          </button>
                        `
                      )
                      .join("")}
                  </div>

                  ${
                    activeScene
                      ? `
                        <article class="script-scene-card">
                          <div class="script-scene-header">
                          <div>
                            <strong>${escapeHtml(activeScene.title || "Untitled Scene")}</strong>
                            <span class="panel-status">${escapeHtml(activeScene.status.replace(/_/g, " "))}</span>
                          </div>
                          <div class="script-scene-actions">
                            <button class="ghost-button compact-button" type="button" data-action="add-script-clip" data-script-scene-id="${activeScene.id}">Add Clip</button>
                            <button class="ghost-button compact-button" type="button" data-action="remove-script-scene" data-script-scene-id="${activeScene.id}">Remove</button>
                          </div>
                          </div>

                          <div class="script-scene-grid">
                            <label class="idea-field">
                              <span>Scene Title</span>
                              <input class="idea-input" type="text" value="${escapeHtml(activeScene.title)}" data-script-scene-input="title" data-script-scene-id="${activeScene.id}" placeholder="Scene title" />
                            </label>
                            <label class="idea-field">
                              <span>Slug</span>
                              <input class="idea-input" type="text" value="${escapeHtml(activeScene.slug)}" data-script-scene-input="slug" data-script-scene-id="${activeScene.id}" placeholder="INT. LOCATION - TIME" />
                            </label>
                            <label class="idea-field">
                              <span>Characters In Scene</span>
                              <input class="idea-input" type="text" value="${escapeHtml(Array.isArray(activeScene.characters) ? activeScene.characters.join(", ") : activeScene.characters || "")}" data-script-scene-input="characters" data-script-scene-id="${activeScene.id}" placeholder="Kacey, Wade, Sadie" />
                            </label>
                            <label class="idea-field idea-field-wide">
                              <span>Summary</span>
                              <textarea class="idea-input idea-textarea idea-textarea-compact" data-script-scene-input="summary" data-script-scene-id="${activeScene.id}" placeholder="What happens in this scene?">${escapeHtml(activeScene.summary)}</textarea>
                            </label>
                            <div class="idea-field idea-field-wide script-clips-field">
                              <div class="script-clips-header">
                                <span>Clips</span>
                                <small>${activeScene.clips.length} planned</small>
                              </div>
                              <div class="script-clip-stack">
                                ${
                                  activeScene.clips.length
                                    ? activeScene.clips.map((clip) => `
                                      <article class="script-clip-card">
                                        <div class="script-clip-card-header">
                                          <strong>${escapeHtml(clip.title || "Clip")}</strong>
                                          <button class="ghost-button compact-button" type="button" data-action="remove-script-clip" data-script-scene-id="${activeScene.id}" data-script-clip-id="${clip.id}">Remove</button>
                                        </div>
                                        <div class="script-clip-grid">
                                          <label class="idea-field">
                                            <span>Clip Title</span>
                                            <input class="idea-input" type="text" value="${escapeHtml(clip.title)}" data-script-clip-input="title" data-script-scene-id="${activeScene.id}" data-script-clip-id="${clip.id}" placeholder="Clip title" />
                                          </label>
                                          <label class="idea-field idea-field-wide">
                                            <span>Clip Prompt</span>
                                            <textarea class="idea-input idea-textarea idea-textarea-compact" data-script-clip-input="prompt" data-script-scene-id="${activeScene.id}" data-script-clip-id="${clip.id}" placeholder="What should image and clip generation create for this clip?">${escapeHtml(clip.prompt)}</textarea>
                                          </label>
                                          <label class="idea-field idea-field-wide">
                                            <span>Dialogue / Narration</span>
                                            <textarea class="idea-input idea-textarea idea-textarea-compact" data-script-clip-input="dialogue" data-script-scene-id="${activeScene.id}" data-script-clip-id="${clip.id}" placeholder="Lines, narration, or spoken beats for this clip.">${escapeHtml(clip.dialogue || "")}</textarea>
                                          </label>
                                        </div>
                                      </article>
                                    `).join("")
                                    : '<div class="empty-state">No clips added yet for this scene.</div>'
                                }
                              </div>
                            </div>
                          </div>
                        </article>
                      `
                      : ""
                  }
                </div>
              </section>

              <aside class="script-sidebar">
                <div class="stage-sidebar-section">
                  <div class="panel-header">
                    <h2>Script Health</h2>
                    <span class="panel-status">${completeCount}/${checklist.length}</span>
                  </div>
                  <div class="idea-progress-shell">
                    <div class="idea-progress-fill" style="width:${Math.round((completeCount / checklist.length) * 100)}%"></div>
                  </div>
                  <div class="dashboard-helper">The goal here is a usable production outline, not a screenplay-perfect document.</div>
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
                    <h2>Source Context</h2>
                    <span class="panel-status">Locked</span>
                  </div>
                  <div class="sync-card">
                    <strong>${escapeHtml(pitch.logline || "No logline yet")}</strong>
                    <span>${escapeHtml(pitch.concept || "Project pitch still needs a stronger concept brief.")}</span>
                  </div>
                  <div class="script-context-list">
                    <div class="script-context-card">
                      <span>Characters</span>
                      <strong>${escapeHtml(boardSummary.characters.join(", ") || "None yet")}</strong>
                    </div>
                    <div class="script-context-card">
                      <span>Locations</span>
                      <strong>${escapeHtml(boardSummary.locations.join(", ") || "None yet")}</strong>
                    </div>
                    <div class="script-context-card">
                      <span>Board Scenes</span>
                      <strong>${escapeHtml(boardSummary.scenes.join(", ") || "None yet")}</strong>
                    </div>
                  </div>
                </div>

                <div class="stage-sidebar-section">
                  <div class="panel-header">
                    <h2>Next Stage</h2>
                    <span class="panel-status">Starting Images</span>
                  </div>
                  <div class="sync-card">
                    <strong>Approve anchor frames</strong>
                    <span>Each scene should be clear enough that you can generate one or more starting images from it.</span>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </section>
      `;
    }

    return {
      formatScriptExport,
      renderScriptWorkspace
    };
  }

  globalScope.EditorWorkflowModules = globalScope.EditorWorkflowModules || {};
  globalScope.EditorWorkflowModules.createScriptWorkflowHelpers = createScriptWorkflowHelpers;
})(window);
