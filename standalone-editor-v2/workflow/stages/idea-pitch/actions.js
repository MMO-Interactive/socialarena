(function attachV2IdeaPitchStageActions(globalScope) {
  function buildDraftFromInputs(appElement, fallbackDraft) {
    const draft = globalScope.CreatorAppV2ProjectWorkspace.createPitchDraft(fallbackDraft || {});
    const fields = ["title", "format", "audience", "logline", "concept", "tone", "visualStyle", "references", "successCriteria"];
    fields.forEach((field) => {
      const input = appElement.querySelector(`[data-pitch-field="${field}"]`);
      if (!input) {
        return;
      }
      draft[field] = input.value;
    });
    return globalScope.CreatorAppV2ProjectWorkspace.createPitchDraft(draft);
  }

  async function applyPitchDraftFromDom(store, appElement) {
    const currentDraft = globalScope.CreatorAppV2IdeaPitchState.getPitchDraft(store);
    const nextDraft = buildDraftFromInputs(appElement, currentDraft);
    globalScope.CreatorAppV2ProjectWorkspace.updatePitchDraft(store, nextDraft);
    globalScope.CreatorAppV2ProjectWorkspace.applyPitchDraft(store);
    await globalScope.CreatorAppV2ProjectController.saveWorkspaceTimeline(store, {
      notice: "Pitch draft applied and saved to project workspace."
    });
  }

  globalScope.CreatorAppV2IdeaPitchActions = {
    applyPitchDraftFromDom
  };
})(window);
