<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


$theme = 'light';
$slug = trim($_GET['slug'] ?? '');

$post = null;
if ($slug !== '') {
    $stmt = $pdo->prepare("
        SELECT n.*, u.username
        FROM public_news n
        JOIN users u ON n.author_id = u.id
        WHERE n.status = 'published' AND n.slug = ?
        LIMIT 1
    ");
    $stmt->execute([$slug]);
    $post = $stmt->fetch(PDO::FETCH_ASSOC);
}
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($post['title'] ?? 'News'); ?> | SocialArena.org</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/discover.css">
    <link rel="stylesheet" href="css/public_header.css">
    <link rel="stylesheet" href="css/news.css">
</head>
<body class="discover-page">
    <?php include 'includes/public_header.php'; ?>

    <main>
        <section class="news-article">
            <?php if ($post): ?>
                <div class="news-hero">
                    <?php if (!empty($post['cover_image_url'])): ?>
                        <img src="<?php echo htmlspecialchars($post['cover_image_url']); ?>" alt="">
                    <?php endif; ?>
                    <div class="news-hero-overlay"></div>
                    <div class="news-hero-content">
                        <span class="news-tag">News</span>
                        <h1><?php echo htmlspecialchars($post['title']); ?></h1>
                        <div class="news-meta">
                            <span>By <?php echo htmlspecialchars($post['username']); ?></span>
                            <span><?php echo date('M j, Y', strtotime($post['published_at'] ?? $post['created_at'])); ?></span>
                        </div>
                        <?php if (!empty($post['excerpt'])): ?>
                            <p class="news-excerpt"><?php echo htmlspecialchars($post['excerpt']); ?></p>
                        <?php endif; ?>
                    </div>
                </div>
                <article class="news-body">
                    <?php echo nl2br(htmlspecialchars($post['body'])); ?>
                </article>
            <?php else: ?>
                <div class="news-missing">
                    <h2>News article not found.</h2>
                    <a class="btn" href="news.php">Back to news</a>
                </div>
            <?php endif; ?>
        </section>
    </main>
</body>
</html>
