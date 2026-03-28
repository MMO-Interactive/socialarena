<?php
ob_start();
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

$theme = $_SESSION['theme'] ?? 'light';
$error = '';

// Get available universes for the dropdown
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

// Get studios the user owns or belongs to
$studios = [];
try {
    $studios = getUserStudios($pdo, (int)$_SESSION['user_id']);
} catch (Throwable $e) {
    $studios = [];
}

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
    $title = trim($_POST['title']);
    $description = trim($_POST['description']);
    $studio_id = !empty($_POST['studio_id']) ? (int)$_POST['studio_id'] : null;
    $universe_id = !empty($_POST['universe_id']) ? $_POST['universe_id'] : null;
    $visibility = normalizeVisibility($_POST['visibility'] ?? 'private', $studio_id);
    if ($studio_id && !in_array($studio_id, array_column($studios, 'id'), true)) {
        $studio_id = null;
    }
    enforceStudioPermission($pdo, $studio_id, (int)$_SESSION['user_id'], 'series');

    // Handle image upload
    $cover_image = null;
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
                $cover_image = $upload_path;
            } else {
                $error = 'Failed to upload cover image';
            }
        }
    }

    if (empty($error)) {
    try {
        try {
            $stmt = $pdo->prepare("
                INSERT INTO series (
                    title, description, universe_id, studio_id, cover_image,
                    user_id, created_by, status, visibility
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ongoing', ?)
            ");
            $stmt->execute([
                $title,
                $description,
                $universe_id,
                $studio_id,
                $cover_image,
                $_SESSION['user_id'],
                $_SESSION['user_id'],
                $visibility
            ]);
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Unknown column') === false) {
                throw $e;
            }
            // Fallback for older schema without user_id
            $stmt = $pdo->prepare("
                INSERT INTO series (
                    title, description, universe_id, cover_image, 
                    created_by, status
                ) VALUES (?, ?, ?, ?, ?, 'ongoing')
            ");
            $stmt->execute([$title, $description, $universe_id, $cover_image, $_SESSION['user_id']]);
        }
        
        $series_id = $pdo->lastInsertId();
        header('Location: series.php?id=' . $series_id);
        exit;

    } catch (Exception $e) {
        $error = "Failed to create series: " . $e->getMessage();
    }
    }
    } catch (Throwable $e) {
        $error = 'Failed to create series. Please try again.';
        error_log('Create series error: ' . $e->getMessage());
    }
}
$form = [
    'title' => $_POST['title'] ?? '',
    'description' => $_POST['description'] ?? '',
    'studio_id' => $_POST['studio_id'] ?? '',
    'universe_id' => $_POST['universe_id'] ?? '',
    'visibility' => $_POST['visibility'] ?? 'private'
];
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create Series - Choose Your Own Adventure</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/series.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>
        
        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>
            
            <main class="main-content">
                <h1>Create New Series</h1>
                
                <?php if (isset($error)): ?>
                    <div class="error-message"><?php echo $error; ?></div>
                <?php endif; ?>

                <form method="POST" enctype="multipart/form-data" class="series-form">
                    <?php if (!empty($studios)): ?>
                    <div class="form-group">
                        <label for="studio_id">Studio (Optional)</label>
                        <select name="studio_id" id="studio_id">
                            <option value="">Independent / No Studio</option>
                            <?php foreach ($studios as $studio): ?>
                                <option value="<?php echo $studio['id']; ?>" <?php echo (string)$form['studio_id'] === (string)$studio['id'] ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($studio['name']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <?php endif; ?>
                    <div class="form-group">
                        <label for="visibility">Visibility</label>
                        <select name="visibility" id="visibility">
                            <option value="private" <?php echo $form['visibility'] === 'private' ? 'selected' : ''; ?>>Private</option>
                            <option value="studio" <?php echo $form['visibility'] === 'studio' ? 'selected' : ''; ?>>Studio</option>
                            <option value="public" <?php echo $form['visibility'] === 'public' ? 'selected' : ''; ?>>Public</option>
                        </select>
                        <div class="helper-text">Studio/Public apply only when a studio is selected.</div>
                    </div>

                    <?php if (!empty($universes)): ?>
                    <div class="form-group">
                        <label for="universe_id">Part of Universe (Optional)</label>
                        <select name="universe_id" id="universe_id">
                            <option value="">Standalone Series</option>
                            <?php foreach ($universes as $universe): ?>
                                <option value="<?php echo $universe['id']; ?>" <?php echo (string)$form['universe_id'] === (string)$universe['id'] ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($universe['title']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <?php endif; ?>

                    <div class="form-group">
                        <label for="title">Series Title</label>
                        <div class="input-group">
                            <input type="text" id="title" name="title" required value="<?php echo htmlspecialchars($form['title']); ?>">
                            <button type="button" class="btn suggestion-btn" onclick="getSeriesTitleSuggestions()">
                                <i class="fas fa-robot"></i> Get Title Ideas
                            </button>
                        </div>
                        <div id="title-suggestions" class="suggestions-container"></div>
                    </div>

                    <div class="form-group">
                        <label for="description">Description</label>
                        <div class="input-group">
                            <textarea id="description" name="description" required><?php echo htmlspecialchars($form['description']); ?></textarea>
                            <button type="button" class="btn suggestion-btn" onclick="getSeriesDescriptionSuggestions()">
                                <i class="fas fa-robot"></i> Get Description Ideas
                            </button>
                        </div>
                        <div id="description-suggestions" class="suggestions-container"></div>
                    </div>

                    <div class="form-group">
                        <label for="cover_image">Cover Image</label>
                        <input type="file" id="cover_image" name="cover_image" accept="image/*">
                        <div class="helper-text">Recommended size: 1200x800 pixels</div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn primary-btn">Create Series</button>
                        <a href="writing_center.php" class="btn secondary-btn">Cancel</a>
                    </div>
                </form>
            </main>
        </div>
        
        <?php include 'includes/footer.php'; ?>
    </div>

    <script src="js/series-suggestions.js"></script>
</body>
</html> 
