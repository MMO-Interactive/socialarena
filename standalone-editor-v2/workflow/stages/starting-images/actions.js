(function attachV2StartingImagesStageActions(globalScope) {
  function buildDraftFromDom(appElement, fallbackDraft) {
    const currentDraft = globalScope.CreatorAppV2ProjectWorkspace.createStartingImagesDraft(fallbackDraft || {});
    return {
      ...currentDraft,
      scenes: currentDraft.scenes.map((scene) => ({
        ...scene,
        prompt: String(appElement.querySelector(`[data-starting-image-field="prompt"][data-starting-image-scene-id="${scene.id}"]`)?.value || scene.prompt || "").trim(),
        shotNotes: String(appElement.querySelector(`[data-starting-image-field="shotNotes"][data-starting-image-scene-id="${scene.id}"]`)?.value || scene.shotNotes || "").trim()
      })),
      updatedAt: new Date().toISOString()
    };
  }

  function applyDraftFromDom(store, appElement) {
    const nextDraft = buildDraftFromDom(appElement, globalScope.CreatorAppV2StartingImagesState.getStartingImagesDraft(store));
    globalScope.CreatorAppV2ProjectWorkspace.updateStartingImagesDraft(store, nextDraft);
    store.setState((state) => ({
      ...state,
      workflow: {
        ...state.workflow,
        notice: "Starting image plan applied."
      }
    }));
  }

  function selectScene(store, sceneId) {
    globalScope.CreatorAppV2ProjectWorkspace.updateStartingImagesDraft(store, (draft) => ({
      ...draft,
      selectedSceneId: sceneId,
      updatedAt: new Date().toISOString()
    }));
  }

  async function generateForScene(store, appElement, sceneId) {
    const state = store.getState();
    const activeProject = state.projectWorkspace?.activeProject;
    if (!activeProject?.id || !activeProject?.type) {
      return;
    }

    const nextDraft = buildDraftFromDom(appElement, globalScope.CreatorAppV2StartingImagesState.getStartingImagesDraft(store));
    globalScope.CreatorAppV2ProjectWorkspace.updateStartingImagesDraft(store, nextDraft);
    const scene = nextDraft.scenes.find((entry) => entry.id === sceneId);
    if (!scene || !scene.prompt) {
      globalScope.CreatorAppV2ProjectWorkspace.setStartingImagesError(store, "A prompt is required before generating a starting image.");
      return;
    }

    globalScope.CreatorAppV2ProjectWorkspace.setStartingImagesLoading(store, true);
    try {
      const payload = await state.endpoints.startingImages.generate(
        state.session.token,
        state.session.studioId,
        activeProject.type,
        activeProject.id,
        {
          scene_id: scene.scriptSceneId || scene.id,
          scene_title: scene.title,
          prompt: scene.prompt,
          shot_notes: scene.shotNotes,
          board_item_id: scene.boardItemId || ""
        }
      );
      globalScope.CreatorAppV2ProjectWorkspace.applyStartingImagePayload(store, sceneId, payload?.starting_image || {});
      store.setState((currentState) => ({
        ...currentState,
        workflow: {
          ...currentState.workflow,
          notice: `Queued starting image generation for ${scene.title}.`
        }
      }));
    } catch (error) {
      globalScope.CreatorAppV2ProjectWorkspace.setStartingImagesError(store, error.message || "Failed to queue starting image generation.");
    }
  }

  async function refreshForScene(store, sceneId) {
    const state = store.getState();
    const activeProject = state.projectWorkspace?.activeProject;
    const draft = globalScope.CreatorAppV2StartingImagesState.getStartingImagesDraft(store);
    const scene = draft.scenes.find((entry) => entry.id === sceneId);
    if (!activeProject?.id || !activeProject?.type || !scene?.boardItemId) {
      return;
    }

    globalScope.CreatorAppV2ProjectWorkspace.setStartingImagesLoading(store, true);
    try {
      const payload = await state.endpoints.startingImages.refresh(
        state.session.token,
        state.session.studioId,
        activeProject.type,
        activeProject.id,
        {
          board_item_id: scene.boardItemId
        }
      );
      globalScope.CreatorAppV2ProjectWorkspace.applyStartingImagePayload(store, sceneId, payload?.starting_image || {});
      store.setState((currentState) => ({
        ...currentState,
        workflow: {
          ...currentState.workflow,
          notice: payload?.starting_image?.generated_image_url
            ? `Starting image ready for ${scene.title}.`
            : `Refreshed starting image status for ${scene.title}.`
        }
      }));
    } catch (error) {
      globalScope.CreatorAppV2ProjectWorkspace.setStartingImagesError(store, error.message || "Failed to refresh starting image generation.");
    }
  }

  function approveVariation(store, sceneId, variationId) {
    globalScope.CreatorAppV2ProjectWorkspace.updateStartingImagesDraft(store, (draft) => ({
      ...draft,
      scenes: draft.scenes.map((scene) =>
        scene.id === sceneId
          ? {
              ...scene,
              approvedVariationId: variationId,
              status: "approved"
            }
          : scene
      ),
      updatedAt: new Date().toISOString()
    }));
    store.setState((state) => ({
      ...state,
      workflow: {
        ...state.workflow,
        notice: "Approved starting image anchor frame."
      }
    }));
  }

  globalScope.CreatorAppV2StartingImagesActions = {
    applyDraftFromDom,
    selectScene,
    generateForScene,
    refreshForScene,
    approveVariation
  };
})(window);
