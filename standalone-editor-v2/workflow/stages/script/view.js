(function attachV2ScriptStage(globalScope) {
  function renderScene(scene) {
    const confidence = globalScope.CreatorAppV2PipelineIntelligence.getSceneConfidence(scene);
    return `
      <article class="v2-script-scene">
        <div class="v2-script-scene-header">
          <div>
            <div class="v2-card-eyebrow">Scene</div>
            <h3>${scene.title || "Untitled Scene"}</h3>
            <div class="v2-scene-confidence-row">
              <span class="v2-chip v2-chip-confidence v2-chip-confidence-${confidence.level}">${confidence.label} ${confidence.score}%</span>
            </div>
          </div>
          <div class="v2-script-scene-actions">
            <button class="v2-button-ghost v2-button-inline" type="button" data-action="generate-entire-scene" data-script-scene-id="${scene.id}">Generate Entire Scene</button>
            <button class="v2-button-ghost v2-button-inline" type="button" data-action="add-script-clip" data-script-scene-id="${scene.id}">Add Clip</button>
            <button class="v2-button-ghost v2-button-inline" type="button" data-action="remove-script-scene" data-script-scene-id="${scene.id}">Remove Scene</button>
          </div>
        </div>
        <div class="v2-scene-confidence-strip">
          ${confidence.checks.map((check) => `
            <div class="v2-scene-check ${check.complete ? "complete" : ""}">
              <span>${check.label}</span>
              <strong>${check.complete ? "Ready" : "Open"}</strong>
            </div>
          `).join("")}
        </div>
        <div class="v2-script-grid">
          <input class="v2-studio-input" type="text" value="${scene.title}" data-script-field="title" data-script-scene-id="${scene.id}" placeholder="Scene title" />
          <input class="v2-studio-input" type="text" value="${scene.location}" data-script-field="location" data-script-scene-id="${scene.id}" placeholder="Location" />
          <input class="v2-studio-input" type="text" value="${scene.timeOfDay}" data-script-field="timeOfDay" data-script-scene-id="${scene.id}" placeholder="Time of day" />
          <input class="v2-studio-input" type="text" value="${scene.characters.join(", ")}" data-script-field="characters" data-script-scene-id="${scene.id}" placeholder="Characters in scene" />
          <input class="v2-studio-input" type="text" value="${scene.mood.join(", ")}" data-script-field="mood" data-script-scene-id="${scene.id}" placeholder="Mood tags" />
          <input class="v2-studio-input" type="text" value="${scene.objective}" data-script-field="objective" data-script-scene-id="${scene.id}" placeholder="Scene objective" />
          <textarea class="v2-studio-input v2-textarea" data-script-field="summary" data-script-scene-id="${scene.id}" placeholder="Scene summary">${scene.summary}</textarea>
        </div>
        <div class="v2-script-clips">
          ${scene.clips.map((clip) => `
            <section class="v2-script-clip">
              <div class="v2-script-clip-header">
                <div class="v2-script-clip-title">
                  <strong>${clip.title || "Clip"}</strong>
                  <div class="v2-script-clip-signals">
                    ${clip.shotRole ? `<span class="v2-chip">${clip.shotRole}</span>` : ""}
                    ${clip.planningSource ? `<span class="v2-chip">${clip.planningSource}</span>` : ""}
                  </div>
                </div>
                <button class="v2-button-ghost v2-button-inline" type="button" data-action="remove-script-clip" data-script-scene-id="${scene.id}" data-script-clip-id="${clip.id}">Remove Clip</button>
              </div>
              <div class="v2-script-grid">
                <input class="v2-studio-input" type="text" value="${clip.title}" data-script-clip-field="title" data-script-scene-id="${scene.id}" data-script-clip-id="${clip.id}" placeholder="Clip title" />
                <textarea class="v2-studio-input v2-textarea" data-script-clip-field="prompt" data-script-scene-id="${scene.id}" data-script-clip-id="${clip.id}" placeholder="Clip prompt">${clip.prompt}</textarea>
                <textarea class="v2-studio-input v2-textarea" data-script-clip-field="dialogue" data-script-scene-id="${scene.id}" data-script-clip-id="${clip.id}" placeholder="Dialogue or narration">${clip.dialogue}</textarea>
                <textarea class="v2-studio-input v2-textarea" data-script-clip-field="shotNotes" data-script-scene-id="${scene.id}" data-script-clip-id="${clip.id}" placeholder="Shot and motion notes">${clip.shotNotes}</textarea>
              </div>
            </section>
          `).join("")}
        </div>
      </article>
    `;
  }

  function renderScriptStage(stage, state) {
    const activeProject = state?.projectWorkspace?.activeProject;
    const pitchDraft = state?.projectWorkspace?.pitch?.draft || null;
    const script = globalScope.CreatorAppV2ScriptState.getScriptDraft({ getState: () => state });
    const sceneCount = script.scenes.length;
    const clipCount = script.scenes.reduce((total, scene) => total + scene.clips.length, 0);
    const confidenceScores = script.scenes.map((scene) => globalScope.CreatorAppV2PipelineIntelligence.getSceneConfidence(scene));
    const averageConfidence = confidenceScores.length
      ? Math.round(confidenceScores.reduce((total, entry) => total + entry.score, 0) / confidenceScores.length)
      : 0;
    const readyScenes = confidenceScores.filter((entry) => entry.level === "green").length;

    if (!activeProject) {
      return `
        <div class="v2-stage-header">
          <div>
            <div class="v2-eyebrow">Step 3</div>
            <h2>${stage.label}</h2>
            <p>${stage.summary}</p>
          </div>
          <button class="v2-button" type="button" data-action="open-dashboard">Open Dashboard</button>
        </div>
        <div class="v2-stage-body">
          <div class="v2-note">Open a project first. Script state should be built from real project and pitch context, not in an empty editor shell.</div>
        </div>
      `;
    }

    return `
      <div class="v2-stage-header">
        <div>
          <div class="v2-eyebrow">Step 3</div>
          <h2>${stage.label}</h2>
          <p>${stage.summary}</p>
        </div>
        <div class="v2-topbar-actions">
          <button class="v2-button" type="button" data-action="apply-script-draft">Apply Script</button>
          <button class="v2-button-ghost" type="button" data-action="add-script-scene">Add Scene</button>
          <button class="v2-button-ghost" type="button" data-stage-id="starting_images">Advance to Starting Images</button>
        </div>
      </div>
      <div class="v2-stage-body">
        <div class="v2-card-grid v2-card-grid-dashboard">
          <article class="v2-card v2-feature-card">
            <div class="v2-card-eyebrow">Current Project</div>
            <h3>${activeProject.title}</h3>
            <p>Script is where the project becomes real scene and clip structure that AI generation and edit can inherit without ambiguity.</p>
          </article>
          <article class="v2-card v2-feature-card">
            <div class="v2-card-eyebrow">Pitch Handoff</div>
            <h3>${pitchDraft?.logline || "No logline applied yet"}</h3>
            <p>${pitchDraft?.concept || "Apply the pitch draft first so script generation starts from a coherent concept brief."}</p>
          </article>
        </div>
        <div class="v2-card-grid v2-card-grid-metrics">
          <article class="v2-card v2-metric-card">
            <div class="v2-card-eyebrow">Scenes</div>
            <h3>${sceneCount}</h3>
            <p>Scene structure defines narrative units for the rest of the creator pipeline.</p>
          </article>
          <article class="v2-card v2-metric-card">
            <div class="v2-card-eyebrow">Clip Slots</div>
            <h3>${clipCount}</h3>
            <p>Clip slots are the direct generation targets for starting images, clips, and rough cut assembly.</p>
          </article>
          <article class="v2-card v2-metric-card">
            <div class="v2-card-eyebrow">Scene Confidence</div>
            <h3>${averageConfidence}%</h3>
            <p>Measures visual clarity, continuity strength, and generation readiness across the script.</p>
          </article>
          <article class="v2-card v2-metric-card">
            <div class="v2-card-eyebrow">Ready Scenes</div>
            <h3>${readyScenes}/${sceneCount}</h3>
            <p>Scenes with strong enough context to drive reliable AI generation and shot planning.</p>
          </article>
        </div>
        <section class="v2-script-stack">
          ${script.scenes.map((scene) => renderScene(scene)).join("")}
        </section>
        <div class="v2-note">${stage.foundation}</div>
      </div>
    `;
  }

  globalScope.CreatorAppV2Stages = globalScope.CreatorAppV2Stages || {};
  globalScope.CreatorAppV2Stages.renderScriptStage = renderScriptStage;
})(window);
