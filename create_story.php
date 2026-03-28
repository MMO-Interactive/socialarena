<?php
ob_start();
require_once 'includes/db_connect.php';
require_once 'includes/config.php';
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

// Get universes for dropdown
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

// Get series for dropdown (will be filtered by JavaScript based on selected universe)
$all_series = [];
try {
    [$seriesWhere, $seriesParams] = buildStudioVisibilityWhere('s', (int)$_SESSION['user_id'], 'series');
    $stmt = $pdo->prepare("
        SELECT s.id, s.title, s.universe_id, u.title as universe_title
        FROM series s
        LEFT JOIN universes u ON s.universe_id = u.id
        WHERE {$seriesWhere}
        ORDER BY s.universe_id, s.title
    ");
    $stmt->execute($seriesParams);
    $all_series = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Throwable $e) {
    $stmt = $pdo->prepare("
        SELECT s.id, s.title, s.universe_id, u.title as universe_title
        FROM series s
        LEFT JOIN universes u ON s.universe_id = u.id
        WHERE s.created_by = ? OR s.user_id = ?
        ORDER BY s.universe_id, s.title
    ");
    $stmt->execute([(int)$_SESSION['user_id'], (int)$_SESSION['user_id']]);
    $all_series = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

$studios = [];
try {
    $studios = getUserStudios($pdo, (int)$_SESSION['user_id']);
} catch (Throwable $e) {
    $studios = [];
}

// Pre-select universe and series if provided in URL
$selected_universe = isset($_GET['universe_id']) ? (int)$_GET['universe_id'] : null;
$selected_series = isset($_GET['series_id']) ? (int)$_GET['series_id'] : null;

// Handle form submission
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
    $title = trim($_POST['title']);
    $description = trim($_POST['description']);
    $genre = $_POST['genre'];
    $setting = trim($_POST['setting']);
    $main_character = trim($_POST['main_character'] ?? '');
    $universe_id = !empty($_POST['universe_id']) ? (int)$_POST['universe_id'] : null;
    $series_id = !empty($_POST['series_id']) ? (int)$_POST['series_id'] : null;
    $studio_id = !empty($_POST['studio_id']) ? (int)$_POST['studio_id'] : null;
    $visibility = normalizeVisibility($_POST['visibility'] ?? 'private', $studio_id);

    if (!$studio_id && $series_id) {
        $stmt = $pdo->prepare("SELECT studio_id FROM series WHERE id = ?");
        $stmt->execute([$series_id]);
        $studio_id = (int)$stmt->fetchColumn() ?: null;
        $visibility = normalizeVisibility($visibility, $studio_id);
    }
    enforceStudioPermission($pdo, $studio_id, (int)$_SESSION['user_id'], 'stories');

    // Handle image upload
    $thumbnail_url = null;
    if (isset($_FILES['thumbnail']) && $_FILES['thumbnail']['error'] === 0) {
        $upload_dir = 'uploads/stories/';
        if (!file_exists($upload_dir)) {
            mkdir($upload_dir, 0777, true);
        }
        
        $file_extension = strtolower(pathinfo($_FILES['thumbnail']['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (!in_array($file_extension, $allowed, true)) {
            $error = 'Invalid thumbnail type. Allowed: ' . implode(', ', $allowed);
        }
        $file_name = uniqid('story_') . '.' . $file_extension;
        $upload_path = $upload_dir . $file_name;
        
        if (empty($error)) {
            if (move_uploaded_file($_FILES['thumbnail']['tmp_name'], $upload_path)) {
                $thumbnail_url = $upload_path;
            } else {
                $error = 'Failed to upload thumbnail';
            }
        }
    }

    if (empty($error)) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO stories (
                title, description, genre, setting, main_character, thumbnail_url,
                universe_id, series_id, user_id, studio_id, visibility, created_by, status,
                is_ai_generated, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', false, NOW())
        ");
        $stmt->execute([
            $title, 
            $description, 
            $genre, 
            $setting,
            $main_character,
            $thumbnail_url,
            $universe_id, 
            $series_id, 
            $_SESSION['user_id'],
            $studio_id,
            $visibility,
            $_SESSION['user_id'],
        ]);
        
        $story_id = $pdo->lastInsertId();
        header('Location: edit_story.php?id=' . $story_id);
        exit;

    } catch (Exception $e) {
        $error = "Failed to create story: " . $e->getMessage();
    }
    }
    } catch (Throwable $e) {
        $error = 'Failed to create story. Please try again.';
        error_log('Create story error: ' . $e->getMessage());
    }
}
$form = [
    'title' => $_POST['title'] ?? '',
    'description' => $_POST['description'] ?? '',
    'genre' => $_POST['genre'] ?? 'Fantasy',
    'setting' => $_POST['setting'] ?? '',
    'main_character' => $_POST['main_character'] ?? '',
    'studio_id' => $_POST['studio_id'] ?? '',
    'visibility' => $_POST['visibility'] ?? 'private'
];
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create New Story - Choose Your Own Adventure</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/story.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>
        
        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>
            
            <main class="main-content">
                <h1>Create New Story</h1>
                
                <?php if (isset($error)): ?>
                    <div class="error-message"><?php echo $error; ?></div>
                <?php endif; ?>

                <form method="POST" enctype="multipart/form-data" class="story-form">
                    <!-- Universe Selection -->
                    <div class="form-group">
                        <label for="universe_id">Part of Universe (Optional)</label>
                        <select name="universe_id" id="universe_id" onchange="updateSeriesList()">
                            <option value="">Film</option>
                            <?php foreach ($universes as $universe): ?>
                                <option value="<?php echo $universe['id']; ?>"
                                        <?php echo $selected_universe === $universe['id'] ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($universe['title']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <!-- Series Selection -->
                    <div class="form-group" id="series-group">
                        <label for="series_id">Part of Series (Optional)</label>
                        <select name="series_id" id="series_id">
                            <option value="">Select a Series</option>
                            <?php foreach ($all_series as $series): ?>
                                <option value="<?php echo $series['id']; ?>" 
                                        data-universe="<?php echo $series['universe_id']; ?>"
                                        <?php echo $selected_series === $series['id'] ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($series['title']); ?>
                                    <?php if ($series['universe_title']): ?>
                                        (<?php echo htmlspecialchars($series['universe_title']); ?>)
                                    <?php endif; ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <!-- Story Details -->
                    <div class="form-group">
                        <label for="title">Story Title</label>
                        <div class="input-group">
                            <input type="text" id="title" name="title" required value="<?php echo htmlspecialchars($form['title']); ?>">
                            <button type="button" class="btn suggestion-btn" onclick="getStoryTitleSuggestions()">
                                <i class="fas fa-robot"></i> Get Title Ideas
                            </button>
                        </div>
                        <div id="title-suggestions" class="suggestions-container"></div>
                    </div>

                    <div class="form-group">
                        <label for="genre">Genre</label>
                        <select id="genre" name="genre" required>
                            <?php
                            $genres = ['Fantasy', 'Science Fiction', 'Mystery', 'Horror', 'Adventure', 'Romance'];
                            foreach ($genres as $g):
                            ?>
                                <option value="<?php echo $g; ?>" <?php echo $form['genre'] === $g ? 'selected' : ''; ?>>
                                    <?php echo $g; ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="setting">Setting</label>
                        <input type="text" id="setting" name="setting" required value="<?php echo htmlspecialchars($form['setting']); ?>">
                    </div>

                    <div class="form-group">
                        <label for="main_character">Main Character (Optional)</label>
                        <input type="text" id="main_character" name="main_character" value="<?php echo htmlspecialchars($form['main_character']); ?>">
                    </div>

                    <div class="form-group">
                        <label for="description">Story Description</label>
                        <div class="input-group">
                            <textarea id="description" name="description" required><?php echo htmlspecialchars($form['description']); ?></textarea>
                            <button type="button" class="btn suggestion-btn" onclick="getStoryDescriptionSuggestions()">
                                <i class="fas fa-robot"></i> Get Description Ideas
                            </button>
                        </div>
                        <div id="description-suggestions" class="suggestions-container"></div>
                    </div>

                    <div class="form-group">
                        <label for="thumbnail">Story Thumbnail</label>
                        <input type="file" id="thumbnail" name="thumbnail" accept="image/*">
                        <div class="helper-text">Recommended size: 800x600 pixels</div>
                    </div>
                    <div class="form-group">
                        <label for="studio_id">Studio (Optional)</label>
                        <select name="studio_id" id="studio_id">
                            <option value="">Personal</option>
                            <?php foreach ($studios as $studio): ?>
                                <option value="<?php echo (int)$studio['id']; ?>" <?php echo (string)$form['studio_id'] === (string)$studio['id'] ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($studio['name']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="visibility">Visibility</label>
                        <select name="visibility" id="visibility">
                            <option value="private" <?php echo $form['visibility'] === 'private' ? 'selected' : ''; ?>>Private</option>
                            <option value="studio" <?php echo $form['visibility'] === 'studio' ? 'selected' : ''; ?>>Studio</option>
                            <option value="public" <?php echo $form['visibility'] === 'public' ? 'selected' : ''; ?>>Public</option>
                        </select>
                        <div class="helper-text">Studio/Public apply only when a studio is selected.</div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn primary-btn">Create Story</button>
                        <a href="writing_center.php" class="btn secondary-btn">Cancel</a>
                    </div>
                </form>
            </main>
        </div>
        
        <?php include 'includes/footer.php'; ?>
    </div>

    <script>
    // Store all series data
    const allSeries = <?php echo json_encode($all_series); ?>;
    
    function updateSeriesList() {
        const universeId = document.getElementById('universe_id').value;
        const seriesGroup = document.getElementById('series-group');
        const seriesSelect = document.getElementById('series_id');
        
        // Clear current options
        seriesSelect.innerHTML = '<option value="">Select a Series</option>';
        
        if (universeId) {
            // Filter series for selected universe
            const filteredSeries = allSeries.filter(series => String(series.universe_id) === String(universeId));
            
            if (filteredSeries.length > 0) {
                filteredSeries.forEach(series => {
                    const option = document.createElement('option');
                    option.value = series.id;
                    option.textContent = series.title;
                    if (series.id === <?php echo $selected_series ?: 'null'; ?>) {
                        option.selected = true;
                    }
                    seriesSelect.appendChild(option);
                });
                seriesGroup.style.display = 'block';
            } else {
                seriesGroup.style.display = 'none';
            }
        } else {
            seriesGroup.style.display = 'none';
        }
    }

    // Initialize series list
    document.addEventListener('DOMContentLoaded', updateSeriesList);
    </script>
    <script src="js/story-suggestions.js"></script>
</body>
</html> 
