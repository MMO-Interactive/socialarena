<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$studios = getUserStudios($pdo, (int)$_SESSION['user_id']);
[$whereClause, $whereParams] = buildStudioVisibilityWhere('p', (int)$_SESSION['user_id'], 'props');
$stmt = $pdo->prepare("
    SELECT p.*, s.title AS series_title
    FROM studio_props p
    LEFT JOIN series s ON p.series_id = s.id
    WHERE {$whereClause}
    ORDER BY p.updated_at DESC
");
$stmt->execute($whereParams);
$props = $stmt->fetchAll(PDO::FETCH_ASSOC);

[$seriesWhere, $seriesParams] = buildStudioVisibilityWhere('s', (int)$_SESSION['user_id'], 'series');
$stmt = $pdo->prepare("SELECT s.id, s.title FROM series s WHERE {$seriesWhere} ORDER BY s.updated_at DESC");
$stmt->execute($seriesParams);
$series = $stmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'Prop Library';
$additional_css = ['css/props.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="props-header">
                <div>
                    <h1>Prop Library</h1>
                    <p>Manage reusable props and assign them to a series or keep them global.</p>
                </div>
                <button class="btn primary-btn" id="add-prop">Add Prop</button>
            </div>

            <div class="props-grid">
                <?php if (empty($props)): ?>
                    <div class="empty-state">No props yet. Add your first prop.</div>
                <?php else: ?>
                    <?php foreach ($props as $prop): ?>
                        <div class="prop-card" data-prop-id="<?php echo (int)$prop['id']; ?>" data-series-id="<?php echo (int)($prop['series_id'] ?? 0); ?>" data-studio-id="<?php echo (int)($prop['studio_id'] ?? 0); ?>" data-visibility="<?php echo htmlspecialchars($prop['visibility'] ?? 'private'); ?>">
                            <div class="prop-cover">
                                <?php if (!empty($prop['cover_image_url'])): ?>
                                    <img src="<?php echo htmlspecialchars($prop['cover_image_url']); ?>" alt="<?php echo htmlspecialchars($prop['name']); ?>">
                                <?php else: ?>
                                    <div class="cover-placeholder">Prop</div>
                                <?php endif; ?>
                            </div>
                            <div class="prop-info">
                                <h3><?php echo htmlspecialchars($prop['name']); ?></h3>
                                <div class="prop-meta">
                                    <?php if (!empty($prop['prop_type'])): ?>
                                        <span><?php echo htmlspecialchars($prop['prop_type']); ?></span>
                                    <?php endif; ?>
                                    <?php if (!empty($prop['series_title'])): ?>
                                        <span>Series: <?php echo htmlspecialchars($prop['series_title']); ?></span>
                                    <?php else: ?>
                                        <span>Global</span>
                                    <?php endif; ?>
                                </div>
                                <p><?php echo htmlspecialchars($prop['description'] ?? ''); ?></p>
                                <?php if (!empty($prop['tags'])): ?>
                                    <div class="prop-tags"><?php echo htmlspecialchars($prop['tags']); ?></div>
                                <?php endif; ?>
                            </div>
                            <div class="prop-actions">
                                <a class="btn" href="prop_profile.php?id=<?php echo (int)$prop['id']; ?>">Profile</a>
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

<div class="modal" id="prop-modal" style="display:none;">
    <div class="modal-content">
        <h2 id="prop-modal-title">Add Prop</h2>
        <div class="form-group">
            <label>Name</label>
            <input type="text" id="prop-name">
        </div>
        <div class="form-group">
            <label>Type</label>
            <input type="text" id="prop-type" placeholder="e.g. Weapon, Artifact, Gadget">
        </div>
        <div class="form-group">
            <label>Series</label>
            <select id="prop-series">
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
            <textarea id="prop-description" placeholder="Key details, story relevance, materials..."></textarea>
        </div>
        <div class="form-group">
            <label>Tags</label>
            <input type="text" id="prop-tags" placeholder="e.g. sci-fi, magical, fragile">
        </div>
        <div class="form-group">
            <label>Cover Image URL</label>
            <input type="text" id="prop-cover" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>Upload Cover Image</label>
            <input type="file" id="prop-cover-file" accept="image/*">
        </div>
        <div class="form-group">
            <label>Studio</label>
            <select id="prop-studio">
                <option value="">Personal</option>
                <?php foreach ($studios as $studio): ?>
                    <option value="<?php echo (int)$studio['id']; ?>"><?php echo htmlspecialchars($studio['name']); ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="form-group">
            <label>Visibility</label>
            <select id="prop-visibility">
                <option value="private">Private</option>
                <option value="studio">Studio</option>
                <option value="public">Public</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="prop-cancel">Cancel</button>
            <button class="btn primary-btn" id="prop-save">Save</button>
        </div>
    </div>
</div>

<script src="js/props.js"></script>
