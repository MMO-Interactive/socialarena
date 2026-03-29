(function attachV2EditStageActions(globalScope) {
  function buildRoughCut(store) {
    const state = store.getState();
    const draft = globalScope.CreatorAppV2ProjectWorkspace.buildEditDraftFromVideoClips(
      state.projectWorkspace?.videoClips?.draft || {},
      state.projectWorkspace?.edit?.draft || {}
    );
    globalScope.CreatorAppV2ProjectWorkspace.updateEditDraft(store, {
      ...draft,
      updatedAt: new Date().toISOString()
    });
    store.setState((currentState) => ({
      ...currentState,
      workflow: {
        ...currentState.workflow,
        notice: draft.timelineItems.length
          ? "Rough cut assembled from selected generated clips."
          : "No approved clip selections are available to assemble yet."
      }
    }));
  }

  function selectTimelineItem(store, itemId) {
    globalScope.CreatorAppV2ProjectWorkspace.updateEditDraft(store, (draft) => ({
      ...draft,
      selectedItemId: itemId,
      updatedAt: new Date().toISOString()
    }));
  }

  function selectImportedAsset(store, assetId) {
    globalScope.CreatorAppV2ProjectWorkspace.updateEditDraft(store, (draft) => ({
      ...draft,
      selectedItemId: assetId,
      updatedAt: new Date().toISOString()
    }));
  }

  function setActiveScene(store, sceneId) {
    globalScope.CreatorAppV2ProjectWorkspace.setEditActiveScene(store, sceneId);
  }

  function setPlayhead(store, timeSeconds) {
    globalScope.CreatorAppV2ProjectWorkspace.setEditPlayhead(store, timeSeconds);
  }

  function stepPlayhead(store, deltaSeconds = 1) {
    globalScope.CreatorAppV2ProjectWorkspace.stepEditPlayhead(store, deltaSeconds);
    return true;
  }

  function addMarkerAtPlayhead(store) {
    globalScope.CreatorAppV2ProjectWorkspace.addEditMarkerAtPlayhead(store);
    return true;
  }

  function startPlayback(store) {
    void store;
    return true;
  }

  function pausePlayback() {
    return true;
  }

  function stopPlayback(store) {
    globalScope.CreatorAppV2ProjectWorkspace.setEditPlayhead(store, 0);
    return true;
  }

  function assignSelectedTimelineItemToActiveScene(store) {
    const selectedItem = globalScope.CreatorAppV2EditState.getSelectedTimelineItem(store);
    const activeScene = globalScope.CreatorAppV2EditState.getActiveScene(store);
    if (!selectedItem || !activeScene) {
      return false;
    }
    globalScope.CreatorAppV2ProjectWorkspace.assignTimelineItemToScene(
      store,
      selectedItem.id,
      activeScene.scriptSceneId || activeScene.id,
      activeScene.title
    );
    return true;
  }

  function updateSelectedTimelineItemPlacementType(store, placementType) {
    const selectedItem = globalScope.CreatorAppV2EditState.getSelectedTimelineItem(store);
    const activeScene = globalScope.CreatorAppV2EditState.getActiveScene(store);
    if (!selectedItem) {
      return false;
    }

    globalScope.CreatorAppV2ProjectWorkspace.updateTimelineItemPlacementType(store, selectedItem.id, placementType);
    if (String(placementType || "").trim() === "scene_shot" && activeScene) {
      globalScope.CreatorAppV2ProjectWorkspace.assignTimelineItemToScene(
        store,
        selectedItem.id,
        activeScene.scriptSceneId || activeScene.id,
        activeScene.title
      );
    }
    return true;
  }

  function moveSelectedTimelineItem(store, direction) {
    const selectedItem = globalScope.CreatorAppV2EditState.getSelectedTimelineItem(store);
    if (!selectedItem) {
      return false;
    }
    globalScope.CreatorAppV2ProjectWorkspace.moveTimelineItemHorizontally(store, selectedItem.id, direction);
    return true;
  }

  function duplicateSelectedTimelineItem(store) {
    const selectedItem = globalScope.CreatorAppV2EditState.getSelectedTimelineItem(store);
    if (!selectedItem) {
      return false;
    }
    globalScope.CreatorAppV2ProjectWorkspace.duplicateTimelineItem(store, selectedItem.id);
    return true;
  }

  function splitSelectedTimelineItem(store) {
    const selectedItem = globalScope.CreatorAppV2EditState.getSelectedTimelineItem(store);
    if (!selectedItem) {
      return false;
    }
    globalScope.CreatorAppV2ProjectWorkspace.splitTimelineItem(store, selectedItem.id);
    return true;
  }

  function removeSelectedTimelineItem(store) {
    const selectedItem = globalScope.CreatorAppV2EditState.getSelectedTimelineItem(store);
    if (!selectedItem) {
      return false;
    }
    globalScope.CreatorAppV2ProjectWorkspace.removeTimelineItem(store, selectedItem.id);
    return true;
  }

  function moveSelectedTimelineItemVertical(store, direction) {
    const selectedItem = globalScope.CreatorAppV2EditState.getSelectedTimelineItem(store);
    if (!selectedItem) {
      return false;
    }
    globalScope.CreatorAppV2ProjectWorkspace.moveTimelineItemVertically(store, selectedItem.id, direction);
    return true;
  }

  function trimSelectedTimelineItem(store, direction) {
    const selectedItem = globalScope.CreatorAppV2EditState.getSelectedTimelineItem(store);
    if (!selectedItem) {
      return false;
    }
    globalScope.CreatorAppV2ProjectWorkspace.trimTimelineItemDuration(store, selectedItem.id, direction);
    return true;
  }

  function setTimelineItemDuration(store, itemId, durationSeconds) {
    if (!itemId) {
      return false;
    }
    globalScope.CreatorAppV2ProjectWorkspace.setTimelineItemDuration(store, itemId, durationSeconds);
    return true;
  }

  function replaceSelectedTimelineItemFromApprovedTake(store) {
    const selectedItem = globalScope.CreatorAppV2EditState.getSelectedTimelineItem(store);
    if (!selectedItem?.requestId) {
      return false;
    }

    const videoDraft = globalScope.CreatorAppV2ClipGenerationState.getVideoClipsDraft(store);
    const trace = globalScope.CreatorAppV2PipelineIntelligence.findVideoClipRequest(videoDraft, selectedItem.requestId);
    const request = trace?.request || null;
    const approvedClip = request
      ? (request.generatedClips || []).find((clip) => String(clip.id) === String(request.approvedClipId))
        || request.generatedClips?.[0]
        || null
      : null;

    if (!approvedClip?.videoUrl) {
      return false;
    }

    globalScope.CreatorAppV2ProjectWorkspace.replaceTimelineItemFromGeneratedClip(
      store,
      selectedItem.id,
      approvedClip,
      request
    );
    return true;
  }

  function moveTimelineItemByDrop(store, itemId, target) {
    if (!itemId) {
      return false;
    }
    globalScope.CreatorAppV2ProjectWorkspace.moveTimelineItemToDropTarget(store, itemId, target);
    return true;
  }

  globalScope.CreatorAppV2EditActions = {
    buildRoughCut,
    selectTimelineItem,
    selectImportedAsset,
    setActiveScene,
    setPlayhead,
    stepPlayhead,
    addMarkerAtPlayhead,
    startPlayback,
    pausePlayback,
    stopPlayback,
    assignSelectedTimelineItemToActiveScene,
    updateSelectedTimelineItemPlacementType,
    moveSelectedTimelineItem,
    moveSelectedTimelineItemVertical,
    duplicateSelectedTimelineItem,
    splitSelectedTimelineItem,
    removeSelectedTimelineItem,
    trimSelectedTimelineItem,
    setTimelineItemDuration,
    moveTimelineItemByDrop,
    replaceSelectedTimelineItemFromApprovedTake
  };
})(window);
