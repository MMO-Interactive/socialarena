<?php
require_once 'includes/db_connect.php';
require_once 'includes/platform_split.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


$theme = 'light';
$creatorHubUrl = sa_get_creator_hub_url();
$isCreatorExperience = sa_is_creator_host();

// Allow logged-in users to view the public discovery page.

$stmt = $pdo->query("SELECT s.*, u.username as author FROM stories s 
                     LEFT JOIN users u ON s.user_id = u.id 
                     WHERE s.status = 'published' 
                     ORDER BY s.created_at DESC LIMIT 12");
$latest_stories = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->query("SELECT * FROM series WHERE is_public = 1 ORDER BY updated_at DESC LIMIT 10");
$latest_series = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->query("SELECT s.*, 
           (SELECT COUNT(*) FROM studio_followers f WHERE f.studio_id = s.id) AS follower_count,
           (SELECT COUNT(*) FROM studio_members m WHERE m.studio_id = s.id) AS member_count
    FROM studios s
    ORDER BY s.created_at DESC
    LIMIT 8");
$featured_studios = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->query("
    SELECT 'series' as source, id, series_id as parent_id, title, url, thumbnail_url, media_type, created_at
    FROM series_public_media
    WHERE media_type = 'clip' AND release_status = 'released' AND visibility = 'public'
    UNION ALL
    SELECT 'story' as source, id, story_id as parent_id, title, url, thumbnail_url, media_type, created_at
    FROM story_public_media
    WHERE media_type = 'clip' AND release_status = 'released' AND visibility = 'public'
    ORDER BY created_at DESC
    LIMIT 12
");
$latest_clips = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->query("
    SELECT 'series' as source, id, series_id as parent_id, title, url, thumbnail_url, media_type, created_at
    FROM series_public_media
    WHERE media_type = 'trailer' AND release_status = 'released' AND visibility = 'public'
    UNION ALL
    SELECT 'story' as source, id, story_id as parent_id, title, url, thumbnail_url, media_type, created_at
    FROM story_public_media
    WHERE media_type = 'trailer' AND release_status = 'released' AND visibility = 'public'
    ORDER BY created_at DESC
    LIMIT 12
");
$latest_trailers = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->query("
    SELECT 'series' as source, id, series_id as parent_id, title, url, thumbnail_url, media_type, created_at
    FROM series_public_media
    WHERE media_type = 'screenshot' AND release_status = 'released' AND visibility = 'public'
    UNION ALL
    SELECT 'story' as source, id, story_id as parent_id, title, url, thumbnail_url, media_type, created_at
    FROM story_public_media
    WHERE media_type = 'screenshot' AND release_status = 'released' AND visibility = 'public'
    ORDER BY created_at DESC
    LIMIT 12
");
$latest_screenshots = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->query("SELECT n.title, n.slug, n.excerpt, n.cover_image_url, n.published_at
    FROM public_news n
    WHERE n.status = 'published'
    ORDER BY n.published_at DESC, n.created_at DESC
    LIMIT 4");
$latest_news = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->query("
    SELECT tp.id, tp.display_name, tp.headline, tp.bio, tp.availability, tp.avatar_url, tp.created_at,
           GROUP_CONCAT(tr.name ORDER BY tr.name SEPARATOR ', ') AS roles
    FROM talent_profiles tp
    LEFT JOIN talent_profile_roles tpr ON tpr.profile_id = tp.id
    LEFT JOIN talent_roles tr ON tr.id = tpr.role_id
    WHERE tp.is_public = 1
    GROUP BY tp.id
    ORDER BY tp.created_at DESC
    LIMIT 4
");
$latest_talents = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->query("
    SELECT r.id, r.title, r.roles, r.tags, r.created_at, s.name AS studio_name
    FROM studio_talent_requests r
    JOIN studios s ON r.studio_id = s.id
    WHERE r.status = 'open'
    ORDER BY r.created_at DESC
    LIMIT 4
");
$latest_talent_requests = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->query("
    SELECT v.image_url, v.title, v.created_at, s.name AS studio_name, s.id AS studio_id
    FROM studio_visual_posts v
    JOIN studios s ON v.studio_id = s.id
    ORDER BY v.created_at DESC
    LIMIT 4
");
$latest_studio_visuals = $stmt->fetchAll(PDO::FETCH_ASSOC);
$featured = $latest_stories[0] ?? null;
if (!$featured) {
    $stmt = $pdo->query("SELECT s.*, u.username as author FROM stories s LEFT JOIN users u ON s.user_id = u.id ORDER BY s.created_at DESC LIMIT 1");
    $featured = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $isCreatorExperience ? "Create.SocialArena.org | Creator Platform" : "SocialArena.org | Streaming Platform"; ?></title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/discover.css">
    <link rel="stylesheet" href="css/public_header.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Archivo:wght@500;600;700&display=swap">
</head>
<body class="discover-page">
    <?php include 'includes/public_header.php'; ?>

    <main>
        <?php if ($isCreatorExperience): ?>
        <section class="discover-hero">
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <span class="hero-badge">Creator Platform</span>
                <h1>Build stories, studios, and releases on create.socialarena.org</h1>
                <p>Your dedicated creator site includes writing, casting, production planning, release management, and studio collaboration workflows.</p>
                <div class="hero-actions">
                    <?php if (isset($_SESSION['user_id'])): ?>
                        <a href="dashboard.php" class="btn">Open Creator Dashboard</a>
                    <?php else: ?>
                        <a href="register.php" class="btn">Create Your Studio</a>
                    <?php endif; ?>
                    <a href="<?php echo htmlspecialchars(sa_get_stream_hub_url()); ?>" class="btn btn-secondary">Go to Streaming Site</a>
                </div>
            </div>
        </section>

        <section class="platform-split">
            <div class="split-card split-card-creator">
                <span class="split-label">Creator Workflows</span>
                <h2>Full creator suite</h2>
                <p>Plan series, write stories, generate media, manage studios, and publish releases in one connected workspace.</p>
                <a href="dashboard.php">Open Studio Tools -></a>
            </div>
            <div class="split-card">
                <span class="split-label">Viewer Experience</span>
                <h2>Streaming lives on socialarena.org</h2>
                <p>When you are ready to share, your audience watches films and series on the main streaming platform.</p>
                <a href="<?php echo htmlspecialchars(sa_get_stream_hub_url()); ?>">Open Streaming Platform -></a>
            </div>
        </section>
        <?php else: ?>
        <section class="discover-hero <?php echo !empty($featured['thumbnail_url']) ? 'has-image' : ''; ?>" style="<?php echo !empty($featured['thumbnail_url']) ? 'background-image: url(' . htmlspecialchars($featured['thumbnail_url']) . ');' : ''; ?>">
            <div class="hero-overlay"></div>
            <div class="hero-content">
                <span class="hero-badge">Streaming Platform</span>
                <h1><?php echo htmlspecialchars($featured['title'] ?? 'Your next AI film'); ?></h1>
                <p><?php echo htmlspecialchars($featured['description'] ?? 'Stream AI-generated films, clips, and series. The full creator studio now lives at create.socialarena.org.'); ?></p>
                <div class="hero-actions">
                    <a href="join.php" class="btn">Start Watching</a>
                    <a href="<?php echo htmlspecialchars($creatorHubUrl); ?>" class="btn btn-secondary" target="_blank" rel="noopener noreferrer">Go to Creator Site</a>
                </div>
                <div class="hero-meta">
                    <span><?php echo htmlspecialchars($featured['genre'] ?? 'Experimental'); ?></span>
                    <span><?php echo htmlspecialchars($featured['author'] ?? 'Studio Creator'); ?></span>
                </div>
            </div>
        </section>
        <section class="platform-split">
            <div class="split-card">
                <span class="split-label">Watch on socialarena.org</span>
                <h2>Streaming is now the main experience</h2>
                <p>Discover films, trailers, clips, and public studio drops directly on the main domain.</p>
            </div>
            <div class="split-card split-card-creator">
                <span class="split-label">Build on create.socialarena.org</span>
                <h2>Creators get a dedicated full site</h2>
                <p>Story development, studio management, and production tools are now centered in a standalone creator platform.</p>
                <a href="<?php echo htmlspecialchars($creatorHubUrl); ?>" target="_blank" rel="noopener noreferrer">Open Creator Platform -></a>
            </div>
        </section>

        <section class="discover-row" id="films">
            <div class="row-header">
                <h2>Latest Films</h2>
                <a href="join.php" class="text-link">Join to watch</a>
            </div>
            <div class="media-row">
                <?php foreach ($latest_stories as $story): ?>
                    <a class="media-card" href="story_public.php?id=<?php echo (int)$story['id']; ?>">
                        <div class="media-thumb">
                            <img src="<?php echo htmlspecialchars($story['thumbnail_url'] ?? 'images/default-story.svg'); ?>" alt="<?php echo htmlspecialchars($story['title']); ?>">
                        </div>
                        <div class="media-info">
                            <h3><?php echo htmlspecialchars($story['title']); ?></h3>
                            <span><?php echo htmlspecialchars($story['genre'] ?? ''); ?></span>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </section>

        <section class="discover-row" id="series">
            <div class="row-header">
                <h2>Series in Development</h2>
                <a href="join.php" class="text-link">Explore series</a>
            </div>
            <div class="media-row">
                <?php foreach ($latest_series as $series): ?>
                    <a class="media-card" href="series_public.php?id=<?php echo (int)$series['id']; ?>">
                        <div class="media-thumb">
                            <img src="<?php echo htmlspecialchars($series['cover_image'] ?? 'images/default-story.svg'); ?>" alt="<?php echo htmlspecialchars($series['title']); ?>">
                        </div>
                        <div class="media-info">
                            <h3><?php echo htmlspecialchars($series['title']); ?></h3>
                            <span><?php echo htmlspecialchars($series['status'] ?? 'ongoing'); ?></span>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </section>

        <section class="discover-row" id="clips">
            <div class="row-header">
                <h2>Latest Clips</h2>
                <a href="join.php" class="text-link">Browse clips</a>
            </div>
            <div class="media-row">
                <?php foreach ($latest_clips as $item): ?>
                    <?php
                        $thumb = $item['thumbnail_url'] ?: 'images/default-story.svg';
                        $link = $item['source'] === 'series'
                            ? 'series_media_watch.php?id=' . (int)$item['id']
                            : 'story_media_watch.php?id=' . (int)$item['id'];
                    ?>
                    <a class="media-card" href="<?php echo $link; ?>">
                        <div class="media-thumb">
                            <img src="<?php echo htmlspecialchars($thumb); ?>" alt="<?php echo htmlspecialchars($item['title'] ?? 'Clip'); ?>">
                        </div>
                        <div class="media-info">
                            <h3><?php echo htmlspecialchars($item['title'] ?? 'Untitled'); ?></h3>
                            <span>Clip</span>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </section>

        <section class="discover-row" id="trailers">
            <div class="row-header">
                <h2>Latest Trailers</h2>
                <a href="join.php" class="text-link">Browse trailers</a>
            </div>
            <div class="media-row">
                <?php foreach ($latest_trailers as $item): ?>
                    <?php
                        $thumb = $item['thumbnail_url'] ?: 'images/default-story.svg';
                        $link = $item['source'] === 'series'
                            ? 'series_media_watch.php?id=' . (int)$item['id']
                            : 'story_media_watch.php?id=' . (int)$item['id'];
                    ?>
                    <a class="media-card" href="<?php echo $link; ?>">
                        <div class="media-thumb">
                            <img src="<?php echo htmlspecialchars($thumb); ?>" alt="<?php echo htmlspecialchars($item['title'] ?? 'Trailer'); ?>">
                        </div>
                        <div class="media-info">
                            <h3><?php echo htmlspecialchars($item['title'] ?? 'Untitled'); ?></h3>
                            <span>Trailer</span>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </section>

        <section class="discover-row" id="screenshots">
            <div class="row-header">
                <h2>Latest Screenshots & Promotional Images</h2>
                <a href="join.php" class="text-link">Explore visuals</a>
            </div>
            <div class="media-row">
                <?php foreach ($latest_screenshots as $item): ?>
                    <?php
                        $thumb = $item['thumbnail_url'] ?: ($item['url'] ?: 'images/default-story.svg');
                        $link = $item['source'] === 'series'
                            ? 'series_media_watch.php?id=' . (int)$item['id']
                            : 'story_media_watch.php?id=' . (int)$item['id'];
                    ?>
                    <a class="media-card" href="<?php echo $link; ?>">
                        <div class="media-thumb">
                            <img src="<?php echo htmlspecialchars($thumb); ?>" alt="<?php echo htmlspecialchars($item['title'] ?? 'Screenshot'); ?>">
                        </div>
                        <div class="media-info">
                            <h3><?php echo htmlspecialchars($item['title'] ?? 'Untitled'); ?></h3>
                            <span>Screenshot</span>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </section>
        <section class="discover-row" id="news">
            <div class="row-header">
                <h2>Latest News</h2>
                <a href="news.php" class="text-link">All updates</a>
            </div>
            <div class="media-row">
                <?php foreach ($latest_news as $post): ?>
                    <a class="media-card" href="news_article.php?slug=<?php echo htmlspecialchars($post['slug']); ?>">
                        <div class="media-thumb">
                            <img src="<?php echo htmlspecialchars($post['cover_image_url'] ?? 'images/default-story.svg'); ?>" alt="<?php echo htmlspecialchars($post['title']); ?>">
                        </div>
                        <div class="media-info">
                            <h3><?php echo htmlspecialchars($post['title']); ?></h3>
                            <span><?php echo htmlspecialchars($post['excerpt'] ?? ''); ?></span>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </section>


        <section class="discover-row" id="talent">
            <div class="row-header">
                <h2>Latest Talent</h2>
                <a href="talent_scout.php" class="text-link">Browse talent</a>
            </div>
            <div class="media-row talent-row">
                <?php foreach ($latest_talents as $talent): ?>
                    <?php
                        $availability = strtolower($talent['availability'] ?? 'available');
                        $availabilityLabel = ucfirst($availability);
                        $availabilityClass = 'status-' . $availability;
                    ?>
                    <a class="media-card talent-card" href="talent_profile.php?id=<?php echo (int)$talent['id']; ?>">
                        <div class="talent-header">
                            <img class="talent-avatar" src="<?php echo htmlspecialchars($talent['avatar_url'] ?? 'images/default-avatar.svg'); ?>" alt="<?php echo htmlspecialchars($talent['display_name']); ?>">
                            <div>
                                <h3><?php echo htmlspecialchars($talent['display_name']); ?></h3>
                                <span class="talent-headline"><?php echo htmlspecialchars($talent['headline'] ?? 'Talent'); ?></span>
                            </div>
                        </div>
                        <span class="talent-status <?php echo $availabilityClass; ?>"><?php echo htmlspecialchars($availabilityLabel); ?></span>
                        <div class="talent-roles"><?php echo htmlspecialchars($talent['roles'] ?? ''); ?></div>
                        <?php if (!empty($talent['bio'])): ?>
                            <p class="talent-bio"><?php echo htmlspecialchars($talent['bio']); ?></p>
                        <?php endif; ?>
                    </a>
                <?php endforeach; ?>
            </div>
        </section>

        <section class="discover-row" id="talent-openings">
            <div class="row-header">
                <h2>Latest Talent Openings</h2>
                <a href="talent_scout.php" class="text-link">View requests</a>
            </div>
            <div class="media-row">
                <?php foreach ($latest_talent_requests as $request): ?>
                    <a class="media-card" href="talent_scout.php">
                        <div class="media-thumb">
                            <img src="images/default-story.svg" alt="<?php echo htmlspecialchars($request['title']); ?>">
                        </div>
                        <div class="media-info">
                            <h3><?php echo htmlspecialchars($request['title']); ?></h3>
                            <span><?php echo htmlspecialchars($request['studio_name']); ?></span>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </section>

        <section class="discover-row" id="studio-visuals">
            <div class="row-header">
                <h2>Latest Studio Visuals</h2>
                <a href="studios.php" class="text-link">Explore studios</a>
            </div>
            <div class="media-row">
                <?php foreach ($latest_studio_visuals as $visual): ?>
                    <a class="media-card" href="studio_public.php?id=<?php echo (int)$visual['studio_id']; ?>">
                        <div class="media-thumb">
                            <img src="<?php echo htmlspecialchars($visual['image_url']); ?>" alt="<?php echo htmlspecialchars($visual['title'] ?? 'Studio Visual'); ?>">
                        </div>
                        <div class="media-info">
                            <h3><?php echo htmlspecialchars($visual['title'] ?? 'Studio Visual'); ?></h3>
                            <span><?php echo htmlspecialchars($visual['studio_name']); ?></span>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </section>

        <section class="discover-row" id="studios">
            <div class="row-header">
                <h2>Studio Discovery</h2>
                <a href="join.php" class="text-link">Start your studio</a>
            </div>
            <div class="studio-row">
                <?php foreach ($featured_studios as $studio): ?>
                    <article class="studio-card">
                        <div class="studio-cover">
                            <?php if (!empty($studio['banner_url'])): ?>
                                <img src="<?php echo htmlspecialchars($studio['banner_url']); ?>" alt="">
                            <?php else: ?>
                                <div class="studio-cover placeholder"></div>
                            <?php endif; ?>
                        </div>
                        <div class="studio-info">
                            <div class="studio-identity">
                                <?php if (!empty($studio['logo_url'])): ?>
                                    <img src="<?php echo htmlspecialchars($studio['logo_url']); ?>" alt="">
                                <?php else: ?>
                                    <div class="studio-logo"><?php echo strtoupper(substr($studio['name'], 0, 1)); ?></div>
                                <?php endif; ?>
                                <div>
                                    <h3><?php echo htmlspecialchars($studio['name']); ?></h3>
        <?php endif; ?>
                                    <span><?php echo (int)$studio['member_count']; ?> members · <?php echo (int)$studio['follower_count']; ?> followers</span>
                                </div>
                            </div>
                            <p><?php echo htmlspecialchars($studio['description'] ?? ''); ?></p>
                            <a class="btn" href="studio_public.php?id=<?php echo (int)$studio['id']; ?>">Visit Studio</a>
                        </div>
                    </article>
                <?php endforeach; ?>
            </div>
        </section>

        <section class="discover-cta">
            <div class="cta-card">
                <h2>Build your AI studio universe.</h2>
                <p>Organize series, casting, budgets, and production workflows. Invite your team and publish your studio profile.</p>
                <a href="join.php" class="btn">Join now</a>
            </div>
        </section>
    </main>
</body>
</html>





