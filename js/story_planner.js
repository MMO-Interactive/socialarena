document.addEventListener('DOMContentLoaded', function() {
    // Initialize Sortable for acts, chapters, and scenes
    initializeSortable();
    // Initialize collapsible sections
    initializeCollapsible();
    // Initialize inline editing
    initializeInlineEditing();
    // Batch generation actions
    initializeBatchActions();
});

// Initialize Sortable.js for drag-and-drop
function initializeSortable() {
    // Make acts sortable
    new Sortable(document.getElementById('story-structure'), {
        animation: 150,
        handle: '.act-header',
        draggable: '.act',
        onEnd: function(evt) {
            updateActOrder();
        }
    });

    // Make chapters sortable within each act
    document.querySelectorAll('.chapters-list').forEach(list => {
        new Sortable(list, {
            animation: 150,
            handle: '.chapter-header',
            draggable: '.chapter',
            group: 'chapters',
            onEnd: function(evt) {
                updateChapterOrder(evt.to.dataset.actId);
            }
        });
    });

    // Make scenes sortable within each chapter
    document.querySelectorAll('.scenes-list').forEach(list => {
        new Sortable(list, {
            animation: 150,
            handle: '.scene-header',
            draggable: '.scene',
            group: 'scenes',
            onEnd: function(evt) {
                updateSceneOrder(evt.to.dataset.chapterId);
            }
        });
    });
    // Make clips sortable within each scene
    document.querySelectorAll('.clips-list').forEach(list => {
        new Sortable(list, {
            animation: 150,
            handle: '.clip-info',
            draggable: '.clip',
            group: 'clips',
            onEnd: function(evt) {
                updateClipOrder(evt.to.dataset.sceneId);
            }
        });
    });

}
// Initialize collapsible functionality
function initializeCollapsible() {
    // Act toggles
    document.querySelectorAll('.act-toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const act = this.closest('.act');
            act.classList.toggle('collapsed');
            saveCollapsedState();
        });
    });

    // Chapter toggles
    document.querySelectorAll('.chapter-toggle').forEach(toggle => {
        toggle.addEventListener('click', function() {
            const chapter = this.closest('.chapter');
            chapter.classList.toggle('collapsed');
            saveCollapsedState();
        });
    });

    // Restore collapsed state
    restoreCollapsedState();
}

// Initialize inline editing
function initializeInlineEditing() {
    // Act titles
    document.querySelectorAll('.act-title').forEach(title => {
        title.addEventListener('blur', function() {
            const actId = this.closest('.act').dataset.id;
            updateTitle('act', actId, this.textContent);
        });
        title.addEventListener('keydown', handleEnterKey);
    });

    // Chapter titles
    document.querySelectorAll('.chapter-title').forEach(title => {
        title.addEventListener('blur', function() {
            const chapterId = this.closest('.chapter').dataset.id;
            updateTitle('chapter', chapterId, this.textContent);
        });
        title.addEventListener('keydown', handleEnterKey);
    });

    // Scene titles
    document.querySelectorAll('.scene-title').forEach(title => {
        title.addEventListener('blur', function() {
            const sceneId = this.closest('.scene').dataset.id;
            updateTitle('scene', sceneId, this.textContent);
        });
        title.addEventListener('keydown', handleEnterKey);
    });

    // Clip titles
    document.querySelectorAll('.clip-title').forEach(title => {
        title.addEventListener('blur', function() {
            const clipId = this.closest('.clip').dataset.id;
            updateTitle('clip', clipId, this.textContent);
        });
        title.addEventListener('keydown', handleEnterKey);
    });
}

function initializeBatchActions() {
    const batchStartBtn = document.getElementById('batch-starting-images');
    const batchClipBtn = document.getElementById('batch-generate-clips');
    if (batchStartBtn) {
        batchStartBtn.addEventListener('click', () => batchGenerate('generate_starting_image'));
    }
    if (batchClipBtn) {
        batchClipBtn.addEventListener('click', () => batchGenerate('generate_clip'));
    }
}

async function batchGenerate(action) {
    const clips = Array.from(document.querySelectorAll('.clip'));
    if (clips.length === 0) {
        alert('No clips found to generate.');
        return;
    }
    const clipIds = clips.map(clip => clip.dataset.id).filter(Boolean);
    if (!clipIds.length) {
        alert('No clips found to generate.');
        return;
    }
    if (!confirm(`Queue ${clipIds.length} clips for ${action === 'generate_clip' ? 'clip generation' : 'starting images'}?`)) {
        return;
    }

    for (const clipId of clipIds) {
        await fetch('includes/clip_handlers.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, clip_id: clipId })
        });
    }
    alert('Batch generation queued.');
}

// Handle Enter key in contenteditable elements
function handleEnterKey(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        e.target.blur();
    }
}

// CRUD Operations
async function addAct() {
    try {
        const response = await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'add_act',
                story_id: getStoryId()
            })
        });
        
        if (response.ok) {
            location.reload();
        }
    } catch (error) {
        console.error('Error adding act:', error);
    }
}

async function addChapter(actId) {
    try {
        const response = await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'add_chapter',
                act_id: actId
            })
        });
        
        if (response.ok) {
            location.reload();
        }
    } catch (error) {
        console.error('Error adding chapter:', error);
    }
}

