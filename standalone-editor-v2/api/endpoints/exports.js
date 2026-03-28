(function attachV2ExportEndpoints(globalScope) {
  function createExportEndpoints(apiClient) {
    function withStudio(path, studioId) {
      return globalScope.CreatorAppV2WorkspaceController.appendStudioId(path, studioId);
    }

    return {
      list: (token, studioId, type, id) =>
        apiClient.request(withStudio(`editor/projects/${type}/${id}/exports`, studioId), {
          token
        }),
      init: (token, studioId, body) =>
        apiClient.request(withStudio("editor/exports/init", studioId), {
          method: "POST",
          token,
          body
        }),
      complete: (token, studioId, exportId, body) =>
        apiClient.request(withStudio(`editor/exports/${exportId}/complete`, studioId), {
          method: "POST",
          token,
          body
        })
    };
  }

  globalScope.CreatorAppV2Api = globalScope.CreatorAppV2Api || {};
  globalScope.CreatorAppV2Api.createExportEndpoints = createExportEndpoints;
})(window);
