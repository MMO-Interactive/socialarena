document.addEventListener('DOMContentLoaded', function() {
    // Handle smooth scrolling for type links
    document.querySelectorAll('.type-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            targetElement.scrollIntoView({ behavior: 'smooth' });
        });
    });

    const search = document.getElementById('codex-search');
    const typeFilter = document.getElementById('codex-type-filter');
    const tagFilter = document.getElementById('codex-tag-filter');
    const sortSelect = document.getElementById('codex-sort');
    const viewSelect = document.getElementById('codex-view');
    const clearButton = document.getElementById('codex-clear');
    const exportButton = document.getElementById('codex-export');

    [search, typeFilter, tagFilter, sortSelect].forEach(control => {
        if (!control) return;
        control.addEventListener('input', applyFilters);
        control.addEventListener('change', applyFilters);
    });

    if (viewSelect) {
        viewSelect.addEventListener('change', () => {
            setView(viewSelect.value);
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            if (search) search.value = '';
            if (typeFilter) typeFilter.value = '';
            if (tagFilter) tagFilter.value = '';
            if (sortSelect) sortSelect.value = 'date';
            if (viewSelect) viewSelect.value = 'cards';
            applyFilters();
            setView('cards');
        });
    }

    if (exportButton) {
        exportButton.addEventListener('click', exportVisibleEntries);
    }

    applyFilters();
    setView(viewSelect ? viewSelect.value : 'cards');
});

function createNewEntry() {
    const modal = document.createElement('div');
    modal.className = 'modal codex-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Create New Universe Codex Entry</h2>
            <form id="new-codex-form">
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" name="title" required>
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
                    <label>Description</label>
                    <textarea name="content" required></textarea>
                </div>
                <div class="form-group">
                    <label>AI Context</label>
                    <textarea name="ai_context" placeholder="Add specific details for AI to use when generating content..."></textarea>
                </div>
                <div class="form-group">
                    <label>Tags (comma separated)</label>
                    <input type="text" name="tags">
                </div>
                <div class="form-group">
                    <label>Related Entries (mention tokens, comma separated)</label>
                    <input type="text" name="related_tokens">
                </div>
                <div class="form-group">
                    <label>First Appearance Date</label>
                    <input type="datetime-local" name="first_appearance_date" required>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn cancel" onclick="closeModal(this)">Cancel</button>
                    <button type="submit" class="btn submit">Create Entry</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
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
                    content: formData.get('content'),
                    ai_context: formData.get('ai_context'),
                    tags: formData.get('tags'),
                    related_tokens: formData.get('related_tokens'),
                    first_appearance_date: formData.get('first_appearance_date'),
                    visibility_level: 'universe',
                    is_universe_level: true,
                    mention_token: '@' + formData.get('title').replace(/\s+/g, ''),
                    universe_id: getCurrentUniverseId()
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success) {
                window.location.reload(); // Refresh to show new entry
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
        } catch (error) {
            console.error('Error creating entry:', error);
            alert('Error creating codex entry: ' + error.message);
        }
    });
}

function editEntry(entryId) {
    // Fetch entry details first
    fetch(`includes/codex_handlers.php?action=get_entry&id=${entryId}`)
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error);
            }
            
            const entry = data.entry;
            showEditModal(entry);
        })
        .catch(error => {
            console.error('Error fetching entry:', error);
            alert('Error loading entry: ' + error.message);
        });
}

