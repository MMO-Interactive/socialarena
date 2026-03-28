const context = window.clipComposerContext || {};
const blocksEl = document.getElementById('clip-blocks');
const addButtons = document.querySelectorAll('.block-buttons button[data-block-type]');
const generatePromptBtn = document.getElementById('clip-generate-prompt');
const viewPromptBtn = document.getElementById('clip-view-prompt');
const generateClipBtn = document.getElementById('clip-generate-clip');
const generateStartingBtn = document.getElementById('clip-generate-starting');
const generateStartingInlineBtn = document.getElementById('clip-generate-starting-inline');
const startImageEl = document.getElementById('clip-start-image');
const startStatusEl = document.getElementById('clip-start-status');
const clipVideoEl = document.getElementById('clip-video-preview');
const clipVideoSource = document.getElementById('clip-video-source');
const clipVideoEmpty = document.getElementById('clip-video-empty');
const clipStatusEl = document.getElementById('clip-video-status');
let statusPoller = null;

function blockLabel(type) {
    switch (type) {
        case 'scene_heading':
            return 'Scene Heading';
        case 'action':
            return 'Action';
        case 'character':
            return 'Character';
        case 'parenthetical':
            return 'Parenthetical';
        case 'dialogue':
            return 'Dialogue';
        case 'transition':
            return 'Transition';
        case 'image':
            return 'Image';
        default:
            return 'Block';
    }
}

async function loadBlocks() {
    const response = await fetch(`includes/clip_handlers.php?action=get_blocks&clip_id=${context.clipId}`);
    const data = await response.json();
    if (!data.success) return;
    renderBlocks(data.blocks);
}

function updateStatusPill(el, status) {
    if (!el) return;
    el.classList.remove('status-queued', 'status-generated', 'status-failed');
    el.textContent = status || 'Idle';
    if (status === 'queued') el.classList.add('status-queued');
    if (status === 'generated') el.classList.add('status-generated');
    if (status === 'failed') el.classList.add('status-failed');
}

async function refreshClipStatus() {
    const response = await fetch(`includes/clip_handlers.php?action=get_status&clip_id=${context.clipId}`);
    const data = await response.json();
    if (!data.success) return;

    if (startImageEl && data.starting_image_url) {
        const changed = startImageEl.src !== data.starting_image_url;
        startImageEl.src = data.starting_image_url;
        if (changed) {
            loadBlocks();
        }
    }
    updateStatusPill(startStatusEl, data.starting_image_status);

    if (data.clip_video_url) {
        if (clipVideoSource) {
            clipVideoSource.src = data.clip_video_url;
            clipVideoEl.load();
        }
        if (clipVideoEmpty) {
            clipVideoEmpty.style.display = 'none';
        }
    } else if (clipVideoEmpty) {
        clipVideoEmpty.style.display = '';
    }
    updateStatusPill(clipStatusEl, data.clip_status);
}

function startPolling() {
    if (statusPoller) return;
    statusPoller = setInterval(refreshClipStatus, 5000);
    setTimeout(() => {
        if (statusPoller) {
            clearInterval(statusPoller);
            statusPoller = null;
        }
    }, 60000);
}

function renderBlocks(blocks) {
    blocksEl.innerHTML = '';
    blocks.forEach(block => blocksEl.appendChild(buildBlock(block)));
}

function buildBlock(block) {
    const wrapper = document.createElement('div');
    wrapper.className = `screenplay-block ${block.block_type}`;
    wrapper.dataset.blockId = block.id;

    const header = document.createElement('div');
    header.className = 'block-header';
    header.innerHTML = `
        <span>${blockLabel(block.block_type)}</span>
        <div class="block-controls">
            <button type="button" data-action="up" title="Move up"><i class="fas fa-arrow-up"></i></button>
            <button type="button" data-action="down" title="Move down"><i class="fas fa-arrow-down"></i></button>
            <button type="button" data-action="delete" title="Delete"><i class="fas fa-trash"></i></button>
        </div>
    `;

    let body;
    if (block.block_type === 'image') {
        body = document.createElement('div');
        body.className = 'clip-image-block';
        const preview = document.createElement('img');
        preview.src = block.image_url || 'images/default-story.svg';
        preview.alt = 'Clip image';
        preview.className = 'clip-image-preview';

        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', () => uploadClipImage(block.id, input.files[0], preview));

        body.appendChild(preview);
        body.appendChild(input);
    } else {
        const textarea = document.createElement('textarea');
        textarea.value = block.content || '';
        textarea.placeholder = `Enter ${blockLabel(block.block_type)}...`;
        textarea.addEventListener('blur', () => updateBlock(block.id, textarea.value));
        body = textarea;
    }

    header.addEventListener('click', (event) => {
        const action = event.target.closest('button')?.dataset.action;
        if (!action) return;
        if (action === 'delete') {
            deleteBlock(block.id);
        } else {
            moveBlock(block.id, action);
        }
    });

    wrapper.appendChild(header);
    wrapper.appendChild(body);
    return wrapper;
}

