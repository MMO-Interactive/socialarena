const trackModal = document.getElementById('track-modal');
const itemModal = document.getElementById('item-modal');
const addTrackBtn = document.getElementById('add-track');
const addItemBtn = document.getElementById('add-item');
const trackCancel = document.getElementById('track-cancel');
const trackSave = document.getElementById('track-save');
const itemCancel = document.getElementById('item-cancel');
const itemSave = document.getElementById('item-save');
const zoomSlider = document.getElementById('timeline-zoom');
const durationInput = document.getElementById('timeline-duration');
const saveDurationBtn = document.getElementById('save-duration');
const ruler = document.getElementById('timeline-ruler');

let editingTrackId = null;
let editingItemId = null;

function openTrackModal(track = null) {
    editingTrackId = track?.id || null;
    document.getElementById('track-modal-title').textContent = track ? 'Edit Track' : 'Add Track';
    document.getElementById('track-name').value = track?.name || '';
    document.getElementById('track-type').value = track?.track_type || 'video';
    trackModal.style.display = 'flex';
}

function closeTrackModal() {
    trackModal.style.display = 'none';
}

function openItemModal(item = null, trackId = null) {
    editingItemId = item?.id || null;
    document.getElementById('item-modal-title').textContent = item ? 'Edit Clip' : 'Add Clip';
    document.getElementById('item-track').value = trackId || item?.track_id || '';
    document.getElementById('item-type').value = item?.item_type || 'video';
    document.getElementById('item-label').value = item?.label || '';
    document.getElementById('item-start').value = item?.start_time ?? 0;
    document.getElementById('item-duration').value = item?.duration ?? 5;
    document.getElementById('item-notes').value = item?.notes || '';
    document.getElementById('item-file').value = item?.file_url || '';
    const uploadInput = document.getElementById('item-file-upload');
    if (uploadInput) {
        uploadInput.value = '';
    }
    itemModal.style.display = 'flex';
}

function closeItemModal() {
    itemModal.style.display = 'none';
}

addTrackBtn?.addEventListener('click', () => openTrackModal());
addItemBtn?.addEventListener('click', () => openItemModal());
trackCancel?.addEventListener('click', closeTrackModal);
itemCancel?.addEventListener('click', closeItemModal);

trackModal?.addEventListener('click', (event) => {
    if (event.target === trackModal) {
        closeTrackModal();
    }
});

itemModal?.addEventListener('click', (event) => {
    if (event.target === itemModal) {
        closeItemModal();
    }
});

