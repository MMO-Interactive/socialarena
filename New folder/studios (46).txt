<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


$theme = 'light';

$posts = $pdo->query("
    SELECT n.*, u.username
    FROM public_news n
    JOIN users u ON n.author_id = u.id
    WHERE n.status = 'published'
    ORDER BY n.published_at DESC, n.created_at DESC
")->fetchAll(PDO::FETCH_ASSOC);
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>News | SocialArena.org</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/discover.css">
    <link rel="stylesheet" href="css/public_header.css">
</head>
<body class="discover-page">
    <?php include 'includes/public_header.php'; ?>

    <main>
        <section class="discover-row">
            <div class="row-header">
                <h2>News & Updates</h2>
                <span class="text-link">Latest platform updates</span>
            </div>
            <div class="studio-row">
                <?php foreach ($posts as $post): ?>
                    <a class="studio-card" href="news_article.php?slug=<?php echo htmlspecialchars($post['slug']); ?>">
                        <div class="studio-cover">
                            <?php if (!empty($post['cover_image_url'])): ?>
                                <img src="<?php echo htmlspecialchars($post['cover_image_url']); ?>" alt="">
                            <?php else: ?>
                                <div class="studio-cover placeholder"></div>
                            <?php endif; ?>
                        </div>
                        <div class="studio-info">
                            <div>
                                <h3><?php echo htmlspecialchars($post['title']); ?></h3>
                                <span>By <?php echo htmlspecialchars($post['username']); ?> · <?php echo date('M j, Y', strtotime($post['published_at'] ?? $post['created_at'])); ?></span>
                            </div>
                            <p><?php echo htmlspecialchars($post['excerpt'] ?? ''); ?></p>
                        </div>
                    </a>
                <?php endforeach; ?>
            </div>
        </section>
    </main>
</body>
</html>

