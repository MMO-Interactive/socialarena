const addBtn = document.getElementById('add-cast');
const characterInput = document.getElementById('cast-character');
const roleInput = document.getElementById('cast-role');
const actorSelect = document.getElementById('cast-actor');

addBtn?.addEventListener('click', async () => {
    const characterName = characterInput.value.trim();
    const actorId = actorSelect.value;
    if (!characterName || !actorId) return;

    await fetch('includes/series_cast_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'add_cast',
            series_id: window.seriesCastContext.seriesId,
            actor_id: actorId,
            character_name: characterName,
            role_name: roleInput.value.trim()
        })
    });

    window.location.reload();
});

document.querySelectorAll('.cast-card button[data-action="remove"]').forEach(button => {
    button.addEventListener('click', async () => {
        const castId = Number(button.closest('.cast-card').dataset.castId);
        await fetch('includes/series_cast_handlers.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'remove_cast',
                cast_id: castId
            })
        });
        window.location.reload();
    });
});
