<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$theme = $_SESSION['theme'] ?? 'light';
$series_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

if ($series_id === 0) {
    header('Location: writing_center.php');
    exit;
}

$stmt = $pdo->prepare("
    SELECT s.*, u.title as universe_title
    FROM series s
    LEFT JOIN universes u ON s.universe_id = u.id
    WHERE s.id = ?
");
$stmt->execute([$series_id]);
$series = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$series) {
    header('Location: writing_center.php');
    exit;
}

try {
    enforceSeriesAccess($pdo, $series_id, (int)$_SESSION['user_id'], false);
} catch (Exception $e) {
    header('Location: writing_center.php');
    exit;
}

$userId = (int)$_SESSION['user_id'];
[$storyWhere, $storyParams] = buildStudioVisibilityWhere('st', $userId, 'stories');
$stmt = $pdo->prepare("
    SELECT st.id, st.title, st.status, st.story_order, st.created_at
    FROM stories st
    WHERE st.series_id = ? AND {$storyWhere}
    ORDER BY ISNULL(st.story_order), st.story_order, st.created_at
");
$stmt->execute(array_merge([$series_id], $storyParams));
$stories = $stmt->fetchAll(PDO::FETCH_ASSOC);

[$actorWhere, $actorParams] = buildStudioVisibilityWhere('va', $userId, 'virtual_cast');
$stmt = $pdo->prepare("SELECT va.* FROM virtual_actors va WHERE {$actorWhere} ORDER BY va.name ASC");
$stmt->execute($actorParams);
$actors = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare("
    SELECT sc.*, va.name as actor_name
    FROM series_cast sc
    JOIN virtual_actors va ON sc.actor_id = va.id
    WHERE sc.series_id = ?
    ORDER BY va.name ASC
");
$stmt->execute([$series_id]);
$cast = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare("
    SELECT id, title, season_number, description
    FROM series_seasons
    WHERE series_id = ?
    ORDER BY season_number ASC, id ASC
");
$stmt->execute([$series_id]);
$seasons = $stmt->fetchAll(PDO::FETCH_ASSOC);

$seasonIds = array_column($seasons, 'id');
$episodesBySeason = [];
if (!empty($seasonIds)) {
    $placeholders = implode(',', array_fill(0, count($seasonIds), '?'));
    $stmt = $pdo->prepare("
        SELECT e.*, s.season_number
        FROM series_episodes e
        JOIN series_seasons s ON e.season_id = s.id
        WHERE e.season_id IN ($placeholders)
        ORDER BY s.season_number ASC, e.episode_number ASC, e.id ASC
    ");
    $stmt->execute($seasonIds);
    $episodes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($episodes as $episode) {
        $episodesBySeason[$episode['season_id']][] = $episode;
    }
}
?>
<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Series Planner - <?php echo htmlspecialchars($series['title']); ?></title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/story_planner.css">
    <link rel="stylesheet" href="css/series_planner.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>

        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>

            <main class="main-content">
                <div class="planner-header">
                    <h1><?php echo htmlspecialchars($series['title']); ?></h1>
                    <div class="planner-actions">
                        <a href="series_codex.php?series_id=<?php echo $series_id; ?>" class="btn">
                            <i class="fas fa-book"></i> Series Codex
                        </a>
                        <a href="create_story.php?series_id=<?php echo $series_id; ?>" class="btn primary-btn">
                            <i class="fas fa-plus"></i> Add Story
                        </a>
                    </div>
                </div>

                <div class="series-meta">
                    <div>
                        <strong>Status:</strong> <?php echo htmlspecialchars(ucfirst($series['status'])); ?>
                    </div>
                    <?php if (!empty($series['universe_title'])): ?>
                        <div>
                            <strong>Universe:</strong> <?php echo htmlspecialchars($series['universe_title']); ?>
                        </div>
                    <?php endif; ?>
                    <div class="series-actions">
                        <a href="series.php?id=<?php echo $series_id; ?>" class="btn">Back to Series</a>
                        <a href="edit_series.php?id=<?php echo $series_id; ?>" class="btn">Edit Series</a>
                    </div>
                </div>

                <section class="series-overview">
                    <h2>Series Overview</h2>
                    <p><?php echo htmlspecialchars($series['description'] ?? 'No series description yet.'); ?></p>
                </section>

                <section class="series-cast">
                    <div class="section-header">
                        <h2>Series Cast</h2>
                        <div class="cast-controls">
                            <select id="cast-actor">
                                <option value="">Select actor</option>
                                <?php foreach ($actors as $actor): ?>
                                    <option value="<?php echo (int)$actor['id']; ?>"><?php echo htmlspecialchars($actor['name']); ?></option>
                                <?php endforeach; ?>
                            </select>
                            <input type="text" id="cast-role" placeholder="Role name">
                            <button class="btn" onclick="addCastMember(<?php echo $series_id; ?>)">Add</button>
                        </div>
                    </div>
                    <?php if (empty($cast)): ?>
                        <div class="empty-state">No cast assigned yet.</div>
                    <?php else: ?>
                        <div class="cast-list">
                            <?php foreach ($cast as $member): ?>
                                <div class="cast-item">
                                    <div>
                                        <strong><?php echo htmlspecialchars($member['actor_name']); ?></strong>
                                        <?php if (!empty($member['role_name'])): ?>
                                            <span class="muted">as <?php echo htmlspecialchars($member['role_name']); ?></span>
                                        <?php endif; ?>
                                    </div>
                                    <button class="btn danger" onclick="removeCastMember(<?php echo (int)$member['id']; ?>)">Remove</button>
                                </div>
                            <?php endforeach; ?>
                        </div>
                    <?php endif; ?>
                </section>

                <section class="series-seasons">
                    <div class="section-header">
                        <h2>Seasons & Episodes</h2>
                        <button class="btn primary-btn" onclick="addSeason(<?php echo $series_id; ?>)">
                            <i class="fas fa-plus"></i> Add Season
                        </button>
                    </div>
                    <div class="seasons-list" id="seasons-list">
                        <?php if (empty($seasons)): ?>
                            <div class="empty-state">No seasons yet. Add one to start structuring episodes.</div>
                        <?php else: ?>
                            <?php foreach ($seasons as $season): ?>
                                <div class="season-card" data-season-id="<?php echo (int)$season['id']; ?>">
                                    <div class="season-header">
                                        <div>
                                            <span class="season-label">Season <?php echo (int)$season['season_number']; ?></span>
                                            <input class="season-title" value="<?php echo htmlspecialchars($season['title']); ?>" onchange="updateSeasonTitle(<?php echo (int)$season['id']; ?>, this.value)">
                                        </div>
                                        <div class="season-actions">
                                            <a class="btn" href="planner_chat.php?season_id=<?php echo (int)$season['id']; ?>">
                                                <i class="fas fa-comments"></i> Season Chat
                                            </a>
                                            <button class="btn" onclick="addEpisode(<?php echo (int)$season['id']; ?>)">
                                                <i class="fas fa-plus"></i> Add Episode
                                            </button>
                                        </div>
                                    </div>
                                    <?php if (!empty($season['description'])): ?>
                                        <p class="season-description"><?php echo htmlspecialchars($season['description']); ?></p>
                                    <?php endif; ?>
                                    <div class="episodes-list">
                                        <?php $episodes = $episodesBySeason[$season['id']] ?? []; ?>
                                        <?php if (empty($episodes)): ?>
                                            <div class="empty-state small">No episodes yet.</div>
                                        <?php else: ?>
                                            <?php foreach ($episodes as $episode): ?>
                                                <div class="episode-card" data-episode-id="<?php echo (int)$episode['id']; ?>">
                                                    <div class="episode-header">
                                                        <span class="episode-number">Ep <?php echo (int)$episode['episode_number']; ?></span>
                                                        <input class="episode-title" value="<?php echo htmlspecialchars($episode['title']); ?>" onchange="updateEpisodeTitle(<?php echo (int)$episode['id']; ?>, this.value)">
                                                        <a class="btn" href="planner_chat.php?episode_id=<?php echo (int)$episode['id']; ?>">
                                                            <i class="fas fa-comments"></i>
                                                        </a>
                                                        <a class="btn" href="project.php?episode_id=<?php echo (int)$episode['id']; ?>">
                                                            <i class="fas fa-clipboard-list"></i>
                                                        </a>
                                                    </div>
                                                    <?php if (!empty($episode['description'])): ?>
                                                        <p class="episode-description"><?php echo htmlspecialchars($episode['description']); ?></p>
                                                    <?php endif; ?>
                                                    <div class="episode-story">
                                                        <label>Assigned Story</label>
                                                        <select onchange="assignEpisodeStory(<?php echo (int)$episode['id']; ?>, this.value)">
                                                            <option value="">Not assigned</option>
                                                            <?php foreach ($stories as $story): ?>
                                                                <option value="<?php echo (int)$story['id']; ?>" <?php echo ((int)$episode['story_id'] === (int)$story['id']) ? 'selected' : ''; ?>>
                                                                    <?php echo htmlspecialchars($story['title']); ?>
                                                                </option>
                                                            <?php endforeach; ?>
                                                        </select>
                                                    </div>
                                                </div>
                                            <?php endforeach; ?>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </section>

                <section class="series-stories">
                    <div class="section-header">
                        <h2>Story Order</h2>
                        <span class="helper-text">Drag stories to set the series order.</span>
                    </div>
                    <div class="stories-list" id="series-stories">
                        <?php if (empty($stories)): ?>
                            <div class="empty-state">No stories yet. Add one to start planning.</div>
                        <?php else: ?>
                            <?php foreach ($stories as $story): ?>
                                <div class="series-story-card" data-id="<?php echo (int)$story['id']; ?>">
                                    <div class="story-drag">
                                        <i class="fas fa-grip-lines"></i>
                                    </div>
                                    <div class="story-info">
                                        <h3><?php echo htmlspecialchars($story['title']); ?></h3>
                                        <span class="status-pill <?php echo strtolower($story['status']); ?>">
                                            <?php echo htmlspecialchars(ucfirst($story['status'])); ?>
                                        </span>
                                    </div>
                                    <div class="story-actions">
                                        <a href="story_planner.php?id=<?php echo (int)$story['id']; ?>" class="btn">Planner</a>
                                        <a href="write_story.php?id=<?php echo (int)$story['id']; ?>" class="btn">Write</a>
                                        <a href="edit_story.php?id=<?php echo (int)$story['id']; ?>" class="btn">Edit</a>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </section>
            </main>
        </div>

        <?php include 'includes/footer.php'; ?>
    </div>

    <script src="js/series_planner.js"></script>
</body>
</html>
