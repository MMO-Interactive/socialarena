(function attachEditorAppStateModules(globalScope) {
  function createAppStateHelpers(deps) {
    const {
      appName,
      defaultApiBaseUrl,
      createWorkflowState,
      createIdeaBoardState,
      createProjectPitchState,
      createScriptState,
      createExportSettings
    } = deps;

    const defaultProjects = [
      {
        id: "episode-1",
        name: "Episode 1 Rough Cut",
        type: "episode",
        clipCount: 12,
        workflow: createWorkflowState("edit"),
        fps: 24,
        status: "Connected",
        syncLabel: "Synced 2 min ago",
        previewLabel: "1080p Draft",
        timecode: "00:00:18:12",
        selectedLabel: "Clip Selected",
        assets: [
          { id: "asset-scene-1", name: "Opening Clip", kind: "video", meta: "8.0 sec" },
          { id: "asset-scene-2", name: "Scene 02", kind: "video", meta: "6.2 sec" },
          { id: "asset-title", name: "Episode Title", kind: "image", meta: "title card" },
          { id: "asset-theme", name: "Theme Track", kind: "audio", meta: "46 sec" },
          { id: "asset-dialogue", name: "Dialogue Stem", kind: "audio", meta: "12 sec" },
          { id: "asset-still", name: "Still Frame", kind: "image", meta: "1280x720" }
        ],
        timeline: {
          duration: 60,
          tracks: [
            {
              id: "video-1",
              label: "V1",
              items: [
                { id: "clip-opening", name: "Opening Clip", kind: "video", width: "36%", sourceIn: "00:00:00", sourceOut: "00:00:08", volume: 80 },
                { id: "clip-scene-2", name: "Scene 02", kind: "video", width: "22%", sourceIn: "00:00:00", sourceOut: "00:00:06", volume: 100 },
                { id: "clip-title", name: "Title", kind: "title", width: "16%", sourceIn: "00:00:00", sourceOut: "00:00:03", volume: 0 }
              ]
            },
            {
              id: "audio-1",
              label: "A1",
              items: [
                { id: "clip-theme", name: "Theme Track", kind: "audio", width: "58%", sourceIn: "00:00:00", sourceOut: "00:00:46", volume: 70 }
              ]
            },
            {
              id: "audio-2",
              label: "A2",
              items: [
                { id: "clip-dialogue", name: "Dialogue Stem", kind: "audio", width: "28%", sourceIn: "00:00:01", sourceOut: "00:00:12", volume: 88 },
                { id: "clip-sfx", name: "SFX", kind: "audio", width: "18%", sourceIn: "00:00:00", sourceOut: "00:00:04", volume: 62 }
              ]
            }
          ]
        }
      },
      {
        id: "series-1",
        name: "Enchanted Realm Series",
        type: "series",
        clipCount: 6,
        workflow: createWorkflowState("edit"),
        fps: 24,
        status: "Series",
        syncLabel: "Season planning synced",
        previewLabel: "720p Balanced",
        timecode: "00:00:09:03",
        selectedLabel: "Scene Selected",
        assets: [
          { id: "asset-hit-1", name: "Hero Shot", kind: "video", meta: "5.8 sec" },
          { id: "asset-hit-2", name: "Reveal Cut", kind: "video", meta: "4.2 sec" },
          { id: "asset-hit-3", name: "Logo Card", kind: "image", meta: "title card" },
          { id: "asset-hit-4", name: "Trailer Bed", kind: "audio", meta: "32 sec" }
        ],
        timeline: {
          duration: 30,
          tracks: [
            {
              id: "video-1",
              label: "V1",
              items: [
                { id: "clip-hero", name: "Hero Shot", kind: "video", width: "26%", sourceIn: "00:00:00", sourceOut: "00:00:05", volume: 100 },
                { id: "clip-reveal", name: "Reveal Cut", kind: "video", width: "20%", sourceIn: "00:00:00", sourceOut: "00:00:04", volume: 100 },
                { id: "clip-logo", name: "Logo Card", kind: "title", width: "14%", sourceIn: "00:00:00", sourceOut: "00:00:02", volume: 0 }
              ]
            },
            {
              id: "audio-1",
              label: "A1",
              items: [
                { id: "clip-bed", name: "Trailer Bed", kind: "audio", width: "74%", sourceIn: "00:00:00", sourceOut: "00:00:32", volume: 82 }
              ]
            }
          ]
        }
      },
      {
        id: "film-1",
        name: "Feature Film Assembly",
        type: "film",
        clipCount: 3,
        workflow: createWorkflowState("edit"),
        fps: 30,
        status: "Film",
        syncLabel: "Feature cut in progress",
        previewLabel: "1080x1920 Draft",
        timecode: "00:00:04:21",
        selectedLabel: "Clip Selected",
        assets: [
          { id: "asset-short-1", name: "Hook Clip", kind: "video", meta: "2.7 sec" },
          { id: "asset-short-2", name: "Punchline", kind: "video", meta: "1.8 sec" },
          { id: "asset-short-3", name: "Beat Drop", kind: "audio", meta: "8 sec" }
        ],
        timeline: {
          duration: 12,
          tracks: [
            {
              id: "video-1",
              label: "V1",
              items: [
                { id: "clip-hook", name: "Hook Clip", kind: "video", width: "24%", sourceIn: "00:00:00", sourceOut: "00:00:02", volume: 100 },
                { id: "clip-punchline", name: "Punchline", kind: "video", width: "16%", sourceIn: "00:00:00", sourceOut: "00:00:01", volume: 100 }
              ]
            },
            {
              id: "audio-1",
              label: "A1",
              items: [
                { id: "clip-beat", name: "Beat Drop", kind: "audio", width: "42%", sourceIn: "00:00:00", sourceOut: "00:00:08", volume: 90 }
              ]
            }
          ]
        }
      }
    ];

    const templateProjectDocument = {
      schema_version: 1,
      saved_at: "2026-03-14T00:00:00Z",
      active_project_id: "template-project",
      projects: [
        {
          id: "template-project",
          name: "New SocialArena Project",
          type: "episode",
          clipCount: 0,
          workflow: createWorkflowState("idea_board"),
          ideaBoard: createIdeaBoardState({
            cards: [
              {
                id: "idea-character-1",
                category: "character",
                title: "Lead Character",
                description: "Who or what should drive the story?",
                status: "draft"
              },
              {
                id: "idea-scene-1",
                category: "scene",
                title: "Opening Scene",
                description: "Sketch the first scene beat or moment.",
                status: "draft"
              }
            ]
          }),
          projectPitch: createProjectPitchState({
            format: "episode"
          }),
          script: createScriptState({
            scenes: [
              {
                title: "Scene 1",
                summary: "",
                dialogue: "",
                clipPrompt: ""
              }
            ]
          }),
          fps: 24,
          status: "Template",
          syncLabel: "Not synced",
          previewLabel: "1080p Draft",
          timecode: "00:00:00:00",
          selectedLabel: "No Selection",
          assets: [],
          timeline: {
            duration: 30,
            tracks: [
              {
                id: "video-1",
                label: "V1",
                items: []
              },
              {
                id: "audio-1",
                label: "A1",
                items: []
              }
            ]
          }
        }
      ]
    };

    const state = {
      auth: {
        status: "checking",
        token: "",
        user: null,
        studios: [],
        currentStudioId: null,
        studioPickerOpen: false,
        baseUrl: defaultApiBaseUrl,
        usernameDraft: "",
        error: "",
        loading: false
      },
      platform: {
        projects: [],
        loading: false,
        modalOpen: false,
        error: ""
      },
      dashboard: {
        data: null,
        loading: false,
        error: ""
      },
      currentView: "dashboard",
      selectedProjectId: "episode-1",
      selectedScriptSceneId: "",
      selectedStartingImageSceneId: "",
      selectedVideoClipSceneId: "",
      selectedVideoClipRequestId: "",
      selectedAssetId: "asset-scene-1",
      selectedSceneSegmentId: "",
      selectedTimelineItemId: "clip-opening",
      previewAssetId: "",
      playing: false,
      currentSeconds: 18.5,
      projectFilePath: "",
      revealIdeaCardId: "",
      linkingIdeaCardId: "",
      ideaPromptModal: {
        open: false,
        title: "",
        content: ""
      },
      ideaHistoryModal: {
        open: false,
        title: "",
        generations: [],
        linksByGeneration: {}
      },
      exportModal: {
        open: false,
        inProgress: false,
        progress: 0,
        stage: "",
        settings: createExportSettings()
      },
      bridgeClipModal: {
        open: false,
        trackId: "",
        beforeItemId: "",
        afterItemId: "",
        prompt: "",
        durationSeconds: 2,
        status: "",
        error: ""
      },
      ideaContextMenu: {
        open: false,
        x: 0,
        y: 0
      },
      timelineDropIndicator: {
        trackId: "",
        seconds: 0
      },
      assetBrowser: {
        query: "",
        reviewFilter: "all",
        tagDraft: ""
      },
      sceneInspectorDraft: {
        sceneId: "",
        location: "",
        characters: "",
        mood: "",
        timeOfDay: "",
        objective: "",
        cameraStyle: "",
        visualReferences: ""
      },
      notice: `${appName ? "Desktop shell ready" : "Desktop shell ready"}`,
      noticeTone: "neutral"
    };

    return {
      defaultProjects,
      templateProjectDocument,
      state
    };
  }

  globalScope.EditorStateModules = globalScope.EditorStateModules || {};
  globalScope.EditorStateModules.createAppStateHelpers = createAppStateHelpers;
})(window);
