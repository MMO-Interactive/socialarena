<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$prop_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($prop_id === 0) {
    header('Location: props.php');
    exit;
}

$stmt = $pdo->prepare("
    SELECT p.*, s.title AS series_title
    FROM studio_props p
    LEFT JOIN series s ON p.series_id = s.id
    WHERE p.id = ?
");
$stmt->execute([$prop_id]);
$prop = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$prop) {
    header('Location: props.php');
    exit;
}
if ((int)$prop['user_id'] !== (int)$_SESSION['user_id']) {
    $studioId = (int)($prop['studio_id'] ?? 0);
    $visibility = $prop['visibility'] ?? 'private';
    if (!$studioId || !userHasStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'props') || !in_array($visibility, ['studio', 'public'], true)) {
        header('Location: props.php');
        exit;
    }
}

$stmt = $pdo->prepare("SELECT * FROM studio_prop_gallery WHERE prop_id = ? ORDER BY created_at DESC");
$stmt->execute([$prop_id]);
$gallery = $stmt->fetchAll(PDO::FETCH_ASSOC);
$gallery_count = count($gallery);

$page_title = 'Prop Profile - ' . htmlspecialchars($prop['name']);
$additional_css = ['css/prop_profile.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="prop-hero">
                <div class="prop-cover">
                    <?php if (!empty($prop['cover_image_url'])): ?>
                        <img src="<?php echo htmlspecialchars($prop['cover_image_url']); ?>" alt="">
                    <?php endif; ?>
                </div>
                <div class="prop-hero-content">
                    <div class="prop-title">
                        <h1><?php echo htmlspecialchars($prop['name']); ?></h1>
                        <div class="prop-meta">
                            <?php if (!empty($prop['prop_type'])): ?>
                                <span><?php echo htmlspecialchars($prop['prop_type']); ?></span>
                            <?php endif; ?>
                            <?php if (!empty($prop['series_title'])): ?>
                                <span>Series: <?php echo htmlspecialchars($prop['series_title']); ?></span>
                            <?php else: ?>
                                <span>Global</span>
                            <?php endif; ?>
                            <?php if (!empty($prop['tags'])): ?>
                                <span><?php echo htmlspecialchars($prop['tags']); ?></span>
                            <?php endif; ?>
                        </div>
                    </div>
                    <div class="prop-hero-actions">
                        <a class="btn" href="props.php">Back to Props</a>
                    </div>
                </div>
                <div class="prop-stats">
                    <div>
                        <strong><?php echo $gallery_count; ?></strong>
                        <span>Images</span>
                    </div>
                </div>
            </div>

            <div class="prop-profile-grid">
                <section class="profile-card">
                    <h2>Details</h2>
                    <p><?php echo htmlspecialchars($prop['description'] ?? ''); ?></p>
                </section>

                <section class="profile-card">
                    <h2>Image Gallery</h2>
                    <form action="includes/prop_profile_handlers.php" method="POST" enctype="multipart/form-data" class="upload-form">
                        <input type="hidden" name="action" value="upload_gallery">
                        <input type="hidden" name="prop_id" value="<?php echo (int)$prop_id; ?>">
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
            </div>
        </main>
    </div>
</div>
