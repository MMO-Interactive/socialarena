<?php
require_once 'includes/db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$theme = $_SESSION['theme'] ?? 'dark';
$user_id = (int)$_SESSION['user_id'];

$stmt = $pdo->prepare("SELECT * FROM talent_profiles WHERE user_id = ?");
$stmt->execute([$user_id]);
$profile = $stmt->fetch(PDO::FETCH_ASSOC);

$roleStmt = $pdo->query("SELECT id, name FROM talent_roles ORDER BY name ASC");
$roleOptions = $roleStmt->fetchAll(PDO::FETCH_ASSOC);

$portfolioItems = [];
if ($profile) {
    $stmt = $pdo->prepare("SELECT * FROM talent_portfolio_items WHERE profile_id = ? ORDER BY created_at DESC");
    $stmt->execute([(int)$profile['id']]);
    $portfolioItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
}

$selectedRoles = [];
$primaryRole = '';
if ($profile) {
    $stmt = $pdo->prepare("
        SELECT tr.id, tr.name, tpr.is_primary
        FROM talent_profile_roles tpr
        JOIN talent_roles tr ON tpr.role_id = tr.id
        WHERE tpr.profile_id = ?
    ");
    $stmt->execute([(int)$profile['id']]);
    $roleRows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($roleRows as $row) {
        $selectedRoles[] = (int)$row['id'];
        if ((int)$row['is_primary'] === 1) {
            $primaryRole = $row['name'];
        }
    }
}

function uploadTalentFile(string $field, string $prefix): ?string {
    if (empty($_FILES[$field]['name'])) {
        return null;
    }
    $file = $_FILES[$field];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Upload failed');
    }
    $allowed = ['jpg', 'jpeg', 'png', 'webp'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowed, true)) {
        throw new Exception('Invalid file type');
    }
    $dir = 'uploads/talent/';
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    $filename = $prefix . '_' . uniqid('', true) . '.' . $ext;
    $path = $dir . $filename;
    if (!move_uploaded_file($file['tmp_name'], $path)) {
        throw new Exception('Upload failed');
    }
    return $path;
}

function uploadTalentAudio(string $field): ?array {
    if (empty($_FILES[$field]['name'])) {
        return null;
    }
    $file = $_FILES[$field];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Audio upload failed');
    }
    $allowed = ['mp3', 'wav', 'ogg', 'm4a'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowed, true)) {
        throw new Exception('Invalid audio type');
    }
    $dir = 'uploads/talent_audio/';
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    $fileName = basename($file['name']);
    $stored = 'audio_' . uniqid('', true) . '.' . $ext;
    $path = $dir . $stored;
    if (!move_uploaded_file($file['tmp_name'], $path)) {
        throw new Exception('Audio upload failed');
    }
    return ['path' => $path, 'name' => $fileName];
}

function uploadTalentAttachment(string $field): ?array {
    if (empty($_FILES[$field]['name'])) {
        return null;
    }
    $file = $_FILES[$field];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('File upload failed');
    }
    $allowed = ['pdf', 'zip'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowed, true)) {
        throw new Exception('Invalid file type');
    }
    $dir = 'uploads/talent_files/';
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    $fileName = basename($file['name']);
    $stored = 'file_' . uniqid('', true) . '.' . $ext;
    $path = $dir . $stored;
    if (!move_uploaded_file($file['tmp_name'], $path)) {
        throw new Exception('File upload failed');
    }
    return ['path' => $path, 'name' => $fileName];
}

