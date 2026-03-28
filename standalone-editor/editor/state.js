(function attachEditorStateModules(globalScope) {
  function createStateHelpers(deps) {
    const {
      state,
      documentRef,
      getProject,
      inferAssetKind,
      getSelectedSceneSegment,
      getSceneContext,
      getItemSegment,
      getItemDuration,
      formatDurationLabel,
      ensureVideoClipsDraft,
      normalizeTransition,
      setNotice,
      autosaveProjects
    } = deps;

    function ensureTrack(project, type) {
      const prefix = type === "audio" ? "audio" : "video";
      let track = project.timeline.tracks.find((entry) => entry.id.startsWith(prefix));
      if (!track) {
        const count = project.timeline.tracks.filter((entry) => entry.id.startsWith(prefix)).length + 1;
        track = {
          id: `${prefix}-${count}`,
          label: type === "audio" ? `A${count}` : `V${count}`,
          items: []
        };
        if (type === "audio") {
          project.timeline.tracks.push(track);
        } else {
          project.timeline.tracks.unshift(track);
        }
      }
      return track;
    }

    function estimateWidth(asset, project) {
      const duration = project.timeline.duration || 30;
      const seconds = asset.durationSeconds || getItemDuration(asset);
      const width = Math.max(12, Math.min(78, (seconds / duration) * 100));
      return `${width}%`;
    }

    function loadImportedAssetMetadata(asset) {
      if (!asset.sourceUrl || asset.kind === "image") {
        return Promise.resolve({
          ...asset,
          durationSeconds: asset.durationSeconds || 3,
          meta: asset.meta || "imported image"
        });
      }

      return new Promise((resolve) => {
        const element = documentRef.createElement(asset.kind === "audio" ? "audio" : "video");
        let settled = false;

        const finish = (updates) => {
          if (settled) {
            return;
          }
          settled = true;
          element.src = "";
          resolve({
            ...asset,
            ...updates
          });
        };

        element.preload = "metadata";
        element.src = asset.sourceUrl;
        element.onloadedmetadata = () => {
          const seconds = Number.isFinite(element.duration) && element.duration > 0 ? element.duration : 5;
          finish({
            durationSeconds: seconds,
            meta: formatDurationLabel(seconds, asset.kind === "audio" ? "imported audio" : "imported video")
          });
        };
        element.onerror = () => {
          finish({
            durationSeconds: asset.durationSeconds || 5,
            meta: asset.meta || (asset.kind === "audio" ? "imported audio" : "imported video")
          });
        };
      });
    }

    async function importAssetsIntoProject(files) {
      const project = getProject();
      if (!project) {
        throw new Error("No active project is available.");
      }
      const pendingAssets = files.map((file, index) => {
        const kind = inferAssetKind(file.extension);
        return {
          id: `asset-import-${Date.now()}-${index}`,
          name: file.fileName.replace(/\.[^.]+$/, ""),
          kind,
          meta: kind === "audio" ? "imported audio" : kind === "image" ? "imported image" : "imported video",
          sourcePath: file.filePath,
          sourceUrl: file.fileUrl,
          sizeBytes: file.sizeBytes,
          durationSeconds: kind === "image" ? 3 : 5
        };
      });
      const imported = await Promise.all(pendingAssets.map((asset) => loadImportedAssetMetadata(asset)));

      project.assets.push(...imported);
      project.clipCount = project.assets.length;
      state.selectedAssetId = imported[0]?.id || state.selectedAssetId;
      state.selectedTimelineItemId = "";
      return imported;
    }

    function createTimelineClipFromAsset(asset, project, scriptSceneId = "", generatedFromSceneClipId = "") {
      return {
        id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        name: asset.name,
        kind: asset.kind === "image" ? "title" : asset.kind,
        width: estimateWidth(asset, project),
        sourceIn: "00:00:00",
        sourceOut: formatDurationLabel(asset.durationSeconds, asset.meta || "--"),
        sourceUrl: asset.sourceUrl || "",
        durationSeconds: asset.durationSeconds || getItemDuration(asset),
        volume: asset.kind === "audio" ? 80 : asset.kind === "video" ? 100 : 0,
        transition: normalizeTransition({ type: "cut", duration: 0.4 }),
        isBridge: Boolean(asset.bridge),
        bridgePrompt: asset.bridge?.prompt || "",
        scriptSceneId: scriptSceneId || asset.generatedFromSceneId || "",
        generatedFromSceneClipId: generatedFromSceneClipId || asset.generatedFromSceneClipId || "",
        generatedClipId: asset.generatedClipId || ""
      };
    }

    function findSceneInsertIndex(track, scriptSceneId) {
      if (!track || !Array.isArray(track.items) || !scriptSceneId) {
        return Array.isArray(track?.items) ? track.items.length : 0;
      }

      let lastMatchIndex = -1;
      track.items.forEach((item, index) => {
        if (item.scriptSceneId === scriptSceneId) {
          lastMatchIndex = index;
        }
      });
      return lastMatchIndex >= 0 ? lastMatchIndex + 1 : track.items.length;
    }

    function recalculateTimelineDuration(project) {
      if (!project?.timeline?.tracks) {
        return 0;
      }

      project.timeline.duration = Math.max(
        project.timeline.duration || 0,
        ...project.timeline.tracks.map((entry) => entry.items.reduce((total, item) => total + getItemDuration(item), 0))
      );
      return project.timeline.duration;
    }

    function appendAssetToTrack(project, asset, track, options = {}) {
      if (!project || !asset || !track) {
        return null;
      }

      const scriptSceneId = options.scriptSceneId || "";
      const generatedFromSceneClipId = options.generatedFromSceneClipId || "";
      const clip = createTimelineClipFromAsset(asset, project, scriptSceneId, generatedFromSceneClipId);
      const insertIndex = String(track.id || "").startsWith("video")
        ? findSceneInsertIndex(track, clip.scriptSceneId)
        : track.items.length;
      track.items.splice(insertIndex, 0, clip);
      recalculateTimelineDuration(project);
      state.selectedTimelineItemId = clip.id;
      return clip;
    }

    function replaceTimelineClipForScene(project, scriptSceneId, asset, generatedFromSceneClipId = "") {
      if (!project || !scriptSceneId || !asset) {
        return null;
      }

      const videoTracks = Array.isArray(project?.timeline?.tracks)
        ? project.timeline.tracks.filter((track) => String(track.id || "").startsWith("video"))
        : [];

      for (const track of videoTracks) {
        const item = Array.isArray(track.items)
          ? track.items.find((entry) =>
            generatedFromSceneClipId
              ? entry.generatedFromSceneClipId === generatedFromSceneClipId
              : entry.scriptSceneId === scriptSceneId
          )
          : null;
        if (!item) {
          continue;
        }

        item.name = asset.name;
        item.kind = asset.kind === "image" ? "title" : asset.kind;
        item.width = estimateWidth(asset, project);
        item.sourceOut = formatDurationLabel(asset.durationSeconds, asset.meta || "--");
        item.sourceUrl = asset.sourceUrl || "";
        item.durationSeconds = asset.durationSeconds || getItemDuration(asset);
        item.volume = asset.kind === "audio" ? 80 : asset.kind === "video" ? 100 : 0;
        item.scriptSceneId = asset.generatedFromSceneId || scriptSceneId;
        item.generatedFromSceneClipId = asset.generatedFromSceneClipId || generatedFromSceneClipId || "";
        item.generatedClipId = asset.generatedClipId || "";
        state.selectedTimelineItemId = item.id;
        return item;
      }

      return null;
    }

    function addSelectedAssetToTimeline() {
      const project = getProject();
      if (!project) {
        setNotice("No active project is available.", "error");
        return;
      }
      const asset = project.assets.find((entry) => entry.id === state.selectedAssetId);

      if (!asset) {
        setNotice("Select an asset first", "error");
        return;
      }

      const trackType = asset.kind === "audio" ? "audio" : "video";
      const track = ensureTrack(project, trackType);
      const selectedScene = getSelectedSceneSegment(project);
      const scriptSceneId = trackType === "video"
        ? selectedScene?.context?.scriptSceneId || asset.generatedFromSceneId || ""
        : "";
      const clip = appendAssetToTrack(project, asset, track, { scriptSceneId });
      if (!clip) {
        setNotice(`Could not add ${asset.name} to ${track.label}`, "error");
        return;
      }
      setNotice(`Added ${asset.name} to ${track.label}`, "success");
      autosaveProjects();
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

    function buildNextShotFromClip(project, item) {
      const context = getSceneContext(project, item?.scriptSceneId || "") || {};
      const neighbors = getTimelineNeighbors(project, item?.id);
      return {
        id: `next-shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: "Generate Next Shot",
        shotType: "continuation",
        status: "suggested",
        prompt: `Generate the next shot after "${item?.name || "current clip"}". Continue the scene "${context.title || "Scene"}" with matching characters, location, lighting, and camera language. Previous shot duration: ${getItemDuration(item).toFixed(1)}s. ${neighbors.next ? `This should lead into "${neighbors.next.name}".` : "This should extend the current story beat forward."} Scene intent: ${context.intent || context.summary || "continue the scene naturally"}.`
      };
    }

    function buildCutawayFromClip(project, item) {
      const context = getSceneContext(project, item?.scriptSceneId || "") || {};
      return {
        id: `cutaway-shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: "Generate Cutaway",
        shotType: "cutaway",
        status: "suggested",
        prompt: `Generate a cutaway for "${context.title || item?.name || "current scene"}". Show environment or detail coverage that supports the scene objective "${context.intent || context.summary || "current beat"}", preserves location "${context.location || "current location"}", and matches the mood "${Array.isArray(context.mood) ? context.mood.join(", ") : context.mood || "cinematic"}".`
      };
    }

    function buildExtensionFromClip(project, item) {
      const context = getSceneContext(project, item?.scriptSceneId || "") || {};
      return {
        id: `extend-shot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: "Extend Scene",
        shotType: "extension",
        status: "suggested",
        prompt: `Extend the shot "${item?.name || "current clip"}" by continuing the same scene action. Preserve character appearance, motion direction, lighting, and location. Scene: "${context.title || "Scene"}". Objective: ${context.intent || context.summary || "continue the beat"}.`
      };
    }

    return {
      ensureTrack,
      estimateWidth,
      loadImportedAssetMetadata,
      importAssetsIntoProject,
      addSelectedAssetToTimeline,
      createTimelineClipFromAsset,
      findSceneInsertIndex,
      recalculateTimelineDuration,
      appendAssetToTrack,
      replaceTimelineClipForScene,
      ensureVideoClipSceneForScriptScene,
      appendPlannedShots,
      getTimelineNeighbors,
      buildNextShotFromClip,
      buildCutawayFromClip,
      buildExtensionFromClip
    };
  }

  globalScope.EditorStateModules = globalScope.EditorStateModules || {};
  globalScope.EditorStateModules.createEditorStateHelpers = createStateHelpers;
})(window);
