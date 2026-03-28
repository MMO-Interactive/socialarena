(() => {
    const modal = document.getElementById('project-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalTitleInput = document.getElementById('modal-title-input');
    const modalTitleLabel = document.getElementById('modal-title-label');
    const modalExtra = document.getElementById('modal-extra');
    const modalCancel = document.getElementById('modal-cancel');
    const modalSave = document.getElementById('modal-save');

    const taskList = document.getElementById('task-list');
    const milestoneList = document.getElementById('milestone-list');
    const shotList = document.getElementById('shot-list');

    const state = {
        mode: 'create',
        type: null,
        id: null
    };

    const statusOptions = {
        task: ['todo', 'in_progress', 'done'],
        milestone: ['upcoming', 'at_risk', 'completed'],
        shot: ['planned', 'blocked', 'shot']
    };

    function openModal(type, data = {}) {
        state.mode = data.id ? 'edit' : 'create';
        state.type = type;
        state.id = data.id || null;

        modalTitle.textContent = `${state.mode === 'create' ? 'Add' : 'Edit'} ${capitalize(type)}`;
        modalTitleLabel.textContent = type === 'shot' ? 'Shot label' : 'Title';
        modalTitleInput.value = data.title || data.label || '';

        modalExtra.innerHTML = '';

        if (type === 'task') {
            modalExtra.appendChild(renderSelect('Status', 'status', statusOptions.task, data.status || 'todo'));
            modalExtra.appendChild(renderSelect('Priority', 'priority', ['low', 'medium', 'high'], data.priority || 'medium'));
            modalExtra.appendChild(renderInput('Due date', 'due_date', 'date', data.due_date || ''));
            modalExtra.appendChild(renderTextarea('Description', 'description', data.description || ''));
        } else if (type === 'milestone') {
            modalExtra.appendChild(renderSelect('Status', 'status', statusOptions.milestone, data.status || 'upcoming'));
            modalExtra.appendChild(renderInput('Target date', 'target_date', 'date', data.target_date || ''));
            modalExtra.appendChild(renderTextarea('Notes', 'notes', data.notes || ''));
        } else if (type === 'shot') {
            modalExtra.appendChild(renderInput('Shot type', 'shot_type', 'text', data.shot_type || ''));
            modalExtra.appendChild(renderInput('Location', 'location', 'text', data.location || ''));
            modalExtra.appendChild(renderSelect('Status', 'status', statusOptions.shot, data.status || 'planned'));
            modalExtra.appendChild(renderTextarea('Description', 'description', data.description || ''));
        }

        modal.style.display = 'flex';
        modalTitleInput.focus();
    }

    function closeModal() {
        modal.style.display = 'none';
        state.type = null;
        state.id = null;
    }

    function renderInput(label, name, type, value) {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        const input = document.createElement('input');
        input.type = type;
        input.name = name;
        input.value = value;
        wrapper.appendChild(labelEl);
        wrapper.appendChild(input);
        return wrapper;
    }

    function renderSelect(label, name, options, selected) {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        const select = document.createElement('select');
        select.name = name;
        options.forEach((option) => {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option.replace('_', ' ');
            if (option === selected) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
        wrapper.appendChild(labelEl);
        wrapper.appendChild(select);
        return wrapper;
    }

    function renderTextarea(label, name, value) {
        const wrapper = document.createElement('div');
        wrapper.className = 'form-group';
        const labelEl = document.createElement('label');
        labelEl.textContent = label;
        const textarea = document.createElement('textarea');
        textarea.name = name;
        textarea.rows = 3;
        textarea.value = value;
        wrapper.appendChild(labelEl);
        wrapper.appendChild(textarea);
        return wrapper;
    }

    function capitalize(value) {
        return value.charAt(0).toUpperCase() + value.slice(1);
    }

    function getFormData() {
        const data = {};
        const fields = modalExtra.querySelectorAll('input, select, textarea');
        fields.forEach((field) => {
            data[field.name] = field.value;
        });
        return data;
    }

    async function sendRequest(payload) {
        const response = await fetch('includes/project_handlers.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        const json = await response.json();
        if (!response.ok || !json.success) {
            throw new Error(json.error || 'Request failed');
        }
        return json;
    }

    function setEmptyState(listEl, empty) {
        const existing = listEl.querySelector('.empty-state');
        if (empty) {
            if (!existing) {
                const emptyEl = document.createElement('p');
                emptyEl.className = 'empty-state';
                emptyEl.textContent = 'No items yet.';
                listEl.appendChild(emptyEl);
            }
        } else if (existing) {
            existing.remove();
        }
    }

    function buildTaskElement(item) {
        const wrapper = document.createElement('div');
        wrapper.className = 'panel-item';
        wrapper.dataset.id = item.id;
        wrapper.dataset.title = item.title || '';
        wrapper.dataset.description = item.description || '';
        wrapper.dataset.status = item.status || 'todo';
        wrapper.dataset.priority = item.priority || 'medium';
        wrapper.dataset.dueDate = item.due_date || '';

        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = item.title;
        const muted = document.createElement('div');
        muted.className = 'muted';
        muted.textContent = `${item.status} | ${item.priority}`;
        info.appendChild(title);
        info.appendChild(muted);

        const actions = document.createElement('div');
        actions.className = 'panel-actions';
        const editBtn = document.createElement('button');
        editBtn.className = 'btn';
        editBtn.dataset.action = 'edit-task';
        editBtn.textContent = 'Edit';
        const delBtn = document.createElement('button');
        delBtn.className = 'btn danger';
        delBtn.dataset.action = 'delete-task';
        delBtn.textContent = 'Remove';
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        wrapper.appendChild(info);
        wrapper.appendChild(actions);
        return wrapper;
    }

    function buildMilestoneElement(item) {
        const wrapper = document.createElement('div');
        wrapper.className = 'panel-item';
        wrapper.dataset.id = item.id;
        wrapper.dataset.title = item.title || '';
        wrapper.dataset.notes = item.notes || '';
        wrapper.dataset.status = item.status || 'upcoming';
        wrapper.dataset.targetDate = item.target_date || '';

        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = item.title;
        const muted = document.createElement('div');
        muted.className = 'muted';
        muted.textContent = item.target_date ? `${item.status} | ${item.target_date}` : item.status;
        info.appendChild(title);
        info.appendChild(muted);

        const actions = document.createElement('div');
        actions.className = 'panel-actions';
        const editBtn = document.createElement('button');
        editBtn.className = 'btn';
        editBtn.dataset.action = 'edit-milestone';
        editBtn.textContent = 'Edit';
        const delBtn = document.createElement('button');
        delBtn.className = 'btn danger';
        delBtn.dataset.action = 'delete-milestone';
        delBtn.textContent = 'Remove';
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        wrapper.appendChild(info);
        wrapper.appendChild(actions);
        return wrapper;
    }

    function buildShotElement(item) {
        const wrapper = document.createElement('div');
        wrapper.className = 'panel-item';
        wrapper.dataset.id = item.id;
        wrapper.dataset.label = item.shot_label || '';
        wrapper.dataset.description = item.description || '';
        wrapper.dataset.location = item.location || '';
        wrapper.dataset.shotType = item.shot_type || '';
        wrapper.dataset.status = item.status || 'planned';

        const info = document.createElement('div');
        const title = document.createElement('strong');
        title.textContent = item.shot_label || 'Shot';
        const muted = document.createElement('div');
        muted.className = 'muted';
        const typeText = item.shot_type ? `${item.shot_type} | ` : '';
        muted.textContent = `${typeText}${item.status}`;
        info.appendChild(title);
        info.appendChild(muted);

        const actions = document.createElement('div');
        actions.className = 'panel-actions';
        const editBtn = document.createElement('button');
        editBtn.className = 'btn';
        editBtn.dataset.action = 'edit-shot';
        editBtn.textContent = 'Edit';
        const delBtn = document.createElement('button');
        delBtn.className = 'btn danger';
        delBtn.dataset.action = 'delete-shot';
        delBtn.textContent = 'Remove';
        actions.appendChild(editBtn);
        actions.appendChild(delBtn);

        wrapper.appendChild(info);
        wrapper.appendChild(actions);
        return wrapper;
    }

    function readItemData(itemEl) {
        return {
            id: Number(itemEl.dataset.id),
            title: itemEl.dataset.title || '',
            description: itemEl.dataset.description || '',
            status: itemEl.dataset.status || '',
            priority: itemEl.dataset.priority || '',
            due_date: itemEl.dataset.dueDate || '',
            notes: itemEl.dataset.notes || '',
            target_date: itemEl.dataset.targetDate || '',
            label: itemEl.dataset.label || '',
            shot_type: itemEl.dataset.shotType || '',
            location: itemEl.dataset.location || ''
        };
    }

    document.getElementById('add-task')?.addEventListener('click', () => openModal('task'));
    document.getElementById('add-milestone')?.addEventListener('click', () => openModal('milestone'));
    document.getElementById('add-shot')?.addEventListener('click', () => openModal('shot'));

    modalCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    modalSave.addEventListener('click', async () => {
        if (!state.type) {
            return;
        }
        const baseTitle = modalTitleInput.value.trim();
        if (baseTitle === '') {
            alert('Title is required.');
            return;
        }

        const extraData = getFormData();
        let payload = {};

        if (state.type === 'task') {
            payload = {
                action: state.mode === 'create' ? 'create_task' : 'update_task',
                project_id: window.projectContext.projectId,
                task_id: state.id,
                title: baseTitle,
                description: extraData.description,
                status: extraData.status,
                priority: extraData.priority,
                due_date: extraData.due_date
            };
        } else if (state.type === 'milestone') {
            payload = {
                action: state.mode === 'create' ? 'create_milestone' : 'update_milestone',
                project_id: window.projectContext.projectId,
                milestone_id: state.id,
                title: baseTitle,
                target_date: extraData.target_date,
                status: extraData.status,
                notes: extraData.notes
            };
        } else if (state.type === 'shot') {
            payload = {
                action: state.mode === 'create' ? 'create_shot' : 'update_shot',
                project_id: window.projectContext.projectId,
                shot_id: state.id,
                shot_label: baseTitle,
                shot_type: extraData.shot_type,
                location: extraData.location,
                status: extraData.status,
                description: extraData.description
            };
        }

        try {
            const result = await sendRequest(payload);
            if (state.type === 'task') {
                const element = buildTaskElement(result.item);
                if (state.mode === 'create') {
                    taskList.prepend(element);
                    setEmptyState(taskList, false);
                } else {
                    const existing = taskList.querySelector(`[data-id="${result.item.id}"]`);
                    if (existing) {
                        existing.replaceWith(element);
                    }
                }
            } else if (state.type === 'milestone') {
                const element = buildMilestoneElement(result.item);
                if (state.mode === 'create') {
                    milestoneList.prepend(element);
                    setEmptyState(milestoneList, false);
                } else {
                    const existing = milestoneList.querySelector(`[data-id="${result.item.id}"]`);
                    if (existing) {
                        existing.replaceWith(element);
                    }
                }
            } else if (state.type === 'shot') {
                const element = buildShotElement(result.item);
                if (state.mode === 'create') {
                    shotList.prepend(element);
                    setEmptyState(shotList, false);
                } else {
                    const existing = shotList.querySelector(`[data-id="${result.item.id}"]`);
                    if (existing) {
                        existing.replaceWith(element);
                    }
                }
            }
            closeModal();
        } catch (error) {
            alert(error.message);
        }
    });

    function handleListClick(event, type) {
        const action = event.target.dataset.action;
        if (!action) {
            return;
        }
        const itemEl = event.target.closest('.panel-item');
        if (!itemEl) {
            return;
        }
        const data = readItemData(itemEl);

        if (action.startsWith('edit')) {
            openModal(type, data);
            return;
        }

        if (action.startsWith('delete')) {
            const confirmDelete = confirm('Remove this item?');
            if (!confirmDelete) {
                return;
            }

            let payload = {};
            if (type === 'task') {
                payload = { action: 'delete_task', task_id: data.id };
            } else if (type === 'milestone') {
                payload = { action: 'delete_milestone', milestone_id: data.id };
            } else {
                payload = { action: 'delete_shot', shot_id: data.id };
            }

            sendRequest(payload)
                .then(() => {
                    itemEl.remove();
                    if (type === 'task') {
                        setEmptyState(taskList, taskList.querySelectorAll('.panel-item').length === 0);
                    } else if (type === 'milestone') {
                        setEmptyState(milestoneList, milestoneList.querySelectorAll('.panel-item').length === 0);
                    } else {
                        setEmptyState(shotList, shotList.querySelectorAll('.panel-item').length === 0);
                    }
                })
                .catch((error) => alert(error.message));
        }
    }

    taskList?.addEventListener('click', (event) => handleListClick(event, 'task'));
    milestoneList?.addEventListener('click', (event) => handleListClick(event, 'milestone'));
    shotList?.addEventListener('click', (event) => handleListClick(event, 'shot'));
})();
