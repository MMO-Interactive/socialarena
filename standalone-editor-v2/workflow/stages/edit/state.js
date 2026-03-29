(function attachV2EditStageState(globalScope) {
  function getEditDraft(store) {
    return globalScope.CreatorAppV2ProjectWorkspace.createEditDraft(
      store.getState().projectWorkspace?.edit?.draft || {}
    );
  }

  function getSelectedTimelineItem(store) {
    const draft = getEditDraft(store);
    return draft.timelineItems.find((item) => item.id === draft.selectedItemId) || draft.timelineItems[0] || null;
  }

  function getSelectedEditItem(store) {
    const state = store.getState();
    const draft = getEditDraft(store);
    const timelineItem = draft.timelineItems.find((item) => item.id === draft.selectedItemId);
    if (timelineItem) {
      return timelineItem;
    }

    const importedAsset = (state.projectWorkspace?.importedAssets || []).find((asset) => asset.id === draft.selectedItemId);
    if (importedAsset) {
      return {
        id: importedAsset.id,
        sceneId: "",
        sceneTitle: "",
        requestId: importedAsset.id,
        title: importedAsset.name,
        videoUrl: importedAsset.sourceUrl,
        thumbnailUrl: importedAsset.thumbnailUrl,
        durationSeconds: importedAsset.durationSeconds,
        type: importedAsset.kind,
        trackId: importedAsset.kind === "audio" ? "A1" : "V1",
        placementType: "source_asset",
        planningSource: "imported_media",
        sourceKind: "imported"
      };
    }

    return draft.timelineItems[0] || null;
  }

  function getEditCoverage(store) {
    const state = store.getState();
    const editDraft = getEditDraft(store);
    const videoDraft = globalScope.CreatorAppV2ClipGenerationState.getVideoClipsDraft(store);
    const totalClipSlots = videoDraft.scenes.reduce((total, scene) => total + scene.clips.length, 0);
    const selectedClipSlots = videoDraft.scenes.reduce(
      (total, scene) => total + scene.clips.filter((clip) => Boolean(clip.approvedClipId || clip.generatedClips[0])).length,
      0
    );
    const scenesCovered = new Set(editDraft.timelineItems.map((item) => item.sceneId).filter(Boolean)).size;

    return {
      timelineItems: editDraft.timelineItems.length,
      totalClipSlots,
      selectedClipSlots,
      scenesCovered,
      totalScenes: videoDraft.scenes.length,
      totalDurationSeconds: editDraft.totalDurationSeconds,
      dirty: Boolean(state.projectWorkspace?.edit?.dirty)
    };
  }

  function getActiveScene(store) {
    const draft = getEditDraft(store);
    const videoDraft = globalScope.CreatorAppV2ClipGenerationState.getVideoClipsDraft(store);
    return videoDraft.scenes.find((scene) => String(scene.scriptSceneId || scene.id) === String(draft.activeSceneId || "")) || videoDraft.scenes[0] || null;
  }

  function getPlayheadSeconds(store) {
    return Math.max(0, Number(getEditDraft(store).playheadSeconds || 0));
  }

  function getTimelineMarkers(store) {
    return getEditDraft(store).markers || [];
  }

  globalScope.CreatorAppV2EditState = {
    getEditDraft,
    getSelectedTimelineItem,
    getSelectedEditItem,
    getEditCoverage,
    getActiveScene,
    getPlayheadSeconds,
    getTimelineMarkers
  };
})(window);
