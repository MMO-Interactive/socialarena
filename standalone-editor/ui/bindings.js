(function attachEditorBindingModules(globalScope) {
  const modules = globalScope.EditorUiModules || (globalScope.EditorUiModules = {});

  modules.createBindingHelpers = function createBindingHelpers(deps) {
    const {
      state,
      playbackView,
      editorShell,
      render,
      setNotice,
      autosaveProjects,
      getProject,
      resetSelectionForProject,
      pausePlayback,
      syncCurrentProjectTimecode,
      connectIdeaCards,
      getSelection,
      getTimelineItemContextById,
      getTimelinePixelsPerSecond,
      trimTimelineItem,
      setPlayheadFromTimelinePosition,
      addAssetToTimelineAtPosition,
      moveTimelineItemToPosition,
      updateSelectedTimelineItem,
      updateSelectedTimelineTransition,
      updateProjectPitch,
      updateScriptField,
      updateScriptScene,
      updateScriptClip,
      updateStartingImageScene,
      updateVideoClipRequest,
      createExportSettings,
      updateIdeaCard,
      updateIdeaCardStructuredField,
      moveIdeaCard,
      syncPreviewSelectionView,
      handleAction,
      trimStateRef,
      ideaDragStateRef
    } = deps;

    function bindDomEvents() {
    document.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", async () => {
        await handleAction(button.dataset.action, { button });
      });
    });

    document.querySelectorAll("[data-idea-canvas-shell]").forEach((canvasShell) => {
      canvasShell.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        const bounds = canvasShell.getBoundingClientRect();
        state.ideaContextMenu = {
          open: true,
          x: Math.max(16, event.clientX - bounds.left),
          y: Math.max(16, event.clientY - bounds.top)
        };
        render();
      });
    });

    editorShell?.onMenuAction?.((payload) => {
      handleAction(payload?.action, payload || {}).catch((error) => {
        setNotice(error.message || "Menu action failed", "error");
        render();
      });
    });

    document.querySelectorAll("[data-project-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedProjectId = button.dataset.projectId;
        state.selectedScriptSceneId = "";
        const project = getProject();
        resetSelectionForProject(project);
        pausePlayback();
        state.currentSeconds = 0;
        syncCurrentProjectTimecode();
        playbackView.activePreviewItemId = "";
        playbackView.activeAudioItemId = "";
        setNotice(`Loaded ${project.name}`, "neutral");
        autosaveProjects();
        render();
      });
    });

    document.querySelectorAll("[data-input='asset-browser-query']").forEach((input) => {
      input.addEventListener("input", (event) => {
        state.assetBrowser.query = event.target.value;
        render();
      });
    });

    document.querySelectorAll("[data-input='asset-tag-draft']").forEach((input) => {
      input.addEventListener("input", (event) => {
        state.assetBrowser.tagDraft = event.target.value;
      });
      input.addEventListener("keydown", async (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          await handleAction("tag-selected-asset", {});
        }
      });
    });

    document.querySelectorAll("[data-idea-node-target]").forEach((node) => {
      node.addEventListener("click", (event) => {
        if (!state.linkingIdeaCardId) {
          return;
        }
        if (event.target.closest("input, textarea, button")) {
          return;
        }

        const project = getProject();
        const targetId = node.dataset.ideaNodeTarget;
        if (connectIdeaCards(project, state.linkingIdeaCardId, targetId)) {
          setNotice("Connected nodes", "success");
          autosaveProjects();
        } else if (state.linkingIdeaCardId !== targetId) {
          setNotice("Those nodes are already connected", "neutral");
        }
        state.linkingIdeaCardId = "";
        render();
      });
    });

    document.querySelectorAll("[data-asset-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedAssetId = button.dataset.assetId;
        state.selectedSceneSegmentId = "";
        state.selectedTimelineItemId = "";
        pausePlayback();
        const currentProject = getProject();
        const asset = currentProject?.assets?.find((entry) => entry.id === button.dataset.assetId);
        setNotice(`Selected ${asset?.name || "asset"}`, "neutral");
        autosaveProjects();
        render();
      });

      button.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", `asset:${button.dataset.assetId}`);
        event.dataTransfer.effectAllowed = "copyMove";
        state.selectedAssetId = button.dataset.assetId;
      });
    });

    document.querySelectorAll("[data-timeline-item-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedSceneSegmentId = "";
        state.selectedTimelineItemId = button.dataset.timelineItemId;
        pausePlayback();
        const selection = getSelection(getProject());
        setNotice(`Selected ${selection?.name || "timeline item"}`, "neutral");
        autosaveProjects();
        render();
      });

      button.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", `clip:${button.dataset.timelineItemId}`);
        event.dataTransfer.effectAllowed = "move";
        state.selectedTimelineItemId = button.dataset.timelineItemId;
      });
    });

    document.querySelectorAll("[data-scene-segment-id]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedSceneSegmentId = button.dataset.sceneSegmentId;
        state.selectedTimelineItemId = "";
        pausePlayback();
        const selection = getSelection(getProject());
        setNotice(`Selected ${selection?.name || "scene segment"}`, "neutral");
        autosaveProjects();
        render();
      });
    });

    document.querySelectorAll("[data-trim-handle]").forEach((handle) => {
      handle.addEventListener("mousedown", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const project = getProject();
        const itemId = handle.dataset.timelineItemId;
        const edge = handle.dataset.trimHandle;
        const context = getTimelineItemContextById(project, itemId);
        if (!context) {
          return;
        }

        trimStateRef.current = {
          itemId,
          edge,
          startX: event.clientX,
          projectFps: project.fps || 24,
          originalDuration: getItemDuration(context.item),
          originalSourceIn: context.item.sourceIn || "00:00:00"
        };
        state.selectedTimelineItemId = itemId;
      });
    });

    if (!document.body.dataset.trimBound) {
      document.body.dataset.trimBound = "true";
      window.addEventListener("mousemove", (event) => {
        if (!trimStateRef.current) {
          return;
        }

        const project = getProject();
        const deltaSeconds = (event.clientX - trimStateRef.current.startX) / getTimelinePixelsPerSecond(project);
        trimTimelineItem(
          trimStateRef.current.itemId,
          trimStateRef.current.edge,
          deltaSeconds,
          trimStateRef.current.originalDuration,
          trimStateRef.current.originalSourceIn
        );
        autosaveProjects();
        render();
      });

      window.addEventListener("mouseup", () => {
        if (!trimStateRef.current) {
          return;
        }
        trimStateRef.current = null;
      });
    }

    document.querySelectorAll("[data-timeline-ruler-canvas], [data-track-lane-canvas]").forEach((element) => {
      element.addEventListener("click", (event) => {
        if (event.target.closest("[data-timeline-item-id], [data-marker-id]")) {
          return;
        }

        const project = getProject();
        const bounds = element.getBoundingClientRect();
        setPlayheadFromTimelinePosition(project, event.clientX - bounds.left);
        syncPreviewSelectionView();
        render();
      });
    });

    document.querySelectorAll("[data-track-lane-canvas]").forEach((lane) => {
      lane.addEventListener("dragover", (event) => {
        event.preventDefault();
        const payload = event.dataTransfer.getData("text/plain");
        event.dataTransfer.dropEffect = payload.startsWith("asset:") ? "copy" : "move";
        lane.classList.add("drag-target");
        const project = getProject();
        const bounds = lane.getBoundingClientRect();
        state.timelineDropIndicator.trackId = lane.dataset.trackId;
        state.timelineDropIndicator.seconds = Math.max(0, (event.clientX - bounds.left) / getTimelinePixelsPerSecond(project));
        let indicator = lane.querySelector(".timeline-drop-indicator");
        if (!indicator) {
          indicator = document.createElement("div");
          indicator.className = "timeline-drop-indicator";
          lane.appendChild(indicator);
        }
        indicator.style.left = `${state.timelineDropIndicator.seconds * getTimelinePixelsPerSecond(project)}px`;
      });

      lane.addEventListener("dragleave", () => {
        lane.classList.remove("drag-target");
        state.timelineDropIndicator.trackId = "";
        lane.querySelector(".timeline-drop-indicator")?.remove();
      });

      lane.addEventListener("drop", (event) => {
        event.preventDefault();
        lane.classList.remove("drag-target");
        state.timelineDropIndicator.trackId = "";
        lane.querySelector(".timeline-drop-indicator")?.remove();
        const payload = event.dataTransfer.getData("text/plain");
        if (!payload) {
          return;
        }

        const project = getProject();
        const bounds = lane.getBoundingClientRect();
        const offsetX = event.clientX - bounds.left;
        const dropSeconds = Math.max(0, offsetX / getTimelinePixelsPerSecond(project));

        if (payload.startsWith("asset:")) {
          const assetId = payload.slice(6);
          const result = addAssetToTimelineAtPosition(project, assetId, lane.dataset.trackId, dropSeconds);
          if (!result) {
            setNotice("That asset cannot be dropped on this track", "error");
          } else {
            autosaveProjects();
            setNotice(`Added ${result.clip.name} to ${result.targetTrack.label}`, "success");
          }
          render();
          return;
        }

        if (payload.startsWith("clip:")) {
          const clipId = payload.slice(5);
          const result = moveTimelineItemToPosition(project, clipId, lane.dataset.trackId, dropSeconds);
          if (!result) {
            setNotice("That clip cannot be dropped on this track", "error");
          } else {
            autosaveProjects();
            setNotice(`Moved ${result.item.name} to ${result.targetTrack.label}`, "success");
          }
        }
        render();
      });
    });

    document.querySelectorAll("[data-input='clip-name']").forEach((input) => {
      input.addEventListener("change", () => {
        updateSelectedTimelineItem("name", input.value.trim());
      });
    });

    document.querySelectorAll("[data-input='clip-source-out']").forEach((input) => {
      input.addEventListener("change", () => {
        updateSelectedTimelineItem("sourceOut", input.value.trim());
      });
    });

    document.querySelectorAll("[data-input='clip-volume']").forEach((input) => {
      input.addEventListener("input", () => {
        updateSelectedTimelineItem("volume", input.value);
      });
    });

    document.querySelectorAll("[data-input='clip-transition-type']").forEach((input) => {
      input.addEventListener("change", () => {
        updateSelectedTimelineTransition("type", input.value);
      });
    });

    document.querySelectorAll("[data-input='clip-transition-duration']").forEach((input) => {
      input.addEventListener("input", () => {
        updateSelectedTimelineTransition("duration", input.value);
      });
    });

    document.querySelectorAll("[data-pitch-input]").forEach((input) => {
      const eventName = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(eventName, () => {
        const project = getProject();
        updateProjectPitch(project, input.dataset.pitchInput, input.value);
        autosaveProjects();

        const helper = document.querySelector(".idea-board-panel .dashboard-helper");
        if (helper) {
          helper.textContent = "Saved locally. Keep refining the pitch before continuing.";
        }
      });
    });

    document.querySelectorAll("[data-script-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const project = getProject();
        updateScriptField(project, input.dataset.scriptInput, input.value);
        autosaveProjects();
      });
    });

    document.querySelectorAll("[data-script-scene-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const project = getProject();
        updateScriptScene(project, input.dataset.scriptSceneId, input.dataset.scriptSceneInput, input.value);
        autosaveProjects();
      });
    });

    document.querySelectorAll("[data-script-clip-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const project = getProject();
        updateScriptClip(
          project,
          input.dataset.scriptSceneId,
          input.dataset.scriptClipId,
          input.dataset.scriptClipInput,
          input.value
        );
        autosaveProjects();
      });
    });

    document.querySelectorAll("[data-scene-meta-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const field = input.dataset.sceneMetaInput;
        if (!field) {
          return;
        }
        state.sceneInspectorDraft[field] = input.value;
      });
    });

    document.querySelectorAll("[data-starting-image-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const project = getProject();
        updateStartingImageScene(project, input.dataset.startingImageSceneId, input.dataset.startingImageInput, input.value);
        autosaveProjects();
      });
    });

    document.querySelectorAll("[data-video-clip-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const project = getProject();
        updateVideoClipRequest(
          project,
          input.dataset.videoClipSceneId,
          input.dataset.videoClipRequestId,
          input.dataset.videoClipInput,
          input.value
        );
        autosaveProjects();
      });
    });

    document.querySelectorAll("[data-export-setting]").forEach((input) => {
      const eventName = input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(eventName, () => {
        if (state.exportModal.inProgress) {
          return;
        }

        const key = input.dataset.exportSetting;
        state.exportModal.settings = createExportSettings({
          ...state.exportModal.settings,
          [key]: input.type === "checkbox" ? input.checked : input.value
        });
      });
    });

    document.querySelectorAll("[data-bridge-input]").forEach((input) => {
      const eventName = input.tagName === "TEXTAREA" ? "input" : "change";
      input.addEventListener(eventName, () => {
        const key = input.dataset.bridgeInput;
        state.bridgeClipModal[key] = key === "durationSeconds" ? Number(input.value || 2) : input.value;
      });
    });

    document.querySelectorAll("[data-idea-card-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const project = getProject();
        updateIdeaCard(project, input.dataset.ideaCardId, input.dataset.ideaCardInput, input.value);
        autosaveProjects();
      });
    });

    document.querySelectorAll("[data-idea-structured-input]").forEach((input) => {
      const eventName = input.tagName === "SELECT" ? "change" : "input";
      input.addEventListener(eventName, () => {
        const project = getProject();
        updateIdeaCardStructuredField(project, input.dataset.ideaCardId, input.dataset.ideaStructuredInput, input.value);
        autosaveProjects();
      });
    });

    document.querySelectorAll("[data-idea-media-input], [data-idea-link-input]").forEach((input) => {
      input.addEventListener("input", () => {
        const project = getProject();
        const field = input.dataset.ideaMediaInput || input.dataset.ideaLinkInput;
        updateIdeaCard(project, input.dataset.ideaCardId, field, input.value.trim());
        autosaveProjects();
      });
    });

    document.querySelectorAll("[data-idea-node-handle]").forEach((button) => {
      button.addEventListener("mousedown", (event) => {
        event.preventDefault();
        const project = getProject();
        const cardId = button.dataset.ideaNodeHandle;
        const card = project?.ideaBoard?.cards?.find((entry) => entry.id === cardId);
        const node = document.querySelector(`[data-idea-node='${cardId}']`);
        const shell = node?.closest("[data-idea-canvas-shell]");
        if (!card || !node) {
          return;
        }

        state.revealIdeaCardId = "";
        state.ideaContextMenu.open = false;
        const startX = event.clientX;
        const startY = event.clientY;
        const originX = card.x;
        const originY = card.y;
        const initialScrollLeft = shell?.scrollLeft || 0;
        const initialScrollTop = shell?.scrollTop || 0;
        document.body.classList.add("dragging-node");
        ideaDragStateRef.current = {
          cardId,
          startX,
          startY,
          originX,
          originY,
          node,
          shell,
          initialScrollLeft,
          initialScrollTop
        };

        const handleMove = (moveEvent) => {
          if (!ideaDragStateRef.current) {
            return;
          }
          const scrollDeltaX = (ideaDragStateRef.current.shell?.scrollLeft || 0) - ideaDragStateRef.current.initialScrollLeft;
          const scrollDeltaY = (ideaDragStateRef.current.shell?.scrollTop || 0) - ideaDragStateRef.current.initialScrollTop;
          const nextX = ideaDragStateRef.current.originX + (moveEvent.clientX - ideaDragStateRef.current.startX) + scrollDeltaX;
          const nextY = ideaDragStateRef.current.originY + (moveEvent.clientY - ideaDragStateRef.current.startY) + scrollDeltaY;
          ideaDragStateRef.current.node.style.left = `${Math.max(24, nextX)}px`;
          ideaDragStateRef.current.node.style.top = `${Math.max(24, nextY)}px`;
        };

        const handleUp = (upEvent) => {
          if (!ideaDragStateRef.current) {
            return;
          }
          const scrollDeltaX = (ideaDragStateRef.current.shell?.scrollLeft || 0) - ideaDragStateRef.current.initialScrollLeft;
          const scrollDeltaY = (ideaDragStateRef.current.shell?.scrollTop || 0) - ideaDragStateRef.current.initialScrollTop;
          const nextX = ideaDragStateRef.current.originX + (upEvent.clientX - ideaDragStateRef.current.startX) + scrollDeltaX;
          const nextY = ideaDragStateRef.current.originY + (upEvent.clientY - ideaDragStateRef.current.startY) + scrollDeltaY;
          moveIdeaCard(project, cardId, nextX, nextY);
          autosaveProjects();
          document.body.classList.remove("dragging-node");
          ideaDragStateRef.current = null;
          window.removeEventListener("mousemove", handleMove);
          window.removeEventListener("mouseup", handleUp);
          render();
        };

        window.addEventListener("mousemove", handleMove);
        window.addEventListener("mouseup", handleUp);
      });
    });

    if (state.ideaContextMenu.open) {
      document.addEventListener(
        "click",
        (event) => {
          if (!event.target.closest("[data-idea-context-menu]")) {
            state.ideaContextMenu.open = false;
            render();
          }
        },
        { once: true }
      );
    }

    if (state.revealIdeaCardId) {
      const node = document.querySelector(`[data-idea-node='${state.revealIdeaCardId}']`);
      const titleInput = document.querySelector(`[data-idea-card-title='${state.revealIdeaCardId}']`);
      node?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      titleInput?.focus();
      state.revealIdeaCardId = "";
    }

    }

    return {
      bindDomEvents
    };
  };
})(window);