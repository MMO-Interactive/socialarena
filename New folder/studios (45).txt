<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$track_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if ($track_id === 0) {
    header('Location: music.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM studio_music_library WHERE id = ?");
$stmt->execute([$track_id]);
$track = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$track) {
    header('Location: music.php');
    exit;
}

try {
    enforceStudioItemAccess(
        $pdo,
        (int)$track['user_id'],
        (int)$track['studio_id'],
        $track['visibility'],
        (int)$_SESSION['user_id'],
        'music_library',
        false
    );
} catch (Exception $e) {
    header('Location: music.php');
    exit;
}

$page_title = 'Music Track - ' . htmlspecialchars($track['title']);
$additional_css = ['css/music_profile.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="music-hero">
                <div class="music-cover">
                    <?php if (!empty($track['cover_image_url'])): ?>
                        <img src="<?php echo htmlspecialchars($track['cover_image_url']); ?>" alt="">
                    <?php endif; ?>
                </div>
                <div class="music-hero-content">
                    <div class="music-title">
                        <h1><?php echo htmlspecialchars($track['title']); ?></h1>
                        <div class="music-meta">
                            <?php if (!empty($track['artist'])): ?>
                                <span><?php echo htmlspecialchars($track['artist']); ?></span>
                            <?php endif; ?>
                            <?php if (!empty($track['genre'])): ?>
                                <span><?php echo htmlspecialchars($track['genre']); ?></span>
                            <?php endif; ?>
                            <?php if (!empty($track['mood'])): ?>
                                <span><?php echo htmlspecialchars($track['mood']); ?></span>
                            <?php endif; ?>
                            <?php if (!empty($track['bpm'])): ?>
                                <span><?php echo htmlspecialchars($track['bpm']); ?> BPM</span>
                            <?php endif; ?>
                            <?php if (!empty($track['musical_key'])): ?>
                                <span><?php echo htmlspecialchars($track['musical_key']); ?></span>
                            <?php endif; ?>
                        </div>
                    </div>
                    <div class="music-hero-actions">
                        <a class="btn" href="music.php">Back to Music</a>
                    </div>
                </div>
            </div>

            <div class="music-profile-grid">
                <section class="profile-card">
                    <h2>Track Details</h2>
                    <p><?php echo htmlspecialchars($track['description'] ?? ''); ?></p>
                    <?php if (!empty($track['tags'])): ?>
                        <div class="music-tags"><?php echo htmlspecialchars($track['tags']); ?></div>
                    <?php endif; ?>
                </section>

                <section class="profile-card">
                    <h2>Playback</h2>
                    <?php if (!empty($track['file_url'])): ?>
                        <audio controls class="music-player">
                            <source src="audio_stream.php?file=<?php echo urlencode($track['file_url']); ?>">
                        </audio>
                    <?php else: ?>
                        <p class="empty-state">No audio file uploaded yet.</p>
                    <?php endif; ?>
                </section>
            </div>
        </main>
    </div>
</div>
