(function attachV2IdeaBoardStage(globalScope) {
  function renderIdeaBoardCards(cards) {
    if (!cards.length) {
      return `<div class="v2-note">No idea board items yet. Start by adding characters, locations, scene seeds, or style notes.</div>`;
    }

    return `
      <div class="v2-board-grid">
        ${cards.map((card) => `
          <article class="v2-board-card">
            <div class="v2-card-eyebrow">${card.category}</div>
            <h3>${card.title || "Untitled Board Item"}</h3>
            <p>${card.description || "No description yet."}</p>
          </article>
        `).join("")}
      </div>
    `;
  }

  function renderIdeaBoardStage(stage, state) {
    const projectWorkspace = state?.projectWorkspace || {};
    const activeProject = projectWorkspace.activeProject;
    const ideaBoard = projectWorkspace.ideaBoard || {};
    const cards = Array.isArray(ideaBoard.board?.cards) ? ideaBoard.board.cards : [];

    if (!activeProject) {
      return `
        <div class="v2-stage-header">
          <div>
            <div class="v2-eyebrow">Step 1</div>
            <h2>${stage.label}</h2>
            <p>${stage.summary}</p>
          </div>
          <button class="v2-button" type="button" data-action="open-dashboard">Open Dashboard</button>
        </div>
        <div class="v2-stage-body">
          <div class="v2-card-grid">
            <article class="v2-card v2-feature-card">
              <h3>No Active Project</h3>
              <p>Select or create a studio project from the dashboard before authoring idea-board context in the creator workflow.</p>
            </article>
            <article class="v2-card v2-feature-card">
              <h3>Why Project Context Matters</h3>
              <p>The board is not a loose scratchpad. It is a studio-scoped project foundation that should flow directly into pitch, script, generation, and edit.</p>
            </article>
          </div>
          <div class="v2-note">${stage.foundation}</div>
        </div>
      `;
    }

    return `
      <div class="v2-stage-header">
        <div>
          <div class="v2-eyebrow">Step 1</div>
          <h2>${stage.label}</h2>
          <p>${stage.summary}</p>
        </div>
        <div class="v2-topbar-actions">
          <button class="v2-button" type="button" data-action="save-idea-board">Save Idea Board</button>
          <button class="v2-button-ghost" type="button" data-stage-id="idea_pitch">Advance to Idea Pitch</button>
        </div>
      </div>
      <div class="v2-stage-body">
        <div class="v2-card-grid v2-card-grid-dashboard">
          <article class="v2-card v2-feature-card">
            <div class="v2-card-eyebrow">Active Project</div>
            <h3>${activeProject.title}</h3>
            <p>${activeProject.description || "This project is now loaded into the creator workflow and its idea board is studio-scoped."}</p>
          </article>
          <article class="v2-card v2-feature-card">
            <div class="v2-card-eyebrow">Board Status</div>
            <h3>${cards.length} items</h3>
            <p>${ideaBoard.dirty ? "Board changes are local and need to be saved." : "Board state is in sync with the platform payload."}</p>
          </article>
        </div>
        ${projectWorkspace.error ? `<div class="v2-note v2-note-error">${projectWorkspace.error}</div>` : ""}
        ${ideaBoard.error ? `<div class="v2-note v2-note-error">${ideaBoard.error}</div>` : ""}
        <section class="v2-card v2-board-composer">
          <div class="v2-card-eyebrow">Add Board Item</div>
          <h3>Creative Context Composer</h3>
          <div class="v2-composer-grid">
            <select class="v2-studio-input" data-idea-card-category>
              ${globalScope.CreatorAppV2ProjectWorkspace.IDEA_CARD_CATEGORIES.map((category) => `
                <option value="${category}">${category}</option>
              `).join("")}
            </select>
            <input class="v2-studio-input" type="text" placeholder="Board item title" data-idea-card-title />
            <textarea class="v2-studio-input v2-textarea" placeholder="Describe the character, location, scene seed, shot idea, or visual reference." data-idea-card-description></textarea>
            <button class="v2-button" type="button" data-action="add-idea-card">Add Board Item</button>
          </div>
        </section>
        ${ideaBoard.loading ? `<div class="v2-note">Saving or loading idea board state...</div>` : ""}
        ${renderIdeaBoardCards(cards)}
        <div class="v2-note">${stage.foundation}</div>
      </div>
    `;
  }

  globalScope.CreatorAppV2Stages = globalScope.CreatorAppV2Stages || {};
  globalScope.CreatorAppV2Stages.renderIdeaBoardStage = renderIdeaBoardStage;
})(window);
