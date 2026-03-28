const modal = document.getElementById('board-modal');
const createBtn = document.getElementById('create-board');
const cancelBtn = document.getElementById('cancel-board');
const saveBtn = document.getElementById('save-board');

function openModal() {
    modal.style.display = 'flex';
}

function closeModal() {
    modal.style.display = 'none';
}

createBtn?.addEventListener('click', openModal);
cancelBtn?.addEventListener('click', closeModal);

saveBtn?.addEventListener('click', async () => {
    const title = document.getElementById('board-title').value.trim();
    const description = document.getElementById('board-description').value.trim();
    const studioId = document.getElementById('board-studio')?.value || null;
    const visibility = document.getElementById('board-visibility')?.value || 'private';
    if (!title) return;

    const response = await fetch('includes/idea_board_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'create_board',
            title,
            description,
            studio_id: studioId,
            visibility
        })
    });
    const data = await response.json();
    if (data.success) {
        window.location.href = `idea_board.php?id=${data.id}`;
    }
});
