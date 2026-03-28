(function attachV2ClipGenerationStageState(globalScope) {
  function getVideoClipsDraft(store) {
    return globalScope.CreatorAppV2ProjectWorkspace.createVideoClipsDraft(
      store.getState().projectWorkspace?.videoClips?.draft || {}
    );
  }

  function getSelectedVideoScene(store) {
    const draft = getVideoClipsDraft(store);
    return draft.scenes.find((scene) => scene.id === draft.selectedSceneId) || draft.scenes[0] || null;
  }

  function getSelectedVideoRequest(store, scene = null) {
    const draft = getVideoClipsDraft(store);
    const targetScene = scene || getSelectedVideoScene(store);
    if (!targetScene) {
      return null;
    }
    return targetScene.clips.find((clip) => clip.id === draft.selectedRequestId) || targetScene.clips[0] || null;
  }

  function getVideoClipChecklist(store) {
    const draft = getVideoClipsDraft(store);
    return [
      { label: "Approved starting images linked", complete: draft.scenes.length > 0 && draft.scenes.every((scene) => Boolean(scene.startingImageUrl)) },
      { label: "Clip prompts ready", complete: draft.scenes.every((scene) => scene.clips.every((clip) => !scene.startingImageUrl || Boolean(String(clip.clipPrompt || "").trim()))) },
      { label: "Motion notes captured", complete: draft.scenes.some((scene) => scene.clips.some((clip) => Boolean(String(clip.shotNotes || "").trim()))) },
      { label: "Generated takes returned", complete: draft.scenes.some((scene) => scene.clips.some((clip) => clip.generatedClips.length > 0)) },
      { label: "Preferred take selected", complete: draft.scenes.every((scene) => scene.clips.every((clip) => !clip.generatedClips.length || Boolean(clip.approvedClipId))) }
    ];
  }

  function getSceneExecutionSummary(store, scene = null) {
    const draft = getVideoClipsDraft(store);
    const targetScene = scene || getSelectedVideoScene(store);
    if (!targetScene) {
      return {
        plannedCount: 0,
        generatedCount: 0,
        approvedCount: 0,
        readyCount: 0,
        confidence: null,
        status: "unplanned"
      };
    }

    const scriptDraft = globalScope.CreatorAppV2ScriptState.getScriptDraft(store);
    const scriptScene = (scriptDraft?.scenes || []).find((entry) => String(entry.id) === String(targetScene.scriptSceneId || targetScene.id)) || null;
    return globalScope.CreatorAppV2PipelineIntelligence.summarizeSceneExecution(targetScene, scriptScene);
  }

  globalScope.CreatorAppV2ClipGenerationState = {
    getVideoClipsDraft,
    getSelectedVideoScene,
    getSelectedVideoRequest,
    getVideoClipChecklist,
    getSceneExecutionSummary
  };
})(window);