function uploadTalentImage(string $field): ?array {
    if (empty($_FILES[$field]['name'])) {
        return null;
    }
    $file = $_FILES[$field];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Image upload failed');
    }
    $allowed = ['jpg', 'jpeg', 'png', 'webp'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowed, true)) {
        throw new Exception('Invalid image type');
    }
    $dir = 'uploads/talent_images/';
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    $fileName = basename($file['name']);
    $stored = 'image_' . uniqid('', true) . '.' . $ext;
    $path = $dir . $stored;
    if (!move_uploaded_file($file['tmp_name'], $path)) {
        throw new Exception('Image upload failed');
    }
    return ['path' => $path, 'name' => $fileName];
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !empty($_POST['action'])) {
    if (!$profile) {
        $error = 'Create your profile before adding portfolio items.';
    } else {
        $action = $_POST['action'];
        try {
            if ($action === 'add_portfolio') {
                $itemType = $_POST['item_type'] ?? 'link';
                $itemTitle = trim($_POST['item_title'] ?? '');
                $itemDesc = trim($_POST['item_description'] ?? '');
                $itemUrl = trim($_POST['item_url'] ?? '');
                $fileName = null;
                if ($itemTitle === '') {
                    throw new Exception('Portfolio item title is required.');
                }
                if ($itemType === 'audio') {
                    $upload = uploadTalentAudio('item_audio');
                    if (!$upload) {
                        throw new Exception('Upload an audio file.');
                    }
                    $itemUrl = $upload['path'];
                    $fileName = $upload['name'];
                } elseif ($itemType === 'image') {
                    $upload = uploadTalentImage('item_image');
                    if (!$upload) {
                        throw new Exception('Upload an image.');
                    }
                    $itemUrl = $upload['path'];
                    $fileName = $upload['name'];
                } elseif ($itemType === 'file') {
                    $upload = uploadTalentAttachment('item_file');
                    if (!$upload) {
                        throw new Exception('Upload a PDF or ZIP file.');
                    }
                    $itemUrl = $upload['path'];
                    $fileName = $upload['name'];
                } else {
                    if ($itemUrl === '') {
                        throw new Exception('Portfolio link is required.');
                    }
                }
                $stmt = $pdo->prepare("
                    INSERT INTO talent_portfolio_items
                    (profile_id, item_type, title, description, item_url, file_name)
                    VALUES (?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([(int)$profile['id'], $itemType, $itemTitle, $itemDesc, $itemUrl, $fileName]);
                header('Location: talent_submit.php');
                exit;
            }
            if ($action === 'delete_portfolio') {
                $itemId = (int)($_POST['item_id'] ?? 0);
                if ($itemId) {
                    $stmt = $pdo->prepare("SELECT item_type, item_url FROM talent_portfolio_items WHERE id = ? AND profile_id = ?");
                    $stmt->execute([$itemId, (int)$profile['id']]);
                    $item = $stmt->fetch(PDO::FETCH_ASSOC);
                    if ($item) {
                        $stmt = $pdo->prepare("DELETE FROM talent_portfolio_items WHERE id = ?");
                        $stmt->execute([$itemId]);
                        if ($item['item_type'] === 'audio' && !empty($item['item_url'])) {
                            $path = __DIR__ . '/' . $item['item_url'];
                            if (is_file($path)) {
                                @unlink($path);
                            }
                        }
                    }
                }
                header('Location: talent_submit.php');
                exit;
            }
        } catch (Exception $e) {
            $error = $e->getMessage();
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $display_name = trim($_POST['display_name'] ?? '');
    $headline = trim($_POST['headline'] ?? '');
    $bio = trim($_POST['bio'] ?? '');
    $location = trim($_POST['location'] ?? '');
    $website = trim($_POST['website'] ?? '');
    $contact_email = trim($_POST['contact_email'] ?? '');
    $availability = $_POST['availability'] ?? 'available';
    $is_public = isset($_POST['is_public']) ? 1 : 0;
    $roleIds = $_POST['roles'] ?? [];
    $primaryRoleName = trim($_POST['primary_role'] ?? '');
    $customRoles = array_filter(array_map('trim', explode(',', $_POST['custom_roles'] ?? '')));

    if ($display_name === '') {
        $error = 'Display name is required.';
    }

    $avatar_url = $profile['avatar_url'] ?? null;
    $banner_url = $profile['banner_url'] ?? null;

    if (empty($error) && empty($_POST['action'])) {
        try {
            $avatarUpload = uploadTalentFile('avatar', 'avatar');
            if ($avatarUpload) {
                $avatar_url = $avatarUpload;
            }
            $bannerUpload = uploadTalentFile('banner', 'banner');
            if ($bannerUpload) {
                $banner_url = $bannerUpload;
            }

            if ($profile) {
                $stmt = $pdo->prepare("
                    UPDATE talent_profiles
                    SET display_name = ?, headline = ?, bio = ?, location = ?, website = ?, contact_email = ?,
                        availability = ?, avatar_url = ?, banner_url = ?, is_public = ?
                    WHERE id = ? AND user_id = ?
                ");
                $stmt->execute([
                    $display_name, $headline, $bio, $location, $website, $contact_email,
                    $availability, $avatar_url, $banner_url, $is_public,
                    (int)$profile['id'], $user_id
                ]);
                $profileId = (int)$profile['id'];
            } else {
                $stmt = $pdo->prepare("
                    INSERT INTO talent_profiles
                    (user_id, display_name, headline, bio, location, website, contact_email, availability, avatar_url, banner_url, is_public)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ");
                $stmt->execute([
                    $user_id, $display_name, $headline, $bio, $location, $website, $contact_email,
                    $availability, $avatar_url, $banner_url, $is_public
                ]);
                $profileId = (int)$pdo->lastInsertId();
            }

            foreach ($customRoles as $roleName) {
                $stmt = $pdo->prepare("SELECT id FROM talent_roles WHERE name = ?");
                $stmt->execute([$roleName]);
                $roleId = $stmt->fetchColumn();
                if (!$roleId) {
                    $stmt = $pdo->prepare("INSERT INTO talent_roles (name) VALUES (?)");
                    $stmt->execute([$roleName]);
                    $roleId = (int)$pdo->lastInsertId();
                }
                $roleIds[] = (string)$roleId;
            }

            $roleIds = array_unique(array_filter($roleIds));
            $stmt = $pdo->prepare("DELETE FROM talent_profile_roles WHERE profile_id = ?");
            $stmt->execute([$profileId]);
            foreach ($roleIds as $roleId) {
                $roleId = (int)$roleId;
                $stmt = $pdo->prepare("SELECT name FROM talent_roles WHERE id = ?");
                $stmt->execute([$roleId]);
                $roleName = $stmt->fetchColumn();
                $isPrimary = ($primaryRoleName !== '' && $roleName === $primaryRoleName) ? 1 : 0;
                $stmt = $pdo->prepare("
                    INSERT INTO talent_profile_roles (profile_id, role_id, is_primary)
                    VALUES (?, ?, ?)
                ");
                $stmt->execute([$profileId, $roleId, $isPrimary]);
            }

            header('Location: talent_profile.php?id=' . $profileId);
            exit;
        } catch (Exception $e) {
            $error = $e->getMessage();
        }
    }
}

?>

<!DOCTYPE html>
<html lang="en" data-theme="<?php echo $theme; ?>">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Submit Talent Profile</title>
    <link rel="stylesheet" href="css/themes/<?php echo $theme; ?>.css">
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="css/talent.css">
</head>
<body>
    <div class="page-wrapper">
        <?php include 'includes/header.php'; ?>
        <div class="content-wrapper">
            <?php include 'includes/navigation.php'; ?>
            <main class="main-content">
                <h1>Submit to Talent Scout</h1>
                <?php if (!empty($error)): ?>
                    <div class="error-message"><?php echo htmlspecialchars($error); ?></div>
                <?php endif; ?>
                <form method="POST" enctype="multipart/form-data" class="talent-form">
                    <div class="form-group">
                        <label for="display_name">Display Name</label>
                        <input id="display_name" name="display_name" type="text" required value="<?php echo htmlspecialchars($profile['display_name'] ?? ''); ?>">
                    </div>
                    <div class="form-group">
                        <label for="headline">Headline</label>
                        <input id="headline" name="headline" type="text" value="<?php echo htmlspecialchars($profile['headline'] ?? ''); ?>">
                    </div>
                    <div class="form-group">
                        <label for="bio">Bio</label>
                        <textarea id="bio" name="bio"><?php echo htmlspecialchars($profile['bio'] ?? ''); ?></textarea>
                    </div>
                    <div class="form-group">
                        <label for="location">Location</label>
                        <input id="location" name="location" type="text" value="<?php echo htmlspecialchars($profile['location'] ?? ''); ?>">
                    </div>
                    <div class="form-group">
                        <label for="website">Portfolio / Website</label>
                        <input id="website" name="website" type="text" value="<?php echo htmlspecialchars($profile['website'] ?? ''); ?>">
                    </div>
                    <div class="form-group">
                        <label for="contact_email">Contact Email</label>
                        <input id="contact_email" name="contact_email" type="email" value="<?php echo htmlspecialchars($profile['contact_email'] ?? ''); ?>">
                    </div>
                    <div class="form-group">
                        <label for="availability">Availability</label>
                        <select id="availability" name="availability">
                            <?php $availability = $profile['availability'] ?? 'available'; ?>
                            <option value="available" <?php echo $availability === 'available' ? 'selected' : ''; ?>>Available</option>
                            <option value="limited" <?php echo $availability === 'limited' ? 'selected' : ''; ?>>Limited</option>
                            <option value="unavailable" <?php echo $availability === 'unavailable' ? 'selected' : ''; ?>>Unavailable</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="roles">Roles</label>
                        <select id="roles" name="roles[]" multiple>
                            <?php foreach ($roleOptions as $role): ?>
                                <option value="<?php echo (int)$role['id']; ?>" <?php echo in_array((int)$role['id'], $selectedRoles, true) ? 'selected' : ''; ?>>
                                    <?php echo htmlspecialchars($role['name']); ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                        <div class="helper-text">Select all roles that apply.</div>
                    </div>
                    <div class="form-group">
                        <label for="primary_role">Primary Role (optional)</label>
                        <input id="primary_role" name="primary_role" type="text" value="<?php echo htmlspecialchars($primaryRole); ?>" placeholder="e.g. Voice Actor">
                    </div>
                    <div class="form-group">
                        <label for="custom_roles">Custom Roles (comma-separated)</label>
                        <input id="custom_roles" name="custom_roles" type="text" placeholder="e.g. Foley Artist, Story Consultant">
                    </div>
                    <div class="form-group">
                        <label for="avatar">Avatar</label>
                        <input id="avatar" name="avatar" type="file" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label for="banner">Banner</label>
                        <input id="banner" name="banner" type="file" accept="image/*">
                    </div>
                    <div class="form-group toggle">
                        <label><input type="checkbox" name="is_public" <?php echo !isset($profile['is_public']) || (int)$profile['is_public'] === 1 ? 'checked' : ''; ?>> List my profile publicly</label>
                    </div>
                    <div class="form-actions">
                        <button class="btn primary-btn" type="submit">Save Profile</button>
                        <a class="btn secondary-btn" href="talent_scout.php">Cancel</a>
                    </div>
                </form>

                <section class="talent-portfolio">
                    <h2>Portfolio Items</h2>
                    <div class="portfolio-list">
                        <?php if (empty($portfolioItems)): ?>
                            <p class="muted">No portfolio items yet.</p>
                        <?php else: ?>
                            <?php foreach ($portfolioItems as $item): ?>
                                <div class="portfolio-item">
                                    <div>
                                        <strong><?php echo htmlspecialchars($item['title']); ?></strong>
                                        <span class="muted"><?php echo htmlspecialchars($item['item_type']); ?></span>
                                        <?php if (!empty($item['description'])): ?>
                                            <p><?php echo htmlspecialchars($item['description']); ?></p>
                                        <?php endif; ?>
                                <?php if ($item['item_type'] === 'audio'): ?>
                                    <audio controls>
                                        <source src="talent_audio_stream.php?file=<?php echo urlencode($item['item_url']); ?>">
                                    </audio>
                                <?php elseif ($item['item_type'] === 'image'): ?>
                                    <img class="portfolio-image" src="<?php echo htmlspecialchars($item['item_url']); ?>" alt="">
                                <?php elseif ($item['item_type'] === 'file'): ?>
                                    <a href="talent_file_download.php?file=<?php echo urlencode($item['item_url']); ?>" target="_blank">
                                        Download <?php echo htmlspecialchars($item['file_name'] ?? 'file'); ?>
                                    </a>
                                <?php else: ?>
                                    <a href="<?php echo htmlspecialchars($item['item_url']); ?>" target="_blank">Open link</a>
                                <?php endif; ?>
                                    </div>
                                    <form method="POST">
                                        <input type="hidden" name="action" value="delete_portfolio">
                                        <input type="hidden" name="item_id" value="<?php echo (int)$item['id']; ?>">
                                        <button class="btn danger-btn" type="submit">Remove</button>
                                    </form>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>

                    <form method="POST" enctype="multipart/form-data" class="portfolio-form">
                        <input type="hidden" name="action" value="add_portfolio">
                        <div class="form-group">
                            <label for="item_title">Title</label>
                            <input id="item_title" name="item_title" type="text" required>
                        </div>
                        <div class="form-group">
                            <label for="item_type">Type</label>
                            <select id="item_type" name="item_type">
                                <option value="link">Link</option>
                                <option value="audio">Audio</option>
                                <option value="file">PDF / ZIP</option>
                                <option value="image">Image</option>
                            </select>
                        </div>
                        <div class="form-group" id="portfolio-link-row">
                            <label for="item_url">Link URL</label>
                            <input id="item_url" name="item_url" type="text">
                        </div>
                        <div class="form-group hidden" id="portfolio-audio-row">
                            <label for="item_audio">Audio Upload</label>
                            <input id="item_audio" name="item_audio" type="file" accept="audio/*">
                        </div>
                        <div class="form-group hidden" id="portfolio-file-row">
                            <label for="item_file">File Upload</label>
                            <input id="item_file" name="item_file" type="file" accept=".pdf,.zip">
                        </div>
                        <div class="form-group hidden" id="portfolio-image-row">
                            <label for="item_image">Image Upload</label>
                            <input id="item_image" name="item_image" type="file" accept="image/*">
                        </div>
                        <div class="form-group">
                            <label for="item_description">Description</label>
                            <textarea id="item_description" name="item_description"></textarea>
                        </div>
                        <button class="btn" type="submit">Add Portfolio Item</button>
                    </form>
                </section>
            </main>
        </div>
    </div>

    <script>
        const itemTypeSelect = document.getElementById('item_type');
        const linkRow = document.getElementById('portfolio-link-row');
        const audioRow = document.getElementById('portfolio-audio-row');
        const fileRow = document.getElementById('portfolio-file-row');
        const imageRow = document.getElementById('portfolio-image-row');
        if (itemTypeSelect) {
            const syncRows = () => {
                const isAudio = itemTypeSelect.value === 'audio';
                const isFile = itemTypeSelect.value === 'file';
                const isImage = itemTypeSelect.value === 'image';
                linkRow.classList.toggle('hidden', isAudio || isFile || isImage);
                audioRow.classList.toggle('hidden', !isAudio);
                fileRow.classList.toggle('hidden', !isFile);
                imageRow.classList.toggle('hidden', !isImage);
            };
            itemTypeSelect.addEventListener('change', syncRows);
            syncRows();
        }
    </script>
</body>
</html>
