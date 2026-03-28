(function attachEditorWorkflowIdeaBoardModules(globalScope) {
  function createIdeaBoardWorkflowHelpers(deps) {
    const {
      state,
      IDEA_BOARD_CATEGORIES,
      createIdeaBoardState,
      escapeHtml
    } = deps;

    function ideaBoardChecklist(project) {
      const cards = Array.isArray(project?.ideaBoard?.cards) ? project.ideaBoard.cards : [];
      const hasCategory = (categoryId) => cards.some((card) => card.category === categoryId && (card.title.trim() || card.description.trim()));

      return [
        { label: "Character", complete: hasCategory("character") },
        { label: "Location", complete: hasCategory("location") },
        { label: "Scene", complete: hasCategory("scene") },
        { label: "Clip", complete: hasCategory("clip") },
        { label: "Visual production", complete: hasCategory("camera") || hasCategory("lighting") || hasCategory("vfx") },
        { label: "Audio direction", complete: hasCategory("audio") || hasCategory("dialogue") || hasCategory("beat") }
      ];
    }

    function parseIdeaCardContent(card) {
      if (!card?.description) {
        return {};
      }

      try {
        const parsed = JSON.parse(card.description);
        return parsed && typeof parsed === "object" ? parsed : {};
      } catch (error) {
        return {};
      }
    }

    function renderNodeField(label, inputHtml) {
      return `
        <label class="idea-node-field">
          <span>${escapeHtml(label)}</span>
          ${inputHtml}
        </label>
      `;
    }

    function renderIdeaNodeBody(card) {
      const parsed = parseIdeaCardContent(card);

      if (card.category === "camera") {
        const options = {
          shot: ["", "Extreme Close-Up", "Close-Up", "Medium Close-Up", "Medium Shot", "Medium Long Shot", "Long Shot", "Wide Shot", "Extreme Wide"],
          angle: ["", "Eye Level", "Low Angle", "High Angle", "Over-the-Shoulder", "Bird's Eye", "Dutch Angle"],
          lens: ["", "14mm Ultra Wide", "24mm Wide", "35mm", "50mm", "85mm Portrait", "135mm Tele"],
          move: ["", "Static", "Pan", "Tilt", "Dolly In", "Dolly Out", "Tracking", "Handheld"],
          framing: ["", "Centered", "Rule of Thirds", "Negative Space", "Symmetrical"]
        };

        return `
          <div class="idea-node-grid">
            ${Object.entries(options)
              .map(([key, values]) =>
                renderNodeField(
                  key.charAt(0).toUpperCase() + key.slice(1),
                  `<select class="idea-input" data-idea-structured-input="${key}" data-idea-card-id="${card.id}">
                    ${values.map((value) => `<option value="${escapeHtml(value)}" ${parsed[key] === value ? "selected" : ""}>${escapeHtml(value || "-")}</option>`).join("")}
                  </select>`
                )
              )
              .join("")}
          </div>
        `;
      }

      if (card.category === "style_selector") {
        const options = {
          style: ["", "Photoreal", "Cinematic", "Illustration", "Anime", "Concept Art", "Painterly"],
          medium: ["", "Digital", "Oil Paint", "Watercolor", "3D Render", "Sketch"],
          palette: ["", "Warm", "Cool", "Muted", "Vibrant", "Monochrome"],
          mood: ["", "Moody", "Bright", "Dreamy", "Gritty", "Epic"]
        };

        return `
          <div class="idea-node-grid">
            ${Object.entries(options)
              .map(([key, values]) =>
                renderNodeField(
                  key.charAt(0).toUpperCase() + key.slice(1),
                  `<select class="idea-input" data-idea-structured-input="${key}" data-idea-card-id="${card.id}">
                    ${values.map((value) => `<option value="${escapeHtml(value)}" ${parsed[key] === value ? "selected" : ""}>${escapeHtml(value || "-")}</option>`).join("")}
                  </select>`
                )
              )
              .join("")}
          </div>
        `;
      }

      if (card.category === "lighting" || card.category === "vfx") {
        return `
          <div class="idea-node-grid">
            ${renderNodeField("Setup", `<input class="idea-input" type="text" value="${escapeHtml(parsed.setup || "")}" data-idea-structured-input="setup" data-idea-card-id="${card.id}" placeholder="Primary ${card.category} setup" />`)}
            ${renderNodeField("Notes", `<textarea class="idea-input idea-textarea idea-card-textarea" data-idea-structured-input="notes" data-idea-card-id="${card.id}" placeholder="Describe the ${card.category} direction.">${escapeHtml(parsed.notes || "")}</textarea>`)}
          </div>
        `;
      }

      if (card.category === "audio") {
        return `
          <div class="idea-node-grid">
            ${renderNodeField("Audio URL", `<input class="idea-input" type="text" value="${escapeHtml(card.linkUrl || "")}" data-idea-link-input="linkUrl" data-idea-card-id="${card.id}" placeholder="https://..." />`)}
            ${card.linkUrl ? `<audio class="idea-node-audio" controls src="${escapeHtml(card.linkUrl)}"></audio>` : '<div class="idea-node-links">No audio file linked yet</div>'}
          </div>
        `;
      }

      if (card.category === "image") {
        return `
          <div class="idea-node-grid">
            ${renderNodeField("Image URL", `<input class="idea-input" type="text" value="${escapeHtml(card.imageUrl || "")}" data-idea-media-input="imageUrl" data-idea-card-id="${card.id}" placeholder="https://..." />`)}
            ${card.imageUrl ? `<img class="idea-node-image" src="${escapeHtml(card.imageUrl)}" alt="${escapeHtml(card.title || "Image node")}" />` : '<div class="idea-node-links">No image URL set yet</div>'}
          </div>
        `;
      }

      if (card.category === "link") {
        return `
          <div class="idea-node-grid">
            ${renderNodeField("Link URL", `<input class="idea-input" type="text" value="${escapeHtml(card.linkUrl || "")}" data-idea-link-input="linkUrl" data-idea-card-id="${card.id}" placeholder="https://..." />`)}
            ${card.linkUrl ? `<a class="idea-node-anchor" href="${escapeHtml(card.linkUrl)}" target="_blank" rel="noreferrer">Open linked reference</a>` : '<div class="idea-node-links">No link URL set yet</div>'}
          </div>
        `;
      }

      if (["character", "location", "scene"].includes(card.category)) {
        return `
          <div class="idea-node-grid">
            ${card.generatedImageUrl ? `<img class="idea-node-image" src="${escapeHtml(card.generatedImageUrl)}" alt="${escapeHtml(card.title || card.category)}" />` : ""}
            <textarea class="idea-input idea-textarea idea-card-textarea" data-idea-card-input="description" data-idea-card-id="${card.id}" placeholder="Describe the concept, influence, or prompt seed.">${escapeHtml(card.description)}</textarea>
            <div class="idea-node-button-row">
              <button class="ghost-button compact-button" type="button" data-action="preview-idea-prompt" data-idea-card-id="${card.id}">Preview Prompt</button>
              <button class="accent-button compact-button" type="button" data-action="generate-idea-card" data-idea-card-id="${card.id}">${card.generationStatus === "failed" ? "Retry" : card.generatedImageUrl ? "Regenerate" : "Generate"}</button>
              <button class="ghost-button compact-button" type="button" data-action="refresh-idea-card" data-idea-card-id="${card.id}">Refresh</button>
              <button class="ghost-button compact-button" type="button" data-action="open-idea-history" data-idea-card-id="${card.id}">History</button>
            </div>
          </div>
        `;
      }

      if (card.category === "clip") {
        return `
          <div class="idea-node-grid">
            ${card.generatedImageUrl ? `<video class="idea-node-video" src="${escapeHtml(card.generatedImageUrl)}" controls></video>` : card.linkUrl ? `<img class="idea-node-image" src="${escapeHtml(card.linkUrl)}" alt="${escapeHtml(card.title || card.category)}" />` : ""}
            <textarea class="idea-input idea-textarea idea-card-textarea" data-idea-card-input="description" data-idea-card-id="${card.id}" placeholder="Describe the clip intent, motion, and notes.">${escapeHtml(card.description)}</textarea>
            <div class="idea-node-button-row">
              <button class="ghost-button compact-button" type="button" data-action="preview-idea-clip" data-idea-card-id="${card.id}">Preview Prompt</button>
              <button class="accent-button compact-button" type="button" data-action="generate-idea-clip" data-idea-card-id="${card.id}">${card.generationStatus === "failed" ? "Retry Clip" : card.generatedImageUrl ? "Regenerate Clip" : "Generate Clip"}</button>
              <button class="ghost-button compact-button" type="button" data-action="refresh-idea-card" data-idea-card-id="${card.id}">Refresh</button>
              <button class="ghost-button compact-button" type="button" data-action="open-idea-history" data-idea-card-id="${card.id}">History</button>
            </div>
          </div>
        `;
      }

      return `<textarea class="idea-input idea-textarea idea-card-textarea" data-idea-card-input="description" data-idea-card-id="${card.id}" placeholder="Describe the concept, influence, or prompt seed.">${escapeHtml(card.description)}</textarea>`;
    }

    function renderIdeaNode(card) {
      const category = IDEA_BOARD_CATEGORIES.find((entry) => entry.id === card.category);
      const isLinkSource = state.linkingIdeaCardId === card.id;

      return `
        <article class="idea-node${state.revealIdeaCardId === card.id ? " reveal" : ""}${isLinkSource ? " linking" : ""}" data-idea-node="${card.id}" data-idea-node-target="${card.id}" style="left:${card.x}px; top:${card.y}px;">
          <div class="idea-node-actions">
            <span class="panel-status">${escapeHtml(card.status)}</span>
            <div class="idea-node-actions-inline">
              <button class="ghost-button compact-button" type="button" data-action="start-idea-link" data-idea-card-id="${card.id}">${isLinkSource ? "Linking..." : "Connect"}</button>
              <button class="idea-node-handle" type="button" data-idea-node-handle="${card.id}">Move</button>
              <button class="ghost-button compact-button" type="button" data-action="remove-idea-card" data-idea-card-id="${card.id}">Remove</button>
            </div>
          </div>
          <div class="idea-node-category">${escapeHtml(category?.label || "Idea Node")}</div>
          <input class="idea-input" type="text" value="${escapeHtml(card.title)}" data-idea-card-input="title" data-idea-card-id="${card.id}" placeholder="${escapeHtml(category?.label || "Node")} title" data-idea-card-title="${card.id}" />
          ${renderIdeaNodeBody(card)}
          ${
            Array.isArray(card.influencedBy) && card.influencedBy.length
              ? `<div class="idea-node-links">Linked from ${card.influencedBy.length} node${card.influencedBy.length === 1 ? "" : "s"}</div>`
              : ""
          }
        </article>
      `;
    }

    function renderIdeaBoardWorkspace(project) {
      const ideaBoard = createIdeaBoardState(project.ideaBoard || {});
      const coreCategories = IDEA_BOARD_CATEGORIES.filter((entry) => entry.group === "core");
      const storyCategories = IDEA_BOARD_CATEGORIES.filter((entry) => entry.group === "story");
      const productionCategories = IDEA_BOARD_CATEGORIES.filter((entry) => entry.group === "production");
      const checklist = ideaBoardChecklist(project);
      const completeCount = checklist.filter((item) => item.complete).length;
      const cardMap = new Map(ideaBoard.cards.map((card) => [card.id, card]));
      const ideaLines = ideaBoard.cards.flatMap((card) =>
        (card.influencedBy || [])
          .map((sourceId) => {
            const source = cardMap.get(sourceId);
            if (!source) {
              return "";
            }
            return `
              <line
                class="idea-link-line"
                x1="${source.x + 150}"
                y1="${source.y + 90}"
                x2="${card.x + 150}"
                y2="${card.y + 90}"
              ></line>
            `;
          })
          .filter(Boolean)
      );

      return `
        <section class="workflow-stage-shell">
          <section class="panel idea-board-panel">
            <div class="idea-board-header">
              <div class="panel-header">
                <div>
                  <h2>Idea Board</h2>
                  <div class="dashboard-helper">
                    ${
                      state.linkingIdeaCardId
                        ? `Connecting from a selected node. Click another node to create the link, or press Esc to cancel.`
                        : `Build the project as connected creative nodes before pitching it. Right click the canvas to add nodes.`
                    }
                  </div>
                </div>
                <div class="workflow-panel-actions">
                  <button class="ghost-button compact-button" type="button" data-action="save-idea-board">Save Idea Board</button>
                  <button class="accent-button compact-button" type="button" data-action="next-stage">Continue to Project Pitch</button>
                </div>
              </div>
            </div>

            <div class="idea-canvas-shell" data-idea-canvas-shell>
              <div class="idea-canvas">
                <svg class="idea-links" viewBox="0 0 2600 1800" preserveAspectRatio="none" aria-hidden="true">
                  ${ideaLines.join("")}
                </svg>
                ${ideaBoard.cards.map((card) => renderIdeaNode(card)).join("")}
              </div>
              ${
                state.ideaContextMenu.open
                  ? `
                    <div class="idea-context-menu" style="left:${state.ideaContextMenu.x}px; top:${state.ideaContextMenu.y}px;" data-idea-context-menu>
                      <div class="idea-context-group">
                        <button class="idea-context-parent" type="button">
                          Core
                          <span>Add core node</span>
                        </button>
                        <div class="idea-context-submenu">
                          ${coreCategories
                            .map(
                              (category) => `<button class="idea-context-item" type="button" data-action="add-idea-card" data-idea-category="${category.id}">${escapeHtml(category.quickLabel)}</button>`
                            )
                            .join("")}
                        </div>
                      </div>
                      <div class="idea-context-group">
                        <button class="idea-context-parent" type="button">
                          Story
                          <span>Add story node</span>
                        </button>
                        <div class="idea-context-submenu">
                          ${storyCategories
                            .map(
                              (category) => `<button class="idea-context-item" type="button" data-action="add-idea-card" data-idea-category="${category.id}">${escapeHtml(category.quickLabel)}</button>`
                            )
                            .join("")}
                        </div>
                      </div>
                      <div class="idea-context-group">
                        <button class="idea-context-parent" type="button">
                          Production
                          <span>Add production node</span>
                        </button>
                        <div class="idea-context-submenu">
                          ${productionCategories
                            .map(
                              (category) => `<button class="idea-context-item" type="button" data-action="add-idea-card" data-idea-category="${category.id}">${escapeHtml(category.quickLabel)}</button>`
                            )
                            .join("")}
                        </div>
                      </div>
                    </div>
                  `
                  : ""
              }
            </div>
          </section>

          <aside class="panel stage-sidebar">
            <div class="stage-sidebar-section">
              <div class="panel-header">
                <h2>Idea Health</h2>
                <span class="panel-status">${completeCount}/${checklist.length}</span>
              </div>
              <div class="idea-progress-shell">
                <div class="idea-progress-fill" style="width:${Math.round((completeCount / checklist.length) * 100)}%"></div>
              </div>
              <div class="dashboard-helper">Build enough board context to pitch the project cleanly in the next stage.</div>
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
                <h2>Next Stage</h2>
                <span class="panel-status">Project Pitch</span>
              </div>
              <div class="sync-card">
                <strong>Turn the board into a pitch</strong>
                <span>Summarize the strongest board ideas into a tight brief before moving into script.</span>
              </div>
            </div>
          </aside>
        </section>
      `;
    }

    return {
      ideaBoardChecklist,
      parseIdeaCardContent,
      renderNodeField,
      renderIdeaNodeBody,
      renderIdeaNode,
      renderIdeaBoardWorkspace
    };
  }

  globalScope.EditorWorkflowModules = globalScope.EditorWorkflowModules || {};
  globalScope.EditorWorkflowModules.createIdeaBoardWorkflowHelpers = createIdeaBoardWorkflowHelpers;
})(window);
