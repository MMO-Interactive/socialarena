(function attachEditorRenderUtilsModules(globalScope) {
  const modules = globalScope.EditorUiModules || (globalScope.EditorUiModules = {});

  modules.createRenderUtilsHelpers = function createRenderUtilsHelpers(deps) {
    const { escapeHtml } = deps;

    function formatAssetMeta(asset) {
      if ((asset.kind === "audio" || asset.kind === "video") && typeof asset.durationSeconds === "number") {
        return `${asset.durationSeconds.toFixed(1)} sec`;
      }

      if (asset.kind === "audio") {
        return asset.meta || "imported audio";
      }
      if (asset.kind === "image") {
        return asset.meta || "imported image";
      }
      return asset.meta || "imported video";
    }

    function formatDurationLabel(seconds, fallback = "3.0 sec") {
      if (!Number.isFinite(seconds)) {
        return fallback;
      }

      return `${seconds.toFixed(1)} sec`;
    }

    function formatHistoryTimestamp(value) {
      if (!value) {
        return "Unknown time";
      }

      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        return String(value);
      }

      return date.toLocaleString();
    }

    function renderAssetThumbnail(asset) {
      if (asset.kind === "image" && asset.sourceUrl) {
        return `<img class="asset-thumb-image" src="${escapeHtml(asset.sourceUrl)}" alt="${escapeHtml(asset.name)}" />`;
      }

      if (asset.kind === "video" && asset.sourceUrl) {
        return `
          <video class="asset-thumb-video" src="${escapeHtml(asset.sourceUrl)}" muted playsinline preload="metadata"></video>
          <div class="asset-thumb-badge">Video</div>
        `;
      }

      if (asset.kind === "audio") {
        return `
          <div class="asset-thumb-audio">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        `;
      }

      return `<div class="asset-thumb-placeholder">${escapeHtml(asset.kind || "media")}</div>`;
    }

    function renderAssetModalContent(asset, project) {
      if (!asset) {
        return `
          <div class="modal-preview-copy">
            <strong>No asset selected</strong>
            <span>Select a media file from the media bin.</span>
          </div>
        `;
      }

      if (asset.kind === "image" && asset.sourceUrl) {
        return `<img class="modal-preview-image" src="${escapeHtml(asset.sourceUrl)}" alt="${escapeHtml(asset.name)}" />`;
      }

      if (asset.kind === "video" && asset.sourceUrl) {
        return `<video class="modal-preview-video" src="${escapeHtml(asset.sourceUrl)}" controls autoplay playsinline preload="metadata"></video>`;
      }

      if (asset.kind === "audio" && asset.sourceUrl) {
        return `
          <div class="modal-audio-shell">
            <div class="preview-audio-wave modal-audio-wave">
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="modal-preview-copy">
              <strong>${escapeHtml(asset.name)}</strong>
              <span>${escapeHtml(project.name)}</span>
            </div>
            <audio class="modal-audio-player" src="${escapeHtml(asset.sourceUrl)}" controls autoplay preload="metadata"></audio>
          </div>
        `;
      }

      return `
        <div class="modal-preview-copy">
          <strong>${escapeHtml(asset.name)}</strong>
          <span>${escapeHtml(project.name)}</span>
        </div>
      `;
    }

    return {
      formatAssetMeta,
      formatDurationLabel,
      formatHistoryTimestamp,
      renderAssetThumbnail,
      renderAssetModalContent
    };
  };
})(window);
