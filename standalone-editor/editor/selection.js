(function attachEditorSelectionModules(globalScope) {
  function createSelectionHelpers(deps) {
    const {
      state,
      getSelectedSceneSegment,
      getAdjacentSceneContexts,
      getSceneCompleteness,
      formatDurationLabel,
      formatTimecode
    } = deps;

    function getSelection(project) {
      if (!project) {
        return null;
      }

      for (const track of project.timeline.tracks) {
        const item = track.items.find((entry) => entry.id === state.selectedTimelineItemId);
        if (item) {
          return item;
        }
      }

      const sceneSegment = getSelectedSceneSegment(project);
      if (sceneSegment) {
        const adjacent = getAdjacentSceneContexts(project, sceneSegment.context.scriptSceneId);
        const completeness = getSceneCompleteness(sceneSegment.context);
        return {
          id: sceneSegment.id,
          kind: "scene",
          scriptSceneId: sceneSegment.context.scriptSceneId,
          name: sceneSegment.context.title,
          meta: `${formatDurationLabel(sceneSegment.end - sceneSegment.start)} narrative segment`,
          sourceIn: formatTimecode(sceneSegment.start, project.fps),
          sourceOut: formatTimecode(sceneSegment.end, project.fps),
          sceneSummary: sceneSegment.context.summary,
          sceneObjective: sceneSegment.context.intent,
          sceneMood: sceneSegment.context.mood,
          sceneLocation: sceneSegment.context.location,
          sceneCharacters: sceneSegment.context.characters,
          sceneTimeOfDay: sceneSegment.context.timeOfDay,
          sceneCameraStyle: sceneSegment.context.cameraStyle,
          sceneVisualReferences: sceneSegment.context.visualReferences,
          sceneNotes: sceneSegment.context.notes,
          sceneScriptText: sceneSegment.context.dialogue,
          sceneStatus: sceneSegment.context.status,
          sceneClipPrompt: sceneSegment.context.clipPrompt,
          sceneCompleteness: completeness.score,
          sceneCompletenessChecks: completeness.checks,
          previousSceneSummary: adjacent.previous?.summary || "",
          nextSceneSummary: adjacent.next?.summary || ""
        };
      }

      const assets = Array.isArray(project.assets) ? project.assets : [];
      return assets.find((asset) => asset.id === state.selectedAssetId) || assets[0] || null;
    }

    return {
      getSelection
    };
  }

  globalScope.EditorSelectionModules = {
    createSelectionHelpers
  };
})(window);
