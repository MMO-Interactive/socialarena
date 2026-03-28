(function attachEditorWorkflowStateModules(globalScope) {
  function createWorkflowStateHelpers(deps) {
    const {
      state,
      normalizeProjectFormat,
      createProjectPitchState,
      createScriptScene,
      createScriptClip,
      createScriptState,
      createStartingImagesState,
      createStartingImageScene,
      createVideoClipsState,
      createVideoClipScene,
      createVideoClipRequest
    } = deps;

  function updateProjectPitch(project, field, value) {
    if (!project) {
      return;
    }

    project.projectPitch = createProjectPitchState({
      ...project.projectPitch,
      format: project.projectPitch?.format || project.type || "episode"
    });

    if (field === "projectName") {
      project.name = value || "Untitled SocialArena Project";
    } else if (field === "format") {
      project.type = normalizeProjectFormat(value, "episode");
      project.projectPitch.format = project.type;
    } else if (field === "tone") {
      project.projectPitch.tone = String(value || "")
        .split(/[,\n]+/)
        .map((entry) => entry.trim())
        .filter(Boolean);
    } else {
      project.projectPitch[field] = value;
    }

    project.projectPitch.updatedAt = new Date().toISOString();
  }

  function projectPitchFields(project) {
    const projectPitch = createProjectPitchState(project?.projectPitch || {});
    return [
      { label: "Project title", complete: Boolean(project?.name?.trim()) },
      { label: "Format", complete: Boolean(projectPitch.format) },
      { label: "Logline", complete: Boolean(projectPitch.logline.trim()) },
      { label: "Concept brief", complete: Boolean(projectPitch.concept.trim()) },
      { label: "Audience", complete: Boolean(projectPitch.audience.trim()) },
      { label: "Tone and style", complete: projectPitch.tone.length > 0 || Boolean(projectPitch.visualStyle.trim()) },
      { label: "Success criteria", complete: Boolean(projectPitch.successCriteria.trim()) }
    ];
  }

  function buildScriptSeed(project) {
    const cards = Array.isArray(project?.ideaBoard?.cards) ? project.ideaBoard.cards : [];
    const orderedCards = [...cards].sort((a, b) => Number(a.y || 0) - Number(b.y || 0) || Number(a.x || 0) - Number(b.x || 0));
    const sceneCards = orderedCards.filter((card) => card.category === "scene");
    const clipCards = orderedCards.filter((card) => card.category === "clip");
    const pitch = createProjectPitchState(project?.projectPitch || {});

    const scenes = sceneCards.length
      ? sceneCards.map((card, index) => {
          const relatedClips = clipCards
            .filter((clip) => Array.isArray(clip.influencedBy) && clip.influencedBy.includes(card.id))
            .map((clip) => clip.description || clip.title)
            .filter(Boolean);

          return createScriptScene(
            {
              id: `script-from-${card.id}`,
              title: card.title || `Scene ${index + 1}`,
              slug: `INT/EXT ${card.title || `SCENE ${index + 1}`}`.slice(0, 120),
              summary: card.description || "",
              clips: relatedClips.map((prompt, clipIndex) => ({
                title: `Clip ${clipIndex + 1}`,
                prompt
              })),
              clipPrompt: relatedClips.join("\n")
            },
            index
          );
        })
      : [
          createScriptScene(
            {
              title: "Scene 1",
              slug: "",
              summary: pitch.logline || pitch.concept || "",
              clips: clipCards
                .map((clip, clipIndex) => ({
                  title: clip.title || `Clip ${clipIndex + 1}`,
                  prompt: clip.description || clip.title || ""
                }))
                .filter((clip) => clip.prompt),
              clipPrompt: clipCards
                .map((clip) => clip.description || clip.title)
                .filter(Boolean)
                .join("\n")
            },
            0
          )
        ];

    return createScriptState({
      title: project?.name || "",
      premise: pitch.logline || pitch.concept || "",
      structureNotes: pitch.successCriteria || "",
      scenes
    });
  }

  function ensureScriptDraft(project) {
    if (!project) {
      return;
    }

    project.script = createScriptState(project.script || {});
    if (!project.script.title) {
      project.script.title = project.name || "";
    }

    const hasMeaningfulContent =
      project.script.premise.trim() ||
      project.script.structureNotes.trim() ||
      project.script.scenes.some(
        (scene) =>
          scene.title.trim() ||
          scene.summary.trim() ||
          scene.clipPrompt.trim() ||
          scene.clips.some((clip) => clip.prompt.trim() || clip.dialogue.trim())
      );

    if (!hasMeaningfulContent) {
      project.script = buildScriptSeed(project);
    }
  }

  function updateScriptField(project, field, value) {
    if (!project) {
      return;
    }

    ensureScriptDraft(project);
    project.script[field] = value;
    project.script.updatedAt = new Date().toISOString();
  }

  function addScriptScene(project) {
    if (!project) {
      return null;
    }

    ensureScriptDraft(project);
    const nextIndex = project.script.scenes.length;
    const scene = createScriptScene(
      {
        title: `Scene ${nextIndex + 1}`,
        slug: "",
        summary: "",
        clips: [],
        clipPrompt: ""
      },
      nextIndex
    );
    project.script.scenes.push(scene);
    project.script.updatedAt = new Date().toISOString();
    state.selectedScriptSceneId = scene.id;
    return scene;
  }

  function updateScriptScene(project, sceneId, field, value) {
    const scene = project?.script?.scenes?.find((entry) => entry.id === sceneId);
    if (!scene) {
      return;
    }

    if (field === "characters" || field === "mood") {
      scene[field] = String(value || "")
        .split(/[,\n]+/)
        .map((entry) => String(entry).trim())
        .filter(Boolean);
    } else {
    scene[field] = value;
    }
    scene.clipPrompt = deriveSceneClipPrompt(scene);
    scene.dialogue = deriveSceneDialogue(scene);
    scene.status =
      scene.summary.trim()
      || scene.dialogue.trim()
      || scene.clipPrompt.trim()
      || scene.clips.some((clip) => clip.prompt.trim() || clip.dialogue.trim())
        ? "in_progress"
        : "draft";
    project.script.updatedAt = new Date().toISOString();
  }

  function deriveSceneClipPrompt(scene) {
    if (!scene || !Array.isArray(scene.clips)) {
      return "";
    }

    return scene.clips
      .map((clip) => String(clip.prompt || "").trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function deriveSceneDialogue(scene) {
    if (!scene || !Array.isArray(scene.clips)) {
      return "";
    }

    return scene.clips
      .map((clip) => String(clip.dialogue || "").trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function addScriptClip(project, sceneId) {
    const scene = project?.script?.scenes?.find((entry) => entry.id === sceneId);
    if (!scene) {
      return null;
    }

    scene.clips = Array.isArray(scene.clips) ? scene.clips : [];
    const clip = createScriptClip({}, scene.clips.length);
    scene.clips.push(clip);
    scene.clipPrompt = deriveSceneClipPrompt(scene);
    scene.dialogue = deriveSceneDialogue(scene);
    scene.status = scene.summary.trim() || scene.dialogue.trim() || scene.clipPrompt.trim() ? "in_progress" : "draft";
    project.script.updatedAt = new Date().toISOString();
    return clip;
  }

  function updateScriptClip(project, sceneId, clipId, field, value) {
    const scene = project?.script?.scenes?.find((entry) => entry.id === sceneId);
    const clip = scene?.clips?.find((entry) => entry.id === clipId);
    if (!scene || !clip) {
      return;
    }

    clip[field] = value;
    clip.status = clip.prompt.trim() || clip.dialogue.trim() ? "ready" : "draft";
    scene.clipPrompt = deriveSceneClipPrompt(scene);
    scene.dialogue = deriveSceneDialogue(scene);
    scene.status = scene.summary.trim() || scene.dialogue.trim() || scene.clipPrompt.trim() ? "in_progress" : "draft";
    project.script.updatedAt = new Date().toISOString();
  }

  function removeScriptClip(project, sceneId, clipId) {
    const scene = project?.script?.scenes?.find((entry) => entry.id === sceneId);
    if (!scene?.clips) {
      return;
    }

    scene.clips = scene.clips.filter((clip) => clip.id !== clipId);
    scene.clipPrompt = deriveSceneClipPrompt(scene);
    scene.dialogue = deriveSceneDialogue(scene);
    scene.status = scene.summary.trim() || scene.dialogue.trim() || scene.clipPrompt.trim() ? "in_progress" : "draft";
    project.script.updatedAt = new Date().toISOString();
  }

  function syncSceneInspectorDraft(project, selection) {
    if (!project || selection?.kind !== "scene" || !selection.scriptSceneId) {
      if (state.sceneInspectorDraft.sceneId) {
        state.sceneInspectorDraft = {
          sceneId: "",
          location: "",
          characters: "",
          mood: "",
          timeOfDay: "",
          objective: "",
          cameraStyle: "",
          visualReferences: ""
        };
      }
      return;
    }

    if (state.sceneInspectorDraft.sceneId === selection.scriptSceneId) {
      return;
    }

    const scriptScene = project?.script?.scenes?.find((scene) => scene.id === selection.scriptSceneId);
    state.sceneInspectorDraft = {
      sceneId: selection.scriptSceneId,
      location: scriptScene?.location || "",
      characters: Array.isArray(scriptScene?.characters) ? scriptScene.characters.join(", ") : "",
      mood: Array.isArray(scriptScene?.mood) ? scriptScene.mood.join(", ") : "",
      timeOfDay: scriptScene?.timeOfDay || "",
      objective: scriptScene?.objective || "",
      cameraStyle: scriptScene?.cameraStyle || "",
      visualReferences: scriptScene?.visualReferences || ""
    };
  }

  function applySceneInspectorDraft(project, scriptSceneId) {
    if (!project || !scriptSceneId || state.sceneInspectorDraft.sceneId !== scriptSceneId) {
      return false;
    }

    updateScriptScene(project, scriptSceneId, "location", state.sceneInspectorDraft.location.trim());
    updateScriptScene(
      project,
      scriptSceneId,
      "characters",
      state.sceneInspectorDraft.characters
        .split(/[,\n]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    );
    updateScriptScene(
      project,
      scriptSceneId,
      "mood",
      state.sceneInspectorDraft.mood
        .split(/[,\n]+/)
        .map((entry) => entry.trim())
        .filter(Boolean)
    );
    updateScriptScene(project, scriptSceneId, "timeOfDay", state.sceneInspectorDraft.timeOfDay.trim());
    updateScriptScene(project, scriptSceneId, "objective", state.sceneInspectorDraft.objective.trim());
    updateScriptScene(project, scriptSceneId, "cameraStyle", state.sceneInspectorDraft.cameraStyle.trim());
    updateScriptScene(project, scriptSceneId, "visualReferences", state.sceneInspectorDraft.visualReferences.trim());
    return true;
  }

  function removeScriptScene(project, sceneId) {
    if (!project?.script?.scenes) {
      return;
    }

    project.script.scenes = project.script.scenes.filter((scene) => scene.id !== sceneId);
    if (!project.script.scenes.length) {
      const replacement = createScriptScene({}, 0);
      project.script.scenes.push(replacement);
      state.selectedScriptSceneId = replacement.id;
    } else if (state.selectedScriptSceneId === sceneId) {
      state.selectedScriptSceneId = project.script.scenes[0].id;
    }
    project.script.updatedAt = new Date().toISOString();
  }

  function getSelectedScriptScene(project) {
    ensureScriptDraft(project);
    const scenes = Array.isArray(project?.script?.scenes) ? project.script.scenes : [];
    if (!scenes.length) {
      return null;
    }

    const selected = scenes.find((scene) => scene.id === state.selectedScriptSceneId);
    if (selected) {
      return selected;
    }

    state.selectedScriptSceneId = scenes[0].id;
    return scenes[0];
  }

  function scriptChecklist(project) {
    ensureScriptDraft(project);
    const script = createScriptState(project.script || {});
    return [
      { label: "Working premise", complete: Boolean(script.premise.trim()) },
      { label: "At least one scene", complete: script.scenes.length > 0 },
      {
        label: "Scene summaries",
        complete: script.scenes.some((scene) => Boolean(scene.summary.trim()))
      },
      {
        label: "Dialogue or narration",
        complete: script.scenes.some((scene) => scene.clips.some((clip) => Boolean(clip.dialogue.trim())))
      },
      {
        label: "Clip prompts",
        complete: script.scenes.some((scene) => scene.clips.some((clip) => Boolean(clip.prompt.trim())) || Boolean(scene.clipPrompt.trim()))
      }
    ];
  }

  function getPrimaryScriptClipPrompt(scene) {
    if (!scene) {
      return "";
    }

    const firstPrompt = Array.isArray(scene.clips)
      ? scene.clips.find((clip) => String(clip.prompt || "").trim())
      : null;

    return firstPrompt?.prompt || scene.clipPrompt || scene.summary || "";
  }

  function ensureStartingImagesDraft(project) {
    if (!project) {
      return;
    }

    project.startingImages = createStartingImagesState(project.startingImages || {});
    const script = createScriptState(project.script || {});
    const existingByScriptSceneId = new Map(
      project.startingImages.scenes
        .filter((scene) => scene.scriptSceneId)
        .map((scene) => [scene.scriptSceneId, createStartingImageScene(scene)])
    );

    const seededScenes = script.scenes.map((scene, index) => {
      const existing = existingByScriptSceneId.get(scene.id);
      return createStartingImageScene(
        existing || {
          scriptSceneId: scene.id,
          title: scene.title || `Scene ${index + 1}`,
          prompt: getPrimaryScriptClipPrompt(scene),
          shotNotes: deriveSceneDialogue(scene) || "",
          status: existing?.status || "not_started",
          approvedAssetId: existing?.approvedAssetId || "",
          approvedVariationId: existing?.approvedVariationId || "",
          variations: existing?.variations || []
        },
        index
      );
    });

    project.startingImages.scenes = seededScenes;
    project.startingImages.updatedAt = new Date().toISOString();

    if (!state.selectedStartingImageSceneId || !seededScenes.some((scene) => scene.id === state.selectedStartingImageSceneId)) {
      state.selectedStartingImageSceneId = seededScenes[0]?.id || "";
    }
  }

  function ensureVideoClipsDraft(project) {
    if (!project) {
      return;
    }

    project.videoClips = createVideoClipsState(project.videoClips || {});
    const script = createScriptState(project.script || {});
    const existingByScriptSceneId = new Map(
      project.videoClips.scenes
        .filter((scene) => scene.scriptSceneId)
        .map((scene) => [scene.scriptSceneId, createVideoClipScene(scene)])
    );

    const seededScenes = script.scenes.map((scene, index) => {
      const existing = existingByScriptSceneId.get(scene.id);
      const startingScene = project.startingImages?.scenes?.find((entry) => entry.scriptSceneId === scene.id) || null;
      const approvedVariation = startingScene?.variations?.find((variation) => variation.id === startingScene.approvedVariationId) || null;
      const startingImageUrl = approvedVariation?.imageUrl || existing?.startingImageUrl || "";
      const existingClipsByTitle = new Map(
        (existing?.clips || []).map((clip) => [String(clip.title || "").trim().toLowerCase(), createVideoClipRequest(clip)])
      );
      const seededClips = (scene.clips || []).length
        ? scene.clips.map((scriptClip, clipIndex) => {
            const key = String(scriptClip.title || "").trim().toLowerCase();
            const existingClip = existingClipsByTitle.get(key) || existing?.clips?.[clipIndex] || null;
            return createVideoClipRequest({
              ...existingClip,
              id: existingClip?.id || scriptClip.id,
              title: scriptClip.title || `Clip ${clipIndex + 1}`,
              clipPrompt: existingClip?.clipPrompt || scriptClip.prompt || "",
              shotNotes: existingClip?.shotNotes || startingScene?.shotNotes || "",
              status: startingImageUrl
                ? (existingClip?.generatedClips?.length ? "generated" : existingClip?.status === "approved" ? "approved" : "ready")
                : "not_ready"
            }, clipIndex);
          })
        : (existing?.clips?.length ? existing.clips.map((clip, clipIndex) => createVideoClipRequest(clip, clipIndex)) : undefined);

      return createVideoClipScene(
        {
          ...existing,
          scriptSceneId: scene.id,
          title: scene.title || existing?.title || `Scene ${index + 1}`,
          clipPrompt: existing?.clipPrompt || getPrimaryScriptClipPrompt(scene),
          shotNotes: existing?.shotNotes || startingScene?.shotNotes || "",
          startingImageUrl,
          startingVariationId: approvedVariation?.id || existing?.startingVariationId || "",
          clips: seededClips,
          status: startingImageUrl
            ? ((seededClips || existing?.clips || []).some((clip) => clip.generatedClips?.length) ? "generated" : existing?.status === "approved" ? "approved" : "ready")
            : "not_ready"
        },
        index
      );
    });

    project.videoClips.scenes = seededScenes;
    project.videoClips.updatedAt = new Date().toISOString();

    if (!state.selectedVideoClipSceneId || !seededScenes.some((scene) => scene.id === state.selectedVideoClipSceneId)) {
      state.selectedVideoClipSceneId = seededScenes[0]?.id || "";
    }
    const activeScene = seededScenes.find((scene) => scene.id === state.selectedVideoClipSceneId) || seededScenes[0] || null;
    const activeSceneHasRequest = activeScene?.clips?.some((clip) => clip.id === state.selectedVideoClipRequestId);
    if (!state.selectedVideoClipRequestId || !activeSceneHasRequest) {
      state.selectedVideoClipRequestId = activeScene?.clips?.[0]?.id || "";
    }
  }

  function getSelectedVideoClipScene(project) {
    ensureVideoClipsDraft(project);
    return project?.videoClips?.scenes?.find((scene) => scene.id === state.selectedVideoClipSceneId)
      || project?.videoClips?.scenes?.[0]
      || null;
  }

  function getSelectedVideoClipRequest(project, scene = null) {
    ensureVideoClipsDraft(project);
    const targetScene = scene || getSelectedVideoClipScene(project);
    if (!targetScene) {
      return null;
    }
    return targetScene.clips?.find((clip) => clip.id === state.selectedVideoClipRequestId)
      || targetScene.clips?.[0]
      || null;
  }

  function recomputeVideoClipSceneAggregate(scene) {
    if (!scene) {
      return scene;
    }

    scene.clips = Array.isArray(scene.clips) ? scene.clips : [];
    scene.generatedClips = scene.clips.flatMap((clip) => clip.generatedClips || []);

    const statuses = scene.clips.map((clip) => String(clip.generationStatus || clip.status || "").toLowerCase());
    const hasGenerated = scene.clips.some((clip) => Array.isArray(clip.generatedClips) && clip.generatedClips.length > 0);
    const hasQueued = statuses.some((status) => status === "queued" || status === "processing" || status === "generating");
    const hasFailed = statuses.some((status) => status === "failed");

    if (hasGenerated) {
      scene.status = scene.clips.every((clip) => {
        if (!clip.clipPrompt?.trim()) {
          return true;
        }
        return Boolean(clip.approvedClipId || clip.generatedClips?.[0]);
      }) ? "generated" : "ready";
    } else if (hasQueued) {
      scene.status = "queued";
    } else if (hasFailed) {
      scene.status = "failed";
    } else if (scene.startingImageUrl) {
      scene.status = "ready";
    } else {
      scene.status = "not_ready";
    }

    scene.generationStatus = hasQueued
      ? "queued"
      : hasFailed
        ? "failed"
        : hasGenerated
          ? "generated"
          : "idle";
    scene.generationCount = scene.clips.reduce((total, clip) => total + Number(clip.generationCount || 0), 0);
    scene.updatedAt = new Date().toISOString();
    return scene;
  }

  function updateVideoClipRequest(project, sceneId, requestId, field, value) {
    ensureVideoClipsDraft(project);
    const scene = project?.videoClips?.scenes?.find((entry) => entry.id === sceneId);
    const request = scene?.clips?.find((entry) => entry.id === requestId);
    if (!scene || !request) {
      return;
    }

    request[field] = value;
    request.updatedAt = new Date().toISOString();
    recomputeVideoClipSceneAggregate(scene);
    project.videoClips.updatedAt = scene.updatedAt;
  }

  function addGeneratedVideoClip(project, sceneId, requestId, clip) {
    ensureVideoClipsDraft(project);
    const scene = project?.videoClips?.scenes?.find((entry) => entry.id === sceneId);
    const request = scene?.clips?.find((entry) => entry.id === requestId);
    if (!scene || !request) {
      return null;
    }

    const nextClip = {
      id: clip.id || `video-clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      label: clip.label || `Generated ${request.generatedClips.length + 1}`,
      videoUrl: clip.videoUrl || "",
      thumbnailUrl: clip.thumbnailUrl || clip.videoUrl || "",
      assetId: clip.assetId || "",
      status: clip.status || "generated",
      createdAt: clip.createdAt || new Date().toISOString(),
      requestId
    };

    request.generatedClips = Array.isArray(request.generatedClips) ? request.generatedClips : [];
    request.generatedClips.unshift(nextClip);
    if (!request.approvedClipId) {
      request.approvedClipId = nextClip.id;
    }
    request.status = "generated";
    request.generationStatus = "generated";
    request.updatedAt = new Date().toISOString();
    recomputeVideoClipSceneAggregate(scene);
    project.videoClips.updatedAt = scene.updatedAt;
    return nextClip;
  }

  function approveGeneratedVideoClip(project, sceneId, requestId, clipId) {
    ensureVideoClipsDraft(project);
    const scene = project?.videoClips?.scenes?.find((entry) => entry.id === sceneId);
    const request = scene?.clips?.find((entry) => entry.id === requestId);
    if (!scene || !request) {
      return null;
    }

    const clip = Array.isArray(request.generatedClips)
      ? request.generatedClips.find((entry) => entry.id === clipId)
      : null;
    if (!clip) {
      return null;
    }

    request.approvedClipId = clip.id;
    request.status = "approved";
    request.updatedAt = new Date().toISOString();
    recomputeVideoClipSceneAggregate(scene);
    project.videoClips.updatedAt = scene.updatedAt;
    return clip;
  }

  function ensureGeneratedClipAsset(project, scene, request, clip) {
    if (!project || !scene || !clip?.videoUrl) {
      return null;
    }

    const existingByUrl = (project.assets || []).find((asset) => asset.kind === "video" && asset.sourceUrl === clip.videoUrl);
    if (existingByUrl) {
      existingByUrl.generatedFromSceneId = scene.scriptSceneId || scene.id;
      existingByUrl.generatedFromSceneClipId = request?.id || "";
      existingByUrl.generatedClipId = clip.id;
      clip.assetId = existingByUrl.id;
      return existingByUrl;
    }

    const asset = {
      id: clip.assetId || `generated-video-asset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: clip.label || `${scene.title} Clip`,
      kind: "video",
      meta: "generated clip",
      sourceUrl: clip.videoUrl,
      thumbnailUrl: clip.thumbnailUrl || clip.videoUrl,
      generatedFromSceneId: scene.scriptSceneId || scene.id,
      generatedFromSceneClipId: request?.id || "",
      generatedClipId: clip.id
    };
    project.assets = Array.isArray(project.assets) ? project.assets : [];
    project.assets.unshift(asset);
    project.clipCount = project.assets.length;
    clip.assetId = asset.id;
    return asset;
  }

  function getSelectedStartingImageScene(project) {
    ensureStartingImagesDraft(project);
    return project?.startingImages?.scenes?.find((scene) => scene.id === state.selectedStartingImageSceneId)
      || project?.startingImages?.scenes?.[0]
      || null;
  }

  function updateStartingImageScene(project, sceneId, field, value) {
    ensureStartingImagesDraft(project);
    const scene = project?.startingImages?.scenes?.find((entry) => entry.id === sceneId);
    if (!scene) {
      return;
    }

    scene[field] = value;
    scene.updatedAt = new Date().toISOString();
    project.startingImages.updatedAt = scene.updatedAt;
  }

  function addStartingImageVariation(project, sceneId, variation) {
    ensureStartingImagesDraft(project);
    const scene = project?.startingImages?.scenes?.find((entry) => entry.id === sceneId);
    if (!scene) {
      return null;
    }

    const nextVariation = {
      id: variation.id || `starting-image-variation-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      source: variation.source || "generated",
      label: variation.label || `Variation ${scene.variations.length + 1}`,
      imageUrl: variation.imageUrl || "",
      assetId: variation.assetId || "",
      status: variation.status || "draft",
      createdAt: variation.createdAt || new Date().toISOString()
    };

    scene.variations = Array.isArray(scene.variations) ? scene.variations : [];
    scene.variations.unshift(nextVariation);
    scene.status = scene.status === "approved" ? "approved" : "drafted";
    scene.updatedAt = new Date().toISOString();
    project.startingImages.updatedAt = scene.updatedAt;
    return nextVariation;
  }

  function approveStartingImageVariation(project, sceneId, variationId) {
    ensureStartingImagesDraft(project);
    const scene = project?.startingImages?.scenes?.find((entry) => entry.id === sceneId);
    if (!scene) {
      return null;
    }

    const variation = scene.variations.find((entry) => entry.id === variationId);
    if (!variation) {
      return null;
    }

    scene.approvedVariationId = variation.id;
    scene.approvedAssetId = variation.assetId || "";
    scene.status = "approved";
    scene.updatedAt = new Date().toISOString();
    project.startingImages.updatedAt = scene.updatedAt;
    return variation;
  }

  function removeStartingImageVariation(project, sceneId, variationId) {
    ensureStartingImagesDraft(project);
    const scene = project?.startingImages?.scenes?.find((entry) => entry.id === sceneId);
    if (!scene) {
      return null;
    }

    const index = scene.variations.findIndex((entry) => entry.id === variationId);
    if (index === -1) {
      return null;
    }

    const [removed] = scene.variations.splice(index, 1);
    if (scene.approvedVariationId === variationId) {
      scene.approvedVariationId = "";
      scene.approvedAssetId = "";
      scene.status = scene.variations.length ? "drafted" : "not_started";
    }
    scene.updatedAt = new Date().toISOString();
    project.startingImages.updatedAt = scene.updatedAt;
    return removed;
  }

  function createStartingImageDraft(scene, project) {
    const imageAssets = (project?.assets || []).filter((asset) => asset.kind === "image");
    const selectedImageAsset = imageAssets.find((asset) => asset.id === state.selectedAssetId) || imageAssets[0] || null;

    return {
      source: selectedImageAsset ? "asset" : "generated",
      label: selectedImageAsset
        ? `Using ${selectedImageAsset.name}`
        : `Draft ${scene.variations.length + 1}`,
      imageUrl: selectedImageAsset?.fileUrl || selectedImageAsset?.thumbnailUrl || "",
      assetId: selectedImageAsset?.id || "",
      status: selectedImageAsset ? "linked" : "draft"
    };
  }

  function startingImagesChecklist(project) {
    ensureStartingImagesDraft(project);
    const scenes = project?.startingImages?.scenes || [];
    return [
      { label: "Scene prompts ready", complete: scenes.every((scene) => Boolean(scene.prompt.trim())) && scenes.length > 0 },
      { label: "At least one variation per scene", complete: scenes.every((scene) => (scene.variations || []).length > 0) && scenes.length > 0 },
      { label: "Approved anchor frames", complete: scenes.every((scene) => scene.status === "approved") && scenes.length > 0 },
      { label: "Shot notes captured", complete: scenes.some((scene) => Boolean(scene.shotNotes.trim())) }
    ];
  }


    return {
      updateProjectPitch,
      projectPitchFields,
      buildScriptSeed,
      ensureScriptDraft,
      updateScriptField,
      addScriptScene,
      updateScriptScene,
      deriveSceneClipPrompt,
      deriveSceneDialogue,
      addScriptClip,
      updateScriptClip,
      removeScriptClip,
      syncSceneInspectorDraft,
      applySceneInspectorDraft,
      removeScriptScene,
      getSelectedScriptScene,
      scriptChecklist,
      getPrimaryScriptClipPrompt,
      ensureStartingImagesDraft,
      ensureVideoClipsDraft,
      getSelectedVideoClipScene,
      getSelectedVideoClipRequest,
      recomputeVideoClipSceneAggregate,
      updateVideoClipRequest,
      addGeneratedVideoClip,
      approveGeneratedVideoClip,
      ensureGeneratedClipAsset,
      getSelectedStartingImageScene,
      updateStartingImageScene,
      addStartingImageVariation,
      approveStartingImageVariation,
      removeStartingImageVariation,
      createStartingImageDraft,
      startingImagesChecklist
    };
  }

  globalScope.EditorStateModules = globalScope.EditorStateModules || {};
  globalScope.EditorStateModules.createWorkflowStateHelpers = createWorkflowStateHelpers;
})(window);