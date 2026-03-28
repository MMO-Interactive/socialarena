<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$scene_id = isset($_GET['scene_id']) ? (int)$_GET['scene_id'] : 0;
if ($scene_id === 0) {
    header('Location: writing_center.php');
    exit;
}

$stmt = $pdo->prepare("
    SELECT sc.*, s.id as story_id, s.title as story_title,
           s.created_by as story_owner, s.studio_id as story_studio_id, s.visibility as story_visibility,
           ch.title as chapter_title, a.title as act_title
    FROM story_scenes sc
    JOIN story_chapters ch ON sc.chapter_id = ch.id
    JOIN story_acts a ON ch.act_id = a.id
    JOIN stories s ON a.story_id = s.id
    WHERE sc.id = ?
");
$stmt->execute([$scene_id]);
$scene = $stmt->fetch(PDO::FETCH_ASSOC);

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

$page_title = "Screenplay Editor - " . htmlspecialchars($scene['title']);
$additional_css = ['css/screenplay.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="screenplay-header">
                <div>
                    <h1><?php echo htmlspecialchars($scene['title']); ?></h1>
                    <p class="screenplay-breadcrumbs">
                        <?php echo htmlspecialchars($scene['story_title']); ?> &gt;
                        <?php echo htmlspecialchars($scene['act_title']); ?> &gt;
                        <?php echo htmlspecialchars($scene['chapter_title']); ?>
                    </p>
                </div>
                <div class="screenplay-actions">
                    <a class="btn" href="story_planner.php?id=<?php echo (int)$scene['story_id']; ?>">
                        <i class="fas fa-arrow-left"></i> Back to Planner
                    </a>
                    <a class="btn primary-btn" href="export_fountain.php?story_id=<?php echo (int)$scene['story_id']; ?>">
                        <i class="fas fa-file-export"></i> Export Fountain
                    </a>
                </div>
            </div>

            <div class="screenplay-layout" data-scene-id="<?php echo (int)$scene_id; ?>">
                <section class="screenplay-editor">
                    <div class="screenplay-blocks" id="screenplay-blocks">
                        <!-- Blocks injected by JS -->
                    </div>
                </section>
                <aside class="screenplay-sidebar">
                    <div class="sidebar-card">
                        <h3>Add Block</h3>
                        <div class="block-buttons">
                            <button class="btn" data-block-type="scene_heading">Scene Heading</button>
                            <button class="btn" data-block-type="action">Action</button>
                            <button class="btn" data-block-type="character">Character</button>
                            <button class="btn" data-block-type="parenthetical">Parenthetical</button>
                            <button class="btn" data-block-type="dialogue">Dialogue</button>
                            <button class="btn" data-block-type="transition">Transition</button>
                        </div>
                    </div>
                    <div class="sidebar-card">
                        <h3>Scene Notes</h3>
                        <p><?php echo htmlspecialchars($scene['description'] ?? ''); ?></p>
                    </div>
                </aside>
            </div>
        </main>
    </div>
</div>

<script>
window.screenplayContext = {
    sceneId: <?php echo (int)$scene_id; ?>
};
</script>
<script src="js/screenplay.js"></script>
