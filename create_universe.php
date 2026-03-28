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
    $visibility = normalizeVisibility($_POST['visibility'] ?? 'private', $studio_id);
    enforceStudioPermission($pdo, $studio_id, (int)$_SESSION['user_id'], 'universes');

    // Handle image upload
    $cover_image = null;
    if (isset($_FILES['cover_image']) && $_FILES['cover_image']['error'] === 0) {
        $upload_dir = 'uploads/universes/';
        if (!file_exists($upload_dir)) {
            mkdir($upload_dir, 0777, true);
        }
        
        $file_extension = strtolower(pathinfo($_FILES['cover_image']['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (!in_array($file_extension, $allowed, true)) {
            $error = 'Invalid cover image type. Allowed: ' . implode(', ', $allowed);
        }
        $file_name = uniqid('universe_') . '.' . $file_extension;
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
        // Insert universe
        try {
            $stmt = $pdo->prepare("
                INSERT INTO universes (
                    title, description, cover_image, user_id, created_by,
                    status, is_public, studio_id, visibility
                ) VALUES (?, ?, ?, ?, ?, 'active', true, ?, ?)
            ");
            $stmt->execute([
                $title,
                $description,
                $cover_image,
                $_SESSION['user_id'],
                $_SESSION['user_id'],
                $studio_id,
                $visibility
            ]);
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'Unknown column') === false) {
                throw $e;
            }
            // Fallback for older schema without user_id
            $stmt = $pdo->prepare("
                INSERT INTO universes (
                    title, description, cover_image, created_by, 
                    status, is_public
                ) VALUES (?, ?, ?, ?, 'active', true)
            ");
            $stmt->execute([$title, $description, $cover_image, $_SESSION['user_id']]);
        }
        $universe_id = $pdo->lastInsertId();

        header('Location: universe.php?id=' . $universe_id);
        exit;

    } catch (Exception $e) {
        $error = "Failed to create universe: " . $e->getMessage();
    }
    }
    } catch (Throwable $e) {
        $error = 'Failed to create universe. Please try again.';
        error_log('Create universe error: ' . $e->getMessage());
    }
}
$form = [
    'title' => $_POST['title'] ?? '',
    'description' => $_POST['description'] ?? '',
    'studio_id' => $_POST['studio_id'] ?? '',
    'visibility' => $_POST['visibility'] ?? 'private'
];
?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create Universe - Choose Your Own Adventure</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/universe.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>
        
        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>
            
            <main class="main-content">
                <h1>Create New Universe</h1>
                
                <?php if (isset($error)): ?>
                    <div class="error-message"><?php echo $error; ?></div>
                <?php endif; ?>

                <form method="POST" enctype="multipart/form-data" class="universe-form">
                    <div class="form-group">
                        <label for="title">Universe Title</label>
                        <div class="input-group">
                            <input type="text" id="title" name="title" required value="<?php echo htmlspecialchars($form['title']); ?>">
                            <button type="button" class="btn suggestion-btn" onclick="getUniverseTitleSuggestions()">
                                Get Title Ideas
                            </button>
                        </div>
                        <div id="title-suggestions" class="suggestions-container"></div>
                    </div>

                    <div class="form-group">
                        <label for="description">Description</label>
                        <div class="input-group">
                            <textarea id="description" name="description" required><?php echo htmlspecialchars($form['description']); ?></textarea>
                            <button type="button" class="btn suggestion-btn" onclick="getUniverseDescriptionSuggestions()">
                                Get Description Ideas
                            </button>
                        </div>
                        <div id="description-suggestions" class="suggestions-container"></div>
                    </div>

                    <div class="form-group">
                        <label for="cover_image">Cover Image</label>
                        <input type="file" id="cover_image" name="cover_image" accept="image/*">
                        <div class="helper-text">Recommended size: 1200x800 pixels</div>
                    </div>
                    <div class="form-group">
                        <label for="studio_id">Studio (Optional)</label>
                        <select id="studio_id" name="studio_id">
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
                        <select id="visibility" name="visibility">
                            <option value="private" <?php echo $form['visibility'] === 'private' ? 'selected' : ''; ?>>Private</option>
                            <option value="studio" <?php echo $form['visibility'] === 'studio' ? 'selected' : ''; ?>>Studio</option>
                            <option value="public" <?php echo $form['visibility'] === 'public' ? 'selected' : ''; ?>>Public</option>
                        </select>
                        <div class="helper-text">Studio/Public apply only when a studio is selected.</div>
                    </div>

                    <div class="form-actions">
                        <button type="submit" class="btn primary-btn">Create Universe</button>
                        <a href="writing_center.php" class="btn secondary-btn">Cancel</a>
                    </div>
                </form>
            </main>
        </div>
        
        <?php include 'includes/footer.php'; ?>
    </div>

    <script src="js/universe-suggestions.js"></script>
</body>
</html> 