function showEditModal(entry) {
    const modal = document.createElement('div');
    modal.className = 'modal codex-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h2>Edit Codex Entry</h2>
            <form id="edit-codex-form">
                <input type="hidden" name="entry_id" value="${entry.id}">
                <div class="form-group">
                    <label>Title</label>
                    <input type="text" name="title" value="${entry.title}" required>
                </div>
                <div class="form-group">
                    <label>Entry Type</label>
                    <select name="entry_type" required>
                        <option value="character" ${entry.entry_type === 'character' ? 'selected' : ''}>Character</option>
                        <option value="location" ${entry.entry_type === 'location' ? 'selected' : ''}>Location</option>
                        <option value="item" ${entry.entry_type === 'item' ? 'selected' : ''}>Item</option>
                        <option value="concept" ${entry.entry_type === 'concept' ? 'selected' : ''}>Concept</option>
                        <option value="event" ${entry.entry_type === 'event' ? 'selected' : ''}>Event</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea name="content" required>${entry.content}</textarea>
                </div>
                <div class="form-group">
                    <label>AI Context</label>
                    <textarea name="ai_context" placeholder="Add specific details for AI to use when generating content...">${entry.ai_context || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Tags (comma separated)</label>
                    <input type="text" name="tags" value="${(entry.tags || []).join(', ')}">
                </div>
                <div class="form-group">
                    <label>Related Entries (mention tokens, comma separated)</label>
                    <input type="text" name="related_tokens" value="${(entry.related || []).map(r => r.mention_token).join(', ')}">
                </div>
                <div class="form-group">
                    <label>First Appearance Date</label>
                    <input type="datetime-local" name="first_appearance_date" value="${entry.first_appearance_date}" required>
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn cancel" onclick="closeModal(this)">Cancel</button>
                    <button type="submit" class="btn submit">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
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
                    action: 'update_entry',
                    entry_id: formData.get('entry_id'),
                    title: formData.get('title'),
                    entry_type: formData.get('entry_type'),
                    content: formData.get('content'),
                    ai_context: formData.get('ai_context'),
                    first_appearance_date: formData.get('first_appearance_date'),
                    tags: formData.get('tags'),
                    related_tokens: formData.get('related_tokens')
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (data.success) {
                window.location.reload(); // Refresh to show updates
            } else {
                throw new Error(data.error || 'Unknown error occurred');
            }
        } catch (error) {
            console.error('Error updating entry:', error);
            alert('Error updating codex entry: ' + error.message);
        }
    });
}

function viewEntry(entryId) {
    window.open(`codex_entry.php?id=${entryId}`, '_blank');
}

function closeModal(element) {
    const modal = element.closest('.modal');
    if (modal) {
        modal.remove();
    }
}

function getCurrentUniverseId() {
    // Get from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('universe_id');
} 

function applyFilters() {
    const searchValue = (document.getElementById('codex-search')?.value || '').toLowerCase();
    const typeValue = (document.getElementById('codex-type-filter')?.value || '').toLowerCase();
    const tagValue = (document.getElementById('codex-tag-filter')?.value || '').toLowerCase();
    const sortValue = document.getElementById('codex-sort')?.value || 'date';

    let visibleCount = 0;
    let totalCount = 0;
    const sections = document.querySelectorAll('.entry-section');
    sections.forEach(section => {
        const cards = Array.from(section.querySelectorAll('.entry-card'));
        totalCount += cards.length;

        cards.forEach(card => {
            const title = card.dataset.title || '';
            const type = (card.dataset.type || '').toLowerCase();
            const tags = (card.dataset.tags || '').toLowerCase();
            const content = (card.dataset.content || '').toLowerCase();
            const matchesSearch = !searchValue || title.includes(searchValue) || content.includes(searchValue) || tags.includes(searchValue);
            const matchesType = !typeValue || type === typeValue;
            const matchesTag = !tagValue || tags.split(',').map(t => t.trim()).includes(tagValue);

            card.style.display = (matchesSearch && matchesType && matchesTag) ? '' : 'none';
        });

        const visibleCards = cards.filter(card => card.style.display !== 'none');
        visibleCount += visibleCards.length;
        if (sortValue === 'title') {
            visibleCards.sort((a, b) => (a.dataset.title || '').localeCompare(b.dataset.title || ''));
        } else if (sortValue === 'source') {
            visibleCards.sort((a, b) => parseInt(a.dataset.sourceOrder || '0', 10) - parseInt(b.dataset.sourceOrder || '0', 10));
        } else {
            visibleCards.sort((a, b) => (a.dataset.date || '').localeCompare(b.dataset.date || ''));
        }

        const grid = section.querySelector('.entries-grid');
        visibleCards.forEach(card => grid.appendChild(card));

        const anyVisible = visibleCards.length > 0;
        section.style.display = anyVisible ? '' : 'none';
    });

    const countEl = document.getElementById('codex-count');
    if (countEl) {
        countEl.textContent = `${visibleCount} of ${totalCount} entries`;
    }

    renderTimeline();
    renderGraph();
}

function exportVisibleEntries() {
    const cards = Array.from(document.querySelectorAll('.entry-card')).filter(card => card.style.display !== 'none');
    const rows = [
        ['Title', 'Type', 'Mention Token', 'Tags', 'Date']
    ];

    cards.forEach(card => {
        rows.push([
            (card.querySelector('.entry-card-header h3')?.textContent || '').trim(),
            card.dataset.type || '',
            card.dataset.token || '',
            card.dataset.tags || '',
            card.dataset.date || ''
        ]);
    });

    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'codex_entries.csv';
    a.click();
    URL.revokeObjectURL(url);
}

