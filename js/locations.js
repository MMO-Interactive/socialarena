const locationModal = document.getElementById('location-modal');
const addLocationBtn = document.getElementById('add-location');
const cancelLocationBtn = document.getElementById('location-cancel');
const saveLocationBtn = document.getElementById('location-save');
const coverFileInput = document.getElementById('location-cover-file');

let editingLocationId = null;

function openLocationModal(location = null) {
    editingLocationId = location?.id || null;
    document.getElementById('location-modal-title').textContent = location ? 'Edit Location' : 'Add Location';
    document.getElementById('location-name').value = location?.name || '';
    document.getElementById('location-type').value = location?.location_type || '';
    document.getElementById('location-region').value = location?.region || '';
    document.getElementById('location-description').value = location?.description || '';
    document.getElementById('location-tags').value = location?.tags || '';
    document.getElementById('location-cover').value = location?.cover_image_url || '';
    document.getElementById('location-studio').value = location?.studio_id || '';
    document.getElementById('location-visibility').value = location?.visibility || 'private';
    if (coverFileInput) {
        coverFileInput.value = '';
    }
    locationModal.style.display = 'flex';
}

function closeLocationModal() {
    locationModal.style.display = 'none';
}

addLocationBtn?.addEventListener('click', () => openLocationModal());
cancelLocationBtn?.addEventListener('click', closeLocationModal);

locationModal?.addEventListener('click', (event) => {
    if (event.target === locationModal) {
        closeLocationModal();
    }
});

saveLocationBtn?.addEventListener('click', async () => {
    let coverUrl = document.getElementById('location-cover').value.trim();
    const file = coverFileInput?.files?.[0];
    if (file) {
        const formData = new FormData();
        formData.append('cover', file);
        const uploadResponse = await fetch('includes/upload_location_cover.php', {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadResponse.json();
        if (uploadData.success) {
            coverUrl = uploadData.url;
        }
    }

    const payload = {
        action: editingLocationId ? 'update_location' : 'create_location',
        location_id: editingLocationId,
        name: document.getElementById('location-name').value.trim(),
        location_type: document.getElementById('location-type').value.trim(),
        region: document.getElementById('location-region').value.trim(),
        description: document.getElementById('location-description').value.trim(),
        tags: document.getElementById('location-tags').value.trim(),
        cover_image_url: coverUrl,
        studio_id: document.getElementById('location-studio').value || null,
        visibility: document.getElementById('location-visibility').value
    };

    const response = await fetch('includes/location_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.success) {
        window.location.reload();
    }
});

document.querySelectorAll('.location-card').forEach(card => {
    card.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.dataset.action;
            const locationId = Number(card.dataset.locationId);
            const location = {
                id: locationId,
                name: card.querySelector('h3')?.textContent || '',
                location_type: card.querySelector('.location-meta span:nth-child(1)')?.textContent || '',
                region: card.querySelector('.location-meta span:nth-child(2)')?.textContent || '',
                description: card.querySelector('p')?.textContent || '',
                tags: card.querySelector('.location-tags')?.textContent || '',
                cover_image_url: card.querySelector('img')?.getAttribute('src') || '',
                studio_id: card.dataset.studioId || '',
                visibility: card.dataset.visibility || 'private'
            };

            if (action === 'edit') {
                openLocationModal(location);
            } else if (action === 'delete') {
                if (!confirm('Delete this location?')) return;
                const response = await fetch('includes/location_handlers.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete_location', location_id: locationId })
                });
                const data = await response.json();
                if (data.success) {
                    card.remove();
                }
            }
        });
    });
});
