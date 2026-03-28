<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$clip_id = isset($_GET['clip_id']) ? (int)$_GET['clip_id'] : 0;
if ($clip_id === 0) {
    header('Location: writing_center.php');
    exit;
}

$stmt = $pdo->prepare("
    SELECT scp.*, ss.title as scene_title, ss.description as scene_description,
           s.id as story_id, s.title as story_title,
           s.created_by as story_owner, s.studio_id as story_studio_id, s.visibility as story_visibility,
           ch.title as chapter_title, a.title as act_title
    FROM story_scene_clips scp
    JOIN story_scenes ss ON scp.scene_id = ss.id
    JOIN story_chapters ch ON ss.chapter_id = ch.id
    JOIN story_acts a ON ch.act_id = a.id
    JOIN stories s ON a.story_id = s.id
    WHERE scp.id = ?
");
$stmt->execute([$clip_id]);
$clip = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$clip) {
    header('Location: writing_center.php');
    exit;
}
try {
    enforceStudioItemAccess(
        $pdo,
        (int)$clip['story_owner'],
        (int)$clip['story_studio_id'],
        $clip['story_visibility'],
        (int)$_SESSION['user_id'],
        'stories',
        false
    );
} catch (Exception $e) {
    header('Location: writing_center.php');
    exit;
}

$page_title = "Clip Composer - " . htmlspecialchars($clip['title']);
$additional_css = ['css/screenplay.css', 'css/clip_composer.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="clip-hero">
                <div class="clip-hero-main">
                    <div class="clip-hero-label">Episode Clip Composer</div>
                    <h1><?php echo htmlspecialchars($clip['title']); ?></h1>
                    <p class="clip-hero-subtitle">
                        <?php echo htmlspecialchars($clip['story_title']); ?> &gt;
                        <?php echo htmlspecialchars($clip['act_title']); ?> &gt;
                        <?php echo htmlspecialchars($clip['chapter_title']); ?> &gt;
                        <?php echo htmlspecialchars($clip['scene_title']); ?>
                    </p>
                    <div class="clip-hero-meta">
                        <span><i class="fas fa-film"></i> Clip workspace</span>
                        <span><i class="fas fa-image"></i> Starting frame</span>
                        <span><i class="fas fa-play"></i> LTX-2 render</span>
                    </div>
                </div>
                <div class="clip-hero-actions">
                    <a class="btn secondary-btn" href="story_planner.php?id=<?php echo (int)$clip['story_id']; ?>">
                        <i class="fas fa-arrow-left"></i> Back to Planner
                    </a>
                    <a class="btn" href="screenplay_editor.php?scene_id=<?php echo (int)$clip['scene_id']; ?>">
                        <i class="fas fa-pen-nib"></i> Scene Script
                    </a>
                </div>
            </div>

            <div class="clip-preview-grid" data-clip-id="<?php echo (int)$clip_id; ?>">
                <div class="clip-preview-card">
                    <div class="clip-preview-header">
                        <div>
                            <div class="clip-preview-label">Starting Image</div>
                            <h3>Live Starting Frame</h3>
                        </div>
                        <span class="clip-status-pill" id="clip-start-status">Idle</span>
                    </div>
                    <div class="clip-preview-body">
                        <img id="clip-start-image" src="images/default-story.svg" alt="Starting frame preview">
                    </div>
                    <div class="clip-preview-actions">
                        <button class="btn" type="button" id="clip-generate-starting">Generate Starting Image</button>
                    </div>
                </div>
                <div class="clip-preview-card">
                    <div class="clip-preview-header">
                        <div>
                            <div class="clip-preview-label">Generated Clip</div>
                            <h3>Latest LTX-2 Render</h3>
                        </div>
                        <span class="clip-status-pill" id="clip-video-status">Idle</span>
                    </div>
                    <div class="clip-preview-body">
                        <video id="clip-video-preview" controls muted playsinline>
                            <source id="clip-video-source" src="" type="video/mp4">
                        </video>
                        <div class="clip-preview-empty" id="clip-video-empty">Generate a clip to preview it here.</div>
                    </div>
                </div>
            </div>

            <div class="screenplay-layout" data-clip-id="<?php echo (int)$clip_id; ?>">
                <section class="screenplay-editor">
                    <div class="clip-pipeline">
                        <div class="clip-step active">
                            <span class="clip-step-title">1. Organize</span>
                            <span class="clip-step-desc">Blocks + scene notes</span>
                        </div>
                        <div class="clip-step">
                            <span class="clip-step-title">2. Starting Image</span>
                            <span class="clip-step-desc">Generate or upload</span>
                        </div>
                        <div class="clip-step">
                            <span class="clip-step-title">3. Prompt</span>
                            <span class="clip-step-desc">Assemble LTX-2 prompt</span>
                        </div>
                        <div class="clip-step">
                            <span class="clip-step-title">4. Generate Clip</span>
                            <span class="clip-step-desc">Render from image</span>
                        </div>
                    </div>
                    <div class="screenplay-blocks" id="clip-blocks">
                        <!-- Blocks injected by JS -->
                    </div>
                </section>
                <aside class="screenplay-sidebar">
                    <div class="sidebar-card">
                        <h3>Episode Overview</h3>
                        <p class="muted">Clip inside <?php echo htmlspecialchars($clip['story_title']); ?>.</p>
                        <div class="clip-overview">
                            <div>
                                <span class="label">Act</span>
                                <span><?php echo htmlspecialchars($clip['act_title']); ?></span>
                            </div>
                            <div>
                                <span class="label">Chapter</span>
                                <span><?php echo htmlspecialchars($clip['chapter_title']); ?></span>
                            </div>
                            <div>
                                <span class="label">Scene</span>
                                <span><?php echo htmlspecialchars($clip['scene_title']); ?></span>
                            </div>
                        </div>
                    </div>
                    <div class="sidebar-card">
                        <h3>Starting Image</h3>
                        <p class="muted">Add an image block to generate or upload the clip’s first frame.</p>
                        <div class="block-buttons">
                            <button class="btn" data-block-type="image">Add Image Block</button>
                            
                            <button class=\"btn primary-btn\" type=\"button\" id=\"clip-generate-starting-inline\">Generate Starting Image</button><button class="btn secondary-btn" type="button" id="clip-generate-prompt">Generate Prompt</button>
                        </div>
                    </div>
                    <div class="sidebar-card">
                        <h3>Clip Actions</h3>
                        <div class="block-buttons">
                            <button class="btn" type="button" id="clip-view-prompt">View Prompt</button>
                            <button class="btn primary-btn" type="button" id="clip-generate-clip">Generate Clip</button>
                        </div>
                    </div>
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
                        <p><?php echo htmlspecialchars($clip['scene_description'] ?? ''); ?></p>
                    </div>
                    <?php if (!empty($clip['description'])): ?>
                        <div class="sidebar-card">
                            <h3>Clip Notes</h3>
                            <p><?php echo htmlspecialchars($clip['description']); ?></p>
                        </div>
                    <?php endif; ?>
                </aside>
            </div>
        </main>
    </div>
</div>

<script>
window.clipComposerContext = {
    clipId: <?php echo (int)$clip_id; ?>
};
</script>
<script src="js/clip_composer.js"></script>