async function addScene(chapterId) {
    try {
        const response = await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'add_scene',
                chapter_id: chapterId
            })
        });
        
        if (response.ok) {
            location.reload();
        }
    } catch (error) {
        console.error('Error adding scene:', error);
    }
}


async function addClip(sceneId) {
    try {
        const response = await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'add_clip',
                scene_id: sceneId
            })
        });
        
        if (response.ok) {
            location.reload();
        }
    } catch (error) {
        console.error('Error adding clip:', error);
    }
}

async function updateTitle(type, id, title) {
    try {
        const response = await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_title',
                type: type,
                id: id,
                title: title
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update title');
        }
    } catch (error) {
        console.error('Error updating title:', error);
    }
}

async function updateActOrder() {
    const acts = Array.from(document.querySelectorAll('.act'));
    const order = acts.map((act, index) => ({
        id: act.dataset.id,
        order: index
    }));

    try {
        await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_act_order',
                order: order
            })
        });
    } catch (error) {
        console.error('Error updating act order:', error);
    }
}

async function updateChapterOrder(actId) {
    const chapters = Array.from(document.querySelector(`[data-act-id="${actId}"]`).querySelectorAll('.chapter'));
    const order = chapters.map((chapter, index) => ({
        id: chapter.dataset.id,
        order: index
    }));

    try {
        await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_chapter_order',
                act_id: actId,
                order: order
            })
        });
    } catch (error) {
        console.error('Error updating chapter order:', error);
    }
}

async function updateSceneOrder(chapterId) {
    const scenes = Array.from(document.querySelector(`[data-chapter-id="${chapterId}"]`).querySelectorAll('.scene'));
    const order = scenes.map((scene, index) => ({
        id: scene.dataset.id,
        order: index
    }));

    try {
        await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_scene_order',
                chapter_id: chapterId,
                order: order
            })
        });
    } catch (error) {
        console.error('Error updating scene order:', error);
    }
}


async function updateClipOrder(sceneId) {
    const clips = Array.from(document.querySelector(`[data-scene-id="${sceneId}"]`).querySelectorAll('.clip'));
    const order = clips.map((clip, index) => ({
        id: clip.dataset.id,
        order: index
    }));

    try {
        await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_clip_order',
                scene_id: sceneId,
                order: order
            })
        });
    } catch (error) {
        console.error('Error updating clip order:', error);
    }
}

// Delete operations
async function deleteAct(actId) {
    if (!confirm('Are you sure you want to delete this act and all its contents?')) return;
    
    try {
        const response = await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'delete_act',
                act_id: actId
            })
        });
        
        if (response.ok) {
            location.reload();
        }
    } catch (error) {
        console.error('Error deleting act:', error);
    }
}

async function deleteChapter(chapterId) {
    if (!confirm('Are you sure you want to delete this chapter and all its scenes?')) return;

    try {
        const response = await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'delete_chapter',
                chapter_id: chapterId
            })
        });

        if (response.ok) {
            location.reload();
        }
    } catch (error) {
        console.error('Error deleting chapter:', error);
    }
}

async function deleteScene(sceneId) {
    if (!confirm('Are you sure you want to delete this scene?')) return;

    try {
        const response = await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'delete_scene',
                scene_id: sceneId
            })
        });

        if (response.ok) {
            location.reload();
        }
    } catch (error) {
        console.error('Error deleting scene:', error);
    }
}


async function deleteClip(clipId) {
    if (!confirm('Are you sure you want to delete this clip?')) return;

    try {
        const response = await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'delete_clip',
                clip_id: clipId
            })
        });

        if (response.ok) {
            location.reload();
        }
    } catch (error) {
        console.error('Error deleting clip:', error);
    }
}

// Helper functions
function getStoryId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

// Save and restore collapsed state
function saveCollapsedState() {
    const state = {
        acts: Array.from(document.querySelectorAll('.act')).map(act => ({
            id: act.dataset.id,
            collapsed: act.classList.contains('collapsed')
        })),
        chapters: Array.from(document.querySelectorAll('.chapter')).map(chapter => ({
            id: chapter.dataset.id,
            collapsed: chapter.classList.contains('collapsed')
        }))
    };
    localStorage.setItem(`story_${getStoryId()}_collapsed`, JSON.stringify(state));
}

function restoreCollapsedState() {
    const state = JSON.parse(localStorage.getItem(`story_${getStoryId()}_collapsed`));
    if (!state) return;

    state.acts.forEach(act => {
        const element = document.querySelector(`.act[data-id="${act.id}"]`);
        if (element && act.collapsed) {
            element.classList.add('collapsed');
        }
    });

    state.chapters.forEach(chapter => {
        const element = document.querySelector(`.chapter[data-id="${chapter.id}"]`);
        if (element && chapter.collapsed) {
            element.classList.add('collapsed');
        }
    });
}

function toggleDescription(sceneId) {
    const container = document.getElementById(`description-${sceneId}`);
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

async function updateSceneDescription(sceneId, description) {
    try {
        const response = await fetch('includes/story_planner_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update_scene_description',
                scene_id: sceneId,
                description: description
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error('Failed to update scene description');
        }
    } catch (error) {
        console.error('Error updating scene description:', error);
        alert('Failed to save scene description. Please try again.');
    }
}

function editScene(sceneId) {
    if (!sceneId) return;
    window.location.href = `write_scene.php?scene_id=${sceneId}`;
}
