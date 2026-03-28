const studioModal = document.getElementById('studio-modal');
const createStudioBtn = document.getElementById('create-studio');
const studioCancelBtn = document.getElementById('studio-cancel');
const studioSaveBtn = document.getElementById('studio-save');

createStudioBtn?.addEventListener('click', () => {
    studioModal.style.display = 'flex';
});

studioCancelBtn?.addEventListener('click', () => {
    studioModal.style.display = 'none';
});

studioModal?.addEventListener('click', (event) => {
    if (event.target === studioModal) {
        studioModal.style.display = 'none';
    }
});

studioSaveBtn?.addEventListener('click', async () => {
    const payload = {
        action: 'create_studio',
        name: document.getElementById('studio-name').value.trim(),
        description: document.getElementById('studio-description').value.trim(),
        logo_url: document.getElementById('studio-logo').value.trim(),
        banner_url: document.getElementById('studio-banner').value.trim()
    };
    const response = await fetch('includes/studio_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.success) {
        window.location.href = `studio_profile.php?id=${data.id}`;
    } else {
        alert(data.error || 'Failed to create studio');
    }
});
