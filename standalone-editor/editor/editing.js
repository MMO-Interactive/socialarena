(function attachEditorEditingModules(globalScope) {
  function createEditingHelpers(deps) {
    const {
      state,
      getProject,
      getSelectedTimelineItem,
      getTimelineItemContextById,
      getItemSegment,
      getItemDuration,
      getProjectDuration,
      getTimelinePixelsPerSecond,
      formatDurationLabel,
      formatTimecode,
      normalizeTransition,
      syncCurrentProjectTimecode,
      getActiveSegment,
      playbackView,
      setNotice,
      autosaveProjects,
      render
    } = deps;

    function splitSelectedTimelineItem(project) {
      const segment = getItemSegment(project, state.selectedTimelineItemId);
      if (!segment) {
        return null;
      }

      const duration = getItemDuration(segment.item);
      if (duration < 1) {
        return null;
      }

      const firstDuration = Number((duration / 2).toFixed(2));
      const secondDuration = Number((duration - firstDuration).toFixed(2));
      const index = segment.track.items.findIndex((item) => item.id === segment.item.id);
      const first = {
        ...segment.item,
        id: `${segment.item.id}-a`,
        name: `${segment.item.name} A`,
        durationSeconds: firstDuration,
        sourceOut: formatDurationLabel(firstDuration, segment.item.sourceOut),
        transition: normalizeTransition({ type: "cut", duration: 0.4 })
      };
      const second = {
        ...segment.item,
        id: `${segment.item.id}-b`,
        name: `${segment.item.name} B`,
        durationSeconds: secondDuration,
        sourceOut: formatDurationLabel(secondDuration, segment.item.sourceOut),
        transition: normalizeTransition(segment.item.transition)
      };
      segment.track.items.splice(index, 1, first, second);
      state.selectedTimelineItemId = second.id;
      return { first, second };
    }

    function updateSelectedTimelineItem(field, value) {
      const item = getSelectedTimelineItem();
      if (!item) {
        setNotice("Select a timeline clip first", "error");
        render();
        return;
      }

      if (field === "name") {
        item.name = value || "Untitled Clip";
      }

      if (field === "sourceOut") {
        item.sourceOut = value || "--";
        const project = getProject();
        project.timeline.duration = Math.max(
          project.timeline.duration || 0,
          ...project.timeline.tracks.map((track) => track.items.reduce((cursor, clip) => cursor + getItemDuration(clip), 0))
        );
      }

      if (field === "volume") {
        item.volume = Number(value);
      }

      setNotice(`Updated ${item.name}`, "success");
      autosaveProjects();
      render();
    }

    function updateSelectedTimelineTransition(field, value) {
      const item = getSelectedTimelineItem();
      if (!item) {
        setNotice("Select a timeline clip first", "error");
        render();
        return;
      }

      const transition = normalizeTransition(item.transition);

      if (field === "type") {
        transition.type = value;
      }

      if (field === "duration") {
        transition.duration = Math.max(0.05, Math.min(2, Number(value || transition.duration)));
      }

      item.transition = normalizeTransition(transition);
      setNotice(`Updated transition for ${item.name}`, "success");
      autosaveProjects();
      render();
    }

    function trimTimelineItem(itemId, edge, deltaSeconds, baseDuration, baseSourceIn) {
      const context = getTimelineItemContextById(getProject(), itemId);
      if (!context) {
        return null;
      }

      const item = context.item;
      const originalDuration = Number(baseDuration ?? getItemDuration(item));
      const minDuration = 0.2;
      let nextDuration = originalDuration;

      if (edge === "right") {
        nextDuration = Math.max(minDuration, originalDuration + deltaSeconds);
      } else {
        nextDuration = Math.max(minDuration, originalDuration - deltaSeconds);
        const sourceInSeconds = parseDurationSeconds((baseSourceIn ?? item.sourceIn) || "00:00:00", 0);
        const nextSourceIn = Math.max(0, sourceInSeconds + deltaSeconds);
        item.sourceIn = formatTimecode(nextSourceIn, getProject()?.fps || 24).slice(0, 8);
      }

      item.durationSeconds = Number(nextDuration.toFixed(2));
      item.sourceOut = formatDurationLabel(item.durationSeconds, item.sourceOut);
      return item;
    }

    function clipClass(kind) {
      if (kind === "audio") {
        return "clip clip-audio";
      }
      if (kind === "title") {
        return "clip clip-title";
      }
      return "clip clip-video";
    }

    function assetClass(kind) {
      if (kind === "audio") {
        return "asset-card audio";
      }
      if (kind === "image") {
        return "asset-card image";
      }
      return "asset-card video";
    }

    function formatInspector(selection) {
      if (!selection) {
        return {
          name: "Nothing selected",
          sourceIn: "--",
          sourceOut: "--",
          volume: 0,
          volumeLabel: "No audio"
        };
      }

      if (selection.kind === "scene") {
        return {
          name: selection.name,
          sourceIn: selection.sourceIn || "00:00:00",
          sourceOut: selection.sourceOut || "--",
          volume: 0,
          volumeLabel: "No audio",
          sceneSummary: selection.sceneSummary || "No scene summary yet",
          sceneObjective: selection.sceneObjective || "No scene objective yet",
          sceneMood: Array.isArray(selection.sceneMood) ? selection.sceneMood.filter(Boolean).join(", ") : "",
          sceneLocation: selection.sceneLocation || "Not set",
          sceneCharacters: Array.isArray(selection.sceneCharacters) ? selection.sceneCharacters.filter(Boolean).join(", ") : "",
          sceneTimeOfDay: selection.sceneTimeOfDay || "Not set",
          sceneCameraStyle: selection.sceneCameraStyle || "",
          sceneVisualReferences: selection.sceneVisualReferences || "",
          sceneNotes: selection.sceneNotes || "No notes yet",
          sceneScriptText: selection.sceneScriptText || "",
          sceneStatus: selection.sceneStatus || "draft",
          sceneClipPrompt: selection.sceneClipPrompt || "",
          sceneCompleteness: Number(selection.sceneCompleteness || 0),
          sceneCompletenessChecks: Array.isArray(selection.sceneCompletenessChecks) ? selection.sceneCompletenessChecks : [],
          previousSceneSummary: selection.previousSceneSummary || "",
          nextSceneSummary: selection.nextSceneSummary || ""
        };
      }

      const volume = selection.volume ?? 0;
      return {
        name: selection.name,
        sourceIn: selection.sourceIn || "00:00:00",
        sourceOut: selection.sourceOut || selection.meta || "--",
        volume,
        volumeLabel: selection.kind === "image" || selection.kind === "title" ? "No audio" : `Volume: ${volume}%`
      };
    }

    return {
      splitSelectedTimelineItem,
      updateSelectedTimelineItem,
      updateSelectedTimelineTransition,
      trimTimelineItem,
      clipClass,
      assetClass,
      formatInspector
    };
  }

  globalScope.EditorEditingModules = {
    createEditingHelpers
  };
})(window);
