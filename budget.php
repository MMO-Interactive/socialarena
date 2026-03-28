<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$project_id = isset($_GET['project_id']) ? (int)$_GET['project_id'] : 0;
$story_id = isset($_GET['story_id']) ? (int)$_GET['story_id'] : 0;

if ($project_id === 0 && $story_id === 0) {
    header('Location: writing_center.php');
    exit;
}

if ($project_id === 0) {
    $stmt = $pdo->prepare("SELECT id FROM projects WHERE story_id = ? AND user_id = ? AND project_type = 'film'");
    $stmt->execute([$story_id, $_SESSION['user_id']]);
    $project_id = (int)$stmt->fetchColumn();

    if ($project_id === 0) {
        $stmt = $pdo->prepare("SELECT title FROM stories WHERE id = ?");
        $stmt->execute([$story_id]);
        $story = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$story) {
            header('Location: writing_center.php');
            exit;
        }
        try {
            enforceStoryAccess($pdo, $story_id, (int)$_SESSION['user_id'], false);
        } catch (Exception $e) {
            header('Location: writing_center.php');
            exit;
        }
        $stmt = $pdo->prepare("INSERT INTO projects (user_id, project_type, story_id, title) VALUES (?, 'film', ?, ?)");
        $stmt->execute([$_SESSION['user_id'], $story_id, $story['title']]);
        $project_id = (int)$pdo->lastInsertId();
    }
}

$stmt = $pdo->prepare("SELECT * FROM projects WHERE id = ? AND user_id = ? AND project_type = 'film'");
$stmt->execute([$project_id, $_SESSION['user_id']]);
$project = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$project) {
    header('Location: writing_center.php');
    exit;
}

$stmt = $pdo->prepare("SELECT id FROM film_budgets WHERE project_id = ?");
$stmt->execute([$project_id]);
$budget_id = (int)$stmt->fetchColumn();

if ($budget_id === 0) {
    $stmt = $pdo->prepare("INSERT INTO film_budgets (project_id) VALUES (?)");
    $stmt->execute([$project_id]);
    $budget_id = (int)$pdo->lastInsertId();
}

