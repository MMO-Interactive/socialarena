<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$studios = getUserStudios($pdo, (int)$_SESSION['user_id']);
[$whereClause, $whereParams] = buildStudioVisibilityWhere('va', (int)$_SESSION['user_id'], 'virtual_cast');
$stmt = $pdo->prepare("SELECT * FROM virtual_actors va WHERE {$whereClause} ORDER BY updated_at DESC");
$stmt->execute($whereParams);
$actors = $stmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'Virtual Cast';
$additional_css = ['css/virtual_actors.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="actors-header">
                <div>
                    <h1>Virtual Cast</h1>
                    <p>Store and manage your virtual actors and actresses.</p>
                </div>
                <button class="btn primary-btn" id="add-actor">Add Actor</button>
            </div>

            <div class="actors-grid">
                <?php if (empty($actors)): ?>
                    <div class="empty-state">No actors yet. Add your first virtual actor.</div>
                <?php else: ?>
                    <?php foreach ($actors as $actor): ?>
                        <div class="actor-card" data-actor-id="<?php echo (int)$actor['id']; ?>" data-studio-id="<?php echo (int)($actor['studio_id'] ?? 0); ?>" data-visibility="<?php echo htmlspecialchars($actor['visibility'] ?? 'private'); ?>">
                            <div class="actor-avatar">
                                <?php if (!empty($actor['avatar_url'])): ?>
                                    <img src="<?php echo htmlspecialchars($actor['avatar_url']); ?>" alt="<?php echo htmlspecialchars($actor['name']); ?>">
                                <?php else: ?>
                                    <div class="avatar-placeholder"><?php echo strtoupper(substr($actor['name'], 0, 1)); ?></div>
                                <?php endif; ?>
                            </div>
                            <div class="actor-info">
                                <h3><?php echo htmlspecialchars($actor['name']); ?></h3>
                                <div class="actor-meta">
                                    <?php if (!empty($actor['gender'])): ?>
                                        <span><?php echo htmlspecialchars($actor['gender']); ?></span>
                                    <?php endif; ?>
                                    <?php if (!empty($actor['age_range'])): ?>
                                        <span><?php echo htmlspecialchars($actor['age_range']); ?></span>
                                    <?php endif; ?>
                                </div>
                                <p><?php echo htmlspecialchars($actor['description'] ?? ''); ?></p>
                                <?php if (!empty($actor['tags'])): ?>
                                    <div class="actor-tags"><?php echo htmlspecialchars($actor['tags']); ?></div>
                                <?php endif; ?>
                            </div>
                            <div class="actor-actions">
                                <a class="btn" href="virtual_actor_profile.php?id=<?php echo (int)$actor['id']; ?>">Profile</a>
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

<div class="modal" id="actor-modal" style="display:none;">
    <div class="modal-content">
        <h2 id="actor-modal-title">Add Actor</h2>
        <div class="form-group">
            <label>Name</label>
            <input type="text" id="actor-name">
        </div>
        <div class="form-group">
            <label>Gender</label>
            <input type="text" id="actor-gender" placeholder="e.g. Female, Male, Non-binary">
        </div>
        <div class="form-group">
            <label>Age Range</label>
            <input type="text" id="actor-age" placeholder="e.g. 20s, 30-40">
        </div>
        <div class="form-group">
            <label>Description</label>
            <textarea id="actor-description" placeholder="Core traits, acting style, voice..."></textarea>
        </div>
        <div class="form-group">
            <label>Tags</label>
            <input type="text" id="actor-tags" placeholder="e.g. stoic, comedic, sci-fi">
        </div>
        <div class="form-group">
            <label>Avatar URL</label>
            <input type="text" id="actor-avatar" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>Studio</label>
            <select id="actor-studio">
                <option value="">Personal</option>
                <?php foreach ($studios as $studio): ?>
                    <option value="<?php echo (int)$studio['id']; ?>"><?php echo htmlspecialchars($studio['name']); ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="form-group">
            <label>Visibility</label>
            <select id="actor-visibility">
                <option value="private">Private</option>
                <option value="studio">Studio</option>
                <option value="public">Public</option>
            </select>
        </div>
        <div class="form-group">
            <label>Upload Avatar</label>
            <input type="file" id="actor-avatar-file" accept="image/*">
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="actor-cancel">Cancel</button>
            <button class="btn primary-btn" id="actor-save">Save</button>
        </div>
    </div>
</div>

<script src="js/virtual_actors.js"></script>
