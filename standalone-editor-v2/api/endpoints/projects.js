(function attachV2ProjectEndpoints(globalScope) {
  function createProjectEndpoints(apiClient) {
    function withStudio(path, studioId) {
      return globalScope.CreatorAppV2WorkspaceController.appendStudioId(path, studioId);
    }

    return {
      listProjects: (token, studioId) => apiClient.request(withStudio("editor/projects", studioId), { token }),
      getDashboard: (token, studioId) => apiClient.request(withStudio("editor/dashboard", studioId), { token }),
      getProject: (token, studioId, type, id) => apiClient.request(withStudio(`editor/projects/${type}/${id}`, studioId), { token }),
      getIdeaBoard: (token, studioId, type, id) => apiClient.request(withStudio(`editor/projects/${type}/${id}/idea-board`, studioId), { token }),
      saveIdeaBoard: (token, studioId, type, id, body) => apiClient.request(withStudio(`editor/projects/${type}/${id}/idea-board`, studioId), { method: "POST", token, body }),
      createProject: (token, studioId, body) => apiClient.request("editor/projects", { method: "POST", token, body: { ...body, studio_id: studioId } }),
      listExports: (token, studioId, type, id) => apiClient.request(withStudio(`editor/projects/${type}/${id}/exports`, studioId), { token })
    };
  }

  globalScope.CreatorAppV2Api = globalScope.CreatorAppV2Api || {};
  globalScope.CreatorAppV2Api.createProjectEndpoints = createProjectEndpoints;
})(window);
