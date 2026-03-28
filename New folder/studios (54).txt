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

$user_id = isset($_GET['id']) ? (int)$_GET['id'] : $_SESSION['user_id'];
$theme = $_SESSION['theme'] ?? 'light';

// Get user information
$stmt = $pdo->prepare("
    SELECT u.*, 
           COUNT(DISTINCT s.id) as story_count,
           COUNT(DISTINCT f.follower_id) as follower_count,
           COUNT(DISTINCT ff.following_id) as following_count,
           COUNT(DISTINCT sr.id) as total_ratings,
           COALESCE(AVG(sr.rating), 0) as avg_story_rating
    FROM users u
    LEFT JOIN stories s ON u.id = s.user_id
    LEFT JOIN user_follows f ON u.id = f.following_id
    LEFT JOIN user_follows ff ON u.id = ff.follower_id
    LEFT JOIN story_ratings sr ON s.id = sr.story_id
    WHERE u.id = ?
    GROUP BY u.id
");
$stmt->execute([$user_id]);
$profile = $stmt->fetch();

if (!$profile) {
    header('Location: dashboard.php');
    exit;
}

// Check if logged-in user is following this profile
$stmt = $pdo->prepare("SELECT 1 FROM user_follows WHERE follower_id = ? AND following_id = ?");
$stmt->execute([$_SESSION['user_id'], $user_id]);
$isFollowing = $stmt->fetchColumn();

// Get user's stories
$stmt = $pdo->prepare("
    SELECT s.*, 
           COUNT(DISTINCT sr.id) as rating_count,
           COALESCE(AVG(sr.rating), 0) as avg_rating,
           COUNT(DISTINCT b.user_id) as bookmark_count
    FROM stories s
    LEFT JOIN story_ratings sr ON s.id = sr.story_id
    LEFT JOIN user_bookmarks b ON s.id = b.story_id
    WHERE s.user_id = ?
    GROUP BY s.id
    ORDER BY s.created_at DESC
");
$stmt->execute([$user_id]);
$stories = $stmt->fetchAll();

// Get user's achievements
$stmt = $pdo->prepare("
    SELECT a.*, ua.earned_at
    FROM story_achievements a
    JOIN user_achievements ua ON a.id = ua.achievement_id
    WHERE ua.user_id = ?
    ORDER BY ua.earned_at DESC
");
$stmt->execute([$user_id]);
$achievements = $stmt->fetchAll();
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?php echo htmlspecialchars($profile['username']); ?>'s Profile</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/profile.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>
        
        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>
            
            <main class="main-content">
                <div class="profile-header" style="background-image: url('<?php echo htmlspecialchars($profile['profile_header'] ?? 'images/default-header.svg'); ?>')">
                    <div class="profile-info-strip">
                        <div class="profile-photo">
                            <img src="<?php echo htmlspecialchars($profile['profile_photo'] ?? 'images/default-avatar.svg'); ?>" 
                                 alt="Profile photo">
                        </div>
                        
                        <div class="profile-info">
                            <h2><?php echo htmlspecialchars($profile['username']); ?></h2>
                            <div class="profile-meta">
                                <?php if ($profile['location']): ?>
                                    <div class="location">
                                        <i class="fas fa-map-marker-alt"></i>
                                        <?php echo htmlspecialchars($profile['location']); ?>
                                    </div>
                                <?php endif; ?>
                                
                                <?php if ($profile['website']): ?>
                                    <div class="website">
                                        <i class="fas fa-link"></i>
                                        <a href="<?php echo htmlspecialchars($profile['website']); ?>" target="_blank">
                                            <?php echo htmlspecialchars($profile['website']); ?>
                                        </a>
                                    </div>
                                <?php endif; ?>
                            </div>
                        </div>
                        
                        <?php if ($user_id === $_SESSION['user_id']): ?>
                            <a href="edit_profile.php" class="edit-profile-btn">
                                <i class="fas fa-edit"></i> Edit Profile
                            </a>
                        <?php else: ?>
                            <button class="follow-btn <?php echo $isFollowing ? 'following' : ''; ?>"
                                    onclick="toggleFollow(<?php echo $user_id; ?>, this)">
                                <i class="fas <?php echo $isFollowing ? 'fa-user-check' : 'fa-user-plus'; ?>"></i>
                                <?php echo $isFollowing ? 'Following' : 'Follow'; ?>
                            </button>
                        <?php endif; ?>
                    </div>
                </div>

                <div class="profile-content">
                    <?php if ($profile['bio']): ?>
                        <div class="bio-section">
                            <p><?php echo nl2br(htmlspecialchars($profile['bio'])); ?></p>
                        </div>
                    <?php endif; ?>

                    <div class="profile-stats">
                        <div class="stat-box">
                            <span class="stat-number"><?php echo $profile['story_count']; ?></span>
                            <span class="stat-label">Stories</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-number"><?php echo $profile['follower_count']; ?></span>
                            <span class="stat-label">Followers</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-number"><?php echo $profile['following_count']; ?></span>
                            <span class="stat-label">Following</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-number"><?php echo number_format($profile['avg_story_rating'], 1); ?></span>
                            <span class="stat-label">Avg Rating</span>
                        </div>
                    </div>

                    <div class="profile-tabs">
                        <button class="tab-btn active" onclick="showTab('stories')">Stories</button>
                        <button class="tab-btn" onclick="showTab('achievements')">Achievements</button>
                        <button class="tab-btn" onclick="showTab('bookmarks')">Bookmarks</button>
                    </div>

                    <div id="stories" class="tab-content active">
                        <div class="story-list">
                            <?php if (empty($stories)): ?>
                                <p>No stories yet.</p>
                            <?php else: ?>
                                <?php foreach ($stories as $story): ?>
                                    <div class="story-card">
                                        <div class="story-thumbnail">
                                            <img src="<?php echo htmlspecialchars($story['thumbnail_url'] ?? 'images/default-story.svg'); ?>" 
                                                 alt="Story thumbnail" loading="lazy">
                                        </div>
                                        <div class="story-info">
                                            <div class="story-header">
                                                <h2><?php echo htmlspecialchars($story['title']); ?></h2>
                                                <div class="story-source-icon" title="<?php echo $story['is_ai_generated'] ? 'AI Generated' : 'Human Written'; ?>">
                                                    <?php if ($story['is_ai_generated']): ?>
                                                        <svg viewBox="0 0 24 24" width="24" height="24">
                                                            <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                                                        </svg>
                                                    <?php endif; ?>
                                                </div>
                                            </div>
                                            <p class="story-meta">
                                                By <a href="profile.php?id=<?php echo $story['user_id']; ?>" class="author-link">
                                                    <?php echo htmlspecialchars($profile['username']); ?>
                                                </a> | 
                                                Genre: <?php echo htmlspecialchars($story['genre']); ?> | 
                                                Rating: <?php echo number_format($story['avg_rating'], 1); ?>/5
                                                (<?php echo $story['rating_count']; ?> ratings)
                                            </p>
                                            <p class="story-description"><?php echo htmlspecialchars($story['description']); ?></p>
                                            <div class="story-actions">
                                                <a href="story.php?id=<?php echo $story['id']; ?>" class="btn">Start Story</a>
                                                <a href="story_details.php?id=<?php echo $story['id']; ?>" class="btn secondary-btn">View Details</a>
                                                <?php if ($story['user_id'] === $_SESSION['user_id']): ?>
                                                    <button onclick="deleteStory(<?php echo $story['id']; ?>, this)" class="delete-btn">Delete</button>
                                                <?php endif; ?>
                                            </div>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </div>
                    </div>

                    <div id="achievements" class="tab-content">
                        <div class="achievements-grid">
                            <?php if (empty($achievements)): ?>
                                <p>No achievements yet.</p>
                            <?php else: ?>
                                <?php foreach ($achievements as $achievement): ?>
                                    <div class="achievement-card">
                                        <img src="<?php echo htmlspecialchars($achievement['icon_url'] ?? 'images/default-story.svg'); ?>" 
                                             alt="Achievement icon">
                                        <div class="achievement-info">
                                            <h4><?php echo htmlspecialchars($achievement['title']); ?></h4>
                                            <p><?php echo htmlspecialchars($achievement['description']); ?></p>
                                            <span class="earned-date">
                                                Earned <?php echo date('M j, Y', strtotime($achievement['earned_at'])); ?>
                                            </span>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            <?php endif; ?>
                        </div>
                    </div>

                    <div id="bookmarks" class="tab-content">
                        <!-- Bookmarks content will be loaded via AJAX -->
                    </div>
                </div>
            </main>
        </div>
        
        <?php include 'includes/footer.php'; ?>
    </div>

    <script src="js/story-social.js"></script>
    <script>
        function showTab(tabId) {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Deactivate all tab buttons
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            
            // Show selected tab content
            document.getElementById(tabId).classList.add('active');
            
            // Activate selected tab button
            event.target.classList.add('active');
            
            // Load bookmarks content if selected
            if (tabId === 'bookmarks') {
                loadBookmarks();
            }
        }

        function loadBookmarks() {
            const bookmarksTab = document.getElementById('bookmarks');
            fetch('includes/get_bookmarks.php?user_id=<?php echo $user_id; ?>')
                .then(response => response.json())
                .then(data => {
                    // Render bookmarks content
                    bookmarksTab.innerHTML = renderBookmarks(data);
                });
        }

        function renderBookmarks(bookmarks) {
            if (bookmarks.length === 0) {
                return '<p class="no-content">No bookmarked stories yet.</p>';
            }

            return `
                <div class="story-grid">
                    ${bookmarks.map(bookmark => `
                        <div class="story-card">
                            <div class="story-thumbnail">
                                <img src="${bookmark.thumbnail_url || 'images/default-story.svg'}" alt="Story thumbnail">
                            </div>
                            <div class="story-info">
                                <h3>${bookmark.title}</h3>
                                <p class="story-meta">
                                    ${bookmark.genre} | Bookmarked on ${new Date(bookmark.created_at).toLocaleDateString()}
                                </p>
                                <div class="story-actions">
                                    <a href="story.php?id=${bookmark.story_id}" class="btn primary-btn">Read</a>
                                    <a href="story_details.php?id=${bookmark.story_id}" class="btn secondary-btn">Details</a>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }
    </script>
</body>
</html> 
