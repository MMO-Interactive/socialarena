const propModal = document.getElementById('prop-modal');
const addPropBtn = document.getElementById('add-prop');
const cancelPropBtn = document.getElementById('prop-cancel');
const savePropBtn = document.getElementById('prop-save');
const coverFileInput = document.getElementById('prop-cover-file');

let editingPropId = null;

function openPropModal(prop = null) {
    editingPropId = prop?.id || null;
    document.getElementById('prop-modal-title').textContent = prop ? 'Edit Prop' : 'Add Prop';
    document.getElementById('prop-name').value = prop?.name || '';
    document.getElementById('prop-type').value = prop?.prop_type || '';
    document.getElementById('prop-series').value = prop?.series_id || '';
    document.getElementById('prop-description').value = prop?.description || '';
    document.getElementById('prop-tags').value = prop?.tags || '';
    document.getElementById('prop-cover').value = prop?.cover_image_url || '';
    document.getElementById('prop-studio').value = prop?.studio_id || '';
    document.getElementById('prop-visibility').value = prop?.visibility || 'private';
    if (coverFileInput) {
        coverFileInput.value = '';
    }
    propModal.style.display = 'flex';
}

function closePropModal() {
    propModal.style.display = 'none';
}

addPropBtn?.addEventListener('click', () => openPropModal());
cancelPropBtn?.addEventListener('click', closePropModal);

propModal?.addEventListener('click', (event) => {
    if (event.target === propModal) {
        closePropModal();
    }
});

savePropBtn?.addEventListener('click', async () => {
    let coverUrl = document.getElementById('prop-cover').value.trim();
    const file = coverFileInput?.files?.[0];
    if (file) {
        const formData = new FormData();
        formData.append('cover', file);
        const uploadResponse = await fetch('includes/upload_prop_image.php', {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadResponse.json();
        if (uploadData.success) {
            coverUrl = uploadData.url;
        }
    }

    const payload = {
        action: editingPropId ? 'update_prop' : 'create_prop',
        prop_id: editingPropId,
        name: document.getElementById('prop-name').value.trim(),
        prop_type: document.getElementById('prop-type').value.trim(),
        series_id: document.getElementById('prop-series').value || null,
        description: document.getElementById('prop-description').value.trim(),
        tags: document.getElementById('prop-tags').value.trim(),
        cover_image_url: coverUrl,
        studio_id: document.getElementById('prop-studio').value || null,
        visibility: document.getElementById('prop-visibility').value
    };

    const response = await fetch('includes/prop_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.success) {
        window.location.reload();
    }
});

document.querySelectorAll('.prop-card').forEach(card => {
    card.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.dataset.action;
            const propId = Number(card.dataset.propId);
            const prop = {
                id: propId,
                name: card.querySelector('h3')?.textContent || '',
                prop_type: card.querySelector('.prop-meta span:nth-child(1)')?.textContent || '',
                series_id: card.dataset.seriesId || '',
                description: card.querySelector('p')?.textContent || '',
                tags: card.querySelector('.prop-tags')?.textContent || '',
                cover_image_url: card.querySelector('img')?.getAttribute('src') || '',
                studio_id: card.dataset.studioId || '',
                visibility: card.dataset.visibility || 'private'
            };

            if (action === 'edit') {
                openPropModal(prop);
            } else if (action === 'delete') {
                if (!confirm('Delete this prop?')) return;
                const response = await fetch('includes/prop_handlers.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete_prop', prop_id: propId })
                });
                const data = await response.json();
                if (data.success) {
                    card.remove();
                }
            }
        });
    });
});
