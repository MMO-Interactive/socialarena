<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$wardrobe_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($wardrobe_id === 0) {
    header('Location: wardrobes.php');
    exit;
}

$stmt = $pdo->prepare("
    SELECT w.*, s.title AS series_title
    FROM studio_wardrobes w
    LEFT JOIN series s ON w.series_id = s.id
    WHERE w.id = ?
");
$stmt->execute([$wardrobe_id]);
$wardrobe = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$wardrobe) {
    header('Location: wardrobes.php');
    exit;
}

try {
    enforceStudioItemAccess(
        $pdo,
        (int)$wardrobe['user_id'],
        (int)$wardrobe['studio_id'],
        $wardrobe['visibility'],
        (int)$_SESSION['user_id'],
        'wardrobe',
        false
    );
} catch (Exception $e) {
    header('Location: wardrobes.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM studio_wardrobe_gallery WHERE wardrobe_id = ? ORDER BY created_at DESC");
$stmt->execute([$wardrobe_id]);
$gallery = $stmt->fetchAll(PDO::FETCH_ASSOC);
$gallery_count = count($gallery);

$stmt = $pdo->prepare("SELECT * FROM studio_wardrobe_variations WHERE wardrobe_id = ? ORDER BY created_at DESC");
$stmt->execute([$wardrobe_id]);
$variations = $stmt->fetchAll(PDO::FETCH_ASSOC);
$variation_count = count($variations);

$page_title = 'Wardrobe Profile - ' . htmlspecialchars($wardrobe['name']);
$additional_css = ['css/wardrobe_profile.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="wardrobe-hero">
                <div class="wardrobe-cover">
                    <?php if (!empty($wardrobe['cover_image_url'])): ?>
                        <img src="<?php echo htmlspecialchars($wardrobe['cover_image_url']); ?>" alt="">
                    <?php endif; ?>
                </div>
                <div class="wardrobe-hero-content">
                    <div class="wardrobe-title">
                        <h1><?php echo htmlspecialchars($wardrobe['name']); ?></h1>
                        <div class="wardrobe-meta">
                            <?php if (!empty($wardrobe['wardrobe_type'])): ?>
                                <span><?php echo htmlspecialchars($wardrobe['wardrobe_type']); ?></span>
                            <?php endif; ?>
                            <?php if (!empty($wardrobe['series_title'])): ?>
                                <span>Series: <?php echo htmlspecialchars($wardrobe['series_title']); ?></span>
                            <?php else: ?>
                                <span>Global</span>
                            <?php endif; ?>
                            <?php if (!empty($wardrobe['tags'])): ?>
                                <span><?php echo htmlspecialchars($wardrobe['tags']); ?></span>
                            <?php endif; ?>
                        </div>
                    </div>
                    <div class="wardrobe-hero-actions">
                        <a class="btn" href="wardrobes.php">Back to Wardrobe</a>
                    </div>
                </div>
                <div class="wardrobe-stats">
                    <div>
                        <strong><?php echo $gallery_count; ?></strong>
                        <span>Images</span>
                    </div>
                    <div>
                        <strong><?php echo $variation_count; ?></strong>
                        <span>Variations</span>
                    </div>
                </div>
            </div>

            <div class="wardrobe-profile-grid">
                <section class="profile-card">
                    <h2>Details</h2>
                    <p><?php echo htmlspecialchars($wardrobe['description'] ?? ''); ?></p>
                </section>

                <section class="profile-card">
                    <h2>Image Gallery</h2>
                    <form action="includes/wardrobe_profile_handlers.php" method="POST" enctype="multipart/form-data" class="upload-form">
                        <input type="hidden" name="action" value="upload_gallery">
                        <input type="hidden" name="wardrobe_id" value="<?php echo (int)$wardrobe_id; ?>">
                        <input type="file" name="gallery_image" accept="image/*" required>
                        <input type="text" name="caption" placeholder="Caption (optional)">
                        <button class="btn" type="submit">Upload Image</button>
                    </form>
                    <div class="gallery-grid">
                        <?php foreach ($gallery as $image): ?>
                            <div class="gallery-item">
                                <img src="<?php echo htmlspecialchars($image['image_url']); ?>" alt="">
                                <?php if (!empty($image['caption'])): ?>
                                    <span><?php echo htmlspecialchars($image['caption']); ?></span>
                                <?php endif; ?>
                            </div>
                        <?php endforeach; ?>
                        <?php if (empty($gallery)): ?>
                            <p class="empty-state">No gallery images yet.</p>
                        <?php endif; ?>
                    </div>
                </section>

                <section class="profile-card">
                    <h2>Variations</h2>
                    <form action="includes/wardrobe_profile_handlers.php" method="POST" enctype="multipart/form-data" class="upload-form">
                        <input type="hidden" name="action" value="add_variation">
                        <input type="hidden" name="wardrobe_id" value="<?php echo (int)$wardrobe_id; ?>">
                        <input type="text" name="variation_name" placeholder="Variation name" required>
                        <textarea name="variation_description" placeholder="Describe this variation..."></textarea>
                        <input type="file" name="variation_image" accept="image/*">
                        <button class="btn" type="submit">Add Variation</button>
                    </form>
                    <div class="variation-grid">
                        <?php foreach ($variations as $variation): ?>
                            <div class="variation-item">
                                <?php if (!empty($variation['image_url'])): ?>
                                    <img src="<?php echo htmlspecialchars($variation['image_url']); ?>" alt="">
                                <?php endif; ?>
                                <div class="variation-content">
                                    <strong><?php echo htmlspecialchars($variation['name']); ?></strong>
                                    <?php if (!empty($variation['description'])): ?>
                                        <p><?php echo htmlspecialchars($variation['description']); ?></p>
                                    <?php endif; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                        <?php if (empty($variations)): ?>
                            <p class="empty-state">No variations yet.</p>
                        <?php endif; ?>
                    </div>
                </section>
            </div>
        </main>
    </div>
</div>