$stmt = $pdo->prepare("SELECT * FROM film_budgets WHERE id = ?");
$stmt->execute([$budget_id]);
$budget = $stmt->fetch(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare("SELECT * FROM film_budget_categories WHERE budget_id = ? ORDER BY created_at DESC");
$stmt->execute([$budget_id]);
$categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

$categoryIds = array_column($categories, 'id');
$itemsByCategory = [];
$summary = [
    'planned' => 0,
    'approved' => 0,
    'spent' => 0
];

if (!empty($categoryIds)) {
    $placeholders = implode(',', array_fill(0, count($categoryIds), '?'));
    $stmt = $pdo->prepare("SELECT * FROM film_budget_items WHERE category_id IN ($placeholders) ORDER BY created_at DESC");
    $stmt->execute($categoryIds);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($items as $item) {
        $itemsByCategory[$item['category_id']][] = $item;
        $total = (float)$item['quantity'] * (float)$item['unit_cost'];
        $summary[$item['status']] += $total;
    }
}

$page_title = 'Film Budget - ' . htmlspecialchars($project['title']);
$additional_css = ['css/budget.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="budget-header">
                <div>
                    <h1>Film Budget</h1>
                    <p><?php echo htmlspecialchars($project['title']); ?></p>
                </div>
                <div class="budget-actions">
                    <a class="btn" href="story_planner.php?id=<?php echo (int)$project['story_id']; ?>">Back to Film</a>
                    <button class="btn primary-btn" id="add-category">Add Category</button>
                </div>
            </div>

            <div class="budget-summary">
                <div class="summary-card">
                    <span>Planned</span>
                    <strong><?php echo htmlspecialchars($budget['currency']); ?> <?php echo number_format($summary['planned'], 2); ?></strong>
                </div>
                <div class="summary-card">
                    <span>Approved</span>
                    <strong><?php echo htmlspecialchars($budget['currency']); ?> <?php echo number_format($summary['approved'], 2); ?></strong>
                </div>
                <div class="summary-card">
                    <span>Spent</span>
                    <strong><?php echo htmlspecialchars($budget['currency']); ?> <?php echo number_format($summary['spent'], 2); ?></strong>
                </div>
            </div>

            <div class="budget-grid">
                <?php if (empty($categories)): ?>
                    <div class="empty-state">No budget categories yet. Add the first category to start tracking costs.</div>
                <?php else: ?>
                    <?php foreach ($categories as $category): ?>
                        <?php
                            $items = $itemsByCategory[$category['id']] ?? [];
                            $categoryTotal = 0;
                            foreach ($items as $item) {
                                $categoryTotal += (float)$item['quantity'] * (float)$item['unit_cost'];
                            }
                        ?>
                        <section class="budget-card" data-category-id="<?php echo (int)$category['id']; ?>">
                            <div class="category-header">
                                <div>
                                    <h2><?php echo htmlspecialchars($category['name']); ?></h2>
                                    <p><?php echo htmlspecialchars($category['description'] ?? ''); ?></p>
                                </div>
                                <div class="category-actions">
                                    <span class="category-total"><?php echo htmlspecialchars($budget['currency']); ?> <?php echo number_format($categoryTotal, 2); ?></span>
                                    <button class="btn" data-action="edit-category">Edit</button>
                                    <button class="btn" data-action="add-item">Add Item</button>
                                    <button class="btn danger" data-action="delete-category">Delete</button>
                                </div>
                            </div>
                            <div class="items-list">
                                <?php if (empty($items)): ?>
                                    <p class="empty-state small">No line items yet.</p>
                                <?php else: ?>
                                    <?php foreach ($items as $item): ?>
                                        <?php $lineTotal = (float)$item['quantity'] * (float)$item['unit_cost']; ?>
                                        <div class="item-row" data-item-id="<?php echo (int)$item['id']; ?>"
                                             data-item-name="<?php echo htmlspecialchars($item['item_name'], ENT_QUOTES); ?>"
                                             data-vendor="<?php echo htmlspecialchars($item['vendor'] ?? '', ENT_QUOTES); ?>"
                                             data-notes="<?php echo htmlspecialchars($item['notes'] ?? '', ENT_QUOTES); ?>"
                                             data-quantity="<?php echo htmlspecialchars($item['quantity'], ENT_QUOTES); ?>"
                                             data-unit-cost="<?php echo htmlspecialchars($item['unit_cost'], ENT_QUOTES); ?>"
                                             data-status="<?php echo htmlspecialchars($item['status'], ENT_QUOTES); ?>">
                                            <div>
                                                <strong><?php echo htmlspecialchars($item['item_name']); ?></strong>
                                                <div class="item-meta">
                                                    <span><?php echo htmlspecialchars($item['status']); ?></span>
                                                    <?php if (!empty($item['vendor'])): ?>
                                                        <span><?php echo htmlspecialchars($item['vendor']); ?></span>
                                                    <?php endif; ?>
                                                </div>
                                            </div>
                                            <div class="item-cost">
                                                <span><?php echo htmlspecialchars($budget['currency']); ?> <?php echo number_format($lineTotal, 2); ?></span>
                                                <div class="item-actions">
                                                    <button class="btn" data-action="edit-item">Edit</button>
                                                    <button class="btn danger" data-action="delete-item">Delete</button>
                                                </div>
                                            </div>
                                        </div>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </div>
                        </section>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </main>
    </div>
</div>

<div class="modal" id="category-modal" style="display:none;">
    <div class="modal-content">
        <h2 id="category-modal-title">Add Category</h2>
        <div class="form-group">
            <label>Name</label>
            <input type="text" id="category-name">
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea id="category-description"></textarea>
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="category-cancel">Cancel</button>
            <button class="btn primary-btn" id="category-save">Save</button>
        </div>
    </div>
</div>

<div class="modal" id="item-modal" style="display:none;">
    <div class="modal-content">
        <h2 id="item-modal-title">Add Line Item</h2>
        <div class="form-group">
            <label>Item</label>
            <input type="text" id="item-name">
        </div>
        <div class="form-group">
            <label>Vendor</label>
            <input type="text" id="item-vendor">
        </div>
        <div class="form-group">
            <label>Quantity</label>
            <input type="number" id="item-quantity" step="0.01" value="1">
        </div>
        <div class="form-group">
            <label>Unit Cost</label>
            <input type="number" id="item-unit-cost" step="0.01" value="0">
        </div>
        <div class="form-group">
            <label>Status</label>
            <select id="item-status">
                <option value="planned">planned</option>
                <option value="approved">approved</option>
                <option value="spent">spent</option>
            </select>
        </div>
        <div class="form-group">
            <label>Notes</label>
            <textarea id="item-notes"></textarea>
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="item-cancel">Cancel</button>
            <button class="btn primary-btn" id="item-save">Save</button>
        </div>
    </div>
</div>

<script>
window.budgetContext = {
    projectId: <?php echo (int)$project_id; ?>,
    budgetId: <?php echo (int)$budget_id; ?>
};
</script>
<script src="js/budget.js"></script>
