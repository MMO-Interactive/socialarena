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

// Get filter parameters
$search = $_GET['search'] ?? '';
$genre = $_GET['genre'] ?? 'All Genres';
$sort = $_GET['sort'] ?? 'latest';
$ai_only = isset($_GET['ai_only']);
$human_only = isset($_GET['human_only']);
$completed_only = isset($_GET['completed_only']);
$author_id = $_GET['author'] ?? null;
$bookmarked = isset($_GET['bookmarked']);

// Build the query
$query = "
    SELECT s.*, u.username as author_name,
           COUNT(DISTINCT sr.id) as rating_count,
           COALESCE(AVG(sr.rating), 0) as avg_rating,
           COUNT(DISTINCT b.user_id) as bookmark_count
    FROM stories s
    LEFT JOIN users u ON s.user_id = u.id
    LEFT JOIN story_ratings sr ON s.id = sr.story_id
    LEFT JOIN user_bookmarks b ON s.id = b.story_id
";

$params = [];
$where_conditions = [];

// Visibility / studio access
[$accessClause, $accessParams] = buildStudioVisibilityWhere('s', (int)$_SESSION['user_id'], 'stories');
$where_conditions[] = $accessClause;
$params = array_merge($params, $accessParams);

// Add search condition
if (!empty($search)) {
    $where_conditions[] = "(s.title LIKE ? OR s.description LIKE ?)";
    $params[] = "%$search%";
    $params[] = "%$search%";
}

// Add genre filter
if ($genre !== 'All Genres') {
    $where_conditions[] = "s.genre = ?";
    $params[] = $genre;
}

// Add AI/Human filter
if ($ai_only) {
    $where_conditions[] = "s.is_ai_generated = 1";
}
if ($human_only) {
    $where_conditions[] = "s.is_ai_generated = 0";
}

// Add completed filter
if ($completed_only) {
    $where_conditions[] = "s.status = 'published'";
}

// Add author filter
if ($author_id) {
    $where_conditions[] = "s.user_id = ?";
    $params[] = $author_id;
}

// Add bookmarked filter
if ($bookmarked) {
    $query .= " JOIN user_bookmarks ub ON s.id = ub.story_id AND ub.user_id = ?";
    $params[] = $_SESSION['user_id'];
}

// Combine where conditions
if (!empty($where_conditions)) {
    $query .= " WHERE " . implode(" AND ", $where_conditions);
}

$query .= " GROUP BY s.id";

// Add sorting
switch ($sort) {
    case 'popular':
        $query .= " ORDER BY bookmark_count DESC";
        break;
    case 'rating':
        $query .= " ORDER BY avg_rating DESC, rating_count DESC";
        break;
    case 'oldest':
        $query .= " ORDER BY s.created_at ASC";
        break;
    default: // latest
        $query .= " ORDER BY s.created_at DESC";
}

// Get all available genres for the filter
$genres_stmt = $pdo->query("SELECT DISTINCT genre FROM stories ORDER BY genre");
$genres = $genres_stmt->fetchAll(PDO::FETCH_COLUMN);

// Execute the main query
$stmt = $pdo->prepare($query);
$stmt->execute($params);
$stories = $stmt->fetchAll();
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stories - Choose Your Own Adventure</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/stories.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>
        
        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>
            
            <main class="main-content">
                <!-- Search and Filters -->
                <div class="stories-header">
                    <form method="GET" class="search-bar">
                        <input type="text" name="search" placeholder="Search stories..." 
                               value="<?php echo htmlspecialchars($search); ?>">
                        <button type="submit" class="search-btn">
                            <i class="fas fa-search"></i>
                        </button>
                    </form>
                    
                    <div class="view-options">
                        <button class="view-btn grid-view active" title="Grid View">
                            <i class="fas fa-th"></i>
                        </button>
                        <button class="view-btn list-view" title="List View">
                            <i class="fas fa-list"></i>
                        </button>
                    </div>
                </div>

                <!-- Filters Section -->
                <form method="GET" class="filters-section">
                    <div class="filter-group">
                        <label>Genre</label>
                        <select name="genre">
                            <option value="All Genres">All Genres</option>
                            <?php foreach ($genres as $g): ?>
                                <option value="<?php echo htmlspecialchars($g); ?>"
                                        <?php echo $genre === $g ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($g); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    
                    <div class="filter-group">
                        <label>Sort By</label>
                        <select name="sort">
                            <option value="latest" <?php echo $sort === 'latest' ? 'selected' : ''; ?>>Latest</option>
                            <option value="popular" <?php echo $sort === 'popular' ? 'selected' : ''; ?>>Most Popular</option>
                            <option value="rating" <?php echo $sort === 'rating' ? 'selected' : ''; ?>>Highest Rated</option>
                            <option value="oldest" <?php echo $sort === 'oldest' ? 'selected' : ''; ?>>Oldest</option>
                        </select>
                    </div>

                    <div class="filter-toggles">
                        <label>
                            <input type="checkbox" name="ai_only" <?php echo $ai_only ? 'checked' : ''; ?>>
                            AI Generated Only
                        </label>
                        <label>
                            <input type="checkbox" name="human_only" <?php echo $human_only ? 'checked' : ''; ?>>
                            Human Written Only
                        </label>
                        <label>
                            <input type="checkbox" name="completed_only" <?php echo $completed_only ? 'checked' : ''; ?>>
                            Completed Stories
                        </label>
                    </div>

                    <button type="submit" class="btn apply-filters">Apply Filters</button>
                </form>

                <!-- Stories Grid -->
                <div class="stories-grid">
                    <?php if (empty($stories)): ?>
                        <p>No stories match your filters.</p>
                    <?php else: ?>
                    <?php foreach ($stories as $story): ?>
                        <div class="story-card">
                            <div class="story-thumbnail">
                                <img src="<?php echo htmlspecialchars($story['thumbnail_url'] ?? 'images/default-story.svg'); ?>" 
                                     alt="Story thumbnail">
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
                                        <?php echo htmlspecialchars($story['author_name'] ?? 'Unknown'); ?>
                                    </a> | 
                                    Genre: <?php echo htmlspecialchars($story['genre']); ?> |
                                    Rating: <?php echo number_format($story['avg_rating'], 1); ?>/5
                                    (<?php echo $story['rating_count']; ?> ratings)
                                </p>
                                <p class="story-description"><?php echo htmlspecialchars($story['description']); ?></p>
                                <div class="story-actions">
                                    <?php if ((int)$story['user_id'] === (int)$_SESSION['user_id']): ?>
                                        <a href="edit_story.php?id=<?php echo $story['id']; ?>" class="action-btn">Edit</a>
                                        <a href="story_planner.php?id=<?php echo $story['id']; ?>" class="action-btn">Planner</a>
                                    <?php endif; ?>
                                    <a href="story.php?id=<?php echo $story['id']; ?>" class="action-btn dark">View</a>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </main>
        </div>
        
        <?php include 'includes/footer.php'; ?>
    </div>

    <script>
        // View toggle functionality
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const isGrid = this.classList.contains('grid-view');
                document.querySelector('.stories-grid').classList.toggle('list-view', !isGrid);
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
            });
        });
    </script>
</body>
</html> 
