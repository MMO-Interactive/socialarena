(function attachEditorWorkspaceModules(globalScope) {
  function createWorkspaceHelpers(deps) {
    const {
      state,
      escapeHtml,
      getStudioScopedProjects,
      renderUiIcon,
      assetClass,
      renderAssetThumbnail,
      formatAssetMeta,
      formatTimecode,
      getTimelinePixelsPerSecond,
      renderTimelineRuler,
      renderTimelineTracks,
      renderPreviewContent,
      renderHiddenAudioContent,
      renderInspectorSelectionSummary,
      getSelectedAsset,
      formatProjectTypeLabel
    } = deps;

    function renderEditWorkspace(project, context) {
      const {
        selection,
        inspector,
        sceneInspectorDraft,
        canEditTimelineItem,
        isSceneSelection,
        continuityWarnings,
        transitionState,
        previewSelection
      } = context;

      return `
        <aside class="panel left-panel">
          <div class="panel-header">
            <h2>Projects</h2>
            <span class="panel-status">${project.status}</span>
          </div>
          <div class="list-block">
            ${getStudioScopedProjects()
              .map(
                (entry) => `
                  <button class="list-item${entry.id === project.id ? " active" : ""}" type="button" data-project-id="${entry.id}">
                    <span>${entry.name}</span>
                    <small>${entry.clipCount} clips</small>
                  </button>
                `
              )
              .join("")}
          </div>
          <div class="panel-header panel-header-tight">
            <h2>Media Bin</h2>
            <span class="panel-status">${project.type}</span>
          </div>
          <div class="inline-actions media-actions">
            <button class="ghost-button compact-button toolbar-button" type="button" data-action="import-assets" title="Import Asset" aria-label="Import Asset">
              <span class="button-icon" aria-hidden="true">${renderUiIcon("import")}</span>
              <span class="button-label">Import</span>
            </button>
            <button class="ghost-button compact-button toolbar-button" type="button" data-action="add-to-timeline" title="Add To Timeline" aria-label="Add To Timeline">
              <span class="button-icon" aria-hidden="true">${renderUiIcon("addTimeline")}</span>
              <span class="button-label">Add</span>
            </button>
          </div>
          <div class="asset-grid">
            ${
              project.assets.length
                ? project.assets
                    .map(
                      (asset) => `
                        <button class="${assetClass(asset.kind)}${asset.id === state.selectedAssetId ? " selected" : ""}" type="button" data-asset-id="${asset.id}" draggable="true">
                          <div class="asset-thumb">${renderAssetThumbnail(asset)}</div>
                          <span>${escapeHtml(asset.name)}</span>
                          <small>${formatAssetMeta(asset)}</small>
                        </button>
                      `
                    )
                    .join("")
                : '<div class="empty-state">No assets yet</div>'
            }
          </div>
        </aside>

        <main class="center-column">
          <section class="panel timeline-panel">
            <div class="panel-header">
              <h2>Timeline</h2>
              <div class="timeline-header-tools">
                <div class="timecode timecode-inline" data-role="timecode">${formatTimecode(state.currentSeconds, project.fps)}</div>
                <span class="panel-status">${project.fps} fps</span>
                <span class="panel-status">Zoom ${getTimelinePixelsPerSecond(project)} px/s</span>
              </div>
            </div>
            <div class="timeline-actions">
              <div class="inline-actions timeline-action-group">
                <button class="ghost-button compact-button toolbar-button" type="button" data-action="timeline-zoom-out" title="Zoom Out" aria-label="Zoom Out">
                  <span class="button-icon" aria-hidden="true">${renderUiIcon("zoomOut")}</span>
                  <span class="button-label">Out</span>
                </button>
                <button class="ghost-button compact-button toolbar-button" type="button" data-action="timeline-zoom-in" title="Zoom In" aria-label="Zoom In">
                  <span class="button-icon" aria-hidden="true">${renderUiIcon("zoomIn")}</span>
                  <span class="button-label">In</span>
                </button>
                <button class="ghost-button compact-button toolbar-button" type="button" data-action="timeline-add-marker" title="Add Marker" aria-label="Add Marker">
                  <span class="button-icon" aria-hidden="true">${renderUiIcon("marker")}</span>
                  <span class="button-label">Marker</span>
                </button>
              </div>
              <div class="inline-actions timeline-action-group">
                <button class="ghost-button compact-button icon-button" type="button" data-action="timeline-move-clip-left" title="Move Left" aria-label="Move Left">${renderUiIcon("left")}</button>
                <button class="ghost-button compact-button icon-button" type="button" data-action="timeline-move-clip-right" title="Move Right" aria-label="Move Right">${renderUiIcon("right")}</button>
                <button class="ghost-button compact-button icon-button" type="button" data-action="timeline-move-clip-up" title="Track Up" aria-label="Track Up">${renderUiIcon("up")}</button>
                <button class="ghost-button compact-button icon-button" type="button" data-action="timeline-move-clip-down" title="Track Down" aria-label="Track Down">${renderUiIcon("down")}</button>
              </div>
              <div class="inline-actions timeline-action-group">
                <button class="ghost-button compact-button icon-button" type="button" data-action="timeline-split-clip" title="Split" aria-label="Split">${renderUiIcon("split")}</button>
                <button class="ghost-button compact-button icon-button" type="button" data-action="timeline-duplicate-clip" title="Duplicate" aria-label="Duplicate">${renderUiIcon("duplicate")}</button>
                <button class="ghost-button compact-button icon-button" type="button" data-action="timeline-delete-clip" title="Delete" aria-label="Delete">${renderUiIcon("delete")}</button>
              </div>
            </div>
            <div class="timeline-scroll">
              <div class="timeline-scroll-inner">
                <div class="timeline-ruler">
                  ${renderTimelineRuler(project)}
                </div>
                ${renderTimelineTracks(project)}
              </div>
            </div>
          </section>
        </main>

        <aside class="right-column">
          <section class="panel preview-panel preview-panel-compact">
            <div class="panel-header">
              <h2>Preview</h2>
              <div class="preview-header-tools">
                <span class="panel-status">${project.previewLabel}</span>
                <button class="ghost-button compact-button icon-button" type="button" data-action="preview-fullscreen" title="Full Screen" aria-label="Full Screen">
                  <span class="button-icon" aria-hidden="true">&#9974;</span>
                </button>
              </div>
            </div>
            <div class="preview-monitor" data-preview-shell>
              <div class="preview-safe-frame">
                <div class="preview-tag">Program</div>
                <div data-role="preview-content">${renderPreviewContent(previewSelection, project)}</div>
                <div data-role="preview-audio-layer" class="preview-audio-layer">${renderHiddenAudioContent(project)}</div>
              </div>
            </div>
            <div class="transport-bar transport-bar-compact">
              <button class="transport-button icon-button${state.playing ? " is-live" : ""}" type="button" data-action="playback-play" title="Play" aria-label="Play">
                <span class="button-icon" aria-hidden="true">&#9654;</span>
              </button>
              <button class="transport-button icon-button" type="button" data-action="playback-pause" title="Pause" aria-label="Pause">
                <span class="button-icon" aria-hidden="true">&#10074;&#10074;</span>
              </button>
              <button class="transport-button icon-button" type="button" data-action="playback-stop" title="Stop" aria-label="Stop">
                <span class="button-icon" aria-hidden="true">&#9632;</span>
              </button>
              <button class="transport-button icon-button" type="button" data-action="playback-step" title="Step" aria-label="Step">
                <span class="button-icon" aria-hidden="true">&#9658;&#10072;</span>
              </button>
            </div>
          </section>

          <section class="panel right-panel">
            <div class="panel-header">
              <h2>Inspector</h2>
              <span class="panel-status">${project.selectedLabel}</span>
            </div>
            ${renderInspectorSelectionSummary(selection)}
            <div class="inspector-group">
              <label>Selection</label>
              ${
                canEditTimelineItem
                  ? `<input class="inspector-input" type="text" value="${inspector.name}" data-input="clip-name" />`
                  : `<div class="inspector-value">${inspector.name}</div>`
              }
              ${
                !canEditTimelineItem && getSelectedAsset(project)?.sourceUrl
                  ? `<button class="ghost-button compact-button inspector-button" type="button" data-action="open-selected-asset-preview">Preview</button>`
                  : ""
              }
            </div>
            <div class="inspector-group">
              <label>${isSceneSelection ? "Scene Range" : "Trim"}</label>
              <div class="inspector-grid">
                <div class="inspector-stat">
                  <span>In</span>
                  <strong>${inspector.sourceIn}</strong>
                </div>
                <div class="inspector-stat">
                  <span>Out</span>
                  ${
                    canEditTimelineItem
                      ? `<input class="inspector-input inspector-input-compact" type="text" value="${inspector.sourceOut}" data-input="clip-source-out" />`
                      : `<strong>${inspector.sourceOut}</strong>`
                  }
                </div>
              </div>
            </div>
            ${
              isSceneSelection
                ? `
                  <div class="inspector-group">
                    <label>Scene Summary</label>
                    <div class="inspector-value">${escapeHtml(inspector.sceneSummary)}</div>
                  </div>
                  <div class="inspector-group">
                    <label>Scene Completeness</label>
                    <div class="inspector-completeness-card">
                      <div class="inspector-completeness-header">
                        <strong>${inspector.sceneCompleteness}%</strong>
                        <span>${inspector.sceneCompleteness >= 60 ? "Ready to generate" : "Needs more context"}</span>
                      </div>
                      <div class="idea-progress-shell">
                        <div class="idea-progress-fill" style="width:${Math.max(0, Math.min(100, inspector.sceneCompleteness))}%"></div>
                      </div>
                      <div class="inspector-check-grid">
                        ${(inspector.sceneCompletenessChecks || []).map((item) => `
                          <div class="idea-check-item${item.complete ? " complete" : ""}">
                            <span class="idea-check-dot">${item.complete ? "Done" : "Open"}</span>
                            <strong>${escapeHtml(item.label)}</strong>
                          </div>
                        `).join("")}
                      </div>
                    </div>
                  </div>
                  <div class="inspector-group">
                    <label>Story Context</label>
                    <div class="inspector-grid">
                      <div class="inspector-stat">
                        <span>Objective</span>
                        <strong>${escapeHtml(inspector.sceneObjective)}</strong>
                      </div>
                      <div class="inspector-stat">
                        <span>Status</span>
                        <strong>${escapeHtml(String(inspector.sceneStatus || "draft").replace(/_/g, " "))}</strong>
                      </div>
                    </div>
                    <div class="inspector-footnote">Mood: ${escapeHtml(inspector.sceneMood || "Not set")}</div>
                    <div class="inspector-footnote">Characters: ${escapeHtml(inspector.sceneCharacters || "Not set")}</div>
                    <div class="inspector-footnote">Location: ${escapeHtml(inspector.sceneLocation || "Not set")}</div>
                    <div class="inspector-footnote">Time of day: ${escapeHtml(inspector.sceneTimeOfDay || "Not set")}</div>
                  </div>
                  <div class="inspector-group">
                    <label>Scene Metadata</label>
                    <div class="starting-image-scene-grid">
                      <label class="idea-field">
                        <span>Location</span>
                        <input class="idea-input inspector-input" type="text" value="${escapeHtml(sceneInspectorDraft.location)}" data-scene-meta-input="location" data-script-scene-id="${escapeHtml(selection.scriptSceneId || "")}" placeholder="Attic bedroom, town street, lakeside dock" />
                      </label>
                      <label class="idea-field">
                        <span>Characters</span>
                        <input class="idea-input inspector-input" type="text" value="${escapeHtml(sceneInspectorDraft.characters)}" data-scene-meta-input="characters" data-script-scene-id="${escapeHtml(selection.scriptSceneId || "")}" placeholder="Sadie, Wade" />
                      </label>
                      <label class="idea-field">
                        <span>Mood</span>
                        <input class="idea-input inspector-input" type="text" value="${escapeHtml(sceneInspectorDraft.mood)}" data-scene-meta-input="mood" data-script-scene-id="${escapeHtml(selection.scriptSceneId || "")}" placeholder="reflective, tense, hopeful" />
                      </label>
                      <label class="idea-field">
                        <span>Time of Day</span>
                        <input class="idea-input inspector-input" type="text" value="${escapeHtml(sceneInspectorDraft.timeOfDay)}" data-scene-meta-input="timeOfDay" data-script-scene-id="${escapeHtml(selection.scriptSceneId || "")}" placeholder="golden hour, night, dawn" />
                      </label>
                      <label class="idea-field">
                        <span>Objective</span>
                        <input class="idea-input inspector-input" type="text" value="${escapeHtml(sceneInspectorDraft.objective)}" data-scene-meta-input="objective" data-script-scene-id="${escapeHtml(selection.scriptSceneId || "")}" placeholder="What must this scene accomplish?" />
                      </label>
                      <label class="idea-field">
                        <span>Camera Style</span>
                        <input class="idea-input inspector-input" type="text" value="${escapeHtml(sceneInspectorDraft.cameraStyle)}" data-scene-meta-input="cameraStyle" data-script-scene-id="${escapeHtml(selection.scriptSceneId || "")}" placeholder="slow push, handheld, locked-off wide" />
                      </label>
                      <label class="idea-field idea-field-wide">
                        <span>Visual References</span>
                        <textarea class="idea-input idea-textarea idea-textarea-compact" data-scene-meta-input="visualReferences" data-script-scene-id="${escapeHtml(selection.scriptSceneId || "")}" placeholder="Lensing, palette, references, motifs.">${escapeHtml(sceneInspectorDraft.visualReferences)}</textarea>
                      </label>
                    </div>
                    <div class="inline-actions inspector-timeline-actions">
                      <button class="ghost-button compact-button inspector-button" type="button" data-action="scene-fill-location">Use First Location</button>
                      <button class="ghost-button compact-button inspector-button" type="button" data-action="scene-fill-characters">Use Cast</button>
                      <button class="ghost-button compact-button inspector-button" type="button" data-action="scene-fill-mood">Use Project Mood</button>
                      <button class="accent-button compact-button inspector-button" type="button" data-action="update-scene-metadata">Update Scene</button>
                    </div>
                  </div>
                  <div class="inspector-group">
                    <label>Generation Context</label>
                    <div class="inspector-value">${escapeHtml(inspector.sceneClipPrompt || "No clip prompt yet")}</div>
                    <div class="inspector-footnote">${escapeHtml(inspector.sceneNotes || "No scene notes yet")}</div>
                    <div class="inline-actions inspector-timeline-actions">
                      <button class="ghost-button compact-button inspector-button" type="button" data-action="generate-scene-shots" ${inspector.sceneCompleteness >= 60 ? "" : "disabled"}>Generate Shots</button>
                      <button class="ghost-button compact-button inspector-button" type="button" data-action="generate-entire-scene" ${inspector.sceneCompleteness >= 60 ? "" : "disabled"}>Generate Entire Scene</button>
                      <button class="ghost-button compact-button inspector-button" type="button" data-action="generate-scene-coverage" ${inspector.sceneCompleteness >= 60 ? "" : "disabled"}>Coverage Suggestions</button>
                      <button class="ghost-button compact-button inspector-button" type="button" data-action="jump-stage" data-stage-id="video_clips">Open Video Clips</button>
                    </div>
                  </div>
                  <div class="inspector-group">
                    <label>Script</label>
                    <div class="inspector-value">${escapeHtml(inspector.sceneScriptText || "No dialogue or script text linked")}</div>
                  </div>
                  <div class="inspector-group">
                    <label>Adjacent Scenes</label>
                    <div class="inspector-footnote">Previous: ${escapeHtml(inspector.previousSceneSummary || "None")}</div>
                    <div class="inspector-footnote">Next: ${escapeHtml(inspector.nextSceneSummary || "None")}</div>
                  </div>
                `
                : ""
            }
            ${
              !isSceneSelection && canEditTimelineItem
                ? `
                  <div class="inspector-group">
                    <label>AI Director</label>
                    <div class="inline-actions inspector-timeline-actions">
                      <button class="ghost-button compact-button inspector-button" type="button" data-action="generate-next-shot">Generate Next Shot</button>
                      <button class="ghost-button compact-button inspector-button" type="button" data-action="generate-cutaway">Generate Cutaway</button>
                      <button class="ghost-button compact-button inspector-button" type="button" data-action="extend-selected-clip">Extend Scene</button>
                      <button class="ghost-button compact-button inspector-button" type="button" data-action="open-clip-scene-video-clips">Open Scene Clips</button>
                    </div>
                  </div>
                `
                : ""
            }
            <div class="inspector-group">
              <label>Continuity</label>
              ${
                continuityWarnings.length
                  ? `
                    <div class="inspector-warning-list">
                      ${continuityWarnings.map((warning) => `<div class="inspector-warning-item">${escapeHtml(warning)}</div>`).join("")}
                    </div>
                  `
                  : '<div class="inspector-footnote">No continuity issues detected in the current context.</div>'
              }
            </div>
            <div class="inspector-group">
              <label>Transition</label>
              ${
                !isSceneSelection && transitionState?.editable
                  ? `
                    <div class="inspector-grid">
                      <select class="inspector-input" data-input="clip-transition-type">
                        <option value="cut" ${transitionState.transition.type === "cut" ? "selected" : ""}>Cut</option>
                        <option value="crossfade" ${transitionState.transition.type === "crossfade" ? "selected" : ""}>Crossfade</option>
                        <option value="dip_black" ${transitionState.transition.type === "dip_black" ? "selected" : ""}>Dip to Black</option>
                        <option value="wipe_left" ${transitionState.transition.type === "wipe_left" ? "selected" : ""}>Wipe Left</option>
                      </select>
                      <input class="inspector-input inspector-input-compact" type="number" min="0.05" max="2" step="0.05" value="${transitionState.transition.duration}" data-input="clip-transition-duration" />
                    </div>
                    <div class="inspector-footnote">To ${escapeHtml(transitionState.nextItem.name)}</div>
                  `
                  : `<div class="inspector-footnote">${escapeHtml(isSceneSelection ? "Scene segments describe story structure and do not have clip transitions." : transitionState?.reason || "Select a video clip to edit transitions.")}</div>`
              }
            </div>
            <div class="inspector-group">
              <label>Timeline</label>
              <div class="inline-actions inspector-timeline-actions">
                <button class="ghost-button compact-button icon-button" type="button" data-action="timeline-move-clip-left" title="Move Left" aria-label="Move Left" ${isSceneSelection ? "disabled" : ""}>${renderUiIcon("left")}</button>
                <button class="ghost-button compact-button icon-button" type="button" data-action="timeline-move-clip-right" title="Move Right" aria-label="Move Right" ${isSceneSelection ? "disabled" : ""}>${renderUiIcon("right")}</button>
                <button class="ghost-button compact-button icon-button" type="button" data-action="timeline-move-clip-up" title="Track Up" aria-label="Track Up" ${isSceneSelection ? "disabled" : ""}>${renderUiIcon("up")}</button>
                <button class="ghost-button compact-button icon-button" type="button" data-action="timeline-move-clip-down" title="Track Down" aria-label="Track Down" ${isSceneSelection ? "disabled" : ""}>${renderUiIcon("down")}</button>
              </div>
            </div>
            <div class="inspector-group">
              <label>Audio</label>
              <div class="slider-shell">
                <div class="slider-fill" style="width:${inspector.volume}%"></div>
              </div>
              ${
                canEditTimelineItem && !isSceneSelection && context.selectedTimelineItem?.kind !== "title"
                  ? `<input class="volume-range" type="range" min="0" max="100" value="${inspector.volume}" data-input="clip-volume" />`
                  : ""
              }
              <div class="inspector-footnote">${inspector.volumeLabel}</div>
            </div>
            <div class="inspector-group">
              <label>Sync</label>
              <div class="sync-card">
                <strong>${project.syncLabel}</strong>
                <span>Project type: ${formatProjectTypeLabel(project.type)}</span>
              </div>
            </div>
          </section>
        </aside>
      `;
    }

    return {
      renderEditWorkspace
    };
  }

  globalScope.EditorWorkspaceModules = {
    createWorkspaceHelpers
  };
})(window);
