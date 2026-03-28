const saveSettingsBtn = document.getElementById('save-settings');
const createWeekBtn = document.getElementById('create-week');
const viewModal = document.getElementById('view-modal');
const viewImage = document.getElementById('view-image');
const viewClose = document.getElementById('view-close');
const editModal = document.getElementById('edit-modal');
const editPrompt = document.getElementById('edit-prompt');
const editShot = document.getElementById('edit-shot');
const editBts = document.getElementById('edit-bts');
const editCancel = document.getElementById('edit-cancel');
const editSave = document.getElementById('edit-save');
let editContext = { weekId: null, dayIndex: null };

async function sendSocialRequest(payload) {
    const response = await fetch('includes/series_social_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const text = await response.text();
    let data;
    try {
        data = JSON.parse(text);
    } catch (err) {
        throw new Error('Server error: ' + text);
    }
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

function openViewModal(src) {
    if (!viewModal || !viewImage) return;
    viewImage.src = src;
    viewModal.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    viewModal.style.display = 'flex';
}

function closeViewModal() {
    if (!viewModal) return;
    viewModal.style.display = 'none';
    if (viewImage) viewImage.src = '';
    document.body.style.overflow = '';
}

function openEditModal(weekId, dayIndex, prompt, shotType, includeBts) {
    editContext = { weekId, dayIndex };
    editPrompt.value = prompt || '';
    editShot.value = shotType || '';
    editBts.checked = !!includeBts;
    editModal.style.display = 'flex';
}

function closeEditModal() {
    editModal.style.display = 'none';
}

viewClose?.addEventListener('click', closeViewModal);
viewModal?.addEventListener('click', (event) => {
    if (event.target === viewModal) closeViewModal();
});
editCancel?.addEventListener('click', closeEditModal);
editModal?.addEventListener('click', (event) => {
    if (event.target === editModal) closeEditModal();
});

saveSettingsBtn?.addEventListener('click', async () => {
    const form = document.getElementById('social-settings-form');
    const payload = {
        action: 'save_settings',
        series_id: window.socialContext.seriesId,
        checkpoint_name: form.checkpoint_name.value.trim(),
        negative_prompt: form.negative_prompt.value.trim(),
        width: form.width.value,
        height: form.height.value,
        steps: form.steps.value,
        cfg_scale: form.cfg_scale.value,
        sampler_name: form.sampler_name.value.trim(),
        scheduler: form.scheduler.value.trim()
    };

    try {
        await sendSocialRequest(payload);
        alert('Settings saved');
    } catch (error) {
        alert(error.message);
    }
});

createWeekBtn?.addEventListener('click', async () => {
    const weekStart = document.getElementById('week-start').value;
    const theme = document.getElementById('week-theme').value.trim();
    if (!weekStart || !theme) {
        alert('Pick a week start and theme');
        return;
    }

    try {
        await sendSocialRequest({
            action: 'create_week',
            series_id: window.socialContext.seriesId,
            week_start: weekStart,
            theme
        });
        window.location.reload();
    } catch (error) {
        alert(error.message);
    }
});

editSave?.addEventListener('click', async () => {
    try {
        await sendSocialRequest({
            action: 'update_day',
            week_id: editContext.weekId,
            day_index: editContext.dayIndex,
            custom_prompt: editPrompt.value.trim(),
            shot_type: editShot.value.trim(),
            include_bts: editBts.checked
        });
        await sendSocialRequest({
            action: 'generate_day',
            week_id: editContext.weekId,
            day_index: editContext.dayIndex
        });
        window.location.reload();
    } catch (error) {
        alert(error.message);
    }
});

document.querySelectorAll('.week-card').forEach(card => {
    const weekId = Number(card.dataset.weekId);
    card.querySelectorAll('[data-action="generate-week"]').forEach(button => {
        button.addEventListener('click', async () => {
            try {
                await sendSocialRequest({ action: 'generate_week', week_id: weekId });
                window.location.reload();
            } catch (error) {
                alert(error.message);
            }
        });
    });

    card.querySelectorAll('[data-action="refresh-week"]').forEach(button => {
        button.addEventListener('click', async () => {
            try {
                await sendSocialRequest({ action: 'refresh_week', week_id: weekId });
                window.location.reload();
            } catch (error) {
                alert(error.message);
            }
        });
    });

    card.querySelectorAll('.day-card').forEach(dayCard => {
        const dayIndex = Number(dayCard.dataset.dayIndex);
        const promptValue = dayCard.querySelector('.day-prompt')?.value || '';
        const shotValue = dayCard.querySelector('.day-shot')?.value || '';
        const btsChecked = dayCard.querySelector('.day-bts input')?.checked || false;

        dayCard.querySelectorAll('[data-action="generate-day"]').forEach(button => {
            button.addEventListener('click', async () => {
                try {
                    await sendSocialRequest({ action: 'generate_day', week_id: weekId, day_index: dayIndex });
                    window.location.reload();
                } catch (error) {
                    alert(error.message);
                }
            });
        });

        dayCard.querySelectorAll('[data-action="refresh-day"]').forEach(button => {
            button.addEventListener('click', async () => {
                try {
                    await sendSocialRequest({ action: 'refresh_day', week_id: weekId, day_index: dayIndex });
                    window.location.reload();
                } catch (error) {
                    alert(error.message);
                }
            });
        });

        dayCard.querySelectorAll('[data-action="view-day"]').forEach(button => {
            button.addEventListener('click', () => {
                const img = dayCard.querySelector('.day-image')?.value || '';
                if (img) openViewModal(img);
            });
        });

        dayCard.querySelectorAll('[data-action="edit-day"]').forEach(button => {
            button.addEventListener('click', () => {
                const customPrompt = dayCard.querySelector('.day-prompt')?.value || '';
                const shotType = dayCard.querySelector('.day-shot')?.value || '';
                const includeBts = dayCard.querySelector('.day-bts input')?.checked || false;
                openEditModal(weekId, dayIndex, customPrompt, shotType, includeBts);
            });
        });

        dayCard.querySelectorAll('[data-action="save-day"]').forEach(button => {
            button.addEventListener('click', async () => {
                const customPrompt = dayCard.querySelector('.day-prompt')?.value || '';
                const shotType = dayCard.querySelector('.day-shot')?.value || '';
                const includeBts = dayCard.querySelector('.day-bts input')?.checked || false;
                try {
                    await sendSocialRequest({
                        action: 'update_day',
                        week_id: weekId,
                        day_index: dayIndex,
                        custom_prompt: customPrompt,
                        shot_type: shotType,
                        include_bts: includeBts
                    });
                    alert('Saved');
                } catch (error) {
                    alert(error.message);
                }
            });
        });
    });
});
