(function attachV2IdeaPitchStageState(globalScope) {
  function getPitchDraft(store) {
    return globalScope.CreatorAppV2ProjectWorkspace.createPitchDraft(
      store.getState().projectWorkspace?.pitch?.draft || {}
    );
  }

  function getPitchChecklist(store) {
    return globalScope.CreatorAppV2ProjectWorkspace.getPitchChecklist(getPitchDraft(store));
  }

  globalScope.CreatorAppV2IdeaPitchState = {
    getPitchDraft,
    getPitchChecklist
  };
})(window);
