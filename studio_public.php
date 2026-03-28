<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


$studio_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if (!$studio_id) {
    header('Location: index.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM studios WHERE id = ?");
$stmt->execute([$studio_id]);
$studio = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$studio) {
    header('Location: index.php');
    exit;
}

$user_id = $_SESSION['user_id'] ?? null;
$is_member = false;
$role = null;
if ($user_id) {
    $stmt = $pdo->prepare("SELECT role FROM studio_members WHERE studio_id = ? AND user_id = ?");
    $stmt->execute([$studio_id, $user_id]);
    $role = $stmt->fetchColumn();
    $is_member = !empty($role);
}

$stmt = $pdo->prepare("
    SELECT s.*, u.username
    FROM studio_posts s
    JOIN users u ON s.user_id = u.id
    WHERE s.studio_id = ?
    ORDER BY s.created_at DESC
    LIMIT 10
");
$stmt->execute([$studio_id]);
$posts = $stmt->fetchAll(PDO::FETCH_ASSOC);

$postComments = [];
if (!empty($posts)) {
    $postIds = array_map(static function ($post) {
        return (int)$post['id'];
    }, $posts);
    $placeholders = implode(',', array_fill(0, count($postIds), '?'));
    $stmt = $pdo->prepare("
        SELECT c.*, u.username
        FROM studio_post_comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.post_id IN ($placeholders)
        ORDER BY c.created_at ASC
    ");
    $stmt->execute($postIds);
    $comments = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($comments as $comment) {
        $postId = (int)$comment['post_id'];
        if (!isset($postComments[$postId])) {
            $postComments[$postId] = [];
        }
        $postComments[$postId][] = $comment;
    }
}

$stmt = $pdo->prepare("
    SELECT v.image_url, v.title, v.created_at, v.source_type FROM (
        SELECT image_url, title, created_at, 'studio' AS source_type
        FROM studio_visual_posts
        WHERE studio_id = ?
        UNION ALL
        SELECT spm.url AS image_url, spm.title, spm.created_at, 'series' AS source_type
        FROM series_public_media spm
        JOIN series s ON spm.series_id = s.id
        WHERE spm.media_type = 'screenshot' AND s.studio_id = ?
        UNION ALL
        SELECT spm2.url AS image_url, spm2.title, spm2.created_at, 'story' AS source_type
        FROM story_public_media spm2
        JOIN stories st ON spm2.story_id = st.id
        WHERE spm2.media_type = 'screenshot' AND st.studio_id = ?
        UNION ALL
        SELECT u.cover_image AS image_url, u.title AS title, u.updated_at AS created_at, 'universe' AS source_type
        FROM universes u
        WHERE u.studio_id = ? AND u.cover_image IS NOT NULL
    ) v
    ORDER BY v.created_at DESC
    LIMIT 12
");
$stmt->execute([$studio_id, $studio_id, $studio_id, $studio_id]);
$visuals = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare("
    SELECT id, title, status, updated_at
    FROM series
    WHERE studio_id = ?
    ORDER BY updated_at DESC
    LIMIT 6
");
$stmt->execute([$studio_id]);
$series = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare("
    SELECT title, artist, mood, file_url
    FROM studio_music_library
    WHERE user_id = ?
    ORDER BY updated_at DESC
    LIMIT 4
");
$stmt->execute([$studio['owner_id']]);
$music = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare("
    SELECT * FROM studio_talent_requests
    WHERE studio_id = ? AND status = 'open'
    ORDER BY created_at DESC
    LIMIT 4
");
$stmt->execute([$studio_id]);
$talentRequests = $stmt->fetchAll(PDO::FETCH_ASSOC);

$followed = false;
$memberCount = 0;
$followerCount = 0;
$seriesCount = 0;
$visualCount = 0;

if ($user_id) {
    $stmt = $pdo->prepare("SELECT id FROM studio_followers WHERE studio_id = ? AND user_id = ?");
    $stmt->execute([$studio_id, $user_id]);
    $followed = (bool)$stmt->fetchColumn();
}

if ($user_id) {
    $stmt = $pdo->prepare("SELECT id FROM studio_followers WHERE studio_id = ? AND user_id = ?");
    $stmt->execute([$studio_id, $user_id]);
    $followed = (bool)$stmt->fetchColumn();
}

$stmt = $pdo->prepare("SELECT COUNT(*) FROM studio_members WHERE studio_id = ?");
$stmt->execute([$studio_id]);
$memberCount = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("SELECT COUNT(*) FROM studio_followers WHERE studio_id = ?");
$stmt->execute([$studio_id]);
$followerCount = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("SELECT COUNT(*) FROM series WHERE studio_id = ?");
$stmt->execute([$studio_id]);
$seriesCount = (int)$stmt->fetchColumn();

$stmt = $pdo->prepare("
    SELECT (
        (SELECT COUNT(*) FROM studio_visual_posts WHERE studio_id = ?)
        + (SELECT COUNT(*) FROM series_public_media spm JOIN series s ON spm.series_id = s.id WHERE spm.media_type = 'screenshot' AND s.studio_id = ?)
        + (SELECT COUNT(*) FROM story_public_media spm2 JOIN stories st ON spm2.story_id = st.id WHERE spm2.media_type = 'screenshot' AND st.studio_id = ?)
        + (SELECT COUNT(*) FROM universes u WHERE u.studio_id = ? AND u.cover_image IS NOT NULL)
    )
");
$stmt->execute([$studio_id, $studio_id, $studio_id, $studio_id]);
$visualCount = (int)$stmt->fetchColumn();

$page_title = 'Studio - ' . htmlspecialchars($studio['name']);

$additional_css = ['css/studio_public.css', 'css/public_header.css'];
$body_class = 'public-studio-page';

include 'includes/header.php';
?>

<?php include 'includes/public_header.php'; ?>
<div class="page-wrapper public-studio-wrapper">
    <div class="content-wrapper">
        <main class="main-content full-width">
            <div class="studio-public-hero">
                <div class="studio-public-banner">
                    <?php if (!empty($studio['banner_url'])): ?>
                        <img src="<?php echo htmlspecialchars($studio['banner_url']); ?>" alt="">
                    <?php else: ?>
                        <div class="banner-placeholder"></div>
                    <?php endif; ?>
                </div>
                <div class="studio-public-header">
                    <div class="studio-public-identity">
                        <?php if (!empty($studio['logo_url'])): ?>
                            <img class="studio-public-logo" src="<?php echo htmlspecialchars($studio['logo_url']); ?>" alt="">
                        <?php else: ?>
                            <div class="studio-public-logo placeholder"><?php echo strtoupper(substr($studio['name'], 0, 1)); ?></div>
                        <?php endif; ?>
                        <div>
                            <h1><?php echo htmlspecialchars($studio['name']); ?></h1>
                            <p><?php echo htmlspecialchars($studio['description'] ?? ''); ?></p>
                        </div>
                    </div>
                    <div class="studio-public-actions">
                        <?php if ($user_id): ?>
                            <button class="btn primary-btn" id="follow-btn" data-followed="<?php echo $followed ? '1' : '0'; ?>" data-studio-id="<?php echo (int)$studio_id; ?>">
                                <?php echo $followed ? 'Following' : 'Follow'; ?>
                            </button>
                        <?php else: ?>
                            <a class="btn primary-btn" href="login.php">Login to Follow</a>
                        <?php endif; ?>
                    </div>
                </div>
                <div class="studio-public-stats">
                    <div class="stat-pill"><strong><?php echo $memberCount; ?></strong><span>Members</span></div>
                    <div class="stat-pill"><strong><?php echo $followerCount; ?></strong><span>Followers</span></div>
                    <div class="stat-pill"><strong><?php echo $seriesCount; ?></strong><span>Series</span></div>
                    <div class="stat-pill"><strong><?php echo $visualCount; ?></strong><span>Visuals</span></div>
                </div>
            </div>

            <div class="studio-public-grid">
                <div class="studio-public-row studio-public-row--top">
                <section class="studio-public-card">
                    <h3>About</h3>
                    <p><?php echo htmlspecialchars($studio['description'] ?? ''); ?></p>
                </section>

                <section class="studio-public-card">
                    <h3>Active Series</h3>
                    <?php if (empty($series)): ?>
                        <p class="empty-state">No series published yet.</p>
                    <?php else: ?>
                        <div class="tile-grid">
                            <?php foreach ($series as $s): ?>
                                <a class="tile" href="series_public.php?id=<?php echo (int)$s['id']; ?>">
                                    <strong><?php echo htmlspecialchars($s['title']); ?></strong>
                                    <span><?php echo htmlspecialchars($s['status'] ?? 'Draft'); ?></span>
                                </a>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </section>
                </div>

                <div class="studio-public-row studio-public-row--visuals">
                <section class="studio-public-card">
                    <h3>Latest Visuals</h3>
                    <?php if (empty($visuals)): ?>
                        <p class="empty-state">No visuals posted yet.</p>
                    <?php else: ?>
                        <div class="visual-grid">
                            <?php foreach ($visuals as $visual): ?>
                                <div class="visual-item">
                                    <img src="<?php echo htmlspecialchars($visual['image_url']); ?>" alt="">
                                    <?php if (!empty($visual['title'])): ?>
                                        <span><?php echo htmlspecialchars($visual['title']); ?></span>
                                    <?php endif; ?>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </section>
                </div>

                <div class="studio-public-row">
                <section class="studio-public-card">
                    <h3>Music Teasers</h3>
                    <?php if (empty($music)): ?>
                        <p class="empty-state">No music teasers yet.</p>
                    <?php else: ?>
                        <div class="music-teasers">
                            <?php foreach ($music as $track): ?>
                                <div class="music-teaser">
                                    <strong><?php echo htmlspecialchars($track['title']); ?></strong>
                                    <span><?php echo htmlspecialchars($track['mood'] ?? ''); ?></span>
                                    <?php if (!empty($track['file_url'])): ?>
                                        <audio controls>
                                            <source src="audio_stream.php?file=<?php echo urlencode($track['file_url']); ?>">
                                        </audio>
                                    <?php endif; ?>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </section>
                </div>

                <div class="studio-public-row">
                <section class="studio-public-card">
                    <h3>Open Roles</h3>
                    <?php if (empty($talentRequests)): ?>
                        <p class="empty-state">No open roles yet.</p>
                    <?php else: ?>
                        <div class="request-list">
                            <?php foreach ($talentRequests as $request): ?>
                                <div class="request-item">
                                    <strong><?php echo htmlspecialchars($request['title']); ?></strong>
                                    <span><?php echo htmlspecialchars($request['roles'] ?? ''); ?></span>
                                    <?php if (!empty($request['tags'])): ?>
                                        <span><?php echo htmlspecialchars($request['tags']); ?></span>
                                    <?php endif; ?>
                                    <p><?php echo htmlspecialchars($request['description'] ?? ''); ?></p>
                                    <?php if (!empty($request['contact_email'])): ?>
                                        <span class="muted">Contact: <?php echo htmlspecialchars($request['contact_email']); ?></span>
                                    <?php endif; ?>
                                    <?php if ($user_id): ?>
                                        <form method="POST" action="includes/studio_talent_handlers.php" class="request-apply">
                                            <input type="hidden" name="action" value="apply">
                                            <input type="hidden" name="request_id" value="<?php echo (int)$request['id']; ?>">
                                            <textarea name="message" placeholder="Tell the studio why you're a good fit..."></textarea>
                                            <input type="text" name="portfolio_url" placeholder="Portfolio link (optional)">
                                            <button class="btn" type="submit">Apply</button>
                                        </form>
                                    <?php else: ?>
                                        <a href="login.php" class="btn">Login to Apply</a>
                                    <?php endif; ?>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </section>
                </div>

                <section class="studio-public-card studio-feed">
                    <div class="feed-header">
                        <h3>Studio Feed</h3>
                        <?php if ($is_member): ?>
                            <button class="btn" id="new-post">New Post</button>
                        <?php endif; ?>
                    </div>
                    <?php if (empty($posts)): ?>
                        <p class="empty-state">No updates yet.</p>
                    <?php else: ?>
                        <div class="feed-list">
                            <?php foreach ($posts as $post): ?>
                                <article class="feed-item">
                                    <div class="feed-meta">
                                        <strong><?php echo htmlspecialchars($post['title'] ?? 'Studio Update'); ?></strong>
                                        <span>by <?php echo htmlspecialchars($post['username']); ?> &middot; <?php echo date('M j, Y', strtotime($post['created_at'])); ?></span>
                                    </div>
                                    <?php if (!empty($post['image_url'])): ?>
                                        <img src="<?php echo htmlspecialchars($post['image_url']); ?>" alt="">
                                    <?php endif; ?>
                                    <p><?php echo nl2br(htmlspecialchars($post['body'] ?? '')); ?></p>
                                    <?php if (!empty($postComments[(int)$post['id']])): ?>
                                        <div class="comment-list">
                                            <?php foreach ($postComments[(int)$post['id']] as $comment): ?>
                                                <div class="comment-item">
                                                    <strong><?php echo htmlspecialchars($comment['username']); ?></strong>
                                                    <span><?php echo htmlspecialchars($comment['comment']); ?></span>
                                                </div>
                                            <?php endforeach; ?>
                                        </div>
                                    <?php endif; ?>
                                    <?php if ($is_member): ?>
                                        <form class="comment-form" data-post-id="<?php echo (int)$post['id']; ?>">
                                            <input type="text" placeholder="Add a comment...">
                                            <button class="btn secondary-btn" type="submit">Post</button>
                                        </form>
                                    <?php else: ?>
                                        <p class="muted">Login as a member to comment.</p>
                                    <?php endif; ?>
                                </article>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </section>
            </div>
        </main>
    </div>
</div>

<div class="modal" id="post-modal" style="display:none;">
    <div class="modal-content">
        <h2>New Studio Post</h2>
        <div class="form-group">
            <label>Title</label>
            <input type="text" id="post-title">
        </div>
        <div class="form-group">
            <label>Body</label>
            <textarea id="post-body" placeholder="Share an update..."></textarea>
        </div>
        <div class="form-group">
            <label>Image URL</label>
            <input type="text" id="post-image">
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="post-cancel">Cancel</button>
            <button class="btn primary-btn" id="post-save" data-studio-id="<?php echo (int)$studio_id; ?>">Post</button>
        </div>
    </div>
</div>

<script src="js/studio_public.js"></script>


