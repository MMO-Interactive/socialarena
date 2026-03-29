(function attachV2Lifecycle(globalScope) {
  async function hydrateStudioWorkspace(store) {
    await globalScope.CreatorAppV2WorkspaceController.hydrateWorkspace(store);
  }

  function hasApprovedClipSelections(store) {
    const draft = globalScope.CreatorAppV2ClipGenerationState.getVideoClipsDraft(store);
    return draft.scenes.some((scene) =>
      scene.clips.some((clip) => Boolean(clip.approvedClipId || clip.generatedClips[0]))
    );
  }

  async function enterStage(store, stageId) {
    if (store.getState().session.status !== "studio_ready") {
      return;
    }

    const normalizedStageId = globalScope.CreatorAppV2Workflow.getStageById(stageId).id;
    store.setState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        currentView: "workflow"
      },
      projectWorkspace: {
        ...state.projectWorkspace,
        workflowStageId: normalizedStageId
      }
    }));
    globalScope.CreatorAppV2Workflow.setCurrentStage(store, normalizedStageId);

    if (store.getState().projectWorkspace?.activeProject) {
      await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
    }

    if (normalizedStageId === "edit") {
      await globalScope.CreatorAppV2ProjectController.hydrateImportedAssetMetadata(store);
      const editDraft = globalScope.CreatorAppV2EditState.getEditDraft(store);
      if (!editDraft.timelineItems.length && hasApprovedClipSelections(store)) {
        globalScope.CreatorAppV2EditActions.buildRoughCut(store);
      }
      return;
    }

    if (normalizedStageId === "export_release") {
      await globalScope.CreatorAppV2ExportReleaseActions.refreshExports(store);
    }
  }

  function bindLifecycle(appElement, store) {
    let draggedTimelineItemId = "";
    let draggedTimelineElement = null;
    let activeDropTarget = null;
    let activeDropClipTarget = null;
    let activeDropClipSide = "";
    let activeDragPreview = null;
    let trimInteraction = null;
    const sequencePlayback = {
      active: false,
      items: [],
      audioSchedules: [],
      index: -1,
      cumulativeBefore: 0,
      progressTimerId: null,
      imageTimeoutId: null,
      audioTimeoutIds: [],
      audioElements: [],
      mediaElement: null,
      imageStartedAtMs: 0
    };

    function getPreviewMediaElement() {
      return appElement.querySelector(".v2-edit-monitor video, .v2-edit-monitor audio");
    }

    function formatClockLabel(seconds) {
      const value = Math.max(0, Number(seconds || 0));
      const minutes = Math.floor(value / 60);
      const remainder = Math.floor(value % 60);
      return `${minutes}:${String(remainder).padStart(2, "0")}`;
    }

    function getTimelinePixelsPerSecond() {
      return 44;
    }

    function getTimelineItemWidthFromSeconds(durationSeconds) {
      return Math.max(180, Math.round(Math.max(1, Number(durationSeconds || 1)) * getTimelinePixelsPerSecond()));
    }

    function clearDragPreview() {
      if (activeDragPreview?.parentNode) {
        activeDragPreview.parentNode.removeChild(activeDragPreview);
      }
      activeDragPreview = null;
    }

    function syncDragPreview(targetBody, clientX) {
      if (!draggedTimelineElement || !targetBody) {
        clearDragPreview();
        return;
      }

      if (!activeDragPreview) {
        activeDragPreview = draggedTimelineElement.cloneNode(true);
        activeDragPreview.classList.remove("dragging", "active", "drag-target-before", "drag-target-after");
        activeDragPreview.classList.add("drag-preview");
        activeDragPreview.removeAttribute("draggable");
      }

      if (activeDragPreview.parentNode !== targetBody) {
        clearDragPreview();
        activeDragPreview = draggedTimelineElement.cloneNode(true);
        activeDragPreview.classList.remove("dragging", "active", "drag-target-before", "drag-target-after");
        activeDragPreview.classList.add("drag-preview");
        activeDragPreview.removeAttribute("draggable");
        targetBody.appendChild(activeDragPreview);
      }

      const rect = targetBody.getBoundingClientRect();
      const previewWidth = draggedTimelineElement.getBoundingClientRect().width || activeDragPreview.getBoundingClientRect().width || 180;
      const offsetLeft = Math.max(0, Math.min(rect.width - previewWidth, clientX - rect.left - (previewWidth / 2)));
      activeDragPreview.style.left = `${offsetLeft}px`;
      activeDragPreview.style.width = `${previewWidth}px`;
      activeDragPreview.style.minWidth = `${previewWidth}px`;
    }

    function updatePlayheadUi(seconds) {
      const safeSeconds = Math.max(0, Number(seconds || 0));
      const label = appElement.querySelector("[data-edit-playhead-label]");
      if (label) {
        label.textContent = formatClockLabel(safeSeconds);
      }
      appElement.querySelectorAll(".v2-edit-playhead").forEach((element) => {
        element.style.left = `${safeSeconds * getTimelinePixelsPerSecond()}px`;
      });
    }

    function clearSequenceTimers() {
      if (sequencePlayback.progressTimerId) {
        clearInterval(sequencePlayback.progressTimerId);
        sequencePlayback.progressTimerId = null;
      }
      if (sequencePlayback.imageTimeoutId) {
        clearTimeout(sequencePlayback.imageTimeoutId);
        sequencePlayback.imageTimeoutId = null;
      }
      if (Array.isArray(sequencePlayback.audioTimeoutIds)) {
        sequencePlayback.audioTimeoutIds.forEach((timeoutId) => clearTimeout(timeoutId));
        sequencePlayback.audioTimeoutIds = [];
      }
    }

    function stopSequencePlaybackState() {
      clearSequenceTimers();
      if (sequencePlayback.mediaElement?.pause) {
        sequencePlayback.mediaElement.pause();
      }
      if (Array.isArray(sequencePlayback.audioElements)) {
        sequencePlayback.audioElements.forEach((element) => {
          element.pause?.();
          element.remove?.();
        });
      }
      sequencePlayback.active = false;
      sequencePlayback.index = -1;
      sequencePlayback.cumulativeBefore = 0;
      sequencePlayback.audioSchedules = [];
      sequencePlayback.audioElements = [];
      sequencePlayback.mediaElement = null;
      sequencePlayback.imageStartedAtMs = 0;
    }

    function buildLaneTimeline(items) {
      return items
        .map((item) => ({
          ...item,
          startSeconds: Math.max(0, Number(item.startSeconds || 0)),
          endSeconds: Math.max(0, Number(item.startSeconds || 0)) + Math.max(1, Number(item.durationSeconds || 1))
        }))
        .sort((left, right) => Number(left.startSeconds || 0) - Number(right.startSeconds || 0));
    }

    function getSequenceItems() {
      const draft = globalScope.CreatorAppV2EditState.getEditDraft(store);
      const timelineItems = Array.isArray(draft.timelineItems) ? draft.timelineItems : [];
      const v1 = buildLaneTimeline(timelineItems.filter((item) => item.trackId === "V1" && item.type !== "audio" && String(item.videoUrl || "").trim()));
      const v2 = buildLaneTimeline(timelineItems.filter((item) => item.trackId === "V2" && item.type !== "audio" && String(item.videoUrl || "").trim()));
      const a1 = buildLaneTimeline(timelineItems.filter((item) => item.trackId === "A1" && item.type === "audio" && String(item.videoUrl || "").trim()));
      const a2 = buildLaneTimeline(timelineItems.filter((item) => item.trackId === "A2" && item.type === "audio" && String(item.videoUrl || "").trim()));
      return {
        visualItems: v1.length ? v1 : (v2.length ? v2 : buildLaneTimeline(timelineItems.filter((item) => item.type === "audio" && String(item.videoUrl || "").trim()))),
        audioSchedules: [...a1, ...a2]
      };
    }

    function getSequencePosition(items, playheadSeconds) {
      const target = Math.max(0, Number(playheadSeconds || 0));
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const startSeconds = Math.max(0, Number(item.startSeconds || 0));
        const endSeconds = startSeconds + Math.max(1, Number(item.durationSeconds || 1));
        if (target < endSeconds) {
          return {
            index,
            offsetSeconds: Math.max(0, target - startSeconds),
            cumulativeBefore: startSeconds
          };
        }
      }
      const finalItem = items[items.length - 1] || null;
      return {
        index: Math.max(0, items.length - 1),
        offsetSeconds: 0,
        cumulativeBefore: Math.max(0, Number(finalItem?.startSeconds || 0))
      };
    }

    function getCurrentSequencePlayhead() {
      if (!sequencePlayback.active || !sequencePlayback.items.length) {
        return globalScope.CreatorAppV2EditState.getPlayheadSeconds(store);
      }
      const currentItem = sequencePlayback.items[sequencePlayback.index];
      if (!currentItem) {
        return globalScope.CreatorAppV2EditState.getPlayheadSeconds(store);
      }
      if (currentItem.type === "image") {
        return sequencePlayback.cumulativeBefore + ((Date.now() - sequencePlayback.imageStartedAtMs) / 1000);
      }
      return sequencePlayback.cumulativeBefore + Number(sequencePlayback.mediaElement?.currentTime || 0);
    }

    function startSequenceProgressLoop() {
      clearSequenceTimers();
      sequencePlayback.progressTimerId = setInterval(() => {
        if (!sequencePlayback.active) {
          clearSequenceTimers();
          return;
        }
        updatePlayheadUi(getCurrentSequencePlayhead());
      }, 100);
    }

    function getAudioOverlayContainer() {
      const monitor = appElement.querySelector("[data-edit-monitor]");
      if (!monitor) {
        return null;
      }
      let visualContainer = monitor.querySelector("[data-edit-visual-layer]");
      if (!visualContainer) {
        visualContainer = document.createElement("div");
        visualContainer.setAttribute("data-edit-visual-layer", "true");
        monitor.appendChild(visualContainer);
      }
      let container = monitor.querySelector("[data-edit-audio-overlay]");
      if (!container) {
        container = document.createElement("div");
        container.setAttribute("data-edit-audio-overlay", "true");
        container.style.display = "none";
        monitor.appendChild(container);
      }
      return container;
    }

    function scheduleSequenceAudio(playheadSeconds) {
      const overlay = getAudioOverlayContainer();
      if (!overlay) {
        return;
      }
      sequencePlayback.audioElements = [];
      sequencePlayback.audioSchedules.forEach((entry) => {
        const audio = document.createElement("audio");
        audio.src = entry.videoUrl;
        audio.preload = "auto";
        overlay.appendChild(audio);
        sequencePlayback.audioElements.push(audio);

        const delayMs = Math.max(0, (Number(entry.startSeconds || 0) - playheadSeconds) * 1000);
        const playOffsetSeconds = playheadSeconds > Number(entry.startSeconds || 0)
          ? playheadSeconds - Number(entry.startSeconds || 0)
          : 0;

        const timeoutId = setTimeout(() => {
          if (!sequencePlayback.active) {
            return;
          }
          const startAudio = () => {
            audio.currentTime = Math.min(
              Math.max(0, playOffsetSeconds),
              Math.max(0, Number(audio.duration || entry.durationSeconds || 0))
            );
            audio.play().catch(() => {});
          };
          if (audio.readyState >= 1) {
            startAudio();
          } else {
            audio.addEventListener("loadedmetadata", startAudio, { once: true });
            audio.addEventListener("error", startAudio, { once: true });
          }
        }, delayMs);
        sequencePlayback.audioTimeoutIds.push(timeoutId);
      });
    }

    async function renderSequenceItem(item, offsetSeconds = 0) {
      const monitor = appElement.querySelector("[data-edit-monitor]");
      if (!monitor || !item) {
        return;
      }
      let visualContainer = monitor.querySelector("[data-edit-visual-layer]");
      if (!visualContainer) {
        visualContainer = document.createElement("div");
        visualContainer.setAttribute("data-edit-visual-layer", "true");
        monitor.appendChild(visualContainer);
      }
      visualContainer.innerHTML = "";

      if (item.type === "image") {
        const image = document.createElement("img");
        image.src = item.videoUrl;
        image.alt = item.title || "Sequence frame";
        visualContainer.appendChild(image);
        sequencePlayback.mediaElement = null;
        sequencePlayback.imageStartedAtMs = Date.now() - (offsetSeconds * 1000);
        const remainingMs = Math.max(250, (Math.max(1, Number(item.durationSeconds || 1)) - offsetSeconds) * 1000);
        sequencePlayback.imageTimeoutId = setTimeout(() => {
          void playSequenceAtIndex(sequencePlayback.index + 1, 0);
        }, remainingMs);
        startSequenceProgressLoop();
        return;
      }

      const media = document.createElement(item.type === "audio" ? "audio" : "video");
      media.src = item.videoUrl;
      media.preload = "auto";
      media.playsInline = true;
      media.controls = true;
      visualContainer.appendChild(media);
      sequencePlayback.mediaElement = media;

      media.addEventListener("ended", () => {
        if (sequencePlayback.active) {
          void playSequenceAtIndex(sequencePlayback.index + 1, 0);
        }
      }, { once: true });

      await new Promise((resolve) => {
        const handleReady = () => {
          media.currentTime = Math.min(Math.max(0, offsetSeconds), Math.max(0, Number(media.duration || item.durationSeconds || 0)));
          resolve();
        };
        if (media.readyState >= 1) {
          handleReady();
        } else {
          media.addEventListener("loadedmetadata", handleReady, { once: true });
          media.addEventListener("error", handleReady, { once: true });
        }
      });

      startSequenceProgressLoop();
      media.play().catch(() => {});
    }

    async function playSequenceAtIndex(index, offsetSeconds) {
      if (!sequencePlayback.items.length || index >= sequencePlayback.items.length) {
        stopSequencePlaybackState();
        const totalDuration = Math.max(
          Number(globalScope.CreatorAppV2EditState.getEditDraft(store).totalDurationSeconds || 0),
          ...sequencePlayback.audioSchedules.map((entry) => Number(entry.endSeconds || 0)),
          0
        );
        updatePlayheadUi(totalDuration);
        globalScope.CreatorAppV2EditActions.setPlayhead(store, totalDuration);
        return;
      }

      const nextItem = sequencePlayback.items[index];
      sequencePlayback.index = index;
      sequencePlayback.cumulativeBefore = Math.max(0, Number(nextItem.startSeconds || 0));
      sequencePlayback.active = true;
      await renderSequenceItem(nextItem, offsetSeconds);
    }

    function beginTrimInteraction(handleElement, clientX) {
      const clipElement = handleElement.closest("[data-edit-item-id][data-duration-seconds]");
      if (!clipElement) {
        return;
      }

      trimInteraction = {
        itemId: String(clipElement.dataset.editItemId || "").trim(),
        handle: String(handleElement.dataset.trimHandle || "end").trim(),
        clipElement,
        startX: Number(clientX || 0),
        originalDuration: Math.max(1, Number(clipElement.dataset.durationSeconds || 1)),
        currentDuration: Math.max(1, Number(clipElement.dataset.durationSeconds || 1))
      };
      clipElement.classList.add("trimming");
    }

    function updateTrimInteraction(clientX) {
      if (!trimInteraction) {
        return;
      }

      const deltaX = Number(clientX || 0) - trimInteraction.startX;
      const deltaSeconds = Math.round(Math.abs(deltaX) / getTimelinePixelsPerSecond());
      const wantsIncrease = trimInteraction.handle === "end" ? deltaX > 0 : deltaX < 0;
      const nextDuration = wantsIncrease
        ? trimInteraction.originalDuration + deltaSeconds
        : Math.max(1, trimInteraction.originalDuration - deltaSeconds);

      trimInteraction.currentDuration = nextDuration;
      trimInteraction.clipElement.dataset.durationSeconds = String(nextDuration);
      trimInteraction.clipElement.style.width = `${getTimelineItemWidthFromSeconds(nextDuration)}px`;
      trimInteraction.clipElement.style.minWidth = `${getTimelineItemWidthFromSeconds(nextDuration)}px`;
    }

    async function completeTrimInteraction() {
      if (!trimInteraction) {
        return;
      }

      const {
        itemId,
        currentDuration,
        originalDuration,
        clipElement
      } = trimInteraction;

      clipElement.classList.remove("trimming");
      trimInteraction = null;

      if (Math.round(currentDuration) === Math.round(originalDuration)) {
        return;
      }

      const updated = globalScope.CreatorAppV2EditActions.setTimelineItemDuration(store, itemId, currentDuration);
      if (updated) {
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: "Timeline item trimmed."
          }
        }));
        await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
      }
    }

    appElement.addEventListener("dragstart", (event) => {
      if (event.target.closest("[data-trim-handle]") || trimInteraction) {
        event.preventDefault();
        return;
      }
      const element = event.target.closest("[data-drag-timeline-item-id]");
      if (!element) {
        return;
      }
      draggedTimelineItemId = String(element.dataset.dragTimelineItemId || "").trim();
      draggedTimelineElement = element;
      element.classList.add("dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", draggedTimelineItemId);
      }
    });

    appElement.addEventListener("dragover", (event) => {
      const dropTarget = event.target.closest("[data-drop-track-id], [data-drag-timeline-item-id]");
      if (!dropTarget || !draggedTimelineItemId) {
        return;
      }
      event.preventDefault();
      const targetBody = dropTarget.matches("[data-drop-track-id]")
        ? dropTarget
        : dropTarget.closest("[data-drop-track-id]");
      if (activeDropTarget && activeDropTarget !== targetBody) {
        activeDropTarget.classList.remove("drag-target");
      }
      if (targetBody) {
        targetBody.classList.add("drag-target");
        activeDropTarget = targetBody;
        syncDragPreview(targetBody, event.clientX);
      }
      const clipTarget = event.target.closest("[data-drag-timeline-item-id]");
      if (activeDropClipTarget && activeDropClipTarget !== clipTarget) {
        activeDropClipTarget.classList.remove("drag-target-before", "drag-target-after");
        activeDropClipTarget = null;
        activeDropClipSide = "";
      }
      if (clipTarget && String(clipTarget.dataset.dragTimelineItemId || "").trim() !== draggedTimelineItemId) {
        const rect = clipTarget.getBoundingClientRect();
        const side = event.clientX < (rect.left + rect.width / 2) ? "before" : "after";
        clipTarget.classList.add(side === "before" ? "drag-target-before" : "drag-target-after");
        clipTarget.classList.remove(side === "before" ? "drag-target-after" : "drag-target-before");
        activeDropClipTarget = clipTarget;
        activeDropClipSide = side;
      }
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }
    });

    appElement.addEventListener("drop", async (event) => {
      const explicitDropTarget = event.target.closest("[data-drop-track-id]");
      const beforeItemTarget = event.target.closest("[data-drag-timeline-item-id]");
      if (!draggedTimelineItemId || (!explicitDropTarget && !beforeItemTarget)) {
        return;
      }
      event.preventDefault();

      const hoveredItemId = String(beforeItemTarget?.dataset.dragTimelineItemId || "").trim();
      const beforeItemId = activeDropClipSide === "before" ? hoveredItemId : "";
      const afterItemId = activeDropClipSide === "after" ? hoveredItemId : "";
      const dropTrackId = String(
        explicitDropTarget?.dataset.dropTrackId
        || beforeItemTarget?.dataset.dragTrackId
        || ""
      ).trim();
      const dropSceneId = String(explicitDropTarget?.dataset.dropSceneId || "").trim();
      const dropSceneTitle = String(explicitDropTarget?.dataset.dropSceneTitle || "").trim();
      const dropStartSecondsBase = Number(explicitDropTarget?.dataset.dropStartSeconds || 0);
      let dropStartSeconds = dropStartSecondsBase;

      if (explicitDropTarget) {
        const rect = explicitDropTarget.getBoundingClientRect();
        const offsetPixels = Math.max(0, event.clientX - rect.left);
        dropStartSeconds = dropStartSecondsBase + (offsetPixels / getTimelinePixelsPerSecond());
      }

      const moved = globalScope.CreatorAppV2EditActions.moveTimelineItemByDrop(store, draggedTimelineItemId, {
        trackId: dropTrackId,
        sceneId: dropSceneId,
        sceneTitle: dropSceneTitle,
        beforeItemId,
        afterItemId,
        startSeconds: dropStartSeconds
      });
      if (activeDropTarget) {
        activeDropTarget.classList.remove("drag-target");
        activeDropTarget = null;
      }
      clearDragPreview();
      if (activeDropClipTarget) {
        activeDropClipTarget.classList.remove("drag-target-before", "drag-target-after");
        activeDropClipTarget = null;
        activeDropClipSide = "";
      }
      draggedTimelineItemId = "";
      draggedTimelineElement = null;

      store.setState((state) => ({
        ...state,
        workflow: {
          ...state.workflow,
          notice: moved
            ? "Timeline item repositioned."
            : "Could not reposition the timeline item."
        }
      }));
      if (moved) {
        await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
      }
    });

    appElement.addEventListener("dragend", () => {
      appElement.querySelectorAll(".dragging").forEach((element) => element.classList.remove("dragging"));
      if (activeDropTarget) {
        activeDropTarget.classList.remove("drag-target");
        activeDropTarget = null;
      }
      clearDragPreview();
      if (activeDropClipTarget) {
        activeDropClipTarget.classList.remove("drag-target-before", "drag-target-after");
        activeDropClipTarget = null;
        activeDropClipSide = "";
      }
      draggedTimelineItemId = "";
      draggedTimelineElement = null;
    });

    appElement.addEventListener("dblclick", async (event) => {
      const timelineItem = event.target.closest("[data-edit-item-id][data-playhead-seconds]");
      if (!timelineItem) {
        return;
      }
      const playheadSeconds = Number(timelineItem.dataset.playheadSeconds || 0);
      globalScope.CreatorAppV2EditActions.setPlayhead(store, playheadSeconds);
      updatePlayheadUi(playheadSeconds);
      await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
    });

    appElement.addEventListener("mousedown", (event) => {
      const handle = event.target.closest("[data-trim-handle]");
      if (!handle) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      beginTrimInteraction(handle, event.clientX);
    });

    window.addEventListener("mousemove", (event) => {
      if (!trimInteraction) {
        return;
      }
      event.preventDefault();
      updateTrimInteraction(event.clientX);
    });

    window.addEventListener("mouseup", async () => {
      if (!trimInteraction) {
        return;
      }
      await completeTrimInteraction();
    });

    appElement.addEventListener("click", async (event) => {
      if (event.target.closest("[data-trim-handle]")) {
        return;
      }
      const stageButton = event.target.closest("[data-stage-id]");
      if (stageButton) {
        await enterStage(store, stageButton.dataset.stageId);
        return;
      }

      const actionButton = event.target.closest("[data-action]");
      if (!actionButton) {
        return;
      }

      if (actionButton.dataset.action === "login") {
        const username = String(appElement.querySelector("[data-auth-username]")?.value || "").trim();
        const password = String(appElement.querySelector("[data-auth-password]")?.value || "");
        if (!username || !password) {
          globalScope.CreatorAppV2Session.setSessionError(store, "Username and password are required.");
          return;
        }
        try {
          const payload = await store.getState().endpoints.auth.login({ username, password });
          globalScope.CreatorAppV2Session.setAuthenticatedSession(store, payload);
          const nextState = store.getState();
          if (nextState.session.studioId) {
            await hydrateStudioWorkspace(store);
          } else {
            globalScope.CreatorAppV2WorkspaceState.clearWorkspace(store);
          }
          store.setState((state) => ({
            ...state,
            ui: {
              ...state.ui,
              currentView: nextState.session.studioId ? "dashboard" : "studio_selection"
            },
            workflow: {
              ...state.workflow,
              notice: nextState.session.studioId
                ? "Authenticated and restored studio context."
                : "Authenticated. Select a studio to continue."
            }
          }));
        } catch (error) {
          globalScope.CreatorAppV2Session.setSessionError(store, error.message || "Authentication failed.");
        }
        return;
      }

      if (actionButton.dataset.action === "set-studio-context") {
        const studioId = String(actionButton.dataset.studioId || "").trim();
        if (!studioId) {
          globalScope.CreatorAppV2Session.setSessionError(store, "Select a studio to continue.");
          return;
        }
        try {
          const state = store.getState();
          const payload = await state.endpoints.auth.selectStudio(state.session.token, { studio_id: studioId });
          globalScope.CreatorAppV2Session.applyStudioSelection(store, payload);
          await hydrateStudioWorkspace(store);
          store.setState((nextState) => ({
            ...nextState,
            ui: {
              ...nextState.ui,
              currentView: "dashboard"
            },
            workflow: {
              ...nextState.workflow,
              notice: nextState.session.studioId
                ? "Studio selected. Dashboard and workflow context loaded."
                : "Studio selection is required before entering the workflow."
            }
          }));
        } catch (error) {
          globalScope.CreatorAppV2Session.setSessionError(store, error.message || "Could not select studio.");
        }
        return;
      }

      if (actionButton.dataset.action === "open-studio-selector") {
        globalScope.CreatorAppV2Session.setStudioContext(store, "");
        globalScope.CreatorAppV2WorkspaceState.clearWorkspace(store);
        globalScope.CreatorAppV2ProjectWorkspace.clearProjectWorkspace(store);
        store.setState((state) => ({
          ...state,
          ui: {
            ...state.ui,
            currentView: "studio_selection"
          },
          workflow: {
            ...state.workflow,
            notice: "Select a studio to continue."
          }
        }));
        return;
      }

      if (actionButton.dataset.action === "open-project") {
        const projectId = String(actionButton.dataset.projectId || "").trim();
        const projectType = String(actionButton.dataset.projectType || "").trim();
        if (!projectId || !projectType) {
          return;
        }
        await globalScope.CreatorAppV2ProjectController.openProject(store, {
          id: Number(projectId),
          type: projectType,
          title: actionButton.dataset.projectTitle || "Untitled Project"
        });
        return;
      }

      if (actionButton.dataset.action === "create-project") {
        const projectType = String(actionButton.dataset.projectType || "film").trim();
        await globalScope.CreatorAppV2ProjectController.createProject(store, projectType);
        return;
      }

      if (actionButton.dataset.action === "import-assets") {
        const importedAssets = await globalScope.CreatorAppV2ProjectController.importAssets(store);
        if (Array.isArray(importedAssets) && importedAssets.length) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store, {
            notice: `Imported ${importedAssets.length} asset${importedAssets.length === 1 ? "" : "s"} and saved project workspace.`
          });
        }
        return;
      }

      if (actionButton.dataset.action === "open-workflow") {
        if (store.getState().session.status !== "studio_ready") {
          return;
        }
        await enterStage(store, store.getState().workflow.currentStageId || "idea_board");
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: "Entered the creator workflow."
          }
        }));
        return;
      }

      if (actionButton.dataset.action === "open-dashboard") {
        if (store.getState().session.status !== "studio_ready") {
          return;
        }
        await hydrateStudioWorkspace(store);
        store.setState((state) => ({
          ...state,
          ui: {
            ...state.ui,
            currentView: "dashboard"
          },
          workflow: {
            ...state.workflow,
            notice: "Returned to dashboard."
          }
        }));
        return;
      }

      if (actionButton.dataset.action === "add-idea-card") {
        const title = String(appElement.querySelector("[data-idea-card-title]")?.value || "").trim();
        const description = String(appElement.querySelector("[data-idea-card-description]")?.value || "").trim();
        const category = String(appElement.querySelector("[data-idea-card-category]")?.value || "note").trim();
        if (!title && !description) {
          return;
        }
        globalScope.CreatorAppV2ProjectController.addIdeaCard(store, { title, description, category });
        const titleInput = appElement.querySelector("[data-idea-card-title]");
        const descriptionInput = appElement.querySelector("[data-idea-card-description]");
        if (titleInput) {
          titleInput.value = "";
        }
        if (descriptionInput) {
          descriptionInput.value = "";
        }
        return;
      }

      if (actionButton.dataset.action === "save-idea-board") {
        await globalScope.CreatorAppV2ProjectController.saveIdeaBoard(store);
        return;
      }

      if (actionButton.dataset.action === "apply-pitch-draft") {
        await globalScope.CreatorAppV2IdeaPitchActions.applyPitchDraftFromDom(store, appElement);
        return;
      }

      if (actionButton.dataset.action === "apply-script-draft") {
        await globalScope.CreatorAppV2ScriptActions.applyScriptDraftFromDom(store, appElement);
        return;
      }

      if (actionButton.dataset.action === "add-script-scene") {
        await globalScope.CreatorAppV2ScriptActions.addScene(store, appElement);
        return;
      }

      if (actionButton.dataset.action === "remove-script-scene") {
        const sceneId = String(actionButton.dataset.scriptSceneId || "").trim();
        if (sceneId) {
          await globalScope.CreatorAppV2ScriptActions.removeScene(store, appElement, sceneId);
        }
        return;
      }

      if (actionButton.dataset.action === "add-script-clip") {
        const sceneId = String(actionButton.dataset.scriptSceneId || "").trim();
        if (sceneId) {
          await globalScope.CreatorAppV2ScriptActions.addClip(store, appElement, sceneId);
        }
        return;
      }

      if (actionButton.dataset.action === "generate-entire-scene") {
        const sceneId = String(actionButton.dataset.scriptSceneId || "").trim();
        if (sceneId) {
          await globalScope.CreatorAppV2ScriptActions.generateEntireScene(store, appElement, sceneId);
        }
        return;
      }

      if (actionButton.dataset.action === "remove-script-clip") {
        const sceneId = String(actionButton.dataset.scriptSceneId || "").trim();
        const clipId = String(actionButton.dataset.scriptClipId || "").trim();
        if (sceneId && clipId) {
          await globalScope.CreatorAppV2ScriptActions.removeClip(store, appElement, sceneId, clipId);
        }
        return;
      }

      if (actionButton.dataset.action === "apply-starting-images") {
        await globalScope.CreatorAppV2StartingImagesActions.applyDraftFromDom(store, appElement);
        return;
      }

      if (actionButton.dataset.action === "select-starting-image-scene") {
        const sceneId = String(actionButton.dataset.startingImageSceneId || "").trim();
        if (sceneId) {
          await globalScope.CreatorAppV2StartingImagesActions.selectScene(store, sceneId);
        }
        return;
      }

      if (actionButton.dataset.action === "generate-starting-image") {
        const sceneId = String(actionButton.dataset.startingImageSceneId || "").trim()
          || globalScope.CreatorAppV2StartingImagesState.getSelectedStartingImageScene(store)?.id
          || "";
        if (sceneId) {
          await globalScope.CreatorAppV2StartingImagesActions.generateForScene(store, appElement, sceneId);
        }
        return;
      }

      if (actionButton.dataset.action === "refresh-starting-image") {
        const sceneId = String(actionButton.dataset.startingImageSceneId || "").trim()
          || globalScope.CreatorAppV2StartingImagesState.getSelectedStartingImageScene(store)?.id
          || "";
        if (sceneId) {
          await globalScope.CreatorAppV2StartingImagesActions.refreshForScene(store, sceneId);
        }
        return;
      }

      if (actionButton.dataset.action === "approve-starting-image-variation") {
        const sceneId = String(actionButton.dataset.startingImageSceneId || "").trim();
        const variationId = String(actionButton.dataset.startingImageVariationId || "").trim();
        if (sceneId && variationId) {
          await globalScope.CreatorAppV2StartingImagesActions.approveVariation(store, sceneId, variationId);
        }
        return;
      }

      if (actionButton.dataset.action === "apply-video-clips") {
        await globalScope.CreatorAppV2ClipGenerationActions.applyDraftFromDom(store, appElement);
        return;
      }

      if (actionButton.dataset.action === "select-video-scene") {
        const sceneId = String(actionButton.dataset.videoSceneId || "").trim();
        if (sceneId) {
          await globalScope.CreatorAppV2ClipGenerationActions.selectScene(store, sceneId);
        }
        return;
      }

      if (actionButton.dataset.action === "select-video-request") {
        const sceneId = String(actionButton.dataset.videoSceneId || "").trim();
        const requestId = String(actionButton.dataset.videoRequestId || "").trim();
        if (sceneId && requestId) {
          await globalScope.CreatorAppV2ClipGenerationActions.selectRequest(store, sceneId, requestId);
        }
        return;
      }

      if (actionButton.dataset.action === "generate-video-clip") {
        const sceneId = String(actionButton.dataset.videoSceneId || "").trim()
          || globalScope.CreatorAppV2ClipGenerationState.getSelectedVideoScene(store)?.id
          || "";
        const requestId = String(actionButton.dataset.videoRequestId || "").trim()
          || globalScope.CreatorAppV2ClipGenerationState.getSelectedVideoRequest(store)?.id
          || "";
        if (sceneId && requestId) {
          await globalScope.CreatorAppV2ClipGenerationActions.generateForRequest(store, appElement, sceneId, requestId);
        }
        return;
      }

      if (actionButton.dataset.action === "refresh-video-clip") {
        const sceneId = String(actionButton.dataset.videoSceneId || "").trim()
          || globalScope.CreatorAppV2ClipGenerationState.getSelectedVideoScene(store)?.id
          || "";
        const requestId = String(actionButton.dataset.videoRequestId || "").trim()
          || globalScope.CreatorAppV2ClipGenerationState.getSelectedVideoRequest(store)?.id
          || "";
        if (sceneId && requestId) {
          await globalScope.CreatorAppV2ClipGenerationActions.refreshForRequest(store, sceneId, requestId);
        }
        return;
      }

      if (actionButton.dataset.action === "approve-generated-video-clip") {
        const sceneId = String(actionButton.dataset.videoSceneId || "").trim();
        const requestId = String(actionButton.dataset.videoRequestId || "").trim();
        const clipId = String(actionButton.dataset.generatedClipId || "").trim();
        if (sceneId && requestId && clipId) {
          await globalScope.CreatorAppV2ClipGenerationActions.approveGeneratedClip(store, sceneId, requestId, clipId);
        }
        return;
      }

      if (actionButton.dataset.action === "build-edit-rough-cut") {
        globalScope.CreatorAppV2EditActions.buildRoughCut(store);
        await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store, {
          notice: "Rough cut assembled and saved to project workspace."
        });
        return;
      }

      if (actionButton.dataset.action === "select-imported-asset") {
        const assetId = String(actionButton.dataset.assetId || "").trim();
        if (assetId) {
          globalScope.CreatorAppV2EditActions.selectImportedAsset(store, assetId);
        }
        return;
      }

      if (actionButton.dataset.action === "add-imported-asset-to-timeline") {
        const assetId = String(actionButton.dataset.assetId || "").trim();
        if (!assetId) {
          return;
        }
        const activeScene = globalScope.CreatorAppV2EditState.getActiveScene(store);
        globalScope.CreatorAppV2ProjectWorkspace.appendImportedAssetToTimeline(store, assetId, {
          sceneId: activeScene?.scriptSceneId || activeScene?.id || "",
          placementType: actionButton.dataset.placementType || ""
        });
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: activeScene
              ? `Imported asset added to ${activeScene.title}.`
              : "Imported asset added to the timeline as an unassigned placement."
          }
        }));
        await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        return;
      }

      if (actionButton.dataset.action === "select-edit-item") {
        const itemId = String(actionButton.dataset.editItemId || "").trim();
        if (itemId) {
          globalScope.CreatorAppV2EditActions.selectTimelineItem(store, itemId);
        }
        return;
      }

      if (actionButton.dataset.action === "set-edit-active-scene-click") {
        const sceneId = String(actionButton.dataset.sceneId || "").trim();
        if (sceneId) {
          globalScope.CreatorAppV2EditActions.setActiveScene(store, sceneId);
          const activeScene = globalScope.CreatorAppV2EditState.getActiveScene(store);
          store.setState((state) => ({
            ...state,
            workflow: {
              ...state.workflow,
              notice: activeScene
                ? `Active scene set to ${activeScene.title}.`
              : "Active scene cleared."
            }
          }));
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "set-playhead") {
        const playheadSeconds = Number(actionButton.dataset.playheadSeconds || 0);
        globalScope.CreatorAppV2EditActions.setPlayhead(store, playheadSeconds);
        await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        return;
      }

      if (actionButton.dataset.action === "seek-timeline") {
        const rect = actionButton.getBoundingClientRect();
        const pixelsPerSecond = Math.max(1, Number(actionButton.dataset.pixelsPerSecond || 44));
        const offsetPixels = Math.max(0, event.clientX - rect.left);
        const playheadSeconds = offsetPixels / pixelsPerSecond;
        globalScope.CreatorAppV2EditActions.setPlayhead(store, playheadSeconds);
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: `Playhead moved to ${Math.floor(playheadSeconds / 60)}:${String(Math.floor(playheadSeconds % 60)).padStart(2, "0")}.`
          }
        }));
        await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        return;
      }

      if (actionButton.dataset.action === "add-timeline-marker") {
        const marked = globalScope.CreatorAppV2EditActions.addMarkerAtPlayhead(store);
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: marked
              ? "Timeline marker added at the current playhead."
              : "Could not add a timeline marker."
          }
        }));
        if (marked) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "play-timeline") {
        const sequence = getSequenceItems();
        if (!sequence.visualItems.length && !sequence.audioSchedules.length) {
          return;
        }
        stopSequencePlaybackState();
        sequencePlayback.items = sequence.visualItems;
        sequencePlayback.audioSchedules = sequence.audioSchedules;
        const playheadSeconds = globalScope.CreatorAppV2EditState.getPlayheadSeconds(store);
        scheduleSequenceAudio(playheadSeconds);
        if (sequence.visualItems.length) {
          const position = getSequencePosition(sequence.visualItems, playheadSeconds);
          await playSequenceAtIndex(position.index, position.offsetSeconds);
        } else {
          sequencePlayback.active = true;
          startSequenceProgressLoop();
        }
        return;
      }

      if (actionButton.dataset.action === "pause-timeline") {
        globalScope.CreatorAppV2EditActions.pausePlayback(store);
        const mediaElement = getPreviewMediaElement();
        mediaElement?.pause?.();
        const pausedAt = getCurrentSequencePlayhead();
        stopSequencePlaybackState();
        globalScope.CreatorAppV2EditActions.setPlayhead(store, pausedAt);
        updatePlayheadUi(pausedAt);
        return;
      }

      if (actionButton.dataset.action === "stop-timeline") {
        globalScope.CreatorAppV2EditActions.stopPlayback(store);
        const mediaElement = getPreviewMediaElement();
        mediaElement?.pause?.();
        if (mediaElement) {
          mediaElement.currentTime = 0;
        }
        stopSequencePlaybackState();
        updatePlayheadUi(0);
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: "Timeline playback stopped and playhead reset."
          }
        }));
        await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        return;
      }

      if (actionButton.dataset.action === "step-timeline") {
        const stepped = globalScope.CreatorAppV2EditActions.stepPlayhead(store, 1);
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: stepped
              ? "Timeline playhead advanced."
              : "Could not move the playhead."
          }
        }));
        if (stepped) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "focus-scene-slot") {
        const sceneId = String(actionButton.dataset.videoSceneId || "").trim();
        const requestId = String(actionButton.dataset.videoRequestId || "").trim();
        if (sceneId && requestId) {
          await globalScope.CreatorAppV2ClipGenerationActions.selectRequest(store, sceneId, requestId);
          await enterStage(store, "clip_generation");
          const selectedScene = globalScope.CreatorAppV2ClipGenerationState.getSelectedVideoScene(store);
          const selectedRequest = globalScope.CreatorAppV2ClipGenerationState.getSelectedVideoRequest(store, selectedScene);
          const status = String(selectedRequest?.status || "").trim();
          store.setState((state) => ({
            ...state,
            workflow: {
              ...state.workflow,
              notice: status === "generated"
                ? `Opened ${selectedScene?.title || "scene"} / ${selectedRequest?.title || "shot"} for take review.`
                : `Opened ${selectedScene?.title || "scene"} / ${selectedRequest?.title || "shot"} for generation work.`
            }
          }));
        }
        return;
      }

      if (actionButton.dataset.action === "assign-selected-item-to-active-scene") {
        const assigned = globalScope.CreatorAppV2EditActions.assignSelectedTimelineItemToActiveScene(store);
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: assigned
              ? "Selected timeline item assigned to the active scene."
              : "Select a timeline item and an active scene first."
          }
        }));
        if (assigned) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "open-selected-item-slot") {
        const selectedItem = globalScope.CreatorAppV2EditState.getSelectedTimelineItem(store);
        if (selectedItem?.requestId) {
          const videoDraft = globalScope.CreatorAppV2ClipGenerationState.getVideoClipsDraft(store);
          const trace = globalScope.CreatorAppV2PipelineIntelligence.findVideoClipRequest(videoDraft, selectedItem.requestId);
          if (trace?.scene?.id && trace?.request?.id) {
            globalScope.CreatorAppV2ClipGenerationActions.selectRequest(store, trace.scene.id, trace.request.id);
            await enterStage(store, "clip_generation");
            store.setState((state) => ({
              ...state,
              workflow: {
                ...state.workflow,
                notice: `Opened slot ${trace.request.title || "shot"} in Clip Generation.`
              }
            }));
            return;
          }
        }
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: "No linked clip-generation slot is available for the selected timeline item."
          }
        }));
        return;
      }

      if (actionButton.dataset.action === "replace-selected-item-from-approved") {
        const replaced = globalScope.CreatorAppV2EditActions.replaceSelectedTimelineItemFromApprovedTake(store);
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: replaced
              ? "Selected timeline item replaced with the approved generated take."
              : "No approved generated take is available for the selected timeline item."
          }
        }));
        if (replaced) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "move-selected-item-left") {
        const moved = globalScope.CreatorAppV2EditActions.moveSelectedTimelineItem(store, "left");
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: moved
              ? "Selected timeline item moved left."
              : "Select a timeline item first."
          }
        }));
        if (moved) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "move-selected-item-right") {
        const moved = globalScope.CreatorAppV2EditActions.moveSelectedTimelineItem(store, "right");
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: moved
              ? "Selected timeline item moved right."
              : "Select a timeline item first."
          }
        }));
        if (moved) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "move-selected-item-up") {
        const moved = globalScope.CreatorAppV2EditActions.moveSelectedTimelineItemVertical(store, "up");
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: moved
              ? "Selected timeline item moved up a lane."
              : "Select a timeline item first."
          }
        }));
        if (moved) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "move-selected-item-down") {
        const moved = globalScope.CreatorAppV2EditActions.moveSelectedTimelineItemVertical(store, "down");
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: moved
              ? "Selected timeline item moved down a lane."
              : "Select a timeline item first."
          }
        }));
        if (moved) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "split-selected-item") {
        const split = globalScope.CreatorAppV2EditActions.splitSelectedTimelineItem(store);
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: split
              ? "Selected timeline item split into two segments."
              : "Select a timeline item first."
          }
        }));
        if (split) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "trim-selected-item-shorter") {
        const trimmed = globalScope.CreatorAppV2EditActions.trimSelectedTimelineItem(store, "decrease");
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: trimmed
              ? "Selected timeline item trimmed shorter."
              : "Select a timeline item first."
          }
        }));
        if (trimmed) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "trim-selected-item-longer") {
        const trimmed = globalScope.CreatorAppV2EditActions.trimSelectedTimelineItem(store, "increase");
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: trimmed
              ? "Selected timeline item extended longer."
              : "Select a timeline item first."
          }
        }));
        if (trimmed) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "duplicate-selected-item") {
        const duplicated = globalScope.CreatorAppV2EditActions.duplicateSelectedTimelineItem(store);
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: duplicated
              ? "Selected timeline item duplicated."
              : "Select a timeline item first."
          }
        }));
        if (duplicated) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "remove-selected-item") {
        const removed = globalScope.CreatorAppV2EditActions.removeSelectedTimelineItem(store);
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: removed
              ? "Selected timeline item removed from the timeline."
              : "Select a timeline item first."
          }
        }));
        if (removed) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
        return;
      }

      if (actionButton.dataset.action === "apply-export-draft") {
        await globalScope.CreatorAppV2ExportReleaseActions.applyDraftFromDom(store, appElement);
        return;
      }

      if (actionButton.dataset.action === "refresh-export-history") {
        await globalScope.CreatorAppV2ExportReleaseActions.refreshExports(store);
        return;
      }

      if (actionButton.dataset.action === "init-export") {
        await globalScope.CreatorAppV2ExportReleaseActions.initExport(store, appElement);
        return;
      }

      if (actionButton.dataset.action === "complete-export") {
        const exportId = Number(actionButton.dataset.exportId || 0);
        if (exportId) {
          await globalScope.CreatorAppV2ExportReleaseActions.completeExport(store, exportId);
        }
        return;
      }

      if (actionButton.dataset.action === "select-export-record") {
        const exportId = Number(actionButton.dataset.exportId || 0);
        if (exportId) {
          await globalScope.CreatorAppV2ExportReleaseActions.selectExport(store, exportId);
        }
        return;
      }

      if (actionButton.dataset.action === "refresh") {
        if (store.getState().session.status === "studio_ready") {
          await hydrateStudioWorkspace(store);
        }
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: "V2 shell refreshed."
          }
        }));
      }
    });

    window.creatorAppV2.onMenuAction((payload) => {
      if (store.getState().session.status !== "studio_ready") {
        return;
      }
      if (payload?.action === "stage" && payload?.stageId) {
        enterStage(store, payload.stageId);
      }
    });

    appElement.addEventListener("change", async (event) => {
      const target = event.target;
      if (!(target instanceof globalScope.HTMLSelectElement)) {
        return;
      }

      if (target.dataset.action === "set-edit-active-scene") {
        globalScope.CreatorAppV2EditActions.setActiveScene(store, String(target.value || "").trim());
        const activeScene = globalScope.CreatorAppV2EditState.getActiveScene(store);
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: activeScene
              ? `Active scene set to ${activeScene.title}.`
              : "Active scene cleared."
          }
        }));
        await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        return;
      }

      if (target.dataset.action === "set-selected-item-placement") {
        const placementType = String(target.value || "").trim();
        const updated = globalScope.CreatorAppV2EditActions.updateSelectedTimelineItemPlacementType(store, placementType);
        store.setState((state) => ({
          ...state,
          workflow: {
            ...state.workflow,
            notice: updated
              ? `Placement updated to ${placementType || "temp"}.`
              : "Select a timeline item first."
          }
        }));
        if (updated) {
          await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store);
        }
      }
    });
  }

  globalScope.CreatorAppV2AppLifecycle = {
    bindLifecycle
  };
})(window);
