(() => {
  const modal = document.getElementById('release-manager-modal');
  const closeBtn = document.getElementById('release-manager-close');
  const saveBtn = document.getElementById('release-manager-save');
  const titleInput = document.getElementById('release-manager-title');
  const descInput = document.getElementById('release-manager-description');
  const thumbInput = document.getElementById('release-manager-thumbnail');
  const statusInput = document.getElementById('release-manager-status');
  const visibilityInput = document.getElementById('release-manager-visibility');
  const resultBox = document.getElementById('release-manager-result');
  if (!modal || !saveBtn) return;

  let activeId = null;
  let activeType = null;

  document.querySelectorAll('[data-release-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeId = btn.dataset.releaseId;
      activeType = btn.dataset.releaseType;
      if (titleInput) titleInput.value = '';
      if (descInput) descInput.value = '';
      if (thumbInput) thumbInput.value = '';
      if (statusInput) statusInput.value = 'released';
      if (visibilityInput) visibilityInput.value = 'public';
      if (resultBox) resultBox.style.display = 'none';
      modal.classList.add('is-open');
    });
  });

  closeBtn?.addEventListener('click', () => {
    modal.classList.remove('is-open');
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.classList.remove('is-open');
    }
  });

  saveBtn.addEventListener('click', async () => {
    if (!activeId || !activeType) return;
    saveBtn.disabled = true;
    try {
      const handler = activeType === 'series' ? 'includes/series_media_handlers.php' : 'includes/story_media_handlers.php';
      const response = await fetch(handler, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'release_media',
          media_id: activeId,
          release_title: titleInput?.value || '',
          release_description: descInput?.value || '',
          release_status: statusInput?.value || 'released',
          thumbnail_url: thumbInput?.value || '',
          visibility: visibilityInput?.value || 'public'
        })
      });
      const data = await response.json();
      if (!data.success) {
        alert(data.error || 'Unable to save release');
        return;
      }
      if (resultBox) {
        const watchUrl = activeType === 'series'
          ? `series_media_watch.php?id=${activeId}`
          : `story_media_watch.php?id=${activeId}`;
        resultBox.innerHTML = `Released. <a href="${watchUrl}" target="_blank" rel="noopener">View public page</a>
          <button class="btn secondary-btn" id="release-manager-copy-link">Copy link</button>`;
        const copyBtn = resultBox.querySelector('#release-manager-copy-link');
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
        resultBox.style.display = 'block';
      }
      window.location.reload();
    } finally {
      saveBtn.disabled = false;
    }
  });
})();
