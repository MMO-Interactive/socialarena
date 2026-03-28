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

// Check if scene ID is provided
if (!isset($_GET['scene_id'])) {
    header('Location: writing_center.php');
    exit;
}

$scene_id = (int)$_GET['scene_id'];
$theme = $_SESSION['theme'] ?? 'light';

// Get scene details including story type
$stmt = $pdo->prepare("
    SELECT 
        sc.*, 
        s.id as story_id,
        s.title as story_title,
        s.story_type,
        s.created_by as story_owner,
        s.studio_id as story_studio_id,
        s.visibility as story_visibility,
        ch.title as chapter_title,
        a.title as act_title
    FROM story_scenes sc
    JOIN story_chapters ch ON sc.chapter_id = ch.id
    JOIN story_acts a ON ch.act_id = a.id
    JOIN stories s ON a.story_id = s.id
    WHERE sc.id = ?
");
$stmt->execute([$scene_id]);
$scene = $stmt->fetch();

if (!$scene) {
    header('Location: writing_center.php');
    exit;
}

try {
    enforceStudioItemAccess(
        $pdo,
        (int)$scene['story_owner'],
        (int)$scene['story_studio_id'],
        $scene['story_visibility'],
        (int)$_SESSION['user_id'],
        'stories',
        false
    );
} catch (Exception $e) {
    header('Location: writing_center.php');
    exit;
}

// Get scene content
$stmt = $pdo->prepare("SELECT * FROM scene_content WHERE scene_id = ?");
$stmt->execute([$scene_id]);
$content = $stmt->fetch();

// Get choices if it's an interactive story
$choices = [];
if ($scene['story_type'] === 'interactive') {
    $stmt = $pdo->prepare("
        SELECT * FROM scene_choices 
        WHERE scene_id = ? 
        ORDER BY choice_order
    ");
    $stmt->execute([$scene_id]);
    $choices = $stmt->fetchAll();
}
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Writing - <?php echo htmlspecialchars($scene['title']); ?></title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/write.css?v=<?php echo filemtime('css/write.css'); ?>">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Crimson+Pro:wght@400;600&family=Space+Grotesk:wght@400;600&display=swap">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body class="write-scene" data-scene-id="<?php echo (int)$scene_id; ?>" data-story-id="<?php echo (int)$scene['story_id']; ?>">
    <div class="page-wrapper">
        <div class="write-header">
            <div class="navigation">
                <a href="story_planner.php?id=<?php echo $scene['story_id']; ?>" class="btn back-btn">
                    <i class="fas fa-arrow-left"></i> Back to Planner
                </a>
                <div class="breadcrumbs">
                    <?php echo htmlspecialchars($scene['story_title']); ?> &gt;
                    <?php echo htmlspecialchars($scene['act_title']); ?> &gt;
                    <?php echo htmlspecialchars($scene['chapter_title']); ?> &gt;
                    <?php echo htmlspecialchars($scene['title']); ?>
                </div>
            </div>
            <div class="scene-info">
                <span class="word-count">0 words</span>
                <span class="save-status">Draft saved locally</span>
            </div>
        </div>

        <div class="write-container">
            <div class="editor-container">
                <div class="editor-top">
                    <div class="scene-title"><?php echo htmlspecialchars($scene['title']); ?></div>
                    <div class="scene-subtitle">Scene drafting space</div>
                </div>
                <div id="editor" class="content-editor scene-content editor" contenteditable="true" data-scene-id="<?php echo (int)$scene_id; ?>" data-placeholder="Start writing the scene here...">
                    <?php echo $content ? htmlspecialchars($content['content']) : ''; ?>
                </div>
                <div class="editor-footer">
                    <span class="hint">Tip: add @mentions to pull codex context into AI scene beats.</span>
                </div>
            </div>

            <div class="side-panel">
                <div class="panel-section highlight-panel">
                    <h3>Scene Snapshot</h3>
                    <div class="scene-meta">
                        <div><strong>Story:</strong> <?php echo htmlspecialchars($scene['story_title']); ?></div>
                        <div><strong>Act:</strong> <?php echo htmlspecialchars($scene['act_title']); ?></div>
                        <div><strong>Chapter:</strong> <?php echo htmlspecialchars($scene['chapter_title']); ?></div>
                    </div>
                </div>
                <div class="panel-section">
                    <h3>Story Codex</h3>
                    <a class="btn" href="story_codex.php?story_id=<?php echo (int)$scene['story_id']; ?>">
                        <i class="fas fa-book"></i> Open Codex
                    </a>
                </div>
                <div class="panel-section">
                    <h3>Screenplay</h3>
                    <a class="btn" href="screenplay_editor.php?scene_id=<?php echo (int)$scene_id; ?>">
                        <i class="fas fa-pen-nib"></i> Open Editor
                    </a>
                </div>
                <div class="panel-section">
                    <h3>Scene Notes</h3>
                    <div class="scene-description">
                        <?php echo htmlspecialchars($scene['description'] ?? ''); ?>
                    </div>
                </div>

                <?php if ($scene['story_type'] === 'interactive'): ?>
                <div class="panel-section">
                    <h3>Choices</h3>
                    <div class="choices-list">
                        <?php foreach ($choices as $choice): ?>
                            <div class="choice-item">
                                <div class="choice-text"><?php echo htmlspecialchars($choice['choice_text']); ?></div>
                                <div class="choice-actions">
                                    <button class="btn small" onclick="editChoice(<?php echo $choice['id']; ?>)">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button class="btn small danger" onclick="deleteChoice(<?php echo $choice['id']; ?>)">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        <?php endforeach; ?>
                        <button class="btn add-choice" onclick="addChoice()">
                            <i class="fas fa-plus"></i> Add Choice
                        </button>
                    </div>
                </div>
                <?php endif; ?>

                <div class="panel-section">
                    <h3>Quick Reference</h3>
                    <div class="reference-list">
                        <!-- Will be populated with referenced terms -->
                    </div>
                </div>
                <div class="panel-section">
                    <h3>Local Draft</h3>
                    <button class="btn" type="button" onclick="clearLocalDraft()">Clear Local Draft</button>
                </div>
            </div>
        </div>
    </div>

    <script src="js/write.js?v=<?php echo filemtime('js/write.js'); ?>"></script>
</body>
</html> 
