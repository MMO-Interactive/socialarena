const permissionsGrid = document.getElementById('permissions-grid');
const studioId = permissionsGrid?.dataset.studioId;

const permissionLabels = {
    dashboard: 'Dashboard',
    writing_center: 'Writing Center',
    idea_boards: 'Idea Boards',
    series: 'Series',
    universes: 'Universes',
    stories: 'Scripts',
    projects: 'Projects',
    budgets: 'Budgets',
    virtual_cast: 'Virtual Cast',
    locations: 'Sets & Locations',
    wardrobe: 'Wardrobe',
    props: 'Prop Library',
    music_library: 'Music Library',
    music_composer: 'Music Composer',
    timeline: 'Timeline Planner',
    social: 'Social Manager',
    settings: 'Settings'
};

async function loadPermissions() {
    const response = await fetch('includes/studio_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list_permissions', studio_id: studioId })
    });
    const data = await response.json();
    if (!data.success) {
        permissionsGrid.innerHTML = '<div class="empty-state">Failed to load permissions.</div>';
        return;
    }
    const permissionsMap = new Map();
    data.permissions.forEach(entry => {
        const key = `${entry.user_id}:${entry.permission_key}`;
        permissionsMap.set(key, Boolean(entry.allowed));
    });

    permissionsGrid.innerHTML = '';
    data.members.forEach(member => {
        const card = document.createElement('div');
        card.className = 'permission-card';
        const header = document.createElement('div');
        header.className = 'permission-header';
        header.innerHTML = `
            <div>
                <strong>${member.username}</strong>
                <div class="muted">${member.email}</div>
            </div>
            <span class="role-pill">${member.role}</span>
        `;
        card.appendChild(header);

        const grid = document.createElement('div');
        grid.className = 'permission-grid';
        data.permission_keys.forEach(key => {
            const label = document.createElement('label');
            label.className = 'permission-item';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = permissionsMap.get(`${member.id}:${key}`) || member.role === 'owner';
            checkbox.disabled = member.role === 'owner';
            checkbox.addEventListener('change', () => updatePermission(member.id, key, checkbox.checked));
            const span = document.createElement('span');
            span.textContent = permissionLabels[key] || key;
            label.appendChild(checkbox);
            label.appendChild(span);
            grid.appendChild(label);
        });
        card.appendChild(grid);
        permissionsGrid.appendChild(card);
    });
}

async function updatePermission(memberId, key, allowed) {
    await fetch('includes/studio_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'update_permission',
            studio_id: studioId,
            member_id: memberId,
            permission_key: key,
            allowed
        })
    });
}

loadPermissions();
