(function attachV2ScriptStageActions(globalScope) {
  function parseTagField(value) {
    return String(value || "")
      .split(/[,\n]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function buildDraftFromDom(appElement, fallbackDraft) {
    const currentDraft = globalScope.CreatorAppV2ProjectWorkspace.createScriptDraft(fallbackDraft || {});
    const scenes = currentDraft.scenes.map((scene) => {
      const nextScene = {
        ...scene,
        title: String(appElement.querySelector(`[data-script-field="title"][data-script-scene-id="${scene.id}"]`)?.value || scene.title || "").trim(),
        summary: String(appElement.querySelector(`[data-script-field="summary"][data-script-scene-id="${scene.id}"]`)?.value || scene.summary || "").trim(),
        location: String(appElement.querySelector(`[data-script-field="location"][data-script-scene-id="${scene.id}"]`)?.value || scene.location || "").trim(),
        timeOfDay: String(appElement.querySelector(`[data-script-field="timeOfDay"][data-script-scene-id="${scene.id}"]`)?.value || scene.timeOfDay || "").trim(),
        objective: String(appElement.querySelector(`[data-script-field="objective"][data-script-scene-id="${scene.id}"]`)?.value || scene.objective || "").trim(),
        characters: parseTagField(appElement.querySelector(`[data-script-field="characters"][data-script-scene-id="${scene.id}"]`)?.value || scene.characters.join(", ")),
        mood: parseTagField(appElement.querySelector(`[data-script-field="mood"][data-script-scene-id="${scene.id}"]`)?.value || scene.mood.join(", ")),
        clips: scene.clips.map((clip) => ({
          ...clip,
          title: String(appElement.querySelector(`[data-script-clip-field="title"][data-script-scene-id="${scene.id}"][data-script-clip-id="${clip.id}"]`)?.value || clip.title || "").trim(),
          prompt: String(appElement.querySelector(`[data-script-clip-field="prompt"][data-script-scene-id="${scene.id}"][data-script-clip-id="${clip.id}"]`)?.value || clip.prompt || "").trim(),
          dialogue: String(appElement.querySelector(`[data-script-clip-field="dialogue"][data-script-scene-id="${scene.id}"][data-script-clip-id="${clip.id}"]`)?.value || clip.dialogue || "").trim(),
          shotNotes: String(appElement.querySelector(`[data-script-clip-field="shotNotes"][data-script-scene-id="${scene.id}"][data-script-clip-id="${clip.id}"]`)?.value || clip.shotNotes || "").trim()
        }))
      };
      return globalScope.CreatorAppV2ProjectWorkspace.createScriptScene(nextScene, 0);
    });

    return globalScope.CreatorAppV2ProjectWorkspace.createScriptDraft({
      scenes,
      updatedAt: new Date().toISOString()
    });
  }

  function applyScriptDraftFromDom(store, appElement) {
    const currentDraft = globalScope.CreatorAppV2ScriptState.getScriptDraft(store);
    const nextDraft = buildDraftFromDom(appElement, currentDraft);
    globalScope.CreatorAppV2ProjectWorkspace.updateScriptDraft(store, nextDraft);
    globalScope.CreatorAppV2ProjectWorkspace.applyScriptDraft(store);
    store.setState((state) => ({
      ...state,
      workflow: {
        ...state.workflow,
        notice: "Script draft applied to project workflow state."
      }
    }));
  }

  function addScene(store, appElement) {
    const currentDraft = buildDraftFromDom(appElement, globalScope.CreatorAppV2ScriptState.getScriptDraft(store));
    currentDraft.scenes.push(globalScope.CreatorAppV2ProjectWorkspace.createScriptScene({}, currentDraft.scenes.length));
    globalScope.CreatorAppV2ProjectWorkspace.updateScriptDraft(store, currentDraft);
    globalScope.CreatorAppV2ProjectWorkspace.applyScriptDraft(store);
  }

  function removeScene(store, appElement, sceneId) {
    const currentDraft = buildDraftFromDom(appElement, globalScope.CreatorAppV2ScriptState.getScriptDraft(store));
    currentDraft.scenes = currentDraft.scenes.filter((scene) => scene.id !== sceneId);
    if (!currentDraft.scenes.length) {
      currentDraft.scenes = [globalScope.CreatorAppV2ProjectWorkspace.createScriptScene({}, 0)];
    }
    globalScope.CreatorAppV2ProjectWorkspace.updateScriptDraft(store, currentDraft);
    globalScope.CreatorAppV2ProjectWorkspace.applyScriptDraft(store);
  }

  function addClip(store, appElement, sceneId) {
    const currentDraft = buildDraftFromDom(appElement, globalScope.CreatorAppV2ScriptState.getScriptDraft(store));
    currentDraft.scenes = currentDraft.scenes.map((scene) => {
      if (scene.id !== sceneId) {
        return scene;
      }
      return {
        ...scene,
        clips: [...scene.clips, globalScope.CreatorAppV2ProjectWorkspace.createScriptClip({}, scene.clips.length)]
      };
    });
    globalScope.CreatorAppV2ProjectWorkspace.updateScriptDraft(store, currentDraft);
    globalScope.CreatorAppV2ProjectWorkspace.applyScriptDraft(store);
  }

  function removeClip(store, appElement, sceneId, clipId) {
    const currentDraft = buildDraftFromDom(appElement, globalScope.CreatorAppV2ScriptState.getScriptDraft(store));
    currentDraft.scenes = currentDraft.scenes.map((scene) => {
      if (scene.id !== sceneId) {
        return scene;
      }
      const nextClips = scene.clips.filter((clip) => clip.id !== clipId);
      return {
        ...scene,
        clips: nextClips.length ? nextClips : [globalScope.CreatorAppV2ProjectWorkspace.createScriptClip({}, 0)]
      };
    });
    globalScope.CreatorAppV2ProjectWorkspace.updateScriptDraft(store, currentDraft);
    globalScope.CreatorAppV2ProjectWorkspace.applyScriptDraft(store);
  }

  function generateEntireScene(store, appElement, sceneId) {
    const currentDraft = buildDraftFromDom(appElement, globalScope.CreatorAppV2ScriptState.getScriptDraft(store));
    currentDraft.scenes = currentDraft.scenes.map((scene) => {
      if (scene.id !== sceneId) {
        return scene;
      }

      const shotPlan = globalScope.CreatorAppV2PipelineIntelligence.buildSceneShotPlan(scene);
      const preserveExisting = scene.clips.some((clip) => {
        const normalizedTitle = String(clip.title || "").trim().toLowerCase();
        const normalizedPrompt = String(clip.prompt || "").trim();
        return normalizedPrompt || (normalizedTitle && !/^clip\s+\d+$/i.test(normalizedTitle));
      });

      const generatedClips = shotPlan.map((shot, index) => globalScope.CreatorAppV2ProjectWorkspace.createScriptClip({
        id: `${scene.id}-generated-shot-${index + 1}`,
        title: shot.title,
        prompt: shot.prompt,
        dialogue: "",
        shotNotes: shot.shotNotes,
        shotRole: shot.role,
        planningSource: "scene_generation"
      }, index));

      return {
        ...scene,
        clips: preserveExisting
          ? [...scene.clips, ...generatedClips.filter((generated) => !scene.clips.some((clip) => String(clip.title || "").trim().toLowerCase() === String(generated.title || "").trim().toLowerCase()))]
          : generatedClips
      };
    });

    globalScope.CreatorAppV2ProjectWorkspace.updateScriptDraft(store, currentDraft);
    globalScope.CreatorAppV2ProjectWorkspace.applyScriptDraft(store);
    store.setState((state) => ({
      ...state,
      workflow: {
        ...state.workflow,
        notice: "Generated a scene-level shot plan and populated real clip slots."
      }
    }));
  }

  globalScope.CreatorAppV2ScriptActions = {
    applyScriptDraftFromDom,
    addScene,
    removeScene,
    addClip,
    removeClip,
    generateEntireScene
  };
})(window);
