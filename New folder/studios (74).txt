<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

// Get story ID from URL
if (!isset($_GET['id'])) {
    header('Location: dashboard.php');
    exit;
}

$story_id = (int)$_GET['id'];
$user_id = $_SESSION['user_id'];
$theme = $_SESSION['theme'] ?? 'light';

// Get story details with author info
$stmt = $pdo->prepare("
    SELECT s.*, u.username as author_name, 
           COUNT(DISTINCT sc.id) as completion_count,
           COALESCE(AVG(sr.rating), 0) as avg_rating,
           COUNT(DISTINCT sr.id) as rating_count
    FROM stories s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN story_completions sc ON s.id = sc.story_id
    LEFT JOIN story_ratings sr ON s.id = sr.story_id
    WHERE s.id = ?
    GROUP BY s.id, u.username
");
$stmt->execute([$story_id]);
$story = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$story) {
    header('Location: dashboard.php');
    exit;
}

// Get user's rating if exists
$stmt = $pdo->prepare("SELECT rating FROM story_ratings WHERE story_id = ? AND user_id = ?");
$stmt->execute([$story_id, $user_id]);
$userRating = $stmt->fetchColumn();

// Get comments with user info
$stmt = $pdo->prepare("
    SELECT c.*, u.username, u.profile_photo
    FROM story_comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.story_id = ?
    ORDER BY c.created_at DESC
");
$stmt->execute([$story_id]);
$comments = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Handle rating submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['rating'])) {
    $rating = (int)$_POST['rating'];
    if ($rating >= 1 && $rating <= 5) {
        $stmt = $pdo->prepare("
            INSERT INTO story_ratings (story_id, user_id, rating)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE rating = VALUES(rating)
        ");
        $stmt->execute([$story_id, $user_id, $rating]);
        header("Location: story_details.php?id=$story_id");
        exit;
    }
}

// Handle comment submission
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['comment'])) {
    $comment = trim($_POST['comment']);
    if (!empty($comment)) {
        $stmt = $pdo->prepare("
            INSERT INTO story_comments (story_id, user_id, comment)
            VALUES (?, ?, ?)
        ");
        $stmt->execute([$story_id, $user_id, $comment]);
        header("Location: story_details.php?id=$story_id");
        exit;
    }
}
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($story['title']); ?> - Story Details</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/story-details.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>
        
        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>
            
            <main class="main-content">
                <div class="story-details">
                    <div class="story-header">
                        <?php if (!empty($story['thumbnail_url'])): ?>
                            <img src="<?php echo htmlspecialchars($story['thumbnail_url']); ?>" 
                                 alt="Story thumbnail" class="story-thumbnail">
                        <?php endif; ?>
                        
                        <div class="story-info">
                            <h1><?php echo htmlspecialchars($story['title']); ?></h1>
                            <p class="story-meta">
                                By <a href="profile.php?id=<?php echo $story['user_id']; ?>" class="author-link">
                                    <?php echo htmlspecialchars($story['author_name']); ?>
                                </a> | 
                                Genre: <?php echo htmlspecialchars($story['genre']); ?> | 
                                Setting: <?php echo htmlspecialchars($story['setting']); ?>
                            </p>
                            
                            <div class="story-stats">
                                <div class="stat">
                                    <span class="stat-label">Completions:</span>
                                    <span class="stat-value"><?php echo $story['completion_count']; ?></span>
                                </div>
                                <div class="stat">
                                    <span class="stat-label">Average Rating:</span>
                                    <span class="stat-value">
                                        <?php 
                                        $rating = floatval($story['avg_rating']);
                                        echo $rating > 0 ? number_format($rating, 1) : 'No ratings yet';
                                        ?>/5
                                        (<?php echo $story['rating_count']; ?> ratings)
                                    </span>
                                </div>
                            </div>
                            
                            <p class="story-description"><?php echo htmlspecialchars($story['description']); ?></p>
                            
                            <div class="story-actions">
                                <a href="story.php?id=<?php echo $story_id; ?>" class="btn primary-btn">Start Story</a>
                            </div>
                        </div>
                    </div>
                    
                    <div class="rating-section">
                        <h2>Rate this Story</h2>
                        <form method="POST" class="rating-form">
                            <div class="star-rating">
                                <?php for ($i = 5; $i >= 1; $i--): ?>
                                    <input type="radio" id="star<?php echo $i; ?>" 
                                           name="rating" value="<?php echo $i; ?>"
                                           <?php echo $userRating === $i ? 'checked' : ''; ?>>
                                    <label for="star<?php echo $i; ?>">★</label>
                                <?php endfor; ?>
                            </div>
                            <button type="submit" class="btn">Submit Rating</button>
                        </form>
                    </div>
                    
                    <div class="comments-section">
                        <h2>Comments</h2>
                        <form method="POST" class="comment-form">
                            <textarea name="comment" placeholder="Share your thoughts..." required></textarea>
                            <button type="submit" class="btn">Post Comment</button>
                        </form>
                        
                        <div class="comments-list">
                            <?php foreach ($comments as $comment): ?>
                                <div class="comment">
                                    <div class="comment-header">
                                        <?php if ($comment['profile_photo']): ?>
                                            <img src="<?php echo htmlspecialchars($comment['profile_photo']); ?>" 
                                                 alt="Profile photo" class="comment-avatar">
                                        <?php endif; ?>
                                        <div class="comment-meta">
                                            <span class="comment-author">
                                                <?php echo htmlspecialchars($comment['username']); ?>
                                            </span>
                                            <span class="comment-date">
                                                <?php echo date('M j, Y g:i A', strtotime($comment['created_at'])); ?>
                                            </span>
                                        </div>
                                    </div>
                                    <div class="comment-content">
                                        <?php echo htmlspecialchars($comment['comment']); ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <?php include 'includes/footer.php'; ?>
    </div>
</body>
</html> 