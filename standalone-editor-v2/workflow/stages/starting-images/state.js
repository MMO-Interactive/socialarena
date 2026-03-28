(function attachV2StartingImagesStageState(globalScope) {
  function getStartingImagesDraft(store) {
    return globalScope.CreatorAppV2ProjectWorkspace.createStartingImagesDraft(
      store.getState().projectWorkspace?.startingImages?.draft || {}
    );
  }

  function getSelectedStartingImageScene(store) {
    const draft = getStartingImagesDraft(store);
    return draft.scenes.find((scene) => scene.id === draft.selectedSceneId) || draft.scenes[0] || null;
  }

  function getStartingImagesChecklist(store) {
    const draft = getStartingImagesDraft(store);
    return [
      { label: "Scenes available", complete: draft.scenes.length > 0 },
      { label: "Prompts ready", complete: draft.scenes.every((scene) => Boolean(String(scene.prompt || "").trim())) },
      { label: "Shot notes captured", complete: draft.scenes.some((scene) => Boolean(String(scene.shotNotes || "").trim())) },
      { label: "Approved anchor frames", complete: draft.scenes.length > 0 && draft.scenes.every((scene) => Boolean(scene.approvedVariationId)) }
    ];
  }

  globalScope.CreatorAppV2StartingImagesState = {
    getStartingImagesDraft,
    getSelectedStartingImageScene,
    getStartingImagesChecklist
  };
})(window);
