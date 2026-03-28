<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$studios = getUserStudios($pdo, (int)$_SESSION['user_id']);
[$whereClause, $whereParams] = buildStudioVisibilityWhere('b', (int)$_SESSION['user_id'], 'idea_boards');
$stmt = $pdo->prepare("SELECT * FROM idea_boards b WHERE {$whereClause} ORDER BY updated_at DESC");
$stmt->execute($whereParams);
$boards = $stmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'Idea Boards';
$additional_css = ['css/idea_boards.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="boards-header">
                <h1>Idea Boards</h1>
                <button class="btn primary-btn" id="create-board">New Board</button>
            </div>

            <div class="boards-grid">
                <?php if (empty($boards)): ?>
                    <div class="empty-state">No boards yet. Create one to start collecting ideas.</div>
                <?php else: ?>
                    <?php foreach ($boards as $board): ?>
                        <a class="board-card" href="idea_board.php?id=<?php echo (int)$board['id']; ?>">
                            <h3><?php echo htmlspecialchars($board['title']); ?></h3>
                            <p><?php echo htmlspecialchars($board['description'] ?? ''); ?></p>
                            <span class="board-meta">Updated <?php echo date('M j, Y', strtotime($board['updated_at'])); ?></span>
                        </a>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </main>
    </div>
</div>

<div class="modal" id="board-modal" style="display:none;">
    <div class="modal-content">
        <h2>Create Board</h2>
        <div class="form-group">
            <label>Title</label>
            <input type="text" id="board-title" placeholder="e.g. Season 1 Ideas">
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea id="board-description" placeholder="Optional summary..."></textarea>
        </div>
        <div class="form-group">
            <label>Studio</label>
            <select id="board-studio">
                <option value="">Personal</option>
                <?php foreach ($studios as $studio): ?>
                    <option value="<?php echo (int)$studio['id']; ?>"><?php echo htmlspecialchars($studio['name']); ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="form-group">
            <label>Visibility</label>
            <select id="board-visibility">
                <option value="private">Private</option>
                <option value="studio">Studio</option>
                <option value="public">Public</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="cancel-board">Cancel</button>
            <button class="btn primary-btn" id="save-board">Create</button>
        </div>
    </div>
</div>

<script src="js/idea_boards.js"></script>
