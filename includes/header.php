<?php
require_once __DIR__ . '/platform_split.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (!isset($pdo)) {
    require_once __DIR__ . '/db_connect.php';
}

// Get user's theme preference from database
$theme = 'dark';
if (!empty($_SESSION['user_id'])) {
    $stmt = $pdo->prepare("SELECT theme_preference FROM users WHERE id = ?");
    $stmt->execute([$_SESSION['user_id']]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    $theme = $user['theme_preference'] ?? 'dark'; // Default to dark theme if not set
}
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo $page_title ?? 'Choose Your Own Adventure'; ?></title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <?php if (isset($additional_css)): ?>
        <?php foreach ($additional_css as $css): ?>
            <link rel="stylesheet" href="<?php echo $css; ?>">
        <?php endforeach; ?>
    <?php endif; ?>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body<?php echo !empty($body_class) ? ' class="' . htmlspecialchars($body_class) . '"' : ''; ?>>
    <header class="site-header">
        <h1><?php echo sa_is_creator_host() ? 'Create.SocialArena.org' : 'SocialArena.org'; ?></h1>
        <p class="site-subtitle"><?php echo sa_is_creator_host() ? 'Full creator studio suite' : 'Series and screenplay workspace'; ?></p>
        <p class="site-subtitle">
            <?php if (sa_is_creator_host()): ?>
                Streaming portal: <a href="<?php echo htmlspecialchars(sa_get_stream_hub_url()); ?>">socialarena.org</a>
            <?php else: ?>
                Creator portal: <a href="<?php echo htmlspecialchars(sa_get_creator_hub_url()); ?>">create.socialarena.org</a>
            <?php endif; ?>
        </p>
    </header>
