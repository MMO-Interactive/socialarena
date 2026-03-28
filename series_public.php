<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


$series_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if (!$series_id) {
    header('Location: index.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM series WHERE id = ?");
$stmt->execute([$series_id]);
$series = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$series || empty($series['is_public'])) {
    header('Location: index.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM series_seasons WHERE series_id = ? ORDER BY season_number ASC");
$stmt->execute([$series_id]);
$seasons = $stmt->fetchAll(PDO::FETCH_ASSOC);

$seasonIds = array_column($seasons, 'id');
$episodes = [];
if (!empty($seasonIds)) {
    $placeholders = implode(',', array_fill(0, count($seasonIds), '?'));
    $stmt = $pdo->prepare("
        SELECT se.*, st.status AS story_status, st.thumbnail_url AS story_thumbnail, st.description AS story_description
        FROM series_episodes se
        LEFT JOIN stories st ON se.story_id = st.id
        WHERE se.season_id IN ($placeholders)
        ORDER BY se.season_id ASC, se.episode_number ASC
    ");
    $stmt->execute($seasonIds);
    $episodes = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

$stmt = $pdo->prepare("SELECT * FROM series_public_media WHERE series_id = ? AND release_status = 'released' AND visibility = 'public' ORDER BY released_at DESC, created_at DESC");
$stmt->execute([$series_id]);
$public_media = $stmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'Series - ' . htmlspecialchars($series['title']);

$additional_css = ['css/series_public.css', 'css/public_header.css'];
$body_class = 'public-series-page';

include 'includes/header.php';
?>

<?php include 'includes/public_header.php'; ?>
<div class="page-wrapper public-series-wrapper">
    <div class="content-wrapper">
        <main class="main-content full-width">
            <section class="series-hero" style="<?php echo !empty($series['cover_image']) ? 'background-image:url(' . htmlspecialchars($series['cover_image']) . ');' : ''; ?>">
                <div class="series-hero-overlay"></div>
                <div class="series-hero-content">
                    <div class="series-badge">Public Series</div>
                    <h1><?php echo htmlspecialchars($series['title']); ?></h1>
                    <p><?php echo htmlspecialchars($series['description'] ?? ''); ?></p>
                    <div class="series-meta">
                        <span>Status: <?php echo htmlspecialchars($series['status'] ?? 'ongoing'); ?></span>
                        <span>Seasons: <?php echo count($seasons); ?></span>
                    </div>
                </div>
            </section>

            <section class="series-section">
                <div class="section-header">
                    <h2>Seasons & Episodes</h2>
                    <p>Explore the release structure and public episodes for this series.</p>
                </div>
                <?php if (empty($seasons)): ?>
                    <div class="empty-card">No seasons have been published yet.</div>
                <?php else: ?>
                    <div class="season-grid">
                        <?php foreach ($seasons as $season): ?>
                            <div class="season-card">
                                <h3>Season <?php echo (int)$season['season_number']; ?></h3>
                                <p><?php echo htmlspecialchars($season['title'] ?? ''); ?></p>
                                <div class="episode-list">
                                    <?php foreach ($episodes as $episode): ?>
                                        <?php if ((int)$episode['season_id'] !== (int)$season['id']) continue; ?>
                                        <div class="episode-item">
                                            <?php if (!empty($episode['story_thumbnail'])): ?>
                                                <img class="episode-thumb" src="<?php echo htmlspecialchars($episode['story_thumbnail']); ?>" alt="">
                                            <?php else: ?>
                                                <div class="episode-thumb placeholder"></div>
                                            <?php endif; ?>
                                            <div>
                                                <strong>Episode <?php echo (int)$episode['episode_number']; ?>: <?php echo htmlspecialchars($episode['title'] ?? 'Untitled'); ?></strong>
                                                <span><?php echo htmlspecialchars($episode['story_description'] ?? $episode['description'] ?? ''); ?></span>
                                            </div>
                                            <span class="episode-status"><?php echo htmlspecialchars($episode['story_status'] ?? 'unassigned'); ?></span>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </section>

            <section class="series-section">
                <div class="section-header">
                    <h2>Trailers & Screenshots</h2>
                    <p>Public clips, trailers, and stills from this series.</p>
                </div>
                <?php if (empty($public_media)): ?>
                    <div class="media-placeholder">
                        <p>No public media uploaded yet.</p>
                        <small>Add YouTube embeds and screenshot URLs in the future.</small>
                    </div>
                <?php else: ?>
                    <div class="public-media-grid">
                        <?php foreach ($public_media as $media): ?>
                            <a class="public-media-card" href="series_media_watch.php?id=<?php echo (int)$media['id']; ?>">
                                <div class="public-media-type"><?php echo strtoupper($media['media_type']); ?></div>
                                <?php if (!empty($media['thumbnail_url'])): ?>
                                    <img src="<?php echo htmlspecialchars($media['thumbnail_url']); ?>" alt="<?php echo htmlspecialchars($media['release_title'] ?: ($media['title'] ?? 'Thumbnail')); ?>">
                                <?php else: ?>
                                    <?php if ($media['media_type'] === 'screenshot'): ?>
                                        <img src="<?php echo htmlspecialchars($media['url']); ?>" alt="<?php echo htmlspecialchars($media['release_title'] ?: ($media['title'] ?? 'Screenshot')); ?>">
                                    <?php else: ?>
                                        <?php
                                            $videoId = '';
                                            if (preg_match('~v=([^&]+)~', $media['url'], $matches)) {
                                                $videoId = $matches[1];
                                            } elseif (preg_match('~youtu\.be/([^?]+)~', $media['url'], $matches)) {
                                                $videoId = $matches[1];
                                            }
                                        ?>
                                        <?php if (!empty($videoId)): ?>
                                            <img src="https://img.youtube.com/vi/<?php echo htmlspecialchars($videoId); ?>/hqdefault.jpg" alt="<?php echo htmlspecialchars($media['release_title'] ?: ($media['title'] ?? 'Thumbnail')); ?>">
                                        <?php else: ?>
                                            <div class="media-placeholder">Invalid YouTube URL</div>
                                        <?php endif; ?>
                                    <?php endif; ?>
                                <?php endif; ?>
                                <div class="public-media-info">
                                    <strong><?php echo htmlspecialchars($media['release_title'] ?: ($media['title'] ?? 'Untitled')); ?></strong>
                                </div>
                            </a>
                        <?php endforeach; ?>
                    </div>
                <?php endif; ?>
            </section>
        </main>
    </div>
</div>


