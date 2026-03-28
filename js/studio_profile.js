const memberModal = document.getElementById('member-modal');
const addMemberBtn = document.getElementById('add-member');
const memberCancelBtn = document.getElementById('member-cancel');
const memberSaveBtn = document.getElementById('member-save');

addMemberBtn?.addEventListener('click', () => {
    memberModal.style.display = 'flex';
});

memberCancelBtn?.addEventListener('click', () => {
    memberModal.style.display = 'none';
});

memberModal?.addEventListener('click', (event) => {
    if (event.target === memberModal) {
        memberModal.style.display = 'none';
    }
});

memberSaveBtn?.addEventListener('click', async () => {
    const studioId = Number(memberSaveBtn.dataset.studioId);
    const payload = {
        action: 'add_member',
        studio_id: studioId,
        identifier: document.getElementById('member-identifier').value.trim(),
        role: document.getElementById('member-role').value
    };
    const response = await fetch('includes/studio_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.success) {
        window.location.reload();
    } else {
        alert(data.error || 'Failed to add member');
    }
});

document.querySelectorAll('.panel-item button').forEach(button => {
    button.addEventListener('click', async () => {
        const action = button.dataset.action;
        const memberId = Number(button.dataset.userId);
        const studioId = Number(memberSaveBtn.dataset.studioId);
        if (!action || !memberId) return;

        if (action === 'remove') {
            if (!confirm('Remove this member?')) return;
            const response = await fetch('includes/studio_handlers.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'remove_member', studio_id: studioId, member_id: memberId })
            });
            const data = await response.json();
            if (data.success) {
                window.location.reload();
            } else {
                alert(data.error || 'Failed to remove member');
            }
        }

        if (action === 'role') {
            const newRole = prompt('Enter role: admin or member');
            if (!newRole) return;
            const response = await fetch('includes/studio_handlers.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'update_role', studio_id: studioId, member_id: memberId, role: newRole })
            });
            const data = await response.json();
            if (data.success) {
                window.location.reload();
            } else {
                alert(data.error || 'Failed to update role');
            }
        }
    });
});
