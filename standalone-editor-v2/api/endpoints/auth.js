(function attachV2AuthEndpoints(globalScope) {
  function createAuthEndpoints(apiClient) {
    return {
      login: (body) => apiClient.request("auth/editor-login", { method: "POST", body }),
      refresh: (token, body) => apiClient.request("auth/refresh", { method: "POST", token, body }),
      logout: (token, body) => apiClient.request("auth/logout", { method: "POST", token, body }),
      selectStudio: (token, body) => apiClient.request("auth/select-studio", { method: "POST", token, body })
    };
  }

  globalScope.CreatorAppV2Api = globalScope.CreatorAppV2Api || {};
  globalScope.CreatorAppV2Api.createAuthEndpoints = createAuthEndpoints;
})(window);
