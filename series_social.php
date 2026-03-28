<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$series_id = isset($_GET['series_id']) ? (int)$_GET['series_id'] : 0;
if ($series_id === 0) {
    header('Location: writing_center.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM series WHERE id = ?");
$stmt->execute([$series_id]);
$series = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$series) {
    header('Location: writing_center.php');
    exit;
}

try {
    enforceSeriesAccess($pdo, $series_id, (int)$_SESSION['user_id'], true);
} catch (Exception $e) {
    header('Location: writing_center.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM series_social_settings WHERE series_id = ?");
$stmt->execute([$series_id]);
$settings = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$settings) {
    $settings = [
        'checkpoint_name' => '',
        'negative_prompt' => '',
        'width' => 1280,
        'height' => 1280,
        'steps' => 7,
        'cfg_scale' => 1.0,
        'sampler_name' => 'euler',
        'scheduler' => 'normal'
    ];
}

$stmt = $pdo->prepare("SELECT * FROM series_social_weeks WHERE series_id = ? ORDER BY week_start DESC, id DESC");
$stmt->execute([$series_id]);
$weeks = $stmt->fetchAll(PDO::FETCH_ASSOC);

$weekIds = array_column($weeks, 'id');
$assetsByWeek = [];
if (!empty($weekIds)) {
    $placeholders = implode(',', array_fill(0, count($weekIds), '?'));
    $stmt = $pdo->prepare("SELECT * FROM series_social_assets WHERE week_id IN ($placeholders) ORDER BY day_index ASC");
    $stmt->execute($weekIds);
    $assets = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($assets as $asset) {
        $assetsByWeek[$asset['week_id']][] = $asset;
    }
}

$page_title = 'Social Media Manager - ' . htmlspecialchars($series['title']);
$additional_css = ['css/series_social.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="social-header">
                <div>
                    <h1>Social Media Manager</h1>
                    <p><?php echo htmlspecialchars($series['title']); ?> · Weekly theme generator</p>
                </div>
                <div class="social-actions">
                    <a class="btn" href="series.php?id=<?php echo $series_id; ?>">Back to Series</a>
                </div>
            </div>

            <section class="social-settings">
                <h2>ComfyUI Settings</h2>
                <form id="social-settings-form">
                    <input type="hidden" name="series_id" value="<?php echo $series_id; ?>">
                    <div class="settings-grid">
                        <div class="form-group">
                            <label>Checkpoint Name</label>
                            <input type="text" name="checkpoint_name" value="<?php echo htmlspecialchars($settings['checkpoint_name']); ?>" placeholder="model.safetensors">
                        </div>
                        <div class="form-group">
                            <label>Negative Prompt</label>
                            <input type="text" name="negative_prompt" value="<?php echo htmlspecialchars($settings['negative_prompt']); ?>" placeholder="Optional negative prompt">
                        </div>
                        <div class="form-group">
                            <label>Width</label>
                            <input type="number" name="width" value="<?php echo (int)$settings['width']; ?>">
                        </div>
                        <div class="form-group">
                            <label>Height</label>
                            <input type="number" name="height" value="<?php echo (int)$settings['height']; ?>">
                        </div>
                        <div class="form-group">
                            <label>Steps</label>
                            <input type="number" name="steps" value="<?php echo (int)$settings['steps']; ?>">
                        </div>
                        <div class="form-group">
                            <label>CFG</label>
                            <input type="number" step="0.1" name="cfg_scale" value="<?php echo htmlspecialchars($settings['cfg_scale']); ?>">
                        </div>
                        <div class="form-group">
                            <label>Sampler</label>
                            <input type="text" name="sampler_name" value="<?php echo htmlspecialchars($settings['sampler_name']); ?>">
                        </div>
                        <div class="form-group">
                            <label>Scheduler</label>
                            <input type="text" name="scheduler" value="<?php echo htmlspecialchars($settings['scheduler']); ?>">
                        </div>
                    </div>
                    <button type="button" class="btn" id="save-settings">Save Settings</button>
                </form>
            </section>

            <section class="social-week">
                <h2>Plan a Week</h2>
                <div class="week-form">
                    <input type="date" id="week-start" value="<?php echo date('Y-m-d'); ?>">
                    <input type="text" id="week-theme" placeholder="Theme of the week">
                    <button class="btn primary-btn" id="create-week">Create Week</button>
                </div>
            </section>

            <section class="social-weeks">
                <?php if (empty($weeks)): ?>
                    <p class="empty-state">No social weeks yet. Create a week to generate the full set of posts.</p>
                <?php else: ?>
                    <?php foreach ($weeks as $week): ?>
                        <?php $assets = $assetsByWeek[$week['id']] ?? []; ?>
                        <div class="week-card" data-week-id="<?php echo (int)$week['id']; ?>">
                            <div class="week-header">
                                <div>
                                    <h3>Week of <?php echo date('M j, Y', strtotime($week['week_start'])); ?></h3>
                                    <p><?php echo htmlspecialchars($week['theme']); ?></p>
                                </div>
                                <div class="week-actions">
                                    <button class="btn" data-action="generate-week">Generate Week</button>
                                    <button class="btn" data-action="refresh-week">Refresh Status</button>
                                </div>
                            </div>
                            <div class="week-grid">
                                <?php for ($day = 0; $day < 7; $day++): ?>
                                    <?php $asset = $assets[$day] ?? null; ?>
                                    <div class="day-card" data-day-index="<?php echo $day; ?>">
                                        <div class="day-header">
                                            <strong><?php echo date('D', strtotime('Sunday +' . $day . ' days')); ?></strong>
                                            <span class="status-pill <?php echo $asset ? $asset['status'] : 'pending'; ?>"><?php echo $asset ? $asset['status'] : 'pending'; ?></span>
                                        </div>
                                        <div class="day-tags">
                                            <span>Theme: <?php echo htmlspecialchars($week['theme']); ?></span>
                                            <?php if (!empty($asset['shot_type'])): ?>
                                                <span>Shot: <?php echo htmlspecialchars($asset['shot_type']); ?></span>
                                            <?php endif; ?>
                                        </div>
                                        <div class="day-body">
                                            <?php if (!empty($asset['image_url'])): ?>
                                                <img src="<?php echo htmlspecialchars($asset['image_url']); ?>" alt="">
                                            <?php else: ?>
                                                <div class="placeholder">No image yet</div>
                                            <?php endif; ?>
                                            <p><?php echo htmlspecialchars($asset['prompt'] ?? ''); ?></p>
                                        </div>
                                        <?php if (!empty($asset['alt_image_url'])): ?>
                                            <div class="bts-preview">
                                                <span>BTS / Pipeline</span>
                                                <img src="<?php echo htmlspecialchars($asset['alt_image_url']); ?>" alt="">
                                            </div>
                                        <?php endif; ?>
                                        <div class="day-actions">
                                            <button class="btn" data-action="generate-day">Generate</button>
                                            <button class="btn" data-action="refresh-day">Refresh</button>
                                            <button class="btn" data-action="view-day" <?php echo empty($asset['image_url']) ? 'disabled' : ''; ?>>View</button>
                                            <button class="btn" data-action="edit-day">Edit</button>
                                        </div>
                                        <div class="day-meta">
                                            <input type="text" class="day-shot" placeholder="Shot type" value="<?php echo htmlspecialchars($asset['shot_type'] ?? ''); ?>">
                                            <label class="day-bts">
                                                <input type="checkbox" <?php echo (!empty($asset['include_bts'])) ? 'checked' : ''; ?>> Include BTS / Pipeline
                                            </label>
                                            <button class="btn" data-action="save-day">Save</button>
                                        </div>
                                        <input type="hidden" class="day-prompt" value="<?php echo htmlspecialchars($asset['custom_prompt'] ?? ''); ?>">
                                        <input type="hidden" class="day-image" value="<?php echo htmlspecialchars($asset['image_url'] ?? ''); ?>">
                                        <input type="hidden" class="day-alt-image" value="<?php echo htmlspecialchars($asset['alt_image_url'] ?? ''); ?>">
                                    </div>
                                <?php endfor; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                <?php endif; ?>
            </section>
        </main>
    </div>
</div>

<div class="modal" id="view-modal" style="display:none;">
    <div class="modal-content">
        <h2>Preview</h2>
        <img id="view-image" src="" alt="">
        <div class="modal-actions">
            <button class="btn secondary-btn" id="view-close">Close</button>
        </div>
    </div>
</div>

<div class="modal" id="edit-modal" style="display:none;">
    <div class="modal-content">
        <h2>Edit / Regenerate</h2>
        <div class="form-group">
            <label>Custom Prompt (optional)</label>
            <textarea id="edit-prompt" placeholder="Override the generated prompt..."></textarea>
        </div>
        <div class="form-group">
            <label>Shot Type</label>
            <input type="text" id="edit-shot" placeholder="Close-up, wide, motion, etc.">
        </div>
        <label class="day-bts">
            <input type="checkbox" id="edit-bts"> Include BTS / Pipeline render
        </label>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="edit-cancel">Cancel</button>
            <button class="btn primary-btn" id="edit-save">Save & Regenerate</button>
        </div>
    </div>
</div>

<script>
window.socialContext = {
    seriesId: <?php echo (int)$series_id; ?>
};
</script>
<script src="js/series_social.js"></script>
