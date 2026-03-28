(function attachEditorActionModules(globalScope) {
  function createActionHelpers(deps) {
    const {
      state,
      playbackView,
      getProject,
      setProjectStage,
      ensureVideoClipsDraft,
      ensureTrack,
      appendAssetToTrack,
      replaceTimelineClipForScene,
      createTimelineClipFromAsset,
      recalculateTimelineDuration,
      getSelectedSceneSegment,
      getSceneScriptSceneIdAtSeconds,
      getTimelinePixelsPerSecond,
      getProjectDuration,
      getItemDuration,
      getSelectedTimelineItemContext,
      getTimelineItemContextById,
      getItemSegment,
      getActiveSegment,
      syncCurrentProjectTimecode,
      normalizeTransition,
      normalizeProjectShape,
      editorShell
    } = deps;

    function syncApprovedGeneratedClipIntoTimeline(project, sceneId, requestId = "") {
      ensureVideoClipsDraft(project);
      const scene = project?.videoClips?.scenes?.find((entry) => entry.id === sceneId);
      const request = scene?.clips?.find((entry) => entry.id === requestId) || scene?.clips?.[0];
      if (!scene || !request) {
        return null;
      }

      const preferredClip = Array.isArray(request.generatedClips)
        ? request.generatedClips.find((entry) => entry.id === request.approvedClipId) || request.generatedClips[0]
        : null;
      if (!preferredClip) {
        return null;
      }

      const asset = (project.assets || []).find((entry) => entry.id === preferredClip.assetId)
        || (project.assets || []).find((entry) => entry.kind === "video" && entry.sourceUrl === preferredClip.videoUrl);
      if (!asset) {
        return null;
      }

      return replaceTimelineClipForScene(project, scene.scriptSceneId || scene.id, asset, request.id);
    }

    function buildRoughCutFromGeneratedClips(project) {
      if (!project) {
        return { added: 0 };
      }

      ensureVideoClipsDraft(project);
      const videoTrack = ensureTrack(project, "video");
      videoTrack.items = [];

      let added = 0;
      for (const scene of project.videoClips.scenes || []) {
        for (const request of scene.clips || []) {
          const preferredClip = Array.isArray(request.generatedClips)
            ? request.generatedClips.find((entry) => entry.id === request.approvedClipId) || request.generatedClips[0]
            : null;
          if (!preferredClip) {
            continue;
          }

          let asset = (project.assets || []).find((entry) => entry.id === preferredClip.assetId);
          if (!asset && preferredClip.videoUrl) {
            asset = (project.assets || []).find((entry) => entry.kind === "video" && entry.sourceUrl === preferredClip.videoUrl);
          }
          if (!asset) {
            continue;
          }

          appendAssetToTrack(project, asset, videoTrack, { scriptSceneId: scene.scriptSceneId || scene.id, generatedFromSceneClipId: request.id });
          added += 1;
        }
      }

      setProjectStage(project, "edit");
      state.currentView = "editor";
      return { added };
    }

    function sendGeneratedClipToEdit(project, sceneId, requestId, clipId) {
      if (!project) {
        return null;
      }

      ensureVideoClipsDraft(project);
      const scene = project.videoClips.scenes.find((entry) => entry.id === sceneId);
      const request = scene?.clips?.find((entry) => entry.id === requestId);
      const generatedClip = request?.generatedClips?.find((entry) => entry.id === clipId);
      if (!generatedClip) {
        return null;
      }

      const asset = (project.assets || []).find((entry) => entry.id === generatedClip.assetId)
        || (project.assets || []).find((entry) => entry.kind === "video" && entry.sourceUrl === generatedClip.videoUrl);
      if (!asset) {
        return null;
      }

      const track = ensureTrack(project, "video");
      const clip = appendAssetToTrack(project, asset, track, { scriptSceneId: scene.scriptSceneId || scene.id, generatedFromSceneClipId: request.id });
      setProjectStage(project, "edit");
      state.currentView = "editor";
      return clip;
    }

    function timelineHasContent(project) {
      return Boolean(project?.timeline?.tracks?.some((track) => Array.isArray(track.items) && track.items.length > 0));
    }

    function availableGeneratedClipCount(project) {
      ensureVideoClipsDraft(project);
      return (project?.videoClips?.scenes || []).reduce((total, scene) =>
        total + (scene.clips || []).reduce((clipTotal, clip) => clipTotal + (Array.isArray(clip.generatedClips) ? clip.generatedClips.length : 0), 0),
      0);
    }

    function videoClipRequestHasPreferredClip(clipRequest) {
      if (!clipRequest || !Array.isArray(clipRequest.generatedClips) || !clipRequest.generatedClips.length) {
        return false;
      }

      if (clipRequest.approvedClipId) {
        return clipRequest.generatedClips.some((entry) => entry.id === clipRequest.approvedClipId);
      }

      return Boolean(clipRequest.generatedClips[0]);
    }

    function getVideoClipCompletion(project) {
      ensureVideoClipsDraft(project);
      const scenes = Array.isArray(project?.videoClips?.scenes) ? project.videoClips.scenes : [];
      const targetClipRequests = scenes.flatMap((scene) =>
        Boolean(scene.startingImageUrl)
          ? (scene.clips || []).filter((clip) => Boolean(String(clip.clipPrompt || "").trim())).map((clip) => ({ scene, clip }))
          : []
      );
      const selectedClipRequests = targetClipRequests.filter((entry) => videoClipRequestHasPreferredClip(entry.clip));

      return {
        totalScenes: scenes.length,
        targetScenes: scenes.filter((scene) => Boolean(scene.startingImageUrl)).length,
        targetClipRequests: targetClipRequests.length,
        selectedClipRequests: selectedClipRequests.length,
        readyToCut: targetClipRequests.length > 0 && selectedClipRequests.length === targetClipRequests.length
      };
    }

    function openBridgeClipModal(trackId, beforeItemId, afterItemId) {
      state.bridgeClipModal = {
        open: true,
        trackId: trackId || "",
        beforeItemId: beforeItemId || "",
        afterItemId: afterItemId || "",
        prompt: "",
        durationSeconds: 2,
        status: "",
        error: ""
      };
    }

    function closeBridgeClipModal() {
      state.bridgeClipModal = {
        open: false,
        trackId: "",
        beforeItemId: "",
        afterItemId: "",
        prompt: "",
        durationSeconds: 2,
        status: "",
        error: ""
      };
    }

    function getBridgeContext(project) {
      const modal = state.bridgeClipModal;
      if (!project || !modal.trackId || !modal.beforeItemId || !modal.afterItemId) {
        return null;
      }
      const track = project.timeline?.tracks?.find((entry) => entry.id === modal.trackId);
      const beforeItem = track?.items?.find((entry) => entry.id === modal.beforeItemId) || null;
      const afterItem = track?.items?.find((entry) => entry.id === modal.afterItemId) || null;
      if (!track || !beforeItem || !afterItem) {
        return null;
      }
      return { track, beforeItem, afterItem };
    }

    async function createBridgeClip(project) {
      const context = getBridgeContext(project);
      if (!context) {
        throw new Error("Bridge clip context could not be found.");
      }

      const prompt = state.bridgeClipModal.prompt.trim();
      if (!prompt) {
        throw new Error("A bridge prompt is required.");
      }

      const result = await editorShell.generateBridgeClip({
        beforeItem: context.beforeItem,
        afterItem: context.afterItem,
        durationSeconds: Number(state.bridgeClipModal.durationSeconds || 2),
        fps: project?.fps || project?.timeline?.fps || 24,
        prompt,
        name: `Bridge ${context.beforeItem.name} to ${context.afterItem.name}`
      });

      const asset = normalizeProjectShape({
        id: "temp",
        assets: [result.asset],
        timeline: { tracks: [], markers: [], duration: 0 }
      }).assets[0];
      asset.reviewStatus = "generated";
      asset.generated = true;
      asset.tags = Array.isArray(asset.tags) ? asset.tags : [];
      if (!asset.tags.includes("bridge")) {
        asset.tags.push("bridge");
      }
      if (prompt && !asset.tags.includes(prompt)) {
        asset.bridgePrompt = prompt;
      }

      project.assets = Array.isArray(project.assets) ? project.assets : [];
      project.assets.unshift(asset);
      project.clipCount = project.assets.length;

      const beforeIndex = context.track.items.findIndex((entry) => entry.id === context.beforeItem.id);
      const clip = createTimelineClipFromAsset(asset, project);
      clip.isBridge = true;
      clip.bridgePrompt = prompt;
      context.track.items.splice(beforeIndex + 1, 0, clip);
      project.timeline.duration = Math.max(
        project.timeline.duration || 0,
        ...project.timeline.tracks.map((track) => track.items.reduce((total, item) => total + getItemDuration(item), 0))
      );
      state.selectedAssetId = asset.id;
      state.selectedTimelineItemId = clip.id;
      return { asset, clip };
    }

    function addAssetToTimelineAtPosition(project, assetId, targetTrackId, dropSeconds = 0) {
      if (!project) {
        return null;
      }

      const asset = project.assets.find((entry) => entry.id === assetId);
      const targetTrack = project.timeline?.tracks?.find((track) => track.id === targetTrackId);
      if (!asset || !targetTrack) {
        return null;
      }

      const assetTrackPrefix = asset.kind === "audio" ? "audio" : "video";
      const targetTrackPrefix = targetTrack.id.startsWith("audio") ? "audio" : "video";
      if (assetTrackPrefix !== targetTrackPrefix) {
        return null;
      }

      const selectedScene = getSelectedSceneSegment(project);
      const scriptSceneId = assetTrackPrefix === "video"
        ? selectedScene?.context?.scriptSceneId || getSceneScriptSceneIdAtSeconds(project, dropSeconds) || asset.generatedFromSceneId || ""
        : "";
      const clip = createTimelineClipFromAsset(asset, project, scriptSceneId);

      let insertIndex = 0;
      let cursor = 0;
      for (const existing of targetTrack.items) {
        const duration = getItemDuration(existing);
        const midpoint = cursor + duration / 2;
        if (dropSeconds >= midpoint) {
          insertIndex += 1;
        }
        cursor += duration;
      }

      targetTrack.items.splice(insertIndex, 0, clip);
      recalculateTimelineDuration(project);
      state.selectedTimelineItemId = clip.id;
      return { clip, targetTrack, insertIndex };
    }

    function adjustTimelineZoom(project, direction) {
      if (!project?.timeline) {
        return;
      }

      const levels = [14, 18, 24, 28, 36, 48, 64];
      const current = getTimelinePixelsPerSecond(project);
      const currentIndex = Math.max(0, levels.findIndex((level) => level >= current));
      const nextIndex =
        direction === "in"
          ? Math.min(levels.length - 1, currentIndex + 1)
          : Math.max(0, currentIndex - 1);
      project.timeline.zoom = levels[nextIndex];
    }

    function addTimelineMarker(project) {
      if (!project?.timeline) {
        return null;
      }

      const marker = {
        id: `marker-${Date.now()}`,
        seconds: Number(state.currentSeconds.toFixed(2)),
        label: `M${(project.timeline.markers?.length || 0) + 1}`
      };
      project.timeline.markers = Array.isArray(project.timeline.markers) ? project.timeline.markers : [];
      project.timeline.markers.push(marker);
      project.timeline.markers.sort((a, b) => a.seconds - b.seconds);
      return marker;
    }

    function moveSelectedClipInTrack(project, direction) {
      const context = getSelectedTimelineItemContext(project);
      if (!context) {
        return null;
      }

      const nextIndex =
        direction === "left"
          ? Math.max(0, context.itemIndex - 1)
          : Math.min(context.track.items.length - 1, context.itemIndex + 1);

      if (nextIndex === context.itemIndex) {
        return null;
      }

      const [item] = context.track.items.splice(context.itemIndex, 1);
      context.track.items.splice(nextIndex, 0, item);
      return item;
    }

    function moveSelectedClipAcrossTracks(project, direction) {
      const context = getSelectedTimelineItemContext(project);
      if (!context) {
        return null;
      }

      const trackPrefix = context.track.id.startsWith("audio") ? "audio" : "video";
      const compatibleTracks = project.timeline.tracks.filter((track) => track.id.startsWith(trackPrefix));
      const currentCompatibleIndex = compatibleTracks.findIndex((track) => track.id === context.track.id);
      const nextCompatibleIndex =
        direction === "up"
          ? Math.max(0, currentCompatibleIndex - 1)
          : Math.min(compatibleTracks.length - 1, currentCompatibleIndex + 1);

      if (nextCompatibleIndex === currentCompatibleIndex) {
        return null;
      }

      const targetTrack = compatibleTracks[nextCompatibleIndex];
      const [item] = context.track.items.splice(context.itemIndex, 1);
      targetTrack.items.push(item);
      return { item, targetTrack };
    }

    function moveTimelineItemToPosition(project, itemId, targetTrackId, dropSeconds) {
      const sourceContext = getTimelineItemContextById(project, itemId);
      const targetTrack = project?.timeline?.tracks?.find((track) => track.id === targetTrackId);
      if (!sourceContext || !targetTrack) {
        return null;
      }

      const sourcePrefix = sourceContext.track.id.startsWith("audio") ? "audio" : "video";
      const targetPrefix = targetTrack.id.startsWith("audio") ? "audio" : "video";
      if (sourcePrefix !== targetPrefix) {
        return null;
      }

      const [item] = sourceContext.track.items.splice(sourceContext.itemIndex, 1);
      let insertIndex = 0;
      let cursor = 0;
      for (const existing of targetTrack.items) {
        const duration = getItemDuration(existing);
        const midpoint = cursor + duration / 2;
        if (dropSeconds >= midpoint) {
          insertIndex += 1;
        }
        cursor += duration;
      }

      targetTrack.items.splice(insertIndex, 0, item);
      state.selectedTimelineItemId = item.id;
      return { item, targetTrack, insertIndex };
    }

    function setPlayheadFromTimelinePosition(project, offsetX) {
      if (!project) {
        return;
      }

      const pixelsPerSecond = getTimelinePixelsPerSecond(project);
      const nextSeconds = Math.max(0, Math.min(getProjectDuration(project), offsetX / pixelsPerSecond));
      state.currentSeconds = nextSeconds;
      syncCurrentProjectTimecode();
      playbackView.activePreviewItemId = getActiveSegment(project, "video", state.currentSeconds)?.item?.id || "";
      playbackView.activeAudioItemId = getActiveSegment(project, "audio", state.currentSeconds)?.item?.id || "";
    }

    function duplicateSelectedTimelineItem(project) {
      const segment = getItemSegment(project, state.selectedTimelineItemId);
      if (!segment) {
        return null;
      }

      const copy = {
        ...segment.item,
        id: `clip-${Date.now()}`,
        name: `${segment.item.name} Copy`,
        transition: normalizeTransition({ type: "cut", duration: 0.4 })
      };
      const index = segment.track.items.findIndex((item) => item.id === segment.item.id);
      segment.track.items.splice(index + 1, 0, copy);
      state.selectedTimelineItemId = copy.id;
      return copy;
    }

    function removeSelectedTimelineItem(project) {
      for (const track of project?.timeline?.tracks || []) {
        const index = track.items.findIndex((item) => item.id === state.selectedTimelineItemId);
        if (index >= 0) {
          const [removed] = track.items.splice(index, 1);
          state.selectedTimelineItemId = track.items[index]?.id || track.items[index - 1]?.id || "";
          return removed;
        }
      }
      return null;
    }

    return {
      syncApprovedGeneratedClipIntoTimeline,
      buildRoughCutFromGeneratedClips,
      sendGeneratedClipToEdit,
      timelineHasContent,
      availableGeneratedClipCount,
      videoClipRequestHasPreferredClip,
      getVideoClipCompletion,
      openBridgeClipModal,
      closeBridgeClipModal,
      getBridgeContext,
      createBridgeClip,
      addAssetToTimelineAtPosition,
      adjustTimelineZoom,
      addTimelineMarker,
      moveSelectedClipInTrack,
      moveSelectedClipAcrossTracks,
      moveTimelineItemToPosition,
      setPlayheadFromTimelinePosition,
      duplicateSelectedTimelineItem,
      removeSelectedTimelineItem
    };
  }

  globalScope.EditorActionModules = {
    createActionHelpers
  };
})(window);
