(function attachV2VideoClipEndpoints(globalScope) {
  function createVideoClipEndpoints(apiClient) {
    function withStudio(path, studioId) {
      return globalScope.CreatorAppV2WorkspaceController.appendStudioId(path, studioId);
    }

    return {
      generate: (token, studioId, type, id, body) =>
        apiClient.request(withStudio(`editor/projects/${type}/${id}/video-clips/generate`, studioId), {
          method: "POST",
          token,
          body
        }),
      refresh: (token, studioId, type, id, body) =>
        apiClient.request(withStudio(`editor/projects/${type}/${id}/video-clips/refresh`, studioId), {
          method: "POST",
          token,
          body
        })
    };
  }

  globalScope.CreatorAppV2Api = globalScope.CreatorAppV2Api || {};
  globalScope.CreatorAppV2Api.createVideoClipEndpoints = createVideoClipEndpoints;
})(window);
