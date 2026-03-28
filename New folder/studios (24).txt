<?php
ob_start();
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

// Get theme preference
$theme = $_SESSION['theme'] ?? 'light';

// Get user information
$user_id = $_SESSION['user_id'];
$stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
$stmt->execute([$user_id]);
$user = $stmt->fetch();
if (!$user) {
    $user = [
        'id' => $user_id,
        'username' => $_SESSION['username'] ?? ''
    ];
}
$display_name = $user['username'] ?? '';

$studio_stats = [
    'series_count' => 0,
    'universe_count' => 0,
    'story_count' => 0,
    'board_count' => 0,
    'location_count' => 0,
    'cast_count' => 0
];

try {
    [$seriesWhere, $seriesParams] = buildStudioVisibilityWhere('s', (int)$user_id, 'series');
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM series s WHERE {$seriesWhere}");
    $stmt->execute($seriesParams);
    $studio_stats['series_count'] = (int)$stmt->fetchColumn();
} catch (Throwable $e) {
    $studio_stats['series_count'] = 0;
}

try {
    [$universeWhere, $universeParams] = buildStudioVisibilityWhere('u', (int)$user_id, 'universes');
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM universes u WHERE {$universeWhere}");
    $stmt->execute($universeParams);
    $studio_stats['universe_count'] = (int)$stmt->fetchColumn();
} catch (Throwable $e) {
    $studio_stats['universe_count'] = 0;
}

try {
    [$storyWhere, $storyParams] = buildStudioVisibilityWhere('st', (int)$user_id, 'stories');
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM stories st WHERE {$storyWhere}");
    $stmt->execute($storyParams);
    $studio_stats['story_count'] = (int)$stmt->fetchColumn();
} catch (Throwable $e) {
    $studio_stats['story_count'] = 0;
}

try {
    [$boardWhere, $boardParams] = buildStudioVisibilityWhere('ib', (int)$user_id, 'idea_boards');
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM idea_boards ib WHERE {$boardWhere}");
    $stmt->execute($boardParams);
    $studio_stats['board_count'] = (int)$stmt->fetchColumn();
} catch (Throwable $e) {
    $studio_stats['board_count'] = 0;
}

try {
    [$locationWhere, $locationParams] = buildStudioVisibilityWhere('sl', (int)$user_id, 'locations');
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM studio_locations sl WHERE {$locationWhere}");
    $stmt->execute($locationParams);
    $studio_stats['location_count'] = (int)$stmt->fetchColumn();
} catch (Throwable $e) {
    $studio_stats['location_count'] = 0;
}

try {
    [$castWhere, $castParams] = buildStudioVisibilityWhere('va', (int)$user_id, 'virtual_cast');
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM virtual_actors va WHERE {$castWhere}");
    $stmt->execute($castParams);
    $studio_stats['cast_count'] = (int)$stmt->fetchColumn();
} catch (Throwable $e) {
    $studio_stats['cast_count'] = 0;
}

