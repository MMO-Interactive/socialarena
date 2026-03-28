(function attachV2ProjectController(globalScope) {
  function resolveImportedMediaMetadata(asset) {
    const kind = String(asset?.kind || "").trim();
    const sourceUrl = String(asset?.fileUrl || asset?.sourceUrl || "").trim();
    if (!sourceUrl || !["audio", "video"].includes(kind)) {
      return Promise.resolve({
        durationSeconds: kind === "image" ? 3 : Number(asset?.durationSeconds || 0) || 0
      });
    }

    return new Promise((resolve) => {
      const mediaElement = document.createElement(kind === "audio" ? "audio" : "video");
      let settled = false;

      function cleanup() {
        mediaElement.removeAttribute("src");
        mediaElement.load?.();
      }

      function finish(payload) {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        resolve(payload);
      }

      mediaElement.preload = "metadata";
      mediaElement.onloadedmetadata = () => {
        const durationValue = Number(mediaElement.duration || 0);
        finish({
          durationSeconds: Number.isFinite(durationValue) && durationValue > 0 ? durationValue : 0,
          durationResolved: Number.isFinite(durationValue) && durationValue > 0
        });
      };
      mediaElement.onerror = () => finish({ durationSeconds: 0, durationResolved: false });
      mediaElement.src = sourceUrl;
    });
  }

  async function hydrateImportedAssetMetadata(store) {
    const importedAssets = Array.isArray(store.getState().projectWorkspace?.importedAssets)
      ? store.getState().projectWorkspace.importedAssets
      : [];
    const pendingAssets = importedAssets.filter((asset) =>
      ["audio", "video"].includes(String(asset.kind || "").trim()) && !asset.durationResolved && asset.sourceUrl
    );

    if (!pendingAssets.length) {
      return [];
    }

    const resolved = await Promise.all(
      pendingAssets.map(async (asset) => {
        const metadata = await resolveImportedMediaMetadata(asset);
        if (metadata.durationResolved && metadata.durationSeconds > 0) {
          globalScope.CreatorAppV2ProjectWorkspace.applyImportedAssetMetadata(store, asset.id, metadata);
        }
        return { assetId: asset.id, ...metadata };
      })
    );

    const changedAssets = resolved.filter((entry) => entry.durationResolved && entry.durationSeconds > 0);
    if (changedAssets.length) {
      await saveWorkspaceTimeline(store);
    }

    return resolved;
  }

  function buildProjectPayload(projectType) {
    const normalizedType = ["film", "series", "episode"].includes(projectType) ? projectType : "film";
    const titleMap = {
      film: "Untitled SocialArena Film",
      series: "Untitled SocialArena Series",
      episode: "Untitled SocialArena Episode"
    };

    return {
      title: titleMap[normalizedType],
      project_type: normalizedType,
      description: "",
      story_description: "",
      genre: "Drama",
      setting: "",
      visibility: "private"
    };
  }

  async function openProject(store, projectSummary) {
    const state = store.getState();
    const { session, endpoints } = state;
    if (session.status !== "studio_ready" || !session.token || !session.studioId) {
      return null;
    }

    globalScope.CreatorAppV2ProjectWorkspace.setProjectWorkspaceLoading(store, true);
    try {
      const summary = globalScope.CreatorAppV2ProjectWorkspace.normalizeProjectSummary(projectSummary);
      const [projectPayload, ideaBoardPayload, timelinePayload] = await Promise.all([
        endpoints.projects.getProject(session.token, session.studioId, summary.type, summary.id),
        endpoints.projects.getIdeaBoard(session.token, session.studioId, summary.type, summary.id),
        endpoints.projects.getTimeline(session.token, session.studioId, summary.type, summary.id)
      ]);

      const normalizedBoard = globalScope.CreatorAppV2ProjectWorkspace.normalizeApiIdeaBoard(ideaBoardPayload?.idea_board || null);
      globalScope.CreatorAppV2ProjectWorkspace.setActiveProject(store, {
        summary,
        project: projectPayload?.project || projectSummary,
        ideaBoard: normalizedBoard,
        timelineProject: timelinePayload?.timeline_project || null
      });

      const restoredStageId = globalScope.CreatorAppV2Workflow.getStageById(
        store.getState().projectWorkspace?.workflowStageId || "idea_board"
      ).id;

      store.setState((currentState) => ({
        ...currentState,
        ui: {
          ...currentState.ui,
          currentView: "workflow"
        },
        workflow: {
          ...currentState.workflow,
          currentStageId: restoredStageId,
          stages: currentState.workflow.stages.map((stage) => ({
            ...stage,
            status: stage.id === restoredStageId ? "active" : "ready"
          })),
          notice: `Opened ${summary.title} in the creator workflow at ${globalScope.CreatorAppV2Workflow.getStageById(restoredStageId).label}.`
        }
      }));

      if (restoredStageId === "edit") {
        await hydrateImportedAssetMetadata(store);
        const editDraft = globalScope.CreatorAppV2EditState.getEditDraft(store);
        const hasApprovedSelections = globalScope.CreatorAppV2ClipGenerationState.getVideoClipsDraft(store).scenes.some((scene) =>
          scene.clips.some((clip) => Boolean(clip.approvedClipId || clip.generatedClips[0]))
        );
        if (!editDraft.timelineItems.length && hasApprovedSelections) {
          globalScope.CreatorAppV2EditActions.buildRoughCut(store);
          await saveWorkspaceTimeline(store, {
            notice: `Opened ${summary.title} in Edit and rebuilt the rough cut from approved takes.`
          });
        }
      } else if (restoredStageId === "export_release") {
        await globalScope.CreatorAppV2ExportReleaseActions.refreshExports(store);
      }

      return summary;
    } catch (error) {
      globalScope.CreatorAppV2ProjectWorkspace.setProjectWorkspaceError(store, error.message || "Failed to open project.");
      return null;
    }
  }

  async function createProject(store, projectType) {
    const state = store.getState();
    const { session, endpoints } = state;
    if (session.status !== "studio_ready" || !session.token || !session.studioId) {
      return null;
    }

    globalScope.CreatorAppV2ProjectWorkspace.setProjectWorkspaceLoading(store, true);
    try {
      const payload = await endpoints.projects.createProject(session.token, session.studioId, buildProjectPayload(projectType));
      await globalScope.CreatorAppV2WorkspaceController.hydrateWorkspace(store);
      const createdProject = payload?.project || null;
      if (createdProject?.id && createdProject?.type) {
        return await openProject(store, createdProject);
      }
      throw new Error("Project was created but no project record was returned.");
    } catch (error) {
      globalScope.CreatorAppV2ProjectWorkspace.setProjectWorkspaceError(store, error.message || "Failed to create project.");
      return null;
    }
  }

  async function saveIdeaBoard(store) {
    const state = store.getState();
    const { session, endpoints, projectWorkspace } = state;
    const activeProject = projectWorkspace?.activeProject;
    if (!activeProject || session.status !== "studio_ready") {
      return null;
    }

    globalScope.CreatorAppV2ProjectWorkspace.setIdeaBoardLoading(store, true);
    try {
      const payload = await endpoints.projects.saveIdeaBoard(
        session.token,
        session.studioId,
        activeProject.type,
        activeProject.id,
        globalScope.CreatorAppV2ProjectWorkspace.serializeIdeaBoard(projectWorkspace)
      );
      globalScope.CreatorAppV2ProjectWorkspace.setIdeaBoardSaved(store, payload);
      store.setState((currentState) => ({
        ...currentState,
        workflow: {
          ...currentState.workflow,
          notice: "Idea board saved to the platform."
        }
      }));
      return payload;
    } catch (error) {
      globalScope.CreatorAppV2ProjectWorkspace.setIdeaBoardError(store, error.message || "Failed to save idea board.");
      return null;
    }
  }

  async function saveWorkspaceTimeline(store, options = {}) {
    const state = store.getState();
    const { session, endpoints, projectWorkspace } = state;
    const activeProject = projectWorkspace?.activeProject;
    if (!activeProject || session.status !== "studio_ready") {
      return null;
    }

    try {
      const existingTimeline = projectWorkspace?.timelineProject?.timeline_json || {};
      const payload = await endpoints.projects.saveTimeline(
        session.token,
        session.studioId,
        activeProject.type,
        activeProject.id,
        {
          name: `${activeProject.title || "Untitled Project"} Workspace`,
          timeline_json: {
            ...existingTimeline,
            v2_workspace: globalScope.CreatorAppV2ProjectWorkspace.serializeWorkspace(projectWorkspace)
          }
        }
      );
      globalScope.CreatorAppV2ProjectWorkspace.setTimelineProjectSaved(store, payload);
      if (options.notice) {
        store.setState((currentState) => ({
          ...currentState,
          workflow: {
            ...currentState.workflow,
            notice: options.notice
          }
        }));
      }
      return payload;
    } catch (error) {
      globalScope.CreatorAppV2ProjectWorkspace.setProjectWorkspaceError(store, error.message || "Failed to save project workspace.");
      return null;
    }
  }

  function addIdeaCard(store, card) {
    globalScope.CreatorAppV2ProjectWorkspace.updateIdeaBoard(store, (board) => ({
      ...board,
      cards: [
        ...board.cards,
        {
          id: `idea-card-${Date.now()}`,
          category: card.category || "note",
          title: String(card.title || "").trim(),
          description: String(card.description || "").trim(),
          status: "draft",
          influencedBy: [],
          x: 120 + (board.cards.length % 3) * 280,
          y: 120 + Math.floor(board.cards.length / 3) * 180
        }
      ],
      updatedAt: new Date().toISOString()
    }));
  }

  async function importAssets(store) {
    const activeProject = store.getState().projectWorkspace?.activeProject;
    if (!activeProject) {
      return null;
    }

    const result = await window.creatorAppV2.importAssets();
    if (!result || result.canceled || !Array.isArray(result.assets) || !result.assets.length) {
      return [];
    }

    const enrichedAssets = await Promise.all(
      result.assets.map(async (asset) => {
        const kind = globalScope.CreatorAppV2ProjectWorkspace.inferImportedAssetKind(asset.extension);
        const metadata = await resolveImportedMediaMetadata({
          ...asset,
          kind
        });
        return {
          ...asset,
          kind,
          durationSeconds: metadata.durationSeconds
          ,
          durationResolved: metadata.durationResolved
        };
      })
    );

    globalScope.CreatorAppV2ProjectWorkspace.updateImportedAssets(store, (assets) => ([
      ...assets,
      ...enrichedAssets.map((asset, index) => globalScope.CreatorAppV2ProjectWorkspace.createImportedAsset(asset, assets.length + index))
    ]));
    store.setState((state) => ({
      ...state,
      workflow: {
        ...state.workflow,
        notice: `Imported ${enrichedAssets.length} asset${enrichedAssets.length === 1 ? "" : "s"} into the project media bin.`
      }
    }));
    return enrichedAssets;
  }

  globalScope.CreatorAppV2ProjectController = {
    openProject,
    createProject,
    saveIdeaBoard,
    saveWorkspaceTimeline,
    addIdeaCard,
    importAssets,
    hydrateImportedAssetMetadata
  };
})(window);
