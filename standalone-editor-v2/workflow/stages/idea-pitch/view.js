(function attachV2IdeaPitchStage(globalScope) {
  function renderChecklist(checklist) {
    return `
      <div class="v2-pitch-checklist">
        ${checklist.map((item) => `
          <div class="v2-pitch-check ${item.complete ? "complete" : ""}">
            <span>${item.complete ? "Ready" : "Open"}</span>
            <strong>${item.label}</strong>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderIdeaPitchStage(stage, state) {
    const projectWorkspace = state?.projectWorkspace || {};
    const activeProject = projectWorkspace.activeProject;
    const pitchDraft = globalScope.CreatorAppV2IdeaPitchState.getPitchDraft({ getState: () => state });
    const checklist = globalScope.CreatorAppV2IdeaPitchState.getPitchChecklist({ getState: () => state });
    const completeCount = checklist.filter((item) => item.complete).length;

    if (!activeProject) {
      return `
        <div class="v2-stage-header">
          <div>
            <div class="v2-eyebrow">Step 2</div>
            <h2>${stage.label}</h2>
            <p>${stage.summary}</p>
          </div>
          <button class="v2-button" type="button" data-action="open-dashboard">Open Dashboard</button>
        </div>
        <div class="v2-stage-body">
          <div class="v2-note">Open a project in the creator workflow before building its pitch. The pitch is a project-specific creative brief, not a detached document.</div>
        </div>
      `;
    }

    return `
      <div class="v2-stage-header">
        <div>
          <div class="v2-eyebrow">Step 2</div>
          <h2>${stage.label}</h2>
          <p>${stage.summary}</p>
        </div>
        <div class="v2-topbar-actions">
          <button class="v2-button" type="button" data-action="apply-pitch-draft">Apply Pitch</button>
          <button class="v2-button-ghost" type="button" data-stage-id="script">Advance to Script</button>
        </div>
      </div>
      <div class="v2-stage-body">
        <div class="v2-card-grid v2-card-grid-dashboard">
          <article class="v2-card v2-feature-card">
            <div class="v2-card-eyebrow">Pitch Target</div>
            <h3>${activeProject.title}</h3>
            <p>The board is now being condensed into a promotable creative brief for a ${activeProject.type}.</p>
          </article>
          <article class="v2-card v2-feature-card">
            <div class="v2-card-eyebrow">Pitch Health</div>
            <h3>${completeCount}/${checklist.length}</h3>
            <p>${projectWorkspace.pitch?.dirty ? "Draft changes are buffered until you apply them." : "Draft is applied to current project context."}</p>
          </article>
        </div>

        <section class="v2-card v2-pitch-form">
          <div class="v2-card-eyebrow">Pitch Composer</div>
          <h3>Creative Brief</h3>
          <div class="v2-pitch-grid">
            <input class="v2-studio-input" type="text" value="${pitchDraft.title}" data-pitch-field="title" placeholder="Project title" />
            <select class="v2-studio-input" data-pitch-field="format">
              ${["film", "series", "episode"].map((format) => `
                <option value="${format}" ${pitchDraft.format === format ? "selected" : ""}>${format}</option>
              `).join("")}
            </select>
            <input class="v2-studio-input" type="text" value="${pitchDraft.audience}" data-pitch-field="audience" placeholder="Target audience" />
            <textarea class="v2-studio-input v2-textarea" data-pitch-field="logline" placeholder="One sentence that captures the core hook.">${pitchDraft.logline}</textarea>
            <textarea class="v2-studio-input v2-textarea" data-pitch-field="concept" placeholder="Describe the premise, characters, conflict, and why this should exist.">${pitchDraft.concept}</textarea>
            <input class="v2-studio-input" type="text" value="${pitchDraft.tone.join(", ")}" data-pitch-field="tone" placeholder="cinematic, mysterious, grounded" />
            <textarea class="v2-studio-input v2-textarea" data-pitch-field="visualStyle" placeholder="Visual direction, references, camera language, lighting, palette.">${pitchDraft.visualStyle}</textarea>
            <textarea class="v2-studio-input v2-textarea" data-pitch-field="references" placeholder="Reference notes, cast ideas, locations, or external inspiration.">${pitchDraft.references}</textarea>
            <textarea class="v2-studio-input v2-textarea" data-pitch-field="successCriteria" placeholder="What should be true before this moves to script?">${pitchDraft.successCriteria}</textarea>
          </div>
        </section>

        <section class="v2-card">
          <div class="v2-card-eyebrow">Stage Checklist</div>
          <h3>Pitch Readiness</h3>
          ${renderChecklist(checklist)}
        </section>

        <div class="v2-note">${stage.foundation}</div>
      </div>
    `;
  }

  globalScope.CreatorAppV2Stages = globalScope.CreatorAppV2Stages || {};
  globalScope.CreatorAppV2Stages.renderIdeaPitchStage = renderIdeaPitchStage;
})(window);
