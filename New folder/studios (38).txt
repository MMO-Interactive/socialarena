<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$location_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($location_id === 0) {
    header('Location: locations.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM studio_locations WHERE id = ?");
$stmt->execute([$location_id]);
$location = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$location) {
    header('Location: locations.php');
    exit;
}
if ((int)$location['user_id'] !== (int)$_SESSION['user_id']) {
    $studioId = (int)($location['studio_id'] ?? 0);
    $visibility = $location['visibility'] ?? 'private';
    if (!$studioId || !userHasStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'locations') || !in_array($visibility, ['studio', 'public'], true)) {
        header('Location: locations.php');
        exit;
    }
}

$stmt = $pdo->prepare("SELECT * FROM studio_location_gallery WHERE location_id = ? ORDER BY created_at DESC");
$stmt->execute([$location_id]);
$gallery = $stmt->fetchAll(PDO::FETCH_ASSOC);
$gallery_count = count($gallery);

$page_title = 'Location Profile - ' . htmlspecialchars($location['name']);
$additional_css = ['css/location_profile.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="location-hero">
                <div class="location-cover">
                    <?php if (!empty($location['cover_image_url'])): ?>
                        <img src="<?php echo htmlspecialchars($location['cover_image_url']); ?>" alt="">
                    <?php endif; ?>
                </div>
                <div class="location-hero-content">
                    <div class="location-title">
                        <h1><?php echo htmlspecialchars($location['name']); ?></h1>
                        <div class="location-meta">
                            <?php if (!empty($location['location_type'])): ?>
                                <span><?php echo htmlspecialchars($location['location_type']); ?></span>
                            <?php endif; ?>
                            <?php if (!empty($location['region'])): ?>
                                <span><?php echo htmlspecialchars($location['region']); ?></span>
                            <?php endif; ?>
                            <?php if (!empty($location['tags'])): ?>
                                <span><?php echo htmlspecialchars($location['tags']); ?></span>
                            <?php endif; ?>
                        </div>
                    </div>
                    <div class="location-hero-actions">
                        <a class="btn" href="locations.php">Back to Locations</a>
                    </div>
                </div>
                <div class="location-stats">
                    <div>
                        <strong><?php echo $gallery_count; ?></strong>
                        <span>Images</span>
                    </div>
                </div>
            </div>

            <div class="location-profile-grid">
                <section class="profile-card">
                    <h2>Details</h2>
                    <p><?php echo htmlspecialchars($location['description'] ?? ''); ?></p>
                </section>

                <section class="profile-card">
                    <h2>Image Gallery</h2>
                    <form action="includes/location_profile_handlers.php" method="POST" enctype="multipart/form-data" class="upload-form">
                        <input type="hidden" name="action" value="upload_gallery">
                        <input type="hidden" name="location_id" value="<?php echo (int)$location_id; ?>">
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
