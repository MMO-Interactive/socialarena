(function attachV2ClipGenerationStage(globalScope) {
  function renderGeneratedClipCard(scene, request, clip) {
    return `
      <article class="v2-starting-image-card ${request.approvedClipId === clip.id ? "approved" : ""}">
        <div class="v2-starting-image-thumb">
          ${clip.videoUrl ? `<video src="${clip.videoUrl}" muted playsinline preload="metadata"></video>` : `<div class="v2-note">No clip yet</div>`}
        </div>
        <div class="v2-starting-image-copy">
          <strong>${clip.label}</strong>
          <span>${clip.status}</span>
        </div>
        <button class="v2-button-ghost v2-button-inline" type="button" data-action="approve-generated-video-clip" data-video-scene-id="${scene.id}" data-video-request-id="${request.id}" data-generated-clip-id="${clip.id}">
          ${request.approvedClipId === clip.id ? "Selected" : "Use This Clip"}
        </button>
      </article>
    `;
  }

  function renderTraceability(scene, request) {
    return `
      <div class="v2-card">
        <div class="v2-card-eyebrow">AI Intent Visibility</div>
        <h3>${request.title || "Untitled Shot"}</h3>
        <div class="v2-trace-grid">
          <div class="v2-trace-card">
            <span>Scene</span>
            <strong>${scene.title}</strong>
          </div>
          <div class="v2-trace-card">
            <span>Shot Slot</span>
            <strong>${request.scriptClipId || request.id}</strong>
          </div>
          <div class="v2-trace-card">
            <span>Shot Role</span>
            <strong>${request.shotRole || "manual"}</strong>
          </div>
          <div class="v2-trace-card">
            <span>Planning Source</span>
            <strong>${request.planningSource || "manual"}</strong>
          </div>
        </div>
        <div class="v2-trace-block">
          <span>Prompt</span>
          <p>${request.clipPrompt || "No prompt yet."}</p>
        </div>
        <div class="v2-trace-block">
          <span>Shot Notes</span>
          <p>${request.shotNotes || "No shot notes yet."}</p>
        </div>
      </div>
    `;
  }

  function renderSceneExecutionCard(scene, summary) {
    const confidence = summary.confidence;
    return `
      <div class="v2-card">
        <div class="v2-card-eyebrow">Scene Generation Package</div>
        <h3>${scene.title}</h3>
        <div class="v2-trace-grid">
          <div class="v2-trace-card">
            <span>Shot Plan</span>
            <strong>${summary.plannedCount} slots</strong>
          </div>
          <div class="v2-trace-card">
            <span>Generated</span>
            <strong>${summary.generatedCount} slots</strong>
          </div>
          <div class="v2-trace-card">
            <span>Approved</span>
            <strong>${summary.approvedCount} slots</strong>
          </div>
          <div class="v2-trace-card">
            <span>Readiness</span>
            <strong>${confidence ? `${confidence.label} ${confidence.score}%` : "Unknown"}</strong>
          </div>
        </div>
      </div>
    `;
  }

  function renderSceneTab(scene, summary, activeSceneId) {
    const confidence = summary.confidence;
    return `
      <button class="v2-starting-scene-tab ${activeSceneId === scene.id ? "active" : ""}" type="button" data-action="select-video-scene" data-video-scene-id="${scene.id}">
        <strong>${scene.title}</strong>
        <span>${summary.approvedCount}/${summary.plannedCount} approved${confidence ? ` • ${confidence.label} ${confidence.score}%` : ""}</span>
      </button>
    `;
  }

  function renderRequestTab(scene, clip, activeRequestId) {
    return `
      <button class="v2-starting-scene-tab ${activeRequestId === clip.id ? "active" : ""}" type="button" data-action="select-video-request" data-video-scene-id="${scene.id}" data-video-request-id="${clip.id}">
        <strong>${clip.shotRole ? `${clip.shotRole}: ${clip.title}` : clip.title}</strong>
        <span>${clip.generatedClips.length} takes • ${clip.planningSource || "manual"}</span>
      </button>
    `;
  }

  function renderClipGenerationStage(stage, state) {
    const activeProject = state?.projectWorkspace?.activeProject;
    const stageState = state?.projectWorkspace?.videoClips || {};
    const store = { getState: () => state };
    const draft = globalScope.CreatorAppV2ClipGenerationState.getVideoClipsDraft(store);
    const activeScene = globalScope.CreatorAppV2ClipGenerationState.getSelectedVideoScene(store);
    const activeRequest = globalScope.CreatorAppV2ClipGenerationState.getSelectedVideoRequest(store, activeScene);
    const checklist = globalScope.CreatorAppV2ClipGenerationState.getVideoClipChecklist(store);
    const activeSceneSummary = globalScope.CreatorAppV2ClipGenerationState.getSceneExecutionSummary(store, activeScene);
    const completeCount = checklist.filter((item) => item.complete).length;
    const sceneTabs = draft.scenes.map((scene) => {
      const summary = globalScope.CreatorAppV2ClipGenerationState.getSceneExecutionSummary(store, scene);
      return renderSceneTab(scene, summary, activeScene?.id || "");
    }).join("");

    if (!activeProject) {
      return `
        <div class="v2-stage-header">
          <div>
            <div class="v2-eyebrow">Step 5</div>
            <h2>${stage.label}</h2>
            <p>${stage.summary}</p>
          </div>
          <button class="v2-button" type="button" data-action="open-dashboard">Open Dashboard</button>
        </div>
        <div class="v2-stage-body">
          <div class="v2-note">Open a project first. Clip generation should inherit active project, script, and approved starting image context.</div>
        </div>
      `;
    }

    return `
      <div class="v2-stage-header">
        <div>
          <div class="v2-eyebrow">Step 5</div>
          <h2>${stage.label}</h2>
          <p>${stage.summary}</p>
        </div>
        <div class="v2-topbar-actions">
          <button class="v2-button" type="button" data-action="apply-video-clips">Apply Clip Plan</button>
          <button class="v2-button-ghost" type="button" data-action="generate-video-clip" ${activeScene && activeRequest ? `data-video-scene-id="${activeScene.id}" data-video-request-id="${activeRequest.id}"` : "disabled"}>Generate Clip</button>
          <button class="v2-button-ghost" type="button" data-action="refresh-video-clip" ${activeRequest?.boardItemId ? `data-video-scene-id="${activeScene.id}" data-video-request-id="${activeRequest.id}"` : "disabled"}>Refresh</button>
          <button class="v2-button-ghost" type="button" data-stage-id="edit">Advance to Edit</button>
        </div>
      </div>
      <div class="v2-stage-body">
        <div class="v2-card-grid v2-card-grid-dashboard">
          <article class="v2-card v2-feature-card">
            <div class="v2-card-eyebrow">Project</div>
            <h3>${activeProject.title}</h3>
            <p>Clip generation should turn approved scene anchors and structured shot plans into selectable motion outputs.</p>
          </article>
          <article class="v2-card v2-feature-card">
            <div class="v2-card-eyebrow">Clip Health</div>
            <h3>${completeCount}/${checklist.length}</h3>
            <p>${stageState.dirty ? "Clip prompts changed and need to be applied." : "Clip generation state is synchronized."}</p>
          </article>
        </div>
        ${stageState.error ? `<div class="v2-note v2-note-error">${stageState.error}</div>` : ""}
        ${stageState.loading ? `<div class="v2-note">Working with the video generation pipeline...</div>` : ""}
        <div class="v2-starting-images-layout">
          <aside class="v2-starting-scene-list">
            ${sceneTabs}
          </aside>
          <section class="v2-starting-scene-editor">
            ${activeScene
              ? `
                <div class="v2-script-scene-header">
                  <div>
                    <div class="v2-card-eyebrow">Selected Scene</div>
                    <h3>${activeScene.title}</h3>
                  </div>
                  <div class="v2-script-scene-actions">
                    <button class="v2-button-ghost v2-button-inline" type="button" data-action="generate-video-clip" data-video-scene-id="${activeScene.id}" data-video-request-id="${activeRequest?.id || ""}" ${activeRequest ? "" : "disabled"}>Generate</button>
                    <button class="v2-button-ghost v2-button-inline" type="button" data-action="refresh-video-clip" data-video-scene-id="${activeScene.id}" data-video-request-id="${activeRequest?.id || ""}" ${activeRequest?.boardItemId ? "" : "disabled"}>Refresh</button>
                  </div>
                </div>
                ${renderSceneExecutionCard(activeScene, activeSceneSummary)}
                <div class="v2-card">
                  <div class="v2-card-eyebrow">Approved Starting Frame</div>
                  ${activeScene.startingImageUrl
                    ? `<div class="v2-starting-image-thumb"><img src="${activeScene.startingImageUrl}" alt="${activeScene.title}" /></div>`
                    : `<div class="v2-note">Approve a starting image first to unlock clip generation.</div>`}
                </div>
                <div class="v2-video-request-tabs">
                  ${activeScene.clips.map((clip) => renderRequestTab(activeScene, clip, activeRequest?.id || "")).join("")}
                </div>
                ${activeRequest
                  ? `
                    <div class="v2-script-grid">
                      <input class="v2-studio-input" type="text" value="${activeRequest.title}" data-video-clip-field="title" data-video-scene-id="${activeScene.id}" data-video-request-id="${activeRequest.id}" placeholder="Clip title" />
                      <textarea class="v2-studio-input v2-textarea" data-video-clip-field="clipPrompt" data-video-scene-id="${activeScene.id}" data-video-request-id="${activeRequest.id}" placeholder="Describe the motion clip to generate.">${activeRequest.clipPrompt}</textarea>
                      <textarea class="v2-studio-input v2-textarea" data-video-clip-field="shotNotes" data-video-scene-id="${activeScene.id}" data-video-request-id="${activeRequest.id}" placeholder="Camera movement, emotional beat, motion direction, and timing.">${activeRequest.shotNotes}</textarea>
                    </div>
                    ${renderTraceability(activeScene, activeRequest)}
                    <div class="v2-board-grid">
                      ${activeRequest.generatedClips.length
                        ? activeRequest.generatedClips.map((clip) => renderGeneratedClipCard(activeScene, activeRequest, clip)).join("")
                        : `<div class="v2-note">No generated takes yet. Generate or refresh this clip slot to pull takes back in.</div>`}
                    </div>
                  `
                  : `<div class="v2-note">Select a shot slot to work on its generation prompt and returned takes.</div>`}
              `
              : `<div class="v2-note">Script and approved starting images are required before clip generation can begin.</div>`}
          </section>
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
        <div class="v2-note">${stage.foundation}</div>
      </div>
    `;
  }

  globalScope.CreatorAppV2Stages = globalScope.CreatorAppV2Stages || {};
  globalScope.CreatorAppV2Stages.renderClipGenerationStage = renderClipGenerationStage;
})(window);