async function addBlock(type) {
    const response = await fetch('includes/clip_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'add_block',
            clip_id: context.clipId,
            block_type: type
        })
    });
    const data = await response.json();
    if (data.success) {
        loadBlocks();
    }
}

async function uploadClipImage(blockId, file, previewEl) {
    if (!file) return;
    const formData = new FormData();
    formData.append('action', 'upload_image');
    formData.append('block_id', blockId);
    formData.append('image', file);

    const response = await fetch('includes/clip_handlers.php', {
        method: 'POST',
        body: formData
    });
    const data = await response.json();
    if (data.success && data.url) {
        previewEl.src = data.url;
    }
}

async function updateBlock(blockId, content) {
    await fetch('includes/clip_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'update_block',
            block_id: blockId,
            content: content
        })
    });
}

async function deleteBlock(blockId) {
    const response = await fetch('includes/clip_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'delete_block',
            block_id: blockId
        })
    });
    const data = await response.json();
    if (data.success) {
        loadBlocks();
    }
}

async function moveBlock(blockId, direction) {
    const blocks = Array.from(blocksEl.querySelectorAll('.screenplay-block'));
    const index = blocks.findIndex(block => Number(block.dataset.blockId) === Number(blockId));
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= blocks.length) return;

    const newOrder = blocks.map(block => Number(block.dataset.blockId));
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(targetIndex, 0, moved);

    const response = await fetch('includes/clip_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'update_order',
            order: newOrder
        })
    });
    const data = await response.json();
    if (data.success) {
        loadBlocks();
    }
}

async function generatePrompt() {
    const response = await fetch('includes/clip_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_prompt', clip_id: context.clipId })
    });
    const data = await response.json();
    if (!data.success) {
        alert(data.error || 'Failed to generate prompt');
        return;
    }
    alert('Prompt generated and saved.');
}

async function viewPrompt() {
    const response = await fetch('includes/clip_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'view_prompt', clip_id: context.clipId })
    });
    const data = await response.json();
    if (!data.success) {
        alert(data.error || 'Failed to load prompt');
        return;
    }
    const prompt = data.prompt || data.starting_prompt || '';
    alert(prompt || 'No prompt saved yet.');
}

async function generateStartingImage() {
    const response = await fetch('includes/clip_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_starting_image', clip_id: context.clipId })
    });
    const data = await response.json();
    if (!data.success) {
        alert(data.error || 'Failed to generate starting image');
        return;
    }
    updateStatusPill(startStatusEl, 'queued');
    startPolling();
}

async function generateClip() {
    const response = await fetch('includes/clip_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate_clip', clip_id: context.clipId })
    });
    const data = await response.json();
    if (!data.success) {
        alert(data.error || 'Failed to generate clip');
        return;
    }
    updateStatusPill(clipStatusEl, 'queued');
    startPolling();
}

addButtons.forEach(button => {
    button.addEventListener('click', () => addBlock(button.dataset.blockType));
});

if (generatePromptBtn) {
    generatePromptBtn.addEventListener('click', generatePrompt);
}
if (viewPromptBtn) {
    viewPromptBtn.addEventListener('click', viewPrompt);
}
if (generateClipBtn) {
    generateClipBtn.addEventListener('click', generateClip);
}
if (generateStartingBtn) {
    generateStartingBtn.addEventListener('click', generateStartingImage);
}
if (generateStartingInlineBtn) {
    generateStartingInlineBtn.addEventListener('click', generateStartingImage);
}

loadBlocks();
refreshClipStatus();
