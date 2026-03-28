const canvas = document.getElementById('board-canvas');
const boardId = canvas?.dataset.boardId;

const modal = document.getElementById('item-modal');
const itemTitle = document.getElementById('item-title');
const itemContent = document.getElementById('item-content');
const itemImage = document.getElementById('item-image');
const itemLink = document.getElementById('item-link');
const contentGroup = document.getElementById('item-content-group');
const imageGroup = document.getElementById('item-image-group');
const linkGroup = document.getElementById('item-link-group');
const audioGroup = document.getElementById('item-audio-group');
const audioInput = document.getElementById('item-audio');
const cameraGroup = document.getElementById('item-camera-group');
const cameraShot = document.getElementById('camera-shot');
const cameraAngle = document.getElementById('camera-angle');
const cameraLens = document.getElementById('camera-lens');
const cameraMove = document.getElementById('camera-move');
const cameraFraming = document.getElementById('camera-framing');
const contentLabel = document.getElementById('item-content-label');
const modalTitle = document.getElementById('item-modal-title');
const linkStatus = document.getElementById('link-status');
const styleSelectorGroup = document.getElementById('item-style-selector-group');
const styleSelectorStyle = document.getElementById('style-selector-style');
const styleSelectorMedium = document.getElementById('style-selector-medium');
const styleSelectorPalette = document.getElementById('style-selector-palette');
const styleSelectorMood = document.getElementById('style-selector-mood');

let currentType = 'note';
let editingItemId = null;
let boardLinks = [];
let linkingFrom = null;
let linkSvg = null;
let drawQueued = false;
let viewport = null;
let boardState = { scale: 1, translateX: 0, translateY: 0 };
let isPanning = false;
let panStart = { x: 0, y: 0, translateX: 0, translateY: 0 };
let wardrobeOptions = null;
const wardrobeVariations = new Map();
const comfyStatusEl = document.getElementById('comfy-status');
const generationIndicator = document.getElementById('generation-indicator');
const promptModal = document.getElementById('prompt-modal');
const promptPreview = document.getElementById('prompt-preview');
const promptClose = document.getElementById('prompt-close');
const historyModal = document.getElementById('history-modal');
const historyBody = document.getElementById('history-body');
const historyClose = document.getElementById('history-close');
let globalDragHandlersReady = false;
let activeDrag = null;
let activeResize = null;
let dragMoveHandler = null;
let dragUpHandler = null;
let resizeMoveHandler = null;
let resizeUpHandler = null;

