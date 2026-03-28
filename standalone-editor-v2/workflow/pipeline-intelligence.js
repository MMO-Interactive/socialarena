(function attachV2PipelineIntelligence(globalScope) {
  function normalizeText(value) {
    return String(value || "").trim();
  }

  function normalizeList(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => normalizeText(entry)).filter(Boolean);
    }
    return normalizeText(value)
      .split(/[,\n]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function hasRealClipContent(clip) {
    return Boolean(
      normalizeText(clip?.title)
      || normalizeText(clip?.prompt)
      || normalizeText(clip?.dialogue)
      || normalizeText(clip?.shotNotes)
    );
  }

  function getSceneConfidence(scene) {
    const checks = [
      { label: "Summary", complete: Boolean(normalizeText(scene?.summary)), weight: 20 },
      { label: "Objective", complete: Boolean(normalizeText(scene?.objective)), weight: 15 },
      { label: "Location", complete: Boolean(normalizeText(scene?.location)), weight: 15 },
      { label: "Characters", complete: normalizeList(scene?.characters).length > 0, weight: 15 },
      { label: "Mood", complete: normalizeList(scene?.mood).length > 0, weight: 10 },
      { label: "Time Of Day", complete: Boolean(normalizeText(scene?.timeOfDay)), weight: 5 },
      { label: "Shot Plan", complete: Array.isArray(scene?.clips) && scene.clips.some((clip) => hasRealClipContent(clip)), weight: 20 }
    ];

    const score = checks.reduce((total, check) => total + (check.complete ? check.weight : 0), 0);
    const level = score >= 80 ? "green" : score >= 55 ? "yellow" : "red";
    const label = level === "green" ? "Ready" : level === "yellow" ? "Risky" : "Weak";

    return {
      score,
      level,
      label,
      checks
    };
  }

  function buildSceneShotPlan(scene) {
    const sceneTitle = normalizeText(scene?.title) || "Scene";
    const summary = normalizeText(scene?.summary);
    const location = normalizeText(scene?.location);
    const timeOfDay = normalizeText(scene?.timeOfDay);
    const objective = normalizeText(scene?.objective);
    const characters = normalizeList(scene?.characters);
    const mood = normalizeList(scene?.mood);
    const subject = characters.length ? characters.join(", ") : "the key subject";
    const atmosphere = mood.length ? mood.join(", ") : "cinematic";
    const place = location || "the scene location";
    const timePhrase = timeOfDay || "the current time of day";
    const intent = objective || summary || "advance the scene";

    return [
      {
        role: "establishing",
        title: `${sceneTitle} Establishing`,
        prompt: `Establish ${place} at ${timePhrase} with ${subject}. Show the environment and visual tone that frames this scene.`,
        shotNotes: `Wide establishing shot. Mood: ${atmosphere}. Intent: orient the audience before the action begins.`
      },
      {
        role: "primary_action",
        title: `${sceneTitle} Primary Beat`,
        prompt: `Capture ${subject} in the core dramatic action of the scene: ${summary || intent}. Keep the image grounded in ${place}.`,
        shotNotes: `Primary action shot. Drive the narrative objective: ${intent}. Camera should favor readable story action over spectacle.`
      },
      {
        role: "emotional",
        title: `${sceneTitle} Emotional Beat`,
        prompt: `Focus on the emotional shift for ${subject} as the scene lands its key beat. Emphasize the feeling of ${atmosphere}.`,
        shotNotes: `Medium or close emotional coverage. Prioritize expression, reaction, and story subtext tied to: ${intent}.`
      },
      {
        role: "transition",
        title: `${sceneTitle} Transition`,
        prompt: `Create a connective visual beat from ${place} that can bridge this scene into the next moment while preserving ${atmosphere}.`,
        shotNotes: `Cutaway or transition shot. Designed to support pacing, continuity, and edit flexibility after the primary beat.`
      }
    ];
  }

  function summarizeSceneExecution(scene, scriptScene = null) {
    const confidence = scriptScene ? getSceneConfidence(scriptScene) : null;
    const clips = Array.isArray(scene?.clips) ? scene.clips : [];
    const plannedCount = clips.length;
    const generatedCount = clips.filter((clip) => Array.isArray(clip.generatedClips) && clip.generatedClips.length > 0).length;
    const approvedCount = clips.filter((clip) => Boolean(String(clip.approvedClipId || "").trim())).length;
    const readyCount = clips.filter((clip) => Boolean(String(clip.clipPrompt || "").trim())).length;
    const status = approvedCount === plannedCount && plannedCount
      ? "ready"
      : generatedCount > 0 || readyCount > 0
        ? "in_progress"
        : "unplanned";

    return {
      plannedCount,
      generatedCount,
      approvedCount,
      readyCount,
      confidence,
      status
    };
  }

  function findVideoClipRequest(videoDraft, requestId) {
    for (const scene of Array.isArray(videoDraft?.scenes) ? videoDraft.scenes : []) {
      for (const request of Array.isArray(scene?.clips) ? scene.clips : []) {
        if (String(request.id) === String(requestId)) {
          return {
            scene,
            request
          };
        }
      }
    }
    return null;
  }

  globalScope.CreatorAppV2PipelineIntelligence = {
    getSceneConfidence,
    buildSceneShotPlan,
    summarizeSceneExecution,
    findVideoClipRequest
  };
})(window);
