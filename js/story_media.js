(() => {
  const list = document.getElementById('story-media-list');
  const addBtn = document.getElementById('story-media-add');
  if (!list || !addBtn) return;

  const storyId = addBtn.dataset.storyId;
  const releaseModal = document.getElementById('story-release-modal');
  const releaseClose = document.getElementById('story-release-close');
  const releaseSave = document.getElementById('story-release-save');
  const releaseTitle = document.getElementById('story-release-title');
  const releaseDescription = document.getElementById('story-release-description');
  const releaseThumbnail = document.getElementById('story-release-thumbnail');
  const releaseStatus = document.getElementById('story-release-status');
  const releaseVisibility = document.getElementById('story-release-visibility');
  const releaseResult = document.getElementById('story-release-result');
  let activeReleaseId = null;

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
      const res = await fetch('includes/story_media_handlers.php', {
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
      const res = await fetch('includes/story_media_handlers.php', {
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
        const watchUrl = `story_media_watch.php?id=${activeReleaseId}`;
        releaseResult.innerHTML = `Released. <a href="${watchUrl}" target="_blank" rel="noopener">View public page</a>
          <button class="btn secondary-btn" id="story-release-copy-link">Copy link</button>`;
        const copyBtn = releaseResult.querySelector('#story-release-copy-link');
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
    const res = await fetch('includes/story_media_handlers.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list_media', story_id: storyId })
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
    const mediaType = document.getElementById('story-media-type').value;
    const title = document.getElementById('story-media-title').value.trim();
    const url = document.getElementById('story-media-url').value.trim();
    const thumb = document.getElementById('story-media-thumb').files[0];

    if (!url) {
      alert('Please add a URL.');
      return;
    }

    const formData = new FormData();
    formData.append('action', 'add_media');
    formData.append('story_id', storyId);
    formData.append('media_type', mediaType);
    formData.append('title', title);
    formData.append('url', url);
    if (thumb) formData.append('thumbnail', thumb);

    const res = await fetch('includes/story_media_handlers.php', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!data.success) {
      alert(data.error || 'Unable to add media');
      return;
    }
    document.getElementById('story-media-title').value = '';
    document.getElementById('story-media-url').value = '';
    document.getElementById('story-media-thumb').value = '';
    await loadList();
  });

  loadList();
})();