function quickView(entryId) {
    fetch(`includes/codex_handlers.php?action=get_entry&id=${entryId}`)
        .then(response => response.json())
        .then(data => {
            if (!data.success) {
                throw new Error(data.error);
            }
            showQuickViewModal(data.entry);
        })
        .catch(error => {
            alert('Failed to load entry: ' + error.message);
        });
}

function showQuickViewModal(entry) {
    const modal = document.createElement('div');
    modal.className = 'modal codex-modal';
    const tags = (entry.tags || []).join(', ');
    const relatedLinks = (entry.related || []).map(r => `<a href="codex_entry.php?token=${encodeURIComponent(r.mention_token)}" target="_blank">${r.title}</a>`).join(', ');
    modal.innerHTML = `
        <div class="modal-content">
            <h2>${entry.title}</h2>
            <p><strong>Type:</strong> ${entry.entry_type}</p>
            <p><strong>Mention:</strong> <code>${entry.mention_token || ''}</code> <button type="button" class="btn" onclick="copyText('${entry.mention_token || ''}')">Copy</button></p>
            <p><strong>Tags:</strong> ${tags || 'None'}</p>
            <p><strong>Related:</strong> ${relatedLinks || 'None'}</p>
            <div class="entry-card-content">${entry.content || ''}</div>
            <div class="modal-actions">
                <button type="button" class="btn" onclick="editEntry(${entry.id})">Edit</button>
                <button type="button" class="btn" onclick="closeModal(this)">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function copyText(text) {
    if (!text) return;
    navigator.clipboard.writeText(text);
}

function setView(view) {
    const cards = document.getElementById('codex-cards-view');
    const timeline = document.getElementById('codex-timeline-view');
    const graph = document.getElementById('codex-graph-view');

    if (cards) cards.style.display = view === 'cards' ? '' : 'none';
    if (timeline) timeline.style.display = view === 'timeline' ? '' : 'none';
    if (graph) graph.style.display = view === 'graph' ? '' : 'none';
}

function renderTimeline() {
    const list = document.getElementById('codex-timeline-list');
    if (!list) return;
    list.innerHTML = '';

    const cards = Array.from(document.querySelectorAll('.entry-card')).filter(card => card.style.display !== 'none');
    const items = cards.map(card => ({
        title: card.querySelector('.entry-card-header h3')?.textContent || '',
        type: card.dataset.type || '',
        date: card.dataset.date || 'Undated',
        token: card.dataset.token || '',
        id: card.dataset.id || ''
    }));

    items.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.title.localeCompare(b.title));

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'timeline-item';
        div.innerHTML = `
            <div class="timeline-date">${item.date || 'Undated'}</div>
            <div class="timeline-title">${item.title}</div>
            <div class="timeline-meta">${item.type} • ${item.token}</div>
        `;
        list.appendChild(div);
    });
}

function renderGraph() {
    const canvas = document.getElementById('codex-graph-canvas');
    if (!canvas || !window.codexGraph) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const visibleCards = Array.from(document.querySelectorAll('.entry-card')).filter(card => card.style.display !== 'none');
    const visibleIds = new Set(visibleCards.map(card => parseInt(card.dataset.id || '0', 10)));
    const nodes = (window.codexGraph.nodes || []).filter(n => visibleIds.has(n.id));
    const edges = (window.codexGraph.edges || []).filter(e => visibleIds.has(parseInt(e.entry_id, 10)) && visibleIds.has(parseInt(e.related_entry_id, 10)));

    if (nodes.length === 0) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 40;
    const positions = {};

    nodes.forEach((node, index) => {
        const angle = (index / nodes.length) * Math.PI * 2;
        positions[node.id] = {
            x: centerX + radius * Math.cos(angle),
            y: centerY + radius * Math.sin(angle)
        };
    });

    ctx.strokeStyle = '#6b7280';
    edges.forEach(edge => {
        const from = positions[edge.entry_id];
        const to = positions[edge.related_entry_id];
        if (!from || !to) return;
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
    });

    nodes.forEach(node => {
        const pos = positions[node.id];
        if (!pos) return;
        ctx.beginPath();
        ctx.fillStyle = '#2563eb';
        ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111827';
        ctx.font = '12px Arial';
        ctx.fillText(node.title, pos.x + 10, pos.y + 4);
    });
}
