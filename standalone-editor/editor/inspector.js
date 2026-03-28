(function attachEditorInspectorModules(globalScope) {
  function createInspectorHelpers(deps) {
    const {
      state,
      getBoardCardsByCategory,
      deriveSceneDialogue,
      getItemDuration,
      ensureVideoClipsDraft,
      setProjectStage,
      setNotice,
      getItemSegment
    } = deps;

    function getSceneContext(project, scriptSceneId) {
      if (!project || !scriptSceneId) {
        return null;
      }

      const scriptScene = project?.script?.scenes?.find((scene) => scene.id === scriptSceneId) || null;
      const startingScene = project?.startingImages?.scenes?.find((scene) => scene.scriptSceneId === scriptSceneId) || null;
      const videoScene = project?.videoClips?.scenes?.find((scene) => scene.scriptSceneId === scriptSceneId) || null;
      const projectMood = Array.isArray(project?.projectPitch?.tone) ? project.projectPitch.tone.filter(Boolean) : [];
      const locationCards = getBoardCardsByCategory(project, "location");
      const characterCards = getBoardCardsByCategory(project, "character");

      return {
        scriptSceneId,
        title: scriptScene?.title || videoScene?.title || startingScene?.title || "Untitled Scene",
        summary: scriptScene?.summary || videoScene?.clipPrompt || "",
        slug: scriptScene?.slug || "",
        dialogue: deriveSceneDialogue(scriptScene) || scriptScene?.dialogue || "",
        clipPrompt: videoScene?.clipPrompt || scriptScene?.clipPrompt || "",
        notes: videoScene?.shotNotes || startingScene?.shotNotes || "",
        mood: Array.isArray(scriptScene?.mood) && scriptScene.mood.length ? scriptScene.mood : projectMood,
        location: scriptScene?.location || locationCards[0]?.title || "",
        characters: Array.isArray(scriptScene?.characters) && scriptScene.characters.length
          ? scriptScene.characters
          : characterCards.map((card) => card.title).filter(Boolean),
        timeOfDay: scriptScene?.timeOfDay || scriptScene?.slug || "",
        intent: scriptScene?.objective || scriptScene?.summary || videoScene?.clipPrompt || "",
        objective: scriptScene?.objective || "",
        cameraStyle: scriptScene?.cameraStyle || "",
        visualReferences: scriptScene?.visualReferences || "",
        status: videoScene?.status || startingScene?.status || "draft"
      };
    }

    function getAdjacentSceneContexts(project, scriptSceneId) {
      const scenes = Array.isArray(project?.script?.scenes) ? project.script.scenes : [];
      const index = scenes.findIndex((scene) => scene.id === scriptSceneId);
      return {
        previous: index > 0 ? getSceneContext(project, scenes[index - 1].id) : null,
        next: index >= 0 && index < scenes.length - 1 ? getSceneContext(project, scenes[index + 1].id) : null
      };
    }

    function getSceneCompleteness(context) {
      if (!context) {
        return { score: 0, checks: [] };
      }

      const checks = [
        { label: "Location", complete: Boolean(context.location) },
        { label: "Characters", complete: Array.isArray(context.characters) && context.characters.length > 0 },
        { label: "Scene prompt", complete: Boolean(context.clipPrompt) },
        { label: "Mood", complete: Array.isArray(context.mood) ? context.mood.length > 0 : Boolean(context.mood) },
        { label: "Camera style", complete: Boolean(context.cameraStyle) },
        { label: "Visual references", complete: Boolean(context.visualReferences) }
      ];
      const score = Math.round((checks.filter((item) => item.complete).length / Math.max(1, checks.length)) * 100);
      return { score, checks };
    }

    function getTimelineSceneSegments(project) {
      const track = project?.timeline?.tracks?.find((entry) => String(entry.id || "").startsWith("video"));
      if (!track) {
        return [];
      }

      const segments = [];
      let cursor = 0;
      let current = null;
      for (const item of track.items || []) {
        const duration = getItemDuration(item);
        const sceneKey = item.scriptSceneId || `timeline-${item.id}`;
        if (!current || current.sceneKey !== sceneKey) {
          if (current) {
            segments.push(current);
          }
          const context = getSceneContext(project, item.scriptSceneId);
          current = {
            id: `scene-segment-${sceneKey}-${Math.round(cursor * 1000)}`,
            sceneKey,
            start: cursor,
            end: cursor + duration,
            context: context || {
              scriptSceneId: "",
              title: item.name || "Timeline Scene",
              summary: "",
              slug: "",
              dialogue: "",
              clipPrompt: "",
              notes: "",
              mood: [],
              location: "",
              characters: [],
              timeOfDay: "",
              intent: "",
              status: "draft"
            }
          };
        } else {
          current.end += duration;
        }
        cursor += duration;
      }

      if (current) {
        segments.push(current);
      }

      return segments;
    }

    function getSelectedSceneSegment(project) {
      if (!state.selectedSceneSegmentId) {
        return null;
      }

      return getTimelineSceneSegments(project).find((segment) => segment.id === state.selectedSceneSegmentId) || null;
    }

    function getSceneScriptSceneIdAtSeconds(project, seconds) {
      const segment = getTimelineSceneSegments(project).find((entry) => seconds >= entry.start && seconds < entry.end);
      return segment?.context?.scriptSceneId || "";
    }

    function bindSceneSegmentToScriptScene(project, segment, scriptSceneId) {
      if (!project || !segment || !scriptSceneId) {
        return false;
      }

      const videoTrack = project?.timeline?.tracks?.find((entry) => String(entry.id || "").startsWith("video"));
      if (!videoTrack || !Array.isArray(videoTrack.items)) {
        return false;
      }

      let cursor = 0;
      let updated = false;
      for (const item of videoTrack.items) {
        const duration = getItemDuration(item);
        const start = cursor;
        const end = cursor + duration;
        if (start >= segment.start && end <= segment.end) {
          item.scriptSceneId = scriptSceneId;
          updated = true;
        }
        cursor = end;
      }

      return updated;
    }

    function buildPlannedShotsForScene(sceneContext) {
      const title = sceneContext?.title || "Scene";
      const summary = sceneContext?.summary || sceneContext?.intent || "Story beat";
      const location = sceneContext?.location || "the scene location";
      const mood = Array.isArray(sceneContext?.mood) ? sceneContext.mood.filter(Boolean).join(", ") : sceneContext?.mood || "";
      const characters = Array.isArray(sceneContext?.characters) ? sceneContext.characters.filter(Boolean).join(", ") : [];
      const characterText = characters.length ? characters.join(", ") : "the scene characters";
      const objective = sceneContext?.intent || summary;

      return [
        {
          title: "Establishing Shot",
          shotType: "wide",
          prompt: `Wide establishing shot of ${location} for ${title}. Show ${characterText} in the environment and set the mood: ${mood || "cinematic"}.\nStory beat: ${summary}`
        },
        {
          title: "Primary Action Shot",
          shotType: "medium",
          prompt: `Medium shot focused on ${characterText}. Capture the main action of the scene and the intent: ${objective}. Keep continuity with ${location}.`
        },
        {
          title: "Emotional Close-up",
          shotType: "close_up",
          prompt: `Close-up reaction shot for ${characterText}. Emphasize the emotional beat of the scene with mood ${mood || "dramatic"}.\nScene objective: ${objective}`
        },
        {
          title: "Transition / Cutaway",
          shotType: "cutaway",
          prompt: `Cutaway or transition shot within ${location} that can bridge this scene into the next beat. Preserve the tone and visual continuity from ${title}.`
        }
      ].map((shot, index) => ({
        id: `planned-shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${index}`,
        title: shot.title,
        prompt: shot.prompt,
        shotType: shot.shotType,
        status: "planned"
      }));
    }

    function buildSceneCoverageSuggestions(sceneContext) {
      const title = sceneContext?.title || "Scene";
      const location = sceneContext?.location || "the current location";
      const mood = Array.isArray(sceneContext?.mood) ? sceneContext.mood.filter(Boolean).join(", ") : sceneContext?.mood || "cinematic";
      const characters = Array.isArray(sceneContext?.characters) ? sceneContext.characters.filter(Boolean).join(", ") : [];
      const characterText = characters.length ? characters.join(", ") : "the scene characters";

      return [
        {
          title: "Reaction Close-up",
          shotType: "reaction",
          prompt: `Reaction close-up within ${title}. Capture the emotional response of ${characterText} with ${mood} tone and preserve continuity with ${location}.`
        },
        {
          title: "Environment Cutaway",
          shotType: "cutaway",
          prompt: `Environment cutaway for ${title}. Show details of ${location} that reinforce the scene mood: ${mood}.`
        },
        {
          title: "Insert Detail",
          shotType: "insert",
          prompt: `Insert detail shot inside ${title}. Focus on hands, props, or a small object that supports the story beat and keeps visual continuity with ${location}.`
        }
      ].map((shot, index) => ({
        id: `coverage-shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${index}`,
        title: shot.title,
        prompt: shot.prompt,
        shotType: shot.shotType,
        status: "suggested"
      }));
    }

    function buildEntireSceneShotPlan(sceneContext) {
      const baseShots = buildPlannedShotsForScene(sceneContext);
      const title = sceneContext?.title || "Scene";
      const objective = sceneContext?.intent || sceneContext?.summary || "the scene objective";

      return [
        ...baseShots,
        {
          id: `coverage-shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-dialogue`,
          title: "Dialogue / Performance Shot",
          prompt: `Performance-driven dialogue shot for ${title}. Preserve the scene objective: ${objective}. Prioritize clear eyelines, emotional readability, and continuity with the prior shot.`,
          shotType: "dialogue",
          status: "suggested"
        },
        {
          id: `coverage-shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-transition`,
          title: "Scene Exit Transition",
          prompt: `Transition shot that cleanly exits ${title} and prepares the next scene. Maintain continuity of lighting, camera language, and emotional tone.`,
          shotType: "transition",
          status: "suggested"
        }
      ];
    }

    function ensureVideoClipSceneForScriptScene(project, scriptSceneId) {
      if (!project || !scriptSceneId) {
        return null;
      }

      ensureVideoClipsDraft(project);
      return project.videoClips.scenes.find((scene) => scene.scriptSceneId === scriptSceneId || scene.id === scriptSceneId) || null;
    }

    function appendPlannedShots(scene, shots = []) {
      if (!scene || !Array.isArray(shots) || !shots.length) {
        return [];
      }

      scene.plannedShots = Array.isArray(scene.plannedShots) ? scene.plannedShots : [];
      const existingKeys = new Set(
        scene.plannedShots.map((shot) => `${String(shot.title || "").trim().toLowerCase()}|${String(shot.prompt || "").trim().toLowerCase()}`)
      );
      const added = [];

      for (const shot of shots) {
        const key = `${String(shot.title || "").trim().toLowerCase()}|${String(shot.prompt || "").trim().toLowerCase()}`;
        if (existingKeys.has(key)) {
          continue;
        }
        scene.plannedShots.push(shot);
        existingKeys.add(key);
        added.push(shot);
      }

      return added;
    }

    function routeSceneShotsToVideoClips(project, scriptSceneId, shots, noticeLabel) {
      const scene = ensureVideoClipSceneForScriptScene(project, scriptSceneId);
      if (!scene) {
        return { scene: null, added: [] };
      }

      const added = appendPlannedShots(scene, shots);
      if (added[0]?.prompt) {
        scene.clipPrompt = scene.clipPrompt || added[0].prompt;
      }
      if (!scene.shotNotes && added.length) {
        scene.shotNotes = added.map((shot) => shot.title).join(" -> ");
      }
      scene.updatedAt = new Date().toISOString();
      project.videoClips.updatedAt = scene.updatedAt;
      state.selectedVideoClipSceneId = scene.id;
      setProjectStage(project, "video_clips");
      state.currentView = "editor";
      if (noticeLabel) {
        setNotice(`${noticeLabel} for ${scene.title}`, "success");
      }
      return { scene, added };
    }

    function getContinuityWarnings(project, selection) {
      if (!project || !selection) {
        return [];
      }

      if (selection.kind === "scene") {
        const warnings = [];
        if (!selection.sceneLocation || selection.sceneLocation === "Not set") {
          warnings.push("Location is missing from the scene context.");
        }
        if (!selection.sceneCharacters || !String(selection.sceneCharacters).trim()) {
          warnings.push("No characters are linked to this scene.");
        }
        if (!selection.sceneClipPrompt || !String(selection.sceneClipPrompt).trim()) {
          warnings.push("This scene does not have a clip prompt yet.");
        }
        if (!selection.sceneMood || !String(selection.sceneMood).trim()) {
          warnings.push("Mood and tone are not defined for this scene.");
        }
        return warnings;
      }

      const warnings = [];
      if (!selection.scriptSceneId) {
        warnings.push("This clip is not linked to a scene block.");
        return warnings;
      }

      const context = getSceneContext(project, selection.scriptSceneId);
      if (!context?.location) {
        warnings.push("Scene location is missing, which weakens continuity-aware generation.");
      }
      if (!Array.isArray(context?.characters) || !context.characters.length) {
        warnings.push("No characters are linked to this clip's scene.");
      }
      const { previous, next } = getTimelineNeighbors(project, selection.id);
      if (previous && previous.scriptSceneId && previous.scriptSceneId !== selection.scriptSceneId && !selection.isBridge) {
        warnings.push("This clip follows a different scene without a bridge or explicit transition context.");
      }
      if (next && next.scriptSceneId && next.scriptSceneId !== selection.scriptSceneId && !selection.isBridge) {
        warnings.push("This clip cuts into another scene; consider a bridge or cutaway.");
      }
      return warnings;
    }

    function getTimelineNeighbors(project, itemId) {
      const segment = getItemSegment(project, itemId);
      if (!segment?.track) {
        return { segment: null, previous: null, next: null };
      }
      const index = segment.track.items.findIndex((item) => item.id === itemId);
      return {
        segment,
        previous: index > 0 ? segment.track.items[index - 1] : null,
        next: index >= 0 ? segment.track.items[index + 1] : null
      };
    }

    function generateShotsForScene(project, scriptSceneId) {
      if (!project || !scriptSceneId) {
        return null;
      }

      ensureVideoClipsDraft(project);
      const videoScene = project.videoClips.scenes.find((scene) => scene.scriptSceneId === scriptSceneId || scene.id === scriptSceneId);
      if (!videoScene) {
        return null;
      }

      const context = getSceneContext(project, videoScene.scriptSceneId || scriptSceneId) || {
        title: videoScene.title,
        summary: "",
        intent: videoScene.clipPrompt,
        location: "",
        mood: [],
        characters: []
      };

      const plannedShots = buildPlannedShotsForScene(context);
      videoScene.plannedShots = plannedShots;
      if (!videoScene.clipPrompt && plannedShots[0]?.prompt) {
        videoScene.clipPrompt = plannedShots[0].prompt;
      }
      if (!videoScene.shotNotes && plannedShots.length) {
        videoScene.shotNotes = plannedShots.map((shot) => shot.title).join(" -> ");
      }
      videoScene.updatedAt = new Date().toISOString();
      project.videoClips.updatedAt = videoScene.updatedAt;
      state.selectedVideoClipSceneId = videoScene.id;
      return plannedShots;
    }

    return {
      getSceneContext,
      getAdjacentSceneContexts,
      getSceneCompleteness,
      getTimelineSceneSegments,
      getSelectedSceneSegment,
      getSceneScriptSceneIdAtSeconds,
      bindSceneSegmentToScriptScene,
      buildPlannedShotsForScene,
      buildSceneCoverageSuggestions,
      buildEntireSceneShotPlan,
      routeSceneShotsToVideoClips,
      getContinuityWarnings,
      generateShotsForScene
    };
  }

  globalScope.EditorInspectorModules = {
    createInspectorHelpers
  };
})(window);
