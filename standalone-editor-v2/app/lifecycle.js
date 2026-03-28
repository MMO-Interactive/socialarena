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

    store.setState((state) => ({
      ...state,
      ui: {
        ...state.ui,
        currentView: "workflow"
      }
    }));
    globalScope.CreatorAppV2Workflow.setCurrentStage(store, stageId);

    if (stageId === "edit") {
      await globalScope.CreatorAppV2ProjectController.hydrateImportedAssetMetadata(store);
      const editDraft = globalScope.CreatorAppV2EditState.getEditDraft(store);
      if (!editDraft.timelineItems.length && hasApprovedClipSelections(store)) {
        globalScope.CreatorAppV2EditActions.buildRoughCut(store);
      }
      return;
    }

    if (stageId === "export_release") {
      await globalScope.CreatorAppV2ExportReleaseActions.refreshExports(store);
    }
  }

  function bindLifecycle(appElement, store) {
    appElement.addEventListener("click", async (event) => {
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
        await globalScope.CreatorAppV2ProjectController.importAssets(store);
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
        globalScope.CreatorAppV2IdeaPitchActions.applyPitchDraftFromDom(store, appElement);
        return;
      }

      if (actionButton.dataset.action === "apply-script-draft") {
        globalScope.CreatorAppV2ScriptActions.applyScriptDraftFromDom(store, appElement);
        return;
      }

      if (actionButton.dataset.action === "add-script-scene") {
        globalScope.CreatorAppV2ScriptActions.addScene(store, appElement);
        return;
      }

      if (actionButton.dataset.action === "remove-script-scene") {
        const sceneId = String(actionButton.dataset.scriptSceneId || "").trim();
        if (sceneId) {
          globalScope.CreatorAppV2ScriptActions.removeScene(store, appElement, sceneId);
        }
        return;
      }

      if (actionButton.dataset.action === "add-script-clip") {
        const sceneId = String(actionButton.dataset.scriptSceneId || "").trim();
        if (sceneId) {
          globalScope.CreatorAppV2ScriptActions.addClip(store, appElement, sceneId);
        }
        return;
      }

      if (actionButton.dataset.action === "generate-entire-scene") {
        const sceneId = String(actionButton.dataset.scriptSceneId || "").trim();
        if (sceneId) {
          globalScope.CreatorAppV2ScriptActions.generateEntireScene(store, appElement, sceneId);
        }
        return;
      }

      if (actionButton.dataset.action === "remove-script-clip") {
        const sceneId = String(actionButton.dataset.scriptSceneId || "").trim();
        const clipId = String(actionButton.dataset.scriptClipId || "").trim();
        if (sceneId && clipId) {
          globalScope.CreatorAppV2ScriptActions.removeClip(store, appElement, sceneId, clipId);
        }
        return;
      }

      if (actionButton.dataset.action === "apply-starting-images") {
        globalScope.CreatorAppV2StartingImagesActions.applyDraftFromDom(store, appElement);
        return;
      }

      if (actionButton.dataset.action === "select-starting-image-scene") {
        const sceneId = String(actionButton.dataset.startingImageSceneId || "").trim();
        if (sceneId) {
          globalScope.CreatorAppV2StartingImagesActions.selectScene(store, sceneId);
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
          globalScope.CreatorAppV2StartingImagesActions.approveVariation(store, sceneId, variationId);
        }
        return;
      }

      if (actionButton.dataset.action === "apply-video-clips") {
        globalScope.CreatorAppV2ClipGenerationActions.applyDraftFromDom(store, appElement);
        return;
      }

      if (actionButton.dataset.action === "select-video-scene") {
        const sceneId = String(actionButton.dataset.videoSceneId || "").trim();
        if (sceneId) {
          globalScope.CreatorAppV2ClipGenerationActions.selectScene(store, sceneId);
        }
        return;
      }

      if (actionButton.dataset.action === "select-video-request") {
        const sceneId = String(actionButton.dataset.videoSceneId || "").trim();
        const requestId = String(actionButton.dataset.videoRequestId || "").trim();
        if (sceneId && requestId) {
          globalScope.CreatorAppV2ClipGenerationActions.selectRequest(store, sceneId, requestId);
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
          globalScope.CreatorAppV2ClipGenerationActions.approveGeneratedClip(store, sceneId, requestId, clipId);
        }
        return;
      }

      if (actionButton.dataset.action === "build-edit-rough-cut") {
        globalScope.CreatorAppV2EditActions.buildRoughCut(store);
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
        }
        return;
      }

      if (actionButton.dataset.action === "focus-scene-slot") {
        const sceneId = String(actionButton.dataset.videoSceneId || "").trim();
        const requestId = String(actionButton.dataset.videoRequestId || "").trim();
        if (sceneId && requestId) {
          globalScope.CreatorAppV2ClipGenerationActions.selectRequest(store, sceneId, requestId);
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
        return;
      }

      if (actionButton.dataset.action === "apply-export-draft") {
        globalScope.CreatorAppV2ExportReleaseActions.applyDraftFromDom(store, appElement);
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
          globalScope.CreatorAppV2ExportReleaseActions.selectExport(store, exportId);
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
      }
    });
  }

  globalScope.CreatorAppV2AppLifecycle = {
    bindLifecycle
  };
})(window);
