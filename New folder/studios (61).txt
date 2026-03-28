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
    enforceSeriesAccess($pdo, $series_id, (int)$_SESSION['user_id'], false);
} catch (Exception $e) {
    header('Location: writing_center.php');
    exit;
}

$userId = (int)$_SESSION['user_id'];
[$actorWhere, $actorParams] = buildStudioVisibilityWhere('va', $userId, 'virtual_cast');
$stmt = $pdo->prepare("SELECT va.* FROM virtual_actors va WHERE {$actorWhere} ORDER BY va.name ASC");
$stmt->execute($actorParams);
$actors = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare("
    SELECT sc.*, va.name as actor_name
    FROM series_cast sc
    JOIN virtual_actors va ON sc.actor_id = va.id
    WHERE sc.series_id = ?
    ORDER BY sc.id DESC
");
$stmt->execute([$series_id]);
$cast = $stmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'Series Cast - ' . htmlspecialchars($series['title']);
$additional_css = ['css/series_cast.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="series-cast-header">
                <div>
                    <h1><?php echo htmlspecialchars($series['title']); ?> Cast</h1>
                    <p>Assign virtual actors to characters in this series.</p>
                </div>
                <a class="btn" href="series.php?id=<?php echo (int)$series_id; ?>">
                    <i class="fas fa-arrow-left"></i> Back to Series
                </a>
            </div>

            <div class="series-cast-layout">
                <section class="cast-form">
                    <h2>Add Cast Member</h2>
                    <div class="form-row">
                        <label>Character Name</label>
                        <input type="text" id="cast-character" placeholder="e.g. Lily Harper">
                    </div>
                    <div class="form-row">
                        <label>Role Name (optional)</label>
                        <input type="text" id="cast-role" placeholder="e.g. Lead, Supporting">
                    </div>
                    <div class="form-row">
                        <label>Virtual Actor</label>
                        <select id="cast-actor">
                            <option value="">Select actor</option>
                            <?php foreach ($actors as $actor): ?>
                                <option value="<?php echo (int)$actor['id']; ?>"><?php echo htmlspecialchars($actor['name']); ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <button class="btn primary-btn" id="add-cast">Add to Cast</button>
                </section>

                <section class="cast-list">
                    <h2>Current Cast</h2>
                    <?php if (empty($cast)): ?>
                        <div class="empty-state">No cast members yet.</div>
                    <?php else: ?>
                        <?php foreach ($cast as $member): ?>
                            <div class="cast-card" data-cast-id="<?php echo (int)$member['id']; ?>">
                                <div>
                                    <strong><?php echo htmlspecialchars($member['character_name'] ?: 'Untitled Character'); ?></strong>
                                    <div class="muted"><?php echo htmlspecialchars($member['actor_name']); ?></div>
                                    <?php if (!empty($member['role_name'])): ?>
                                        <div class="muted">Role: <?php echo htmlspecialchars($member['role_name']); ?></div>
                                    <?php endif; ?>
                                </div>
                                <button class="btn danger" data-action="remove">Remove</button>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </section>
            </div>
        </main>
    </div>
</div>

<script>
window.seriesCastContext = { seriesId: <?php echo (int)$series_id; ?> };
</script>
<script src="js/series_cast.js"></script>
