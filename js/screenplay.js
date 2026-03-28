const context = window.screenplayContext || {};
const blocksEl = document.getElementById('screenplay-blocks');
const addButtons = document.querySelectorAll('.block-buttons button');

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
        default:
            return 'Block';
    }
}

async function loadBlocks() {
    const response = await fetch(`includes/screenplay_handlers.php?action=get_blocks&scene_id=${context.sceneId}`);
    const data = await response.json();
    if (!data.success) return;
    renderBlocks(data.blocks);
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

    const textarea = document.createElement('textarea');
    textarea.value = block.content || '';
    textarea.placeholder = `Enter ${blockLabel(block.block_type)}...`;
    textarea.addEventListener('blur', () => updateBlock(block.id, textarea.value));

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
    wrapper.appendChild(textarea);
    return wrapper;
}

async function addBlock(type) {
    const response = await fetch('includes/screenplay_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'add_block',
            scene_id: context.sceneId,
            block_type: type
        })
    });
    const data = await response.json();
    if (data.success) {
        loadBlocks();
    }
}

async function updateBlock(blockId, content) {
    await fetch('includes/screenplay_handlers.php', {
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
    const response = await fetch('includes/screenplay_handlers.php', {
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

    const response = await fetch('includes/screenplay_handlers.php', {
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

addButtons.forEach(button => {
    button.addEventListener('click', () => addBlock(button.dataset.blockType));
});

loadBlocks();