function formatRelativeTime(value) {
    if (!value) return '';
    const date = new Date(value.replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return value;
    const diff = Date.now() - date.getTime();
    const seconds = Math.max(0, Math.floor(diff / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

async function fetchWardrobes() {
    if (wardrobeOptions !== null) return wardrobeOptions;
    try {
        const response = await fetch('includes/wardrobe_handlers.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'list_wardrobes' })
        });
        const data = await response.json();
        wardrobeOptions = data.success ? (data.wardrobes || []) : [];
    } catch (err) {
        wardrobeOptions = [];
    }
    return wardrobeOptions;
}

async function fetchWardrobeVariations(wardrobeId) {
    if (!wardrobeId) return [];
    if (wardrobeVariations.has(String(wardrobeId))) {
        return wardrobeVariations.get(String(wardrobeId));
    }
    try {
        const response = await fetch('includes/wardrobe_handlers.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'list_variations', wardrobe_id: wardrobeId })
        });
        const data = await response.json();
        const variations = data.success ? (data.variations || []) : [];
        wardrobeVariations.set(String(wardrobeId), variations);
        return variations;
    } catch (err) {
        wardrobeVariations.set(String(wardrobeId), []);
        return [];
    }
}

function isCameraContent(value) {
    if (!value) return false;
    try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' && parsed !== null &&
            ('shot' in parsed || 'angle' in parsed || 'lens' in parsed || 'move' in parsed || 'framing' in parsed);
    } catch (err) {
        return false;
    }
}

function openItemModal(type, item = null) {
    if (item && type !== 'camera' && isCameraContent(item.content)) {
        type = 'camera';
    }
    currentType = type;
    editingItemId = item?.id || null;
    itemTitle.value = item?.title || '';
    itemContent.value = item?.content || '';
    itemImage.value = item?.image_url || '';
    itemLink.value = item?.link_url || '';

    const needsContent = ['note', 'style', 'character', 'location', 'scene', 'prop', 'wardrobe', 'lighting', 'vfx', 'audio', 'dialogue', 'beat', 'clip'].includes(type);
    contentGroup.style.display = needsContent ? 'block' : 'none';
    imageGroup.style.display = type === 'image' ? 'block' : 'none';
    linkGroup.style.display = type === 'link' ? 'block' : 'none';
    if (audioGroup) {
        audioGroup.style.display = type === 'audio' ? 'block' : 'none';
    }
    if (cameraGroup) {
        cameraGroup.style.display = type === 'camera' ? 'block' : 'none';
    }
    if (styleSelectorGroup) {
        styleSelectorGroup.style.display = type === 'style_selector' ? 'block' : 'none';
    }
    if (contentLabel) {
        if (type === 'style') {
            contentLabel.textContent = 'Style Description';
            itemContent.placeholder = 'Describe the visual style...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Style Node' : 'Add Style Node';
        } else if (type === 'character') {
            contentLabel.textContent = 'Character Description';
            itemContent.placeholder = 'Describe the character...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Character Node' : 'Add Character Node';
        } else if (type === 'location') {
            contentLabel.textContent = 'Location Description';
            itemContent.placeholder = 'Describe the location or set...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Location Node' : 'Add Location Node';
        } else if (type === 'scene') {
            contentLabel.textContent = 'Scene Description';
            itemContent.placeholder = 'Describe the scene or shot...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Scene Node' : 'Add Scene Node';
        } else if (type === 'prop') {
            contentLabel.textContent = 'Prop Description';
            itemContent.placeholder = 'Describe the prop or item...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Prop Node' : 'Add Prop Node';
        } else if (type === 'wardrobe') {
            contentLabel.textContent = 'Wardrobe Description';
            itemContent.placeholder = 'Describe the wardrobe/costume...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Wardrobe Node' : 'Add Wardrobe Node';
        } else if (type === 'lighting') {
            contentLabel.textContent = 'Lighting Description';
            itemContent.placeholder = 'Describe the lighting setup...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Lighting Node' : 'Add Lighting Node';
        } else if (type === 'vfx') {
            contentLabel.textContent = 'VFX Notes';
            itemContent.placeholder = 'Describe VFX or post needs...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit VFX Node' : 'Add VFX Node';
        } else if (type === 'audio') {
            contentLabel.textContent = 'Audio Notes';
            itemContent.placeholder = 'Describe audio cues or ambience...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Audio Node' : 'Add Audio Node';
        } else if (type === 'dialogue') {
            contentLabel.textContent = 'Dialogue';
            itemContent.placeholder = 'Write or summarize dialogue...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Dialogue Node' : 'Add Dialogue Node';
        } else if (type === 'beat') {
            contentLabel.textContent = 'Story Beat';
            itemContent.placeholder = 'Capture the beat or moment...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Beat Node' : 'Add Beat Node';
        } else if (type === 'clip') {
            contentLabel.textContent = 'Clip Notes';
            itemContent.placeholder = 'Optional clip notes...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Clip Node' : 'Add Clip Node';
        } else if (type === 'camera') {
            contentLabel.textContent = 'Camera Settings';
            itemContent.placeholder = '';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Camera Node' : 'Add Camera Node';
        } else if (type === 'style_selector') {
            contentLabel.textContent = 'Style Selector';
            itemContent.placeholder = '';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Style Selector' : 'Add Style Selector';
        } else {
            contentLabel.textContent = 'Content';
            itemContent.placeholder = 'Write your note...';
            if (modalTitle) modalTitle.textContent = item ? 'Edit Item' : 'Add Item';
        }
    }

    if (type === 'camera' && item?.content) {
        try {
            const parsed = JSON.parse(item.content);
            if (cameraShot) cameraShot.value = parsed.shot || '';
            if (cameraAngle) cameraAngle.value = parsed.angle || '';
            if (cameraLens) cameraLens.value = parsed.lens || '';
            if (cameraMove) cameraMove.value = parsed.move || '';
            if (cameraFraming) cameraFraming.value = parsed.framing || '';
        } catch (err) {
            if (cameraShot) cameraShot.value = '';
            if (cameraAngle) cameraAngle.value = '';
            if (cameraLens) cameraLens.value = '';
            if (cameraMove) cameraMove.value = '';
            if (cameraFraming) cameraFraming.value = '';
        }
    }
    if (type === 'style_selector' && item?.content) {
        try {
            const parsed = JSON.parse(item.content);
            if (styleSelectorStyle) styleSelectorStyle.value = parsed.style || '';
            if (styleSelectorMedium) styleSelectorMedium.value = parsed.medium || '';
            if (styleSelectorPalette) styleSelectorPalette.value = parsed.palette || '';
            if (styleSelectorMood) styleSelectorMood.value = parsed.mood || '';
        } catch (err) {
            if (styleSelectorStyle) styleSelectorStyle.value = '';
            if (styleSelectorMedium) styleSelectorMedium.value = '';
            if (styleSelectorPalette) styleSelectorPalette.value = '';
            if (styleSelectorMood) styleSelectorMood.value = '';
        }
    }

    modal.style.display = 'flex';
}

function closeItemModal() {
    modal.style.display = 'none';
}

document.getElementById('cancel-item')?.addEventListener('click', closeItemModal);
promptClose?.addEventListener('click', () => {
    if (promptModal) promptModal.style.display = 'none';
});
historyClose?.addEventListener('click', () => {
    if (historyModal) historyModal.style.display = 'none';
});

promptModal?.addEventListener('click', (event) => {
    if (event.target === promptModal) {
        promptModal.style.display = 'none';
    }
});
historyModal?.addEventListener('click', (event) => {
    if (event.target === historyModal) {
        historyModal.style.display = 'none';
    }
});

document.getElementById('save-item')?.addEventListener('click', async () => {
    if (!boardId) return;
    let contentValue = itemContent.value.trim();
    if (currentType === 'camera') {
        const cameraPayload = {
            shot: cameraShot?.value || '',
            angle: cameraAngle?.value || '',
            lens: cameraLens?.value || '',
            move: cameraMove?.value || '',
            framing: cameraFraming?.value || ''
        };
        contentValue = JSON.stringify(cameraPayload);
    } else if (currentType === 'style_selector') {
        const stylePayload = {
            style: styleSelectorStyle?.value || '',
            medium: styleSelectorMedium?.value || '',
            palette: styleSelectorPalette?.value || '',
            mood: styleSelectorMood?.value || ''
        };
        contentValue = JSON.stringify(stylePayload);
    }
    if (currentType === 'audio' && audioInput?.files?.length) {
        const audioFile = audioInput.files[0];
        const formData = new FormData();
        formData.append('action', 'upload_audio');
        formData.append('board_id', boardId);
        formData.append('audio', audioFile);
        const uploadResponse = await fetch('includes/idea_board_handlers.php', {
            method: 'POST',
            credentials: 'same-origin',
            body: formData
        });
        const uploadData = await uploadResponse.json();
        if (!uploadData.success) {
            alert(uploadData.error || 'Audio upload failed');
            return;
        }
        itemLink.value = uploadData.url;
    }

    const payload = {
        action: editingItemId ? 'update_item' : 'create_item',
        board_id: boardId,
        item_id: editingItemId,
        item_type: currentType,
        title: itemTitle.value.trim(),
        content: contentValue,
        image_url: itemImage.value.trim(),
        link_url: itemLink.value.trim()
    };

    const response = await fetch('includes/idea_board_handlers.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (data.success) {
        closeItemModal();
        loadItems();
    }
});

document.getElementById('add-note')?.addEventListener('click', () => openItemModal('note'));
document.getElementById('add-image')?.addEventListener('click', () => openItemModal('image'));
document.getElementById('add-link')?.addEventListener('click', () => openItemModal('link'));
document.getElementById('add-style')?.addEventListener('click', () => openItemModal('style'));
document.getElementById('add-style-selector')?.addEventListener('click', () => openItemModal('style_selector'));
document.getElementById('add-character')?.addEventListener('click', () => openItemModal('character'));
document.getElementById('add-location')?.addEventListener('click', () => openItemModal('location'));
document.getElementById('add-scene')?.addEventListener('click', () => openItemModal('scene'));
document.getElementById('add-camera')?.addEventListener('click', () => openItemModal('camera'));
document.getElementById('add-prop')?.addEventListener('click', () => openItemModal('prop'));
document.getElementById('add-wardrobe')?.addEventListener('click', () => openItemModal('wardrobe'));
document.getElementById('add-lighting')?.addEventListener('click', () => openItemModal('lighting'));
document.getElementById('add-vfx')?.addEventListener('click', () => openItemModal('vfx'));
document.getElementById('add-audio')?.addEventListener('click', () => openItemModal('audio'));
document.getElementById('add-dialogue')?.addEventListener('click', () => openItemModal('dialogue'));
document.getElementById('add-beat')?.addEventListener('click', () => openItemModal('beat'));
document.getElementById('add-clip')?.addEventListener('click', () => openItemModal('clip'));

function updateItemElement(el, item) {
    el.className = `idea-item ${item.item_type}`;
    el.dataset.itemId = item.id;
    el.style.left = `${item.pos_x}px`;
    el.style.top = `${item.pos_y}px`;
    el.style.width = `${item.width || 240}px`;
    el.style.height = `${item.height || 160}px`;

    el.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'idea-item-header';
    let statusText = '';
    if (item.generation_status && !['note', 'image', 'link', 'style', 'style_selector', 'camera', 'prop', 'wardrobe', 'lighting', 'vfx', 'audio', 'dialogue', 'beat', 'clip'].includes(item.item_type)) {
        const label = item.generation_status === 'failed' ? 'ComfyUI offline' : item.generation_status;
        statusText = `<span class="idea-status ${item.generation_status}">${label}</span>`;
    }
    const metaBits = [];
    const count = Number(item.generation_count || 0);
    if (count > 0) {
        metaBits.push(`${count} gen${count === 1 ? '' : 's'}`);
    }
    if (item.last_generated_at) {
        metaBits.push(`Last: ${formatRelativeTime(item.last_generated_at)}`);
    }
    const metaText = metaBits.length ? `<span class="idea-meta">${metaBits.join(' • ')}</span>` : '';
    header.innerHTML = `
        <div class="idea-header-left">
            <div class="idea-title">${item.title || 'Untitled'}</div>
            <div class="idea-status-row">${statusText}</div>
            <div class="idea-meta-row">${metaText}</div>
        </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'idea-item-actions';
    actions.innerHTML = `
        <button title="Connect"><i class="fas fa-link"></i></button>
        <button title="Edit"><i class="fas fa-edit"></i></button>
        <button title="Delete"><i class="fas fa-trash"></i></button>
    `;

    header.appendChild(actions);

    const body = document.createElement('div');
    body.className = 'idea-item-body';
    if (item.last_error && item.generation_status === 'failed') {
        const errorBox = document.createElement('div');
        errorBox.className = 'idea-error';
        errorBox.textContent = item.last_error;
        body.appendChild(errorBox);
    }
    if (item.item_type === 'note') {
        body.textContent = item.content || '';
    } else if (item.item_type === 'image') {
        const img = document.createElement('img');
        img.src = item.image_url || '';
        img.alt = item.title || 'Idea image';
        img.loading = 'lazy';
        body.appendChild(img);
    } else if (item.item_type === 'link') {
        const link = document.createElement('a');
        link.href = item.link_url || '#';
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = item.link_url || 'Open link';
        body.appendChild(link);
    } else if (item.item_type === 'wardrobe') {
        const parsed = (() => {
            try {
                return JSON.parse(item.content || '{}');
            } catch (err) {
                return {};
            }
        })();
        const wardrobeSelect = document.createElement('select');
        wardrobeSelect.className = 'wardrobe-select';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select wardrobe';
        wardrobeSelect.appendChild(placeholder);
        (wardrobeOptions || []).forEach(option => {
            const opt = document.createElement('option');
            opt.value = option.id;
            const scope = option.series_title ? `Series: ${option.series_title}` : 'Global';
            opt.textContent = `${option.name} (${scope})`;
            wardrobeSelect.appendChild(opt);
        });
        wardrobeSelect.value = parsed.wardrobe_id || '';
        body.appendChild(wardrobeSelect);

        const variationSelect = document.createElement('select');
        variationSelect.className = 'wardrobe-select';
        variationSelect.style.display = 'none';
        body.appendChild(variationSelect);

        const detail = document.createElement('div');
        detail.className = 'wardrobe-detail';
        body.appendChild(detail);

        const updateDetail = (wardrobeId) => {
            detail.innerHTML = '';
            const selected = (wardrobeOptions || []).find(opt => String(opt.id) === String(wardrobeId));
            if (!selected) return;
            if (selected.cover_image_url) {
                const img = document.createElement('img');
                img.src = selected.cover_image_url;
                img.alt = selected.name;
                img.loading = 'lazy';
                detail.appendChild(img);
            }
            const meta = document.createElement('div');
            meta.className = 'wardrobe-meta';
            meta.textContent = selected.wardrobe_type || (selected.series_title ? `Series: ${selected.series_title}` : 'Global');
            detail.appendChild(meta);
            if (selected.description) {
                const desc = document.createElement('div');
                desc.className = 'wardrobe-desc';
                desc.textContent = selected.description;
                detail.appendChild(desc);
            }
        };
        updateDetail(parsed.wardrobe_id);

        const notes = document.createElement('textarea');
        notes.className = 'wardrobe-notes';
        notes.placeholder = 'Wardrobe notes...';
        notes.value = parsed.notes || '';
        body.appendChild(notes);

        const saveWardrobe = async () => {
            const payload = {
                wardrobe_id: wardrobeSelect.value || null,
                variation_id: variationSelect.value || null,
                notes: notes.value.trim()
            };
            await fetch('includes/idea_board_handlers.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_item',
                    item_id: item.id,
                    title: item.title || '',
                    content: JSON.stringify(payload),
                    image_url: item.image_url || '',
                    link_url: item.link_url || ''
                })
            });
        };

        const populateVariations = async (wardrobeId) => {
            variationSelect.innerHTML = '';
            variationSelect.style.display = 'none';
            if (!wardrobeId) return;
            const variations = await fetchWardrobeVariations(wardrobeId);
            if (!variations.length) return;
            const placeholderVar = document.createElement('option');
            placeholderVar.value = '';
            placeholderVar.textContent = 'Select variation';
            variationSelect.appendChild(placeholderVar);
            variations.forEach(variation => {
                const opt = document.createElement('option');
                opt.value = variation.id;
                opt.textContent = variation.name;
                variationSelect.appendChild(opt);
            });
            variationSelect.value = parsed.variation_id || '';
            variationSelect.style.display = 'block';
        };

        populateVariations(parsed.wardrobe_id).catch(() => {});

        wardrobeSelect.addEventListener('change', () => {
            updateDetail(wardrobeSelect.value);
            populateVariations(wardrobeSelect.value).catch(() => {});
            saveWardrobe().catch(() => {});
        });
        variationSelect.addEventListener('change', () => {
            saveWardrobe().catch(() => {});
        });
        notes.addEventListener('blur', () => {
            saveWardrobe().catch(() => {});
        });
    } else if (item.item_type === 'lighting') {
        const parsed = (() => {
            try {
                return JSON.parse(item.content || '{}');
            } catch (err) {
                return {};
            }
        })();
        const mode = parsed.mode === 'advanced' ? 'advanced' : 'visual';

        const modeToggle = document.createElement('div');
        modeToggle.className = 'lighting-mode-toggle';
        modeToggle.innerHTML = `
            <button type="button" class="btn secondary-btn ${mode === 'visual' ? 'active' : ''}" data-mode="visual">Visual</button>
            <button type="button" class="btn secondary-btn ${mode === 'advanced' ? 'active' : ''}" data-mode="advanced">Advanced</button>
        `;
        body.appendChild(modeToggle);

        const visualPanel = document.createElement('div');
        visualPanel.className = 'lighting-visual-panel';
        const createSelect = (labelText, options, value) => {
            const wrapper = document.createElement('label');
            wrapper.className = 'lighting-field';
            const label = document.createElement('span');
            label.textContent = labelText;
            const select = document.createElement('select');
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option === '' ? '-' : option;
                select.appendChild(opt);
            });
            select.value = value || '';
            wrapper.appendChild(label);
            wrapper.appendChild(select);
            return { wrapper, select };
        };

        const selects = {
            key: createSelect('Key', ['', 'Soft key', 'Hard key', 'Top light', 'Side key', 'Back key'], parsed.key || ''),
            fill: createSelect('Fill', ['', 'No fill', 'Soft fill', 'Bounce fill', 'Negative fill'], parsed.fill || ''),
            rim: createSelect('Rim', ['', 'None', 'Subtle rim', 'Strong rim'], parsed.rim || ''),
            colorTemp: createSelect('Color Temp', ['', 'Warm (3200K)', 'Neutral (4500K)', 'Cool (5600K)'], parsed.colorTemp || ''),
            intensity: createSelect('Intensity', ['', 'Low', 'Medium', 'High'], parsed.intensity || ''),
            mood: createSelect('Mood', ['', 'Moody', 'Bright', 'Dramatic', 'Dreamy', 'Gritty'], parsed.mood || '')
        };
        Object.values(selects).forEach(({ wrapper }) => visualPanel.appendChild(wrapper));
        body.appendChild(visualPanel);

        const advancedPanel = document.createElement('div');
        advancedPanel.className = 'lighting-advanced-panel';
        const advancedTextarea = document.createElement('textarea');
        advancedTextarea.placeholder = 'Describe lighting setup...';
        advancedTextarea.value = parsed.text || (mode === 'advanced' ? (item.content || '') : '');
        advancedPanel.appendChild(advancedTextarea);
        body.appendChild(advancedPanel);

        const updatePanels = () => {
            const isVisual = modeToggle.querySelector('[data-mode="visual"]').classList.contains('active');
            visualPanel.style.display = isVisual ? 'grid' : 'none';
            advancedPanel.style.display = isVisual ? 'none' : 'block';
        };
        updatePanels();

        const saveLighting = async () => {
            const isAdvanced = modeToggle.querySelector('[data-mode="advanced"]').classList.contains('active');
            const payload = {
                mode: isAdvanced ? 'advanced' : 'visual',
                key: selects.key.select.value,
                fill: selects.fill.select.value,
                rim: selects.rim.select.value,
                colorTemp: selects.colorTemp.select.value,
                intensity: selects.intensity.select.value,
                mood: selects.mood.select.value,
                text: advancedTextarea.value.trim()
            };
            await fetch('includes/idea_board_handlers.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_item',
                    item_id: item.id,
                    title: item.title || '',
                    content: JSON.stringify(payload),
                    image_url: item.image_url || '',
                    link_url: item.link_url || ''
                })
            });
        };

        modeToggle.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                modeToggle.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                updatePanels();
                saveLighting().catch(() => {});
            });
        });
        Object.values(selects).forEach(({ select }) => {
            select.addEventListener('change', () => {
                saveLighting().catch(() => {});
            });
        });
        advancedTextarea.addEventListener('blur', () => {
            saveLighting().catch(() => {});
        });
    } else if (item.item_type === 'vfx') {
        const parsed = (() => {
            try {
                return JSON.parse(item.content || '{}');
            } catch (err) {
                return {};
            }
        })();
        const mode = parsed.mode === 'advanced' ? 'advanced' : 'visual';

        const modeToggle = document.createElement('div');
        modeToggle.className = 'lighting-mode-toggle';
        modeToggle.innerHTML = `
            <button type="button" class="btn secondary-btn ${mode === 'visual' ? 'active' : ''}" data-mode="visual">Visual</button>
            <button type="button" class="btn secondary-btn ${mode === 'advanced' ? 'active' : ''}" data-mode="advanced">Advanced</button>
        `;
        body.appendChild(modeToggle);

        const visualPanel = document.createElement('div');
        visualPanel.className = 'vfx-visual-panel';
        const createSelect = (labelText, options, value) => {
            const wrapper = document.createElement('label');
            wrapper.className = 'lighting-field';
            const label = document.createElement('span');
            label.textContent = labelText;
            const select = document.createElement('select');
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option === '' ? '-' : option;
                select.appendChild(opt);
            });
            select.value = value || '';
            wrapper.appendChild(label);
            wrapper.appendChild(select);
            return { wrapper, select };
        };

        const vfxPromptMap = {
            'Particles': 'Soft floating particles with subtle depth and light bloom.',
            'Magic': 'Glowing magical energy with wisps, sparks, and ethereal trails.',
            'Sci-Fi': 'Futuristic energy effects with holographic glow and lens flares.',
            'Atmosphere': 'Volumetric haze with light rays and ambient dust.',
            'Destruction': 'High-energy explosion with scattering debris and smoke.',
            'UI/Screen': 'Screen graphics overlay with clean futuristic UI elements.'
        };
        const priorityHints = {
            'Foreground': 'Most visible, leads the eye.',
            'Background': 'Supports scene depth.',
            'Ambient': 'Subtle mood/atmosphere.'
        };
        const selects = {
            type: createSelect('Effect Type', ['', 'Particles', 'Magic', 'Sci-Fi', 'Atmosphere', 'Destruction', 'UI/Screen'], parsed.type || ''),
            intensity: createSelect('Intensity', ['', 'Subtle', 'Medium', 'Heavy'], parsed.intensity || ''),
            integration: createSelect('Integration', ['', 'Practical blend', 'CG full', 'Hybrid'], parsed.integration || ''),
            priority: createSelect('Priority', ['', 'Foreground', 'Background', 'Ambient'], parsed.priority || ''),
            notes: createSelect('Notes', ['', 'Match camera', 'Match lighting', 'Match color grade'], parsed.notes || '')
        };
        Object.values(selects).forEach(({ wrapper }) => visualPanel.appendChild(wrapper));
        const typeLabel = selects.type.wrapper.querySelector('span');
        if (typeLabel) {
            typeLabel.innerHTML = 'Effect Type <span class="vfx-icon">VFX</span>';
        }
        const priorityLabel = selects.priority.wrapper.querySelector('span');
        if (priorityLabel) {
            priorityLabel.title = 'Foreground / Background / Ambient';
        }
        body.appendChild(visualPanel);

        const advancedPanel = document.createElement('div');
        advancedPanel.className = 'vfx-advanced-panel';
        const advancedTextarea = document.createElement('textarea');
        advancedTextarea.placeholder = 'Describe VFX requirements...';
        advancedTextarea.value = parsed.text || (mode === 'advanced' ? (item.content || '') : '');
        advancedPanel.appendChild(advancedTextarea);
        body.appendChild(advancedPanel);

        const updatePanels = () => {
            const isVisual = modeToggle.querySelector('[data-mode="visual"]').classList.contains('active');
            visualPanel.style.display = isVisual ? 'grid' : 'none';
            advancedPanel.style.display = isVisual ? 'none' : 'block';
        };
        updatePanels();

        const saveVfx = async () => {
            const isAdvanced = modeToggle.querySelector('[data-mode="advanced"]').classList.contains('active');
            const payload = {
                mode: isAdvanced ? 'advanced' : 'visual',
                type: selects.type.select.value,
                intensity: selects.intensity.select.value,
                integration: selects.integration.select.value,
                priority: selects.priority.select.value,
                notes: selects.notes.select.value,
                text: advancedTextarea.value.trim()
            };
            await fetch('includes/idea_board_handlers.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_item',
                    item_id: item.id,
                    title: item.title || '',
                    content: JSON.stringify(payload),
                    image_url: item.image_url || '',
                    link_url: item.link_url || ''
                })
            });
        };

        modeToggle.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', () => {
                modeToggle.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                updatePanels();
                saveVfx().catch(() => {});
            });
        });
        const applyAutoPrompt = () => {
            const autoText = vfxPromptMap[selects.type.select.value] || '';
            const current = advancedTextarea.value.trim();
            if (!current || current === advancedTextarea.dataset.autoText) {
                advancedTextarea.value = autoText;
                advancedTextarea.dataset.autoText = autoText;
            }
        };

        Object.values(selects).forEach(({ select }) => {
            select.addEventListener('change', () => {
                if (select === selects.type.select) {
                    applyAutoPrompt();
                }
                saveVfx().catch(() => {});
            });
        });
        applyAutoPrompt();
        advancedTextarea.addEventListener('blur', () => {
            saveVfx().catch(() => {});
        });

        const randomizeBtn = document.createElement('button');
        randomizeBtn.type = 'button';
        randomizeBtn.className = 'btn secondary-btn vfx-randomize';
        randomizeBtn.textContent = 'Randomize';
        randomizeBtn.addEventListener('click', () => {
            const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
            const options = (select) => Array.from(select.options).map(opt => opt.value).filter(Boolean);
            selects.type.select.value = pick(options(selects.type.select));
            selects.intensity.select.value = pick(options(selects.intensity.select));
            selects.integration.select.value = pick(options(selects.integration.select));
            selects.priority.select.value = pick(options(selects.priority.select));
            selects.notes.select.value = pick(options(selects.notes.select));
            applyAutoPrompt();
            saveVfx().catch(() => {});
        });
        body.appendChild(randomizeBtn);
    } else if (item.item_type === 'audio') {
        const audio = document.createElement('audio');
        audio.controls = true;
        const rawUrl = item.link_url || item.image_url || '';
        const resolvedUrl = rawUrl ? new URL(rawUrl, window.location.href).href : '';
        const streamUrl = rawUrl ? `audio_stream.php?file=${encodeURIComponent(rawUrl)}` : '';
        const source = document.createElement('source');
        source.src = streamUrl || resolvedUrl;
        const ext = rawUrl.split('.').pop()?.toLowerCase() || '';
        if (ext === 'mp3') source.type = 'audio/mpeg';
        if (ext === 'wav') source.type = 'audio/wav';
        if (ext === 'ogg') source.type = 'audio/ogg';
        if (ext === 'm4a') source.type = 'audio/mp4';
        audio.appendChild(source);
        audio.preload = 'metadata';
        audio.className = 'idea-audio-player';
        body.appendChild(audio);
        if (rawUrl) {
            const fileName = decodeURIComponent(rawUrl.split('/').pop() || '');
            if (fileName) {
                const nameTag = document.createElement('div');
                nameTag.className = 'idea-audio-filename';
                nameTag.textContent = fileName;
                body.appendChild(nameTag);
            }
            const waveform = document.createElement('canvas');
            waveform.className = 'idea-audio-waveform';
            body.appendChild(waveform);
            const drawWaveform = async () => {
                try {
                    const response = await fetch(streamUrl || resolvedUrl);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
                    const channel = audioBuffer.getChannelData(0);
                    const samples = 120;
                    const blockSize = Math.floor(channel.length / samples);
                    const heights = new Array(samples).fill(0).map((_, i) => {
                        let sum = 0;
                        const start = i * blockSize;
                        for (let j = 0; j < blockSize; j += 1) {
                            sum += Math.abs(channel[start + j] || 0);
                        }
                        return sum / blockSize;
                    });
                    const canvasWidth = waveform.clientWidth || 220;
                    const canvasHeight = waveform.clientHeight || 48;
                    waveform.width = canvasWidth * window.devicePixelRatio;
                    waveform.height = canvasHeight * window.devicePixelRatio;
                    const ctx = waveform.getContext('2d');
                    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
                    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
                    ctx.fillStyle = 'rgba(59, 130, 246, 0.75)';
                    const max = Math.max(...heights, 0.001);
                    const barWidth = canvasWidth / samples;
                    heights.forEach((value, index) => {
                        const barHeight = (value / max) * canvasHeight;
                        const x = index * barWidth;
                        ctx.fillRect(x, (canvasHeight - barHeight) / 2, barWidth * 0.6, barHeight);
                    });
                    if (audioCtx.state !== 'closed') {
                        audioCtx.close();
                    }
                } catch (err) {
                    // Ignore waveform errors
                }
            };
            requestAnimationFrame(drawWaveform);
            const fileLink = document.createElement('a');
            fileLink.href = streamUrl || resolvedUrl;
            fileLink.target = '_blank';
            fileLink.rel = 'noopener';
            fileLink.className = 'idea-audio-link';
            fileLink.textContent = 'Open audio file';
            body.appendChild(fileLink);
        } else {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'idea-audio-error';
            emptyMsg.textContent = 'No audio uploaded yet.';
            body.appendChild(emptyMsg);
        }
        const replaceBtn = document.createElement('button');
        replaceBtn.className = 'btn idea-audio-replace';
        replaceBtn.textContent = 'Replace audio';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'audio/*';
        fileInput.className = 'idea-audio-input';
        replaceBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            fileInput.click();
        });
        fileInput.addEventListener('change', async () => {
            if (!fileInput.files?.length) return;
            replaceBtn.disabled = true;
            replaceBtn.textContent = 'Uploading...';
            try {
                await uploadAudioForItem(item.id, fileInput.files[0]);
                await loadItems();
            } catch (err) {
                alert(err.message || 'Audio upload failed');
            } finally {
                replaceBtn.disabled = false;
                replaceBtn.textContent = 'Replace audio';
            }
        });
        body.appendChild(replaceBtn);
        body.appendChild(fileInput);
        audio.addEventListener('error', () => {
            const msg = document.createElement('div');
            msg.className = 'idea-audio-error';
            msg.textContent = 'Audio preview failed to load.';
            body.appendChild(msg);
        }, { once: true });
        if (item.content) {
            const desc = document.createElement('div');
            desc.className = 'idea-description';
            desc.textContent = item.content;
            body.appendChild(desc);
        }
    } else if (item.item_type === 'style') {
        body.textContent = item.content || 'Style description...';
    } else if (item.item_type === 'clip') {
        const imageUrl = item.link_url || '';
        if (imageUrl) {
            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = item.title || 'Scene preview';
            img.className = 'generated-image';
            body.appendChild(img);
        }
        if (item.image_url) {
            const video = document.createElement('video');
            video.src = item.image_url;
            video.controls = true;
            video.className = 'generated-video';
            body.appendChild(video);
        }
        const promptText = document.createElement('textarea');
        promptText.className = 'clip-prompt';
        promptText.readOnly = true;
        promptText.placeholder = 'Clip prompt will appear here...';
        promptText.value = item.prompt_text || '';
        body.appendChild(promptText);

        const buildBtn = document.createElement('button');
        buildBtn.className = 'btn secondary-btn prompt-preview-btn';
        buildBtn.textContent = item.prompt_text ? 'Refresh Clip Prompt' : 'Build Clip Prompt';
        buildBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            buildBtn.disabled = true;
            try {
                const response = await fetch('includes/idea_board_handlers.php', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'clip_preview',
                        item_id: item.id
                    })
                });
                const data = await response.json();
                if (data.success) {
                    promptText.value = data.prompt || '';
                    if (data.scene_image_url) {
                        if (!imageUrl) {
                            const preview = document.createElement('img');
                            preview.src = data.scene_image_url;
                            preview.alt = item.title || 'Scene preview';
                            preview.className = 'generated-image';
                            body.insertBefore(preview, promptText);
                        } else {
                            const existing = body.querySelector('img.generated-image');
                            if (existing) existing.src = data.scene_image_url;
                        }
                    }
                    buildBtn.textContent = 'Refresh Clip Prompt';
                } else {
                    alert(data.error || 'Failed to build clip prompt');
                }
            } finally {
                buildBtn.disabled = false;
            }
        });
        body.appendChild(buildBtn);
        if (!item.prompt_text) {
            buildBtn.click();
        }

        const generateBtn = document.createElement('button');
        generateBtn.className = 'btn primary-btn';
        generateBtn.textContent = 'Generate Clip';
        generateBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            generateBtn.disabled = true;
            try {
                const response = await fetch('includes/idea_board_handlers.php', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'clip_generate',
                        item_id: item.id
                    })
                });
                const data = await response.json();
                if (!data.success) {
                    alert(data.error || 'Failed to generate clip');
                    return;
                }
                await loadItems();
            } finally {
                generateBtn.disabled = false;
            }
        });
        body.appendChild(generateBtn);
    } else if (['prop', 'wardrobe', 'lighting', 'vfx', 'audio', 'dialogue', 'beat'].includes(item.item_type)) {
        body.textContent = item.content || '';
    } else if (item.item_type === 'style_selector') {
        const parsed = (() => {
            try {
                return JSON.parse(item.content || '{}');
            } catch (err) {
                return {};
            }
        })();

        const grid = document.createElement('div');
        grid.className = 'camera-node-grid';

        const createSelect = (labelText, options, valueKey) => {
            const wrapper = document.createElement('label');
            wrapper.className = 'camera-node-field';
            const label = document.createElement('span');
            label.textContent = labelText;
            const select = document.createElement('select');
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option === '' ? '-' : option;
                select.appendChild(opt);
            });
            select.value = parsed[valueKey] || '';
            wrapper.appendChild(label);
            wrapper.appendChild(select);
            return { wrapper, select };
        };

        const styleOptions = ['', 'Photoreal', 'Cinematic', 'Illustration', 'Anime', 'Concept Art', 'Painterly'];
        const mediumOptions = ['', 'Digital', 'Oil Paint', 'Watercolor', '3D Render', 'Sketch'];
        const paletteOptions = ['', 'Warm', 'Cool', 'Muted', 'Vibrant', 'Monochrome'];
        const moodOptions = ['', 'Moody', 'Bright', 'Dreamy', 'Gritty', 'Epic'];

        const selects = {
            style: createSelect('Style', styleOptions, 'style'),
            medium: createSelect('Medium', mediumOptions, 'medium'),
            palette: createSelect('Palette', paletteOptions, 'palette'),
            mood: createSelect('Mood', moodOptions, 'mood')
        };

        Object.values(selects).forEach(({ wrapper }) => grid.appendChild(wrapper));
        body.appendChild(grid);

        const saveSelector = async () => {
            const payload = {
                style: selects.style.select.value,
                medium: selects.medium.select.value,
                palette: selects.palette.select.value,
                mood: selects.mood.select.value
            };
            await fetch('includes/idea_board_handlers.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_item',
                    item_id: item.id,
                    title: item.title || '',
                    content: JSON.stringify(payload),
                    image_url: item.image_url || '',
                    link_url: item.link_url || ''
                })
            });
        };

        Object.values(selects).forEach(({ select }) => {
            select.addEventListener('change', () => {
                saveSelector().catch(() => {});
            });
        });
    } else if (item.item_type === 'camera') {
        const parsed = (() => {
            try {
                return JSON.parse(item.content || '{}');
            } catch (err) {
                return {};
            }
        })();

        const grid = document.createElement('div');
        grid.className = 'camera-node-grid';

        const createSelect = (labelText, options, valueKey) => {
            const wrapper = document.createElement('label');
            wrapper.className = 'camera-node-field';
            const label = document.createElement('span');
            label.textContent = labelText;
            const select = document.createElement('select');
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = option;
                opt.textContent = option === '' ? '-' : option;
                select.appendChild(opt);
            });
            select.value = parsed[valueKey] || '';
            wrapper.appendChild(label);
            wrapper.appendChild(select);
            return { wrapper, select };
        };

        const shotOptions = ['', 'Extreme Close-Up', 'Close-Up', 'Medium Close-Up', 'Medium Shot', 'Medium Long Shot', 'Long Shot', 'Wide Shot', 'Extreme Wide'];
        const angleOptions = ['', 'Eye Level', 'Low Angle', 'High Angle', 'Over-the-Shoulder', "Bird's Eye", 'Dutch Angle'];
        const lensOptions = ['', '14mm Ultra Wide', '24mm Wide', '35mm', '50mm', '85mm Portrait', '135mm Tele'];
        const moveOptions = ['', 'Static', 'Pan', 'Tilt', 'Dolly In', 'Dolly Out', 'Tracking', 'Handheld'];
        const framingOptions = ['', 'Centered', 'Rule of Thirds', 'Negative Space', 'Symmetrical'];

        const selects = {
            shot: createSelect('Shot', shotOptions, 'shot'),
            angle: createSelect('Angle', angleOptions, 'angle'),
            lens: createSelect('Lens', lensOptions, 'lens'),
            move: createSelect('Move', moveOptions, 'move'),
            framing: createSelect('Framing', framingOptions, 'framing')
        };

        Object.values(selects).forEach(({ wrapper }) => grid.appendChild(wrapper));
        body.appendChild(grid);

        const saveCamera = async () => {
            const payload = {
                shot: selects.shot.select.value,
                angle: selects.angle.select.value,
                lens: selects.lens.select.value,
                move: selects.move.select.value,
                framing: selects.framing.select.value
            };
            await fetch('includes/idea_board_handlers.php', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'update_item',
                    item_id: item.id,
                    title: item.title || '',
                    content: JSON.stringify(payload),
                    image_url: item.image_url || '',
                    link_url: item.link_url || ''
                })
            });
        };

        Object.values(selects).forEach(({ select }) => {
            select.addEventListener('change', () => {
                saveCamera().catch(() => {});
            });
        });
    } else if (item.item_type === 'character' || item.item_type === 'location' || item.item_type === 'scene') {
        if (item.generated_image_url) {
            const img = document.createElement('img');
            img.src = item.generated_image_url;
            img.alt = item.title || 'Generated preview';
            img.className = 'generated-image';
            body.appendChild(img);
        }
        const desc = document.createElement('div');
        desc.className = 'idea-description';
        desc.textContent = item.content || '';
        body.appendChild(desc);

        const generateBtn = document.createElement('button');
        generateBtn.className = 'btn idea-generate';
        if (item.generation_status === 'queued') {
            generateBtn.textContent = 'Queued...';
            generateBtn.disabled = true;
        } else if (item.generation_status === 'failed') {
            generateBtn.textContent = 'Retry Generation';
        } else {
            generateBtn.textContent = item.generated_image_url ? 'Regenerate' : 'Generate';
        }
        generateBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            generateBtn.disabled = true;
            generateBtn.textContent = 'Generating...';
            try {
                await generateItem(item.id);
            } finally {
                generateBtn.disabled = false;
            }
        });
        body.appendChild(generateBtn);

        const previewBtn = document.createElement('button');
        previewBtn.className = 'btn secondary-btn prompt-preview-btn';
        previewBtn.textContent = 'Preview Prompt';
        previewBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            previewBtn.disabled = true;
            try {
                const response = await fetch('includes/idea_board_handlers.php', {
                    method: 'POST',
                    credentials: 'same-origin',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'prompt_preview',
                        item_id: item.id
                    })
                });
                const data = await response.json();
                if (data.success) {
                    if (promptPreview) promptPreview.value = data.prompt || '';
                    if (promptModal) promptModal.style.display = 'flex';
                } else {
                    alert(data.error || 'Failed to build prompt');
                }
            } finally {
                previewBtn.disabled = false;
            }
        });
        body.appendChild(previewBtn);
    }

    if (['character', 'location', 'scene'].includes(item.item_type)) {
        const historyBtn = document.createElement('button');
        historyBtn.className = 'btn secondary-btn history-btn';
        historyBtn.textContent = 'History';
        historyBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            openHistory(item.id);
        });
        body.appendChild(historyBtn);
    }

    el.appendChild(header);
    el.appendChild(body);

    if (['character', 'location', 'scene'].includes(item.item_type)) {
        const lineage = item.generation_lineage || [];
        if (lineage.length) {
            const list = document.createElement('div');
            list.className = 'idea-lineage';
            const label = document.createElement('div');
            label.className = 'idea-lineage-label';
            label.textContent = 'Last gen';
            list.appendChild(label);
            lineage.forEach(link => {
                const chip = document.createElement('span');
                chip.className = `idea-lineage-chip ${link.link_type || ''}`.trim();
                chip.textContent = link.source_title || link.source_type || link.link_type || 'Linked';
                list.appendChild(chip);
            });
            el.appendChild(list);
        }
    }

    const resizer = document.createElement('div');
    resizer.className = 'idea-resizer';
    el.appendChild(resizer);

    const actionButtons = actions.querySelectorAll('button');
    actionButtons[0].addEventListener('click', () => startLinking(item));
    actionButtons[1].addEventListener('click', () => openItemModal(item.item_type, item));
    actionButtons[2].addEventListener('click', () => deleteItem(item.id));

    enableDrag(el, item.id);
    enableResize(el, item.id, resizer);
    el.addEventListener('click', (event) => {
        if (!linkingFrom) return;
        const isAction = event.target.closest('.idea-item-actions');
        if (isAction) return;
        completeLink(item);
    });

    if (['character', 'location', 'scene', 'style', 'clip'].includes(item.item_type)) {
        const links = boardLinks.filter(link => Number(link.target_item_id) === Number(item.id));
        if (links.length) {
            const linkList = document.createElement('div');
            linkList.className = 'idea-links';
            const label = document.createElement('div');
            label.className = 'idea-links-label';
            label.textContent = 'Influenced by';
            linkList.appendChild(label);
            links.forEach(link => {
                const badge = document.createElement('span');
                badge.className = `idea-link ${link.link_type}`;
                let label = link.source_title || link.link_type;
                if (item.item_type === 'clip' && link.source_type === 'scene') {
                    label = `Image Source: ${link.source_title || 'Scene'}`;
                }
                badge.textContent = label;
                const removeBtn = document.createElement('button');
                removeBtn.innerHTML = '&times;';
                removeBtn.title = 'Remove link';
                removeBtn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    await deleteLink(link.id);
                });
                badge.appendChild(removeBtn);
                linkList.appendChild(badge);
            });
            el.appendChild(linkList);
        }
    }

    return el;
}

function renderItem(item) {
    const el = document.createElement('div');
    return updateItemElement(el, item);
}

function ensureViewport() {
    if (!canvas) return null;
    if (!viewport) {
        viewport = document.createElement('div');
        viewport.className = 'board-viewport';
        canvas.appendChild(viewport);
    }
    return viewport;
}

function ensureLinkLayer() {
    if (!viewport) return null;
    if (!linkSvg) {
        linkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        linkSvg.classList.add('link-layer');
        viewport.appendChild(linkSvg);
    }
    return linkSvg;
}

function getCenterForElement(el, canvasRect) {
    return {
        x: el.offsetLeft + el.offsetWidth / 2,
        y: el.offsetTop + el.offsetHeight / 2
    };
}


function getRectForElement(el) {
    return {
        x: el.offsetLeft,
        y: el.offsetTop,
        width: el.offsetWidth,
        height: el.offsetHeight
    };
}

function getEdgePoint(rect, targetCenter) {
    const cx = rect.x + rect.width / 2;
    const cy = rect.y + rect.height / 2;
    const dx = targetCenter.x - cx;
    const dy = targetCenter.y - cy;
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;
    if (dx === 0 && dy === 0) {
        return { x: cx, y: cy };
    }
    const scale = 1 / Math.max(Math.abs(dx) / halfW || 0, Math.abs(dy) / halfH || 0);
    return {
        x: cx + dx * scale,
        y: cy + dy * scale
    };
}

function drawLinks() {
    if (!canvas || !viewport) return;
    const svg = ensureLinkLayer();
    if (!svg) return;
    const width = Math.max(viewport.scrollWidth, canvas.clientWidth, viewport.clientWidth);
    const height = Math.max(viewport.scrollHeight, canvas.clientHeight, viewport.clientHeight);
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    while (svg.firstChild) {
        svg.removeChild(svg.firstChild);
    }

    boardLinks.forEach(link => {
        const sourceEl = document.querySelector(`.idea-item[data-item-id="${link.source_item_id}"]`);
        const targetEl = document.querySelector(`.idea-item[data-item-id="${link.target_item_id}"]`);
        if (!sourceEl || !targetEl) return;
        const srcCenter = getCenterForElement(sourceEl);
        const tgtCenter = getCenterForElement(targetEl);
        const srcRect = getRectForElement(sourceEl);
        const tgtRect = getRectForElement(targetEl);
        const src = getEdgePoint(srcRect, tgtCenter);
        const tgt = getEdgePoint(tgtRect, srcCenter);

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', src.x);
        line.setAttribute('y1', src.y);
        line.setAttribute('x2', tgt.x);
        line.setAttribute('y2', tgt.y);
        line.classList.add('link-line');
        if (link.link_type) {
            line.classList.add(link.link_type);
        }
        svg.appendChild(line);
    });
}

function scheduleDrawLinks() {
    if (drawQueued) return;
    drawQueued = true;
    requestAnimationFrame(() => {
        drawQueued = false;
        drawLinks();
    });
}

function applyViewportTransform() {
    if (!viewport) return;
    viewport.style.transform = `translate(${boardState.translateX}px, ${boardState.translateY}px) scale(${boardState.scale})`;
}

function clampScale(value) {
    return Math.min(2, Math.max(0.5, value));
}

function setupCanvasControls() {
    if (!canvas) return;
    const suppressMiddleClick = (event) => {
        if (event.button === 1) {
            event.preventDefault();
            event.stopPropagation();
        }
    };

    document.addEventListener('auxclick', suppressMiddleClick, true);

    canvas.addEventListener('wheel', (event) => {
        event.preventDefault();
        if (!viewport) return;
        const rect = canvas.getBoundingClientRect();
        const cursorX = event.clientX - rect.left;
        const cursorY = event.clientY - rect.top;
        const delta = event.deltaY < 0 ? 1.1 : 0.9;
        const newScale = clampScale(boardState.scale * delta);
        const worldX = (cursorX - boardState.translateX) / boardState.scale;
        const worldY = (cursorY - boardState.translateY) / boardState.scale;
        boardState.scale = newScale;
        boardState.translateX = cursorX - worldX * newScale;
        boardState.translateY = cursorY - worldY * newScale;
        applyViewportTransform();
    }, { passive: false });

    canvas.addEventListener('mousedown', (event) => {
        if (event.button !== 1) return;
        event.preventDefault();
        event.stopPropagation();
        isPanning = true;
        panStart.x = event.clientX;
        panStart.y = event.clientY;
        panStart.translateX = boardState.translateX;
        panStart.translateY = boardState.translateY;
        canvas.classList.add('panning');
    });

    document.addEventListener('mousemove', (event) => {
        if (!isPanning) return;
        const dx = event.clientX - panStart.x;
        const dy = event.clientY - panStart.y;
        boardState.translateX = panStart.translateX + dx;
        boardState.translateY = panStart.translateY + dy;
        applyViewportTransform();
    });

    document.addEventListener('mouseup', (event) => {
        if (!isPanning) return;
        if (event.button !== 1) return;
        event.preventDefault();
        event.stopPropagation();
        isPanning = false;
        canvas.classList.remove('panning');
    });

    canvas.addEventListener('auxclick', (event) => {
        if (event.button === 1) {
            event.preventDefault();
            event.stopPropagation();
        }
    });
}

async function generateItem(itemId) {
    try {
        const response = await fetch('includes/idea_board_handlers.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'generate_item',
                item_id: itemId
            })
        });
        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (err) {
            throw new Error(text || 'Invalid response from server');
        }
        if (!data.success) {
            throw new Error(data.error || 'Failed to generate');
        }
        await loadItems();
        await pollGeneration(itemId);
    } catch (error) {
        alert(error.message || 'Failed to generate');
    }
}

async function uploadAudioForItem(itemId, file) {
    const formData = new FormData();
    formData.append('action', 'upload_audio');
    formData.append('board_id', boardId);
    formData.append('audio', file);
    const uploadResponse = await fetch('includes/idea_board_handlers.php', {
        method: 'POST',
        credentials: 'same-origin',
        body: formData
    });
    const uploadData = await uploadResponse.json();
    if (!uploadData.success) {
        throw new Error(uploadData.error || 'Audio upload failed');
    }
    await fetch('includes/idea_board_handlers.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'update_item',
            item_id: itemId,
            title: '',
            content: '',
            image_url: '',
            link_url: uploadData.url
        })
    });
    return uploadData.url;
}

async function pollGeneration(itemId) {
    const maxAttempts = 60;
    let attempts = 0;
    while (attempts < maxAttempts) {
        attempts += 1;
        await new Promise(resolve => setTimeout(resolve, 2000));
        const response = await fetch('includes/idea_board_handlers.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'refresh_item',
                item_id: itemId
            })
        });
        const data = await response.json();
        if (data.success && data.generated) {
            await loadItems();
            return;
        }
    }
    await loadItems();
}

async function deleteItem(itemId) {
    const response = await fetch('includes/idea_board_handlers.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'delete_item',
            item_id: itemId
        })
    });
    const data = await response.json();
    if (data.success) {
        loadItems();
    }
}

function startLinking(item) {
    linkingFrom = item;
    if (linkStatus) {
        let hint = 'Click a character, location, or scene to connect.';
        if (item.item_type === 'style_selector') {
            hint = 'Click a style node to connect.';
        }
        linkStatus.textContent = 'Linking from: ' + (item.title || item.item_type) + '. ' + hint;
        linkStatus.style.display = 'block';
        linkStatus.classList.add('active');
    }
}

async function completeLink(targetItem) {
    if (!linkingFrom) return;
    if (linkingFrom.id === targetItem.id) return;
    try {
        await fetch('includes/idea_board_handlers.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'create_link',
                board_id: boardId,
                source_item_id: linkingFrom.id,
                target_item_id: targetItem.id
            })
        });
        linkingFrom = null;
        if (linkStatus) {
            linkStatus.style.display = 'none';
            linkStatus.classList.remove('active');
        }
        await loadItems();
    } catch (error) {
        alert('Failed to create link');
    }
}

async function deleteLink(linkId) {
    const response = await fetch('includes/idea_board_handlers.php', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'delete_link',
            link_id: linkId
        })
    });
    const data = await response.json();
    if (data.success) {
        loadItems();
    }
}

function enableDrag(element, itemId) {
    const header = element.querySelector('.idea-item-header');
    if (!header) return;
    header.onmousedown = (event) => {
        if (isPanning) return;
        const scale = boardState.scale || 1;
        const rect = canvas.getBoundingClientRect();
        const pointerX = (event.clientX - rect.left - boardState.translateX) / scale;
        const pointerY = (event.clientY - rect.top - boardState.translateY) / scale;
        activeDrag = {
            element,
            itemId,
            offsetX: pointerX - element.offsetLeft,
            offsetY: pointerY - element.offsetTop
        };
        element.classList.add('dragging');
    };
    setupGlobalDragResize();
}

function enableResize(element, itemId, handle) {
    if (!handle) return;
    handle.onmousedown = (event) => {
        event.stopPropagation();
        activeResize = {
            element,
            itemId,
            startX: event.clientX,
            startY: event.clientY,
            startWidth: element.offsetWidth,
            startHeight: element.offsetHeight
        };
        element.classList.add('resizing');
    };
    setupGlobalDragResize();
}

async function loadItems() {
    if (!boardId) return;
    await fetchWardrobes();
    const response = await fetch(`includes/idea_board_handlers.php?action=get_items&board_id=${boardId}`, {
        credentials: 'same-origin'
    });
    const data = await response.json();
    if (!data.success) return;
    boardLinks = data.links || [];
    const queuedCount = (data.items || []).filter(item => item.generation_status === 'queued').length;
    if (generationIndicator) {
        if (queuedCount > 0) {
            generationIndicator.style.display = 'inline-flex';
            const text = generationIndicator.querySelector('.generation-text');
            if (text) {
                text.textContent = `Generation in progress (${queuedCount})`;
            }
        } else {
            generationIndicator.style.display = 'none';
        }
    }
    ensureViewport();
    ensureLinkLayer();
    const existing = new Map();
    viewport.querySelectorAll('.idea-item').forEach(itemEl => {
        const id = itemEl.dataset.itemId;
        if (id) existing.set(id, itemEl);
    });
    const nextIds = new Set();
    data.items.forEach(item => {
        const key = String(item.id);
        nextIds.add(key);
        if (existing.has(key)) {
            const el = existing.get(key);
            updateItemElement(el, item);
        } else {
            const el = renderItem(item);
            viewport.appendChild(el);
        }
    });
    existing.forEach((el, id) => {
        if (!nextIds.has(id)) {
            el.remove();
        }
    });
    if (linkSvg && linkSvg.parentNode !== viewport) {
        viewport.appendChild(linkSvg);
    }
    if (viewport.firstChild !== linkSvg) {
        viewport.insertBefore(linkSvg, viewport.firstChild);
    }
    scheduleDrawLinks();
}

loadItems();
window.addEventListener('resize', scheduleDrawLinks);
setupCanvasControls();

async function refreshComfyStatus() {
    if (!comfyStatusEl) return;
    comfyStatusEl.classList.remove('connected', 'offline', 'checking', 'degraded');
    comfyStatusEl.classList.add('checking');
    const statusText = comfyStatusEl.querySelector('.status-text');
    if (statusText) statusText.textContent = 'Checking ComfyUI...';
    try {
        const response = await fetch('includes/idea_board_handlers.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'comfy_status' })
        });
        const data = await response.json();
        const status = data.status || (data.success ? 'connected' : 'offline');
        comfyStatusEl.classList.remove('checking');
        comfyStatusEl.classList.add(status);
        if (data.url) {
            comfyStatusEl.title = `ComfyUI URL: ${data.url}`;
        }
        if (statusText) {
            if (status === 'connected') statusText.textContent = 'ComfyUI: Connected';
            if (status === 'degraded') statusText.textContent = 'ComfyUI: Not configured';
            if (status === 'offline') statusText.textContent = 'ComfyUI: Offline';
        }
    } catch (err) {
        comfyStatusEl.classList.remove('checking');
        comfyStatusEl.classList.add('offline');
        if (statusText) statusText.textContent = 'ComfyUI: Offline';
    }
}

refreshComfyStatus();

async function openHistory(itemId) {
    if (!historyModal || !historyBody) return;
    historyBody.innerHTML = '<div class="history-loading">Loading generation history...</div>';
    historyModal.style.display = 'flex';
    try {
        const response = await fetch('includes/idea_board_handlers.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get_generation_history', item_id: itemId })
        });
        const data = await response.json();
        if (!data.success) {
            historyBody.innerHTML = `<div class="history-error">${data.error || 'Failed to load history'}</div>`;
            return;
        }
        const generations = data.generations || [];
        const linksMap = data.links || {};
        if (!generations.length) {
            historyBody.innerHTML = '<div class="history-empty">No generations yet.</div>';
            return;
        }
        historyBody.innerHTML = '';
        generations.forEach(gen => {
            const row = document.createElement('div');
            row.className = `history-row ${gen.status || ''}`;
            const title = document.createElement('div');
            title.className = 'history-title';
            title.textContent = `Generation ${gen.id}`;
            const meta = document.createElement('div');
            meta.className = 'history-meta';
            const created = gen.created_at ? formatRelativeTime(gen.created_at) : 'Unknown';
            meta.textContent = `${gen.status || 'queued'} • ${created}`;
            row.appendChild(title);
            row.appendChild(meta);
            if (gen.image_url) {
                const img = document.createElement('img');
                img.src = gen.image_url;
                img.alt = 'Generated image';
                img.loading = 'lazy';
                row.appendChild(img);
            }
            if (gen.error) {
                const err = document.createElement('div');
                err.className = 'history-error';
                err.textContent = gen.error;
                row.appendChild(err);
            }
            const links = linksMap[gen.id] || [];
            if (links.length) {
                const list = document.createElement('div');
                list.className = 'history-links';
                links.forEach(link => {
                    const chip = document.createElement('span');
                    chip.className = `history-link ${link.link_type}`;
                    chip.textContent = link.source_title || link.source_type || link.link_type;
                    list.appendChild(chip);
                });
                row.appendChild(list);
            }
            historyBody.appendChild(row);
        });
    } catch (err) {
        historyBody.innerHTML = `<div class="history-error">${err.message || 'Failed to load history'}</div>`;
    }
}

function setupGlobalDragResize() {
    if (globalDragHandlersReady) return;
    globalDragHandlersReady = true;

    dragMoveHandler = (event) => {
        if (!activeDrag) return;
        const scale = boardState.scale || 1;
        const rect = canvas.getBoundingClientRect();
        const pointerX = (event.clientX - rect.left - boardState.translateX) / scale;
        const pointerY = (event.clientY - rect.top - boardState.translateY) / scale;
        activeDrag.element.style.left = `${pointerX - activeDrag.offsetX}px`;
        activeDrag.element.style.top = `${pointerY - activeDrag.offsetY}px`;
        scheduleDrawLinks();
    };

    dragUpHandler = async () => {
        if (!activeDrag) return;
        const { element, itemId } = activeDrag;
        activeDrag = null;
        element.classList.remove('dragging');
        const posX = parseInt(element.style.left, 10);
        const posY = parseInt(element.style.top, 10);
        await fetch('includes/idea_board_handlers.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_position',
                item_id: itemId,
                pos_x: posX,
                pos_y: posY
            })
        });
        scheduleDrawLinks();
    };

    resizeMoveHandler = (event) => {
        if (!activeResize) return;
        const width = Math.max(180, activeResize.startWidth + (event.clientX - activeResize.startX));
        const height = Math.max(120, activeResize.startHeight + (event.clientY - activeResize.startY));
        activeResize.element.style.width = `${width}px`;
        activeResize.element.style.height = `${height}px`;
        scheduleDrawLinks();
    };

    resizeUpHandler = async () => {
        if (!activeResize) return;
        const { element, itemId } = activeResize;
        activeResize = null;
        element.classList.remove('resizing');
        const width = parseInt(element.style.width, 10);
        const height = parseInt(element.style.height, 10);
        await fetch('includes/idea_board_handlers.php', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_size',
                item_id: itemId,
                width,
                height
            })
        });
        scheduleDrawLinks();
    };

    document.addEventListener('mousemove', (event) => {
        dragMoveHandler(event);
        resizeMoveHandler(event);
    });
    document.addEventListener('mouseup', async () => {
        await dragUpHandler();
        await resizeUpHandler();
    });
}




