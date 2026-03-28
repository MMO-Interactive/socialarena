(function attachV2StartingImagesStage(globalScope) {
  function renderVariationCard(scene, variation) {
    return `
      <article class="v2-starting-image-card ${scene.approvedVariationId === variation.id ? "approved" : ""}">
        <div class="v2-starting-image-thumb">
          ${variation.imageUrl ? `<img src="${variation.imageUrl}" alt="${scene.title}" />` : `<div class="v2-note">No image yet</div>`}
        </div>
        <div class="v2-starting-image-copy">
          <strong>${variation.label}</strong>
          <span>${variation.source}</span>
        </div>
        <button class="v2-button-ghost v2-button-inline" type="button" data-action="approve-starting-image-variation" data-starting-image-scene-id="${scene.id}" data-starting-image-variation-id="${variation.id}">
          ${scene.approvedVariationId === variation.id ? "Approved" : "Approve"}
        </button>
      </article>
    `;
  }

  function renderStartingImagesStage(stage, state) {
    const activeProject = state?.projectWorkspace?.activeProject;
    const stageState = state?.projectWorkspace?.startingImages || {};
    const draft = globalScope.CreatorAppV2StartingImagesState.getStartingImagesDraft({ getState: () => state });
    const activeScene = globalScope.CreatorAppV2StartingImagesState.getSelectedStartingImageScene({ getState: () => state });
    const checklist = globalScope.CreatorAppV2StartingImagesState.getStartingImagesChecklist({ getState: () => state });
    const completeCount = checklist.filter((item) => item.complete).length;

    if (!activeProject) {
      return `
        <div class="v2-stage-header">
          <div>
            <div class="v2-eyebrow">Step 4</div>
            <h2>${stage.label}</h2>
            <p>${stage.summary}</p>
          </div>
          <button class="v2-button" type="button" data-action="open-dashboard">Open Dashboard</button>
        </div>
        <div class="v2-stage-body">
          <div class="v2-note">Open a project first. Starting image generation should always inherit scene and clip-slot structure from the script stage.</div>
        </div>
      `;
    }

    return `
      <div class="v2-stage-header">
        <div>
          <div class="v2-eyebrow">Step 4</div>
          <h2>${stage.label}</h2>
          <p>${stage.summary}</p>
        </div>
        <div class="v2-topbar-actions">
          <button class="v2-button" type="button" data-action="apply-starting-images">Apply Image Plan</button>
          <button class="v2-button-ghost" type="button" data-action="generate-starting-image" ${activeScene ? `data-starting-image-scene-id="${activeScene.id}"` : "disabled"}>Generate</button>
          <button class="v2-button-ghost" type="button" data-action="refresh-starting-image" ${activeScene?.boardItemId ? `data-starting-image-scene-id="${activeScene.id}"` : "disabled"}>Refresh</button>
          <button class="v2-button-ghost" type="button" data-stage-id="clip_generation">Advance to Clip Generation</button>
        </div>
      </div>
      <div class="v2-stage-body">
        <div class="v2-card-grid v2-card-grid-dashboard">
          <article class="v2-card v2-feature-card">
            <div class="v2-card-eyebrow">Project</div>
            <h3>${activeProject.title}</h3>
            <p>Approved starting images are the visual seed that the clip generation stage depends on.</p>
          </article>
          <article class="v2-card v2-feature-card">
            <div class="v2-card-eyebrow">Image Health</div>
            <h3>${completeCount}/${checklist.length}</h3>
            <p>${stageState.dirty ? "Image prompts changed and need to be applied." : "Image plan is synchronized into stage state."}</p>
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
        ${stageState.error ? `<div class="v2-note v2-note-error">${stageState.error}</div>` : ""}
        ${stageState.loading ? `<div class="v2-note">Working with the generation pipeline...</div>` : ""}
        <div class="v2-starting-images-layout">
          <aside class="v2-starting-scene-list">
            ${draft.scenes.map((scene) => `
              <button class="v2-starting-scene-tab ${activeScene?.id === scene.id ? "active" : ""}" type="button" data-action="select-starting-image-scene" data-starting-image-scene-id="${scene.id}">
                <strong>${scene.title}</strong>
                <span>${scene.status}</span>
              </button>
            `).join("")}
          </aside>
          <section class="v2-starting-scene-editor">
            ${
              activeScene
                ? `
                  <div class="v2-script-scene-header">
                    <div>
                      <div class="v2-card-eyebrow">Selected Scene</div>
                      <h3>${activeScene.title}</h3>
                    </div>
                    <div class="v2-script-scene-actions">
                      <button class="v2-button-ghost v2-button-inline" type="button" data-action="generate-starting-image" data-starting-image-scene-id="${activeScene.id}">Generate Draft</button>
                      <button class="v2-button-ghost v2-button-inline" type="button" data-action="refresh-starting-image" data-starting-image-scene-id="${activeScene.id}" ${activeScene.boardItemId ? "" : "disabled"}>Refresh</button>
                    </div>
                  </div>
                  <div class="v2-script-grid">
                    <textarea class="v2-studio-input v2-textarea" data-starting-image-field="prompt" data-starting-image-scene-id="${activeScene.id}" placeholder="Describe the anchor frame this scene needs.">${activeScene.prompt}</textarea>
                    <textarea class="v2-studio-input v2-textarea" data-starting-image-field="shotNotes" data-starting-image-scene-id="${activeScene.id}" placeholder="Lens, framing, mood, visual notes, and continuity guidance.">${activeScene.shotNotes}</textarea>
                  </div>
                  <div class="v2-board-grid">
                    ${
                      activeScene.variations.length
                        ? activeScene.variations.map((variation) => renderVariationCard(activeScene, variation)).join("")
                        : `<div class="v2-note">No variations yet. Generate or refresh this scene to pull image results back in.</div>`
                    }
                  </div>
                `
                : `<div class="v2-note">No script scenes are available yet. Build script structure first.</div>`
            }
          </section>
        </div>
        <div class="v2-note">${stage.foundation}</div>
      </div>
    `;
  }

  globalScope.CreatorAppV2Stages = globalScope.CreatorAppV2Stages || {};
  globalScope.CreatorAppV2Stages.renderStartingImagesStage = renderStartingImagesStage;
})(window);
