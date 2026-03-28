let mentionTimer = null;

document.addEventListener('DOMContentLoaded', function() {
    const editors = document.querySelectorAll('div[contenteditable="true"].scene-content.editor, #editor[contenteditable="true"]');
    editors.forEach(editor => {
        editor.addEventListener('keydown', function(e) {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                e.preventDefault();
                showAICommandMenu(this);
            }
        });
    });

    // Add @ mention handlers to existing beat content areas
    document.querySelectorAll('.beat-content[contenteditable="true"]').forEach(editor => {
        
        // Add input event listener for @ mentions
        editor.addEventListener('input', function() {
            const caretPos = getCaretPosition(this);
            const textUpToCursor = getTextUpToCursor(this);
            const match = /@([A-Za-z0-9_]*)$/.exec(textUpToCursor);
            if (match) {
                scheduleMentionSuggestions(match[1], this, caretPos);
            } else {
                hideMentionSuggestions();
            }
        });
    });

    initWriteSceneDraft();
});

function buildSceneBeat(editor) {
    const beatEditor = document.createElement('div');
    beatEditor.className = 'scene-beat-card';
    beatEditor.innerHTML = `
        <div class="beat-header">
            <div class="beat-header-left">
                <i class="fas fa-wave-square"></i> SCENE BEAT
            </div>
            <div class="beat-header-right">
                <button class="btn" onclick="hideBeat(this)">Hide</button>
                <button class="btn" onclick="deleteBeat(this)"><i class="fas fa-trash"></i></button>
            </div>
        </div>
        <div class="beat-content" contenteditable="true"
             placeholder="Start writing, or type @ to reference story elements..."></div>
        <div class="beat-footer">
            <button class="generate-btn" onclick="generateProse(this)">
                <i class="fas fa-robot"></i> Generate Prose
            </button>
            <button class="clear-btn" onclick="clearBeat(this)">
                <i class="fas fa-eraser"></i> Clear Beat
            </button>
        </div>
    `;

    const beatContent = beatEditor.querySelector('.beat-content');
    const beatFooter = beatEditor.querySelector('.beat-footer');
    const generateBtn = beatEditor.querySelector('.generate-btn');
    const clearBtn = beatEditor.querySelector('.clear-btn');

    if (beatContent) {
        beatContent.style.minHeight = '44px';
        beatContent.style.color = '#8b9baa';
        beatContent.style.background = '#1a2634';
        beatContent.style.display = 'block';
    }
    if (beatFooter) {
        beatFooter.style.display = 'flex';
        beatFooter.style.justifyContent = 'space-between';
        beatFooter.style.alignItems = 'center';
        beatFooter.style.padding = '10px 14px';
        beatFooter.style.borderTop = '1px solid #223244';
        beatFooter.style.background = '#1a2634';
        beatFooter.style.position = 'relative';
        beatFooter.style.zIndex = '1';
    }
    if (generateBtn) {
        generateBtn.style.display = 'inline-flex';
        generateBtn.style.alignItems = 'center';
        generateBtn.style.gap = '6px';
        generateBtn.style.padding = '6px 12px';
        generateBtn.style.background = '#2d3748';
        generateBtn.style.color = '#c3cfdd';
        generateBtn.style.border = 'none';
        generateBtn.style.borderRadius = '6px';
    }
    if (clearBtn) {
        clearBtn.style.display = 'inline-flex';
        clearBtn.style.alignItems = 'center';
        clearBtn.style.gap = '6px';
        clearBtn.style.padding = '6px 12px';
        clearBtn.style.background = 'transparent';
        clearBtn.style.color = '#8b9baa';
        clearBtn.style.border = 'none';
    }

    beatEditor.style.overflow = 'visible';
    beatEditor.style.height = 'auto';

    editor.insertAdjacentElement('beforebegin', beatEditor);
    
    // Add @ mention handler to the new beat content
    beatContent.addEventListener('input', function() {
        const caretPos = getCaretPosition(this);
        const textUpToCursor = getTextUpToCursor(this);
        const match = /@([A-Za-z0-9_]*)$/.exec(textUpToCursor);
        if (match) {
            scheduleMentionSuggestions(match[1], this, caretPos);
        } else {
            hideMentionSuggestions();
        }
    });
    
    beatContent.focus();
    return beatEditor;
}

function insertSceneBeat(menuItem) {
    const editorId = menuItem.dataset.editorId;
    const editor = document.querySelector(`.scene-content.editor[data-scene-id="${editorId}"]`);

    if (!editor) {
        return;
    }

    buildSceneBeat(editor);
    const menu = menuItem.closest('.ai-command-menu');
    if (menu) {
        menu.remove();
    }
}

