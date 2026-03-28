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

// Check if story ID is provided
if (!isset($_GET['id'])) {
    header('Location: writing_center.php');
    exit;
}

$story_id = (int)$_GET['id'];
$theme = $_SESSION['theme'] ?? 'light';

// Get story details
$stmt = $pdo->prepare("
    SELECT s.*, u.username as author_name 
    FROM stories s
    LEFT JOIN users u ON s.created_by = u.id
    WHERE s.id = ?
");
$stmt->execute([$story_id]);
$story = $stmt->fetch();

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

// Get story structure
$stmt = $pdo->prepare("
    SELECT 
        a.id as act_id, 
        a.title as act_title,
        a.act_order,
        c.id as chapter_id,
        c.title as chapter_title,
        c.chapter_order,
        c.word_count as chapter_words,
        s.id as scene_id,
        s.title as scene_title,
        s.description as scene_description,
        s.scene_order,
        s.word_count as scene_words,
        scp.id as clip_id,
        scp.title as clip_title,
        scp.description as clip_description,
        scp.clip_order,
        (SELECT cb.image_url FROM clip_blocks cb WHERE cb.clip_id = scp.id AND cb.block_type = 'image' AND cb.image_url IS NOT NULL ORDER BY cb.sort_order ASC, cb.id ASC LIMIT 1) as clip_image_url
    FROM story_acts a
    LEFT JOIN story_chapters c ON a.id = c.act_id
    LEFT JOIN story_scenes s ON c.id = s.chapter_id
    LEFT JOIN story_scene_clips scp ON s.id = scp.scene_id
    WHERE a.story_id = ?
    ORDER BY a.act_order, c.chapter_order, s.scene_order, scp.clip_order
");
$stmt->execute([$story_id]);
$structure = $stmt->fetchAll();


$stmt = $pdo->prepare("
    SELECT COUNT(*) AS clip_count
    FROM story_scene_clips scp
    JOIN story_scenes ss ON scp.scene_id = ss.id
    JOIN story_chapters sc ON ss.chapter_id = sc.id
    JOIN story_acts sa ON sc.act_id = sa.id
    WHERE sa.story_id = ?
");
$stmt->execute([$story_id]);
$clip_totals = $stmt->fetch(PDO::FETCH_ASSOC);
$clip_count = (int)($clip_totals['clip_count'] ?? 0);
$episode_seconds = $clip_count * 10;
$episode_minutes = floor($episode_seconds / 60);
$episode_remaining = $episode_seconds % 60;
$episode_duration = sprintf('%d:%02d', $episode_minutes, $episode_remaining);


// Organize the data into a hierarchical structure
$acts = [];
foreach ($structure as $row) {
    if (!isset($acts[$row['act_id']])) {
        $acts[$row['act_id']] = [
            'id' => $row['act_id'],
            'title' => $row['act_title'],
            'order' => $row['act_order'],
            'chapters' => []
        ];
    }
    if ($row['chapter_id'] && !isset($acts[$row['act_id']]['chapters'][$row['chapter_id']])) {
        $acts[$row['act_id']]['chapters'][$row['chapter_id']] = [
            'id' => $row['chapter_id'],
            'title' => $row['chapter_title'],
            'order' => $row['chapter_order'],
            'word_count' => $row['chapter_words'],
            'scenes' => []
        ];
    }
    if ($row['scene_id']) {
        if (!isset($acts[$row['act_id']]['chapters'][$row['chapter_id']]['scenes'][$row['scene_id']])) {
            $acts[$row['act_id']]['chapters'][$row['chapter_id']]['scenes'][$row['scene_id']] = [
                'id' => $row['scene_id'],
                'title' => $row['scene_title'],
                'description' => $row['scene_description'],
                'order' => $row['scene_order'],
                'word_count' => $row['scene_words'],
                'clips' => []
            ];
        }
        if (!empty($row['clip_id'])) {
            $acts[$row['act_id']]['chapters'][$row['chapter_id']]['scenes'][$row['scene_id']]['clips'][] = [
                'id' => $row['clip_id'],
                'title' => $row['clip_title'],
                'description' => $row['clip_description'],
                'order' => $row['clip_order'],
                'image_url' => $row['clip_image_url']
            ];
        }
    }
}
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Story Planner - <?php echo htmlspecialchars($story['title']); ?></title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/story_planner.css">
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
                    <div class="planner-hero">
                        <div class="planner-title">
                            <div class="planner-label">Episode Workspace</div>
                            <h1><?php echo htmlspecialchars($story['title']); ?></h1>
                            <p class="planner-description"><?php echo htmlspecialchars($story['description'] ?? ''); ?></p>
                            <div class="planner-meta">
                                <span><i class="fas fa-film"></i> <?php echo $clip_count; ?> clips</span>
                                <span><i class="fas fa-clock"></i> <?php echo $episode_duration; ?> min</span>
                                <span><i class="fas fa-images"></i> Starting images</span>
                                <span><i class="fas fa-play"></i> Clip renders</span>
                            </div>
                        </div>
                        <div class="planner-hero-actions">
                            <a href="story_codex.php?story_id=<?php echo $story_id; ?>" class="btn">
                                <i class="fas fa-book"></i> Story Codex
                            </a>
                            <a href="project.php?story_id=<?php echo $story_id; ?>" class="btn">
                                <i class="fas fa-clipboard-list"></i> Project Board
                            </a>
                            <a href="budget.php?story_id=<?php echo $story_id; ?>" class="btn">
                                <i class="fas fa-coins"></i> Film Budget
                            </a>
                            <a href="timeline_planner.php?story_id=<?php echo $story_id; ?>" class="btn">
                                <i class="fas fa-film"></i> Timeline Planner
                            </a>
                            <a href="planner_chat.php?id=<?php echo $story_id; ?>" class="btn">
                                <i class="fas fa-comments"></i> Planner Chat
                            </a>
                            <button type="button" class="btn secondary-btn" id="batch-starting-images">
                                <i class="fas fa-image"></i> Generate Starting Images
                            </button>
                            <button type="button" class="btn secondary-btn" id="batch-generate-clips">
                                <i class="fas fa-play"></i> Generate Clips
                            </button>
                            <button onclick="addAct()" class="btn primary-btn">
                                <i class="fas fa-plus"></i> New Act
                            </button>
                        </div>
                    </div>
                    <div class="planner-pipeline">
                        <div class="pipeline-step active">
                            <span>Plan Episode</span>
                            <small>Acts → Scenes</small>
                        </div>
                        <div class="pipeline-step">
                            <span>Compose Clips</span>
                            <small>Blocks + notes</small>
                        </div>
                        <div class="pipeline-step">
                            <span>Generate Images</span>
                            <small>Starting frames</small>
                        </div>
                        <div class="pipeline-step">
                            <span>Generate Clips</span>
                            <small>LTX‑2 output</small>
                        </div>
                        <div class="pipeline-step">
                            <span>Release</span>
                            <small>Publish media</small>
                        </div>
                    </div>
                </div>

                <div class="story-structure" id="story-structure">
                    <?php foreach ($acts as $act): ?>
                        <div class="act" data-id="<?php echo $act['id']; ?>">
                            <div class="act-header">
                                <div class="act-toggle">
                                    <i class="fas fa-chevron-down"></i>
                                </div>
                                <h2 class="act-title" contenteditable="true">
                                    <?php echo htmlspecialchars($act['title']); ?>
                                </h2>
                                <div class="act-actions">
                                    <button onclick="addChapter(<?php echo $act['id']; ?>)" class="btn">
                                        <i class="fas fa-plus"></i> Chapter
                                    </button>
                                    <button onclick="deleteAct(<?php echo $act['id']; ?>)" class="btn danger">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>

                            <div class="chapters-list" data-act-id="<?php echo $act['id']; ?>">
                                <?php foreach ($act['chapters'] as $chapter): ?>
                                    <div class="chapter" data-id="<?php echo $chapter['id']; ?>">
                                        <div class="chapter-header">
                                            <div class="chapter-toggle">
                                                <i class="fas fa-chevron-right"></i>
                                            </div>
                                            <h3 class="chapter-title" contenteditable="true">
                                                <?php echo htmlspecialchars($chapter['title']); ?>
                                            </h3>
                                            <span class="word-count"><?php echo $chapter['word_count']; ?> words</span>
                                            <div class="chapter-actions">
                                                <button onclick="addScene(<?php echo $chapter['id']; ?>)" class="btn">
                                                    <i class="fas fa-plus"></i> Scene
                                                </button>
                                                <button onclick="deleteChapter(<?php echo $chapter['id']; ?>)" class="btn danger">
                                                    <i class="fas fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>

                                        <div class="scenes-list" data-chapter-id="<?php echo $chapter['id']; ?>">
                                            <?php foreach ($chapter['scenes'] as $scene): ?>
                                                <div class="scene" data-id="<?php echo $scene['id']; ?>">
                                                    <div class="scene-header">
                                                        <h4 class="scene-title" contenteditable="true">
                                                            <?php echo htmlspecialchars($scene['title'] ?: 'Untitled Scene'); ?>
                                                        </h4>
                                                        <button class="btn scene-desc-toggle" onclick="toggleDescription(<?php echo $scene['id']; ?>)">
                                                            <i class="fas fa-align-left"></i> Description
                                                        </button>
                                                        <span class="word-count"><?php echo $scene['word_count']; ?> words</span>
                                                        <div class="scene-actions">
                                                            <button onclick="toggleDescription(<?php echo $scene['id']; ?>)" class="btn">
                                                                <i class="fas fa-bars"></i>
                                                            </button>
                                                            <button onclick="window.location.href='screenplay_editor.php?scene_id=<?php echo $scene['id']; ?>'" class="btn">
                                                                <i class="fas fa-pen-nib"></i>
                                                            </button>
                                                            <button onclick="addClip(<?php echo $scene['id']; ?>)" class="btn">
                                                                <i class="fas fa-film"></i>
                                                            </button>
                                                            <button onclick="editScene(<?php echo $scene['id']; ?>)" class="btn">
                                                                <i class="fas fa-edit"></i>
                                                            </button>
                                                            <button onclick="deleteScene(<?php echo $scene['id']; ?>)" class="btn danger">
                                                                <i class="fas fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div class="scene-description-container" id="description-<?php echo $scene['id']; ?>" style="display: none;">
                                                        <textarea class="scene-description" 
                                                                  onblur="updateSceneDescription(<?php echo $scene['id']; ?>, this.value)"
                                                                  placeholder="Describe what happens in this scene..."><?php echo htmlspecialchars($scene['description'] ?? ''); ?></textarea>
                                                    </div>
                                                    <div class="clips-section">
                                                        <?php if (!empty($scene['clips'])): ?>
                                                            <div class="clip-image-grid">
                                                                <?php foreach ($scene['clips'] as $clip): ?>
                                                                    <?php if (!empty($clip['image_url'])): ?>
                                                                        <div class="clip-image-card">
                                                                            <img src="<?php echo htmlspecialchars($clip['image_url']); ?>" alt="">
                                                                            <span><?php echo htmlspecialchars($clip['title'] ?: 'Clip'); ?></span>
                                                                        </div>
                                                                    <?php endif; ?>
                                                                <?php endforeach; ?>
                                                            </div>
                                                        <?php endif; ?>
                                                        <div class="clips-header">
                                                            <span>Clips</span>
                                                            <button class="btn" onclick="addClip(<?php echo $scene['id']; ?>)">
                                                                <i class="fas fa-plus"></i> Clip
                                                            </button>
                                                        </div>
                                                        <div class="clips-list" data-scene-id="<?php echo $scene['id']; ?>">
                                                            <?php foreach ($scene['clips'] as $clip): ?>
                                                                <div class="clip" data-id="<?php echo $clip['id']; ?>">
                                                                    <div class="clip-info">
                                                                        <?php if (!empty($clip['image_url'])): ?>
                                                                            <img class="clip-thumb" src="<?php echo htmlspecialchars($clip['image_url']); ?>" alt="">
                                                                        <?php endif; ?>
                                                                        <h5 class="clip-title" contenteditable="true"><?php echo htmlspecialchars($clip['title'] ?: 'Untitled Clip'); ?></h5>
                                                                        <span class="clip-meta">Clip <?php echo (int)$clip['order'] + 1; ?></span>
                                                                    </div>
                                                                    <div class="clip-actions">
                                                                        <button class="btn" onclick="window.location.href='clip_composer.php?clip_id=<?php echo $clip['id']; ?>'">
                                                                            <i class="fas fa-pen-nib"></i>
                                                                        </button>
                                                                        <button class="btn danger" onclick="deleteClip(<?php echo $clip['id']; ?>)">
                                                                            <i class="fas fa-trash"></i>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            <?php endforeach; ?>
                                                        </div>
                                                    </div>
                                                </div>
                                            <?php endforeach; ?>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </main>
        </div>
        
        <?php include 'includes/footer.php'; ?>
    </div>

    <script>
    window.storyPlannerContext = { storyId: <?php echo (int)$story_id; ?> };
    </script>
    <script src="js/story_planner.js"></script>
</body>
</html> 
