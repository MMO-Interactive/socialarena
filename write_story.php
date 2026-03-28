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

// Get all acts, chapters, and scenes in order
$stmt = $pdo->prepare("
    SELECT 
        a.id as act_id,
        a.title as act_title,
        a.act_order,
        c.id as chapter_id,
        c.title as chapter_title,
        c.chapter_order,
        s.id as scene_id,
        s.title as scene_title,
        s.description as scene_description,
        s.scene_order,
        sc.content as scene_content,
        sc.word_count
    FROM story_acts a
    LEFT JOIN story_chapters c ON a.id = c.act_id
    LEFT JOIN story_scenes s ON c.id = s.chapter_id
    LEFT JOIN scene_content sc ON s.id = sc.scene_id
    WHERE a.story_id = ?
    ORDER BY a.act_order, c.chapter_order, s.scene_order
");
$stmt->execute([$story_id]);
$structure = $stmt->fetchAll();
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Writing - <?php echo htmlspecialchars($story['title']); ?></title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/write.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div id="context-menu" class="context-menu" style="display: none;">
        <div class="menu-section">
            <h3>AI</h3>
            <div class="menu-item" onclick="showSceneBeatDialog()">
                <i class="fas fa-wave-square"></i>
                <div>
                    <strong>Scene Beat</strong>
                    <span>A pivotal moment where something important changes, driving the narrative forward.</span>
                </div>
            </div>
            <div class="menu-item" onclick="continueWriting()">
                <i class="fas fa-pen"></i>
                <div>
                    <strong>Continue Writing</strong>
                    <span>Creates a new scene beat to continue writing.</span>
                </div>
            </div>
        </div>
        
        <div class="menu-section">
            <h3>Codex</h3>
            <div class="menu-item" onclick="addCodexEntry()">
                <i class="fas fa-book"></i>
                <div>
                    <strong>Codex Addition</strong>
                    <span>Add additional information about the world, characters, or events to track your story arcs.</span>
                </div>
            </div>
        </div>

        <div class="menu-section">
            <h3>Formatting</h3>
            <div class="menu-item" onclick="formatText('bold')">
                <i class="fas fa-bold"></i>
                <div>
                    <strong>Bold</strong>
                </div>
            </div>
            <div class="menu-item" onclick="formatText('italic')">
                <i class="fas fa-italic"></i>
                <div>
                    <strong>Italic</strong>
                </div>
            </div>
        </div>
    </div>

    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>
        
        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>
            
            <main class="main-content">
                <div class="write-header">
                    <div class="navigation">
                        <a href="story_planner.php?id=<?php echo $story_id; ?>" class="btn">
                            <i class="fas fa-arrow-left"></i> Back to Planner
                        </a>
                        <h1><?php echo htmlspecialchars($story['title']); ?></h1>
                    </div>
                    <div class="story-info">
                        <span class="total-words">0 words</span>
                        <span class="save-status">All changes saved</span>
                        <a href="story_codex.php?story_id=<?php echo $story_id; ?>" class="btn">
                            <i class="fas fa-book"></i> Story Codex
                        </a>
                    </div>
                </div>

                <div class="write-container" 
                     data-story-id="<?php echo (int)$story_id; ?>"
                     data-series-id="<?php echo htmlspecialchars($story['series_id'] ?? ''); ?>"
                     data-universe-id="<?php echo htmlspecialchars($story['universe_id'] ?? ''); ?>"
                     data-timeline-date="<?php echo htmlspecialchars($story['timeline_date'] ?? ''); ?>">
                    <div class="editor-container">
                        <?php 
                        $current_act = null;
                        $current_chapter = null;
                        
                        foreach ($structure as $item): 
                            // Start new act if needed
                            if ($current_act !== $item['act_id']): 
                                if ($current_act !== null) echo "</div>"; // Close previous act
                                $current_act = $item['act_id'];
                        ?>
                            <div class="act-section" data-act-id="<?php echo $item['act_id']; ?>">
                                <div class="act-header">
                                    <h2><?php echo htmlspecialchars($item['act_title']); ?></h2>
                                </div>
                        <?php 
                            endif;
                            
                            // Start new chapter if needed
                            if ($current_chapter !== $item['chapter_id']):
                                if ($current_chapter !== null) echo "</div>"; // Close previous chapter
                                $current_chapter = $item['chapter_id'];
                        ?>
                            <div class="chapter-section" data-chapter-id="<?php echo $item['chapter_id']; ?>">
                                <div class="chapter-header">
                                    <h3><?php echo htmlspecialchars($item['chapter_title']); ?></h3>
                                </div>
                        <?php endif; ?>

                            <div class="scene-section" data-scene-id="<?php echo $item['scene_id']; ?>">
                                <div class="scene-header">
                                    <h4><?php echo htmlspecialchars($item['scene_title']); ?></h4>
                                    <div class="scene-description">
                                        <?php echo htmlspecialchars($item['scene_description'] ?? ''); ?>
                                    </div>
                                </div>
                                
                                <!-- Add a specific class and data attribute for the editor -->
                                <div class="scene-content editor" 
                                     data-scene-id="<?php echo $item['scene_id']; ?>" 
                                     contenteditable="true">
                                    <?php echo htmlspecialchars($item['scene_content'] ?? ''); ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                        </div> <!-- Close last act -->
                    </div>

                    <div class="side-panel">
                        <div class="current-section">
                            <h3>Current Section</h3>
                            <div id="current-location"></div>
                        </div>

                        <div class="outline-section">
                            <h3>Story Outline</h3>
                            <div class="story-outline"></div>
                        </div>

                        <?php if ($story['story_type'] === 'interactive'): ?>
                        <div class="choices-section">
                            <h3>Current Scene Choices</h3>
                            <div id="current-choices"></div>
                        </div>
                        <?php endif; ?>

                        <div class="quick-reference">
                            <h3>Quick Reference</h3>
                            <div class="reference-terms"></div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        
        <?php include 'includes/footer.php'; ?>
    </div>

    <script src="js/write.js"></script>
</body>
</html> 