// Rest of your existing functions (showAICommandMenu, hideBeat, deleteBeat, etc.)
function showAICommandMenu(editor) {
    
    // Remove any existing menus
    const existingMenu = document.querySelector('.ai-command-menu');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'ai-command-menu';
    const fallbackSceneId = document.body.dataset.sceneId || '';
    menu.dataset.editorId = editor.dataset.sceneId || fallbackSceneId;
    
    menu.innerHTML = `
        <div class="menu-section">
            <h3>AI</h3>
            <div class="menu-item" data-editor-id="${menu.dataset.editorId}" onclick="insertSceneBeat(this)">
                <div class="menu-item-icon">
                    <i class="fas fa-wave-square"></i>
                </div>
                <div class="menu-item-content">
                    <div class="menu-item-title">Scene Beat</div>
                    <div class="menu-item-description">A pivotal moment where something important changes, driving the narrative forward.</div>
                </div>
            </div>
            <div class="menu-item" onclick="continueWriting(this)">
                <div class="menu-item-icon">
                    <i class="fas fa-pen"></i>
                </div>
                <div class="menu-item-content">
                    <div class="menu-item-title">Continue Writing</div>
                    <div class="menu-item-description">Creates a new scene beat to continue writing.</div>
                </div>
            </div>
        </div>
    `;

    // Position the menu near the cursor
    const rect = editor.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = `${rect.top + 30}px`;
    menu.style.left = `${rect.left}px`;
    document.body.appendChild(menu);

    // Close menu when clicking outside
    document.addEventListener('click', function closeMenu(e) {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    });
}

function showSceneBeatDialog() {
    const editor = document.querySelector('div[contenteditable="true"].scene-content.editor');
    if (!editor) return;
    buildSceneBeat(editor);
}

function continueWriting() {
    const editor = document.querySelector('div[contenteditable="true"].scene-content.editor');
    if (!editor) return;
    buildSceneBeat(editor);
}

function hideBeat(button) {
    const beat = button.closest('.scene-beat-card');
    if (!beat) return;
    const content = beat.querySelector('.beat-content');
    if (!content) return;
    const isHidden = content.style.display === 'none';
    content.style.display = isHidden ? 'block' : 'none';
}

function deleteBeat(button) {
    const beat = button.closest('.scene-beat-card');
    if (beat) {
        beat.remove();
    }
}

function clearBeat(button) {
    const beat = button.closest('.scene-beat-card');
    if (!beat) return;
    const content = beat.querySelector('.beat-content');
    if (content) {
        content.textContent = '';
    }
}

function generateProse(button) {
    const beat = button.closest('.scene-beat-card');
    if (!beat) return;
    const content = beat.querySelector('.beat-content');
    if (!content) return;
    const beatText = content.textContent.trim();
    if (!beatText) return;
    const mentions = (beatText.match(/@[A-Za-z0-9_]+/g) || []).map(m => m.trim());
    const sceneId = (() => {
        const nextEditor = beat.nextElementSibling && beat.nextElementSibling.classList.contains('scene-content')
            ? beat.nextElementSibling
            : null;
        if (nextEditor && nextEditor.dataset.sceneId) {
            return nextEditor.dataset.sceneId;
        }
        const sectionEditor = beat.closest('.scene-section')?.querySelector('.scene-content.editor');
        if (sectionEditor && sectionEditor.dataset.sceneId) {
            return sectionEditor.dataset.sceneId;
        }
        return document.body.dataset.sceneId || '';
    })();

    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Generating...';

    const targetEditor = beat.nextElementSibling && beat.nextElementSibling.classList.contains('scene-content')
        ? beat.nextElementSibling
        : document.querySelector('div[contenteditable="true"].scene-content.editor');

    const storyId = getCurrentStoryId();

    fetch('includes/generate_prose.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ beat: beatText, mentions: mentions, story_id: storyId, scene_id: sceneId })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.prose) {
                if (targetEditor) {
                    const separator = targetEditor.textContent.trim() ? '\n\n' : '';
                    targetEditor.textContent = targetEditor.textContent + separator + data.prose;
                    targetEditor.focus();
                }
            } else {
                alert(data.error || 'Failed to generate prose');
            }
        })
        .catch(() => {
            alert('Failed to generate prose');
        })
        .finally(() => {
            button.disabled = false;
            button.textContent = originalText;
        });
}