$active_series = [];
try {
    [$seriesWhere, $seriesParams] = buildStudioVisibilityWhere('s', (int)$user_id, 'series');
    $stmt = $pdo->prepare("
        SELECT s.*, 
               COUNT(DISTINCT ss.id) as season_count,
               COUNT(DISTINCT se.id) as episode_count
        FROM series s
        LEFT JOIN series_seasons ss ON ss.series_id = s.id
        LEFT JOIN series_episodes se ON se.season_id = ss.id
        WHERE {$seriesWhere}
        GROUP BY s.id
        ORDER BY s.updated_at DESC
        LIMIT 4
    ");
    $stmt->execute($seriesParams);
    $active_series = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    $active_series = [];
}

$recent_stories = [];
try {
    [$storyWhere, $storyParams] = buildStudioVisibilityWhere('s', (int)$user_id, 'stories');
    $stmt = $pdo->prepare("
        SELECT s.*, ser.title as series_title
        FROM stories s
        LEFT JOIN series ser ON s.series_id = ser.id
        WHERE {$storyWhere}
        ORDER BY s.updated_at DESC, s.created_at DESC
        LIMIT 5
    ");
    $stmt->execute($storyParams);
    $recent_stories = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    $recent_stories = [];
}

$recent_scenes = [];
try {
    [$storyWhere, $storyParams] = buildStudioVisibilityWhere('s', (int)$user_id, 'stories');
    $stmt = $pdo->prepare("
        SELECT sc.scene_id, sc.updated_at, ss.title as scene_title, s.title as story_title
        FROM scene_content sc
        JOIN story_scenes ss ON sc.scene_id = ss.id
        JOIN story_chapters ch ON ss.chapter_id = ch.id
        JOIN story_acts a ON ch.act_id = a.id
        JOIN stories s ON a.story_id = s.id
        WHERE {$storyWhere}
        ORDER BY sc.updated_at DESC
        LIMIT 5
    ");
    $stmt->execute($storyParams);
    $recent_scenes = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    $recent_scenes = [];
}

$idea_boards = [];
try {
    [$boardWhere, $boardParams] = buildStudioVisibilityWhere('ib', (int)$user_id, 'idea_boards');
    $stmt = $pdo->prepare("
        SELECT id, title, updated_at
        FROM idea_boards ib
        WHERE {$boardWhere}
        ORDER BY updated_at DESC
        LIMIT 4
    ");
    $stmt->execute($boardParams);
    $idea_boards = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    $idea_boards = [];
}

$budget_summary = [
    'planned' => 0,
    'approved' => 0,
    'spent' => 0
];
try {
    $stmt = $pdo->prepare("
        SELECT 
            SUM(CASE WHEN i.status = 'planned' THEN i.quantity * i.unit_cost ELSE 0 END) as planned_total,
            SUM(CASE WHEN i.status = 'approved' THEN i.quantity * i.unit_cost ELSE 0 END) as approved_total,
            SUM(CASE WHEN i.status = 'spent' THEN i.quantity * i.unit_cost ELSE 0 END) as spent_total
        FROM film_budget_items i
        JOIN film_budget_categories c ON i.category_id = c.id
        JOIN film_budgets b ON c.budget_id = b.id
        JOIN projects p ON b.project_id = p.id
        WHERE p.user_id = ? AND p.project_type = 'film'
    ");
    $stmt->execute([$user_id]);
    $totals = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $budget_summary['planned'] = (float)($totals['planned_total'] ?? 0);
    $budget_summary['approved'] = (float)($totals['approved_total'] ?? 0);
    $budget_summary['spent'] = (float)($totals['spent_total'] ?? 0);
} catch (Throwable $e) {
    $budget_summary = ['planned' => 0, 'approved' => 0, 'spent' => 0];
}

$project_pulse = [
    'open_tasks' => 0,
    'next_milestone' => null,
    'shots_planned' => 0,
    'shots_blocked' => 0,
    'shots_shot' => 0
];
try {
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM project_tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE p.user_id = ? AND t.status <> 'done'
    ");
    $stmt->execute([$user_id]);
    $project_pulse['open_tasks'] = (int)$stmt->fetchColumn();
} catch (Throwable $e) {
    $project_pulse['open_tasks'] = 0;
}

try {
    $stmt = $pdo->prepare("
        SELECT m.target_date
        FROM project_milestones m
        JOIN projects p ON m.project_id = p.id
        WHERE p.user_id = ? AND m.status <> 'completed' AND m.target_date IS NOT NULL
        ORDER BY m.target_date ASC
        LIMIT 1
    ");
    $stmt->execute([$user_id]);
    $project_pulse['next_milestone'] = $stmt->fetchColumn();
} catch (Throwable $e) {
    $project_pulse['next_milestone'] = null;
}

try {
    $stmt = $pdo->prepare("
        SELECT 
            SUM(CASE WHEN s.status = 'planned' THEN 1 ELSE 0 END) as planned_count,
            SUM(CASE WHEN s.status = 'blocked' THEN 1 ELSE 0 END) as blocked_count,
            SUM(CASE WHEN s.status = 'shot' THEN 1 ELSE 0 END) as shot_count
        FROM project_shots s
        JOIN projects p ON s.project_id = p.id
        WHERE p.user_id = ?
    ");
    $stmt->execute([$user_id]);
    $shotCounts = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
    $project_pulse['shots_planned'] = (int)($shotCounts['planned_count'] ?? 0);
    $project_pulse['shots_blocked'] = (int)($shotCounts['blocked_count'] ?? 0);
    $project_pulse['shots_shot'] = (int)($shotCounts['shot_count'] ?? 0);
} catch (Throwable $e) {
    $project_pulse['shots_planned'] = 0;
    $project_pulse['shots_blocked'] = 0;
    $project_pulse['shots_shot'] = 0;
}

$active_projects = [];
try {
    $stmt = $pdo->prepare("
        SELECT p.*
        FROM projects p
        WHERE p.user_id = ?
        ORDER BY p.updated_at DESC
        LIMIT 5
    ");
    $stmt->execute([$user_id]);
    $active_projects = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    $active_projects = [];
}
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - SocialArena.org</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/dashboard.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>

        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>

            <main class="main-content">
                <div class="studio-hero">
                    <div class="hero-left">
                        <span class="hero-tag">Studio Command</span>
                        <h2>Welcome back, <?php echo htmlspecialchars($display_name); ?></h2>
                        <p>Production hub for AI films, series, scripts, and lore.</p>
                    </div>
                    <div class="hero-right">
                        <div class="studio-actions">
                            <a href="create_universe.php" class="btn">New Universe</a>
                            <a href="create_series.php" class="btn">New Series</a>
                            <a href="create_story.php" class="btn primary-btn">New Film</a>
                            <a href="idea_boards.php" class="btn">Idea Boards</a>
                        </div>
                        <div class="hero-shortcuts">
                            <a class="pill-link" href="writing_center.php">Projects</a>
                            <a class="pill-link" href="music_composer.php">Music Composer</a>
                            <a class="pill-link" href="props.php">Prop Library</a>
                            <a class="pill-link" href="wardrobes.php">Wardrobe</a>
                        </div>
                    </div>
                </div>

                <div class="studio-stats">
                    <div class="stat-card">
                        <span class="stat-icon stat-icon-series"></span>
                        <h3>Series</h3>
                        <span class="stat-number"><?php echo $studio_stats['series_count']; ?></span>
                        <span class="stat-meta">Active productions</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-icon stat-icon-universe"></span>
                        <h3>Universes</h3>
                        <span class="stat-number"><?php echo $studio_stats['universe_count']; ?></span>
                        <span class="stat-meta">Worlds & lore</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-icon stat-icon-scripts"></span>
                        <h3>Scripts</h3>
                        <span class="stat-number"><?php echo $studio_stats['story_count']; ?></span>
                        <span class="stat-meta">Stories in pipeline</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-icon stat-icon-boards"></span>
                        <h3>Idea Boards</h3>
                        <span class="stat-number"><?php echo $studio_stats['board_count']; ?></span>
                        <span class="stat-meta">Visual planning</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-icon stat-icon-locations"></span>
                        <h3>Locations</h3>
                        <span class="stat-number"><?php echo $studio_stats['location_count']; ?></span>
                        <span class="stat-meta">Sets & scouting</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-icon stat-icon-cast"></span>
                        <h3>Cast</h3>
                        <span class="stat-number"><?php echo $studio_stats['cast_count']; ?></span>
                        <span class="stat-meta">Virtual performers</span>
                    </div>
                </div>

                <div class="studio-grid">
                    <section class="studio-panel">
                        <div class="panel-header">
                            <h3>Budget Snapshot</h3>
                            <a class="btn" href="writing_center.php">Open Films</a>
                        </div>
                        <div class="budget-snapshot">
                            <div>
                                <span>Planned</span>
                                <strong>$<?php echo number_format($budget_summary['planned'], 2); ?></strong>
                            </div>
                            <div>
                                <span>Approved</span>
                                <strong>$<?php echo number_format($budget_summary['approved'], 2); ?></strong>
                            </div>
                            <div>
                                <span>Spent</span>
                                <strong>$<?php echo number_format($budget_summary['spent'], 2); ?></strong>
                            </div>
                        </div>
                        <p class="muted">Totals across all film budgets.</p>
                    </section>

                    <section class="studio-panel">
                        <div class="panel-header">
                            <h3>Project Pulse</h3>
                            <a class="btn" href="writing_center.php">Open Projects</a>
                        </div>
                        <div class="pulse-grid">
                            <div>
                                <span>Open tasks</span>
                                <strong><?php echo $project_pulse['open_tasks']; ?></strong>
                            </div>
                            <div>
                                <span>Next milestone</span>
                                <strong><?php echo $project_pulse['next_milestone'] ? date('M j, Y', strtotime($project_pulse['next_milestone'])) : 'None'; ?></strong>
                            </div>
                            <div>
                                <span>Shots</span>
                                <strong><?php echo $project_pulse['shots_planned']; ?> planned | <?php echo $project_pulse['shots_blocked']; ?> blocked | <?php echo $project_pulse['shots_shot']; ?> shot</strong>
                            </div>
                        </div>
                    </section>

                    <section class="studio-panel">
                        <div class="panel-header">
                            <h3>Active Projects</h3>
                            <a class="btn" href="writing_center.php">View All</a>
                        </div>
                        <?php if (empty($active_projects)): ?>
                            <p class="empty-state">No projects yet. Create a film or episode to start production.</p>
                        <?php else: ?>
                            <div class="panel-list">
                                <?php foreach ($active_projects as $project): ?>
                                    <div class="panel-item">
                                        <div>
                                            <strong><?php echo htmlspecialchars($project['title']); ?></strong>
                                            <div class="muted"><?php echo htmlspecialchars(ucfirst($project['project_type'])); ?> | <?php echo htmlspecialchars($project['status']); ?></div>
                                        </div>
                                        <div class="panel-actions">
                                            <a class="btn" href="project.php?id=<?php echo (int)$project['id']; ?>">Project</a>
                                            <?php if ($project['project_type'] === 'film'): ?>
                                                <a class="btn" href="budget.php?project_id=<?php echo (int)$project['id']; ?>">Budget</a>
                                            <?php endif; ?>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>
                    </section>
                    <section class="studio-panel">
                        <div class="panel-header">
                            <h3>Active Series</h3>
                            <a class="btn" href="writing_center.php">View All</a>
                        </div>
                        <?php if (empty($active_series)): ?>
                            <p class="empty-state">No series yet. Start with a new series to plan seasons.</p>
                        <?php else: ?>
                            <div class="panel-list">
                                <?php foreach ($active_series as $series): ?>
                                    <div class="panel-item">
                                        <div>
                                            <strong><?php echo htmlspecialchars($series['title']); ?></strong>
                                            <div class="muted">
                                                <?php echo (int)$series['season_count']; ?> seasons | <?php echo (int)$series['episode_count']; ?> episodes
                                            </div>
                                        </div>
                                        <div class="panel-actions">
                                            <a class="btn" href="series_planner.php?id=<?php echo (int)$series['id']; ?>">Planner</a>
                                            <a class="btn" href="series_codex.php?series_id=<?php echo (int)$series['id']; ?>">Codex</a>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>
                    </section>

                    <section class="studio-panel">
                        <div class="panel-header">
                            <h3>Recent Script Work</h3>
                            <a class="btn" href="writing_center.php">Open Scripts</a>
                        </div>
                        <?php if (empty($recent_stories)): ?>
                            <p class="empty-state">No scripts yet. Create a script to start drafting.</p>
                        <?php else: ?>
                            <div class="panel-list">
                                <?php foreach ($recent_stories as $story): ?>
                                    <div class="panel-item">
                                        <div>
                                            <strong><?php echo htmlspecialchars($story['title']); ?></strong>
                                            <div class="muted">
                                                <?php echo htmlspecialchars(ucfirst($story['status'] ?? 'draft')); ?>
                                                <?php if (!empty($story['series_title'])): ?>
                                                    | <?php echo htmlspecialchars($story['series_title']); ?>
                                                <?php endif; ?>
                                            </div>
                                        </div>
                                        <div class="panel-actions">
                                            <a class="btn" href="story_planner.php?id=<?php echo (int)$story['id']; ?>">Planner</a>
                                            <a class="btn" href="write_story.php?id=<?php echo (int)$story['id']; ?>">Write</a>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>
                    </section>

                    <section class="studio-panel">
                        <div class="panel-header">
                            <h3>Latest Scene Edits</h3>
                        </div>
                        <?php if (empty($recent_scenes)): ?>
                            <p class="empty-state">No scene edits yet.</p>
                        <?php else: ?>
                            <div class="panel-list">
                                <?php foreach ($recent_scenes as $scene): ?>
                                    <div class="panel-item">
                                        <div>
                                            <strong><?php echo htmlspecialchars($scene['scene_title'] ?? 'Untitled Scene'); ?></strong>
                                            <div class="muted"><?php echo htmlspecialchars($scene['story_title']); ?></div>
                                        </div>
                                        <div class="panel-actions">
                                            <a class="btn" href="write_scene.php?scene_id=<?php echo (int)$scene['scene_id']; ?>">Open</a>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>
                    </section>

                    <section class="studio-panel">
                        <div class="panel-header">
                            <h3>Idea Boards</h3>
                            <a class="btn" href="idea_boards.php">View All</a>
                        </div>
                        <?php if (empty($idea_boards)): ?>
                            <p class="empty-state">No boards yet. Capture ideas and visual references here.</p>
                        <?php else: ?>
                            <div class="panel-list">
                                <?php foreach ($idea_boards as $board): ?>
                                    <div class="panel-item">
                                        <div>
                                            <strong><?php echo htmlspecialchars($board['title']); ?></strong>
                                            <div class="muted">Updated <?php echo date('M j, Y', strtotime($board['updated_at'])); ?></div>
                                        </div>
                                        <div class="panel-actions">
                                            <a class="btn" href="idea_board.php?id=<?php echo (int)$board['id']; ?>">Open</a>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>
                    </section>
                </div>
            </main>
        </div>

        <?php include 'includes/footer.php'; ?>
    </div>
</body>
</html> 
