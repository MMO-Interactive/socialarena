(function attachV2ProjectWorkspaceState(globalScope) {
  const IDEA_CARD_CATEGORIES = ["character", "location", "scene", "clip", "style", "note", "image", "link", "audio", "prop"];
  const IDEA_CATEGORY_ALIASES = {
    beat: "scene",
    dialogue: "clip",
    wardrobe: "style",
    lighting: "style",
    camera: "clip",
    vfx: "style"
  };

  function inferImportedAssetKind(extension) {
    const normalized = String(extension || "").toLowerCase();
    if ([".png", ".jpg", ".jpeg", ".webp"].includes(normalized)) {
      return "image";
    }
    if ([".mp3", ".wav"].includes(normalized)) {
      return "audio";
    }
    return "video";
  }

  function createIdeaBoardState(seed = {}) {
    return {
      cards: Array.isArray(seed.cards)
        ? seed.cards.map((card, index) => ({
            id: card.id || `idea-card-${Date.now()}-${index + 1}`,
            category: IDEA_CARD_CATEGORIES.includes(card.category)
              ? card.category
              : IDEA_CATEGORY_ALIASES[String(card.category || "")] || "note",
            title: String(card.title || "").trim(),
            description: String(card.description || "").trim(),
            status: card.status || "draft",
            influencedBy: Array.isArray(card.influencedBy) ? card.influencedBy.map(String) : [],
            x: Number.isFinite(Number(card.x)) ? Number(card.x) : 120 + (index % 3) * 280,
            y: Number.isFinite(Number(card.y)) ? Number(card.y) : 120 + Math.floor(index / 3) * 180
          }))
        : [],
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
  }

  function splitTags(value) {
    if (Array.isArray(value)) {
      return value.map((entry) => String(entry).trim()).filter(Boolean);
    }
    return String(value || "")
      .split(/[,\n]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function createPitchDraft(seed = {}) {
    return {
      title: String(seed.title || "").trim(),
      format: String(seed.format || "film").trim() || "film",
      audience: String(seed.audience || "").trim(),
      logline: String(seed.logline || "").trim(),
      concept: String(seed.concept || "").trim(),
      tone: splitTags(seed.tone),
      visualStyle: String(seed.visualStyle || "").trim(),
      references: String(seed.references || "").trim(),
      successCriteria: String(seed.successCriteria || "").trim(),
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
  }

  function createScriptClip(seed = {}, index = 0) {
    return {
      id: String(seed.id || `script-clip-${Date.now()}-${index + 1}`),
      title: String(seed.title || `Clip ${index + 1}`).trim(),
      prompt: String(seed.prompt || seed.clipPrompt || "").trim(),
      dialogue: String(seed.dialogue || "").trim(),
      shotNotes: String(seed.shotNotes || "").trim(),
      shotRole: String(seed.shotRole || seed.role || "").trim(),
      planningSource: String(seed.planningSource || "manual").trim()
    };
  }

  function createScriptScene(seed = {}, index = 0) {
    const clips = Array.isArray(seed.clips) && seed.clips.length
      ? seed.clips.map((clip, clipIndex) => createScriptClip(clip, clipIndex))
      : [createScriptClip({}, 0)];

    return {
      id: String(seed.id || `script-scene-${Date.now()}-${index + 1}`),
      title: String(seed.title || `Scene ${index + 1}`).trim(),
      summary: String(seed.summary || seed.description || "").trim(),
      characters: splitTags(seed.characters),
      location: String(seed.location || "").trim(),
      timeOfDay: String(seed.timeOfDay || seed.time_of_day || "").trim(),
      mood: splitTags(seed.mood),
      objective: String(seed.objective || "").trim(),
      clips
    };
  }

  function createScriptDraft(seed = {}) {
    return {
      scenes: Array.isArray(seed.scenes) && seed.scenes.length
        ? seed.scenes.map((scene, index) => createScriptScene(scene, index))
        : [createScriptScene({}, 0)],
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
  }

  function createStartingImageVariation(seed = {}, index = 0) {
    return {
      id: String(seed.id || `starting-variation-${Date.now()}-${index + 1}`),
      imageUrl: String(seed.imageUrl || seed.generatedImageUrl || seed.generated_image_url || "").trim(),
      label: String(seed.label || `Variation ${index + 1}`).trim(),
      source: String(seed.source || "generated").trim(),
      status: String(seed.status || "draft").trim()
    };
  }

  function createStartingImageScene(seed = {}, index = 0) {
    return {
      id: String(seed.id || `starting-scene-${Date.now()}-${index + 1}`),
      scriptSceneId: String(seed.scriptSceneId || seed.sceneId || "").trim(),
      title: String(seed.title || `Scene ${index + 1}`).trim(),
      prompt: String(seed.prompt || "").trim(),
      shotNotes: String(seed.shotNotes || "").trim(),
      boardItemId: String(seed.boardItemId || seed.board_item_id || "").trim(),
      generationStatus: String(seed.generationStatus || seed.generation_status || "idle").trim(),
      generationCount: Number(seed.generationCount || seed.generation_count || 0),
      promptId: String(seed.promptId || seed.prompt_id || "").trim(),
      lastGeneratedAt: String(seed.lastGeneratedAt || seed.last_generated_at || "").trim(),
      lastError: String(seed.lastError || seed.last_error || "").trim(),
      approvedVariationId: String(seed.approvedVariationId || "").trim(),
      status: String(seed.status || "draft").trim(),
      variations: Array.isArray(seed.variations) ? seed.variations.map((variation, variationIndex) => createStartingImageVariation(variation, variationIndex)) : []
    };
  }

  function createStartingImagesDraft(seed = {}) {
    return {
      scenes: Array.isArray(seed.scenes)
        ? seed.scenes.map((scene, index) => createStartingImageScene(scene, index))
        : [],
      selectedSceneId: String(seed.selectedSceneId || "").trim(),
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
  }

  function createGeneratedVideoClip(seed = {}, index = 0) {
    return {
      id: String(seed.id || `generated-video-${Date.now()}-${index + 1}`),
      label: String(seed.label || `Generated ${index + 1}`).trim(),
      videoUrl: String(seed.videoUrl || seed.generated_video_url || seed.url || "").trim(),
      thumbnailUrl: String(seed.thumbnailUrl || seed.thumbnail_url || seed.videoUrl || seed.generated_video_url || seed.url || "").trim(),
      assetId: String(seed.assetId || "").trim(),
      status: String(seed.status || "generated").trim(),
      createdAt: String(seed.createdAt || new Date().toISOString()).trim()
    };
  }

  function createVideoClipRequest(seed = {}, index = 0) {
    return {
      id: String(seed.id || `video-clip-request-${Date.now()}-${index + 1}`),
      scriptClipId: String(seed.scriptClipId || "").trim(),
      title: String(seed.title || `Clip ${index + 1}`).trim(),
      clipPrompt: String(seed.clipPrompt || seed.prompt || "").trim(),
      shotNotes: String(seed.shotNotes || "").trim(),
      shotRole: String(seed.shotRole || "").trim(),
      planningSource: String(seed.planningSource || "manual").trim(),
      boardItemId: String(seed.boardItemId || seed.board_item_id || "").trim(),
      generationStatus: String(seed.generationStatus || seed.generation_status || "idle").trim(),
      generationCount: Number(seed.generationCount || seed.generation_count || 0),
      promptId: String(seed.promptId || seed.prompt_id || "").trim(),
      lastGeneratedAt: String(seed.lastGeneratedAt || seed.last_generated_at || "").trim(),
      lastError: String(seed.lastError || seed.last_error || "").trim(),
      status: String(seed.status || "not_ready").trim(),
      approvedClipId: String(seed.approvedClipId || "").trim(),
      generatedClips: Array.isArray(seed.generatedClips)
        ? seed.generatedClips.map((clip, clipIndex) => createGeneratedVideoClip(clip, clipIndex))
        : []
    };
  }

  function createVideoClipScene(seed = {}, index = 0) {
    const clips = Array.isArray(seed.clips) && seed.clips.length
      ? seed.clips.map((clip, clipIndex) => createVideoClipRequest(clip, clipIndex))
      : [createVideoClipRequest({}, 0)];

    return {
      id: String(seed.id || `video-scene-${Date.now()}-${index + 1}`),
      scriptSceneId: String(seed.scriptSceneId || "").trim(),
      title: String(seed.title || `Scene ${index + 1}`).trim(),
      startingImageUrl: String(seed.startingImageUrl || "").trim(),
      startingVariationId: String(seed.startingVariationId || "").trim(),
      status: String(seed.status || "not_ready").trim(),
      clips
    };
  }

  function createVideoClipsDraft(seed = {}) {
    return {
      scenes: Array.isArray(seed.scenes)
        ? seed.scenes.map((scene, index) => createVideoClipScene(scene, index))
        : [],
      selectedSceneId: String(seed.selectedSceneId || "").trim(),
      selectedRequestId: String(seed.selectedRequestId || "").trim(),
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
  }

  function getTimelineLaneIdValue(item) {
    const placementType = String(item?.placementType || "").trim();
    const type = String(item?.type || "").trim();
    if (type === "audio") {
      return placementType === "music" ? "A1" : "A2";
    }
    return placementType === "scene_shot" ? "V1" : "V2";
  }

  function createEditTimelineItem(seed = {}, index = 0) {
    const normalizedType = String(seed.type || "video").trim() || "video";
    return {
      id: String(seed.id || `edit-item-${Date.now()}-${index + 1}`),
      sceneId: String(seed.sceneId || seed.scriptSceneId || "").trim(),
      sceneTitle: String(seed.sceneTitle || "").trim(),
      requestId: String(seed.requestId || "").trim(),
      title: String(seed.title || `Timeline Clip ${index + 1}`).trim(),
      videoUrl: String(seed.videoUrl || "").trim(),
      thumbnailUrl: String(seed.thumbnailUrl || seed.videoUrl || "").trim(),
      startSeconds: Math.max(0, Number(seed.startSeconds || 0)),
      durationSeconds: Math.max(1, Number(seed.durationSeconds || 4)),
      type: normalizedType,
      trackId: String(seed.trackId || (normalizedType === "audio" ? "A1" : "V1")).trim(),
      placementType: String(seed.placementType || (normalizedType === "audio" ? "music" : "temp")).trim(),
      shotRole: String(seed.shotRole || "").trim(),
      clipPrompt: String(seed.clipPrompt || "").trim(),
      shotNotes: String(seed.shotNotes || "").trim(),
      planningSource: String(seed.planningSource || "manual").trim()
    };
  }

  function createEditMarker(seed = {}, index = 0) {
    return {
      id: String(seed.id || `edit-marker-${Date.now()}-${index + 1}`),
      label: String(seed.label || `Marker ${index + 1}`).trim(),
      timeSeconds: Math.max(0, Number(seed.timeSeconds || 0))
    };
  }

  function createImportedAsset(seed = {}, index = 0) {
    const kind = String(seed.kind || inferImportedAssetKind(seed.extension)).trim();
    return {
      id: String(seed.id || `imported-asset-${Date.now()}-${index + 1}`),
      name: String(seed.name || seed.fileName || `Imported Asset ${index + 1}`).trim(),
      kind,
      filePath: String(seed.filePath || "").trim(),
      sourceUrl: String(seed.sourceUrl || seed.fileUrl || "").trim(),
      thumbnailUrl: String(seed.thumbnailUrl || seed.sourceUrl || seed.fileUrl || "").trim(),
      extension: String(seed.extension || "").trim(),
      sizeBytes: Number(seed.sizeBytes || 0),
      durationSeconds: Math.max(1, Number(seed.durationSeconds || (kind === "image" ? 3 : 5))),
      durationResolved: Boolean(seed.durationResolved),
      meta: String(seed.meta || (kind === "audio" ? "imported audio" : kind === "image" ? "imported image" : "imported video")).trim()
    };
  }

  function normalizeEditTimelineItems(items) {
    const laneCursors = {
      V1: 0,
      V2: 0,
      A1: 0,
      A2: 0
    };

    return (Array.isArray(items) ? items : []).map((item, index) => {
      const normalizedItem = createEditTimelineItem(item, index);
      const laneId = getTimelineLaneIdValue(normalizedItem);
      const hasExplicitStart = item && Object.prototype.hasOwnProperty.call(item, "startSeconds");
      const startSeconds = hasExplicitStart
        ? Math.max(0, Number(item.startSeconds || 0))
        : Math.max(0, laneCursors[laneId] || 0);
      laneCursors[laneId] = Math.max(
        Math.max(0, laneCursors[laneId] || 0),
        startSeconds + Number(normalizedItem.durationSeconds || 0)
      );
      return createEditTimelineItem({
        ...normalizedItem,
        trackId: laneId,
        startSeconds
      }, index);
    });
  }

  function resolveEditTimelineCollisions(items) {
    const list = Array.isArray(items) ? items.map((item, index) => ({
      item: createEditTimelineItem(item, index),
      index
    })) : [];
    const nextStartsById = new Map();

    ["V1", "V2", "A1", "A2"].forEach((laneId) => {
      const laneItems = list
        .filter((entry) => getTimelineLaneIdValue(entry.item) === laneId)
        .sort((left, right) => {
          const startDelta = Number(left.item.startSeconds || 0) - Number(right.item.startSeconds || 0);
          if (startDelta !== 0) {
            return startDelta;
          }
          return left.index - right.index;
        });

      let laneCursor = 0;
      laneItems.forEach((entry) => {
        const desiredStart = Math.max(0, Number(entry.item.startSeconds || 0));
        const resolvedStart = Math.max(laneCursor, desiredStart);
        nextStartsById.set(String(entry.item.id), resolvedStart);
        laneCursor = resolvedStart + Math.max(1, Number(entry.item.durationSeconds || 0));
      });
    });

    return list.map(({ item, index }) => createEditTimelineItem({
      ...item,
      startSeconds: Math.max(0, Number(nextStartsById.get(String(item.id)) || item.startSeconds || 0))
    }, index));
  }

  function getTimelineDurationSeconds(items) {
    return (Array.isArray(items) ? items : []).reduce((maxSeconds, item) => {
      const endSeconds = Math.max(0, Number(item.startSeconds || 0)) + Math.max(1, Number(item.durationSeconds || 0));
      return Math.max(maxSeconds, endSeconds);
    }, 0);
  }

  function shiftTimelineItemsInLane(items, laneId, fromSeconds, deltaSeconds, excludeIds = []) {
    const excluded = new Set((Array.isArray(excludeIds) ? excludeIds : [excludeIds]).map((value) => String(value)));
    return (Array.isArray(items) ? items : []).map((item, index) => {
      const sameLane = getTimelineLaneIdValue(item) === laneId;
      const currentStart = Math.max(0, Number(item.startSeconds || 0));
      if (!sameLane || excluded.has(String(item.id)) || currentStart < Number(fromSeconds || 0)) {
        return createEditTimelineItem(item, index);
      }
      return createEditTimelineItem({
        ...item,
        startSeconds: Math.max(0, currentStart + Number(deltaSeconds || 0))
      }, index);
    });
  }

  function rebalanceTimelineLaneByArrayOrder(items, laneId) {
    const list = Array.isArray(items) ? items.map((item, index) => createEditTimelineItem(item, index)) : [];
    const laneItems = list.filter((item) => getTimelineLaneIdValue(item) === laneId);
    if (!laneItems.length) {
      return list;
    }

    const laneStart = Math.max(0, Math.min(...laneItems.map((item) => Number(item.startSeconds || 0))));
    let cursor = laneStart;

    return list.map((item, index) => {
      if (getTimelineLaneIdValue(item) !== laneId) {
        return createEditTimelineItem(item, index);
      }

      const nextItem = createEditTimelineItem({
        ...item,
        startSeconds: cursor
      }, index);
      cursor += Math.max(1, Number(nextItem.durationSeconds || 0));
      return nextItem;
    });
  }

  function createEditDraft(seed = {}) {
    const timelineItems = resolveEditTimelineCollisions(normalizeEditTimelineItems(seed.timelineItems));
    const computedTotalDuration = getTimelineDurationSeconds(timelineItems);
    return {
      timelineItems,
      markers: Array.isArray(seed.markers)
        ? seed.markers.map((marker, index) => createEditMarker(marker, index))
        : [],
      activeSceneId: String(seed.activeSceneId || "").trim(),
      selectedItemId: String(seed.selectedItemId || "").trim(),
      playheadSeconds: Math.max(0, Number(seed.playheadSeconds || 0)),
      totalDurationSeconds: timelineItems.length
        ? computedTotalDuration
        : Math.max(0, Number(seed.totalDurationSeconds || 0)),
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
  }

  function createExportRecord(seed = {}, index = 0) {
    return {
      id: Number(seed.id || 0) || index + 1,
      title: String(seed.title || `Export ${index + 1}`).trim(),
      exportType: String(seed.exportType || seed.export_type || "draft").trim(),
      durationSeconds: Math.max(0, Number(seed.durationSeconds || seed.duration_seconds || 0)),
      resolution: String(seed.resolution || "1920x1080").trim(),
      status: String(seed.status || "initialized").trim(),
      storagePath: String(seed.storagePath || seed.storage_path || "").trim(),
      thumbnailUrl: String(seed.thumbnailUrl || seed.thumbnail_url || "").trim(),
      fileSizeBytes: seed.fileSizeBytes ?? seed.file_size_bytes ?? null,
      createdAt: String(seed.createdAt || seed.created_at || "").trim(),
      completedAt: String(seed.completedAt || seed.completed_at || "").trim()
    };
  }

  function createExportReleaseDraft(seed = {}) {
    return {
      title: String(seed.title || "").trim(),
      exportType: String(seed.exportType || "draft").trim(),
      resolution: String(seed.resolution || "1920x1080").trim(),
      durationSeconds: Math.max(0, Number(seed.durationSeconds || 0)),
      activeExportId: Number(seed.activeExportId || 0) || 0,
      exports: Array.isArray(seed.exports)
        ? seed.exports.map((entry, index) => createExportRecord(entry, index))
        : [],
      loading: Boolean(seed.loading),
      error: String(seed.error || "").trim(),
      updatedAt: seed.updatedAt || new Date().toISOString()
    };
  }

  function buildPitchDraftFromProject(projectSummary, boardState) {
    const cards = Array.isArray(boardState?.cards) ? boardState.cards : [];
    const sceneCards = cards.filter((card) => card.category === "scene");
    const characterCards = cards.filter((card) => card.category === "character");
    const styleCards = cards.filter((card) => card.category === "style");
    const noteCards = cards.filter((card) => card.category === "note");

    return createPitchDraft({
      title: projectSummary?.title || "",
      format: projectSummary?.type || "film",
      logline: sceneCards[0]?.description || projectSummary?.description || "",
      concept: [projectSummary?.description, sceneCards[1]?.description, noteCards[0]?.description].filter(Boolean).join("\n\n"),
      audience: "",
      tone: styleCards.slice(0, 4).map((card) => card.title || card.description).filter(Boolean),
      visualStyle: styleCards.slice(0, 3).map((card) => card.description || card.title).filter(Boolean).join("\n"),
      references: [characterCards[0]?.title, noteCards[0]?.title].filter(Boolean).join(", "),
      successCriteria: "Pitch is coherent enough to translate directly into scenes, clips, and generation prompts."
    });
  }

  function buildScriptDraftFromProject(projectSummary, pitchDraft, boardState, projectDetail) {
    const boardCards = Array.isArray(boardState?.cards) ? boardState.cards : [];
    const sceneCards = boardCards.filter((card) => card.category === "scene");
    const clipCards = boardCards.filter((card) => card.category === "clip");
    const locationCards = boardCards.filter((card) => card.category === "location");
    const characterCards = boardCards.filter((card) => card.category === "character");
    const scenesFromApi = Array.isArray(projectDetail?.scenes) ? projectDetail.scenes : [];
    const clipsFromApi = Array.isArray(projectDetail?.clips) ? projectDetail.clips : [];

    if (scenesFromApi.length) {
      return createScriptDraft({
        scenes: scenesFromApi.map((scene, index) => ({
          id: scene.id || `api-scene-${index + 1}`,
          title: scene.title || `Scene ${index + 1}`,
          summary: scene.description || "",
          location: scene.location_name || locationCards[index]?.title || "",
          timeOfDay: scene.time_of_day || "",
          mood: pitchDraft?.tone || [],
          objective: scene.objective || "",
          characters: [],
          clips: clipsFromApi
            .filter((clip) => String(clip.scene_id) === String(scene.id))
            .sort((a, b) => Number(a.clip_order || 0) - Number(b.clip_order || 0))
            .map((clip, clipIndex) => ({
              id: clip.id || `api-clip-${clipIndex + 1}`,
              title: clip.title || `Clip ${clipIndex + 1}`,
              prompt: clip.description || "",
              dialogue: "",
              shotNotes: ""
            }))
        }))
      });
    }

    if (sceneCards.length) {
      return createScriptDraft({
        scenes: sceneCards.map((card, index) => ({
          id: card.id,
          title: card.title || `Scene ${index + 1}`,
          summary: card.description || "",
          location: locationCards[index]?.title || "",
          timeOfDay: "",
          mood: pitchDraft?.tone || [],
          objective: "",
          characters: characterCards.slice(0, 2).map((entry) => entry.title).filter(Boolean),
          clips: clipCards
            .slice(index, index + 1)
            .map((clip, clipIndex) => ({
              id: clip.id,
              title: clip.title || `Clip ${clipIndex + 1}`,
              prompt: clip.description || "",
              dialogue: "",
              shotNotes: ""
            }))
        }))
      });
    }

    return createScriptDraft({
      scenes: [
        {
          title: "Opening Scene",
          summary: pitchDraft?.concept || projectSummary?.description || "",
          location: locationCards[0]?.title || "",
          timeOfDay: "",
          mood: pitchDraft?.tone || [],
          objective: pitchDraft?.successCriteria || "",
          characters: characterCards.slice(0, 2).map((entry) => entry.title).filter(Boolean),
          clips: [
            {
              title: "Clip 1",
              prompt: pitchDraft?.logline || "",
              dialogue: "",
              shotNotes: ""
            }
          ]
        }
      ]
    });
  }

  function deriveScenePrompt(scene) {
    const prompts = Array.isArray(scene?.clips) ? scene.clips.map((clip) => String(clip.prompt || "").trim()).filter(Boolean) : [];
    return prompts[0] || String(scene?.summary || "").trim();
  }

  function deriveSceneShotNotes(scene) {
    return Array.isArray(scene?.clips)
      ? scene.clips.map((clip) => String(clip.shotNotes || "").trim()).filter(Boolean).join("\n")
      : "";
  }

  function buildStartingImagesDraftFromScript(scriptDraft, existingDraft) {
    const currentDraft = createStartingImagesDraft(existingDraft || {});
    const existingBySceneId = new Map(
      (currentDraft.scenes || []).map((scene) => [String(scene.scriptSceneId || scene.id), scene])
    );
    const scenes = (scriptDraft?.scenes || []).map((scene, index) => {
      const existing = existingBySceneId.get(String(scene.id));
      return createStartingImageScene({
        id: existing?.id || `starting-${scene.id}`,
        scriptSceneId: scene.id,
        title: scene.title,
        prompt: existing?.prompt || deriveScenePrompt(scene),
        shotNotes: existing?.shotNotes || deriveSceneShotNotes(scene),
        boardItemId: existing?.boardItemId || "",
        generationStatus: existing?.generationStatus || "idle",
        generationCount: existing?.generationCount || 0,
        promptId: existing?.promptId || "",
        lastGeneratedAt: existing?.lastGeneratedAt || "",
        lastError: existing?.lastError || "",
        approvedVariationId: existing?.approvedVariationId || "",
        status: existing?.status || "draft",
        variations: existing?.variations || []
      }, index);
    });

    return createStartingImagesDraft({
      scenes,
      selectedSceneId: currentDraft.selectedSceneId || scenes[0]?.id || "",
      updatedAt: new Date().toISOString()
    });
  }

  function buildVideoClipsDraftFromScript(scriptDraft, startingImagesDraft, existingDraft) {
    const currentDraft = createVideoClipsDraft(existingDraft || {});
    const existingByScriptSceneId = new Map(
      currentDraft.scenes.map((scene) => [String(scene.scriptSceneId || scene.id), scene])
    );
    const startingByScriptSceneId = new Map(
      (startingImagesDraft?.scenes || []).map((scene) => [String(scene.scriptSceneId || scene.id), scene])
    );

    const scenes = (scriptDraft?.scenes || []).map((scene, sceneIndex) => {
      const existing = existingByScriptSceneId.get(String(scene.id));
      const startingScene = startingByScriptSceneId.get(String(scene.id));
      const approvedVariation = startingScene?.variations?.find((variation) => variation.id === startingScene.approvedVariationId) || null;
      const existingRequestsByScriptClipId = new Map(
        (existing?.clips || []).map((clip) => [String(clip.scriptClipId || clip.id), clip])
      );

      const clips = (scene.clips || []).map((clip, clipIndex) => {
        const existingRequest = existingRequestsByScriptClipId.get(String(clip.id)) || existing?.clips?.[clipIndex];
        return createVideoClipRequest({
          ...existingRequest,
          scriptClipId: clip.id,
          title: clip.title,
          clipPrompt: existingRequest?.clipPrompt || clip.prompt,
          shotNotes: existingRequest?.shotNotes || clip.shotNotes,
          shotRole: existingRequest?.shotRole || clip.shotRole,
          planningSource: existingRequest?.planningSource || clip.planningSource || "manual",
          status: approvedVariation?.imageUrl
            ? (existingRequest?.generatedClips?.length ? "generated" : "ready")
            : "not_ready"
        }, clipIndex);
      });

      const hasGenerated = clips.some((clip) => clip.generatedClips.length > 0);

      return createVideoClipScene({
        ...existing,
        id: existing?.id || `video-${scene.id}`,
        scriptSceneId: scene.id,
        title: scene.title,
        startingImageUrl: approvedVariation?.imageUrl || existing?.startingImageUrl || "",
        startingVariationId: approvedVariation?.id || existing?.startingVariationId || "",
        status: approvedVariation?.imageUrl
          ? (hasGenerated ? "generated" : "ready")
          : "not_ready",
        clips
      }, sceneIndex);
    });

    const selectedSceneId = currentDraft.selectedSceneId && scenes.some((scene) => scene.id === currentDraft.selectedSceneId)
      ? currentDraft.selectedSceneId
      : scenes[0]?.id || "";
    const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) || scenes[0] || null;
    const selectedRequestId = currentDraft.selectedRequestId && selectedScene?.clips?.some((clip) => clip.id === currentDraft.selectedRequestId)
      ? currentDraft.selectedRequestId
      : selectedScene?.clips?.[0]?.id || "";

    return createVideoClipsDraft({
      scenes,
      selectedSceneId,
      selectedRequestId,
      updatedAt: new Date().toISOString()
    });
  }

  function buildEditDraftFromVideoClips(videoClipsDraft, existingDraft) {
    const currentDraft = createEditDraft(existingDraft || {});
    const timelineItems = [];

    (videoClipsDraft?.scenes || []).forEach((scene) => {
      (scene.clips || []).forEach((request) => {
        const approvedClip = (request.generatedClips || []).find((clip) => clip.id === request.approvedClipId)
          || request.generatedClips?.[0]
          || null;
        if (!approvedClip?.videoUrl) {
          return;
        }
        timelineItems.push(createEditTimelineItem({
          id: `${scene.id}::${request.id}`,
          sceneId: scene.scriptSceneId || scene.id,
          sceneTitle: scene.title,
          requestId: request.id,
          title: request.title || scene.title,
          videoUrl: approvedClip.videoUrl,
          thumbnailUrl: approvedClip.thumbnailUrl || approvedClip.videoUrl,
          durationSeconds: 4,
          type: "video",
          placementType: "scene_shot",
          shotRole: request.shotRole,
          clipPrompt: request.clipPrompt,
          shotNotes: request.shotNotes,
          planningSource: request.planningSource,
          trackId: "V1"
        }, timelineItems.length));
      });
    });

    const selectedItemId = currentDraft.selectedItemId && timelineItems.some((item) => item.id === currentDraft.selectedItemId)
      ? currentDraft.selectedItemId
      : timelineItems[0]?.id || "";
    const sceneIds = (videoClipsDraft?.scenes || []).map((scene) => String(scene.scriptSceneId || scene.id)).filter(Boolean);
    const activeSceneId = currentDraft.activeSceneId && sceneIds.includes(String(currentDraft.activeSceneId))
      ? currentDraft.activeSceneId
      : sceneIds[0] || "";

    return createEditDraft({
      timelineItems,
      activeSceneId,
      selectedItemId,
      totalDurationSeconds: timelineItems.reduce((total, item) => total + Number(item.durationSeconds || 0), 0),
      updatedAt: new Date().toISOString()
    });
  }

  function buildExportReleaseDraftFromProject(projectSummary, editDraft, existingDraft) {
    const currentDraft = createExportReleaseDraft(existingDraft || {});
    const titleBase = String(projectSummary?.title || "Untitled SocialArena Project").trim();
    return createExportReleaseDraft({
      ...currentDraft,
      title: currentDraft.title || `${titleBase} Draft Export`,
      exportType: currentDraft.exportType || "draft",
      resolution: currentDraft.resolution || "1920x1080",
      durationSeconds: Number(editDraft?.totalDurationSeconds || 0),
      updatedAt: new Date().toISOString()
    });
  }

  function normalizeProjectSummary(project = {}) {
    const type = String(project.type || project.project_type || "project");
    return {
      id: Number(project.id),
      type,
      title: project.title || project.name || "Untitled SocialArena Project",
      description: project.description || "",
      status: project.status || "draft",
      clipCount: Number(project.clip_count || project.asset_count || 0)
    };
  }

  function normalizeApiIdeaBoard(ideaBoard) {
    if (!ideaBoard) {
      return {
        meta: null,
        board: createIdeaBoardState({ cards: [] })
      };
    }

    const cards = Array.isArray(ideaBoard.items)
      ? ideaBoard.items.map((item, index) => ({
          id: String(item.id || `idea-card-${index + 1}`),
          category: IDEA_CARD_CATEGORIES.includes(item.item_type)
            ? item.item_type
            : IDEA_CATEGORY_ALIASES[String(item.item_type || "")] || "note",
          title: item.title || "",
          description: item.content || "",
          status: item.generation_status || "draft",
          influencedBy: [],
          x: Number(item.pos_x ?? 120 + (index % 3) * 280),
          y: Number(item.pos_y ?? 120 + Math.floor(index / 3) * 180)
        }))
      : [];

    const cardMap = new Map(cards.map((card) => [String(card.id), card]));
    if (Array.isArray(ideaBoard.links)) {
      ideaBoard.links.forEach((link) => {
        const target = cardMap.get(String(link.target_item_id));
        if (target) {
          target.influencedBy.push(String(link.source_item_id));
        }
      });
    }

    return {
      meta: {
        id: Number(ideaBoard.id),
        title: ideaBoard.title || "",
        description: ideaBoard.description || "",
        visibility: ideaBoard.visibility || "private",
        updatedAt: ideaBoard.updated_at || ""
      },
      board: createIdeaBoardState({
        cards,
        updatedAt: ideaBoard.updated_at || new Date().toISOString()
      })
    };
  }

  function serializeIdeaBoard(projectWorkspace) {
    const cards = Array.isArray(projectWorkspace?.ideaBoard?.board?.cards)
      ? projectWorkspace.ideaBoard.board.cards
      : [];

    return {
      title: projectWorkspace?.ideaBoard?.meta?.title || `${projectWorkspace?.activeProject?.title || "Project"} Idea Board`,
      description: projectWorkspace?.ideaBoard?.meta?.description || projectWorkspace?.activeProject?.description || "",
      items: cards.map((card) => ({
        id: /^\d+$/.test(String(card.id || "")) ? Number(card.id) : String(card.id || ""),
        item_type: card.category || "note",
        title: card.title || "",
        content: card.description || "",
        pos_x: Number(card.x ?? 120),
        pos_y: Number(card.y ?? 120),
        width: 240,
        height: 160
      })),
      links: cards.flatMap((card) =>
        (Array.isArray(card.influencedBy) ? card.influencedBy : []).map((sourceId) => ({
          source_item_id: /^\d+$/.test(String(sourceId || "")) ? Number(sourceId) : String(sourceId || ""),
          target_item_id: /^\d+$/.test(String(card.id || "")) ? Number(card.id) : String(card.id || ""),
          link_type: "note"
        }))
      )
    };
  }

  function createInitialProjectWorkspace() {
    return {
      loading: false,
      error: "",
      activeProject: null,
      projectDetail: null,
      timelineProject: null,
      workflowStageId: "idea_board",
      importedAssets: [],
      pitch: {
        draft: createPitchDraft({}),
        dirty: false
      },
      script: {
        draft: createScriptDraft({}),
        dirty: false
      },
      startingImages: {
        draft: createStartingImagesDraft({}),
        dirty: false,
        loading: false,
        error: ""
      },
      videoClips: {
        draft: createVideoClipsDraft({}),
        dirty: false,
        loading: false,
        error: ""
      },
      edit: {
        draft: createEditDraft({}),
        dirty: false
      },
      exportRelease: {
        draft: createExportReleaseDraft({}),
        dirty: false
      },
      ideaBoard: {
        loading: false,
        error: "",
        meta: null,
        board: createIdeaBoardState({ cards: [] }),
        dirty: false
      }
    };
  }

  function extractPersistedWorkspace(timelineProject) {
    const payload = timelineProject?.timeline_json?.v2_workspace;
    if (!payload || typeof payload !== "object") {
      return null;
    }
    return {
      pitch: payload.pitch ? createPitchDraft(payload.pitch) : null,
      script: payload.script ? createScriptDraft(payload.script) : null,
      startingImages: payload.startingImages ? createStartingImagesDraft(payload.startingImages) : null,
      videoClips: payload.videoClips ? createVideoClipsDraft(payload.videoClips) : null,
      edit: payload.edit ? createEditDraft(payload.edit) : null,
      exportRelease: payload.exportRelease ? createExportReleaseDraft(payload.exportRelease) : null,
      workflow: payload.workflow && typeof payload.workflow === "object"
        ? {
            currentStageId: String(payload.workflow.currentStageId || "").trim()
          }
        : null,
      importedAssets: Array.isArray(payload.importedAssets)
        ? payload.importedAssets.map((asset, index) => createImportedAsset(asset, index))
        : []
    };
  }

  function serializeWorkspace(projectWorkspace) {
    return {
      version: 1,
      pitch: createPitchDraft(projectWorkspace?.pitch?.draft || {}),
      script: createScriptDraft(projectWorkspace?.script?.draft || {}),
      startingImages: createStartingImagesDraft(projectWorkspace?.startingImages?.draft || {}),
      videoClips: createVideoClipsDraft(projectWorkspace?.videoClips?.draft || {}),
      edit: createEditDraft(projectWorkspace?.edit?.draft || {}),
      exportRelease: createExportReleaseDraft(projectWorkspace?.exportRelease?.draft || {}),
      workflow: {
        currentStageId: String(projectWorkspace?.workflowStageId || "").trim() || "idea_board"
      },
      importedAssets: Array.isArray(projectWorkspace?.importedAssets)
        ? projectWorkspace.importedAssets.map((asset, index) => createImportedAsset(asset, index))
        : []
    };
  }

  function setProjectWorkspaceLoading(store, loading) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        loading,
        error: loading ? "" : state.projectWorkspace.error
      }
    }));
  }

  function updateImportedAssets(store, updater) {
    store.setState((state) => {
      const nextAssets = typeof updater === "function"
        ? updater(state.projectWorkspace.importedAssets || [])
        : updater;
      return {
        ...state,
        projectWorkspace: {
          ...state.projectWorkspace,
          importedAssets: Array.isArray(nextAssets)
            ? nextAssets.map((asset, index) => createImportedAsset(asset, index))
            : []
        }
      };
    });
  }

  function applyImportedAssetMetadata(store, assetId, metadata = {}) {
    updateImportedAssets(store, (assets) => assets.map((asset) => {
      if (asset.id !== assetId) {
        return asset;
      }
      return createImportedAsset({
        ...asset,
        durationSeconds: Number(metadata.durationSeconds || asset.durationSeconds || 0),
        durationResolved: metadata.durationResolved ?? asset.durationResolved
      });
    }));

    updateEditDraft(store, (draft) => {
      const timelineItems = (draft.timelineItems || []).map((item) => {
        if (item.requestId !== assetId) {
          return item;
        }
        return createEditTimelineItem({
          ...item,
          durationSeconds: Number(metadata.durationSeconds || item.durationSeconds || 0)
        });
      });
      return createEditDraft({
        ...draft,
        timelineItems,
        totalDurationSeconds: timelineItems.reduce((total, item) => total + Number(item.durationSeconds || 0), 0),
        updatedAt: new Date().toISOString()
      });
    });
  }

  function setProjectWorkspaceError(store, message) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        loading: false,
        error: String(message || "Failed to load project workspace.")
      }
    }));
  }

  function setActiveProject(store, payload) {
    const currentState = store.getState();
    const summary = normalizeProjectSummary(payload?.summary || payload?.project || currentState.projectWorkspace.activeProject || {});
    const board = payload?.ideaBoard?.board || createIdeaBoardState({ cards: [] });
    const persistedWorkspace = extractPersistedWorkspace(payload?.timelineProject || null);
    const pitchDraft = persistedWorkspace?.pitch || buildPitchDraftFromProject(summary, board);
    const scriptDraft = persistedWorkspace?.script || buildScriptDraftFromProject(summary, pitchDraft, board, payload?.project || null);
    const startingImagesDraft = buildStartingImagesDraftFromScript(
      scriptDraft,
      persistedWorkspace?.startingImages || currentState.projectWorkspace.startingImages?.draft || {}
    );
    const videoClipsDraft = buildVideoClipsDraftFromScript(
      scriptDraft,
      startingImagesDraft,
      persistedWorkspace?.videoClips || currentState.projectWorkspace.videoClips?.draft || {}
    );
    const editDraft = persistedWorkspace?.edit || buildEditDraftFromVideoClips(
      videoClipsDraft,
      currentState.projectWorkspace.edit?.draft || {}
    );
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        loading: false,
        error: "",
        activeProject: summary,
        projectDetail: payload?.project || null,
        timelineProject: payload?.timelineProject || null,
        workflowStageId: persistedWorkspace?.workflow?.currentStageId || "idea_board",
        importedAssets: persistedWorkspace?.importedAssets || [],
        pitch: {
          draft: pitchDraft,
          dirty: false
        },
        script: {
          draft: scriptDraft,
          dirty: false
        },
        startingImages: {
          draft: startingImagesDraft,
          dirty: false,
          loading: false,
          error: ""
        },
        videoClips: {
          draft: videoClipsDraft,
          dirty: false,
          loading: false,
          error: ""
        },
        edit: {
          draft: editDraft,
          dirty: false
        },
        exportRelease: {
          draft: buildExportReleaseDraftFromProject(
            summary,
            editDraft,
            persistedWorkspace?.exportRelease || state.projectWorkspace.exportRelease?.draft || {}
          ),
          dirty: false
        },
        ideaBoard: {
          ...state.projectWorkspace.ideaBoard,
          meta: payload?.ideaBoard?.meta || null,
          board,
          dirty: false,
          error: ""
        }
      }
    }));
  }

  function setIdeaBoardLoading(store, loading) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        ideaBoard: {
          ...state.projectWorkspace.ideaBoard,
          loading,
          error: loading ? "" : state.projectWorkspace.ideaBoard.error
        }
      }
    }));
  }

  function setIdeaBoardError(store, message) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        ideaBoard: {
          ...state.projectWorkspace.ideaBoard,
          loading: false,
          error: String(message || "Failed to load idea board.")
        }
      }
    }));
  }

  function updateIdeaBoard(store, updater) {
    store.setState((state) => {
      const nextBoard = typeof updater === "function"
        ? updater(state.projectWorkspace.ideaBoard.board)
        : updater;
      return {
        ...state,
        projectWorkspace: {
          ...state.projectWorkspace,
          ideaBoard: {
            ...state.projectWorkspace.ideaBoard,
            board: createIdeaBoardState(nextBoard),
            dirty: true,
            loading: false,
            error: ""
          }
        }
      };
    });
  }

  function setTimelineProjectSaved(store, payload) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        timelineProject: payload?.timeline_project || state.projectWorkspace.timelineProject,
        pitch: {
          ...state.projectWorkspace.pitch,
          dirty: false
        },
        script: {
          ...state.projectWorkspace.script,
          dirty: false
        },
        edit: {
          ...state.projectWorkspace.edit,
          dirty: false
        }
      }
    }));
  }

  function setIdeaBoardSaved(store, payload) {
    const normalized = normalizeApiIdeaBoard(payload?.idea_board || null);
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        ideaBoard: {
          loading: false,
          error: "",
          meta: normalized.meta,
          board: normalized.board,
          dirty: false
        }
      }
    }));
  }

  function updatePitchDraft(store, draft) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        pitch: {
          draft: createPitchDraft(draft),
          dirty: true
        }
      }
    }));
  }

  function applyPitchDraft(store) {
    store.setState((state) => {
      const draft = createPitchDraft(state.projectWorkspace.pitch?.draft || {});
      return {
        ...state,
        projectWorkspace: {
          ...state.projectWorkspace,
          activeProject: state.projectWorkspace.activeProject
            ? {
                ...state.projectWorkspace.activeProject,
                title: draft.title || state.projectWorkspace.activeProject.title,
                type: draft.format || state.projectWorkspace.activeProject.type,
                description: draft.concept || state.projectWorkspace.activeProject.description
              }
            : state.projectWorkspace.activeProject,
          pitch: {
            draft,
            dirty: false
          },
          script: {
            draft: buildScriptDraftFromProject(
              state.projectWorkspace.activeProject
                ? {
                    ...state.projectWorkspace.activeProject,
                    title: draft.title || state.projectWorkspace.activeProject.title,
                    type: draft.format || state.projectWorkspace.activeProject.type,
                    description: draft.concept || state.projectWorkspace.activeProject.description
                  }
                : state.projectWorkspace.activeProject,
              draft,
              state.projectWorkspace.ideaBoard?.board || createIdeaBoardState({ cards: [] }),
              state.projectWorkspace.projectDetail || null
            ),
            dirty: false
          },
          startingImages: {
            draft: buildStartingImagesDraftFromScript(
              buildScriptDraftFromProject(
                state.projectWorkspace.activeProject
                  ? {
                      ...state.projectWorkspace.activeProject,
                      title: draft.title || state.projectWorkspace.activeProject.title,
                      type: draft.format || state.projectWorkspace.activeProject.type,
                      description: draft.concept || state.projectWorkspace.activeProject.description
                    }
                  : state.projectWorkspace.activeProject,
                draft,
                state.projectWorkspace.ideaBoard?.board || createIdeaBoardState({ cards: [] }),
                state.projectWorkspace.projectDetail || null
              ),
              state.projectWorkspace.startingImages?.draft || {}
            ),
            dirty: false,
            loading: false,
            error: ""
          },
          videoClips: {
            draft: buildVideoClipsDraftFromScript(
              buildScriptDraftFromProject(
                state.projectWorkspace.activeProject
                  ? {
                      ...state.projectWorkspace.activeProject,
                      title: draft.title || state.projectWorkspace.activeProject.title,
                      type: draft.format || state.projectWorkspace.activeProject.type,
                      description: draft.concept || state.projectWorkspace.activeProject.description
                    }
                  : state.projectWorkspace.activeProject,
                draft,
                state.projectWorkspace.ideaBoard?.board || createIdeaBoardState({ cards: [] }),
                state.projectWorkspace.projectDetail || null
              ),
              state.projectWorkspace.startingImages?.draft || createStartingImagesDraft({}),
              state.projectWorkspace.videoClips?.draft || {}
            ),
            dirty: false,
            loading: false,
            error: ""
          },
          edit: {
            draft: buildEditDraftFromVideoClips(
              buildVideoClipsDraftFromScript(
                buildScriptDraftFromProject(
                  state.projectWorkspace.activeProject
                    ? {
                        ...state.projectWorkspace.activeProject,
                        title: draft.title || state.projectWorkspace.activeProject.title,
                        type: draft.format || state.projectWorkspace.activeProject.type,
                        description: draft.concept || state.projectWorkspace.activeProject.description
                      }
                    : state.projectWorkspace.activeProject,
                  draft,
                  state.projectWorkspace.ideaBoard?.board || createIdeaBoardState({ cards: [] }),
                  state.projectWorkspace.projectDetail || null
                ),
                state.projectWorkspace.startingImages?.draft || createStartingImagesDraft({}),
                state.projectWorkspace.videoClips?.draft || {}
              ),
              state.projectWorkspace.edit?.draft || {}
            ),
            dirty: false
          },
          exportRelease: {
            draft: buildExportReleaseDraftFromProject(
              state.projectWorkspace.activeProject
                ? {
                    ...state.projectWorkspace.activeProject,
                    title: draft.title || state.projectWorkspace.activeProject.title,
                    type: draft.format || state.projectWorkspace.activeProject.type,
                    description: draft.concept || state.projectWorkspace.activeProject.description
                  }
                : state.projectWorkspace.activeProject,
              state.projectWorkspace.edit?.draft || createEditDraft({}),
              state.projectWorkspace.exportRelease?.draft || {}
            ),
            dirty: false
          }
        }
      };
    });
  }

  function updateScriptDraft(store, draft) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        script: {
          draft: createScriptDraft(draft),
          dirty: true
        }
      }
    }));
  }

  function applyScriptDraft(store) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        script: {
          draft: createScriptDraft(state.projectWorkspace.script?.draft || {}),
          dirty: false
        },
        startingImages: {
          draft: buildStartingImagesDraftFromScript(
            createScriptDraft(state.projectWorkspace.script?.draft || {}),
            state.projectWorkspace.startingImages?.draft || {}
          ),
          dirty: false,
          loading: false,
          error: ""
        },
        videoClips: {
          draft: buildVideoClipsDraftFromScript(
            createScriptDraft(state.projectWorkspace.script?.draft || {}),
            state.projectWorkspace.startingImages?.draft || createStartingImagesDraft({}),
            state.projectWorkspace.videoClips?.draft || {}
          ),
          dirty: false,
          loading: false,
          error: ""
        },
        edit: {
          draft: buildEditDraftFromVideoClips(
            buildVideoClipsDraftFromScript(
              createScriptDraft(state.projectWorkspace.script?.draft || {}),
              state.projectWorkspace.startingImages?.draft || createStartingImagesDraft({}),
              state.projectWorkspace.videoClips?.draft || {}
            ),
            state.projectWorkspace.edit?.draft || {}
          ),
          dirty: false
        },
        exportRelease: {
          draft: buildExportReleaseDraftFromProject(
            state.projectWorkspace.activeProject,
            state.projectWorkspace.edit?.draft || createEditDraft({}),
            state.projectWorkspace.exportRelease?.draft || {}
          ),
          dirty: false
        }
      }
    }));
  }

  function setStartingImagesLoading(store, loading) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        startingImages: {
          ...state.projectWorkspace.startingImages,
          loading,
          error: loading ? "" : state.projectWorkspace.startingImages.error
        }
      }
    }));
  }

  function setStartingImagesError(store, message) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        startingImages: {
          ...state.projectWorkspace.startingImages,
          loading: false,
          error: String(message || "Starting image generation failed.")
        }
      }
    }));
  }

  function updateStartingImagesDraft(store, updater) {
    store.setState((state) => {
      const nextDraft = typeof updater === "function"
        ? updater(state.projectWorkspace.startingImages.draft)
        : updater;
      return {
        ...state,
        projectWorkspace: {
          ...state.projectWorkspace,
          startingImages: {
            ...state.projectWorkspace.startingImages,
            draft: createStartingImagesDraft(nextDraft),
            dirty: true,
            loading: false,
            error: ""
          }
        }
      };
    });
  }

  function applyStartingImagePayload(store, sceneId, payload = {}) {
    updateStartingImagesDraft(store, (draft) => ({
      ...draft,
      scenes: draft.scenes.map((scene) => {
        if (scene.id !== sceneId) {
          return scene;
        }
        const nextVariation = payload.generated_image_url
          ? createStartingImageVariation({
              id: payload.prompt_id || `${scene.id}-generated-${Date.now()}`,
              imageUrl: payload.generated_image_url,
              label: `Generated ${Math.max(1, Number(payload.generation_count || scene.variations.length + 1))}`,
              source: "generated",
              status: "draft"
            }, scene.variations.length)
          : null;
        const variations = nextVariation
          ? [...scene.variations.filter((variation) => variation.imageUrl !== nextVariation.imageUrl), nextVariation]
          : scene.variations;
        return createStartingImageScene({
          ...scene,
          boardItemId: payload.board_item_id || scene.boardItemId,
          generationStatus: payload.generation_status || scene.generationStatus,
          generationCount: payload.generation_count || scene.generationCount,
          promptId: payload.prompt_id || scene.promptId,
          lastGeneratedAt: payload.last_generated_at || scene.lastGeneratedAt,
          lastError: payload.last_error || "",
          status: payload.generated_image_url
            ? (scene.approvedVariationId || nextVariation?.id ? "ready" : "generated")
            : scene.status,
          variations
        });
      }),
      updatedAt: new Date().toISOString()
    }));

    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        videoClips: {
          draft: buildVideoClipsDraftFromScript(
            state.projectWorkspace.script?.draft || createScriptDraft({}),
            createStartingImagesDraft(state.projectWorkspace.startingImages?.draft || {}),
            state.projectWorkspace.videoClips?.draft || {}
          ),
          dirty: false,
          loading: false,
          error: ""
        },
        edit: {
          draft: buildEditDraftFromVideoClips(
            buildVideoClipsDraftFromScript(
              state.projectWorkspace.script?.draft || createScriptDraft({}),
              createStartingImagesDraft(state.projectWorkspace.startingImages?.draft || {}),
              state.projectWorkspace.videoClips?.draft || {}
            ),
            state.projectWorkspace.edit?.draft || {}
          ),
          dirty: false
        },
        exportRelease: {
          draft: buildExportReleaseDraftFromProject(
            state.projectWorkspace.activeProject,
            state.projectWorkspace.edit?.draft || createEditDraft({}),
            state.projectWorkspace.exportRelease?.draft || {}
          ),
          dirty: false
        }
      }
    }));
  }

  function setVideoClipsLoading(store, loading) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        videoClips: {
          ...state.projectWorkspace.videoClips,
          loading,
          error: loading ? "" : state.projectWorkspace.videoClips.error
        }
      }
    }));
  }

  function setVideoClipsError(store, message) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: {
        ...state.projectWorkspace,
        videoClips: {
          ...state.projectWorkspace.videoClips,
          loading: false,
          error: String(message || "Video clip generation failed.")
        }
      }
    }));
  }

  function updateVideoClipsDraft(store, updater) {
    store.setState((state) => {
      const nextDraft = typeof updater === "function"
        ? updater(state.projectWorkspace.videoClips.draft)
        : updater;
      return {
        ...state,
        projectWorkspace: {
          ...state.projectWorkspace,
          videoClips: {
            ...state.projectWorkspace.videoClips,
            draft: createVideoClipsDraft(nextDraft),
            dirty: true,
            loading: false,
            error: ""
          },
          edit: {
            draft: buildEditDraftFromVideoClips(
              createVideoClipsDraft(nextDraft),
              state.projectWorkspace.edit?.draft || {}
            ),
            dirty: false
          },
          exportRelease: {
            draft: buildExportReleaseDraftFromProject(
              state.projectWorkspace.activeProject,
              buildEditDraftFromVideoClips(
                createVideoClipsDraft(nextDraft),
                state.projectWorkspace.edit?.draft || {}
              ),
              state.projectWorkspace.exportRelease?.draft || {}
            ),
            dirty: false
          }
        }
      };
    });
  }

  function applyVideoClipPayload(store, sceneId, requestId, payload = {}) {
    updateVideoClipsDraft(store, (draft) => ({
      ...draft,
      scenes: draft.scenes.map((scene) => {
        if (scene.id !== sceneId) {
          return scene;
        }
        const nextClips = scene.clips.map((clip) => {
          if (clip.id !== requestId) {
            return clip;
          }
          const nextGenerated = payload.generated_video_url
            ? createGeneratedVideoClip({
                id: payload.prompt_id || `${clip.id}-generated-${Date.now()}`,
                label: `${clip.title || "Clip"} ${Math.max(1, Number(payload.generation_count || clip.generatedClips.length + 1))}`,
                videoUrl: payload.generated_video_url,
                thumbnailUrl: payload.generated_video_url,
                status: "generated"
              }, clip.generatedClips.length)
            : null;
          const generatedClips = nextGenerated
            ? [...clip.generatedClips.filter((entry) => entry.videoUrl !== nextGenerated.videoUrl), nextGenerated]
            : clip.generatedClips;
          return createVideoClipRequest({
            ...clip,
            boardItemId: payload.board_item_id || clip.boardItemId,
            generationStatus: payload.generation_status || clip.generationStatus,
            generationCount: payload.generation_count || clip.generationCount,
            promptId: payload.prompt_id || clip.promptId,
            lastGeneratedAt: payload.last_generated_at || clip.lastGeneratedAt,
            lastError: payload.last_error || "",
            status: payload.generated_video_url ? "generated" : clip.status,
            approvedClipId: clip.approvedClipId || nextGenerated?.id || "",
            generatedClips
          });
        });
        const hasGenerated = nextClips.some((clip) => clip.generatedClips.length > 0);
        return createVideoClipScene({
          ...scene,
          clips: nextClips,
          status: scene.startingImageUrl
            ? (hasGenerated ? "generated" : "ready")
            : "not_ready"
        });
      }),
      updatedAt: new Date().toISOString()
    }));
  }

  function updateEditDraft(store, updater) {
    store.setState((state) => {
      const nextDraft = typeof updater === "function"
        ? updater(state.projectWorkspace.edit.draft)
        : updater;
      return {
        ...state,
        projectWorkspace: {
          ...state.projectWorkspace,
          edit: {
            draft: createEditDraft(nextDraft),
            dirty: true
          },
          exportRelease: {
            draft: buildExportReleaseDraftFromProject(
              state.projectWorkspace.activeProject,
              createEditDraft(nextDraft),
              state.projectWorkspace.exportRelease?.draft || {}
            ),
            dirty: false
          }
        }
      };
    });
  }

  function appendImportedAssetToTimeline(store, assetId, options = {}) {
    const state = store.getState();
    const asset = (state.projectWorkspace?.importedAssets || []).find((entry) => entry.id === assetId);
    if (!asset) {
      return;
    }

    const activeSceneId = String(options.sceneId || state.projectWorkspace?.edit?.draft?.activeSceneId || "").trim();
    const videoDraft = createVideoClipsDraft(state.projectWorkspace?.videoClips?.draft || {});
    const activeScene = videoDraft.scenes.find((scene) => String(scene.scriptSceneId || scene.id) === activeSceneId) || null;
    const placementType = String(
      options.placementType
      || (asset.kind === "audio"
        ? "music"
        : activeSceneId
          ? "scene_shot"
          : "temp")
    ).trim();

    updateEditDraft(store, (draft) => {
      const timelineItems = Array.isArray(draft.timelineItems) ? [...draft.timelineItems] : [];
      timelineItems.push(createEditTimelineItem({
        id: `timeline-import-${asset.id}`,
        sceneId: placementType === "scene_shot" ? activeSceneId : "",
        sceneTitle: placementType === "scene_shot" ? String(activeScene?.title || "").trim() : "",
        requestId: asset.id,
        title: asset.name,
        videoUrl: asset.sourceUrl,
        thumbnailUrl: asset.thumbnailUrl,
        durationSeconds: asset.durationSeconds,
        type: asset.kind,
        trackId: asset.kind === "audio" ? "A1" : "V1",
        placementType,
        planningSource: "imported_media"
      }, timelineItems.length));
      return createEditDraft({
        ...draft,
        timelineItems,
        activeSceneId: activeSceneId || draft.activeSceneId || "",
        selectedItemId: timelineItems[timelineItems.length - 1]?.id || draft.selectedItemId,
        totalDurationSeconds: timelineItems.reduce((total, item) => total + Number(item.durationSeconds || 0), 0),
        updatedAt: new Date().toISOString()
      });
    });
  }

  function setEditActiveScene(store, sceneId) {
    updateEditDraft(store, (draft) => ({
      ...draft,
      activeSceneId: String(sceneId || "").trim(),
      updatedAt: new Date().toISOString()
    }));
  }

  function setEditPlayhead(store, timeSeconds) {
    updateEditDraft(store, (draft) => {
      const totalDuration = Math.max(0, Number(draft.totalDurationSeconds || 0));
      return createEditDraft({
        ...draft,
        playheadSeconds: Math.min(Math.max(0, Number(timeSeconds || 0)), totalDuration),
        updatedAt: new Date().toISOString()
      });
    });
  }

  function stepEditPlayhead(store, deltaSeconds) {
    updateEditDraft(store, (draft) => {
      const totalDuration = Math.max(0, Number(draft.totalDurationSeconds || 0));
      const nextTime = Math.min(
        Math.max(0, Number(draft.playheadSeconds || 0) + Number(deltaSeconds || 0)),
        totalDuration
      );
      return createEditDraft({
        ...draft,
        playheadSeconds: nextTime,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function addEditMarkerAtPlayhead(store, label = "") {
    updateEditDraft(store, (draft) => {
      const nextIndex = Array.isArray(draft.markers) ? draft.markers.length : 0;
      const markerTime = Math.max(0, Number(draft.playheadSeconds || 0));
      const nextMarkers = [...(draft.markers || []), createEditMarker({
        label: label || `Marker ${nextIndex + 1}`,
        timeSeconds: markerTime
      }, nextIndex)].sort((left, right) => Number(left.timeSeconds || 0) - Number(right.timeSeconds || 0));
      return createEditDraft({
        ...draft,
        markers: nextMarkers,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function assignTimelineItemToScene(store, itemId, sceneId, sceneTitle = "") {
    updateEditDraft(store, (draft) => {
      const normalizedSceneId = String(sceneId || "").trim();
      const normalizedTitle = String(sceneTitle || "").trim();
      const timelineItems = (draft.timelineItems || []).map((item) => {
        if (String(item.id) !== String(itemId)) {
          return item;
        }
        return createEditTimelineItem({
          ...item,
          sceneId: normalizedSceneId,
          sceneTitle: normalizedTitle,
          placementType: normalizedSceneId
            ? (item.type === "audio" ? "music" : "scene_shot")
            : (item.type === "audio" ? "music" : "temp")
        });
      });
      return createEditDraft({
        ...draft,
        timelineItems,
        activeSceneId: normalizedSceneId || draft.activeSceneId || "",
        updatedAt: new Date().toISOString()
      });
    });
  }

  function updateTimelineItemPlacementType(store, itemId, placementType) {
    updateEditDraft(store, (draft) => {
      const normalizedPlacement = String(placementType || "").trim() || "temp";
      const timelineItems = (draft.timelineItems || []).map((item) => {
        if (String(item.id) !== String(itemId)) {
          return item;
        }

        const isScenePlacement = normalizedPlacement === "scene_shot";
        const isAudioNarrativeNeutral = ["music", "voiceover", "sfx"].includes(normalizedPlacement);
        return createEditTimelineItem({
          ...item,
          placementType: normalizedPlacement,
          sceneId: isScenePlacement ? item.sceneId : (isAudioNarrativeNeutral ? "" : item.sceneId),
          sceneTitle: isScenePlacement ? item.sceneTitle : (isAudioNarrativeNeutral ? "" : item.sceneTitle)
        });
      });
      return createEditDraft({
        ...draft,
        timelineItems,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function getTimelineLaneId(item) {
    return getTimelineLaneIdValue(item);
  }

  function moveTimelineItemHorizontally(store, itemId, direction) {
    updateEditDraft(store, (draft) => {
      const timelineItems = Array.isArray(draft.timelineItems) ? [...draft.timelineItems] : [];
      const currentIndex = timelineItems.findIndex((item) => String(item.id) === String(itemId));
      if (currentIndex < 0) {
        return draft;
      }

      const currentItem = timelineItems[currentIndex];
      const laneId = getTimelineLaneId(currentItem);
      const candidateIndexes = timelineItems
        .map((item, index) => ({ item, index }))
        .filter((entry) => getTimelineLaneId(entry.item) === laneId)
        .map((entry) => entry.index);
      const lanePosition = candidateIndexes.indexOf(currentIndex);
      if (lanePosition < 0) {
        return draft;
      }

      const targetLanePosition = direction === "left" ? lanePosition - 1 : lanePosition + 1;
      if (targetLanePosition < 0 || targetLanePosition >= candidateIndexes.length) {
        return draft;
      }

      const targetIndex = candidateIndexes[targetLanePosition];
      const [movedItem] = timelineItems.splice(currentIndex, 1);
      timelineItems.splice(targetIndex, 0, movedItem);
      const rebalancedItems = rebalanceTimelineLaneByArrayOrder(timelineItems, laneId);

      return createEditDraft({
        ...draft,
        timelineItems: rebalancedItems,
        selectedItemId: movedItem.id,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function duplicateTimelineItem(store, itemId) {
    updateEditDraft(store, (draft) => {
      const timelineItems = Array.isArray(draft.timelineItems) ? [...draft.timelineItems] : [];
      const currentIndex = timelineItems.findIndex((item) => String(item.id) === String(itemId));
      if (currentIndex < 0) {
        return draft;
      }

      const sourceItem = timelineItems[currentIndex];
      const laneId = getTimelineLaneId(sourceItem);
      const sourceEndSeconds = Math.max(0, Number(sourceItem.startSeconds || 0)) + Math.max(1, Number(sourceItem.durationSeconds || 0));
      const duplicateItem = createEditTimelineItem({
        ...sourceItem,
        id: `${sourceItem.id}-dup-${Date.now()}`,
        title: `${sourceItem.title} Copy`,
        startSeconds: sourceEndSeconds
      }, timelineItems.length);

      const shiftedItems = shiftTimelineItemsInLane(
        timelineItems,
        laneId,
        sourceEndSeconds,
        Number(sourceItem.durationSeconds || 0)
      );
      shiftedItems.splice(currentIndex + 1, 0, duplicateItem);

      return createEditDraft({
        ...draft,
        timelineItems: shiftedItems,
        selectedItemId: duplicateItem.id,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function splitTimelineItem(store, itemId) {
    updateEditDraft(store, (draft) => {
      const timelineItems = Array.isArray(draft.timelineItems) ? [...draft.timelineItems] : [];
      const currentIndex = timelineItems.findIndex((item) => String(item.id) === String(itemId));
      if (currentIndex < 0) {
        return draft;
      }

      const sourceItem = timelineItems[currentIndex];
      const sourceDuration = Math.max(2, Number(sourceItem.durationSeconds || 2));
      const leftDuration = Math.max(1, Math.floor(sourceDuration / 2));
      const rightDuration = Math.max(1, sourceDuration - leftDuration);
      const sourceStartSeconds = Math.max(0, Number(sourceItem.startSeconds || 0));

      const leftItem = createEditTimelineItem({
        ...sourceItem,
        id: `${sourceItem.id}-a`,
        title: `${sourceItem.title} A`,
        startSeconds: sourceStartSeconds,
        durationSeconds: leftDuration
      }, currentIndex);
      const rightItem = createEditTimelineItem({
        ...sourceItem,
        id: `${sourceItem.id}-b`,
        title: `${sourceItem.title} B`,
        startSeconds: sourceStartSeconds + leftDuration,
        durationSeconds: rightDuration
      }, currentIndex + 1);

      timelineItems.splice(currentIndex, 1, leftItem, rightItem);

      return createEditDraft({
        ...draft,
        timelineItems,
        selectedItemId: leftItem.id,
        totalDurationSeconds: timelineItems.reduce((total, item) => total + Number(item.durationSeconds || 0), 0),
        updatedAt: new Date().toISOString()
      });
    });
  }

  function removeTimelineItem(store, itemId) {
    updateEditDraft(store, (draft) => {
      const timelineItems = (draft.timelineItems || []).filter((item) => String(item.id) !== String(itemId));
      const removedItem = (draft.timelineItems || []).find((item) => String(item.id) === String(itemId));
      const nextItems = removedItem
        ? shiftTimelineItemsInLane(
            timelineItems,
            getTimelineLaneId(removedItem),
            Math.max(0, Number(removedItem.startSeconds || 0)) + Math.max(1, Number(removedItem.durationSeconds || 0)),
            -Math.max(1, Number(removedItem.durationSeconds || 0))
          )
        : timelineItems;
      return createEditDraft({
        ...draft,
        timelineItems: nextItems,
        selectedItemId: nextItems[0]?.id || "",
        updatedAt: new Date().toISOString()
      });
    });
  }

  function moveTimelineItemVertically(store, itemId, direction) {
    updateEditDraft(store, (draft) => {
      const activeSceneId = String(draft.activeSceneId || "").trim();
      const videoDraft = createVideoClipsDraft(store.getState().projectWorkspace?.videoClips?.draft || {});
      const activeScene = videoDraft.scenes.find((scene) => String(scene.scriptSceneId || scene.id) === activeSceneId) || null;
      const timelineItems = (draft.timelineItems || []).map((item) => {
        if (String(item.id) !== String(itemId)) {
          return item;
        }

        const currentLane = getTimelineLaneId(item);
        const nextState = { ...item };

        if (item.type === "audio") {
          if (direction === "up" && currentLane === "A2") {
            nextState.placementType = "music";
            nextState.sceneId = "";
            nextState.sceneTitle = "";
          } else if (direction === "down" && currentLane === "A1") {
            nextState.placementType = "voiceover";
            nextState.sceneId = "";
            nextState.sceneTitle = "";
          }
        } else {
          if (direction === "up" && currentLane === "V2") {
            nextState.placementType = "scene_shot";
            if (!String(nextState.sceneId || "").trim() && activeSceneId) {
              nextState.sceneId = activeSceneId;
              nextState.sceneTitle = String(activeScene?.title || "").trim();
            }
          } else if (direction === "down" && currentLane === "V1") {
            nextState.placementType = "temp";
            nextState.sceneId = "";
            nextState.sceneTitle = "";
          }
        }

        return createEditTimelineItem(nextState);
      });

      return createEditDraft({
        ...draft,
        timelineItems,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function trimTimelineItemDuration(store, itemId, direction) {
    updateEditDraft(store, (draft) => {
      const timelineItems = (draft.timelineItems || []).map((item) => {
        if (String(item.id) !== String(itemId)) {
          return item;
        }

        const currentDuration = Math.max(1, Number(item.durationSeconds || 1));
        const nextDuration = direction === "increase"
          ? currentDuration + 1
          : Math.max(1, currentDuration - 1);

        return createEditTimelineItem({
          ...item,
          durationSeconds: nextDuration
        });
      });

      return createEditDraft({
        ...draft,
        timelineItems,
        totalDurationSeconds: timelineItems.reduce((total, item) => total + Number(item.durationSeconds || 0), 0),
        updatedAt: new Date().toISOString()
      });
    });
  }

  function setTimelineItemDuration(store, itemId, durationSeconds) {
    updateEditDraft(store, (draft) => {
      const nextDuration = Math.max(1, Math.round(Number(durationSeconds || 1)));
      const sourceItem = (draft.timelineItems || []).find((item) => String(item.id) === String(itemId));
      if (!sourceItem) {
        return draft;
      }
      const previousDuration = Math.max(1, Number(sourceItem.durationSeconds || 1));
      const deltaSeconds = nextDuration - previousDuration;
      const laneId = getTimelineLaneId(sourceItem);
      const rippleFromSeconds = Math.max(0, Number(sourceItem.startSeconds || 0)) + previousDuration;
      let timelineItems = (draft.timelineItems || []).map((item, index) => {
        if (String(item.id) !== String(itemId)) {
          return createEditTimelineItem(item, index);
        }

        return createEditTimelineItem({
          ...item,
          durationSeconds: nextDuration
        }, index);
      });
      if (deltaSeconds !== 0) {
        timelineItems = shiftTimelineItemsInLane(
          timelineItems,
          laneId,
          rippleFromSeconds,
          deltaSeconds,
          itemId
        );
      }

      return createEditDraft({
        ...draft,
        timelineItems,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function placementTypeForLane(itemType, targetLaneId) {
    if (String(itemType || "").trim() === "audio") {
      return targetLaneId === "A1" ? "music" : "voiceover";
    }
    return targetLaneId === "V1" ? "scene_shot" : "temp";
  }

  function moveTimelineItemToDropTarget(store, itemId, target = {}) {
    updateEditDraft(store, (draft) => {
      const timelineItems = Array.isArray(draft.timelineItems) ? [...draft.timelineItems] : [];
      const currentIndex = timelineItems.findIndex((item) => String(item.id) === String(itemId));
      if (currentIndex < 0) {
        return draft;
      }

      const sourceItem = timelineItems[currentIndex];
      const sourceLaneId = getTimelineLaneId(sourceItem);
      const targetLaneId = String(target.trackId || getTimelineLaneId(sourceItem)).trim() || getTimelineLaneId(sourceItem);
      const targetSceneId = String(target.sceneId || "").trim();
      const targetSceneTitle = String(target.sceneTitle || "").trim();
      const beforeItemId = String(target.beforeItemId || "").trim();
      const afterItemId = String(target.afterItemId || "").trim();
      const targetStartSeconds = Math.max(0, Number(target.startSeconds || 0));

      const movedItem = createEditTimelineItem({
        ...sourceItem,
        placementType: placementTypeForLane(sourceItem.type, targetLaneId),
        trackId: targetLaneId,
        startSeconds: targetStartSeconds,
        sceneId: targetLaneId === "A1"
          ? ""
          : (targetSceneId || (targetLaneId === "V1" ? String(sourceItem.sceneId || "").trim() : String(sourceItem.sceneId || "").trim())),
        sceneTitle: targetLaneId === "A1"
          ? ""
          : (targetSceneId ? targetSceneTitle : String(sourceItem.sceneTitle || "").trim())
      });

      if (targetLaneId === "V1" && !String(movedItem.sceneId || "").trim()) {
        return draft;
      }

      timelineItems.splice(currentIndex, 1);

      let insertIndex = timelineItems.length;
      if (beforeItemId) {
        const beforeIndex = timelineItems.findIndex((item) => String(item.id) === beforeItemId);
        if (beforeIndex >= 0) {
          insertIndex = beforeIndex;
          const beforeItem = timelineItems[beforeIndex];
          movedItem.startSeconds = Math.max(0, Number(beforeItem?.startSeconds || 0));
        }
      } else if (afterItemId) {
        const afterIndex = timelineItems.findIndex((item) => String(item.id) === afterItemId);
        if (afterIndex >= 0) {
          insertIndex = afterIndex + 1;
          const afterItem = timelineItems[afterIndex];
          movedItem.startSeconds = Math.max(
            0,
            Number(afterItem?.startSeconds || 0) + Number(afterItem?.durationSeconds || 0)
          );
        }
      } else {
        const matchingIndexes = timelineItems
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => {
            const sameLane = getTimelineLaneId(item) === targetLaneId;
            if (!sameLane) {
              return false;
            }
            if (targetLaneId === "A1") {
              return true;
            }
            return String(item.sceneId || "").trim() === targetSceneId;
          })
          .map(({ index }) => index);
        if (matchingIndexes.length) {
          insertIndex = matchingIndexes[matchingIndexes.length - 1] + 1;
        }
      }

      timelineItems.splice(insertIndex, 0, movedItem);

      let finalTimelineItems = timelineItems;
      if (beforeItemId || afterItemId) {
        finalTimelineItems = rebalanceTimelineLaneByArrayOrder(finalTimelineItems, targetLaneId);
        if (sourceLaneId !== targetLaneId) {
          finalTimelineItems = finalTimelineItems.map((item, index) => createEditTimelineItem(item, index));
        }
      }

      return createEditDraft({
        ...draft,
        timelineItems: finalTimelineItems,
        selectedItemId: movedItem.id,
        activeSceneId: targetSceneId || draft.activeSceneId || "",
        updatedAt: new Date().toISOString()
      });
    });
  }

  function replaceTimelineItemFromGeneratedClip(store, itemId, generatedClip, request = null) {
    if (!generatedClip?.videoUrl) {
      return;
    }

    updateEditDraft(store, (draft) => {
      const timelineItems = (draft.timelineItems || []).map((item) => {
        if (String(item.id) !== String(itemId)) {
          return item;
        }

        return createEditTimelineItem({
          ...item,
          title: request?.title || item.title,
          videoUrl: generatedClip.videoUrl,
          thumbnailUrl: generatedClip.thumbnailUrl || generatedClip.videoUrl,
          shotRole: request?.shotRole || item.shotRole,
          clipPrompt: request?.clipPrompt || item.clipPrompt,
          shotNotes: request?.shotNotes || item.shotNotes,
          planningSource: request?.planningSource || item.planningSource,
          requestId: request?.id || item.requestId
        });
      });

      return createEditDraft({
        ...draft,
        timelineItems,
        updatedAt: new Date().toISOString()
      });
    });
  }

  function updateExportReleaseDraft(store, updater, options = {}) {
    const dirty = typeof options.dirty === "boolean" ? options.dirty : true;
    store.setState((state) => {
      const nextDraft = typeof updater === "function"
        ? updater(state.projectWorkspace.exportRelease.draft)
        : updater;
      return {
        ...state,
        projectWorkspace: {
          ...state.projectWorkspace,
          exportRelease: {
            draft: createExportReleaseDraft(nextDraft),
            dirty
          }
        }
      };
    });
  }

  function getPitchChecklist(pitchDraft) {
    const draft = createPitchDraft(pitchDraft);
    return [
      { label: "Title", complete: Boolean(draft.title) },
      { label: "Format", complete: Boolean(draft.format) },
      { label: "Logline", complete: Boolean(draft.logline) },
      { label: "Concept", complete: Boolean(draft.concept) },
      { label: "Tone / Style", complete: draft.tone.length > 0 || Boolean(draft.visualStyle) },
      { label: "Success Criteria", complete: Boolean(draft.successCriteria) }
    ];
  }

  function clearProjectWorkspace(store) {
    store.setState((state) => ({
      ...state,
      projectWorkspace: createInitialProjectWorkspace()
    }));
  }

  globalScope.CreatorAppV2ProjectWorkspace = {
    IDEA_CARD_CATEGORIES,
    inferImportedAssetKind,
    createIdeaBoardState,
    createPitchDraft,
    createScriptClip,
    createScriptScene,
    createScriptDraft,
    createStartingImageVariation,
    createStartingImageScene,
    createStartingImagesDraft,
    createGeneratedVideoClip,
    createVideoClipRequest,
    createVideoClipScene,
    createVideoClipsDraft,
    createEditMarker,
    createEditTimelineItem,
    createImportedAsset,
    createEditDraft,
    createExportRecord,
    createExportReleaseDraft,
    createInitialProjectWorkspace,
    extractPersistedWorkspace,
    serializeWorkspace,
    normalizeApiIdeaBoard,
    normalizeProjectSummary,
    serializeIdeaBoard,
    buildPitchDraftFromProject,
    buildScriptDraftFromProject,
    buildStartingImagesDraftFromScript,
    buildVideoClipsDraftFromScript,
    buildEditDraftFromVideoClips,
    buildExportReleaseDraftFromProject,
    setProjectWorkspaceLoading,
    setProjectWorkspaceError,
    updateImportedAssets,
    applyImportedAssetMetadata,
    setActiveProject,
    setTimelineProjectSaved,
    setIdeaBoardLoading,
    setIdeaBoardError,
    updateIdeaBoard,
    setIdeaBoardSaved,
    updatePitchDraft,
    applyPitchDraft,
    updateScriptDraft,
    applyScriptDraft,
    setStartingImagesLoading,
    setStartingImagesError,
    updateStartingImagesDraft,
    applyStartingImagePayload,
    setVideoClipsLoading,
    setVideoClipsError,
    updateVideoClipsDraft,
    applyVideoClipPayload,
    updateEditDraft,
    appendImportedAssetToTimeline,
    setEditActiveScene,
    setEditPlayhead,
    stepEditPlayhead,
    addEditMarkerAtPlayhead,
    assignTimelineItemToScene,
    updateTimelineItemPlacementType,
    getTimelineLaneId,
    moveTimelineItemHorizontally,
    moveTimelineItemVertically,
    duplicateTimelineItem,
    splitTimelineItem,
    removeTimelineItem,
    trimTimelineItemDuration,
    setTimelineItemDuration,
    moveTimelineItemToDropTarget,
    replaceTimelineItemFromGeneratedClip,
    updateExportReleaseDraft,
    getPitchChecklist,
    clearProjectWorkspace
  };
})(window);
