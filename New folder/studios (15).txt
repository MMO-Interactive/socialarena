<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$studios = getUserStudios($pdo, (int)$_SESSION['user_id']);
[$whereClause, $whereParams] = buildStudioVisibilityWhere('w', (int)$_SESSION['user_id'], 'wardrobe');
$stmt = $pdo->prepare("
    SELECT w.*, s.title AS series_title
    FROM studio_wardrobes w
    LEFT JOIN series s ON w.series_id = s.id
    WHERE {$whereClause}
    ORDER BY w.updated_at DESC
");
$stmt->execute($whereParams);
$wardrobes = $stmt->fetchAll(PDO::FETCH_ASSOC);

[$seriesWhere, $seriesParams] = buildStudioVisibilityWhere('s', (int)$_SESSION['user_id'], 'series');
$stmt = $pdo->prepare("SELECT s.id, s.title FROM series s WHERE {$seriesWhere} ORDER BY s.updated_at DESC");
$stmt->execute($seriesParams);
$series = $stmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'Wardrobe';
$additional_css = ['css/wardrobes.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="wardrobe-header">
                <div>
                    <h1>Wardrobe</h1>
                    <p>Manage costumes, outfits, and wardrobe looks. Assign them to a series or keep them global.</p>
                </div>
                <button class="btn primary-btn" id="add-wardrobe">Add Wardrobe</button>
            </div>

            <div class="wardrobe-grid">
                <?php if (empty($wardrobes)): ?>
                    <div class="empty-state">No wardrobe items yet. Add your first wardrobe entry.</div>
                <?php else: ?>
                    <?php foreach ($wardrobes as $wardrobe): ?>
                        <div class="wardrobe-card" data-wardrobe-id="<?php echo (int)$wardrobe['id']; ?>" data-series-id="<?php echo (int)($wardrobe['series_id'] ?? 0); ?>" data-studio-id="<?php echo (int)($wardrobe['studio_id'] ?? 0); ?>" data-visibility="<?php echo htmlspecialchars($wardrobe['visibility'] ?? 'private'); ?>">
                            <div class="wardrobe-cover">
                                <?php if (!empty($wardrobe['cover_image_url'])): ?>
                                    <img src="<?php echo htmlspecialchars($wardrobe['cover_image_url']); ?>" alt="<?php echo htmlspecialchars($wardrobe['name']); ?>">
                                <?php else: ?>
                                    <div class="cover-placeholder">Wardrobe</div>
                                <?php endif; ?>
                            </div>
                            <div class="wardrobe-info">
                                <h3><?php echo htmlspecialchars($wardrobe['name']); ?></h3>
                                <div class="wardrobe-meta">
                                    <?php if (!empty($wardrobe['wardrobe_type'])): ?>
                                        <span><?php echo htmlspecialchars($wardrobe['wardrobe_type']); ?></span>
                                    <?php endif; ?>
                                    <?php if (!empty($wardrobe['series_title'])): ?>
                                        <span>Series: <?php echo htmlspecialchars($wardrobe['series_title']); ?></span>
                                    <?php else: ?>
                                        <span>Global</span>
                                    <?php endif; ?>
                                </div>
                                <p><?php echo htmlspecialchars($wardrobe['description'] ?? ''); ?></p>
                                <?php if (!empty($wardrobe['tags'])): ?>
                                    <div class="wardrobe-tags"><?php echo htmlspecialchars($wardrobe['tags']); ?></div>
                                <?php endif; ?>
                            </div>
                            <div class="wardrobe-actions">
                                <a class="btn" href="wardrobe_profile.php?id=<?php echo (int)$wardrobe['id']; ?>">Profile</a>
                                <button class="btn" data-action="edit">Edit</button>
                                <button class="btn danger" data-action="delete">Delete</button>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </div>
        </main>
    </div>
</div>

<div class="modal" id="wardrobe-modal" style="display:none;">
    <div class="modal-content">
        <h2 id="wardrobe-modal-title">Add Wardrobe</h2>
        <div class="form-group">
            <label>Name</label>
            <input type="text" id="wardrobe-name">
        </div>
        <div class="form-group">
            <label>Type</label>
            <input type="text" id="wardrobe-type" placeholder="e.g. Hero costume, Casual outfit">
        </div>
        <div class="form-group">
            <label>Series</label>
            <select id="wardrobe-series">
                <option value="">Global (No Series)</option>
                <?php foreach ($series as $series_item): ?>
                    <option value="<?php echo (int)$series_item['id']; ?>">
                        <?php echo htmlspecialchars($series_item['title']); ?>
                    </option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea id="wardrobe-description" placeholder="Notes about the wardrobe, materials, variations..."></textarea>
        </div>
        <div class="form-group">
            <label>Tags</label>
            <input type="text" id="wardrobe-tags" placeholder="e.g. fantasy, armor, summer">
        </div>
        <div class="form-group">
            <label>Cover Image URL</label>
            <input type="text" id="wardrobe-cover" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>Upload Cover Image</label>
            <input type="file" id="wardrobe-cover-file" accept="image/*">
        </div>
        <div class="form-group">
            <label>Studio</label>
            <select id="wardrobe-studio">
                <option value="">Personal</option>
                <?php foreach ($studios as $studio): ?>
                    <option value="<?php echo (int)$studio['id']; ?>"><?php echo htmlspecialchars($studio['name']); ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="form-group">
            <label>Visibility</label>
            <select id="wardrobe-visibility">
                <option value="private">Private</option>
                <option value="studio">Studio</option>
                <option value="public">Public</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="wardrobe-cancel">Cancel</button>
            <button class="btn primary-btn" id="wardrobe-save">Save</button>
        </div>
    </div>
</div>

<script src="js/wardrobes.js"></script>
