(function attachEditorActionDispatchModules(globalScope) {
  const modules = globalScope.EditorUiModules || (globalScope.EditorUiModules = {});

  modules.createActionDispatchHelpers = function createActionDispatchHelpers(deps) {
    const {
      state,
      playbackView,
      editorShell,
      render,
      setNotice,
      autosaveProjects,
      getProject,
      getWorkflowStage,
      timelineHasContent,
      availableGeneratedClipCount,
      buildRoughCutFromGeneratedClips,
      getVideoClipCompletion,
      setProjectStage,
      getSelectedSceneSegment,
      generateShotsForScene,
      getBoardCardsByCategory,
      bindSceneSegmentToScriptScene,
      applySceneInspectorDraft,
      getSceneContext,
      routeSceneShotsToVideoClips,
      buildEntireSceneShotPlan,
      buildSceneCoverageSuggestions,
      getSelectedTimelineItem,
      buildNextShotFromClip,
      buildCutawayFromClip,
      buildExtensionFromClip,
      ensureVideoClipSceneForScriptScene,
      getSelectedAsset,
      savePlatformIdeaBoard,
      ensurePlatformBackedProject,
      getPromotionTargetLabel,
      runIdeaBoardItemAction,
      refreshPlatformIdeaBoard,
      getNextStage,
      shouldRequirePromotionBeforeScript,
      getPreviousStage,
      getStudioScopedProjects,
      projectBelongsToCurrentStudio,
      resetSelectionForProject,
      pausePlayback,
      syncCurrentProjectTimecode,
      importPlatformProject,
      clearAuthState,
      fetchPlatformProjects,
      createNewProjectDocument,
      snapshotProjectFile,
      formatProjectTypeLabel,
      assetViewMeta,
      studioViewMeta,
      selectStudioContext,
      normalizeProjectFormat,
      createSeriesSeason,
      createSeriesEpisode,
      openSeriesEpisodeTarget,
      importAssetsIntoProject,
      addSelectedAssetToTimeline,
      addIdeaCard,
      removeIdeaCard,
      addScriptScene,
      removeScriptScene,
      addScriptClip,
      removeScriptClip,
      ensureVideoClipsDraft,
      recomputeVideoClipSceneAggregate,
      generateVideoClipForScene,
      refreshVideoClipForScene,
      sendGeneratedClipToEdit,
      approveGeneratedVideoClip,
      ensureStartingImagesDraft,
      generateStartingImageForScene,
      refreshStartingImageForScene,
      addStartingImageVariation,
      approveStartingImageVariation,
      removeStartingImageVariation,
      startPlayback,
      stopPlayback,
      stepPlayback,
      adjustTimelineZoom,
      addTimelineMarker,
      moveSelectedClipInTrack,
      moveSelectedClipAcrossTracks,
      splitSelectedTimelineItem,
      duplicateSelectedTimelineItem,
      removeSelectedTimelineItem,
      formatTimecode,
      getActiveSegment,
      syncPreviewSelectionView,
      togglePreviewFullscreen,
      createExportSettings,
      openBridgeClipModal,
      closeBridgeClipModal,
      createBridgeClip,
      isEditableElementFocused,
      applyProjectDocument,
      syncApprovedGeneratedClipIntoTimeline
    } = deps;
    async function handleAction(action, options = {}) {
      const button = options.button || null;

      if (action === "menu-placeholder") {
        setNotice(options.notice || button?.dataset.notice || "This menu item is not implemented yet.", options.tone || "neutral");
        render();
        return;
      }

      if (action === "open-editor") {
        const project = getProject();
        if (
          project
          && state.currentView === "editor"
          && getWorkflowStage(project).id === "video_clips"
          && !timelineHasContent(project)
          && availableGeneratedClipCount(project) > 0
        ) {
          const result = buildRoughCutFromGeneratedClips(project);
          autosaveProjects();
          setNotice(
            result?.added
              ? `Built rough cut with ${result.added} generated clip${result.added === 1 ? "" : "s"}`
              : "Entered editor workspace",
            result?.added ? "success" : "neutral"
          );
          render();
          return;
        }

        state.currentView = "editor";
        setNotice("Entered editor workspace", "neutral");
        render();
        return;
      }

      if (action === "finish-video-clips") {
        const project = getProject();
        const completion = getVideoClipCompletion(project);
        if (!completion.selectedClipRequests) {
          setNotice("Select at least one generated clip before moving into Edit", "error");
          render();
          return;
        }

        if (!timelineHasContent(project)) {
          const result = buildRoughCutFromGeneratedClips(project);
          if (!result?.added) {
            setNotice("No selected generated clips are ready to assemble yet", "error");
            render();
            return;
          }

          autosaveProjects();
          setNotice(
            completion.readyToCut
              ? `Ready to cut: built rough cut with ${result.added} scene clip${result.added === 1 ? "" : "s"}`
              : `Built rough cut with ${result.added} generated clip${result.added === 1 ? "" : "s"}`,
            "success"
          );
          render();
          return;
        }

        setProjectStage(project, "edit");
        state.currentView = "editor";
        autosaveProjects();
        setNotice(
          completion.readyToCut
            ? "All scene takes are selected and the project is ready in Edit"
            : "Opened Edit with the current rough cut",
          "success"
        );
        render();
        return;
      }

      if (action === "open-bridge-clip-modal") {
        const project = getProject();
        const trackId = options.trackId || button?.dataset.trackId || "";
        const beforeItemId = options.beforeItemId || button?.dataset.beforeItemId || "";
        const afterItemId = options.afterItemId || button?.dataset.afterItemId || "";
        const track = project?.timeline?.tracks?.find((entry) => entry.id === trackId);
        const beforeItem = track?.items?.find((entry) => entry.id === beforeItemId);
        const afterItem = track?.items?.find((entry) => entry.id === afterItemId);
        if (!beforeItem || !afterItem) {
          setNotice("Bridge clips require two adjacent video clips", "error");
          render();
          return;
        }
        openBridgeClipModal(trackId, beforeItemId, afterItemId);
        render();
        return;
      }

      if (action === "close-bridge-clip-modal") {
        closeBridgeClipModal();
        render();
        return;
      }

      if (action === "generate-bridge-clip") {
        const project = getProject();
        try {
          const result = await createBridgeClip(project);
          autosaveProjects();
          closeBridgeClipModal();
          setNotice(`Created bridge clip ${result.asset.name}`, "success");
        } catch (error) {
          setNotice(error.message || "Failed to create bridge clip", "error");
        }
        render();
        return;
      }

      if (action === "open-dashboard") {
        state.currentView = "dashboard";
        setNotice("Opened dashboard", "neutral");
        render();
        return;
      }

      if (action === "open-studio-selector") {
        state.auth.studioPickerOpen = true;
        render();
        return;
      }

      if (action === "select-studio-context") {
        const studioId = options.studioId ?? button?.dataset.studioId ?? "";
        try {
          await selectStudioContext(studioId);
          setNotice(`Loaded ${getCurrentStudioSummary()?.name || "studio"} context`, "success");
        } catch (error) {
          setNotice(error.message || "Could not switch studio context", "error");
        }
        render();
        return;
      }

      const assetViewMap = {
        "open-assets-media-bin": "assets-media-bin",
        "open-assets-generated-images": "assets-generated-images",
        "open-assets-generated-videos": "assets-generated-videos",
        "open-assets-music-library": "assets-music-library",
        "open-assets-voice-library": "assets-voice-library",
        "open-assets-brand-assets": "assets-brand-assets"
      };

      if (assetViewMap[action]) {
        state.currentView = assetViewMap[action];
        setNotice(`Opened ${assetViewMeta(state.currentView).title}`, "neutral");
        render();
        return;
      }

      const studioViewMap = {
        "open-studio-project-library": "studio-project-library",
        "open-studio-story-board": "studio-story-board",
        "open-studio-scene-planner": "studio-scene-planner",
        "open-studio-clip-composer": "studio-clip-composer",
        "open-studio-studios": "studio-studios",
        "open-studio-series": "studio-series",
        "open-studio-episodes": "studio-episodes",
        "open-studio-talent": "studio-talent",
        "open-studio-locations": "studio-locations",
        "open-studio-props": "studio-props"
      };

      if (studioViewMap[action]) {
        state.currentView = studioViewMap[action];
        setNotice(`Opened ${studioViewMeta(state.currentView).title}`, "neutral");
        render();
        return;
      }

      if (action === "jump-stage") {
        const project = getProject();
        const stageId = options.stageId || button?.dataset.stageId;
        setProjectStage(project, stageId);
        state.currentView = "editor";
        setNotice(`Moved to ${getWorkflowStage(project).label}`, "success");
        autosaveProjects();
        render();
        return;
      }

      if (action === "generate-scene-shots") {
        const project = getProject();
        const selectedScene = getSelectedSceneSegment(project);
        const scriptSceneId = selectedScene?.context?.scriptSceneId;
        const plannedShots = generateShotsForScene(project, scriptSceneId);
        if (!plannedShots?.length) {
          setNotice("Could not generate shot placeholders for this scene", "error");
          render();
          return;
        }

        autosaveProjects();
        setNotice(`Generated ${plannedShots.length} shot placeholders for ${selectedScene?.context?.title || "scene"}`, "success");
        render();
        return;
      }

      if (action === "scene-fill-location" || action === "scene-fill-characters" || action === "scene-fill-mood") {
        const project = getProject();
        const selectedScene = getSelectedSceneSegment(project);
        const scriptSceneId = selectedScene?.context?.scriptSceneId || state.sceneInspectorDraft.sceneId;
        const scriptScene = project?.script?.scenes?.find((scene) => scene.id === scriptSceneId);
        if (!scriptScene) {
          setNotice("Select a scene block first", "error");
          render();
          return;
        }

        if (action === "scene-fill-location") {
          const location = getBoardCardsByCategory(project, "location")[0]?.title || "";
          if (!location) {
            setNotice("No location cards are available yet", "error");
            render();
            return;
          }
          state.sceneInspectorDraft.location = location;
          setNotice(`Applied location to ${scriptScene.title}`, "success");
        } else if (action === "scene-fill-characters") {
          const characters = getBoardCardsByCategory(project, "character").map((card) => card.title).filter(Boolean);
          if (!characters.length) {
            setNotice("No character cards are available yet", "error");
            render();
            return;
          }
          state.sceneInspectorDraft.characters = characters.join(", ");
          setNotice(`Linked cast to ${scriptScene.title}`, "success");
        } else {
          const mood = Array.isArray(project?.projectPitch?.tone) ? project.projectPitch.tone.filter(Boolean) : [];
          if (!mood.length) {
            setNotice("Project mood is not defined yet", "error");
            render();
            return;
          }
          state.sceneInspectorDraft.mood = mood.join(", ");
          setNotice(`Applied project mood to ${scriptScene.title}`, "success");
        }

        render();
        return;
      }

      if (action === "update-scene-metadata") {
        const project = getProject();
        const selectedScene = getSelectedSceneSegment(project);
        const scriptSceneId = selectedScene?.context?.scriptSceneId || state.sceneInspectorDraft.sceneId;
        if (selectedScene && !selectedScene.context?.scriptSceneId && scriptSceneId) {
          bindSceneSegmentToScriptScene(project, selectedScene, scriptSceneId);
        }
        if (!scriptSceneId || !applySceneInspectorDraft(project, scriptSceneId)) {
          setNotice("Select a scene block first", "error");
          render();
          return;
        }

        autosaveProjects();
        setNotice("Scene metadata updated", "success");
        render();
        return;
      }

      if (action === "generate-entire-scene") {
        const project = getProject();
        const selectedScene = getSelectedSceneSegment(project);
        const scriptSceneId = selectedScene?.context?.scriptSceneId;
        const context = getSceneContext(project, scriptSceneId);
        const { added, scene } = routeSceneShotsToVideoClips(
          project,
          scriptSceneId,
          buildEntireSceneShotPlan(context),
          "Built a full shot plan"
        );
        if (!scene || !added.length) {
          setNotice("Could not build a full shot plan for this scene", "error");
          render();
          return;
        }

        autosaveProjects();
        render();
        return;
      }

      if (action === "generate-scene-coverage") {
        const project = getProject();
        const selectedScene = getSelectedSceneSegment(project);
        const scriptSceneId = selectedScene?.context?.scriptSceneId;
        const context = getSceneContext(project, scriptSceneId);
        const { added, scene } = routeSceneShotsToVideoClips(
          project,
          scriptSceneId,
          buildSceneCoverageSuggestions(context),
          "Added coverage suggestions"
        );
        if (!scene || !added.length) {
          setNotice("No new coverage suggestions were added for this scene", "error");
          render();
          return;
        }

        autosaveProjects();
        render();
        return;
      }

      if (action === "generate-next-shot" || action === "generate-cutaway" || action === "extend-selected-clip") {
        const project = getProject();
        const item = getSelectedTimelineItem(project);
        if (!item?.scriptSceneId) {
          setNotice("Select a scene-linked clip first", "error");
          render();
          return;
        }

        const shot =
          action === "generate-next-shot"
            ? buildNextShotFromClip(project, item)
            : action === "generate-cutaway"
              ? buildCutawayFromClip(project, item)
              : buildExtensionFromClip(project, item);
        const noticeMap = {
          "generate-next-shot": "Prepared next-shot prompt",
          "generate-cutaway": "Prepared cutaway prompt",
          "extend-selected-clip": "Prepared scene extension prompt"
        };
        const { added, scene } = routeSceneShotsToVideoClips(project, item.scriptSceneId, [shot], noticeMap[action]);
        if (!scene || !added.length) {
          setNotice("Could not prepare an AI clip request from this timeline clip", "error");
          render();
          return;
        }

        scene.clipPrompt = shot.prompt;
        autosaveProjects();
        render();
        return;
      }

      if (action === "open-clip-scene-video-clips") {
        const project = getProject();
        const item = getSelectedTimelineItem(project);
        if (!item?.scriptSceneId) {
          setNotice("This clip is not linked to a scene", "error");
          render();
          return;
        }

        const scene = ensureVideoClipSceneForScriptScene(project, item.scriptSceneId);
        if (!scene) {
          setNotice("Could not locate the scene clip workspace", "error");
          render();
          return;
        }

        state.selectedVideoClipSceneId = scene.id;
        setProjectStage(project, "video_clips");
        state.currentView = "editor";
        setNotice(`Opened clip generation for ${scene.title}`, "success");
        autosaveProjects();
        render();
        return;
      }

      if (action === "tag-selected-asset" || action === "approve-selected-asset" || action === "reject-selected-asset") {
        const project = getProject();
        const asset = getSelectedAsset(project);
        if (!asset) {
          setNotice("Select an asset first", "neutral");
          render();
          return;
        }

        if (action === "tag-selected-asset") {
          const tagToAdd = state.assetBrowser.tagDraft.trim();
          if (!tagToAdd) {
            setNotice("Enter a tag first", "neutral");
            render();
            return;
          }
          asset.tags = Array.isArray(asset.tags) ? asset.tags : [];
          if (!asset.tags.includes(tagToAdd)) {
            asset.tags.push(tagToAdd);
            setNotice(`Added tag "${tagToAdd}"`, "success");
          } else {
            setNotice(`"${tagToAdd}" is already on ${asset.name}`, "neutral");
          }
          state.assetBrowser.tagDraft = "";
        } else if (action === "approve-selected-asset") {
          asset.reviewStatus = "approved";
          setNotice(`Approved ${asset.name}`, "success");
        } else {
          asset.reviewStatus = "rejected";
          setNotice(`Rejected ${asset.name}`, "neutral");
        }
        autosaveProjects();
        render();
        return;
      }

      if (action === "set-asset-review-filter") {
        state.assetBrowser.reviewFilter = button?.dataset.filter || "all";
        render();
        return;
      }

      if (action === "save-idea-board") {
        const project = getProject();
        try {
          if (project?.remoteType && project?.remoteId) {
            await savePlatformIdeaBoard(project);
            setNotice("Idea Board saved to SocialArena", "success");
          } else {
            setNotice("Idea Board saved locally", "success");
          }
          autosaveProjects();
        } catch (error) {
          setNotice(error.message || "Failed to save idea board", "error");
        }
        render();
        return;
      }

      if (action === "save-project-pitch") {
        autosaveProjects();
        setNotice("Project Pitch saved", "success");
        render();
        return;
      }

      if (action === "promote-project-idea") {
        const project = getProject();
        try {
          await ensurePlatformBackedProject(project);
          project.promotedAt = new Date().toISOString();
          autosaveProjects();
          setNotice(`Promoted idea to ${getPromotionTargetLabel(project)}`, "success");
        } catch (error) {
          setNotice(error.message || "Failed to promote idea", "error");
        }
        render();
        return;
      }

      if (action === "save-script") {
        autosaveProjects();
        setNotice("Script saved", "success");
        render();
        return;
      }

      if (action === "save-starting-images") {
        autosaveProjects();
        setNotice("Starting image plan saved", "success");
        render();
        return;
      }

      if (action === "close-export-modal") {
        if (!state.exportModal.inProgress) {
          state.exportModal.open = false;
          state.exportModal.progress = 0;
          state.exportModal.stage = "";
          render();
        }
        return;
      }

      if (action === "preview-idea-prompt") {
        const project = getProject();
        const cardId = options.cardId || button?.dataset.ideaCardId;
        try {
          const result = await runIdeaBoardItemAction(project, cardId, "prompt-preview");
          state.ideaPromptModal = {
            open: true,
            title: "Prompt Preview",
            content: result.prompt || "No prompt returned."
          };
          setNotice("Loaded prompt preview", "success");
        } catch (error) {
          setNotice(error.message || "Failed to preview prompt", "error");
        }
        render();
        return;
      }

      if (action === "preview-idea-clip") {
        const project = getProject();
        const cardId = options.cardId || button?.dataset.ideaCardId;
        try {
          const result = await runIdeaBoardItemAction(project, cardId, "clip-preview");
          state.ideaPromptModal = {
            open: true,
            title: "Clip Prompt Preview",
            content: result.prompt || "No prompt returned."
          };
          await refreshPlatformIdeaBoard(project);
          autosaveProjects();
          setNotice("Loaded clip prompt preview", "success");
        } catch (error) {
          setNotice(error.message || "Failed to preview clip prompt", "error");
        }
        render();
        return;
      }

      if (action === "generate-idea-card") {
        const project = getProject();
        const cardId = options.cardId || button?.dataset.ideaCardId;
        try {
          await runIdeaBoardItemAction(project, cardId, "generate");
          await refreshPlatformIdeaBoard(project);
          autosaveProjects();
          setNotice("Generation queued", "success");
        } catch (error) {
          setNotice(error.message || "Failed to queue generation", "error");
        }
        render();
        return;
      }

      if (action === "generate-idea-clip") {
        const project = getProject();
        const cardId = options.cardId || button?.dataset.ideaCardId;
        try {
          await runIdeaBoardItemAction(project, cardId, "clip-generate");
          await refreshPlatformIdeaBoard(project);
          autosaveProjects();
          setNotice("Clip generation queued", "success");
        } catch (error) {
          setNotice(error.message || "Failed to queue clip generation", "error");
        }
        render();
        return;
      }

      if (action === "refresh-idea-card") {
        const project = getProject();
        const cardId = options.cardId || button?.dataset.ideaCardId;
        try {
          await runIdeaBoardItemAction(project, cardId, "refresh");
          await refreshPlatformIdeaBoard(project);
          autosaveProjects();
          setNotice("Node refreshed", "success");
        } catch (error) {
          setNotice(error.message || "Failed to refresh node", "error");
        }
        render();
        return;
      }

      if (action === "open-idea-history") {
        const project = getProject();
        const cardId = options.cardId || button?.dataset.ideaCardId;
        try {
          const result = await runIdeaBoardItemAction(project, cardId, "history");
          const card = project?.ideaBoard?.cards?.find((entry) => entry.id === cardId);
          state.ideaHistoryModal = {
            open: true,
            title: `${card?.title || "Node"} History`,
            generations: Array.isArray(result.generations) ? result.generations : [],
            linksByGeneration: result.links && typeof result.links === "object" ? result.links : {}
          };
          setNotice("Loaded generation history", "success");
        } catch (error) {
          setNotice(error.message || "Failed to load generation history", "error");
        }
        render();
        return;
      }

      if (action === "close-idea-prompt") {
        state.ideaPromptModal.open = false;
        render();
        return;
      }

      if (action === "close-idea-history") {
        state.ideaHistoryModal.open = false;
        render();
        return;
      }

      if (action === "next-stage") {
        const project = getProject();
        const nextStage = getNextStage(project);
        if (nextStage && nextStage.id !== getWorkflowStage(project).id) {
          if (getWorkflowStage(project).id === "project_pitch" && nextStage.id === "script" && shouldRequirePromotionBeforeScript(project)) {
            setNotice(`Promote this idea to a ${getPromotionTargetLabel(project)} before continuing to Script`, "error");
            render();
            return;
          }
          if (
            project
            && getWorkflowStage(project).id === "video_clips"
            && nextStage.id === "edit"
            && !timelineHasContent(project)
            && availableGeneratedClipCount(project) > 0
          ) {
            const result = buildRoughCutFromGeneratedClips(project);
            autosaveProjects();
            setNotice(
              result?.added
                ? `Built rough cut with ${result.added} generated clip${result.added === 1 ? "" : "s"}`
                : `Advanced to ${nextStage.label}`,
              result?.added ? "success" : "neutral"
            );
            render();
            return;
          }

          setProjectStage(project, nextStage.id);
          setNotice(`Advanced to ${nextStage.label}`, "success");
          autosaveProjects();
        }
        render();
        return;
      }

      if (action === "previous-stage") {
        const project = getProject();
        const previousStage = getPreviousStage(project);
        if (previousStage && previousStage.id !== getWorkflowStage(project).id) {
          setProjectStage(project, previousStage.id);
          setNotice(`Returned to ${previousStage.label}`, "neutral");
          autosaveProjects();
        }
        render();
        return;
      }

      if (action === "dashboard-open-project") {
        const targetProjectId = options.projectId || button?.dataset.projectId;
        if (String(targetProjectId || "").startsWith("platform-")) {
          const targetType = String(targetProjectId).split("-")[1] || "";
          const targetRemoteId = Number(String(targetProjectId).split("-").slice(2).join("-"));
          const remoteProject = state.platform.projects.find(
            (project) => project.type === targetType && Number(project.id) === targetRemoteId
          );
          if (remoteProject) {
            try {
              await importPlatformProject(remoteProject);
              state.currentView = "editor";
            } catch (error) {
              setNotice(error.message || "Failed to open platform project", "error");
            }
            render();
            return;
          }
        }
        const localTarget = getStudioScopedProjects().find((project) => project.id === targetProjectId) || null;
        if (localTarget && !projectBelongsToCurrentStudio(localTarget)) {
          setNotice("That local project does not belong to the current studio.", "error");
          render();
          return;
        }
        state.selectedProjectId = targetProjectId;
        state.selectedScriptSceneId = "";
        const project = getProject();
        resetSelectionForProject(project);
        pausePlayback();
        state.currentSeconds = 0;
        if (project?.type === "series" && state.currentView === "studio-series") {
          state.currentView = "studio-series";
        } else if (project?.type === "episode" && state.currentView === "studio-episodes") {
          state.currentView = "studio-episodes";
        } else {
          state.currentView = "editor";
        }
        syncCurrentProjectTimecode();
        playbackView.activePreviewItemId = "";
        playbackView.activeAudioItemId = "";
        setNotice(`Loaded ${project?.name || "project"}`, "neutral");
        autosaveProjects();
        render();
        return;
      }

      if (action === "logout") {
        try {
          if (state.auth.token) {
            await window.editorShell.apiLogout({
              baseUrl: state.auth.baseUrl,
              token: state.auth.token
            });
          }
        } catch (error) {
          // Ignore logout transport failures and clear local session anyway.
        }
        clearAuthState();
        render();
        return;
      }

      if (action === "open-platform-browser") {
        state.platform.modalOpen = true;
        if (!state.platform.projects.length && !state.platform.loading) {
          await fetchPlatformProjects();
        }
        render();
        return;
      }

      if (action === "close-platform-browser") {
        state.platform.modalOpen = false;
        render();
        return;
      }

      if (action === "import-platform-project") {
        const platformType = options.platformType || button?.dataset.platformType;
        const platformId = Number(options.platformId || button?.dataset.platformId);
        const remoteProject = state.platform.projects.find(
          (project) => project.type === platformType && Number(project.id) === platformId
        );

        if (!remoteProject) {
          setNotice("Platform project not found", "error");
          render();
          return;
        }

        try {
          await importPlatformProject(remoteProject);
          if (remoteProject.type === "series" && state.currentView === "studio-series") {
            state.currentView = "studio-series";
          } else if (remoteProject.type === "episode" && state.currentView === "studio-episodes") {
            state.currentView = "studio-episodes";
          } else {
            state.currentView = "editor";
          }
        } catch (error) {
          setNotice(error.message || "Failed to import platform project", "error");
        }
        render();
        return;
      }

      if (action === "new-project") {
        const requestedType = options.projectType || button?.dataset.projectType || "episode";
        applyProjectDocument(createNewProjectDocument(requestedType));
        state.projectFilePath = "";
        state.currentView = "editor";
        setNotice(`Created new ${formatProjectTypeLabel(normalizeProjectFormat(requestedType, "episode")).toLowerCase()} project`, "success");
        render();
        return;
      }

      if (action === "create-series-season") {
        const targetProjectId = options.projectId || button?.dataset.projectId || state.selectedProjectId;
        const project = getStudioScopedProjects().find((entry) => entry.id === targetProjectId) || getProject();
        if (!project || project.type !== "series") {
          setNotice("Open a series project first", "error");
          render();
          return;
        }
        try {
          const season = await createSeriesSeason(project);
          autosaveProjects();
          setNotice(`Added ${season?.title || "season"}`, "success");
        } catch (error) {
          setNotice(error.message || "Failed to add season", "error");
        }
        render();
        return;
      }

      if (action === "create-series-episode") {
        const targetProjectId = options.projectId || button?.dataset.projectId || state.selectedProjectId;
        const seasonId = options.seasonId || button?.dataset.seasonId || "";
        const project = getStudioScopedProjects().find((entry) => entry.id === targetProjectId) || getProject();
        if (!project || project.type !== "series") {
          setNotice("Open a series project first", "error");
          render();
          return;
        }
        try {
          const episode = await createSeriesEpisode(project, seasonId);
          autosaveProjects();
          setNotice(`Added ${episode?.title || "episode"}`, "success");
        } catch (error) {
          setNotice(error.message || "Failed to add episode", "error");
        }
        render();
        return;
      }

      if (action === "open-series-entry-episode" || action === "open-series-episode") {
        const targetProjectId = options.projectId || button?.dataset.projectId || state.selectedProjectId;
        const localProjectId = options.localProjectId || button?.dataset.localProjectId || "";
        const entryProjectId = Number(options.entryProjectId || button?.dataset.entryProjectId || 0);
        const project = getStudioScopedProjects().find((entry) => entry.id === targetProjectId) || getProject();
        const episodeTitle = button?.querySelector?.("strong")?.textContent || "episode";
        try {
          await openSeriesEpisodeTarget(project, localProjectId, entryProjectId, episodeTitle);
        } catch (error) {
          setNotice(error.message || "Failed to open episode", "error");
        }
        render();
        return;
      }

      if (action === "add-idea-card") {
        const project = getProject();
        const categoryId = options.categoryId || button?.dataset.ideaCategory;
        const card = addIdeaCard(project, categoryId);
        state.revealIdeaCardId = card?.id || "";
        state.ideaContextMenu.open = false;
        autosaveProjects();
        setNotice(`Added ${IDEA_BOARD_CATEGORIES.find((entry) => entry.id === categoryId)?.label || "idea"} card`, "success");
        render();
        return;
      }

      if (action === "add-script-scene") {
        const project = getProject();
        const scene = addScriptScene(project);
        autosaveProjects();
        setNotice(`Added ${scene?.title || "scene"}`, "success");
        render();
        return;
      }

      if (action === "add-script-clip") {
        const project = getProject();
        const sceneId = options.sceneId || button?.dataset.scriptSceneId;
        const clip = addScriptClip(project, sceneId);
        if (!clip) {
          setNotice("Could not add clip to that scene", "error");
          render();
          return;
        }
        autosaveProjects();
        setNotice(`Added ${clip.title}`, "success");
        render();
        return;
      }

      if (action === "remove-script-scene") {
        const project = getProject();
        const sceneId = options.sceneId || button?.dataset.scriptSceneId;
        removeScriptScene(project, sceneId);
        autosaveProjects();
        setNotice("Removed scene", "neutral");
        render();
        return;
      }

      if (action === "remove-script-clip") {
        const project = getProject();
        const sceneId = options.sceneId || button?.dataset.scriptSceneId;
        const clipId = options.clipId || button?.dataset.scriptClipId;
        removeScriptClip(project, sceneId, clipId);
        autosaveProjects();
        setNotice("Removed clip", "neutral");
        render();
        return;
      }

      if (action === "select-script-scene") {
        state.selectedScriptSceneId = options.sceneId || button?.dataset.scriptSceneId || "";
        render();
        return;
      }

      if (action === "select-starting-image-scene") {
        state.selectedStartingImageSceneId = options.sceneId || button?.dataset.startingImageSceneId || "";
        render();
        return;
      }

      if (action === "select-video-clip-scene") {
        state.selectedVideoClipSceneId = options.sceneId || button?.dataset.videoClipSceneId || "";
        const project = getProject();
        const scene = project?.videoClips?.scenes?.find((entry) => entry.id === state.selectedVideoClipSceneId);
        state.selectedVideoClipRequestId = scene?.clips?.[0]?.id || "";
        render();
        return;
      }

      if (action === "select-video-clip-request") {
        state.selectedVideoClipSceneId = options.sceneId || button?.dataset.videoClipSceneId || state.selectedVideoClipSceneId;
        state.selectedVideoClipRequestId = options.requestId || button?.dataset.videoClipRequestId || "";
        render();
        return;
      }

      if (action === "generate-video-clip") {
        let project = getProject();
        ensureVideoClipsDraft(project);
        const sceneId = options.sceneId || button?.dataset.videoClipSceneId || state.selectedVideoClipSceneId;
        const requestId = options.requestId || button?.dataset.videoClipRequestId || state.selectedVideoClipRequestId;
        const scene = project?.videoClips?.scenes?.find((entry) => entry.id === sceneId);
        const request = scene?.clips?.find((entry) => entry.id === requestId) || scene?.clips?.[0];
        if (!scene) {
          setNotice("Select a clip scene first", "error");
          render();
          return;
        }
        if (!request) {
          setNotice("Select a clip slot first", "error");
          render();
          return;
        }

        try {
          project = await ensurePlatformBackedProject(project);
          await generateVideoClipForScene(project, sceneId, request.id);
          autosaveProjects();
          setNotice(`Queued video clip generation for ${scene.title} / ${request.title}`, "success");
        } catch (error) {
          setNotice(error.message || "Failed to queue video clip generation", "error");
        }
        render();
        return;
      }

      if (action === "refresh-video-clip") {
        const project = getProject();
        ensureVideoClipsDraft(project);
        const sceneId = options.sceneId || button?.dataset.videoClipSceneId || state.selectedVideoClipSceneId;
        const requestId = options.requestId || button?.dataset.videoClipRequestId || state.selectedVideoClipRequestId;
        const scene = project?.videoClips?.scenes?.find((entry) => entry.id === sceneId);
        const request = scene?.clips?.find((entry) => entry.id === requestId) || scene?.clips?.[0];
        if (!scene) {
          setNotice("Select a clip scene first", "error");
          render();
          return;
        }
        if (!request) {
          setNotice("Select a clip slot first", "error");
          render();
          return;
        }

        try {
          const result = await refreshVideoClipForScene(project, sceneId, request.id);
          autosaveProjects();
          const payload = result?.video_clip || {};
          setNotice(
            payload.generated_video_url
              ? `Video clip ready for ${scene.title} / ${request.title}`
              : `Video clip still ${payload.generation_status || "queued"} for ${scene.title} / ${request.title}`,
            payload.generated_video_url ? "success" : "neutral"
          );
        } catch (error) {
          setNotice(error.message || "Failed to refresh video clip", "error");
        }
        render();
        return;
      }

      if (action === "send-generated-clip-to-edit") {
        const project = getProject();
        const sceneId = options.sceneId || button?.dataset.videoClipSceneId || "";
        const requestId = options.requestId || button?.dataset.videoClipRequestId || "";
        const clipId = options.clipId || button?.dataset.generatedClipId || "";
        const clip = sendGeneratedClipToEdit(project, sceneId, requestId, clipId);
        if (!clip) {
          setNotice("Could not add that generated clip to the timeline", "error");
          render();
          return;
        }

        autosaveProjects();
        setNotice(`Added ${clip.name} to the timeline`, "success");
        render();
        return;
      }

      if (action === "approve-generated-clip") {
        const project = getProject();
        const sceneId = options.sceneId || button?.dataset.videoClipSceneId || "";
        const requestId = options.requestId || button?.dataset.videoClipRequestId || "";
        const clipId = options.clipId || button?.dataset.generatedClipId || "";
        const clip = approveGeneratedVideoClip(project, sceneId, requestId, clipId);
        if (!clip) {
          setNotice("Could not mark that generated clip as the selected take", "error");
          render();
          return;
        }

        const syncedTimelineClip = timelineHasContent(project) ? syncApprovedGeneratedClipIntoTimeline(project, sceneId, requestId) : null;
        const completion = getVideoClipCompletion(project);
        autosaveProjects();
        setNotice(
          completion.readyToCut
            ? `Selected ${clip.label}. All scenes are now ready to cut.`
            : syncedTimelineClip
              ? `Selected ${clip.label} and updated the rough cut`
              : `Selected ${clip.label} for the rough cut`,
          "success"
        );
        render();
        return;
      }

      if (action === "use-planned-shot") {
        const project = getProject();
        ensureVideoClipsDraft(project);
        const sceneId = options.sceneId || button?.dataset.videoClipSceneId || "";
        const requestId = options.requestId || button?.dataset.videoClipRequestId || state.selectedVideoClipRequestId;
        const shotId = options.shotId || button?.dataset.plannedShotId || "";
        const scene = project?.videoClips?.scenes?.find((entry) => entry.id === sceneId);
        const request = scene?.clips?.find((entry) => entry.id === requestId) || scene?.clips?.[0];
        const shot = scene?.plannedShots?.find((entry) => entry.id === shotId);
        if (!scene || !shot || !request) {
          setNotice("That shot placeholder could not be found", "error");
          render();
          return;
        }

        request.clipPrompt = shot.prompt;
        request.shotNotes = request.shotNotes || shot.title;
        request.updatedAt = new Date().toISOString();
        recomputeVideoClipSceneAggregate(scene);
        project.videoClips.updatedAt = scene.updatedAt;
        state.selectedVideoClipSceneId = scene.id;
        state.selectedVideoClipRequestId = request.id;
        autosaveProjects();
        setNotice(`Loaded ${shot.title} into ${request.title}`, "success");
        render();
        return;
      }

      if (action === "build-rough-cut") {
        const project = getProject();
        const result = buildRoughCutFromGeneratedClips(project);
        if (!result?.added) {
          setNotice("No generated clips are ready to assemble yet", "error");
          render();
          return;
        }

        autosaveProjects();
        setNotice(`Built rough cut with ${result.added} generated clip${result.added === 1 ? "" : "s"}`, "success");
        render();
        return;
      }

      if (action === "generate-starting-image") {
        let project = getProject();
        ensureStartingImagesDraft(project);
        const sceneId = options.sceneId || button?.dataset.startingImageSceneId || state.selectedStartingImageSceneId;
        const scene = project?.startingImages?.scenes?.find((entry) => entry.id === sceneId);
        if (!scene) {
          setNotice("Select a scene first", "error");
          render();
          return;
        }

        try {
          const wasLocalOnly = !project?.remoteType || !project?.remoteId;
          project = await ensurePlatformBackedProject(project);
          await generateStartingImageForScene(project, sceneId);
          await refreshPlatformIdeaBoard(project);
          autosaveProjects();
          setNotice(
            wasLocalOnly
              ? `Created platform project and queued starting image generation for ${scene.title}`
              : `Queued starting image generation for ${scene.title}`,
            "success"
          );
          render();
          return;
        } catch (error) {
          setNotice(error.message || "Failed to queue starting image generation", "error");
          render();
          return;
        }
      }

      if (action === "refresh-starting-image") {
        const project = getProject();
        ensureStartingImagesDraft(project);
        const sceneId = options.sceneId || button?.dataset.startingImageSceneId || state.selectedStartingImageSceneId;
        const scene = project?.startingImages?.scenes?.find((entry) => entry.id === sceneId);
        if (!scene) {
          setNotice("Select a scene first", "error");
          render();
          return;
        }

        try {
          const result = await refreshStartingImageForScene(project, sceneId);
          autosaveProjects();
          const payload = result?.starting_image || {};
          setNotice(
            payload.generated_image_url
              ? `Starting image ready for ${scene.title}`
              : `Starting image still ${payload.generation_status || "queued"} for ${scene.title}`,
            payload.generated_image_url ? "success" : "neutral"
          );
        } catch (error) {
          setNotice(error.message || "Failed to refresh starting image", "error");
        }
        render();
        return;
      }

      if (action === "use-selected-image-asset") {
        const project = getProject();
        ensureStartingImagesDraft(project);
        const sceneId = options.sceneId || button?.dataset.startingImageSceneId || state.selectedStartingImageSceneId;
        const scene = project?.startingImages?.scenes?.find((entry) => entry.id === sceneId);
        const asset = project?.assets?.find((entry) => entry.id === state.selectedAssetId && entry.kind === "image");
        if (!scene || !asset) {
          setNotice("Select an image asset in the Media Bin first", "error");
          render();
          return;
        }

        const variation = addStartingImageVariation(project, sceneId, {
          source: "asset",
          label: asset.name,
          imageUrl: asset.fileUrl || asset.thumbnailUrl || "",
          assetId: asset.id,
          status: "linked"
        });
        approveStartingImageVariation(project, sceneId, variation.id);
        autosaveProjects();
        setNotice(`Approved ${asset.name} for ${scene.title}`, "success");
        render();
        return;
      }

      if (action === "open-editor") {
        const project = getProject();
        if (project) {
          setProjectStage(project, "edit");
          autosaveProjects();
        }
        state.currentView = "editor";
        render();
        return;
      }

      if (action === "approve-starting-image-variation") {
        const project = getProject();
        const sceneId = options.sceneId || button?.dataset.startingImageSceneId;
        const variationId = options.variationId || button?.dataset.startingImageVariationId;
        const variation = approveStartingImageVariation(project, sceneId, variationId);
        if (!variation) {
          setNotice("Could not approve that variation", "error");
        } else {
          autosaveProjects();
          setNotice(`Approved ${variation.label}`, "success");
        }
        render();
        return;
      }

      if (action === "remove-starting-image-variation") {
        const project = getProject();
        const sceneId = options.sceneId || button?.dataset.startingImageSceneId;
        const variationId = options.variationId || button?.dataset.startingImageVariationId;
        const removed = removeStartingImageVariation(project, sceneId, variationId);
        if (!removed) {
          setNotice("Could not remove that variation", "error");
        } else {
          autosaveProjects();
          setNotice(`Removed ${removed.label}`, "neutral");
        }
        render();
        return;
      }

      if (action === "start-idea-link") {
        const cardId = options.cardId || button?.dataset.ideaCardId;
        state.linkingIdeaCardId = state.linkingIdeaCardId === cardId ? "" : cardId;
        setNotice(
          state.linkingIdeaCardId
            ? "Click another node to create the connection"
            : "Node connection cancelled",
          "neutral"
        );
        render();
        return;
      }

      if (action === "remove-idea-card") {
        const project = getProject();
        const cardId = options.cardId || button?.dataset.ideaCardId;
        removeIdeaCard(project, cardId);
        if (state.linkingIdeaCardId === cardId) {
          state.linkingIdeaCardId = "";
        }
        autosaveProjects();
        setNotice("Removed idea board card", "neutral");
        render();
        return;
      }

      if (action === "playback-play") {
        startPlayback();
        return;
      }

      if (action === "close-asset-preview") {
        state.previewAssetId = "";
        render();
        return;
      }

      if (action === "open-selected-asset-preview") {
        if (isEditableElementFocused()) {
          return;
        }
        if (state.selectedAssetId) {
          state.previewAssetId = state.selectedAssetId;
          render();
        }
        return;
      }

      if (action === "playback-pause") {
        pausePlayback();
        return;
      }

      if (action === "playback-stop") {
        stopPlayback();
        syncPreviewSelectionView();
        return;
      }

      if (action === "timeline-zoom-in" || action === "timeline-zoom-out") {
        const project = getProject();
        adjustTimelineZoom(project, action === "timeline-zoom-in" ? "in" : "out");
        autosaveProjects();
        render();
        return;
      }

      if (action === "timeline-add-marker") {
        const project = getProject();
        const marker = addTimelineMarker(project);
        autosaveProjects();
        setNotice(`Added ${marker?.label || "marker"} at ${formatTimecode(marker?.seconds || 0, project.fps)}`, "success");
        render();
        return;
      }

      if (action === "timeline-move-clip-left" || action === "timeline-move-clip-right") {
        const project = getProject();
        const moved = moveSelectedClipInTrack(project, action.endsWith("left") ? "left" : "right");
        if (!moved) {
          setNotice("Cannot move the selected clip further in that direction", "error");
        } else {
          autosaveProjects();
          setNotice(`Moved ${moved.name}`, "success");
        }
        render();
        return;
      }

      if (action === "timeline-move-clip-up" || action === "timeline-move-clip-down") {
        const project = getProject();
        const result = moveSelectedClipAcrossTracks(project, action.endsWith("up") ? "up" : "down");
        if (!result) {
          setNotice("Cannot move the selected clip to another track", "error");
        } else {
          autosaveProjects();
          setNotice(`Moved ${result.item.name} to ${result.targetTrack.label}`, "success");
        }
        render();
        return;
      }

      if (action === "jump-to-marker") {
        const project = getProject();
        const markerId = options.markerId || button?.dataset.markerId;
        const marker = project?.timeline?.markers?.find((entry) => entry.id === markerId);
        if (marker) {
          state.currentSeconds = marker.seconds;
          syncCurrentProjectTimecode();
          playbackView.activePreviewItemId = getActiveSegment(project, "video", state.currentSeconds)?.item?.id || "";
          playbackView.activeAudioItemId = getActiveSegment(project, "audio", state.currentSeconds)?.item?.id || "";
          syncPreviewSelectionView();
          setNotice(`Jumped to ${marker.label}`, "neutral");
          render();
        }
        return;
      }

      if (action === "timeline-split-clip") {
        const project = getProject();
        const result = splitSelectedTimelineItem(project);
        if (!result) {
          setNotice("Select a clip at least 1 second long to split", "error");
        } else {
          autosaveProjects();
          setNotice(`Split ${result.first.name.replace(/ A$/, "")}`, "success");
        }
        render();
        return;
      }

      if (action === "timeline-duplicate-clip") {
        const project = getProject();
        const duplicate = duplicateSelectedTimelineItem(project);
        if (!duplicate) {
          setNotice("Select a clip first", "error");
        } else {
          autosaveProjects();
          setNotice(`Duplicated ${duplicate.name}`, "success");
        }
        render();
        return;
      }

      if (action === "timeline-delete-clip") {
        const project = getProject();
        const removed = removeSelectedTimelineItem(project);
        if (!removed) {
          setNotice("Select a clip first", "error");
        } else {
          autosaveProjects();
          setNotice(`Deleted ${removed.name}`, "neutral");
        }
        render();
        return;
      }

      if (action === "playback-step") {
        stepPlayback();
        return;
      }

      if (action === "preview-fullscreen") {
        try {
          await togglePreviewFullscreen();
        } catch (error) {
          setNotice(error.message || "Could not open fullscreen preview", "error");
          render();
        }
        return;
      }

      if (action === "sync-project") {
        const currentProject = getProject();
        if (currentProject?.remoteType && currentProject?.remoteId) {
          try {
            await importPlatformProject({
              type: currentProject.remoteType,
              id: currentProject.remoteId,
              title: currentProject.name,
              clip_count: currentProject.clipCount,
              updated_at: new Date().toISOString()
            });
          } catch (error) {
            setNotice(error.message || "Failed to sync platform project", "error");
          }
        } else {
          setNotice("Current project is local only", "neutral");
        }
        render();
        return;
      }

      if (action === "export-project") {
        const project = getProject();
        state.exportModal.open = true;
        state.exportModal.inProgress = false;
        state.exportModal.progress = 0;
        state.exportModal.stage = `Exporting ${project?.name || "project"} to MP4`;
        state.exportModal.settings = createExportSettings({
          ...state.exportModal.settings,
          fps: String(project?.fps || 24)
        });
        render();
        return;
      }

      if (action === "export-script") {
        try {
          const project = getProject();
          if (!project) {
            throw new Error("No active project is available.");
          }

          const result = await window.editorShell.exportScript({
            projectName: project.name,
            content: formatScriptExport(project)
          });
          if (result?.canceled) {
            setNotice("Script export canceled", "neutral");
          } else {
            setNotice(`Exported ${result.filePath.split(/[\\\\/]/).pop()}`, "success");
          }
        } catch (error) {
          setNotice(error.message || "Script export failed", "error");
        }
        render();
        return;
      }

      if (action === "confirm-export") {
        try {
          const project = getProject();
          if (!project) {
            throw new Error("No active project is available.");
          }

          state.exportModal.inProgress = true;
          state.exportModal.progress = 2;
          state.exportModal.stage = "Opening export destination";
          render();

          const result = await window.editorShell.exportProject({
            project,
            settings: state.exportModal.settings
          });
          if (result?.canceled) {
            state.exportModal.inProgress = false;
            state.exportModal.progress = 0;
            state.exportModal.stage = "Export canceled";
            setNotice("Export canceled", "neutral");
          } else {
            state.exportModal.inProgress = false;
            state.exportModal.progress = 100;
            state.exportModal.stage = "Export complete";
            state.exportModal.open = false;
            setNotice(`Exported ${result.filePath.split(/[\\\\/]/).pop()}`, "success");
          }
        } catch (error) {
          state.exportModal.inProgress = false;
          state.exportModal.stage = error.message || "Export failed";
          setNotice(error.message || "Export failed", "error");
        }
        render();
        return;
      }

      if (action === "import-assets") {
        try {
          const result = await window.editorShell.importAssets();
          if (result?.canceled) {
            setNotice("Import canceled", "neutral");
          } else if (Array.isArray(result?.assets) && result.assets.length > 0) {
            const imported = await importAssetsIntoProject(result.assets);
            setNotice(`Imported ${imported.length} asset${imported.length === 1 ? "" : "s"}`, "success");
          }
        } catch (error) {
          setNotice(error.message || "Failed to import assets", "error");
        }
        render();
        return;
      }

      if (action === "add-to-timeline") {
        addSelectedAssetToTimeline();
        render();
        return;
      }

      if (action === "open-project") {
        try {
          const result = await window.editorShell.openProject();
          if (result?.canceled) {
            setNotice("Open canceled", "neutral");
          } else if (result?.content) {
            const applied = applyProjectDocument(JSON.parse(result.content));
            state.projectFilePath = result.filePath || "";
            state.currentView = applied?.visibleProjectCount ? "editor" : "dashboard";
            if (applied?.visibleProjectCount) {
              setNotice(`Opened ${result.filePath.split(/[\\\\/]/).pop()}`, "success");
            } else {
              setNotice("Opened file, but it does not contain projects for the current studio.", "error");
            }
          }
        } catch (error) {
          setNotice(error.message || "Failed to open project file", "error");
        }
        render();
        return;
      }

      if (action === "save-project" || action === "save-project-as") {
        try {
          const result = await window.editorShell.saveProject({
            filePath: action === "save-project-as" ? "" : state.projectFilePath,
            content: snapshotProjectFile()
          });
          if (result?.canceled) {
            setNotice("Save canceled", "neutral");
          } else {
            state.projectFilePath = result.filePath || "";
            setNotice(`Saved ${result.filePath.split(/[\\\\/]/).pop()}`, "success");
            autosaveProjects();
          }
        } catch (error) {
          setNotice(error.message || "Failed to save project file", "error");
        }
        render();
      }
    }


    return {
      handleAction
    };
  };
})(window);
