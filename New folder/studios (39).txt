<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$studios = getUserStudios($pdo, (int)$_SESSION['user_id']);
[$whereClause, $whereParams] = buildStudioVisibilityWhere('l', (int)$_SESSION['user_id'], 'locations');
$stmt = $pdo->prepare("SELECT * FROM studio_locations l WHERE {$whereClause} ORDER BY updated_at DESC");
$stmt->execute($whereParams);
$locations = $stmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'Sets & Locations';
$additional_css = ['css/locations.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="locations-header">
                <div>
                    <h1>Sets & Locations</h1>
                    <p>Track filming sets, interiors, exteriors, and production locations.</p>
                </div>
                <button class="btn primary-btn" id="add-location">Add Location</button>
            </div>

            <div class="locations-grid">
                <?php if (empty($locations)): ?>
                    <div class="empty-state">No locations yet. Add your first set or location.</div>
                <?php else: ?>
                    <?php foreach ($locations as $location): ?>
                        <div class="location-card" data-location-id="<?php echo (int)$location['id']; ?>" data-studio-id="<?php echo (int)($location['studio_id'] ?? 0); ?>" data-visibility="<?php echo htmlspecialchars($location['visibility'] ?? 'private'); ?>">
                            <div class="location-cover">
                                <?php if (!empty($location['cover_image_url'])): ?>
                                    <img src="<?php echo htmlspecialchars($location['cover_image_url']); ?>" alt="<?php echo htmlspecialchars($location['name']); ?>">
                                <?php else: ?>
                                    <div class="cover-placeholder">Set</div>
                                <?php endif; ?>
                            </div>
                            <div class="location-info">
                                <h3><?php echo htmlspecialchars($location['name']); ?></h3>
                                <div class="location-meta">
                                    <?php if (!empty($location['location_type'])): ?>
                                        <span><?php echo htmlspecialchars($location['location_type']); ?></span>
                                    <?php endif; ?>
                                    <?php if (!empty($location['region'])): ?>
                                        <span><?php echo htmlspecialchars($location['region']); ?></span>
                                    <?php endif; ?>
                                </div>
                                <p><?php echo htmlspecialchars($location['description'] ?? ''); ?></p>
                                <?php if (!empty($location['tags'])): ?>
                                    <div class="location-tags"><?php echo htmlspecialchars($location['tags']); ?></div>
                                <?php endif; ?>
                            </div>
                            <div class="location-actions">
                                <a class="btn" href="location_profile.php?id=<?php echo (int)$location['id']; ?>">Profile</a>
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

<div class="modal" id="location-modal" style="display:none;">
    <div class="modal-content">
        <h2 id="location-modal-title">Add Location</h2>
        <div class="form-group">
            <label>Name</label>
            <input type="text" id="location-name">
        </div>
        <div class="form-group">
            <label>Type</label>
            <input type="text" id="location-type" placeholder="e.g. Interior set, Exterior location">
        </div>
        <div class="form-group">
            <label>Region</label>
            <input type="text" id="location-region" placeholder="e.g. Atlanta Studio, Iceland">
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea id="location-description" placeholder="Key details, mood, and visual notes..."></textarea>
        </div>
        <div class="form-group">
            <label>Tags</label>
            <input type="text" id="location-tags" placeholder="e.g. sci-fi, night exterior">
        </div>
        <div class="form-group">
            <label>Cover Image URL</label>
            <input type="text" id="location-cover" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>Upload Cover Image</label>
            <input type="file" id="location-cover-file" accept="image/*">
        </div>
        <div class="form-group">
            <label>Studio</label>
            <select id="location-studio">
                <option value="">Personal</option>
                <?php foreach ($studios as $studio): ?>
                    <option value="<?php echo (int)$studio['id']; ?>"><?php echo htmlspecialchars($studio['name']); ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="form-group">
            <label>Visibility</label>
            <select id="location-visibility">
                <option value="private">Private</option>
                <option value="studio">Studio</option>
                <option value="public">Public</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="location-cancel">Cancel</button>
            <button class="btn primary-btn" id="location-save">Save</button>
        </div>
    </div>
</div>

<script src="js/locations.js"></script>
