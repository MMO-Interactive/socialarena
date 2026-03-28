<?php
ob_start();
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

// Get universe ID from URL
$universe_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

// Get universe details
$stmt = $pdo->prepare("SELECT * FROM universes WHERE id = ?");
$stmt->execute([$universe_id]);
$universe = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$universe) {
    die('Universe not found');
}
if ((int)$universe['user_id'] !== (int)$_SESSION['user_id']) {
    $studioId = isset($universe['studio_id']) ? (int)$universe['studio_id'] : 0;
    if (!$studioId || !userHasStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'universes')) {
        die('Unauthorized');
    }
}

$error = '';
$studios = [];
try {
    $studios = getUserStudios($pdo, (int)$_SESSION['user_id']);
} catch (Throwable $e) {
    $studios = [];
}

// Set page title and additional CSS
$page_title = "Edit Universe - " . htmlspecialchars($universe['title']);
$additional_css = ['css/edit_universe.css'];

include 'includes/header.php';

// Set default date format if none exists
$dateFormat = [];
if (!empty($universe['date_format'])) {
    $dateFormat = json_decode($universe['date_format'], true);
}

// Fallback to default format if json_decode fails or is empty
if (empty($dateFormat)) {
    $dateFormat = [
        'calendar_type' => 'standard',
        'eras' => ['BE', 'AE'],
        'era_names' => ['Before Event', 'After Event'],
        'divisions' => ['Early', 'Mid', 'Late'],
        'custom_months' => [],
        'custom_divisions' => []
    ];
}
?>

