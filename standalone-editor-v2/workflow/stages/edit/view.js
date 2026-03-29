(function attachV2EditStage(globalScope) {
  function iconLabel(icon, label, iconOnly = false) {
    return iconOnly
      ? `<span class="v2-icon" aria-hidden="true">${icon}</span><span class="v2-visually-hidden">${label}</span>`
      : `<span class="v2-icon" aria-hidden="true">${icon}</span><span>${label}</span>`;
  }

  function formatDuration(seconds) {
    const value = Math.max(0, Number(seconds || 0));
    const minutes = Math.floor(value / 60);
    const remainder = Math.floor(value % 60);
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function formatTimelineTickLabel(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds || 0)));
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function getTimelinePixelsPerSecond() {
    return 44;
  }

  function getTimelineItemWidth(item) {
    const duration = Math.max(1, Number(item?.durationSeconds || 1));
    const width = duration * getTimelinePixelsPerSecond();
    return Math.max(180, Math.round(width));
  }

  function formatImportedAssetMeta(item) {
    const kindMap = {
      video: "Clip",
      image: "Image",
      audio: "Audio"
    };
    const kind = kindMap[item.kind] || "Asset";
    const parts = [kind];
    if (item.kind !== "image") {
      parts.push(formatDuration(item.durationSeconds));
    }
    return parts.join(" | ");
  }

  function renderPreviewThumb(item, fallbackText) {
    if (item?.type === "audio" || item?.kind === "audio") {
      return `<div class="v2-edit-bin-audio">Audio</div>`;
    }
    if (item?.type === "image" || item?.kind === "image") {
      const imageUrl = item.thumbnailUrl || item.sourceUrl || item.videoUrl || "";
      return imageUrl
        ? `<img src="${imageUrl}" alt="${item.title || item.name || "Preview"}">`
        : `<div class="v2-note">${fallbackText}</div>`;
    }
    const videoUrl = item.thumbnailUrl || item.sourceUrl || item.videoUrl || "";
    return videoUrl
      ? `<video src="${videoUrl}" muted playsinline preload="metadata"></video>`
      : `<div class="v2-note">${fallbackText}</div>`;
  }

  function renderMediaBinItem(item, selectedItem) {
    return `
      <button class="v2-edit-bin-item ${selectedItem?.id === item.id ? "active" : ""}" type="button" data-action="select-edit-item" data-edit-item-id="${item.id}">
        <div class="v2-edit-bin-thumb">
          ${renderPreviewThumb(item, "No preview")}
        </div>
        <div class="v2-edit-bin-copy">
          <strong>${item.title}</strong>
          <span>${item.trackId || "V1"} | ${formatDuration(item.durationSeconds)}</span>
        </div>
      </button>
    `;
  }

  function renderImportedAssetItem(item, selectedItem, activeScene) {
    const addLabel = activeScene
      ? `Add To ${activeScene.title}`
      : (item.kind === "audio" ? "Add As Music" : "Add As Temp");
    return `
      <article class="v2-edit-import-item ${selectedItem?.id === item.id ? "active" : ""}">
        <button class="v2-edit-import-select" type="button" data-action="select-imported-asset" data-asset-id="${item.id}">
          <div class="v2-edit-bin-thumb">
            ${renderPreviewThumb(item, "No preview")}
          </div>
          <div class="v2-edit-bin-copy">
            <strong>${item.name}</strong>
            <span>${formatImportedAssetMeta(item)}</span>
          </div>
          <div class="v2-edit-item-role">Source</div>
        </button>
        <button class="v2-button-ghost v2-button-inline" type="button" data-action="add-imported-asset-to-timeline" data-asset-id="${item.id}">
          ${addLabel}
        </button>
      </article>
    `;
  }

  function renderProjectItem(project, activeProject) {
    return `
      <button class="v2-edit-project-item ${Number(project.id) === Number(activeProject?.id) ? "active" : ""}" type="button" data-action="open-project" data-project-id="${project.id}" data-project-type="${project.type || project.project_type || "film"}" data-project-title="${project.title || project.name || "Untitled Project"}">
        <span>${project.title || project.name || "Untitled Project"}</span>
        <small>${project.type || project.project_type || "project"}</small>
      </button>
    `;
  }

  function formatPlacementType(value) {
    const normalized = String(value || "").trim();
    const labels = {
      scene_shot: "Scene Shot",
      temp: "Temp Clip",
      reference: "Reference",
      broll: "B-Roll",
      music: "Music",
      sfx: "SFX",
      voiceover: "Voiceover",
      source_asset: "Source Asset"
    };
    return labels[normalized] || (normalized || "Unassigned");
  }

  function renderPlacementSelect(selectedItem) {
    const options = [
      { value: "scene_shot", label: "Scene Shot" },
      { value: "temp", label: "Temp Clip" },
      { value: "reference", label: "Reference" },
      { value: "broll", label: "B-Roll" },
      { value: "music", label: "Music" },
      { value: "voiceover", label: "Voiceover" },
      { value: "sfx", label: "SFX" }
    ];
    return `
      <label class="v2-edit-placement-field">
        <span>Placement Type</span>
        <select class="v2-studio-input v2-edit-scene-select" data-action="set-selected-item-placement">
          ${options.map((option) => `
            <option value="${option.value}" ${String(selectedItem?.placementType || "") === option.value ? "selected" : ""}>${option.label}</option>
          `).join("")}
        </select>
      </label>
    `;
  }

  function getSceneSegments(videoDraft, editDraft) {
    let runningStartSeconds = 0;
    return (videoDraft.scenes || []).map((scene) => {
      const normalizedSceneId = scene.scriptSceneId || scene.id;
      const sceneItems = editDraft.timelineItems.filter((item) => item.sceneId === normalizedSceneId);
      const sceneDurationSeconds = sceneItems.length
        ? sceneItems.reduce((maxSeconds, item) => Math.max(maxSeconds, Number(item.startSeconds || 0) + Number(item.durationSeconds || 0)), 0)
        : Math.max(4, Number(scene.clips?.length || 1) * 4);
      const assembledCount = scene.clips.filter((clip) =>
        sceneItems.some((item) => String(item.requestId || "") === String(clip.id))
      ).length;
      const sourceScene = (globalScope.CreatorAppV2PipelineIntelligence && globalScope.CreatorAppV2PipelineIntelligence.summarizeSceneExecution)
        ? globalScope.CreatorAppV2PipelineIntelligence.summarizeSceneExecution(scene).confidence
        : null;
      const segment = {
        id: scene.id,
        videoSceneId: scene.id,
        sceneId: normalizedSceneId,
        title: scene.title,
        clipCount: scene.clips.length,
        assembledCount,
        startSeconds: runningStartSeconds,
        slots: (scene.clips || []).map((clip) => ({
          id: clip.id,
          requestId: clip.id,
          title: clip.title,
          shotRole: clip.shotRole,
          status: sceneItems.some((item) => String(item.requestId || "") === String(clip.id))
            ? "assembled"
            : clip.approvedClipId
              ? "fulfilled"
            : clip.generatedClips?.length
              ? "generated"
              : String(clip.clipPrompt || "").trim()
                ? "planned"
                : "missing"
        })),
        width: getTimelineItemWidth({ durationSeconds: sceneDurationSeconds }),
        confidence: sourceScene
      };
      runningStartSeconds += sceneDurationSeconds;
      return segment;
    });
  }

  function renderSceneTrack(segments, editDraft) {
    if (!segments.length) {
      return `<div class="v2-note">No scene structure is available yet.</div>`;
    }

    return `
      <div class="v2-edit-scene-track-strip">
        ${segments.map((segment) => `
          <button class="v2-edit-scene-segment ${segment.assembledCount ? "covered" : ""} ${String(editDraft.activeSceneId || "") === String(segment.sceneId) ? "active" : ""}" type="button" data-action="set-edit-active-scene-click" data-scene-id="${segment.sceneId}" style="width:${segment.width}px; min-width:${segment.width}px;">
            <div class="v2-edit-scene-block-head">
              <span class="v2-card-eyebrow">Scene</span>
              <span class="v2-chip">${segment.assembledCount}/${segment.clipCount}</span>
            </div>
            <strong>${segment.title}</strong>
            ${segment.confidence ? `<span class="v2-edit-scene-signal">${segment.confidence.label} ${segment.confidence.score}%</span>` : ""}
            <span>${segment.assembledCount} slot${segment.assembledCount === 1 ? "" : "s"} assembled</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderTimelineRuler(editDraft) {
    const totalDuration = Math.max(15, Math.ceil(Number(editDraft.totalDurationSeconds || 0)));
    const tickSpacingSeconds = 5;
    const tickCount = Math.max(4, Math.ceil(totalDuration / tickSpacingSeconds));
    const ticks = [];

    for (let index = 0; index <= tickCount; index += 1) {
      const seconds = index * tickSpacingSeconds;
      ticks.push(`
        <span style="left:${seconds * getTimelinePixelsPerSecond()}px">${formatTimelineTickLabel(seconds)}</span>
      `);
    }

    return `
      <div class="v2-edit-ruler" data-action="seek-timeline" data-pixels-per-second="${getTimelinePixelsPerSecond()}" style="width:${Math.max(720, totalDuration * getTimelinePixelsPerSecond())}px">
        ${ticks.join("")}
      </div>
    `;
  }

  function getTimelineSurfaceWidth(editDraft) {
    const totalDuration = Math.max(15, Math.ceil(Number(editDraft.totalDurationSeconds || 0)));
    return Math.max(720, totalDuration * getTimelinePixelsPerSecond());
  }

  function getPlayheadOffset(editDraft) {
    return Math.max(0, Number(editDraft.playheadSeconds || 0)) * getTimelinePixelsPerSecond();
  }

  function renderTimelineMarkers(editDraft) {
    const markers = Array.isArray(editDraft.markers) ? editDraft.markers : [];
    if (!markers.length) {
      return "";
    }
    return `
      <div class="v2-edit-marker-strip">
        ${markers.map((marker) => `
          <button class="v2-edit-marker" type="button" data-action="set-playhead" data-playhead-seconds="${Number(marker.timeSeconds || 0)}" style="left:${Number(marker.timeSeconds || 0) * getTimelinePixelsPerSecond()}px;">
            <span>${marker.label}</span>
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderTimelineItem(item, index, selectedItem, trackId) {
    return `
      <div class="v2-edit-sequence-clip ${selectedItem?.id === item.id ? "active" : ""}" draggable="true" tabindex="0" role="button" aria-label="${item.title}" data-action="select-edit-item" data-edit-item-id="${item.id}" data-drag-timeline-item-id="${item.id}" data-drag-track-id="${trackId}" data-duration-seconds="${Math.max(1, Number(item.durationSeconds || 1))}" style="width:${getTimelineItemWidth(item)}px; min-width:${getTimelineItemWidth(item)}px;">
        <div class="v2-edit-trim-handle v2-edit-trim-handle-start" data-trim-handle="start" data-edit-item-id="${item.id}" title="Trim in"></div>
        <div class="v2-edit-sequence-index">${String(index + 1).padStart(2, "0")}</div>
        <div class="v2-edit-sequence-thumb">
          ${renderPreviewThumb(item, "No frame")}
        </div>
        <div class="v2-edit-sequence-copy">
          <strong>${item.title}</strong>
          <span>${trackId} | ${formatDuration(item.durationSeconds)}${item.sceneTitle ? ` | ${item.sceneTitle}` : ""}</span>
        </div>
        <div class="v2-edit-item-role">${formatPlacementType(item.placementType)}</div>
        <div class="v2-edit-trim-handle v2-edit-trim-handle-end" data-trim-handle="end" data-edit-item-id="${item.id}" title="Trim out"></div>
      </div>
    `;
  }

  function getSlotActionLabel(status) {
    const normalized = String(status || "").trim();
    if (normalized === "missing") {
      return "Generate";
    }
    if (normalized === "planned") {
      return "Queue";
    }
    if (normalized === "generated") {
      return "Review";
    }
    if (normalized === "fulfilled") {
      return "Replace";
    }
    if (normalized === "assembled") {
      return "Cut In";
    }
    return "Open";
  }

  function renderSceneSlotStrip(slots) {
    if (!slots.length) {
      return "";
    }
    return `
      <div class="v2-edit-slot-strip">
        ${slots.map((slot, index) => `
          <button class="v2-edit-slot-pill v2-edit-slot-pill-${slot.status}" type="button" data-action="focus-scene-slot" data-video-scene-id="${slot.videoSceneId}" data-video-request-id="${slot.requestId}">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <strong>${slot.shotRole || slot.title || "Shot"}</strong>
            <em>${getSlotActionLabel(slot.status)}</em>
          </button>
        `).join("")}
      </div>
    `;
  }

  function renderTimelineStrip(items, selectedItem, trackId, segments, activeSceneId) {
    if (!items.length) {
      return `<div class="v2-note">No ${trackId} items yet.</div>`;
    }

    const assignedIds = new Set();
    const grouped = segments.map((segment) => {
      const sceneItems = items.filter((item) => {
        const matches = String(item.sceneId || "") === String(segment.sceneId);
        if (matches) {
          assignedIds.add(item.id);
        }
        return matches;
      });
      return {
        ...segment,
        items: sceneItems
      };
    });
    const unassignedItems = items.filter((item) => !assignedIds.has(item.id));
    const unassignedStartSeconds = unassignedItems.length
      ? Math.min(...unassignedItems.map((item) => Number(item.startSeconds || 0)))
      : 0;
    const unassignedEndSeconds = unassignedItems.length
      ? Math.max(...unassignedItems.map((item) => Number(item.startSeconds || 0) + Number(item.durationSeconds || 0)))
      : 0;
    const unassignedWidth = Math.max(280, getTimelineItemWidth({ durationSeconds: Math.max(1, unassignedEndSeconds - unassignedStartSeconds) }));

    return `
      <div class="v2-edit-sequence-strip v2-edit-sequence-strip-grouped">
        ${grouped.map((group) => `
          <section class="v2-edit-scene-group ${String(activeSceneId || "") === String(group.sceneId) ? "active" : ""}" style="width:${group.width}px; min-width:${group.width}px;">
            <div class="v2-edit-scene-group-head">
              <span>${group.title}</span>
              <strong>${group.items.length} ${trackId}</strong>
            </div>
            ${trackId === "V1" ? renderSceneSlotStrip((group.slots || []).map((slot) => ({ ...slot, videoSceneId: group.videoSceneId }))) : ""}
            <div class="v2-edit-scene-group-body" data-drop-track-id="${trackId}" data-drop-scene-id="${group.sceneId}" data-drop-scene-title="${group.title}" data-drop-start-seconds="${Number(group.startSeconds || 0)}">
              ${group.items.length
                ? group.items.map((item, index) => {
                    const itemMarkup = renderTimelineItem(item, index, selectedItem, trackId);
                    const playheadSeconds = Number(item.startSeconds || 0);
                    const relativeStartSeconds = Math.max(0, playheadSeconds - Number(group.startSeconds || 0));
                    return itemMarkup.replace(
                      'style="',
                      `data-playhead-seconds="${playheadSeconds}" style="left:${relativeStartSeconds * getTimelinePixelsPerSecond()}px; `
                    );
                  }).join("")
                : `<div class="v2-edit-scene-group-empty">No ${trackId} placements</div>`}
            </div>
          </section>
        `).join("")}
        ${unassignedItems.length ? `
          <section class="v2-edit-scene-group v2-edit-scene-group-unassigned" style="width:${unassignedWidth}px; min-width:${unassignedWidth}px;">
            <div class="v2-edit-scene-group-head">
              <span>Unassigned</span>
              <strong>${unassignedItems.length} ${trackId}</strong>
            </div>
            <div class="v2-edit-scene-group-body" data-drop-track-id="${trackId}" data-drop-scene-id="" data-drop-scene-title="" data-drop-start-seconds="${Number(unassignedStartSeconds || 0)}">
              ${unassignedItems.map((item, index) => {
                const itemMarkup = renderTimelineItem(item, index, selectedItem, trackId);
                const playheadSeconds = Number(item.startSeconds || 0);
                const relativeStartSeconds = Math.max(0, playheadSeconds - unassignedStartSeconds);
                return itemMarkup.replace(
                  'style="',
                  `data-playhead-seconds="${playheadSeconds}" style="left:${relativeStartSeconds * getTimelinePixelsPerSecond()}px; `
                );
              }).join("")}
            </div>
          </section>
        ` : ""}
      </div>
    `;
  }

  function renderProgramMonitor(selectedItem) {
    if (!selectedItem?.videoUrl) {
      return `<div class="v2-note">Build a rough cut and select a clip to begin previewing the sequence.</div>`;
    }
    if (selectedItem.type === "audio") {
      return `<audio src="${selectedItem.videoUrl}" controls preload="metadata"></audio>`;
    }
    if (selectedItem.type === "image") {
      return `<img src="${selectedItem.videoUrl}" alt="${selectedItem.title}">`;
    }
    return `<video src="${selectedItem.videoUrl}" controls preload="metadata"></video>`;
  }

  function getSelectionContext(selectedItem) {
    const isSource = selectedItem?.sourceKind === "imported";
    return {
      roleLabel: isSource ? "Source Asset" : selectedItem ? "Timeline Clip" : "Idle",
      monitorLabel: isSource ? "Source" : "Program",
      monitorMode: isSource ? "Source Monitor" : "Program Monitor",
      originLabel: isSource ? "Imported Media Bin" : "Sequence Timeline"
    };
  }

  function getSelectedRequestTrace(videoDraft, selectedItem) {
    if (!selectedItem?.requestId) {
      return null;
    }
    return globalScope.CreatorAppV2PipelineIntelligence.findVideoClipRequest(videoDraft, selectedItem.requestId);
  }

  function renderEditStage(stage, state) {
    const activeProject = state?.projectWorkspace?.activeProject;
    const editDraft = globalScope.CreatorAppV2EditState.getEditDraft({ getState: () => state });
    const selectedItem = globalScope.CreatorAppV2EditState.getSelectedEditItem({ getState: () => state });
    const coverage = globalScope.CreatorAppV2EditState.getEditCoverage({ getState: () => state });
    const videoDraft = globalScope.CreatorAppV2ClipGenerationState.getVideoClipsDraft({ getState: () => state });
    const workspaceProjects = Array.isArray(state?.workspace?.projects?.items) ? state.workspace.projects.items : [];
    const importedAssets = Array.isArray(state?.projectWorkspace?.importedAssets) ? state.projectWorkspace.importedAssets : [];
    const videoTimelineItems = editDraft.timelineItems.filter((item) => item.type !== "audio");
    const audioTimelineItems = editDraft.timelineItems.filter((item) => item.type === "audio");
    const narrativeVideoItems = videoTimelineItems.filter((item) => item.placementType === "scene_shot");
    const supportVideoItems = videoTimelineItems.filter((item) => item.placementType !== "scene_shot");
    const musicAudioItems = audioTimelineItems.filter((item) => item.placementType === "music");
    const supportAudioItems = audioTimelineItems.filter((item) => item.placementType !== "music");
    const selectionContext = getSelectionContext(selectedItem);
    const timelineSurfaceWidth = getTimelineSurfaceWidth(editDraft);
    const selectedTrace = getSelectedRequestTrace(videoDraft, selectedItem);
    const activeScene = globalScope.CreatorAppV2EditState.getActiveScene({ getState: () => state });
    const sceneSegments = getSceneSegments(videoDraft, editDraft);
    const selectedTimelineItem = selectedItem && !selectedItem.sourceKind ? selectedItem : null;

    if (!activeProject) {
      return `
        <div class="v2-stage-header">
          <div>
            <div class="v2-eyebrow">Step 6</div>
            <h2>${stage.label}</h2>
            <p>${stage.summary}</p>
          </div>
          <button class="v2-button" type="button" data-action="open-dashboard">Open Dashboard</button>
        </div>
        <div class="v2-stage-body">
          <div class="v2-note">Open a project first. Edit should feel like a true film editor with a preview monitor, source bin, scene track, and sequence timeline.</div>
        </div>
      `;
    }

    return `
      <div class="v2-stage-header">
        <div>
          <div class="v2-eyebrow">Step 6</div>
          <h2>${stage.label}</h2>
          <p>${stage.summary}</p>
        </div>
        <div class="v2-topbar-actions">
          <button class="v2-button" type="button" data-action="build-edit-rough-cut">Build Rough Cut</button>
          <button class="v2-button-ghost" type="button" data-stage-id="export_release">Advance to Export / Release</button>
        </div>
      </div>
      <div class="v2-stage-body">
        <section class="v2-edit-v1-shell">
          <aside class="v2-edit-v1-left">
            <div class="v2-edit-v1-panel">
              <div class="v2-edit-panel-head">
                <div>
                  <div class="v2-card-eyebrow">Projects</div>
                  <h3>Studio Projects</h3>
                </div>
                <div class="v2-chip">${workspaceProjects.length}</div>
              </div>
              <div class="v2-edit-project-list">
                ${workspaceProjects.length
                  ? workspaceProjects.slice(0, 8).map((project) => renderProjectItem(project, activeProject)).join("")
                  : `<div class="v2-note">No studio projects loaded.</div>`}
              </div>
            </div>

            <div class="v2-edit-v1-panel">
              <div class="v2-edit-panel-head">
                <div>
                  <div class="v2-card-eyebrow">Media Bin</div>
                  <h3>Imported + Selected</h3>
                </div>
                <div class="v2-edit-monitor-meta">
                  <span class="v2-chip">${importedAssets.length} imported</span>
                  <span class="v2-chip">${editDraft.timelineItems.length} selected</span>
                </div>
              </div>
              <div class="v2-edit-bin-actions">
                <button class="v2-button-ghost v2-button-inline v2-button-has-icon" type="button" data-action="import-assets">${iconLabel("＋", "Import Media")}</button>
              </div>
              <div class="v2-edit-bin-list">
                ${importedAssets.length
                  ? importedAssets.map((item) => renderImportedAssetItem(item, selectedItem, activeScene)).join("")
                  : `<div class="v2-note">Import local clips, images, or audio files into the media bin.</div>`}
                ${editDraft.timelineItems.length
                  ? editDraft.timelineItems.map((item) => renderMediaBinItem(item, selectedItem)).join("")
                  : `<div class="v2-note">Approved generated clips will appear here once the rough cut is built.</div>`}
              </div>
            </div>
          </aside>

          <main class="v2-edit-v1-center">
            <div class="v2-edit-v1-panel v2-edit-v1-timeline-panel">
              <div class="v2-edit-panel-head">
                <div>
                  <div class="v2-card-eyebrow">Timeline</div>
                  <h3>Rough Cut</h3>
                </div>
                <div class="v2-edit-monitor-meta">
                  <span class="v2-chip">${formatDuration(coverage.totalDurationSeconds)}</span>
                  <span class="v2-chip">24 fps</span>
                  <span class="v2-chip">${coverage.timelineItems} clips</span>
                </div>
              </div>
              <div class="v2-edit-toolbar">
                <div class="v2-edit-toolbar-group v2-edit-toolbar-scene-group">
                  <label class="v2-edit-active-scene">
                    <span>Active Scene</span>
                    <select class="v2-studio-input v2-edit-scene-select" data-action="set-edit-active-scene">
                      ${videoDraft.scenes.map((scene) => `
                        <option value="${scene.scriptSceneId || scene.id}" ${String(activeScene?.scriptSceneId || activeScene?.id || "") === String(scene.scriptSceneId || scene.id) ? "selected" : ""}>${scene.title}</option>
                      `).join("")}
                    </select>
                  </label>
                  <button class="v2-button-ghost v2-button-inline" type="button" data-action="assign-selected-item-to-active-scene" ${selectedItem && !selectedItem.sourceKind ? "" : "disabled"}>Assign To Scene</button>
                </div>
              <div class="v2-edit-toolbar-group">
                  <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Trim Shorter" type="button" data-action="trim-selected-item-shorter" ${selectedTimelineItem ? "" : "disabled"}>${iconLabel("⟨", "Trim Shorter", true)}</button>
                  <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Trim Longer" type="button" data-action="trim-selected-item-longer" ${selectedTimelineItem ? "" : "disabled"}>${iconLabel("⟩", "Trim Longer", true)}</button>
                  <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Add Marker" type="button" data-action="add-timeline-marker">${iconLabel("◆", "Marker", true)}</button>
                </div>
                <div class="v2-edit-toolbar-group">
                  <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Move Left" type="button" data-action="move-selected-item-left" ${selectedTimelineItem ? "" : "disabled"}>${iconLabel("←", "Left", true)}</button>
                  <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Move Right" type="button" data-action="move-selected-item-right" ${selectedTimelineItem ? "" : "disabled"}>${iconLabel("→", "Right", true)}</button>
                  <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Move Up" type="button" data-action="move-selected-item-up" ${selectedTimelineItem ? "" : "disabled"}>${iconLabel("↑", "Up", true)}</button>
                  <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Move Down" type="button" data-action="move-selected-item-down" ${selectedTimelineItem ? "" : "disabled"}>${iconLabel("↓", "Down", true)}</button>
                </div>
                <div class="v2-edit-toolbar-group">
                  <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Split" type="button" data-action="split-selected-item" ${selectedTimelineItem ? "" : "disabled"}>${iconLabel("✂", "Split", true)}</button>
                  <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Duplicate" type="button" data-action="duplicate-selected-item" ${selectedTimelineItem ? "" : "disabled"}>${iconLabel("⧉", "Duplicate", true)}</button>
                  <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Delete" type="button" data-action="remove-selected-item" ${selectedTimelineItem ? "" : "disabled"}>${iconLabel("⌫", "Delete", true)}</button>
                </div>
              </div>
              <div class="v2-edit-timeline-scroll">
                <div class="v2-edit-ruler-shell">
                  ${renderTimelineRuler(editDraft)}
                  ${renderTimelineMarkers(editDraft)}
                  <div class="v2-edit-playhead" style="left:${getPlayheadOffset(editDraft)}px;"></div>
                </div>
                <div class="v2-edit-timeline-surface" data-action="seek-timeline" data-pixels-per-second="${getTimelinePixelsPerSecond()}" style="width:${timelineSurfaceWidth}px; min-width:${timelineSurfaceWidth}px;">
                  <div class="v2-edit-playhead v2-edit-playhead-surface" style="left:${getPlayheadOffset(editDraft)}px;"></div>
                  <div class="v2-edit-track-shell">
                    <div class="v2-edit-track-label">Scene</div>
                    <div class="v2-edit-track-body">
                      ${renderSceneTrack(sceneSegments, editDraft)}
                    </div>
                  </div>
                  <div class="v2-edit-track-shell">
                    <div class="v2-edit-track-label">V1</div>
                    <div class="v2-edit-track-body">
                      ${renderTimelineStrip(narrativeVideoItems, selectedItem, "V1", sceneSegments, activeScene?.scriptSceneId || activeScene?.id || "")}
                    </div>
                  </div>
                  <div class="v2-edit-track-shell">
                    <div class="v2-edit-track-label">V2</div>
                    <div class="v2-edit-track-body">
                      ${renderTimelineStrip(supportVideoItems, selectedItem, "V2", sceneSegments, activeScene?.scriptSceneId || activeScene?.id || "")}
                    </div>
                  </div>
                  <div class="v2-edit-track-shell">
                    <div class="v2-edit-track-label">A1</div>
                    <div class="v2-edit-track-body">
                      ${renderTimelineStrip(musicAudioItems, selectedItem, "A1", sceneSegments, activeScene?.scriptSceneId || activeScene?.id || "")}
                    </div>
                  </div>
                  <div class="v2-edit-track-shell">
                    <div class="v2-edit-track-label">A2</div>
                    <div class="v2-edit-track-body">
                      ${renderTimelineStrip(supportAudioItems, selectedItem, "A2", sceneSegments, activeScene?.scriptSceneId || activeScene?.id || "")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          <aside class="v2-edit-v1-right">
            <div class="v2-edit-v1-panel v2-edit-v1-preview-panel">
              <div class="v2-edit-panel-head">
                <div>
                  <div class="v2-card-eyebrow">Preview</div>
                  <h3>${selectionContext.monitorLabel}</h3>
                </div>
                <div class="v2-edit-monitor-meta">
                  <span class="v2-chip">${selectionContext.monitorMode}</span>
                  <span class="v2-chip">1080p Draft</span>
                </div>
              </div>
              <div class="v2-edit-monitor" data-edit-monitor>
                ${renderProgramMonitor(selectedItem)}
              </div>
              <div class="v2-edit-transport">
                <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Play" type="button" data-action="play-timeline">${iconLabel("▶", "Play", true)}</button>
                <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Pause" type="button" data-action="pause-timeline">${iconLabel("❚❚", "Pause", true)}</button>
                <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Stop" type="button" data-action="stop-timeline">${iconLabel("■", "Stop", true)}</button>
                <button class="v2-button-ghost v2-button-inline v2-button-icon" title="Step" type="button" data-action="step-timeline">${iconLabel("▷|", "Step", true)}</button>
                <span class="v2-chip" data-edit-playhead-label>${formatDuration(editDraft.playheadSeconds || 0)}</span>
              </div>
            </div>

            <div class="v2-edit-v1-panel v2-edit-v1-inspector-panel">
              <div class="v2-edit-panel-head">
                <div>
                  <div class="v2-card-eyebrow">Inspector</div>
                  <h3>${selectedItem?.title || "No Selection"}</h3>
                </div>
                <div class="v2-chip">${selectionContext.roleLabel}</div>
              </div>
              ${selectedItem
                ? `
                  <div class="v2-edit-inspector-grid">
                    <div class="v2-card">
                      <div class="v2-card-eyebrow">Origin</div>
                      <h3>${selectionContext.originLabel}</h3>
                    </div>
                    <div class="v2-card">
                      <div class="v2-card-eyebrow">Scene</div>
                      <h3>${selectedItem.sceneTitle || selectedItem.sceneId || (selectedItem.sourceKind ? "Library Only" : "Unassigned")}</h3>
                    </div>
                    <div class="v2-card">
                      <div class="v2-card-eyebrow">Placement</div>
                      <h3>${formatPlacementType(selectedItem.placementType)}</h3>
                    </div>
                    <div class="v2-card">
                      <div class="v2-card-eyebrow">Clip Slot</div>
                      <h3>${selectedItem.requestId || "Unassigned"}</h3>
                    </div>
                    <div class="v2-card">
                      <div class="v2-card-eyebrow">Shot Role</div>
                      <h3>${selectedItem.shotRole || selectedTrace?.request?.shotRole || "manual"}</h3>
                    </div>
                    <div class="v2-card">
                      <div class="v2-card-eyebrow">Track</div>
                      <h3>${selectedItem.trackId || "V1"}</h3>
                    </div>
                    <div class="v2-card">
                      <div class="v2-card-eyebrow">Type</div>
                      <h3>${selectedItem.type || "video"}</h3>
                    </div>
                    <div class="v2-card">
                      <div class="v2-card-eyebrow">Duration</div>
                      <h3>${formatDuration(selectedItem.durationSeconds)}</h3>
                    </div>
                    <div class="v2-card">
                      <div class="v2-card-eyebrow">Coverage</div>
                      <h3>${coverage.scenesCovered}/${coverage.totalScenes}</h3>
                    </div>
                    <div class="v2-card">
                      <div class="v2-card-eyebrow">Planning Source</div>
                      <h3>${selectedItem.planningSource || selectedTrace?.request?.planningSource || "manual"}</h3>
                    </div>
                  </div>
                  ${!selectedItem.sourceKind ? renderPlacementSelect(selectedItem) : ""}
                  ${selectedTrace
                    ? `
                      <div class="v2-edit-inspector-actions">
                        <button class="v2-button-ghost v2-button-inline" type="button" data-action="open-selected-item-slot">
                          Open Slot
                        </button>
                        <button class="v2-button-ghost v2-button-inline" type="button" data-action="replace-selected-item-from-approved">
                          Replace With Approved Take
                        </button>
                      </div>
                    `
                    : ""}
                  ${(selectedItem.clipPrompt || selectedItem.shotNotes || selectedTrace)
                    ? `
                      <div class="v2-trace-block">
                        <span>Shot Intent</span>
                        <p>${selectedTrace?.request?.title || selectedItem.title || "Untitled shot"}</p>
                      </div>
                      <div class="v2-trace-block">
                        <span>Prompt</span>
                        <p>${selectedItem.clipPrompt || selectedTrace?.request?.clipPrompt || "No prompt captured for this generated clip."}</p>
                      </div>
                      <div class="v2-trace-block">
                        <span>Shot Notes</span>
                        <p>${selectedItem.shotNotes || selectedTrace?.request?.shotNotes || "No shot notes captured for this generated clip."}</p>
                      </div>
                    `
                    : ""}
                  ${!selectedItem.sourceKind && !selectedItem.sceneId
                    ? `
                      <div class="v2-note">
                        This timeline placement is currently unassigned. Set an active scene and use Assign To Scene to convert it into a narrative shot container.
                      </div>
                    `
                    : ""}
                `
                : `<div class="v2-note">Select a clip in the timeline or media bin to inspect it.</div>`}
            </div>
          </aside>
        </section>

        <div class="v2-note">${stage.foundation}</div>
      </div>
    `;
  }

  globalScope.CreatorAppV2Stages = globalScope.CreatorAppV2Stages || {};
  globalScope.CreatorAppV2Stages.renderEditStage = renderEditStage;
})(window);
