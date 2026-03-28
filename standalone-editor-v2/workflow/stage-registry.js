(function attachV2StageRegistry(globalScope) {
  const STAGES = [
    {
      id: "idea_board",
      label: "Idea Board",
      summary: "Capture creative atoms before promotion into a formal project.",
      foundation: "Board items, story atoms, and creative references live here."
    },
    {
      id: "idea_pitch",
      label: "Idea Pitch",
      summary: "Convert the board into a promotable film or series concept.",
      foundation: "This stage decides what the project becomes."
    },
    {
      id: "script",
      label: "Script",
      summary: "Build scene and clip structure that powers all downstream generation.",
      foundation: "Scenes, characters, and clip-level dialogue start here."
    },
    {
      id: "starting_images",
      label: "Starting Image Generation",
      summary: "Generate anchor frames for scenes before clip production starts.",
      foundation: "Every target scene should leave with an approved anchor image."
    },
    {
      id: "clip_generation",
      label: "Clip Generation",
      summary: "Generate scene clips and select the preferred take for each slot.",
      foundation: "This stage turns structured prompts into footage."
    },
    {
      id: "edit",
      label: "Edit",
      summary: "Assemble selected takes on the timeline with AI-native editing context.",
      foundation: "Narrative context, continuity, and timeline editing converge here."
    },
    {
      id: "export_release",
      label: "Export / Release",
      summary: "Prepare final export and release handoff without leaving the creator app.",
      foundation: "Export succeeds only when the previous six stages are coherent."
    }
  ];

  function getStageById(stageId) {
    return STAGES.find((stage) => stage.id === stageId) || STAGES[0];
  }

  globalScope.CreatorAppV2Workflow = globalScope.CreatorAppV2Workflow || {};
  globalScope.CreatorAppV2Workflow.STAGES = STAGES;
  globalScope.CreatorAppV2Workflow.getStageById = getStageById;
})(window);
