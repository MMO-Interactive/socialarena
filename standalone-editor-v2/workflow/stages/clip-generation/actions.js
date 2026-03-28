(function attachV2ClipGenerationStageActions(globalScope) {
  function buildDraftFromDom(appElement, fallbackDraft) {
    const currentDraft = globalScope.CreatorAppV2ProjectWorkspace.createVideoClipsDraft(fallbackDraft || {});
    return {
      ...currentDraft,
      scenes: currentDraft.scenes.map((scene) => ({
        ...scene,
        clips: scene.clips.map((clip) => ({
          ...clip,
          title: String(appElement.querySelector(`[data-video-clip-field="title"][data-video-scene-id="${scene.id}"][data-video-request-id="${clip.id}"]`)?.value || clip.title || "").trim(),
          clipPrompt: String(appElement.querySelector(`[data-video-clip-field="clipPrompt"][data-video-scene-id="${scene.id}"][data-video-request-id="${clip.id}"]`)?.value || clip.clipPrompt || "").trim(),
          shotNotes: String(appElement.querySelector(`[data-video-clip-field="shotNotes"][data-video-scene-id="${scene.id}"][data-video-request-id="${clip.id}"]`)?.value || clip.shotNotes || "").trim()
        }))
      })),
      updatedAt: new Date().toISOString()
    };
  }

  function applyDraftFromDom(store, appElement) {
    const nextDraft = buildDraftFromDom(appElement, globalScope.CreatorAppV2ClipGenerationState.getVideoClipsDraft(store));
    globalScope.CreatorAppV2ProjectWorkspace.updateVideoClipsDraft(store, nextDraft);
    store.setState((state) => ({
      ...state,
      workflow: {
        ...state.workflow,
        notice: "Clip generation plan applied."
      }
    }));
  }

  function selectScene(store, sceneId) {
    globalScope.CreatorAppV2ProjectWorkspace.updateVideoClipsDraft(store, (draft) => {
      const scene = draft.scenes.find((entry) => entry.id === sceneId) || draft.scenes[0] || null;
      return {
        ...draft,
        selectedSceneId: sceneId,
        selectedRequestId: scene?.clips?.[0]?.id || draft.selectedRequestId || "",
        updatedAt: new Date().toISOString()
      };
    });
  }

  function selectRequest(store, sceneId, requestId) {
    globalScope.CreatorAppV2ProjectWorkspace.updateVideoClipsDraft(store, (draft) => ({
      ...draft,
      selectedSceneId: sceneId,
      selectedRequestId: requestId,
      updatedAt: new Date().toISOString()
    }));
  }

  async function generateForRequest(store, appElement, sceneId, requestId) {
    const state = store.getState();
    const activeProject = state.projectWorkspace?.activeProject;
    if (!activeProject?.id || !activeProject?.type) {
      return;
    }

    const nextDraft = buildDraftFromDom(appElement, globalScope.CreatorAppV2ClipGenerationState.getVideoClipsDraft(store));
    globalScope.CreatorAppV2ProjectWorkspace.updateVideoClipsDraft(store, nextDraft);
    const scene = nextDraft.scenes.find((entry) => entry.id === sceneId);
    const request = scene?.clips.find((entry) => entry.id === requestId);
    if (!scene || !request || !scene.startingImageUrl) {
      globalScope.CreatorAppV2ProjectWorkspace.setVideoClipsError(store, "An approved starting image is required before generating a clip.");
      return;
    }
    if (!request.clipPrompt) {
      globalScope.CreatorAppV2ProjectWorkspace.setVideoClipsError(store, "A clip prompt is required before generating a clip.");
      return;
    }

    globalScope.CreatorAppV2ProjectWorkspace.setVideoClipsLoading(store, true);
    try {
      const payload = await state.endpoints.videoClips.generate(
        state.session.token,
        state.session.studioId,
        activeProject.type,
        activeProject.id,
        {
          scene_id: `${scene.scriptSceneId || scene.id}::${request.id}`,
          scene_title: scene.title,
          clip_prompt: request.clipPrompt,
          shot_notes: request.shotNotes,
          reference_image_url: scene.startingImageUrl,
          board_item_id: request.boardItemId || ""
        }
      );
      globalScope.CreatorAppV2ProjectWorkspace.applyVideoClipPayload(store, sceneId, requestId, payload?.video_clip || payload?.starting_image || {});
      store.setState((currentState) => ({
        ...currentState,
        workflow: {
          ...currentState.workflow,
          notice: `Queued clip generation for ${scene.title} / ${request.title}.`
        }
      }));
    } catch (error) {
      globalScope.CreatorAppV2ProjectWorkspace.setVideoClipsError(store, error.message || "Failed to queue clip generation.");
    }
  }

  async function refreshForRequest(store, sceneId, requestId) {
    const state = store.getState();
    const activeProject = state.projectWorkspace?.activeProject;
    const draft = globalScope.CreatorAppV2ClipGenerationState.getVideoClipsDraft(store);
    const scene = draft.scenes.find((entry) => entry.id === sceneId);
    const request = scene?.clips.find((entry) => entry.id === requestId);
    if (!activeProject?.id || !activeProject?.type || !request?.boardItemId) {
      return;
    }

    globalScope.CreatorAppV2ProjectWorkspace.setVideoClipsLoading(store, true);
    try {
      const payload = await state.endpoints.videoClips.refresh(
        state.session.token,
        state.session.studioId,
        activeProject.type,
        activeProject.id,
        {
          board_item_id: request.boardItemId
        }
      );
      globalScope.CreatorAppV2ProjectWorkspace.applyVideoClipPayload(store, sceneId, requestId, payload?.video_clip || payload?.starting_image || {});
      store.setState((currentState) => ({
        ...currentState,
        workflow: {
          ...currentState.workflow,
          notice: payload?.video_clip?.generated_video_url || payload?.starting_image?.generated_video_url
            ? `Clip ready for ${scene.title} / ${request.title}.`
            : `Refreshed clip generation status for ${scene.title} / ${request.title}.`
        }
      }));
    } catch (error) {
      globalScope.CreatorAppV2ProjectWorkspace.setVideoClipsError(store, error.message || "Failed to refresh clip generation.");
    }
  }

  function approveGeneratedClip(store, sceneId, requestId, clipId) {
    globalScope.CreatorAppV2ProjectWorkspace.updateVideoClipsDraft(store, (draft) => ({
      ...draft,
      scenes: draft.scenes.map((scene) => ({
        ...scene,
        clips: scene.clips.map((clip) =>
          clip.id === requestId && scene.id === sceneId
            ? {
                ...clip,
                approvedClipId: clipId,
                status: "generated"
              }
            : clip
        )
      })),
      updatedAt: new Date().toISOString()
    }));
    store.setState((state) => ({
      ...state,
      workflow: {
        ...state.workflow,
        notice: "Preferred generated clip selected."
      }
    }));
  }

  globalScope.CreatorAppV2ClipGenerationActions = {
    applyDraftFromDom,
    selectScene,
    selectRequest,
    generateForRequest,
    refreshForRequest,
    approveGeneratedClip
  };
})(window);
