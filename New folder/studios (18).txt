<?php
require_once 'includes/db_connect.php';
require_once 'includes/studio_access.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$theme = $_SESSION['theme'] ?? 'light';

$userId = (int)$_SESSION['user_id'];
// Get user's universes
[$universeWhere, $universeParams] = buildStudioVisibilityWhere('u', $userId, 'universes');
$stmt = $pdo->prepare("SELECT u.* FROM universes u WHERE {$universeWhere}");
$stmt->execute($universeParams);
$universes = $stmt->fetchAll();

// Get user's standalone series
[$seriesWhere, $seriesParams] = buildStudioVisibilityWhere('s', $userId, 'series');
$stmt = $pdo->prepare("
    SELECT s.*, COUNT(st.id) as story_count
    FROM series s
    LEFT JOIN stories st ON s.id = st.series_id
    WHERE s.universe_id IS NULL AND {$seriesWhere}
    GROUP BY s.id
");
$stmt->execute($seriesParams);
$standalone_series = $stmt->fetchAll();

// Get user's standalone stories
[$storyWhere, $storyParams] = buildStudioVisibilityWhere('s', $userId, 'stories');
$stmt = $pdo->prepare("
    SELECT s.*, u.username as author_name,
           COUNT(DISTINCT sr.id) as rating_count,
           COALESCE(AVG(sr.rating), 0) as avg_rating
    FROM stories s
    LEFT JOIN users u ON s.created_by = u.id
    LEFT JOIN story_ratings sr ON s.id = sr.story_id
    WHERE s.series_id IS NULL 
    AND s.universe_id IS NULL 
    AND {$storyWhere}
    GROUP BY s.id
    ORDER BY s.created_at DESC
");
$stmt->execute($storyParams);
$standalone_stories = $stmt->fetchAll();
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Writing Center - Choose Your Own Adventure</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/writing_center.css">
    <script src="js/delete-content.js" defer></script>
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>
        
        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>
            
            <main class="main-content">
                <div class="writing-center-header">
                    <h1>Writing Center</h1>
                    <div class="create-buttons">
                        <button onclick="location.href='create_universe.php'" class="btn create-btn">
                            <i class="fas fa-globe"></i> Create Universe
                        </button>
                        <button onclick="location.href='create_series.php'" class="btn create-btn">
                            <i class="fas fa-books"></i> Create Series
                        </button>
                        <button onclick="location.href='create_story.php'" class="btn create-btn">
                            <i class="fas fa-book"></i> Create Story
                        </button>
                        <button onclick="location.href='generate_story.php'" class="btn create-btn ai-btn">
                            <i class="fas fa-robot"></i> Generate Story with AI
                        </button>
                    </div>
                </div>

                <!-- Your Universes Section -->
                <section class="content-section">
                    <h2>Your Universes</h2>
                    <?php if (empty($universes)): ?>
                        <div class="empty-state">
                            <p>You haven't created any universes yet.</p>
                            <a href="create_universe.php" class="btn primary-btn">Create Your First Universe</a>
                        </div>
                    <?php else: ?>
                        <div class="universes-list">
                            <?php foreach ($universes as $universe): ?>
                                <div class="content-card">
                                    <div class="card-thumbnail">
                                        <img src="<?php echo htmlspecialchars($universe['cover_image'] ?? 'images/default-universe.svg'); ?>" 
                                             alt="<?php echo htmlspecialchars($universe['title']); ?>">
                                    </div>
                                    <div class="card-content">
                                        <h3><?php echo htmlspecialchars($universe['title']); ?></h3>
                                        <?php if (!empty($universe['description'])): ?>
                                            <p class="card-description"><?php echo htmlspecialchars($universe['description']); ?></p>
                                        <?php endif; ?>
                                        <div class="card-actions">
                                            <a href="universe.php?id=<?php echo $universe['id']; ?>" class="action-btn full-width">Manage</a>
                                            <a href="universe_planner.php?id=<?php echo $universe['id']; ?>" class="action-btn dark full-width">Planner</a>
                                        </div>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </section>

                <!-- Standalone Series Section -->
                <section class="content-section">
                    <h2>Standalone Series</h2>
                    <?php if (empty($standalone_series)): ?>
                        <div class="empty-state">
                            <p>You haven't created any standalone series yet.</p>
                            <a href="create_series.php" class="btn primary-btn">Create Your First Series</a>
                        </div>
                    <?php else: ?>
                        <?php foreach ($standalone_series as $series): ?>
                            <div class="content-card">
                                <div class="card-thumbnail">
                                    <img src="<?php echo htmlspecialchars($series['cover_image'] ?? 'images/default-series.svg'); ?>" 
                                         alt="<?php echo htmlspecialchars($series['title']); ?>">
                                </div>
                                <div class="card-content">
                                    <h3><?php echo htmlspecialchars($series['title']); ?></h3>
                                    <div class="card-meta">
                                        <span><?php echo $series['story_count']; ?> Stories</span>
                                        <span class="status-pill <?php echo strtolower($series['status']); ?>">
                                            <?php echo ucfirst($series['status']); ?>
                                        </span>
                                    </div>
                                    <?php if (!empty($series['description'])): ?>
                                        <p class="card-description"><?php echo htmlspecialchars($series['description']); ?></p>
                                    <?php endif; ?>
                                    <div class="card-actions">
                                        <a href="series.php?id=<?php echo $series['id']; ?>" class="action-btn">Manage</a>
                                        <a href="series_planner.php?id=<?php echo $series['id']; ?>" class="action-btn dark">Planner</a>
                                    </div>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </section>

                <!-- Films Section -->
                <section class="content-section">
                    <h2>Films</h2>
                    <?php if (empty($standalone_stories)): ?>
                        <div class="empty-state">
                            <p>You haven't created any films yet.</p>
                            <a href="create_story.php" class="btn primary-btn">Create Your First Film</a>
                        </div>
                    <?php else: ?>
                        <div class="stories-list">
                            <?php foreach ($standalone_stories as $story): ?>
                                <div class="story-item">
                                    <div class="story-thumbnail">
                                        <img src="<?php echo htmlspecialchars($story['thumbnail_url'] ?? 'images/default-story.svg'); ?>" 
                                             alt="Story thumbnail">
                                    </div>
                                    <div class="story-info">
                                        <h3><?php echo htmlspecialchars($story['title']); ?></h3>
                                        <p class="story-meta">Genre: <?php echo htmlspecialchars($story['genre']); ?></p>
                                        <div class="story-actions">
                                            <a href="edit_story.php?id=<?php echo $story['id']; ?>" class="action-btn">Edit</a>
                                            <a href="story_planner.php?id=<?php echo $story['id']; ?>" class="action-btn">Plan</a>
                                            <a href="write_story.php?id=<?php echo $story['id']; ?>" class="action-btn">Write</a>
                                            <a href="story.php?id=<?php echo $story['id']; ?>" class="action-btn dark">View</a>
                                            <button onclick='confirmDelete("story", <?php echo $story['id']; ?>, "<?php echo htmlspecialchars(addslashes($story['title'])); ?>")' 
                                                    class="action-btn danger">Delete</button>
                                        </div>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </section>
            </main>
        </div>
        
        <?php include 'includes/footer.php'; ?>
    </div>
</body>
</html> 
