<?php
ob_start();
require_once 'includes/db_connect.php';
require_once 'includes/studio_access.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

if (!isset($_GET['id'])) {
    header('Location: writing_center.php');
    exit;
}

$series_id = (int)$_GET['id'];
$theme = $_SESSION['theme'] ?? 'light';
$error = '';

$stmt = $pdo->prepare("SELECT * FROM series WHERE id = ?");
$stmt->execute([$series_id]);
$series = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$series) {
    header('Location: writing_center.php');
    exit;
}
if ((int)$series['created_by'] !== (int)$_SESSION['user_id']) {
    $studioId = isset($series['studio_id']) ? (int)$series['studio_id'] : 0;
    if (!$studioId || !userHasStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'series')) {
        header('Location: writing_center.php');
        exit;
    }
}

$universes = [];
try {
    [$universeWhere, $universeParams] = buildStudioVisibilityWhere('u', (int)$_SESSION['user_id'], 'universes');
    $stmt = $pdo->prepare("SELECT u.id, u.title FROM universes u WHERE {$universeWhere} ORDER BY u.title ASC");
    $stmt->execute($universeParams);
    $universes = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    $stmt = $pdo->prepare("SELECT id, title FROM universes WHERE created_by = ? OR user_id = ? ORDER BY title ASC");
    $stmt->execute([(int)$_SESSION['user_id'], (int)$_SESSION['user_id']]);
    $universes = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

$studios = [];
try {
    $studios = getUserStudios($pdo, (int)$_SESSION['user_id']);
} catch (Throwable $e) {
    $studios = [];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
    $title = trim($_POST['title'] ?? '');
    $description = trim($_POST['description'] ?? '');
    $status = $_POST['status'] ?? 'ongoing';
    $studio_id = !empty($_POST['studio_id']) ? (int)$_POST['studio_id'] : null;
    $universe_id = !empty($_POST['universe_id']) ? (int)$_POST['universe_id'] : null;
    $visibility = normalizeVisibility($_POST['visibility'] ?? 'private', $studio_id);
    if ($studio_id && !in_array($studio_id, array_column($studios, 'id'), true)) {
        $studio_id = null;
    }
    enforceStudioPermission($pdo, $studio_id, (int)$_SESSION['user_id'], 'series');

    $cover_image = $series['cover_image'];
    if (isset($_FILES['cover_image']) && $_FILES['cover_image']['error'] === 0) {
        $upload_dir = 'uploads/series/';
        if (!file_exists($upload_dir)) {
            mkdir($upload_dir, 0777, true);
        }

        $file_extension = strtolower(pathinfo($_FILES['cover_image']['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (!in_array($file_extension, $allowed, true)) {
            $error = 'Invalid cover image type. Allowed: ' . implode(', ', $allowed);
        }
        $file_name = uniqid('series_') . '.' . $file_extension;
        $upload_path = $upload_dir . $file_name;

        if (empty($error)) {
            if (move_uploaded_file($_FILES['cover_image']['tmp_name'], $upload_path)) {
                if ($cover_image && file_exists($cover_image)) {
                    unlink($cover_image);
                }
                $cover_image = $upload_path;
            } else {
                $error = 'Failed to upload cover image';
            }
        }
    }

    if (empty($error)) {
    try {
        $stmt = $pdo->prepare("
            UPDATE series
            SET title = ?, description = ?, universe_id = ?, studio_id = ?,
                cover_image = ?, status = ?, visibility = ?
            WHERE id = ?
        ");
        $stmt->execute([
            $title,
            $description,
            $universe_id,
            $studio_id,
            $cover_image,
            $status,
            $visibility,
            $series_id
        ]);

        header('Location: series.php?id=' . $series_id);
        exit;

    } catch (Exception $e) {
        $error = 'Failed to update series: ' . $e->getMessage();
    }
    }
    } catch (Throwable $e) {
        $error = 'Failed to update series. Please try again.';
        error_log('Edit series error: ' . $e->getMessage());
    }
}
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Edit Series - <?php echo htmlspecialchars($series['title']); ?></title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/series.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>

        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>

            <main class="main-content">
                <h1>Edit Series</h1>

                <?php if (isset($error)): ?>
                    <div class="error-message"><?php echo htmlspecialchars($error); ?></div>
                <?php endif; ?>

                <form method="POST" enctype="multipart/form-data" class="series-form">
                    <div class="form-group">
                        <label for="title">Series Title</label>
                        <input type="text" id="title" name="title" value="<?php echo htmlspecialchars($series['title']); ?>" required>
                    </div>

                    <div class="form-group">
                        <label for="description">Description</label>
                        <textarea id="description" name="description" required><?php echo htmlspecialchars($series['description']); ?></textarea>
                    </div>

                    <?php if (!empty($studios)): ?>
                    <div class="form-group">
                        <label for="studio_id">Studio (Optional)</label>
                        <select name="studio_id" id="studio_id">
                            <option value="">Independent / No Studio</option>
                            <?php foreach ($studios as $studio): ?>
                                <option value="<?php echo $studio['id']; ?>"
                                    <?php echo (int)($series['studio_id'] ?? 0) === (int)$studio['id'] ? 'selected' : ''; ?>
                                >
                                    <?php echo htmlspecialchars($studio['name']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <?php endif; ?>

                    <?php if (!empty($universes)): ?>
                    <div class="form-group">
                        <label for="universe_id">Part of Universe (Optional)</label>
                        <select name="universe_id" id="universe_id">
                            <option value="">Standalone Series</option>
                            <?php foreach ($universes as $universe): ?>
                                <option value="<?php echo $universe['id']; ?>"
                                    <?php echo (int)$series['universe_id'] === (int)$universe['id'] ? 'selected' : ''; ?>
                                >
                                    <?php echo htmlspecialchars($universe['title']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <?php endif; ?>

                    <div class="form-group">
                        <label for="status">Status</label>
                        <select id="status" name="status" required>
                            <option value="ongoing" <?php echo $series['status'] === 'ongoing' ? 'selected' : ''; ?>>Ongoing</option>
                            <option value="completed" <?php echo $series['status'] === 'completed' ? 'selected' : ''; ?>>Completed</option>
                            <option value="planned" <?php echo $series['status'] === 'planned' ? 'selected' : ''; ?>>Planned</option>
                            <option value="on_hold" <?php echo $series['status'] === 'on_hold' ? 'selected' : ''; ?>>On Hold</option>
                            <option value="cancelled" <?php echo $series['status'] === 'cancelled' ? 'selected' : ''; ?>>Cancelled</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="visibility">Visibility</label>
                        <select id="visibility" name="visibility">
                            <?php $currentVisibility = $series['visibility'] ?? 'private'; ?>
                            <option value="private" <?php echo $currentVisibility === 'private' ? 'selected' : ''; ?>>Private</option>
                            <option value="studio" <?php echo $currentVisibility === 'studio' ? 'selected' : ''; ?>>Studio</option>
                            <option value="public" <?php echo $currentVisibility === 'public' ? 'selected' : ''; ?>>Public</option>
                        </select>
                        <div class="helper-text">Studio/Public apply only when a studio is selected.</div>
                    </div>

                    <div class="form-group">
                        <label>Current Cover Image</label>
                        <?php if ($series['cover_image']): ?>
                            <div class="current-thumbnail">
                                <img src="<?php echo htmlspecialchars($series['cover_image']); ?>" alt="Current cover">
                            </div>
                        <?php else: ?>
                            <p class="no-thumbnail">No cover image set</p>
                        <?php endif; ?>
                    </div>

                    <div class="form-group">
                        <label for="cover_image">New Cover Image (optional)</label>
                        <input type="file" id="cover_image" name="cover_image" accept="image/*">
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn primary-btn">Save Changes</button>
                        <a href="series.php?id=<?php echo $series_id; ?>" class="btn secondary-btn">Cancel</a>
                    </div>
                </form>
            </main>
        </div>

        <?php include 'includes/footer.php'; ?>
    </div>
</body>
</html>
