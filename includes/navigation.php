<?php
require_once __DIR__ . '/platform_split.php';
?>
<nav class="side-nav">
    <div class="nav-section">
        <h3>Navigation</h3>
        <ul class="nav-list">
            <li><a href="dashboard.php">Dashboard</a></li>
            <li><a href="stories.php">Browse Stories</a></li>
            <li class="nav-divider"></li>
            <li><a href="writing_center.php">Writing Center</a></li>
            <li><a href="release_manager.php">Release Manager</a></li>
            <li><a href="idea_boards.php">Idea Boards</a></li>
            <li><a href="virtual_actors.php">Virtual Cast</a></li>
            <li><a href="locations.php">Sets & Locations</a></li>
            <li><a href="wardrobes.php">Wardrobe</a></li>
            <li><a href="props.php">Prop Library</a></li>
            <li><a href="music.php">Music Library</a></li>
            <li><a href="music_composer.php">Music Composer</a></li>
            <li><a href="gpu_rentals.php">GPU Rentals</a></li>
            <li><a href="runpod_analytics.php">RunPod Analytics</a></li>
            <li><a href="studios.php">Studios</a></li>
            <li><a href="talent_scout.php">Talent Scout</a></li>
            <li><a href="manage_keys.php">Manage API Keys</a></li>
            <li><a href="settings_account.php">Settings</a></li>
            <?php if (sa_is_creator_host()): ?>
                <li><a href="<?php echo htmlspecialchars(sa_get_stream_hub_url()); ?>" target="_blank" rel="noopener noreferrer">Open Streaming Site</a></li>
            <?php else: ?>
                <li><a href="<?php echo htmlspecialchars(sa_get_creator_hub_url()); ?>" target="_blank" rel="noopener noreferrer">Open Creator Site</a></li>
            <?php endif; ?>
            <li class="nav-divider"></li>
            <li><a href="logout.php">Logout</a></li>
        </ul>
    </div>
</nav> 
