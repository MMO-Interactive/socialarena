(function attachEditorStudioViewModules(globalScope) {
  function createStudioViewHelpers(deps) {
    const {
      state,
      studioSummary,
      getBoardCardsByCategory,
      getWorkflowStage,
      assetClass,
      renderAssetThumbnail,
      formatAssetMeta,
      escapeHtml
    } = deps;

    function renderStudioEntityList(title, items, emptyCopy) {
      return `
        <section class="studio-shell">
          <div class="studio-hero panel">
            <div>
              <div class="eyebrow">Studio</div>
              <h2>${escapeHtml(title)}</h2>
            </div>
          </div>
          <section class="studio-grid studio-grid-single">
            <article class="panel studio-panel">
              <div class="panel-header">
                <h2>${escapeHtml(title)}</h2>
                <span class="panel-status">${items.length}</span>
              </div>
              <div class="studio-card-list">
                ${
                  items.length
                    ? items.map((item) => `
                      <div class="studio-info-card">
                        <strong>${escapeHtml(item.title)}</strong>
                        <span>${escapeHtml(item.subtitle || "")}</span>
                        <small>${escapeHtml(item.meta || "")}</small>
                      </div>
                    `).join("")
                    : `<div class="empty-state">${escapeHtml(emptyCopy)}</div>`
                }
              </div>
            </article>
          </section>
        </section>
      `;
    }

    function renderStudioStoryBoard(project) {
      const groups = [
        { label: "Virtual Cast", cards: getBoardCardsByCategory(project, "character") },
        { label: "Locations", cards: getBoardCardsByCategory(project, "location") },
        { label: "Scenes", cards: getBoardCardsByCategory(project, "scene") },
        { label: "Clips", cards: getBoardCardsByCategory(project, "clip") },
        { label: "Production", cards: (project.ideaBoard?.cards || []).filter((card) => ["camera", "lighting", "vfx", "prop", "wardrobe", "audio", "dialogue", "beat", "style", "style_selector", "note", "image", "link"].includes(card.category)) }
      ];

      return `
        <section class="studio-shell">
          <div class="studio-hero panel">
            <div>
              <div class="eyebrow">Studio</div>
              <h2>Story Board</h2>
              <p class="dashboard-copy">A board-level overview of the active project's creative nodes.</p>
            </div>
            <div class="dashboard-hero-actions">
              <button class="accent-button" type="button" data-action="jump-stage" data-stage-id="idea_board">Open Idea Board</button>
              <button class="ghost-button" type="button" data-action="open-editor">Editor</button>
            </div>
          </div>
          <section class="studio-grid">
            ${groups.map((group) => `
              <article class="panel studio-panel">
                <div class="panel-header">
                  <h2>${escapeHtml(group.label)}</h2>
                  <span class="panel-status">${group.cards.length}</span>
                </div>
                <div class="studio-card-list">
                  ${
                    group.cards.length
                      ? group.cards.map((card) => `
                        <div class="studio-info-card">
                          <strong>${escapeHtml(card.title || group.label)}</strong>
                          <span>${escapeHtml(card.description || "No description yet")}</span>
                        </div>
                      `).join("")
                      : '<div class="empty-state">No entries yet.</div>'
                  }
                </div>
              </article>
            `).join("")}
          </section>
        </section>
      `;
    }

    function renderStudioScenePlanner(project) {
      const scenes = Array.isArray(project?.script?.scenes) ? project.script.scenes : [];
      return `
        <section class="studio-shell">
          <div class="studio-hero panel">
            <div>
              <div class="eyebrow">Studio</div>
              <h2>Scene Planner</h2>
              <p class="dashboard-copy">Scene-by-scene planning pulled directly from the current script document.</p>
            </div>
            <div class="dashboard-hero-actions">
              <button class="accent-button" type="button" data-action="jump-stage" data-stage-id="script">Open Script Stage</button>
            </div>
          </div>
          <section class="studio-grid studio-grid-single">
            <article class="panel studio-panel">
              <div class="panel-header">
                <h2>Scenes</h2>
                <span class="panel-status">${scenes.length}</span>
              </div>
              <div class="studio-scene-list">
                ${
                  scenes.length
                    ? scenes.map((scene, index) => `
                      <div class="studio-scene-card">
                        <div class="studio-scene-index">Scene ${index + 1}</div>
                        <strong>${escapeHtml(scene.title || `Scene ${index + 1}`)}</strong>
                        <span>${escapeHtml(scene.slug || "No slug set")}</span>
                        <p>${escapeHtml(scene.summary || "No summary yet")}</p>
                        <small>${escapeHtml(scene.clipPrompt || "No clip prompt yet")}</small>
                      </div>
                    `).join("")
                    : '<div class="empty-state">No scenes created yet.</div>'
                }
              </div>
            </article>
          </section>
        </section>
      `;
    }

    function renderStudioClipComposer(project) {
      const scenes = Array.isArray(project?.videoClips?.scenes) ? project.videoClips.scenes : [];
      const generatedAssets = (project.assets || []).filter((asset) => asset.kind === "video");
      return `
        <section class="studio-shell">
          <div class="studio-hero panel">
            <div>
              <div class="eyebrow">Studio</div>
              <h2>Clip Composer</h2>
              <p class="dashboard-copy">Track approved anchor frames, clip prompts, and generated clips before assembling the edit.</p>
            </div>
            <div class="dashboard-hero-actions">
              <button class="accent-button" type="button" data-action="jump-stage" data-stage-id="video_clips">Open Video Clips</button>
              <button class="ghost-button" type="button" data-action="open-editor">Open Editor</button>
            </div>
          </div>
          <section class="studio-grid studio-grid-two">
            <article class="panel studio-panel">
              <div class="panel-header">
                <h2>Clip Requests</h2>
                <span class="panel-status">${scenes.length}</span>
              </div>
              <div class="studio-card-list">
                ${
                  scenes.length
                    ? scenes.map((scene) => `
                      <div class="studio-info-card">
                        <strong>${escapeHtml(scene.title)}</strong>
                        <span>${escapeHtml(scene.status || "not_ready")}</span>
                        <small>${scene.generatedClips.length} generated clip${scene.generatedClips.length === 1 ? "" : "s"}</small>
                      </div>
                    `).join("")
                    : '<div class="empty-state">No clip requests yet.</div>'
                }
              </div>
            </article>
            <article class="panel studio-panel">
              <div class="panel-header">
                <h2>Generated Clip Assets</h2>
                <span class="panel-status">${generatedAssets.length}</span>
              </div>
              <div class="studio-asset-grid">
                ${
                  generatedAssets.length
                    ? generatedAssets.map((asset) => `
                      <button class="${assetClass(asset.kind)}" type="button" data-asset-id="${asset.id}">
                        <div class="asset-thumb">${renderAssetThumbnail(asset)}</div>
                        <span>${escapeHtml(asset.name)}</span>
                        <small>${formatAssetMeta(asset)}</small>
                      </button>
                    `).join("")
                    : '<div class="empty-state">No generated clip assets yet.</div>'
                }
              </div>
            </article>
          </section>
        </section>
      `;
    }

    function renderStudioStudios() {
      const studios = studioSummary();
      return renderStudioEntityList(
        "Studios",
        studios.map((studio) => ({
          title: studio.name,
          subtitle: studio.role,
          meta: `${studio.projectCount} project${studio.projectCount === 1 ? "" : "s"}`
        })),
        "No studios connected."
      );
    }

    function renderStudioBoardEntityView(project, title, category, emptyCopy) {
      return renderStudioEntityList(
        title,
        getBoardCardsByCategory(project, category).map((card) => ({
          title: card.title || `Untitled ${title.toLowerCase().slice(0, -1)}`,
          subtitle: "Idea Board",
          meta: card.description || ""
        })),
        emptyCopy
      );
    }

    return {
      getBoardCardsByCategory,
      renderStudioEntityList,
      renderStudioStoryBoard,
      renderStudioScenePlanner,
      renderStudioClipComposer,
      renderStudioStudios,
      renderStudioBoardEntityView
    };
  }

  globalScope.EditorStudioModules = globalScope.EditorStudioModules || {};
  globalScope.EditorStudioModules.createStudioViewHelpers = createStudioViewHelpers;
})(window);
