const categoryModal = document.getElementById('category-modal');
const itemModal = document.getElementById('item-modal');
const addCategoryBtn = document.getElementById('add-category');
const categoryCancel = document.getElementById('category-cancel');
const categorySave = document.getElementById('category-save');
const itemCancel = document.getElementById('item-cancel');
const itemSave = document.getElementById('item-save');

let activeCategoryId = null;
let editingCategoryId = null;
let editingItemId = null;

function openCategoryModal(category = null) {
    editingCategoryId = category?.id || null;
    document.getElementById('category-modal-title').textContent = category ? 'Edit Category' : 'Add Category';
    document.getElementById('category-name').value = category?.name || '';
    document.getElementById('category-description').value = category?.description || '';
    categoryModal.style.display = 'flex';
}

function closeCategoryModal() {
    categoryModal.style.display = 'none';
}

function openItemModal(categoryId, item = null) {
    activeCategoryId = categoryId;
    editingItemId = item?.id || null;
    document.getElementById('item-modal-title').textContent = item ? 'Edit Line Item' : 'Add Line Item';
    document.getElementById('item-name').value = item?.item_name || '';
    document.getElementById('item-vendor').value = item?.vendor || '';
    document.getElementById('item-quantity').value = item?.quantity || 1;
    document.getElementById('item-unit-cost').value = item?.unit_cost || 0;
    document.getElementById('item-status').value = item?.status || 'planned';
    document.getElementById('item-notes').value = item?.notes || '';
    itemModal.style.display = 'flex';
}

function closeItemModal() {
    itemModal.style.display = 'none';
    activeCategoryId = null;
}

addCategoryBtn?.addEventListener('click', () => openCategoryModal());
categoryCancel?.addEventListener('click', closeCategoryModal);
itemCancel?.addEventListener('click', closeItemModal);

categoryModal?.addEventListener('click', (event) => {
    if (event.target === categoryModal) {
        closeCategoryModal();
    }
});

itemModal?.addEventListener('click', (event) => {
    if (event.target === itemModal) {
        closeItemModal();
    }
});

async function sendBudgetRequest(payload) {
    const response = await fetch('includes/budget_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

categorySave?.addEventListener('click', async () => {
    const name = document.getElementById('category-name').value.trim();
    if (!name) {
        alert('Name is required.');
        return;
    }

    const payload = {
        action: editingCategoryId ? 'update_category' : 'create_category',
        budget_id: window.budgetContext.budgetId,
        category_id: editingCategoryId,
        name,
        description: document.getElementById('category-description').value.trim()
    };

    try {
        const data = await sendBudgetRequest(payload);
        if (data.success) {
            window.location.reload();
        }
    } catch (error) {
        alert(error.message);
    }
});

itemSave?.addEventListener('click', async () => {
    const itemName = document.getElementById('item-name').value.trim();
    if (!itemName) {
        alert('Item name is required.');
        return;
    }

    const payload = {
        action: editingItemId ? 'update_item' : 'create_item',
        category_id: activeCategoryId,
        item_id: editingItemId,
        item_name: itemName,
        vendor: document.getElementById('item-vendor').value.trim(),
        quantity: document.getElementById('item-quantity').value,
        unit_cost: document.getElementById('item-unit-cost').value,
        status: document.getElementById('item-status').value,
        notes: document.getElementById('item-notes').value.trim()
    };

    try {
        const data = await sendBudgetRequest(payload);
        if (data.success) {
            window.location.reload();
        }
    } catch (error) {
        alert(error.message);
    }
});

document.querySelectorAll('.budget-card').forEach(card => {
    const categoryId = Number(card.dataset.categoryId);
    card.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.dataset.action;
            if (!action) return;

            if (action === 'add-item') {
                openItemModal(categoryId);
                return;
            }

            if (action === 'edit-category') {
                const category = {
                    id: categoryId,
                    name: card.querySelector('h2')?.textContent || '',
                    description: card.querySelector('p')?.textContent || ''
                };
                openCategoryModal(category);
                return;
            }

            if (action === 'delete-category') {
                if (!confirm('Delete this category and all line items?')) return;
                try {
                    await sendBudgetRequest({ action: 'delete_category', category_id: categoryId });
                    card.remove();
                } catch (error) {
                    alert(error.message);
                }
            }
        });
    });

    card.querySelectorAll('.item-row').forEach(row => {
        row.querySelectorAll('button').forEach(button => {
            button.addEventListener('click', async () => {
                const action = button.dataset.action;
                if (action === 'edit-item') {
                    const item = {
                        id: Number(row.dataset.itemId),
                        item_name: row.dataset.itemName || '',
                        vendor: row.dataset.vendor || '',
                        notes: row.dataset.notes || '',
                        quantity: row.dataset.quantity || 1,
                        unit_cost: row.dataset.unitCost || 0,
                        status: row.dataset.status || 'planned'
                    };
                    openItemModal(categoryId, item);
                    return;
                }

                if (action === 'delete-item') {
                    if (!confirm('Delete this line item?')) return;
                    try {
                        await sendBudgetRequest({ action: 'delete_item', item_id: Number(row.dataset.itemId) });
                        row.remove();
                    } catch (error) {
                        alert(error.message);
                    }
                }
            });
        });
    });
});
