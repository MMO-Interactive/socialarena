const wardrobeModal = document.getElementById('wardrobe-modal');
const addWardrobeBtn = document.getElementById('add-wardrobe');
const cancelWardrobeBtn = document.getElementById('wardrobe-cancel');
const saveWardrobeBtn = document.getElementById('wardrobe-save');
const coverFileInput = document.getElementById('wardrobe-cover-file');

let editingWardrobeId = null;

function openWardrobeModal(wardrobe = null) {
    editingWardrobeId = wardrobe?.id || null;
    document.getElementById('wardrobe-modal-title').textContent = wardrobe ? 'Edit Wardrobe' : 'Add Wardrobe';
    document.getElementById('wardrobe-name').value = wardrobe?.name || '';
    document.getElementById('wardrobe-type').value = wardrobe?.wardrobe_type || '';
    document.getElementById('wardrobe-series').value = wardrobe?.series_id || '';
    document.getElementById('wardrobe-description').value = wardrobe?.description || '';
    document.getElementById('wardrobe-tags').value = wardrobe?.tags || '';
    document.getElementById('wardrobe-cover').value = wardrobe?.cover_image_url || '';
    document.getElementById('wardrobe-studio').value = wardrobe?.studio_id || '';
    document.getElementById('wardrobe-visibility').value = wardrobe?.visibility || 'private';
    if (coverFileInput) {
        coverFileInput.value = '';
    }
    wardrobeModal.style.display = 'flex';
}

function closeWardrobeModal() {
    wardrobeModal.style.display = 'none';
}

addWardrobeBtn?.addEventListener('click', () => openWardrobeModal());
cancelWardrobeBtn?.addEventListener('click', closeWardrobeModal);

wardrobeModal?.addEventListener('click', (event) => {
    if (event.target === wardrobeModal) {
        closeWardrobeModal();
    }
});

saveWardrobeBtn?.addEventListener('click', async () => {
    let coverUrl = document.getElementById('wardrobe-cover').value.trim();
    const file = coverFileInput?.files?.[0];
    if (file) {
        const formData = new FormData();
        formData.append('cover', file);
        const uploadResponse = await fetch('includes/upload_wardrobe_image.php', {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadResponse.json();
        if (uploadData.success) {
            coverUrl = uploadData.url;
        }
    }

    const payload = {
        action: editingWardrobeId ? 'update_wardrobe' : 'create_wardrobe',
        wardrobe_id: editingWardrobeId,
        name: document.getElementById('wardrobe-name').value.trim(),
        wardrobe_type: document.getElementById('wardrobe-type').value.trim(),
        series_id: document.getElementById('wardrobe-series').value || null,
        description: document.getElementById('wardrobe-description').value.trim(),
        tags: document.getElementById('wardrobe-tags').value.trim(),
        cover_image_url: coverUrl,
        studio_id: document.getElementById('wardrobe-studio').value || null,
        visibility: document.getElementById('wardrobe-visibility').value
    };

    const response = await fetch('includes/wardrobe_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.success) {
        window.location.reload();
    }
});

document.querySelectorAll('.wardrobe-card').forEach(card => {
    card.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.dataset.action;
            const wardrobeId = Number(card.dataset.wardrobeId);
            const seriesText = card.querySelector('.wardrobe-meta span:nth-child(2)')?.textContent || '';
            const seriesId = seriesText.startsWith('Series:') ? card.dataset.seriesId : '';
            const wardrobe = {
                id: wardrobeId,
                name: card.querySelector('h3')?.textContent || '',
                wardrobe_type: card.querySelector('.wardrobe-meta span:nth-child(1)')?.textContent || '',
                series_id: card.dataset.seriesId || '',
                description: card.querySelector('p')?.textContent || '',
                tags: card.querySelector('.wardrobe-tags')?.textContent || '',
                cover_image_url: card.querySelector('img')?.getAttribute('src') || '',
                studio_id: card.dataset.studioId || '',
                visibility: card.dataset.visibility || 'private'
            };

            if (action === 'edit') {
                openWardrobeModal(wardrobe);
            } else if (action === 'delete') {
                if (!confirm('Delete this wardrobe item?')) return;
                const response = await fetch('includes/wardrobe_handlers.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete_wardrobe', wardrobe_id: wardrobeId })
                });
                const data = await response.json();
                if (data.success) {
                    card.remove();
                }
            }
        });
    });
});
