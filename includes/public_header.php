<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

}
?>
<header class="public-header">
    <div class="public-brand">
        <span class="brand-title">SocialArena.org</span>
        <span class="brand-subtitle">AI GENERATED FILMS + SERIES</span>
    </div>
    <nav class="public-nav">
        <?php if (!isset($_SESSION['user_id'])): ?>
            <a href="join.php">Join</a>
        <?php endif; ?>
        <a href="talent_scout.php">Talent</a>
        <a href="news.php">News</a>
        <a href="index.php#series">Series</a>
        <a href="index.php#studios">Studios</a>
        <?php if (isset($_SESSION['user_id'])): ?>
            <span class="nav-status">Logged in</span>
            <a href="dashboard.php">Dashboard</a>
            <a href="logout.php">Logout</a>
        <?php else: ?>
            <a href="login.php">Login</a>
            <a href="register.php" class="btn">Create Studio</a>
        <?php endif; ?>
    </nav>
</header>
