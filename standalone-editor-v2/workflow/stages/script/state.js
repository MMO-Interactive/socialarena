(function attachV2ScriptStageState(globalScope) {
  function getScriptDraft(store) {
    return globalScope.CreatorAppV2ProjectWorkspace.createScriptDraft(
      store.getState().projectWorkspace?.script?.draft || {}
    );
  }

  globalScope.CreatorAppV2ScriptState = {
    getScriptDraft
  };
})(window);
