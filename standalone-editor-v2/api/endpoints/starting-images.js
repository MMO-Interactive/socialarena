(function attachV2StartingImageEndpoints(globalScope) {
  function createStartingImageEndpoints(apiClient) {
    function withStudio(path, studioId) {
      return globalScope.CreatorAppV2WorkspaceController.appendStudioId(path, studioId);
    }

    return {
      generate: (token, studioId, type, id, body) =>
        apiClient.request(withStudio(`editor/projects/${type}/${id}/starting-images/generate`, studioId), {
          method: "POST",
          token,
          body
        }),
      refresh: (token, studioId, type, id, body) =>
        apiClient.request(withStudio(`editor/projects/${type}/${id}/starting-images/refresh`, studioId), {
          method: "POST",
          token,
          body
        })
    };
  }

  globalScope.CreatorAppV2Api = globalScope.CreatorAppV2Api || {};
  globalScope.CreatorAppV2Api.createStartingImageEndpoints = createStartingImageEndpoints;
})(window);
