<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$story_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$season_id = isset($_GET['season_id']) ? (int)$_GET['season_id'] : 0;
$episode_id = isset($_GET['episode_id']) ? (int)$_GET['episode_id'] : 0;

$context = [
    'scope' => 'story',
    'chat_key' => '',
    'title' => '',
    'subtitle' => '',
    'genre' => '',
    'setting' => '',
    'main_character' => '',
    'description' => '',
    'series_title' => '',
    'universe_title' => '',
    'outline' => ''
];

if ($episode_id > 0) {
    $stmt = $pdo->prepare("
        SELECT e.*, s.title as series_title, ss.title as season_title, ss.season_number
        FROM series_episodes e
        JOIN series_seasons ss ON e.season_id = ss.id
        JOIN series s ON ss.series_id = s.id
        WHERE e.id = ?
    ");
    $stmt->execute([$episode_id]);
    $episode = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$episode) {
        header('Location: writing_center.php');
        exit;
    }
    try {
        enforceSeriesAccess($pdo, (int)$episode['series_id'], (int)$_SESSION['user_id'], false);
    } catch (Exception $e) {
        header('Location: writing_center.php');
        exit;
    }

    $context['scope'] = 'episode';
    $context['chat_key'] = 'episode_' . $episode_id;
    $context['title'] = $episode['title'];
    $context['subtitle'] = 'Season ' . $episode['season_number'] . ' • ' . $episode['season_title'];
    $context['series_title'] = $episode['series_title'];
    $context['description'] = $episode['description'] ?? '';

    $stmt = $pdo->prepare("
        SELECT title, episode_number, description
        FROM series_episodes
        WHERE season_id = ?
        ORDER BY episode_number ASC, id ASC
    ");
    $stmt->execute([$episode['season_id']]);
    $episodes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $outline_lines = [];
    foreach ($episodes as $row) {
        $outline_lines[] = 'Ep ' . $row['episode_number'] . ': ' . $row['title'];
    }
    $context['outline'] = implode("\n", $outline_lines);

    if (!empty($episode['story_id'])) {
        $stmt = $pdo->prepare("
            SELECT s.*, ser.title as series_title, uni.title as universe_title
            FROM stories s
            LEFT JOIN series ser ON s.series_id = ser.id
            LEFT JOIN universes uni ON s.universe_id = uni.id
            WHERE s.id = ?
        ");
        $stmt->execute([(int)$episode['story_id']]);
        $story = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($story) {
            try {
                enforceStoryAccess($pdo, (int)$episode['story_id'], (int)$_SESSION['user_id'], false);
            } catch (Exception $e) {
                $story = null;
            }
        }
        if ($story) {
            $context['genre'] = $story['genre'] ?? '';
            $context['setting'] = $story['setting'] ?? '';
            $context['main_character'] = $story['main_character'] ?? '';
            $context['description'] = $context['description'] ?: ($story['description'] ?? '');
            $context['series_title'] = $story['series_title'] ?? $context['series_title'];
            $context['universe_title'] = $story['universe_title'] ?? '';
        }
    }
} elseif ($season_id > 0) {
    $stmt = $pdo->prepare("
        SELECT ss.*, s.title as series_title
        FROM series_seasons ss
        JOIN series s ON ss.series_id = s.id
        WHERE ss.id = ?
    ");
    $stmt->execute([$season_id]);
    $season = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$season) {
        header('Location: writing_center.php');
        exit;
    }
    try {
        enforceSeriesAccess($pdo, (int)$season['series_id'], (int)$_SESSION['user_id'], false);
    } catch (Exception $e) {
        header('Location: writing_center.php');
        exit;
    }

    $context['scope'] = 'season';
    $context['chat_key'] = 'season_' . $season_id;
    $context['title'] = $season['title'];
    $context['subtitle'] = 'Season ' . $season['season_number'] . ' • ' . $season['series_title'];
    $context['series_title'] = $season['series_title'];
    $context['description'] = $season['description'] ?? '';

    $stmt = $pdo->prepare("
        SELECT title, episode_number, description
        FROM series_episodes
        WHERE season_id = ?
        ORDER BY episode_number ASC, id ASC
    ");
    $stmt->execute([$season_id]);
    $episodes = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $outline_lines = [];
    foreach ($episodes as $row) {
        $outline_lines[] = 'Ep ' . $row['episode_number'] . ': ' . $row['title'];
    }
    $context['outline'] = implode("\n", $outline_lines);
} elseif ($story_id > 0) {
    $stmt = $pdo->prepare("
        SELECT s.*, u.username as author_name, ser.title as series_title, uni.title as universe_title
        FROM stories s
        LEFT JOIN users u ON s.created_by = u.id
        LEFT JOIN series ser ON s.series_id = ser.id
        LEFT JOIN universes uni ON s.universe_id = uni.id
        WHERE s.id = ?
    ");
    $stmt->execute([$story_id]);
    $story = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$story) {
        header('Location: writing_center.php');
        exit;
    }
    try {
        enforceStoryAccess($pdo, $story_id, (int)$_SESSION['user_id'], false);
    } catch (Exception $e) {
        header('Location: writing_center.php');
        exit;
    }

    $context['scope'] = 'story';
    $context['chat_key'] = 'story_' . $story_id;
    $context['title'] = $story['title'];
    $context['subtitle'] = 'Story Planner';
    $context['genre'] = $story['genre'] ?? '';
    $context['setting'] = $story['setting'] ?? '';
    $context['main_character'] = $story['main_character'] ?? '';
    $context['description'] = $story['description'] ?? '';
    $context['series_title'] = $story['series_title'] ?? '';
    $context['universe_title'] = $story['universe_title'] ?? '';

    $stmt = $pdo->prepare("
        SELECT a.title as act_title, c.title as chapter_title, sc.title as scene_title
        FROM story_acts a
        LEFT JOIN story_chapters c ON a.id = c.act_id
        LEFT JOIN story_scenes sc ON c.id = sc.chapter_id
        WHERE a.story_id = ?
        ORDER BY a.act_order, c.chapter_order, sc.scene_order
    ");
    $stmt->execute([$story_id]);
    $outline_rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $outline_lines = [];
    foreach ($outline_rows as $row) {
        $act = $row['act_title'] ?: 'Untitled Act';
        $chapter = $row['chapter_title'] ?: 'Untitled Chapter';
        $scene = $row['scene_title'] ?: 'Untitled Scene';
        $outline_lines[] = $act . ' > ' . $chapter . ' > ' . $scene;
    }
    $context['outline'] = implode("\n", array_unique($outline_lines));
} else {
    header('Location: writing_center.php');
    exit;
}

$page_title = "Planner Chat - " . htmlspecialchars($context['title']);
$additional_css = ['css/planner_chat.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <?php
            $backSeriesId = 0;
            if (isset($season) && !empty($season['series_id'])) {
                $backSeriesId = (int)$season['series_id'];
            } elseif (isset($episode) && !empty($episode['series_id'])) {
                $backSeriesId = (int)$episode['series_id'];
            }
            ?>
            <div class="planner-chat-header">
                <div class="planner-chat-title">
                    <h1><?php echo htmlspecialchars(ucfirst($context['scope'])); ?> Planner Chat</h1>
                    <p><?php echo htmlspecialchars($context['title']); ?></p>
                </div>
                <div class="planner-chat-actions">
                    <?php if ($context['scope'] === 'story'): ?>
                        <a href="story_planner.php?id=<?php echo $story_id; ?>" class="btn">
                            <i class="fas fa-arrow-left"></i> Back to Planner
                        </a>
                    <?php else: ?>
                        <a href="series_planner.php?id=<?php echo (int)$backSeriesId; ?>" class="btn">
                            <i class="fas fa-arrow-left"></i> Back to Series Planner
                        </a>
                    <?php endif; ?>
                </div>
            </div>

            <div class="planner-chat-layout" data-story-id="<?php echo (int)$story_id; ?>">
                <section class="planner-chat-panel">
                    <div class="planner-chat-messages" id="planner-chat-messages"></div>
                    <div class="planner-chat-input">
                        <textarea id="planner-chat-input" placeholder="Ask for ideas, structure, conflicts, or next steps..." rows="3"></textarea>
                        <button id="planner-chat-send" class="btn primary-btn">
                            <i class="fas fa-paper-plane"></i> Send
                        </button>
                    </div>
                </section>
                <aside class="planner-chat-context">
                    <div class="context-card">
                        <h3>Context</h3>
                        <?php if (!empty($context['subtitle'])): ?>
                            <div class="context-line"><strong>Scope:</strong> <?php echo htmlspecialchars($context['subtitle']); ?></div>
                        <?php endif; ?>
                        <?php if (!empty($context['genre'])): ?>
                            <div class="context-line"><strong>Genre:</strong> <?php echo htmlspecialchars($context['genre']); ?></div>
                        <?php endif; ?>
                        <?php if (!empty($context['setting'])): ?>
                            <div class="context-line"><strong>Setting:</strong> <?php echo htmlspecialchars($context['setting']); ?></div>
                        <?php endif; ?>
                        <?php if (!empty($context['main_character'])): ?>
                            <div class="context-line"><strong>Main Character:</strong> <?php echo htmlspecialchars($context['main_character']); ?></div>
                        <?php endif; ?>
                        <?php if (!empty($context['description'])): ?>
                            <div class="context-line"><strong>Description:</strong> <?php echo htmlspecialchars($context['description']); ?></div>
                        <?php endif; ?>
                        <?php if (!empty($context['series_title'])): ?>
                            <div class="context-line"><strong>Series:</strong> <?php echo htmlspecialchars($context['series_title']); ?></div>
                        <?php endif; ?>
                        <?php if (!empty($context['universe_title'])): ?>
                            <div class="context-line"><strong>Universe:</strong> <?php echo htmlspecialchars($context['universe_title']); ?></div>
                        <?php endif; ?>
                    </div>
                    <div class="context-card">
                        <h3>Current Outline</h3>
                        <pre class="outline-preview"><?php echo htmlspecialchars($context['outline'] ?: 'No outline yet.'); ?></pre>
                    </div>
                </aside>
            </div>
        </main>
    </div>
</div>

<script>
window.plannerChatContext = {
    scope: <?php echo json_encode($context['scope']); ?>,
    chatKey: <?php echo json_encode($context['chat_key']); ?>,
    storyId: <?php echo (int)$story_id; ?>,
    seasonId: <?php echo (int)$season_id; ?>,
    episodeId: <?php echo (int)$episode_id; ?>,
    storyTitle: <?php echo json_encode($context['title']); ?>,
    genre: <?php echo json_encode($context['genre']); ?>,
    setting: <?php echo json_encode($context['setting']); ?>,
    mainCharacter: <?php echo json_encode($context['main_character']); ?>,
    description: <?php echo json_encode($context['description']); ?>,
    seriesTitle: <?php echo json_encode($context['series_title']); ?>,
    universeTitle: <?php echo json_encode($context['universe_title']); ?>,
    outline: <?php echo json_encode($context['outline']); ?>
};
</script>
<script src="js/planner_chat.js"></script>
