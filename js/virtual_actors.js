const actorModal = document.getElementById('actor-modal');
const addActorBtn = document.getElementById('add-actor');
const cancelActorBtn = document.getElementById('actor-cancel');
const saveActorBtn = document.getElementById('actor-save');
const avatarFileInput = document.getElementById('actor-avatar-file');

let editingActorId = null;

function openActorModal(actor = null) {
    editingActorId = actor?.id || null;
    document.getElementById('actor-modal-title').textContent = actor ? 'Edit Actor' : 'Add Actor';
    document.getElementById('actor-name').value = actor?.name || '';
    document.getElementById('actor-gender').value = actor?.gender || '';
    document.getElementById('actor-age').value = actor?.age_range || '';
    document.getElementById('actor-description').value = actor?.description || '';
    document.getElementById('actor-tags').value = actor?.tags || '';
    document.getElementById('actor-avatar').value = actor?.avatar_url || '';
    document.getElementById('actor-studio').value = actor?.studio_id || '';
    document.getElementById('actor-visibility').value = actor?.visibility || 'private';
    if (avatarFileInput) {
        avatarFileInput.value = '';
    }
    actorModal.style.display = 'flex';
}

function closeActorModal() {
    actorModal.style.display = 'none';
}

addActorBtn?.addEventListener('click', () => openActorModal());
cancelActorBtn?.addEventListener('click', closeActorModal);

actorModal?.addEventListener('click', (event) => {
    if (event.target === actorModal) {
        closeActorModal();
    }
});

saveActorBtn?.addEventListener('click', async () => {
    let avatarUrl = document.getElementById('actor-avatar').value.trim();
    const file = avatarFileInput?.files?.[0];
    if (file) {
        const formData = new FormData();
        formData.append('avatar', file);
        const uploadResponse = await fetch('includes/upload_actor_avatar.php', {
            method: 'POST',
            body: formData
        });
        const uploadData = await uploadResponse.json();
        if (uploadData.success) {
            avatarUrl = uploadData.url;
        }
    }

    const payload = {
        action: editingActorId ? 'update_actor' : 'create_actor',
        actor_id: editingActorId,
        name: document.getElementById('actor-name').value.trim(),
        gender: document.getElementById('actor-gender').value.trim(),
        age_range: document.getElementById('actor-age').value.trim(),
        description: document.getElementById('actor-description').value.trim(),
        tags: document.getElementById('actor-tags').value.trim(),
        avatar_url: avatarUrl,
        studio_id: document.getElementById('actor-studio').value || null,
        visibility: document.getElementById('actor-visibility').value
    };

    const response = await fetch('includes/virtual_actor_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.success) {
        window.location.reload();
    }
});

document.querySelectorAll('.actor-card').forEach(card => {
    card.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.dataset.action;
            const actorId = Number(card.dataset.actorId);
            const actor = {
                id: actorId,
                name: card.querySelector('h3')?.textContent || '',
                gender: card.querySelector('.actor-meta span:nth-child(1)')?.textContent || '',
                age_range: card.querySelector('.actor-meta span:nth-child(2)')?.textContent || '',
                description: card.querySelector('p')?.textContent || '',
                tags: card.querySelector('.actor-tags')?.textContent || '',
                avatar_url: card.querySelector('img')?.getAttribute('src') || '',
                studio_id: card.dataset.studioId || '',
                visibility: card.dataset.visibility || 'private'
            };

            if (action === 'edit') {
                openActorModal(actor);
            } else if (action === 'delete') {
                if (!confirm('Delete this actor?')) return;
                const response = await fetch('includes/virtual_actor_handlers.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'delete_actor', actor_id: actorId })
                });
                const data = await response.json();
                if (data.success) {
                    card.remove();
                }
            }
        });
    });
});