async function sendTimelineRequest(payload) {
    const response = await fetch('includes/timeline_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

trackSave?.addEventListener('click', async () => {
    const name = document.getElementById('track-name').value.trim();
    if (!name) {
        alert('Track name is required.');
        return;
    }

    const payload = {
        action: editingTrackId ? 'update_track' : 'create_track',
        project_id: window.timelineContext.projectId,
        track_id: editingTrackId,
        name,
        track_type: document.getElementById('track-type').value
    };

    try {
        await sendTimelineRequest(payload);
        window.location.reload();
    } catch (error) {
        alert(error.message);
    }
});

itemSave?.addEventListener('click', async () => {
    const trackId = document.getElementById('item-track').value;
    const label = document.getElementById('item-label').value.trim();

    if (!trackId) {
        alert('Select a track first.');
        return;
    }

    let fileUrl = document.getElementById('item-file').value.trim();
    const uploadInput = document.getElementById('item-file-upload');
    if (uploadInput?.files?.length) {
        const formData = new FormData();
        formData.append('asset', uploadInput.files[0]);
        const uploadResponse = await fetch('includes/upload_timeline_asset.php', {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadResponse.json();
        if (uploadData.success) {
            fileUrl = uploadData.url;
        }
    }

    const payload = {
        action: editingItemId ? 'update_item' : 'create_item',
        item_id: editingItemId,
        track_id: Number(trackId),
        item_type: document.getElementById('item-type').value,
        label,
        file_url: fileUrl,
        start_time: document.getElementById('item-start').value,
        duration: document.getElementById('item-duration').value,
        notes: document.getElementById('item-notes').value.trim()
    };

    try {
        await sendTimelineRequest(payload);
        window.location.reload();
    } catch (error) {
        alert(error.message);
    }
});

saveDurationBtn?.addEventListener('click', async () => {
    const duration = Number(durationInput.value);
    if (!duration || duration < 1) {
        alert('Duration must be positive.');
        return;
    }
    try {
        await sendTimelineRequest({
            action: 'update_project',
            project_id: window.timelineContext.projectId,
            duration_seconds: duration
        });
        window.location.reload();
    } catch (error) {
        alert(error.message);
    }
});

function applyTimelineLayout() {
    const zoomValue = Number(zoomSlider?.value || 80);
    const pxPerSecond = zoomValue;

    document.querySelectorAll('.track-lane').forEach(lane => {
        lane.style.backgroundSize = `${pxPerSecond}px 100%`;
    });

    document.querySelectorAll('.timeline-item').forEach(item => {
        const start = Number(item.dataset.start || 0);
        const duration = Number(item.dataset.duration || 1);
        item.style.left = `${start * pxPerSecond}px`;
        item.style.width = `${Math.max(duration * pxPerSecond, 60)}px`;
        if (item.dataset.itemType === 'image' && item.dataset.fileUrl) {
            item.style.setProperty('--thumb-url', `url(\"${item.dataset.fileUrl}\")`);
            item.classList.add('timeline-item--thumb');
        } else {
            item.style.removeProperty('--thumb-url');
            item.classList.remove('timeline-item--thumb');
        }
    });

    renderRuler(pxPerSecond);
}

function renderRuler(pxPerSecond) {
    if (!ruler) return;
    const duration = window.timelineContext.durationSeconds || 300;
    ruler.innerHTML = '';
    const tickEvery = 5;
    for (let t = 0; t <= duration; t += tickEvery) {
        const tick = document.createElement('div');
        tick.className = 'tick';
        tick.style.width = `${tickEvery * pxPerSecond}px`;
        tick.textContent = `${t}s`;
        ruler.appendChild(tick);
    }
}

zoomSlider?.addEventListener('input', applyTimelineLayout);

applyTimelineLayout();

const trackCards = document.querySelectorAll('.track');
trackCards.forEach(track => {
    const trackId = Number(track.dataset.trackId);
    track.querySelectorAll('[data-action="edit-track"]').forEach(button => {
        button.addEventListener('click', () => {
            const name = track.querySelector('strong')?.textContent || '';
            const type = track.querySelector('span')?.textContent || 'video';
            openTrackModal({ id: trackId, name, track_type: type });
        });
    });
    track.querySelectorAll('[data-action="delete-track"]').forEach(button => {
        button.addEventListener('click', async () => {
            if (!confirm('Delete this track and all clips?')) return;
            try {
                await sendTimelineRequest({ action: 'delete_track', track_id: trackId });
                window.location.reload();
            } catch (error) {
                alert(error.message);
            }
        });
    });

    track.querySelectorAll('.timeline-item').forEach(item => {
        item.addEventListener('click', () => {
            const data = {
                id: Number(item.dataset.itemId),
                track_id: trackId,
                item_type: item.dataset.itemType,
                label: item.dataset.label,
                file_url: item.dataset.fileUrl,
                start_time: item.dataset.start,
                duration: item.dataset.duration,
                notes: item.dataset.notes
            };
            openItemModal(data, trackId);
        });
    });
});

const deleteButtons = document.querySelectorAll('.timeline-item [data-action="delete-item"]');
if (deleteButtons.length === 0) {
    document.querySelectorAll('.timeline-item').forEach(item => {
        item.addEventListener('contextmenu', async (event) => {
            event.preventDefault();
            if (!confirm('Delete this clip?')) return;
            try {
                await sendTimelineRequest({ action: 'delete_item', item_id: Number(item.dataset.itemId) });
                window.location.reload();
            } catch (error) {
                alert(error.message);
            }
        });
    });
}
