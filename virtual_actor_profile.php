<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$actor_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($actor_id === 0) {
    header('Location: virtual_actors.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM virtual_actors WHERE id = ?");
$stmt->execute([$actor_id]);
$actor = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$actor) {
    header('Location: virtual_actors.php');
    exit;
}

try {
    enforceStudioItemAccess(
        $pdo,
        (int)$actor['user_id'],
        (int)$actor['studio_id'],
        $actor['visibility'],
        (int)$_SESSION['user_id'],
        'virtual_cast',
        false
    );
} catch (Exception $e) {
    header('Location: virtual_actors.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM virtual_actor_galleries WHERE actor_id = ? ORDER BY created_at DESC");
$stmt->execute([$actor_id]);
$galleries = $stmt->fetchAll(PDO::FETCH_ASSOC);

$galleryImages = [];
$imagesByGallery = [];
if (!empty($galleries)) {
    $galleryIds = array_column($galleries, 'id');
    $placeholders = implode(',', array_fill(0, count($galleryIds), '?'));
    $stmt = $pdo->prepare("SELECT * FROM virtual_actor_gallery_images WHERE gallery_id IN ($placeholders) ORDER BY created_at DESC");
    $stmt->execute($galleryIds);
    $galleryImages = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($galleryImages as $image) {
        $imagesByGallery[$image['gallery_id']][] = $image;
    }
}

$stmt = $pdo->prepare("SELECT * FROM virtual_actor_gallery WHERE actor_id = ? ORDER BY created_at DESC");
$stmt->execute([$actor_id]);
$legacy_gallery = $stmt->fetchAll(PDO::FETCH_ASSOC);

$gallery_count = count($galleries);
$image_count = count($galleryImages) + count($legacy_gallery);

$stmt = $pdo->prepare("SELECT * FROM virtual_actor_audio WHERE actor_id = ? ORDER BY created_at DESC");
$stmt->execute([$actor_id]);
$audio = $stmt->fetchAll(PDO::FETCH_ASSOC);
$audio_count = count($audio);

$stmt = $pdo->prepare("
    SELECT sc.role_name, s.title as series_title, se.title as episode_title
    FROM series_cast sc
    JOIN series s ON sc.series_id = s.id
    LEFT JOIN series_episodes se ON se.story_id IS NOT NULL AND se.story_id IN (
        SELECT id FROM stories WHERE series_id = s.id
    )
    WHERE sc.actor_id = ?
");
$stmt->execute([$actor_id]);
$productions = $stmt->fetchAll(PDO::FETCH_ASSOC);
$production_count = count($productions);

$page_title = 'Actor Profile - ' . htmlspecialchars($actor['name']);
$additional_css = ['css/virtual_actor_profile.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="actor-hero">
                <div class="actor-cover">
                    <?php if (!empty($actor['avatar_url'])): ?>
                        <img src="<?php echo htmlspecialchars($actor['avatar_url']); ?>" alt="">
                    <?php endif; ?>
                </div>
                <div class="actor-hero-content">
                    <div class="actor-avatar">
                        <?php if (!empty($actor['avatar_url'])): ?>
                            <img src="<?php echo htmlspecialchars($actor['avatar_url']); ?>" alt="<?php echo htmlspecialchars($actor['name']); ?>">
                        <?php else: ?>
                            <div class="avatar-placeholder"><?php echo strtoupper(substr($actor['name'], 0, 1)); ?></div>
                        <?php endif; ?>
                    </div>
                    <div class="actor-identity">
                        <h1><?php echo htmlspecialchars($actor['name']); ?></h1>
                        <div class="actor-meta">
                            <?php if (!empty($actor['gender'])): ?>
                                <span><?php echo htmlspecialchars($actor['gender']); ?></span>
                            <?php endif; ?>
                            <?php if (!empty($actor['age_range'])): ?>
                                <span><?php echo htmlspecialchars($actor['age_range']); ?></span>
                            <?php endif; ?>
                            <?php if (!empty($actor['tags'])): ?>
                                <span><?php echo htmlspecialchars($actor['tags']); ?></span>
                            <?php endif; ?>
                        </div>
                    </div>
                    <div class="actor-hero-actions">
                        <a class="btn" href="virtual_actors.php">Back to Cast</a>
                    </div>
                </div>
                <div class="actor-stats">
                    <div>
                        <strong><?php echo $production_count; ?></strong>
                        <span>Productions</span>
                    </div>
                    <div>
                        <strong><?php echo $gallery_count; ?></strong>
                        <span>Galleries</span>
                    </div>
                    <div>
                        <strong><?php echo $audio_count; ?></strong>
                        <span>Voice Clips</span>
                    </div>
                </div>
            </div>

            <div class="actor-profile-grid">
                <section class="profile-card bio-card">
                    <h2>Profile</h2>
                    <p><?php echo htmlspecialchars($actor['description'] ?? ''); ?></p>
                    <form action="includes/virtual_actor_profile_handlers.php" method="POST">
                        <input type="hidden" name="action" value="update_notes">
                        <input type="hidden" name="actor_id" value="<?php echo (int)$actor_id; ?>">
                        <label class="form-label">Notes</label>
                        <textarea name="profile_notes" class="profile-notes" placeholder="Add notes about voice, performance, or instructions..."><?php echo htmlspecialchars($actor['profile_notes'] ?? ''); ?></textarea>
                        <button class="btn primary-btn" type="submit">Save Notes</button>
                    </form>
                </section>

                <section class="profile-card">
                    <div class="gallery-header">
                        <div>
                            <h2>Image Galleries</h2>
                            <span class="muted"><?php echo $image_count; ?> images total</span>
                        </div>
                        <form action="includes/virtual_actor_profile_handlers.php" method="POST" class="gallery-create">
                            <input type="hidden" name="action" value="create_gallery">
                            <input type="hidden" name="actor_id" value="<?php echo (int)$actor_id; ?>">
                            <input type="text" name="title" placeholder="New gallery title" required>
                            <input type="text" name="description" placeholder="Description (optional)">
                            <button class="btn" type="submit">Create</button>
                        </form>
                    </div>

                    <form action="includes/virtual_actor_profile_handlers.php" method="POST" enctype="multipart/form-data" class="upload-form">
                        <input type="hidden" name="action" value="upload_gallery_image">
                        <input type="hidden" name="actor_id" value="<?php echo (int)$actor_id; ?>">
                        <select name="gallery_id" required>
                            <option value="">Select gallery</option>
                            <?php foreach ($galleries as $gallery): ?>
                                <option value="<?php echo (int)$gallery['id']; ?>"><?php echo htmlspecialchars($gallery['title']); ?></option>
                            <?php endforeach; ?>
                        </select>
                        <input type="file" name="gallery_image" accept="image/*" required>
                        <input type="text" name="caption" placeholder="Caption (optional)">
                        <button class="btn" type="submit">Upload Image</button>
                    </form>

                    <?php if (empty($galleries)): ?>
                        <p class="empty-state">No galleries yet. Create one to start organizing images.</p>
                    <?php else: ?>
                        <div class="gallery-groups">
                            <?php foreach ($galleries as $gallery): ?>
                                <?php $images = $imagesByGallery[$gallery['id']] ?? []; ?>
                                <div class="gallery-group">
                                    <div class="gallery-group-header">
                                        <div>
                                            <h3><?php echo htmlspecialchars($gallery['title']); ?></h3>
                                            <span class="muted"><?php echo htmlspecialchars($gallery['description'] ?? ''); ?></span>
                                        </div>
                                        <span class="gallery-count"><?php echo count($images); ?> images</span>
                                    </div>
                                    <div class="gallery-grid">
                                        <?php foreach ($images as $image): ?>
                                            <div class="gallery-item">
                                                <img src="<?php echo htmlspecialchars($image['image_url']); ?>" alt="">
                                                <?php if (!empty($image['caption'])): ?>
                                                    <span><?php echo htmlspecialchars($image['caption']); ?></span>
                                                <?php endif; ?>
                                            </div>
                                        <?php endforeach; ?>
                                        <?php if (empty($images)): ?>
                                            <p class="empty-state">No images yet.</p>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>

                    <?php if (!empty($legacy_gallery)): ?>
                        <div class="gallery-group legacy-group">
                            <div class="gallery-group-header">
                                <div>
                                    <h3>Legacy Gallery</h3>
                                    <span class="muted">Imported from the previous gallery system.</span>
                                </div>
                                <span class="gallery-count"><?php echo count($legacy_gallery); ?> images</span>
                            </div>
                            <div class="gallery-grid">
                                <?php foreach ($legacy_gallery as $image): ?>
                                    <div class="gallery-item">
                                        <img src="<?php echo htmlspecialchars($image['image_url']); ?>" alt="">
                                        <?php if (!empty($image['caption'])): ?>
                                            <span><?php echo htmlspecialchars($image['caption']); ?></span>
                                        <?php endif; ?>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endif; ?>
                </section>

                <section class="profile-card">
                    <h2>Voice Samples</h2>
                    <form action="includes/virtual_actor_profile_handlers.php" method="POST" enctype="multipart/form-data" class="upload-form">
                        <input type="hidden" name="action" value="upload_audio">
                        <input type="hidden" name="actor_id" value="<?php echo (int)$actor_id; ?>">
                        <input type="file" name="audio_file" accept="audio/*" required>
                        <input type="text" name="label" placeholder="Label (optional)">
                        <button class="btn" type="submit">Upload Audio</button>
                    </form>
                    <div class="audio-list">
                        <?php foreach ($audio as $clip): ?>
                            <div class="audio-item">
                                <span><?php echo htmlspecialchars($clip['label'] ?? 'Voice sample'); ?></span>
                                <audio controls src="<?php echo htmlspecialchars($clip['audio_url']); ?>"></audio>
                            </div>
                        <?php endforeach; ?>
                        <?php if (empty($audio)): ?>
                            <p class="empty-state">No voice samples yet.</p>
                        <?php endif; ?>
                    </div>
                </section>

                <section class="profile-card">
                    <h2>Productions</h2>
                    <?php if (empty($productions)): ?>
                        <p class="empty-state">No productions assigned yet.</p>
                    <?php else: ?>
                        <div class="production-list">
                            <?php foreach ($productions as $production): ?>
                                <div class="production-item">
                                    <strong><?php echo htmlspecialchars($production['series_title']); ?></strong>
                                    <?php if (!empty($production['role_name'])): ?>
                                        <span class="muted">as <?php echo htmlspecialchars($production['role_name']); ?></span>
                                    <?php endif; ?>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </section>
            </div>
        </main>
    </div>
</div>