<?php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $title = trim($_POST['title'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $studio_id = !empty($_POST['studio_id']) ? (int)$_POST['studio_id'] : null;
        $visibility = normalizeVisibility($_POST['visibility'] ?? 'private', $studio_id);
        if ($studio_id && !in_array($studio_id, array_column($studios, 'id'), true)) {
            $studio_id = null;
        }
        enforceStudioPermission($pdo, $studio_id, (int)$_SESSION['user_id'], 'universes');

        $cover_image = $universe['cover_image'] ?? null;
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
                    if (!empty($cover_image) && file_exists($cover_image)) {
                        unlink($cover_image);
                    }
                    $cover_image = $upload_path;
                } else {
                    $error = 'Failed to upload cover image';
                }
            }
        }

        $calendar_type = $_POST['calendar_type'] ?? 'standard';
        $eras = $_POST['eras'] ?? [];
        $era_names = $_POST['era_names'] ?? [];
        $divisions = $_POST['divisions'] ?? [];
        $custom_months = $_POST['custom_months'] ?? [];
        $custom_divisions = $_POST['custom_divisions'] ?? [];
        $date_description = $_POST['date_description'] ?? '';

        $date_format = [
            'calendar_type' => $calendar_type,
            'eras' => array_values(array_filter($eras)),
            'era_names' => array_values(array_filter($era_names)),
            'divisions' => array_values(array_filter($divisions)),
            'custom_months' => array_values(array_filter($custom_months)),
            'custom_divisions' => array_values(array_filter($custom_divisions))
        ];

        if (empty($error)) {
            $stmt = $pdo->prepare("
                UPDATE universes
                SET title = ?, description = ?, cover_image = ?,
                    date_format = ?, date_description = ?,
                    studio_id = ?, visibility = ?, last_modified_by = ?
                WHERE id = ?
            ");
            $stmt->execute([
                $title,
                $description,
                $cover_image,
                json_encode($date_format),
                $date_description,
                $studio_id,
                $visibility,
                (int)$_SESSION['user_id'],
                $universe_id
            ]);
            header('Location: universe.php?id=' . $universe_id);
            exit;
        }
    } catch (Throwable $e) {
        $error = 'Failed to update universe. Please try again.';
        error_log('Edit universe error: ' . $e->getMessage());
    }
}
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        
        <main class="main-content">
            <div class="universe-form-container">
                <h1>Edit Universe</h1>

                <?php if (!empty($error)): ?>
                    <div class="error-message"><?php echo htmlspecialchars($error); ?></div>
                <?php endif; ?>
                <h2><?php echo htmlspecialchars($universe['title']); ?></h2>

                <form id="edit-universe-form" method="POST" enctype="multipart/form-data">
                    <div class="form-section">
                        <h3>Basic Information</h3>
                        <div class="form-group">
                            <label>Title</label>
                            <input type="text" name="title" value="<?php echo htmlspecialchars($universe['title']); ?>" required>
                        </div>

                        <div class="form-group">
                            <label>Description</label>
                            <textarea name="description" required><?php echo htmlspecialchars($universe['description']); ?></textarea>
                        </div>

                        <div class="form-group">
                            <label>Cover Image</label>
                            <?php if ($universe['cover_image']): ?>
                                <div class="current-image">
                                    <img src="<?php echo htmlspecialchars($universe['cover_image']); ?>" 
                                         alt="Current cover image">
                                </div>
                            <?php endif; ?>
                            <input type="file" name="cover_image" accept="image/*">
                            <div class="helper-text">Recommended size: 1200x400 pixels. Max file size: 2MB</div>
                        </div>
                        <div class="form-group">
                            <label>Studio (Optional)</label>
                            <select name="studio_id">
                                <option value="">Personal</option>
                                <?php foreach ($studios as $studio): ?>
                                    <option value="<?php echo (int)$studio['id']; ?>" <?php echo (int)($universe['studio_id'] ?? 0) === (int)$studio['id'] ? 'selected' : ''; ?>>
                                        <?php echo htmlspecialchars($studio['name']); ?>
                                    </option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Visibility</label>
                            <select name="visibility">
                                <?php $currentVisibility = $universe['visibility'] ?? 'private'; ?>
                                <option value="private" <?php echo $currentVisibility === 'private' ? 'selected' : ''; ?>>Private</option>
                                <option value="studio" <?php echo $currentVisibility === 'studio' ? 'selected' : ''; ?>>Studio</option>
                                <option value="public" <?php echo $currentVisibility === 'public' ? 'selected' : ''; ?>>Public</option>
                            </select>
                            <div class="helper-text">Studio/Public apply only when a studio is selected.</div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Timeline Settings</h3>
                        <div class="form-group">
                            <label>Calendar Type</label>
                            <select name="calendar_type" id="calendar-type">
                                <option value="standard" <?php echo $dateFormat['calendar_type'] === 'standard' ? 'selected' : ''; ?>>Standard (Era/Year/Division)</option>
                                <option value="age" <?php echo $dateFormat['calendar_type'] === 'age' ? 'selected' : ''; ?>>Ages</option>
                                <option value="lunar" <?php echo $dateFormat['calendar_type'] === 'lunar' ? 'selected' : ''; ?>>Lunar Cycles</option>
                            </select>
                        </div>

                        <!-- Standard Calendar Settings -->
                        <div id="standard-settings" class="calendar-settings" <?php echo $dateFormat['calendar_type'] !== 'standard' ? 'style="display:none"' : ''; ?>>
                            <div class="form-group">
                                <label>Eras</label>
                                <div class="dynamic-list" id="era-list">
                                    <?php foreach ($dateFormat['eras'] as $i => $era): ?>
                                    <div class="list-item">
                                        <input type="text" name="eras[]" value="<?php echo htmlspecialchars($era); ?>" placeholder="Era Code (e.g., BE)">
                                        <input type="text" name="era_names[]" value="<?php echo htmlspecialchars($dateFormat['era_names'][$i]); ?>" placeholder="Era Name (e.g., Before Event)">
                                        <button type="button" class="remove-item">×</button>
                                    </div>
                                    <?php endforeach; ?>
                                </div>
                                <button type="button" class="add-item" data-target="era-list">Add Era</button>
                            </div>

                            <div class="form-group">
                                <label>Time Divisions</label>
                                <div class="dynamic-list" id="division-list">
                                    <?php foreach ($dateFormat['divisions'] as $division): ?>
                                    <div class="list-item">
                                        <input type="text" name="divisions[]" value="<?php echo htmlspecialchars($division); ?>" placeholder="Division (e.g., Early, Mid, Late)">
                                        <button type="button" class="remove-item">×</button>
                                    </div>
                                    <?php endforeach; ?>
                                </div>
                                <button type="button" class="add-item" data-target="division-list">Add Division</button>
                            </div>
                        </div>

                        <!-- Age-based Calendar Settings -->
                        <div id="age-settings" class="calendar-settings" <?php echo $dateFormat['calendar_type'] !== 'age' ? 'style="display:none"' : ''; ?>>
                            <div class="form-group">
                                <label>Ages</label>
                                <div class="dynamic-list" id="age-list">
                                    <?php foreach ($dateFormat['custom_divisions'] ?? [] as $age): ?>
                                    <div class="list-item">
                                        <input type="text" name="custom_divisions[]" value="<?php echo htmlspecialchars($age); ?>" placeholder="Age Name (e.g., First Age)">
                                        <button type="button" class="remove-item">×</button>
                                    </div>
                                    <?php endforeach; ?>
                                </div>
                                <button type="button" class="add-item" data-target="age-list">Add Age</button>
                            </div>
                        </div>

                        <!-- Lunar Calendar Settings -->
                        <div id="lunar-settings" class="calendar-settings" <?php echo $dateFormat['calendar_type'] !== 'lunar' ? 'style="display:none"' : ''; ?>>
                            <div class="form-group">
                                <label>Moon Cycles</label>
                                <div class="dynamic-list" id="moon-list">
                                    <?php foreach ($dateFormat['custom_months'] ?? [] as $moon): ?>
                                    <div class="list-item">
                                        <input type="text" name="custom_months[]" value="<?php echo htmlspecialchars($moon); ?>" placeholder="Moon Cycle Name">
                                        <button type="button" class="remove-item">×</button>
                                    </div>
                                    <?php endforeach; ?>
                                </div>
                                <button type="button" class="add-item" data-target="moon-list">Add Moon Cycle</button>
                            </div>
                        </div>

                        <div class="form-group">
                            <label>Date Format Description</label>
                            <textarea name="date_description" placeholder="Explain how dates work in your universe..."><?php echo htmlspecialchars($universe['date_description'] ?? ''); ?></textarea>
                            <div class="helper-text">This description will be shown when users are entering dates.</div>
                        </div>
                    </div>

                    <div class="form-actions">
                        <a href="universe.php?id=<?php echo $universe_id; ?>" class="btn cancel">Cancel</a>
                        <button type="submit" class="btn submit">Save Changes</button>
                    </div>
                </form>
            </div>
        </main>
    </div>
</div>

<script src="js/edit_universe.js"></script> 