// Add the mention-related functions
function showMentionSuggestions(query, editor, caretPos) {

    const storyId = getCurrentStoryId();
    const seriesId = getCurrentSeriesId();
    const universeId = getCurrentUniverseId();
    const params = new URLSearchParams({
        action: 'search_mentions',
        query: query
    });
    if (storyId) params.append('story_id', storyId);
    if (seriesId) params.append('series_id', seriesId);
    if (universeId) params.append('universe_id', universeId);
    
    fetch(`includes/codex_handlers.php?${params.toString()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            
            // Remove existing suggestion box if it exists
            hideMentionSuggestions();
            
            // Create new suggestion box
            const suggestionBox = document.createElement('div');
            suggestionBox.id = 'mention-suggestions';
            
            // Find the scene beat editor container and insert after it
            const sceneBeatEditor = editor.closest('.scene-beat-card');
            sceneBeatEditor.insertAdjacentElement('afterend', suggestionBox);
            
            // Add "Create New Entry" option if no matches found
            if (!data.suggestions || data.suggestions.length === 0) {
                const createNewOption = document.createElement('div');
                createNewOption.className = 'mention-suggestion create-new';
                createNewOption.innerHTML = `
                    <i class="fas fa-plus"></i>
                    <span>Create new entry "${query}"</span>
                `;
                
                // Add click handler
                createNewOption.addEventListener('click', () => {
                    createNewCodexEntry(query, editor);
                    hideMentionSuggestions();
                });
                
                suggestionBox.appendChild(createNewOption);
            } else {
                // Show existing suggestions
                data.suggestions.forEach(suggestion => {
                    const suggestionElement = document.createElement('div');
                    suggestionElement.className = 'mention-suggestion';
                    suggestionElement.innerHTML = `
                        <i class="fas fa-book"></i>
                        <span>${suggestion.title}</span>
                    `;
                    
                    suggestionElement.addEventListener('click', () => {
                        insertMention(suggestion.mention_token, editor);
                        hideMentionSuggestions();
                    });
                    
                    suggestionBox.appendChild(suggestionElement);
                });
            }
        })
        .catch(error => {
            console.error('Error fetching mentions:', error);
        });
}

function hideMentionSuggestions() {
    const suggestionBox = document.getElementById('mention-suggestions');
    if (suggestionBox) {
        suggestionBox.remove();
    }
}

function scheduleMentionSuggestions(query, editor, caretPos) {
    if (mentionTimer) {
        clearTimeout(mentionTimer);
    }
    if (query.length === 0) {
        hideMentionSuggestions();
        return;
    }
    mentionTimer = setTimeout(() => {
        showMentionSuggestions(query, editor, caretPos);
    }, 150);
}

function getTextUpToCursor(editor) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return '';
    }
    const range = selection.getRangeAt(0).cloneRange();
    const preRange = document.createRange();
    preRange.selectNodeContents(editor);
    preRange.setEnd(range.endContainer, range.endOffset);
    return preRange.toString();
}

function getCaretPosition(editor) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
        return { top: 0, left: 0 };
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    return { top: rect.top, left: rect.left };
}

// Add this function to handle mention insertion
function insertMention(mention, editor) {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    
    // Find the @ character
    const text = editor.textContent;
    const cursorPosition = range.startOffset;
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    
    if (lastAt !== -1) {
        // Create a span for the mention
        const mentionSpan = document.createElement('span');
        mentionSpan.setAttribute('data-mention', mention);
        mentionSpan.className = 'mention';
        mentionSpan.textContent = mention;
        
        // Replace the partial @mention with the span
        const beforeMention = text.substring(0, lastAt);
        const afterMention = text.substring(cursorPosition);
        
        // Clear the content and rebuild it
        editor.textContent = beforeMention;
        editor.appendChild(mentionSpan);
        editor.appendChild(document.createTextNode(afterMention));
        
        // Move cursor after the mention
        const newRange = document.createRange();
        newRange.setStartAfter(mentionSpan);
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
    }
}

// Update the createNewCodexEntry function
function createNewCodexEntry(query, editor) {
    const modal = document.createElement('div');
    modal.className = 'modal codex-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Create New Codex Entry</h2>
            <form id="new-codex-form">
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" name="title" value="${query}" required>
                </div>
                <div class="form-group">
                    <label>Entry Type</label>
                    <select name="entry_type" required>
                        <option value="character">Character</option>
                        <option value="location">Location</option>
                        <option value="item">Item</option>
                        <option value="concept">Concept</option>
                        <option value="event">Event</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Entry Level</label>
                    <select name="visibility_level" required>
                        <option value="story">Story Level</option>
                        <option value="series">Series Level</option>
                        <option value="universe">Universe Level</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>First Appearance Date</label>
                    <input type="datetime-local" name="first_appearance_date" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="content" required></textarea>
                </div>
                <div class="form-group">
                    <label>AI Context</label>
                    <textarea name="ai_context" placeholder="Add specific details for AI to use when generating content..."></textarea>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn cancel" onclick="closeModal(this)">Cancel</button>
                    <button type="submit" class="btn submit">Create Entry</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set default date to current story's timeline date
    const dateInput = modal.querySelector('input[name="first_appearance_date"]');
    dateInput.value = getCurrentStoryDate(); // You'll need to implement this function
    
    // Handle form submission
    modal.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        try {
            const response = await fetch('includes/codex_handlers.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'create_entry',
                    title: formData.get('title'),
                    entry_type: formData.get('entry_type'),
                    visibility_level: formData.get('visibility_level'),
                    first_appearance_date: formData.get('first_appearance_date'),
                    content: formData.get('content'),
                    ai_context: formData.get('ai_context'),
                    mention_token: '@' + formData.get('title').replace(/\s+/g, ''),
                    story_id: getCurrentStoryId(), // You'll need to implement this
                    series_id: getCurrentSeriesId(), // You'll need to implement this
                    universe_id: getCurrentUniverseId() // You'll need to implement this
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success) {
                insertMention('@' + formData.get('title').replace(/\s+/g, ''), editor);
                closeModal(modal);
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
        } catch (error) {
            console.error('Error creating entry:', error);
            alert('Error creating codex entry: ' + error.message);
        }
    });
}

// Add these helper functions to get current context
function getCurrentStoryId() {
    const container = document.querySelector('.write-container');
    if (container && container.dataset.storyId) {
        return container.dataset.storyId;
    }
    return document.body.dataset.storyId || '';
}

function getCurrentSeriesId() {
    const container = document.querySelector('.write-container');
    if (container && container.dataset.seriesId) {
        return container.dataset.seriesId;
    }
    return document.body.dataset.seriesId || '';
}

function getCurrentUniverseId() {
    const container = document.querySelector('.write-container');
    if (container && container.dataset.universeId) {
        return container.dataset.universeId;
    }
    return document.body.dataset.universeId || '';
}

function getCurrentStoryDate() {
    const container = document.querySelector('.write-container');
    if (!container) return new Date().toISOString().slice(0, 16);
    return container.dataset.timelineDate || new Date().toISOString().slice(0, 16);
}

function closeModal(element) {
    const modal = element.closest('.modal');
    if (modal) {
        modal.remove();
    }
}

function initWriteSceneDraft() {
    const editor = document.getElementById('editor');
    if (!editor) return;
    const sceneId = document.body.dataset.sceneId || '';
    if (!sceneId) return;
    const key = `scene_draft_${sceneId}`;
    const statusEl = document.querySelector('.save-status');
    const wordCountEl = document.querySelector('.word-count');

    if (!editor.textContent.trim()) {
        const saved = localStorage.getItem(key);
        if (saved) {
            editor.textContent = saved;
            if (statusEl) {
                statusEl.textContent = 'Draft restored';
            }
        }
    }

    updateWordCount(editor, wordCountEl);

    editor.addEventListener('input', () => {
        localStorage.setItem(key, editor.textContent);
        updateWordCount(editor, wordCountEl);
        if (statusEl) {
            statusEl.textContent = 'Draft saved locally';
        }
    });

    if (!editor.textContent.trim()) {
        editor.focus();
    }
}

function updateWordCount(editor, wordCountEl) {
    if (!wordCountEl) return;
    const words = editor.textContent.trim().split(/\s+/).filter(Boolean);
    const count = editor.textContent.trim() ? words.length : 0;
    wordCountEl.textContent = `${count} words`;
}

function clearLocalDraft() {
    const editor = document.getElementById('editor');
    if (!editor) return;
    const sceneId = document.body.dataset.sceneId || '';
    if (!sceneId) return;
    const key = `scene_draft_${sceneId}`;
    localStorage.removeItem(key);
    editor.textContent = '';
    updateWordCount(editor, document.querySelector('.word-count'));
    const statusEl = document.querySelector('.save-status');
    if (statusEl) {
        statusEl.textContent = 'Draft cleared';
    }
}

// ... (rest of your existing functions)
