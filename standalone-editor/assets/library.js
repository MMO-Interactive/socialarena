(function attachEditorAssetLibraryModules(globalScope) {
  function createAssetLibraryHelpers(deps) {
    const {
      state,
      getSelectedAsset,
      assetClass,
      renderAssetThumbnail,
      formatAssetMeta,
      escapeHtml
    } = deps;

    function assetViewMeta(view) {
      const map = {
        "assets-media-bin": { title: "Media Bin", copy: "Browse all assets attached to the active project." },
        "assets-generated-images": { title: "Generated Images", copy: "Image outputs generated through the workflow and platform services." },
        "assets-generated-videos": { title: "Generated Videos", copy: "Video clips generated from approved starting images and prompts." },
        "assets-music-library": { title: "Music Library", copy: "Audio and music assets available to the current project." },
        "assets-voice-library": { title: "Voice Library", copy: "Dialogue, voice, and narration-oriented assets." },
        "assets-brand-assets": { title: "Brand Assets", copy: "Reference stills, title cards, and reusable brand media." }
      };
      return map[view] || { title: "Assets", copy: "Project assets." };
    }

    function filterAssetByReview(asset, reviewFilter) {
      if (reviewFilter === "all") {
        return true;
      }
      if (reviewFilter === "generated") {
        return asset.generated || asset.sourceType === "generated";
      }
      return asset.reviewStatus === reviewFilter;
    }

    function filterAssetsForBrowser(assets) {
      const query = state.assetBrowser.query.trim().toLowerCase();
      const reviewFilter = state.assetBrowser.reviewFilter || "all";

      return assets.filter((asset) => {
        if (!filterAssetByReview(asset, reviewFilter)) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          asset.name,
          asset.kind,
          asset.meta,
          ...(Array.isArray(asset.tags) ? asset.tags : [])
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });
    }

    function assetBadgeLabel(asset) {
      if (asset.reviewStatus === "approved") {
        return "Approved";
      }
      if (asset.reviewStatus === "rejected") {
        return "Rejected";
      }
      if (asset.generated) {
        return "Generated";
      }
      return "Pending";
    }

    function assetFilterForView(view, asset) {
      if (view === "assets-generated-images") {
        return asset.kind === "image" && (asset.generated || asset.sourceType === "generated");
      }
      if (view === "assets-generated-videos") {
        return asset.kind === "video" && (asset.generated || asset.sourceType === "generated");
      }
      if (view === "assets-music-library") {
        return asset.kind === "audio";
      }
      if (view === "assets-voice-library") {
        return asset.kind === "audio" && (/voice|dialogue|narration|speech/i.test(asset.name) || asset.tags.includes("voice"));
      }
      if (view === "assets-brand-assets") {
        return asset.kind === "image" || asset.kind === "title";
      }
      return true;
    }

    function renderAssetManagementView(project) {
      const meta = assetViewMeta(state.currentView);
      const scopedAssets = (project.assets || []).filter((asset) => assetFilterForView(state.currentView, asset));
      const filteredAssets = filterAssetsForBrowser(scopedAssets);
      const selectedAsset = filteredAssets.find((asset) => asset.id === state.selectedAssetId) || getSelectedAsset(project) || filteredAssets[0] || null;
      const stats = {
        total: scopedAssets.length,
        approved: scopedAssets.filter((asset) => asset.reviewStatus === "approved").length,
        pending: scopedAssets.filter((asset) => asset.reviewStatus !== "approved" && asset.reviewStatus !== "rejected").length,
        generated: scopedAssets.filter((asset) => asset.generated || asset.sourceType === "generated").length
      };

      return `
        <section class="studio-shell">
          <div class="studio-hero panel">
            <div>
              <div class="eyebrow">Assets</div>
              <h2>${escapeHtml(meta.title)}</h2>
              <p class="dashboard-copy">${escapeHtml(meta.copy)}</p>
            </div>
            <div class="dashboard-hero-actions">
              <button class="accent-button" type="button" data-action="import-assets">Import Assets</button>
              <button class="ghost-button" type="button" data-action="open-editor">Open Editor</button>
            </div>
          </div>
          <section class="studio-grid studio-grid-four">
            <article class="dashboard-stat-card">
              <span>Total assets</span>
              <strong>${stats.total}</strong>
            </article>
            <article class="dashboard-stat-card">
              <span>Approved</span>
              <strong>${stats.approved}</strong>
            </article>
            <article class="dashboard-stat-card">
              <span>Pending review</span>
              <strong>${stats.pending}</strong>
            </article>
            <article class="dashboard-stat-card">
              <span>Generated</span>
              <strong>${stats.generated}</strong>
            </article>
          </section>
          <section class="studio-grid studio-grid-two">
            <article class="panel studio-panel asset-library-panel">
              <div class="panel-header">
                <h2>${escapeHtml(meta.title)}</h2>
                <span class="panel-status">${filteredAssets.length}</span>
              </div>
              <div class="asset-browser-toolbar">
                <input
                  class="idea-input asset-search-input"
                  type="search"
                  placeholder="Search assets, tags, or type"
                  value="${escapeHtml(state.assetBrowser.query)}"
                  data-input="asset-browser-query"
                />
                <div class="inline-actions asset-filter-group">
                  <button class="ghost-button compact-button${state.assetBrowser.reviewFilter === "all" ? " active-filter" : ""}" type="button" data-action="set-asset-review-filter" data-filter="all">All</button>
                  <button class="ghost-button compact-button${state.assetBrowser.reviewFilter === "pending" ? " active-filter" : ""}" type="button" data-action="set-asset-review-filter" data-filter="pending">Pending</button>
                  <button class="ghost-button compact-button${state.assetBrowser.reviewFilter === "approved" ? " active-filter" : ""}" type="button" data-action="set-asset-review-filter" data-filter="approved">Approved</button>
                  <button class="ghost-button compact-button${state.assetBrowser.reviewFilter === "generated" ? " active-filter" : ""}" type="button" data-action="set-asset-review-filter" data-filter="generated">Generated</button>
                </div>
              </div>
              <div class="studio-asset-grid">
                ${
                  filteredAssets.length
                    ? filteredAssets.map((asset) => `
                      <button class="${assetClass(asset.kind)}${asset.id === state.selectedAssetId ? " selected" : ""}" type="button" data-asset-id="${asset.id}">
                        <div class="asset-thumb">${renderAssetThumbnail(asset)}</div>
                        <span>${escapeHtml(asset.name)}</span>
                        <small>${formatAssetMeta(asset)}</small>
                      </button>
                    `).join("")
                    : '<div class="empty-state">No assets in this library yet.</div>'
                }
              </div>
            </article>
            <article class="panel studio-panel asset-detail-panel">
              <div class="panel-header">
                <h2>Asset Details</h2>
                <span class="panel-status">${selectedAsset ? assetBadgeLabel(selectedAsset) : "No Selection"}</span>
              </div>
              ${
                selectedAsset
                  ? `
                    <div class="asset-detail-card">
                      <div class="asset-detail-preview">${renderAssetThumbnail(selectedAsset)}</div>
                      <strong>${escapeHtml(selectedAsset.name)}</strong>
                      <span>${escapeHtml(selectedAsset.kind)} · ${escapeHtml(formatAssetMeta(selectedAsset))}</span>
                      <div class="asset-tag-row">
                        <span class="asset-review-badge ${selectedAsset.reviewStatus}">${escapeHtml(assetBadgeLabel(selectedAsset))}</span>
                        ${(selectedAsset.tags || []).map((tag) => `<span class="asset-tag">${escapeHtml(tag)}</span>`).join("") || '<span class="asset-tag muted">No tags</span>'}
                      </div>
                      <div class="asset-tag-editor">
                        <input
                          class="idea-input asset-tag-input"
                          type="text"
                          placeholder="Add any tag you want"
                          value="${escapeHtml(state.assetBrowser.tagDraft)}"
                          data-input="asset-tag-draft"
                        />
                        <button class="ghost-button compact-button inspector-button" type="button" data-action="tag-selected-asset">Add Tag</button>
                      </div>
                      <div class="inline-actions">
                        <button class="ghost-button compact-button inspector-button" type="button" data-action="open-editor">Open In Editor</button>
                        <button class="ghost-button compact-button inspector-button" type="button" data-action="add-to-timeline">Add To Timeline</button>
                        <button class="ghost-button compact-button inspector-button" type="button" data-action="open-selected-asset-preview">Preview</button>
                        <button class="ghost-button compact-button inspector-button" type="button" data-action="approve-selected-asset">Approve</button>
                        <button class="ghost-button compact-button inspector-button" type="button" data-action="reject-selected-asset">Reject</button>
                      </div>
                    </div>
                  `
                  : '<div class="empty-state">Select an asset to inspect and review it.</div>'
              }
            </article>
          </section>
        </section>
      `;
    }

    return {
      assetViewMeta,
      filterAssetByReview,
      filterAssetsForBrowser,
      assetBadgeLabel,
      assetFilterForView,
      renderAssetManagementView
    };
  }

  globalScope.EditorAssetModules = globalScope.EditorAssetModules || {};
  globalScope.EditorAssetModules.createAssetLibraryHelpers = createAssetLibraryHelpers;
})(window);
