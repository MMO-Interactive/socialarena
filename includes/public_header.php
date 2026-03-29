<?php
require_once __DIR__ . '/platform_split.php';

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

$creatorHubUrl = sa_get_creator_hub_url();
$streamHubUrl = sa_get_stream_hub_url();
?>
<header class="public-header">
    <div class="public-brand">
        <span class="brand-title"><?php echo sa_is_creator_host() ? "Create.SocialArena.org" : "SocialArena.org"; ?></span>
        <span class="brand-subtitle"><?php echo sa_is_creator_host() ? "CREATOR STUDIO PLATFORM" : "STREAM AI FILMS + SERIES"; ?></span>
    </div>
    <nav class="public-nav">
        <?php if (sa_is_creator_host()): ?>
            <a href="dashboard.php">Dashboard</a>
            <a href="studios.php">Studios</a>
            <a href="talent_scout.php">Talent</a>
            <a href="<?php echo htmlspecialchars($streamHubUrl); ?>" class="nav-creators-link">Go to Streaming</a>
            <?php if (isset($_SESSION['user_id'])): ?>
                <span class="nav-status">Logged in</span>
                <a href="logout.php">Logout</a>
            <?php else: ?>
                <a href="login.php">Login</a>
                <a href="register.php" class="btn">Create Studio</a>
            <?php endif; ?>
        <?php else: ?>
            <?php if (!isset($_SESSION['user_id'])): ?>
                <a href="join.php">Join</a>
            <?php endif; ?>
            <a href="<?php echo htmlspecialchars($streamHubUrl); ?>#films">Watch</a>
            <a href="<?php echo htmlspecialchars($streamHubUrl); ?>#trailers">Trailers</a>
            <a href="talent_scout.php">Talent</a>
            <a href="news.php">News</a>
            <a href="<?php echo htmlspecialchars($streamHubUrl); ?>#studios">Studios</a>
            <a href="<?php echo htmlspecialchars($creatorHubUrl); ?>" class="nav-creators-link" target="_blank" rel="noopener noreferrer">Creator Hub</a>
            <?php if (isset($_SESSION['user_id'])): ?>
                <span class="nav-status">Logged in</span>
                <a href="dashboard.php">Dashboard</a>
                <a href="logout.php">Logout</a>
            <?php else: ?>
                <a href="login.php">Login</a>
                <a href="<?php echo htmlspecialchars($creatorHubUrl); ?>" class="btn" target="_blank" rel="noopener noreferrer">Create Studio</a>
            <?php endif; ?>
        <?php endif; ?>
    </nav>
</header>
