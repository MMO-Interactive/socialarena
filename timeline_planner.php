<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$story_id = isset($_GET['story_id']) ? (int)$_GET['story_id'] : 0;
$project_id = isset($_GET['project_id']) ? (int)$_GET['project_id'] : 0;

if ($story_id === 0 && $project_id === 0) {
    header('Location: writing_center.php');
    exit;
}

if ($project_id === 0) {
    $stmt = $pdo->prepare("SELECT id FROM timeline_projects WHERE story_id = ? AND user_id = ?");
    $stmt->execute([$story_id, $_SESSION['user_id']]);
    $project_id = (int)$stmt->fetchColumn();

    if ($project_id === 0) {
        $stmt = $pdo->prepare("SELECT title FROM stories WHERE id = ?");
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
        $stmt = $pdo->prepare("INSERT INTO timeline_projects (user_id, story_id, title) VALUES (?, ?, ?)");
        $stmt->execute([$_SESSION['user_id'], $story_id, $story['title']]);
        $project_id = (int)$pdo->lastInsertId();
    }
}

$stmt = $pdo->prepare("SELECT * FROM timeline_projects WHERE id = ? AND user_id = ?");
$stmt->execute([$project_id, $_SESSION['user_id']]);
$project = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$project) {
    header('Location: writing_center.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM timeline_tracks WHERE project_id = ? ORDER BY track_order ASC, id ASC");
$stmt->execute([$project_id]);
$tracks = $stmt->fetchAll(PDO::FETCH_ASSOC);

$trackIds = array_column($tracks, 'id');
$itemsByTrack = [];
if (!empty($trackIds)) {
    $placeholders = implode(',', array_fill(0, count($trackIds), '?'));
    $stmt = $pdo->prepare("SELECT * FROM timeline_items WHERE track_id IN ($placeholders) ORDER BY start_time ASC, id ASC");
    $stmt->execute($trackIds);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($items as $item) {
        $itemsByTrack[$item['track_id']][] = $item;
    }
}

$page_title = 'Timeline Planner - ' . htmlspecialchars($project['title']);
$additional_css = ['css/timeline.css'];
$body_class = 'timeline-body';

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content timeline-page">
            <div class="timeline-header">
                <div>
                    <h1>Timeline Planner</h1>
                    <p><?php echo htmlspecialchars($project['title']); ?> · <?php echo (int)$project['duration_seconds']; ?>s timeline</p>
                </div>
                <div class="timeline-actions">
                    <?php if (!empty($project['story_id'])): ?>
                        <a class="btn" href="story_planner.php?id=<?php echo (int)$project['story_id']; ?>">Back to Film</a>
                    <?php else: ?>
                        <a class="btn" href="writing_center.php">Back</a>
                    <?php endif; ?>
                    <button class="btn" id="add-track">Add Track</button>
                    <button class="btn primary-btn" id="add-item">Add Clip</button>
                </div>
            </div>

            <div class="timeline-toolbar">
                <div class="toolbar-group">
                    <label for="timeline-zoom">Zoom</label>
                    <input type="range" id="timeline-zoom" min="40" max="140" value="80">
                </div>
                <div class="toolbar-group">
                    <label for="timeline-duration">Timeline Length (sec)</label>
                    <input type="number" id="timeline-duration" min="10" max="3600" value="<?php echo (int)$project['duration_seconds']; ?>">
                    <button class="btn" id="save-duration">Save</button>
                </div>
            </div>

            <div class="timeline-shell">
                <div class="timeline-ruler" id="timeline-ruler"></div>
                <div class="timeline-tracks">
                    <?php if (empty($tracks)): ?>
                        <div class="empty-state">No tracks yet. Add your first track to start laying out clips.</div>
                    <?php else: ?>
                        <?php foreach ($tracks as $track): ?>
                            <div class="track" data-track-id="<?php echo (int)$track['id']; ?>">
                                <div class="track-meta">
                                    <div>
                                        <strong><?php echo htmlspecialchars($track['name']); ?></strong>
                                        <span><?php echo htmlspecialchars($track['track_type']); ?></span>
                                    </div>
                                    <div class="track-actions">
                                        <button class="btn" data-action="edit-track">Edit</button>
                                        <button class="btn danger" data-action="delete-track">Delete</button>
                                    </div>
                                </div>
                                <div class="track-lane">
                                    <?php foreach (($itemsByTrack[$track['id']] ?? []) as $item): ?>
                                        <div class="timeline-item<?php echo ($item['item_type'] === 'image' && !empty($item['file_url'])) ? ' timeline-item--thumb' : ''; ?>"
                                             data-item-id="<?php echo (int)$item['id']; ?>"
                                             data-item-type="<?php echo htmlspecialchars($item['item_type'], ENT_QUOTES); ?>"
                                             data-label="<?php echo htmlspecialchars($item['label'] ?? '', ENT_QUOTES); ?>"
                                             data-file-url="<?php echo htmlspecialchars($item['file_url'] ?? '', ENT_QUOTES); ?>"
                                             data-start="<?php echo htmlspecialchars($item['start_time'], ENT_QUOTES); ?>"
                                             data-duration="<?php echo htmlspecialchars($item['duration'], ENT_QUOTES); ?>"
                                             data-notes="<?php echo htmlspecialchars($item['notes'] ?? '', ENT_QUOTES); ?>">
                                            <?php if ($item['item_type'] === 'image' && !empty($item['file_url'])): ?>
                                                <img class="timeline-thumb" src="<?php echo htmlspecialchars($item['file_url']); ?>" alt="">
                                            <?php endif; ?>
                                            <span><?php echo htmlspecialchars($item['label'] ?: strtoupper($item['item_type'])); ?></span>
                                            <em><?php echo htmlspecialchars($item['item_type']); ?></em>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </div>
        </main>
    </div>
</div>

<div class="modal" id="track-modal" style="display:none;">
    <div class="modal-content">
        <h2 id="track-modal-title">Add Track</h2>
        <div class="form-group">
            <label>Track Name</label>
            <input type="text" id="track-name">
        </div>
        <div class="form-group">
            <label>Track Type</label>
            <select id="track-type">
                <option value="video">video</option>
                <option value="image">image</option>
                <option value="audio">audio</option>
                <option value="text">text</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="track-cancel">Cancel</button>
            <button class="btn primary-btn" id="track-save">Save</button>
        </div>
    </div>
</div>

<div class="modal" id="item-modal" style="display:none;">
    <div class="modal-content">
        <h2 id="item-modal-title">Add Clip</h2>
        <div class="form-group">
            <label>Track</label>
            <select id="item-track">
                <option value="">Select track</option>
                <?php foreach ($tracks as $track): ?>
                    <option value="<?php echo (int)$track['id']; ?>"><?php echo htmlspecialchars($track['name']); ?></option>
                <?php endforeach; ?>
            </select>
        </div>
        <div class="form-group">
            <label>Type</label>
            <select id="item-type">
                <option value="video">video</option>
                <option value="image">image</option>
                <option value="audio">audio</option>
                <option value="text">text</option>
            </select>
        </div>
        <div class="form-group">
            <label>Label</label>
            <input type="text" id="item-label" placeholder="Clip name">
        </div>
        <div class="form-group">
            <label>Start Time (sec)</label>
            <input type="number" id="item-start" step="0.1" min="0" value="0">
        </div>
        <div class="form-group">
            <label>Duration (sec)</label>
            <input type="number" id="item-duration" step="0.1" min="0.1" value="5">
        </div>
        <div class="form-group">
            <label>Notes</label>
            <textarea id="item-notes" placeholder="Shot intent, timing notes..."></textarea>
        </div>
        <div class="form-group">
            <label>File URL</label>
            <input type="text" id="item-file" placeholder="https://...">
        </div>
        <div class="form-group">
            <label>Upload File</label>
            <input type="file" id="item-file-upload" accept="image/*,video/*,audio/*">
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="item-cancel">Cancel</button>
            <button class="btn primary-btn" id="item-save">Save</button>
        </div>
    </div>
</div>

<script>
window.timelineContext = {
    projectId: <?php echo (int)$project_id; ?>,
    durationSeconds: <?php echo (int)$project['duration_seconds']; ?>
};
</script>
<script src="js/timeline.js"></script>



