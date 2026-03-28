<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$userId = (int)$_SESSION['user_id'];
$theme = $_SESSION['theme'] ?? 'light';

$seriesMediaStmt = $pdo->prepare("
    SELECT spm.*, s.title AS series_title, s.id AS series_id
    FROM series_public_media spm
    JOIN series s ON spm.series_id = s.id
    WHERE (
        s.created_by = ?
        OR (
            s.studio_id IN (
                SELECT studio_id FROM studio_permissions
                WHERE user_id = ? AND permission_key = 'series' AND allowed = 1
            )
            AND s.visibility IN ('studio', 'public')
        )
    )
    ORDER BY spm.created_at DESC
");
$seriesMediaStmt->execute([$userId, $userId]);
$seriesMedia = $seriesMediaStmt->fetchAll(PDO::FETCH_ASSOC);

$storyMediaStmt = $pdo->prepare("
    SELECT spm.*, s.title AS story_title, s.id AS story_id
    FROM story_public_media spm
    JOIN stories s ON spm.story_id = s.id
    WHERE (
        s.created_by = ?
        OR (
            s.studio_id IN (
                SELECT studio_id FROM studio_permissions
                WHERE user_id = ? AND permission_key = 'stories' AND allowed = 1
            )
            AND s.visibility IN ('studio', 'public')
        )
    )
    ORDER BY spm.created_at DESC
");
$storyMediaStmt->execute([$userId, $userId]);
$storyMedia = $storyMediaStmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'Release Manager';
$additional_css = ['css/release_manager.css', 'css/series_media.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="release-header">
                <div>
                    <h1>Release Manager</h1>
                    <p class="muted">Ship trailers, clips, and screenshots with release metadata and shareable links.</p>
                </div>
                <div class="release-summary">
                    <div class="summary-card">
                        <span>Drafts</span>
                        <strong><?php echo count(array_filter($seriesMedia, fn($m) => ($m['release_status'] ?? 'draft') === 'draft')) + count(array_filter($storyMedia, fn($m) => ($m['release_status'] ?? 'draft') === 'draft')); ?></strong>
                    </div>
                    <div class="summary-card">
                        <span>Released</span>
                        <strong><?php echo count(array_filter($seriesMedia, fn($m) => ($m['release_status'] ?? 'draft') === 'released')) + count(array_filter($storyMedia, fn($m) => ($m['release_status'] ?? 'draft') === 'released')); ?></strong>
                    </div>
                </div>
            </div>

            <section class="release-section">
                <div class="section-header">
                    <h2>Series Releases</h2>
                    <p>Manage trailers, clips, and screenshots attached to series.</p>
                </div>
                <div class="release-grid">
                    <?php if (empty($seriesMedia)): ?>
                        <div class="release-empty">No series media found.</div>
                    <?php else: ?>
                        <?php foreach ($seriesMedia as $media): ?>
                            <div class="release-card">
                                <div class="release-card-meta">
                                    <span class="release-type"><?php echo strtoupper($media['media_type']); ?></span>
                                    <span class="media-status-pill <?php echo htmlspecialchars($media['release_status'] ?? 'draft'); ?>">
                                        <?php echo htmlspecialchars($media['release_status'] ?? 'draft'); ?>
                                    </span>
                                </div>
                                <strong><?php echo htmlspecialchars($media['release_title'] ?: ($media['title'] ?? 'Untitled')); ?></strong>
                                <span class="release-subtitle"><?php echo htmlspecialchars($media['series_title']); ?></span>
                                <?php if (!empty($media['thumbnail_url'])): ?>
                                    <img src="<?php echo htmlspecialchars($media['thumbnail_url']); ?>" alt="">
                                <?php endif; ?>
                                <?php if (!empty($media['release_description'])): ?>
                                    <p><?php echo htmlspecialchars($media['release_description']); ?></p>
                                <?php endif; ?>
                                <div class="release-actions">
                                    <button class="btn" data-release-type="series" data-release-id="<?php echo (int)$media['id']; ?>">Release</button>
                                    <?php if (($media['release_status'] ?? 'draft') === 'released'): ?>
                                        <a class="btn secondary-btn" href="series_media_watch.php?id=<?php echo (int)$media['id']; ?>" target="_blank" rel="noopener">View</a>
                                    <?php endif; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </section>

            <section class="release-section">
                <div class="section-header">
                    <h2>Film Releases</h2>
                    <p>Manage trailers, clips, and screenshots attached to films.</p>
                </div>
                <div class="release-grid">
                    <?php if (empty($storyMedia)): ?>
                        <div class="release-empty">No film media found.</div>
                    <?php else: ?>
                        <?php foreach ($storyMedia as $media): ?>
                            <div class="release-card">
                                <div class="release-card-meta">
                                    <span class="release-type"><?php echo strtoupper($media['media_type']); ?></span>
                                    <span class="media-status-pill <?php echo htmlspecialchars($media['release_status'] ?? 'draft'); ?>">
                                        <?php echo htmlspecialchars($media['release_status'] ?? 'draft'); ?>
                                    </span>
                                </div>
                                <strong><?php echo htmlspecialchars($media['release_title'] ?: ($media['title'] ?? 'Untitled')); ?></strong>
                                <span class="release-subtitle"><?php echo htmlspecialchars($media['story_title']); ?></span>
                                <?php if (!empty($media['thumbnail_url'])): ?>
                                    <img src="<?php echo htmlspecialchars($media['thumbnail_url']); ?>" alt="">
                                <?php endif; ?>
                                <?php if (!empty($media['release_description'])): ?>
                                    <p><?php echo htmlspecialchars($media['release_description']); ?></p>
                                <?php endif; ?>
                                <div class="release-actions">
                                    <button class="btn" data-release-type="story" data-release-id="<?php echo (int)$media['id']; ?>">Release</button>
                                    <?php if (($media['release_status'] ?? 'draft') === 'released'): ?>
                                        <a class="btn secondary-btn" href="story_media_watch.php?id=<?php echo (int)$media['id']; ?>" target="_blank" rel="noopener">View</a>
                                    <?php endif; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </section>
        </main>
    </div>
</div>

<div class="modal" id="release-manager-modal">
    <div class="modal-content release-modal">
        <div class="release-header">
            <h2>Release Media</h2>
            <button class="btn secondary-btn" id="release-manager-close">Close</button>
        </div>
        <div class="form-group">
            <label>Release Title</label>
            <input type="text" id="release-manager-title" placeholder="Release title">
        </div>
        <div class="form-group">
            <label>Release Description</label>
            <textarea id="release-manager-description" placeholder="Write a short release note..."></textarea>
        </div>
        <div class="form-group">
            <label>Thumbnail URL (optional)</label>
            <input type="text" id="release-manager-thumbnail" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>Status</label>
            <select id="release-manager-status">
                <option value="released">Release now</option>
                <option value="draft">Save as draft</option>
            </select>
        </div>
        <div class="form-group">
            <label>Visibility</label>
            <select id="release-manager-visibility">
                <option value="public">Public</option>
                <option value="studio">Studio</option>
                <option value="private">Private</option>
            </select>
        </div>
        <div class="release-actions">
            <button class="btn primary-btn" id="release-manager-save">Save Release</button>
        </div>
        <div class="release-result" id="release-manager-result" style="display:none;"></div>
    </div>
</div>

<script src="js/release_manager.js"></script>
</body>
</html>
