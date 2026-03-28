(() => {
  const list = document.getElementById('media-list');
  const addBtn = document.getElementById('media-add');
  if (!list || !addBtn) return;

  const seriesId = addBtn.dataset.seriesId;
  const typeSelect = document.getElementById('media-type');
  const urlRow = document.getElementById('media-url-row');
  const imageRow = document.getElementById('media-image-row');
  const urlInput = document.getElementById('media-url');
  const imageInput = document.getElementById('media-image');
  const releaseModal = document.getElementById('release-modal');
  const releaseClose = document.getElementById('release-close');
  const releaseSave = document.getElementById('release-save');
  const releaseTitle = document.getElementById('release-title');
  const releaseDescription = document.getElementById('release-description');
  const releaseThumbnail = document.getElementById('release-thumbnail');
  const releaseStatus = document.getElementById('release-status');
  const releaseVisibility = document.getElementById('release-visibility');
  const releaseResult = document.getElementById('release-result');
  let activeReleaseId = null;

  const toggleMediaInputs = () => {
    if (!typeSelect) return;
    const isScreenshot = typeSelect.value === 'screenshot';
    if (urlRow) urlRow.classList.toggle('hidden', isScreenshot);
    if (imageRow) imageRow.classList.toggle('hidden', !isScreenshot);
    if (isScreenshot && urlInput) {
      urlInput.value = '';
    }
    if (!isScreenshot && imageInput) {
      imageInput.value = '';
    }
  };

  const renderItem = (item) => {
    const div = document.createElement('div');
    div.className = 'media-item';
    const typeLabel = item.media_type ? item.media_type.toUpperCase() : 'MEDIA';
    const releaseState = item.release_status || 'draft';
    div.innerHTML = `
      <div class="media-item-meta">
        <strong>${item.title || 'Untitled'}</strong>
        <span>${typeLabel}</span>
      </div>
      <div class="media-item-meta">
        <span class="media-status-pill ${releaseState}">${releaseState}</span>
        ${item.released_at ? `<span>Released ${new Date(item.released_at).toLocaleDateString()}</span>` : ''}
      </div>
      <div class="media-item-url">${item.url}</div>
      <div class="media-thumb-preview">
        ${item.thumbnail_url ? `<img src="${item.thumbnail_url}" alt="">` : ''}
      </div>
      <div class="media-item-actions">
        <button class="btn" data-release="${item.id}">Release</button>
        <button class="btn danger-btn" data-id="${item.id}">Remove</button>
      </div>
    `;
    div.querySelector('[data-release]').addEventListener('click', () => {
      activeReleaseId = item.id;
      if (releaseTitle) releaseTitle.value = item.release_title || item.title || '';
      if (releaseDescription) releaseDescription.value = item.release_description || '';
      if (releaseThumbnail) releaseThumbnail.value = item.thumbnail_url || '';
      if (releaseStatus) releaseStatus.value = item.release_status || 'released';
      if (releaseVisibility) releaseVisibility.value = item.visibility || 'public';
      if (releaseResult) releaseResult.style.display = 'none';
      if (releaseModal) releaseModal.style.display = 'flex';
    });
    div.querySelector('[data-id]').addEventListener('click', async () => {
      if (!confirm('Remove this media item?')) return;
      const res = await fetch('includes/series_media_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_media', media_id: item.id })
      });
      const data = await res.json();
      if (data.success) {
        div.remove();
      } else {
        alert(data.error || 'Unable to delete');
      }
    });
    return div;
  };

  releaseClose?.addEventListener('click', () => {
    if (releaseModal) releaseModal.style.display = 'none';
  });

  releaseModal?.addEventListener('click', (event) => {
    if (event.target === releaseModal) {
      releaseModal.style.display = 'none';
    }
  });

  releaseSave?.addEventListener('click', async () => {
    if (!activeReleaseId) return;
    releaseSave.disabled = true;
    try {
      const res = await fetch('includes/series_media_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'release_media',
          media_id: activeReleaseId,
          release_title: releaseTitle?.value || '',
          release_description: releaseDescription?.value || '',
          release_status: releaseStatus?.value || 'released',
          thumbnail_url: releaseThumbnail?.value || '',
          visibility: releaseVisibility?.value || 'public'
        })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.error || 'Unable to save release');
        return;
      }
      if (releaseResult) {
        const watchUrl = `series_media_watch.php?id=${activeReleaseId}`;
        releaseResult.innerHTML = `Released. <a href="${watchUrl}" target="_blank" rel="noopener">View public page</a>
          <button class="btn secondary-btn" id="release-copy-link">Copy link</button>`;
        const copyBtn = releaseResult.querySelector('#release-copy-link');
        copyBtn?.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(watchUrl);
            copyBtn.textContent = 'Copied';
            setTimeout(() => {
              copyBtn.textContent = 'Copy link';
            }, 1500);
          } catch (e) {
            alert('Unable to copy link');
          }
        });
        releaseResult.style.display = 'block';
      }
      await loadList();
    } finally {
      releaseSave.disabled = false;
    }
  });

  const loadList = async () => {
    const res = await fetch('includes/series_media_handlers.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_media', series_id: seriesId })
    });
    const data = await res.json();
    list.innerHTML = '';
    if (!data.success || data.items.length === 0) {
      list.innerHTML = '<div class="media-empty">No public media yet.</div>';
      return;
    }
    data.items.forEach((item) => list.appendChild(renderItem(item)));
  };

  addBtn.addEventListener('click', async () => {
    const mediaType = typeSelect ? typeSelect.value : 'trailer';
    const title = document.getElementById('media-title').value.trim();
    const url = urlInput ? urlInput.value.trim() : '';
    const seasonId = document.getElementById('media-season').value;
    const episodeId = document.getElementById('media-episode').value;
    const thumb = document.getElementById('media-thumb').files[0];
    const screenshotFile = imageInput ? imageInput.files[0] : null;

    if (mediaType === 'screenshot') {
      if (!screenshotFile) {
        alert('Please upload a screenshot image.');
        return;
      }
    } else if (!url) {
      alert('Please add a URL.');
      return;
    }

    const formData = new FormData();
    formData.append('action', 'add_media');
    formData.append('series_id', seriesId);
    formData.append('media_type', mediaType);
    formData.append('title', title);
    if (mediaType !== 'screenshot') {
      formData.append('url', url);
    }
    if (seasonId) formData.append('season_id', seasonId);
    if (episodeId) formData.append('episode_id', episodeId);
    if (thumb) formData.append('thumbnail', thumb);
    if (screenshotFile) formData.append('media_image', screenshotFile);

    const res = await fetch('includes/series_media_handlers.php', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'Unable to add media');
      return;
    }
    document.getElementById('media-title').value = '';
    if (urlInput) urlInput.value = '';
    if (imageInput) imageInput.value = '';
    document.getElementById('media-thumb').value = '';
    await loadList();
  });

  if (typeSelect) {
    typeSelect.addEventListener('change', toggleMediaInputs);
    toggleMediaInputs();
  }

  loadList();
})();
