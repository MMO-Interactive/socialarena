(function attachV2ExportReleaseStageState(globalScope) {
  function getExportReleaseDraft(store) {
    return globalScope.CreatorAppV2ProjectWorkspace.createExportReleaseDraft(
      store.getState().projectWorkspace?.exportRelease?.draft || {}
    );
  }

  function getSelectedExport(store) {
    const draft = getExportReleaseDraft(store);
    return draft.exports.find((entry) => Number(entry.id) === Number(draft.activeExportId)) || draft.exports[0] || null;
  }

  function getExportChecklist(store) {
    const state = store.getState();
    const draft = getExportReleaseDraft(store);
    const editDraft = globalScope.CreatorAppV2EditState.getEditDraft(store);
    return [
      { label: "Rough cut assembled", complete: editDraft.timelineItems.length > 0 },
      { label: "Runtime available", complete: Number(draft.durationSeconds || 0) > 0 },
      { label: "Export target defined", complete: Boolean(String(draft.title || "").trim()) && Boolean(String(draft.resolution || "").trim()) },
      { label: "Export initialized", complete: draft.exports.length > 0 },
      { label: "Release artifact complete", complete: draft.exports.some((entry) => entry.status === "complete") },
      { label: "Stage synchronized", complete: !Boolean(state.projectWorkspace?.exportRelease?.dirty) }
    ];
  }

  globalScope.CreatorAppV2ExportReleaseState = {
    getExportReleaseDraft,
    getSelectedExport,
    getExportChecklist
  };
})(window);
