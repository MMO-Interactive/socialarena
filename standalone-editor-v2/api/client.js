(function attachV2ApiClient(globalScope) {
  function createApiClient(startupContext) {
    const baseUrl = String(startupContext?.apiBaseUrl || "http://localhost/adventure/api/v1").replace(/\/+$/, "");

    async function request(path, options = {}) {
      return window.creatorAppV2.apiRequest({
        baseUrl,
        path,
        method: options.method || "GET",
        token: options.token,
        body: options.body
      });
    }

    return {
      baseUrl,
      request
    };
  }

  globalScope.CreatorAppV2Api = {
    createApiClient
  };
})(window);
