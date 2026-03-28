const drafts = [];

const modeButtons = document.querySelectorAll('.composer-mode .btn');
const createBtn = document.getElementById('composer-create');
const resetBtn = document.getElementById('composer-reset');
const draftList = document.getElementById('draft-list');
const searchInput = document.getElementById('composer-search');
const exportJsonBtn = document.getElementById('composer-export-json');
const exportTextBtn = document.getElementById('composer-export-text');
const playerTitle = document.getElementById('player-title');
const playerMeta = document.getElementById('player-meta');

function getFormData() {
    return {
        mode: document.querySelector('.composer-mode .btn.active')?.dataset.mode || 'simple',
        theme: document.getElementById('composer-theme').value.trim(),
        lyrics: document.getElementById('composer-lyrics').value.trim(),
        style: document.getElementById('composer-style').value.trim(),
        tempo: document.getElementById('composer-tempo').value,
        key: document.getElementById('composer-key').value,
        length: document.getElementById('composer-length').value,
        vocals: document.getElementById('composer-vocals').value,
        instruments: document.getElementById('composer-instruments').value.trim(),
        notes: document.getElementById('composer-notes').value.trim()
    };
}

function buildPrompt(data) {
    const lines = [];
    if (data.theme) lines.push(`Theme: ${data.theme}`);
    if (data.style) lines.push(`Style tags: ${data.style}`);
    if (data.instruments) lines.push(`Instruments: ${data.instruments}`);
    lines.push(`Tempo: ${data.tempo} BPM`);
    lines.push(`Key: ${data.key}`);
    lines.push(`Length: ${data.length}s`);
    lines.push(`Vocals: ${data.vocals}`);
    if (data.lyrics) lines.push(`Lyrics: ${data.lyrics}`);
    if (data.notes) lines.push(`Notes: ${data.notes}`);
    return lines.join('\n');
}

function renderDrafts(list = drafts) {
    draftList.innerHTML = '';
    if (!list.length) {
        draftList.innerHTML = '<div class="draft-card placeholder"><p>No drafts yet. Create a draft to start building your music plan.</p></div>';
        return;
    }

    list.forEach((draft, index) => {
        const card = document.createElement('div');
        card.className = 'draft-card';
        card.innerHTML = `
            <h3>${draft.title}</h3>
            <div class="draft-meta">
                <span>${draft.data.mode.toUpperCase()}</span>
                <span>${draft.data.tempo} BPM</span>
                <span>${draft.data.key}</span>
                <span>${draft.data.length}s</span>
                <span>${draft.data.vocals}</span>
            </div>
            <div class="draft-prompt">${draft.prompt}</div>
            <div class="draft-actions">
                <button class="btn secondary-btn" data-action="select">Select</button>
                <button class="btn secondary-btn" data-action="copy">Copy Prompt</button>
                <button class="btn danger" data-action="delete">Delete</button>
            </div>
        `;
        card.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', () => handleDraftAction(btn.dataset.action, index));
        });
        draftList.appendChild(card);
    });
}

function handleDraftAction(action, index) {
    const draft = drafts[index];
    if (!draft) return;
    if (action === 'select') {
        playerTitle.textContent = draft.title;
        playerMeta.textContent = `${draft.data.style || 'Custom'} · ${draft.data.length}s`;
    } else if (action === 'copy') {
        navigator.clipboard.writeText(draft.prompt);
    } else if (action === 'delete') {
        drafts.splice(index, 1);
        renderDrafts();
    }
}

createBtn?.addEventListener('click', () => {
    const data = getFormData();
    const title = data.theme || 'Untitled Draft';
    const prompt = buildPrompt(data);
    drafts.unshift({ title, data, prompt });
    renderDrafts();
});

resetBtn?.addEventListener('click', () => {
    document.querySelectorAll('.composer-panel input, .composer-panel textarea').forEach(el => {
        el.value = '';
    });
});

modeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        modeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    });
});

searchInput?.addEventListener('input', (event) => {
    const query = event.target.value.toLowerCase();
    const filtered = drafts.filter(draft => draft.title.toLowerCase().includes(query) || draft.prompt.toLowerCase().includes(query));
    renderDrafts(filtered);
});

exportJsonBtn?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(drafts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'music-composer-drafts.json';
    link.click();
    URL.revokeObjectURL(url);
});

exportTextBtn?.addEventListener('click', () => {
    const content = drafts.map(d => d.prompt).join('\n\n---\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'music-composer-prompts.txt';
    link.click();
    URL.revokeObjectURL(url);
});

renderDrafts();
