const trackModal = document.getElementById('track-modal');
const addTrackBtn = document.getElementById('add-track');
const cancelTrackBtn = document.getElementById('track-cancel');
const saveTrackBtn = document.getElementById('track-save');
const coverFileInput = document.getElementById('track-cover-file');
const audioFileInput = document.getElementById('track-audio-file');

let editingTrackId = null;

function openTrackModal(track = null) {
    editingTrackId = track?.id || null;
    document.getElementById('track-modal-title').textContent = track ? 'Edit Track' : 'Add Track';
    document.getElementById('track-title').value = track?.title || '';
    document.getElementById('track-artist').value = track?.artist || '';
    document.getElementById('track-genre').value = track?.genre || '';
    document.getElementById('track-bpm').value = track?.bpm || '';
    document.getElementById('track-key').value = track?.musical_key || '';
    document.getElementById('track-mood').value = track?.mood || '';
    document.getElementById('track-description').value = track?.description || '';
    document.getElementById('track-tags').value = track?.tags || '';
    document.getElementById('track-cover').value = track?.cover_image_url || '';
    document.getElementById('track-studio').value = track?.studio_id || '';
    document.getElementById('track-visibility').value = track?.visibility || 'private';
    if (coverFileInput) coverFileInput.value = '';
    if (audioFileInput) audioFileInput.value = '';
    trackModal.style.display = 'flex';
}

function closeTrackModal() {
    trackModal.style.display = 'none';
}

addTrackBtn?.addEventListener('click', () => openTrackModal());
cancelTrackBtn?.addEventListener('click', closeTrackModal);

trackModal?.addEventListener('click', (event) => {
    if (event.target === trackModal) {
        closeTrackModal();
    }
});

saveTrackBtn?.addEventListener('click', async () => {
    let coverUrl = document.getElementById('track-cover').value.trim();
    const coverFile = coverFileInput?.files?.[0];
    if (coverFile) {
        const formData = new FormData();
        formData.append('cover', coverFile);
        const uploadResponse = await fetch('includes/upload_music_cover.php', {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadResponse.json();
        if (uploadData.success) {
            coverUrl = uploadData.url;
        }
    }

    let audioUrl = null;
    const audioFile = audioFileInput?.files?.[0];
    if (audioFile) {
        const formData = new FormData();
        formData.append('audio', audioFile);
        const uploadResponse = await fetch('includes/upload_music_file.php', {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadResponse.json();
        if (uploadData.success) {
            audioUrl = uploadData.url;
        }
    }

    const payload = {
        action: editingTrackId ? 'update_track' : 'create_track',
        track_id: editingTrackId,
        title: document.getElementById('track-title').value.trim(),
        artist: document.getElementById('track-artist').value.trim(),
        genre: document.getElementById('track-genre').value.trim(),
        bpm: document.getElementById('track-bpm').value.trim(),
        musical_key: document.getElementById('track-key').value.trim(),
        mood: document.getElementById('track-mood').value.trim(),
        description: document.getElementById('track-description').value.trim(),
        tags: document.getElementById('track-tags').value.trim(),
        cover_image_url: coverUrl,
        file_url: audioUrl,
        studio_id: document.getElementById('track-studio').value || null,
        visibility: document.getElementById('track-visibility').value
    };

    const response = await fetch('includes/music_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.success) {
        window.location.reload();
    }
});

document.querySelectorAll('.music-card').forEach(card => {
    card.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.dataset.action;
            const trackId = Number(card.dataset.trackId);
            const track = {
                id: trackId,
                title: card.querySelector('h3')?.textContent || '',
                artist: card.querySelector('.music-meta span:nth-child(1)')?.textContent || '',
                genre: card.querySelector('.music-meta span:nth-child(2)')?.textContent || '',
                mood: card.querySelector('.music-meta span:nth-child(3)')?.textContent || '',
                description: card.querySelector('p')?.textContent || '',
                tags: card.querySelector('.music-tags')?.textContent || '',
                cover_image_url: card.querySelector('img')?.getAttribute('src') || '',
                studio_id: card.dataset.studioId || '',
                visibility: card.dataset.visibility || 'private'
            };

            if (action === 'edit') {
                openTrackModal(track);
            } else if (action === 'delete') {
                if (!confirm('Delete this track?')) return;
                const response = await fetch('includes/music_handlers.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete_track', track_id: trackId })
                });
                const data = await response.json();
                if (data.success) {
                    card.remove();
                }
            }
        });
    });
});
