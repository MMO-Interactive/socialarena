<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

// Get user's theme preference from database
$stmt = $pdo->prepare("SELECT theme_preference FROM users WHERE id = ?");
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch(PDO::FETCH_ASSOC);
$theme = $user['theme_preference'] ?? 'dark'; // Default to dark theme if not set

// Get universe ID from URL
$universe_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// Get universe details
$stmt = $pdo->prepare("SELECT * FROM universes WHERE id = ?");
$stmt->execute([$universe_id]);
$universe = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$universe) {
    die('Universe not found');
}
try {
    enforceUniverseAccess($pdo, $universe_id, (int)$_SESSION['user_id'], false);
} catch (Exception $e) {
    header('Location: writing_center.php');
    exit;
}

// Get all series in this universe
$userId = (int)$_SESSION['user_id'];
[$seriesWhere, $seriesParams] = buildStudioVisibilityWhere('s', $userId, 'series');
$stmt = $pdo->prepare("
    SELECT s.*, COUNT(st.id) as story_count 
    FROM series s 
    LEFT JOIN stories st ON s.id = st.series_id 
    WHERE s.universe_id = ? AND {$seriesWhere}
    GROUP BY s.id 
    ORDER BY s.chronological_order ASC
");
$stmt->execute(array_merge([$universe_id], $seriesParams));
$series = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Get standalone stories in this universe
$userId = (int)$_SESSION['user_id'];
[$storyWhere, $storyParams] = buildStudioVisibilityWhere('st', $userId, 'stories');
$stmt = $pdo->prepare("
    SELECT st.* FROM stories st
    WHERE st.universe_id = ? AND st.series_id IS NULL AND {$storyWhere}
    ORDER BY st.timeline_date ASC
");
$stmt->execute(array_merge([$universe_id], $storyParams));
$standalone_stories = $stmt->fetchAll(PDO::FETCH_ASSOC);
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Universe: <?php echo htmlspecialchars($universe['title']); ?></title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/universe.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>
        
        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>
            
            <main class="main-content">
                <!-- Universe Header -->
                <div class="universe-header">
                    <h1><?php echo htmlspecialchars($universe['title']); ?></h1>
                    <div class="universe-actions">
                        <a href="universe_codex.php?universe_id=<?php echo $universe_id; ?>" class="btn codex-btn">
                            <i class="fas fa-book"></i> Universe Codex
                        </a>
                        <button class="btn" onclick="editUniverse()">
                            <i class="fas fa-edit"></i> Edit Universe
                        </button>
                    </div>
                </div>

                <!-- Universe Cover Image -->
                <?php if ($universe['cover_image']): ?>
                <div class="universe-cover">
                    <img src="<?php echo htmlspecialchars($universe['cover_image']); ?>" 
                         alt="<?php echo htmlspecialchars($universe['title']); ?>">
                </div>
                <?php endif; ?>

                <!-- Universe Description -->
                <div class="universe-description">
                    <p><?php echo nl2br(htmlspecialchars($universe['description'])); ?></p>
                </div>

                <!-- Series Section -->
                <section class="universe-section">
                    <div class="section-header">
                        <h2>Series</h2>
                        <button class="btn" onclick="createSeries()">
                            <i class="fas fa-plus"></i> New Series
                        </button>
                    </div>
                    
                    <div class="series-list">
                        <?php foreach ($series as $s): ?>
                        <div class="content-card">
                            <?php if ($s['cover_image']): ?>
                            <div class="card-thumbnail">
                                <img src="<?php echo htmlspecialchars($s['cover_image']); ?>" 
                                     alt="<?php echo htmlspecialchars($s['title']); ?>">
                            </div>
                            <?php endif; ?>
                            
                            <div class="card-content">
                                <h3>
                                    <a href="series.php?id=<?php echo $s['id']; ?>">
                                        <?php echo htmlspecialchars($s['title']); ?>
                                    </a>
                                </h3>
                                <div class="card-meta">
                                    <span><?php echo $s['story_count']; ?> Stories</span>
                                    <span class="status-badge <?php echo $s['status']; ?>">
                                        <?php echo ucfirst($s['status']); ?>
                                    </span>
                                </div>
                                <p><?php echo htmlspecialchars(substr($s['description'], 0, 200)) . '...'; ?></p>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </section>

                <!-- Films Section -->
                <?php if (!empty($standalone_stories)): ?>
                <section class="universe-section">
                    <div class="section-header">
                        <h2>Films</h2>
                        <button class="btn" onclick="createStory()">
                            <i class="fas fa-plus"></i> New Story
                        </button>
                    </div>
                    
                    <div class="stories-list">
                        <?php foreach ($standalone_stories as $story): ?>
                        <div class="content-card">
                            <?php if ($story['thumbnail_url']): ?>
                            <div class="card-thumbnail">
                                <img src="<?php echo htmlspecialchars($story['thumbnail_url']); ?>" 
                                     alt="<?php echo htmlspecialchars($story['title']); ?>">
                            </div>
                            <?php endif; ?>
                            
                            <div class="card-content">
                                <h3>
                                    <a href="story.php?id=<?php echo $story['id']; ?>">
                                        <?php echo htmlspecialchars($story['title']); ?>
                                    </a>
                                </h3>
                                <div class="card-meta">
                                    <span class="genre"><?php echo htmlspecialchars($story['genre']); ?></span>
                                    <span class="status-badge <?php echo $story['status']; ?>">
                                        <?php echo ucfirst($story['status']); ?>
                                    </span>
                                </div>
                                <p><?php echo htmlspecialchars(substr($story['description'], 0, 200)) . '...'; ?></p>
                            </div>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </section>
                <?php endif; ?>
            </main>
        </div>
    </div>

    <script src="js/universe.js"></script>
</body>
</html> 
