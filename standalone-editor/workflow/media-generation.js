(function attachEditorWorkflowMediaGenerationModules(globalScope) {
  function createMediaGenerationWorkflowHelpers(deps) {
    const {
      state,
      createStartingImagesState,
      createVideoClipsState,
      ensureStartingImagesDraft,
      ensureVideoClipsDraft,
      getSelectedStartingImageScene,
      getSelectedVideoClipScene,
      getSelectedVideoClipRequest,
      startingImagesChecklist,
      renderStartingImageThumb,
      formatAssetMeta,
      getVideoClipCompletion,
      escapeHtml
    } = deps;

    function renderStartingImagesWorkspace(project) {
      ensureStartingImagesDraft(project);
      const startingImages = createStartingImagesState(project.startingImages || {});
      const activeScene = getSelectedStartingImageScene(project);
      const checklist = startingImagesChecklist(project);
      const completeCount = checklist.filter((item) => item.complete).length;
      const imageAssets = (project.assets || []).filter((asset) => asset.kind === "image");
      const selectedImageAsset = imageAssets.find((asset) => asset.id === state.selectedAssetId) || null;
      const approvedVariation = activeScene?.variations?.find((variation) => variation.id === activeScene.approvedVariationId) || null;

      return `
        <section class="workflow-stage-shell">
          <section class="panel starting-images-workspace">
            <div class="panel-header">
              <div>
                <h2>Starting Images</h2>
                <div class="dashboard-helper">Build one or more anchor frames per scene before moving into video clip generation.</div>
              </div>
              <div class="workflow-panel-actions">
                <button class="ghost-button compact-button" type="button" data-action="save-starting-images">Save Images Plan</button>
                <button class="ghost-button compact-button" type="button" data-action="generate-starting-image" ${activeScene ? "" : "disabled"}>Create Draft</button>
                <button class="ghost-button compact-button" type="button" data-action="refresh-starting-image" ${activeScene?.boardItemId ? "" : "disabled"}>Refresh</button>
                <button class="ghost-button compact-button" type="button" data-action="use-selected-image-asset" ${activeScene && selectedImageAsset ? "" : "disabled"}>Use Selected Asset</button>
                <button class="accent-button compact-button" type="button" data-action="next-stage">Continue to Video Clips</button>
              </div>
            </div>

            <div class="starting-images-grid">
              <section class="starting-images-main">
                <div class="starting-images-scene-list">
                  <div class="script-scene-nav">
                  ${startingImages.scenes
                    .map(
                      (scene, index) => `
                        <button class="script-scene-tab${activeScene?.id === scene.id ? " active" : ""}" type="button" data-action="select-starting-image-scene" data-starting-image-scene-id="${scene.id}">
                          <strong>Scene ${index + 1}</strong>
                          <span>${escapeHtml(scene.title || "Untitled Scene")}</span>
                          <small class="stage-status stage-status-${escapeHtml(scene.status)}">${escapeHtml(scene.status.replace(/_/g, " "))}</small>
                        </button>
                      `
                    )
                    .join("")}
                  </div>
                </div>

                ${
                  activeScene
                    ? `
                      <article class="starting-image-editor">
                        <div class="script-scene-header">
                          <div>
                            <strong>${escapeHtml(activeScene.title || "Untitled Scene")}</strong>
                            <span class="panel-status">${escapeHtml(activeScene.status.replace(/_/g, " "))}</span>
                          </div>
                          <div class="starting-image-editor-actions">
                            <button class="ghost-button compact-button" type="button" data-action="generate-starting-image" data-starting-image-scene-id="${activeScene.id}">Create Draft</button>
                            <button class="ghost-button compact-button" type="button" data-action="refresh-starting-image" data-starting-image-scene-id="${activeScene.id}" ${activeScene.boardItemId ? "" : "disabled"}>Refresh</button>
                            <button class="ghost-button compact-button" type="button" data-action="use-selected-image-asset" data-starting-image-scene-id="${activeScene.id}" ${selectedImageAsset ? "" : "disabled"}>Use Selected Asset</button>
                          </div>
                        </div>

                        <div class="starting-image-scene-grid">
                          <label class="idea-field idea-field-wide">
                            <span>Starting Image Prompt</span>
                            <textarea class="idea-input idea-textarea idea-textarea-compact" data-starting-image-input="prompt" data-starting-image-scene-id="${activeScene.id}" placeholder="Describe the anchor frame this scene needs.">${escapeHtml(activeScene.prompt)}</textarea>
                          </label>
                          <label class="idea-field idea-field-wide">
                            <span>Shot Notes</span>
                            <textarea class="idea-input idea-textarea idea-textarea-compact" data-starting-image-input="shotNotes" data-starting-image-scene-id="${activeScene.id}" placeholder="Lens, framing, lighting, mood, and details worth preserving.">${escapeHtml(activeScene.shotNotes)}</textarea>
                          </label>
                        </div>

                        ${
                          approvedVariation
                            ? `
                              <div class="approved-anchor-callout">
                                <div class="panel-header">
                                  <h2>Approved Anchor Frame</h2>
                                  <span class="panel-status success">Ready for Video Clips</span>
                                </div>
                                <div class="approved-anchor-card">
                                  <div class="approved-anchor-thumb">${renderStartingImageThumb(approvedVariation, activeScene)}</div>
                                  <div class="approved-anchor-copy">
                                    <strong>${escapeHtml(approvedVariation.label)}</strong>
                                    <span>This frame will seed the Video Clips stage for ${escapeHtml(activeScene.title)}.</span>
                                  </div>
                                </div>
                              </div>
                            `
                            : ""
                        }

                        <div class="starting-image-variation-bar">
                          <div class="panel-header">
                            <h2>Variations</h2>
                            <span class="panel-status">${activeScene.variations.length} drafted</span>
                          </div>
                          <div class="starting-image-variation-grid">
                            ${
                              activeScene.variations.length
                                ? activeScene.variations
                                    .map(
                                      (variation) => `
                                        <article class="starting-image-card${activeScene.approvedVariationId === variation.id ? " approved" : ""}">
                                          <div class="starting-image-card-thumb">${renderStartingImageThumb(variation, activeScene)}</div>
                                          <div class="starting-image-card-copy">
                                            <strong>${escapeHtml(variation.label)}</strong>
                                            <span>${escapeHtml(
                                              variation.source === "asset"
                                                ? "Linked from Media Bin"
                                                : variation.source === "generated"
                                                  ? "Generated from API"
                                                  : "Draft image concept"
                                            )}</span>
                                          </div>
                                          <div class="starting-image-card-actions">
                                            <button class="ghost-button compact-button" type="button" data-action="approve-starting-image-variation" data-starting-image-scene-id="${activeScene.id}" data-starting-image-variation-id="${variation.id}">${activeScene.approvedVariationId === variation.id ? "Approved" : "Approve"}</button>
                                            <button class="ghost-button compact-button" type="button" data-action="remove-starting-image-variation" data-starting-image-scene-id="${activeScene.id}" data-starting-image-variation-id="${variation.id}">Remove</button>
                                          </div>
                                        </article>
                                      `
                                    )
                                    .join("")
                                : '<div class="empty-state">No starting image variations yet</div>'
                            }
                          </div>
                        </div>
                      </article>
                    `
                    : '<div class="empty-state">Add scenes in Script before generating starting images.</div>'
                }
              </section>

              <aside class="script-sidebar">
                <div class="stage-sidebar-section">
                  <div class="panel-header">
                    <h2>Image Health</h2>
                    <span class="panel-status">${completeCount}/${checklist.length}</span>
                  </div>
                  <div class="idea-progress-shell">
                    <div class="idea-progress-fill" style="width:${Math.round((completeCount / Math.max(1, checklist.length)) * 100)}%"></div>
                  </div>
                  <div class="dashboard-helper">Every scene should leave this stage with one approved anchor frame or chosen source image.</div>
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
                    <h2>Selected Media Bin Image</h2>
                    <span class="panel-status">${selectedImageAsset ? "Ready" : "Optional"}</span>
                  </div>
                  ${
                    selectedImageAsset
                      ? `
                        <div class="sync-card">
                          <strong>${escapeHtml(selectedImageAsset.name)}</strong>
                          <span>${escapeHtml(formatAssetMeta(selectedImageAsset))}</span>
                        </div>
                      `
                      : '<div class="empty-state">Select an image asset in the Media Bin to use it as a starting frame.</div>'
                  }
                </div>

                <div class="stage-sidebar-section">
                  <div class="panel-header">
                    <h2>Next Stage</h2>
                    <span class="panel-status">Video Clips</span>
                  </div>
                  <div class="sync-card">
                    <strong>Animate approved frames</strong>
                    <span>Use the strongest approved starting image for each scene to drive clip generation.</span>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </section>
      `;
    }

    function renderVideoClipsWorkspace(project) {
      ensureVideoClipsDraft(project);
      const videoClips = createVideoClipsState(project.videoClips || {});
      const activeScene = getSelectedVideoClipScene(project);
      const activeRequest = getSelectedVideoClipRequest(project, activeScene);
      const readyScenes = videoClips.scenes.filter((scene) => scene.startingImageUrl).length;
      const generatedScenes = videoClips.scenes.filter((scene) => scene.clips?.some((clip) => clip.generatedClips?.length)).length;
      const completion = getVideoClipCompletion(project);
      const checklist = [
        { label: "Approved starting images linked", complete: readyScenes > 0 && readyScenes === videoClips.scenes.length },
        {
          label: "Clip prompts ready",
          complete: videoClips.scenes.every(
            (scene) => (scene.clips || []).every((clip) => !scene.startingImageUrl || Boolean(String(clip.clipPrompt || "").trim()))
          ) && videoClips.scenes.length > 0
        },
        {
          label: "Shot motion notes captured",
          complete: videoClips.scenes.some((scene) => (scene.clips || []).some((clip) => Boolean(String(clip.shotNotes || "").trim())))
        },
        { label: "Generated clip set", complete: generatedScenes > 0 },
        { label: "Selected take for each ready clip", complete: completion.readyToCut }
      ];
      const completeCount = checklist.filter((item) => item.complete).length;

      return `
        <section class="workflow-stage-shell">
          <section class="panel starting-images-workspace video-clips-workspace">
            <div class="panel-header">
              <div>
                <h2>Video Clips</h2>
                <div class="dashboard-helper">Use approved anchor frames and scene prompts to plan or queue the first generated clips.</div>
              </div>
              <div class="workflow-panel-actions">
                <button class="ghost-button compact-button" type="button" data-action="generate-video-clip" ${activeScene?.startingImageUrl && activeRequest ? "" : "disabled"}>Generate Clip</button>
                <button class="ghost-button compact-button" type="button" data-action="refresh-video-clip" ${activeRequest?.boardItemId ? "" : "disabled"}>Refresh</button>
                <button class="ghost-button compact-button" type="button" data-action="build-rough-cut" ${generatedScenes ? "" : "disabled"}>Build Rough Cut</button>
                <button class="ghost-button compact-button" type="button" data-action="previous-stage">Back to Starting Images</button>
                <button class="accent-button compact-button" type="button" data-action="finish-video-clips" ${completion.selectedClipRequests ? "" : "disabled"}>${completion.readyToCut ? "Finish & Open Edit" : "Open Edit Stage"}</button>
              </div>
            </div>

            <div class="starting-images-grid">
              <section class="starting-images-main">
                <div class="starting-images-scene-list">
                  <div class="script-scene-nav">
                    ${videoClips.scenes.map((scene, index) => `
                      <button class="script-scene-tab${activeScene?.id === scene.id ? " active" : ""}" type="button" data-action="select-video-clip-scene" data-video-clip-scene-id="${scene.id}">
                        <strong>Scene ${index + 1}</strong>
                        <span>${escapeHtml(scene.title || "Untitled Scene")}</span>
                        <small class="stage-status stage-status-${escapeHtml(scene.status)}">${escapeHtml(scene.status.replace(/_/g, " "))}</small>
                      </button>
                    `).join("")}
                  </div>
                </div>

                ${
                  activeScene
                    ? `
                      <article class="starting-image-editor">
                        <div class="script-scene-header">
                          <div>
                            <strong>${escapeHtml(activeScene.title || "Untitled Scene")}</strong>
                            <span class="panel-status">${escapeHtml(activeScene.status.replace(/_/g, " "))}</span>
                          </div>
                          <div class="starting-image-editor-actions">
                            <button class="ghost-button compact-button" type="button" data-action="generate-video-clip" data-video-clip-scene-id="${activeScene.id}" data-video-clip-request-id="${activeRequest?.id || ""}" ${activeScene.startingImageUrl && activeRequest ? "" : "disabled"}>Generate Clip</button>
                            <button class="ghost-button compact-button" type="button" data-action="refresh-video-clip" data-video-clip-scene-id="${activeScene.id}" data-video-clip-request-id="${activeRequest?.id || ""}" ${activeRequest?.boardItemId ? "" : "disabled"}>Refresh</button>
                          </div>
                        </div>

                        <div class="video-clips-seed-card">
                          <div class="panel-header">
                            <h2>Approved Starting Frame</h2>
                            <span class="panel-status">${activeScene.startingImageUrl ? "Linked" : "Required"}</span>
                          </div>
                          ${
                            activeScene.startingImageUrl
                              ? `
                                <div class="approved-anchor-card">
                                  <div class="approved-anchor-thumb"><img src="${escapeHtml(activeScene.startingImageUrl)}" alt="${escapeHtml(activeScene.title)}" /></div>
                                  <div class="approved-anchor-copy">
                                    <strong>${escapeHtml(activeScene.title)}</strong>
                                    <span>This approved frame from Starting Images will be used as the visual seed for clip generation.</span>
                                  </div>
                                </div>
                              `
                              : '<div class="empty-state">Approve a starting image first to unlock clip generation planning for this scene.</div>'
                          }
                        </div>

                        <div class="video-clip-request-list">
                          <div class="panel-header">
                            <h2>Clip Slots</h2>
                            <span class="panel-status">${activeScene.clips.length} planned</span>
                          </div>
                          <div class="video-clip-request-tabs">
                            ${activeScene.clips.map((clip, index) => `
                              <button class="video-clip-request-tab${activeRequest?.id === clip.id ? " active" : ""}" type="button" data-action="select-video-clip-request" data-video-clip-scene-id="${activeScene.id}" data-video-clip-request-id="${clip.id}">
                                <strong>${escapeHtml(clip.title || `Clip ${index + 1}`)}</strong>
                                <span>${escapeHtml(String(clip.status || "not_ready").replace(/_/g, " "))}</span>
                                <small>${clip.generatedClips?.length || 0} takes</small>
                              </button>
                            `).join("")}
                          </div>
                        </div>

                        ${
                          activeRequest
                            ? `
                              <section class="video-clips-editor-fields">
                                <div class="starting-image-scene-grid video-clips-editor-grid">
                                <label class="idea-field">
                                  <span>Clip Title</span>
                                  <input class="idea-input" data-video-clip-input="title" data-video-clip-scene-id="${activeScene.id}" data-video-clip-request-id="${activeRequest.id}" value="${escapeHtml(activeRequest.title)}" placeholder="Clip name" />
                                </label>
                                <label class="idea-field">
                                  <span>Generation Status</span>
                                  <div class="sync-card compact">
                                    <strong>${escapeHtml(String(activeRequest.status || "not_ready").replace(/_/g, " "))}</strong>
                                    <span>${activeRequest.generatedClips?.length || 0} take${activeRequest.generatedClips?.length === 1 ? "" : "s"} ready</span>
                                  </div>
                                </label>
                                <label class="idea-field idea-field-wide">
                                  <span>Clip Prompt</span>
                                  <textarea class="idea-input idea-textarea idea-textarea-compact" data-video-clip-input="clipPrompt" data-video-clip-scene-id="${activeScene.id}" data-video-clip-request-id="${activeRequest.id}" placeholder="Describe the actual motion clip to generate for this clip slot.">${escapeHtml(activeRequest.clipPrompt)}</textarea>
                                </label>
                                <label class="idea-field idea-field-wide">
                                  <span>Motion / Camera Notes</span>
                                  <textarea class="idea-input idea-textarea idea-textarea-compact" data-video-clip-input="shotNotes" data-video-clip-scene-id="${activeScene.id}" data-video-clip-request-id="${activeRequest.id}" placeholder="Camera motion, timing, emotional beat, action, and timing notes.">${escapeHtml(activeRequest.shotNotes)}</textarea>
                                </label>
                                </div>
                              </section>
                            `
                            : '<div class="empty-state">Select a clip slot to queue generation for that shot.</div>'
                        }

                        <section class="starting-image-variation-bar video-clips-panel shot-plan-panel">
                          <div class="panel-header">
                            <h2>Planned Shots</h2>
                            <span class="panel-status">${activeScene.plannedShots.length} planned</span>
                          </div>
                          ${
                            activeScene.plannedShots.length
                              ? `
                                <div class="shot-plan-list">
                                  ${activeScene.plannedShots.map((shot) => `
                                    <article class="shot-plan-card">
                                      <div class="shot-plan-copy">
                                        <strong>${escapeHtml(shot.title)}</strong>
                                        <span>${escapeHtml(String(shot.shotType || "coverage").replace(/_/g, " "))}</span>
                                        <p>${escapeHtml(shot.prompt)}</p>
                                      </div>
                                      <div class="inline-actions">
                                        <button class="ghost-button compact-button inspector-button" type="button" data-action="use-planned-shot" data-video-clip-scene-id="${activeScene.id}" data-video-clip-request-id="${activeRequest?.id || ""}" data-planned-shot-id="${shot.id}" ${activeRequest ? "" : "disabled"}>Use For Clip</button>
                                      </div>
                                    </article>
                                  `).join("")}
                                </div>
                              `
                              : '<div class="empty-state">Generate shots from the scene inspector to create 4 AI-ready shot placeholders for this scene.</div>'
                          }
                        </section>

                        <section class="starting-image-variation-bar video-clips-panel clip-generation-panel">
                          <div class="panel-header">
                            <h2>Clip Generation Status</h2>
                            <span class="panel-status">${activeRequest?.generatedClips?.length || 0} clips</span>
                          </div>
                          ${
                            activeRequest?.generatedClips?.length
                              ? `
                                <div class="starting-image-variation-grid">
                                  ${activeRequest.generatedClips.map((clip) => `
                                    <article class="starting-image-card approved${activeRequest.approvedClipId === clip.id ? " selected-generated-clip" : ""}">
                                      <div class="starting-image-card-thumb">
                                        <video src="${escapeHtml(clip.videoUrl)}" muted playsinline preload="metadata"></video>
                                      </div>
                                      <div class="starting-image-card-copy">
                                        <strong>${escapeHtml(clip.label)}</strong>
                                        <span>${activeRequest.approvedClipId === clip.id ? "Selected for the rough cut and edit handoff." : "Generated clip ready in Media Bin and Edit."}</span>
                                        <div class="inline-actions">
                                          <button class="ghost-button compact-button inspector-button" type="button" data-action="approve-generated-clip" data-video-clip-scene-id="${activeScene.id}" data-video-clip-request-id="${activeRequest.id}" data-generated-clip-id="${clip.id}">${activeRequest.approvedClipId === clip.id ? "Selected" : "Use This Clip"}</button>
                                          <button class="ghost-button compact-button inspector-button" type="button" data-action="send-generated-clip-to-edit" data-video-clip-scene-id="${activeScene.id}" data-video-clip-request-id="${activeRequest.id}" data-generated-clip-id="${clip.id}">Add To Edit</button>
                                          <button class="ghost-button compact-button inspector-button" type="button" data-action="open-editor">Open Edit</button>
                                        </div>
                                      </div>
                                    </article>
                                  `).join("")}
                                </div>
                              `
                              : '<div class="empty-state">No generated clips attached to this clip slot yet. Generate or refresh this slot to pull finished takes back into the editor.</div>'
                          }
                        </section>
                      </article>
                    `
                    : '<div class="empty-state">Add scenes and approve starting images before generating clips.</div>'
                }
              </section>

              <aside class="script-sidebar">
                <div class="stage-sidebar-section">
                  <div class="panel-header">
                    <h2>Clip Health</h2>
                    <span class="panel-status">${completeCount}/${checklist.length}</span>
                  </div>
                  <div class="idea-progress-shell">
                    <div class="idea-progress-fill" style="width:${Math.round((completeCount / Math.max(1, checklist.length)) * 100)}%"></div>
                  </div>
                  <div class="dashboard-helper">Approved images and scene prompts should now translate directly into production clip requests.</div>
                </div>

                <div class="stage-sidebar-section">
                  <div class="panel-header">
                    <h2>Checklist</h2>
                    <span class="panel-status">Required</span>
                  </div>
                  <div class="idea-checklist">
                    ${checklist.map((item) => `
                      <div class="idea-check-item${item.complete ? " complete" : ""}">
                        <span class="idea-check-dot">${item.complete ? "Done" : "Open"}</span>
                        <strong>${escapeHtml(item.label)}</strong>
                      </div>
                    `).join("")}
                  </div>
                </div>

                <div class="stage-sidebar-section">
                  <div class="panel-header">
                    <h2>Pipeline</h2>
                    <span class="panel-status">${completion.readyToCut ? "Ready to Cut" : "Seeded"}</span>
                  </div>
                  <div class="sync-card">
                    <strong>${completion.selectedClipRequests}/${completion.targetClipRequests || 0} clip takes selected</strong>
                    <span>${completion.readyToCut ? "Every ready clip slot now has a selected generated take. This project is ready to hand off into Edit." : "Each approved starting image from the previous stage is carried forward here as the clip-generation anchor."}</span>
                  </div>
                </div>

                <div class="stage-sidebar-section">
                  <div class="panel-header">
                    <h2>Next Stage</h2>
                    <span class="panel-status">Edit</span>
                  </div>
                  <div class="sync-card">
                    <strong>${completion.readyToCut ? "Ready for rough cut" : "Assemble generated clips"}</strong>
                    <span>${completion.readyToCut ? "Use Finish & Open Edit to auto-build the rough cut from the selected take for each scene." : "Once clip outputs exist, move to Edit to build the cut and export."}</span>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        </section>
      `;
    }

    return {
      renderStartingImagesWorkspace,
      renderVideoClipsWorkspace
    };
  }

  globalScope.EditorWorkflowModules = globalScope.EditorWorkflowModules || {};
  globalScope.EditorWorkflowModules.createMediaGenerationWorkflowHelpers = createMediaGenerationWorkflowHelpers;
})(window);
