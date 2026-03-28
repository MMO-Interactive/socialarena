<?php
require_once 'includes/db_connect.php';
require_once 'includes/config.php';
require_once 'includes/auth.php';

$studio_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
if (!$studio_id) {
    header('Location: studios.php');
    exit;
}

$stmt = $pdo->prepare("
    SELECT s.*, sm.role
    FROM studios s
    JOIN studio_members sm ON sm.studio_id = s.id
    WHERE s.id = ? AND sm.user_id = ?
");
$stmt->execute([$studio_id, $_SESSION['user_id']]);
$studio = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$studio) {
    header('Location: studios.php');
    exit;
}

$stmt = $pdo->prepare("
    SELECT u.id, u.username, u.email, sm.role
    FROM studio_members sm
    JOIN users u ON sm.user_id = u.id
    WHERE sm.studio_id = ?
    ORDER BY sm.role DESC, u.username ASC
");
$stmt->execute([$studio_id]);
$members = $stmt->fetchAll(PDO::FETCH_ASSOC);

$talentStmt = $pdo->prepare("
    SELECT * FROM studio_talent_requests
    WHERE studio_id = ?
    ORDER BY created_at DESC
");
$talentStmt->execute([$studio_id]);
$talentRequests = $talentStmt->fetchAll(PDO::FETCH_ASSOC);

$ytStmt = $pdo->prepare("SELECT * FROM studio_youtube_settings WHERE studio_id = ?");
$ytStmt->execute([$studio_id]);
$youtubeSettings = $ytStmt->fetch(PDO::FETCH_ASSOC);

$visualStmt = $pdo->prepare("
    SELECT id, title, image_url, created_at
    FROM studio_visual_posts
    WHERE studio_id = ?
    ORDER BY created_at DESC
");
$visualStmt->execute([$studio_id]);
$studioVisuals = $visualStmt->fetchAll(PDO::FETCH_ASSOC);

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['talent_action'])) {
    $action = $_POST['talent_action'];
    if ($action === 'add_request') {
        $title = trim($_POST['request_title'] ?? '');
        $description = trim($_POST['request_description'] ?? '');
        $roles = trim($_POST['request_roles'] ?? '');
        $tags = trim($_POST['request_tags'] ?? '');
        $location = trim($_POST['request_location'] ?? '');
        $compensation = trim($_POST['request_compensation'] ?? '');
        $contact = trim($_POST['request_contact'] ?? '');
        if ($title !== '') {
            $stmt = $pdo->prepare("
                INSERT INTO studio_talent_requests
                (studio_id, created_by, title, description, roles, tags, location, compensation, contact_email, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open')
            ");
            $stmt->execute([
                $studio_id,
                (int)$_SESSION['user_id'],
                $title,
                $description,
                $roles,
                $tags,
                $location,
                $compensation,
                $contact
            ]);
        }
        header('Location: studio_profile.php?id=' . $studio_id);
        exit;
    }
    if ($action === 'close_request') {
        $requestId = (int)($_POST['request_id'] ?? 0);
        if ($requestId) {
            $stmt = $pdo->prepare("UPDATE studio_talent_requests SET status = 'closed' WHERE id = ? AND studio_id = ?");
            $stmt->execute([$requestId, $studio_id]);
        }
        header('Location: studio_profile.php?id=' . $studio_id);
        exit;
    }
    if ($action === 'delete_request') {
        $requestId = (int)($_POST['request_id'] ?? 0);
        if ($requestId) {
            $stmt = $pdo->prepare("DELETE FROM studio_talent_requests WHERE id = ? AND studio_id = ?");
            $stmt->execute([$requestId, $studio_id]);
        }
        header('Location: studio_profile.php?id=' . $studio_id);
        exit;
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['studio_action']) && $_POST['studio_action'] === 'update_profile') {
    if ($studio['role'] !== 'owner' && $studio['role'] !== 'admin') {
        header('Location: studio_profile.php?id=' . $studio_id);
        exit;
    }
    $name = trim($_POST['studio_name'] ?? $studio['name']);
    $description = trim($_POST['studio_description'] ?? $studio['description']);
    $logoUrl = $studio['logo_url'];
    $bannerUrl = $studio['banner_url'];

    $upload_dir = __DIR__ . '/uploads/studios/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0777, true);
    }

    if (!empty($_FILES['studio_logo']) && $_FILES['studio_logo']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['studio_logo'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (in_array($ext, $allowed, true)) {
            $filename = 'studio_logo_' . $studio_id . '_' . uniqid() . '.' . $ext;
            $target = $upload_dir . $filename;
            if (move_uploaded_file($file['tmp_name'], $target)) {
                $logoUrl = 'uploads/studios/' . $filename;
            }
        }
    }

    if (!empty($_FILES['studio_banner']) && $_FILES['studio_banner']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['studio_banner'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (in_array($ext, $allowed, true)) {
            $filename = 'studio_banner_' . $studio_id . '_' . uniqid() . '.' . $ext;
            $target = $upload_dir . $filename;
            if (move_uploaded_file($file['tmp_name'], $target)) {
                $bannerUrl = 'uploads/studios/' . $filename;
            }
        }
    }

    $stmt = $pdo->prepare("UPDATE studios SET name = ?, description = ?, logo_url = ?, banner_url = ? WHERE id = ?");
    $stmt->execute([$name, $description, $logoUrl, $bannerUrl, $studio_id]);
    header('Location: studio_profile.php?id=' . $studio_id);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['studio_action']) && $_POST['studio_action'] === 'add_visual') {
    if ($studio['role'] !== 'owner' && $studio['role'] !== 'admin') {
        header('Location: studio_profile.php?id=' . $studio_id);
        exit;
    }
    $title = trim($_POST['visual_title'] ?? '');
    $imageUrl = '';
    $upload_dir = __DIR__ . '/uploads/studio_visuals/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0777, true);
    }
    if (!empty($_FILES['visual_image']) && $_FILES['visual_image']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['visual_image'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (in_array($ext, $allowed, true)) {
            $filename = 'studio_visual_' . $studio_id . '_' . uniqid() . '.' . $ext;
            $target = $upload_dir . $filename;
            if (move_uploaded_file($file['tmp_name'], $target)) {
                $imageUrl = 'uploads/studio_visuals/' . $filename;
            }
        }
    }
    if ($imageUrl !== '') {
        $stmt = $pdo->prepare("INSERT INTO studio_visual_posts (studio_id, title, image_url) VALUES (?, ?, ?)");
        $stmt->execute([$studio_id, $title !== '' ? $title : null, $imageUrl]);
    }
    header('Location: studio_profile.php?id=' . $studio_id);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['studio_action']) && $_POST['studio_action'] === 'delete_visual') {
    if ($studio['role'] !== 'owner' && $studio['role'] !== 'admin') {
        header('Location: studio_profile.php?id=' . $studio_id);
        exit;
    }
    $visualId = (int)($_POST['visual_id'] ?? 0);
    if ($visualId) {
        $stmt = $pdo->prepare("DELETE FROM studio_visual_posts WHERE id = ? AND studio_id = ?");
        $stmt->execute([$visualId, $studio_id]);
    }
    header('Location: studio_profile.php?id=' . $studio_id);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['youtube_action'])) {
    if ($studio['role'] !== 'owner' && $studio['role'] !== 'admin') {
        header('Location: studio_profile.php?id=' . $studio_id);
        exit;
    }
    if ($_POST['youtube_action'] === 'save_youtube') {
        $apiKey = trim($_POST['youtube_api_key'] ?? '');
        $channelHandle = trim($_POST['youtube_channel_handle'] ?? '');
        $channelId = trim($_POST['youtube_channel_id'] ?? '');
        $enabled = isset($_POST['youtube_enabled']) ? 1 : 0;
        if ($apiKey !== '') {
            $stmt = $pdo->prepare("
                INSERT INTO studio_youtube_settings (studio_id, api_key, channel_id, channel_handle, is_enabled)
                VALUES (?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE api_key = VALUES(api_key), channel_id = VALUES(channel_id), channel_handle = VALUES(channel_handle), is_enabled = VALUES(is_enabled)
            ");
            $stmt->execute([$studio_id, $apiKey, $channelId ?: null, $channelHandle ?: null, $enabled]);
        }
        header('Location: studio_profile.php?id=' . $studio_id);
        exit;
    }
}

$page_title = 'Studio Profile - ' . htmlspecialchars($studio['name']);
$additional_css = ['css/studio_profile.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="studio-hero">
                <div class="studio-cover">
                    <?php if (!empty($studio['banner_url'])): ?>
                        <img src="<?php echo htmlspecialchars($studio['banner_url']); ?>" alt="">
                    <?php endif; ?>
                </div>
                <div class="studio-hero-content">
                    <div class="studio-identity">
                        <?php if (!empty($studio['logo_url'])): ?>
                            <img class="studio-logo" src="<?php echo htmlspecialchars($studio['logo_url']); ?>" alt="">
                        <?php else: ?>
                            <div class="studio-logo placeholder"><?php echo strtoupper(substr($studio['name'], 0, 1)); ?></div>
                        <?php endif; ?>
                        <div>
                            <h1><?php echo htmlspecialchars($studio['name']); ?></h1>
                            <p><?php echo htmlspecialchars($studio['description'] ?? ''); ?></p>
                        </div>
                    </div>
                    <div class="studio-hero-actions">
                        <a class="btn" href="studios.php">Back to Studios</a>
                        <?php if ($studio['role'] === 'owner'): ?>
                            <a class="btn" href="studio_permissions.php?id=<?php echo (int)$studio_id; ?>">Permissions</a>
                        <?php endif; ?>
                    </div>
                </div>
                <div class="studio-stats">
                    <div>
                        <strong><?php echo count($members); ?></strong>
                        <span>Members</span>
                    </div>
                    <div>
                        <strong><?php echo htmlspecialchars(ucfirst($studio['role'])); ?></strong>
                        <span>Your Role</span>
                    </div>
                </div>
            </div>

            <section class="studio-panel">
                <div class="panel-header">
                    <h3>Studio Profile</h3>
                </div>
                <form method="POST" class="talent-request-form" enctype="multipart/form-data">
                    <input type="hidden" name="studio_action" value="update_profile">
                    <div class="form-group">
                        <label>Studio Name</label>
                        <input type="text" name="studio_name" value="<?php echo htmlspecialchars($studio['name']); ?>" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="studio_description" rows="4"><?php echo htmlspecialchars($studio['description'] ?? ''); ?></textarea>
                    </div>
                    <div class="form-group">
                        <label>Logo Image</label>
                        <input type="file" name="studio_logo" accept="image/*">
                    </div>
                    <div class="form-group">
                        <label>Banner Image</label>
                        <input type="file" name="studio_banner" accept="image/*">
                    </div>
                    <div class="modal-actions">
                        <button class="btn" type="submit">Save Profile</button>
                    </div>
                </form>
            </section>

            <section class="studio-panel">
                <div class="panel-header">
                    <h3>Studio Visuals</h3>
                </div>
                <form method="POST" class="talent-request-form" enctype="multipart/form-data">
                    <input type="hidden" name="studio_action" value="add_visual">
                    <div class="form-group">
                        <label>Title (optional)</label>
                        <input type="text" name="visual_title" placeholder="Studio highlight, concept art, BTS...">
                    </div>
                    <div class="form-group">
                        <label>Upload Image</label>
                        <input type="file" name="visual_image" accept="image/*" required>
                    </div>
                    <div class="modal-actions">
                        <button class="btn" type="submit">Add Visual</button>
                    </div>
                </form>
                <?php if (!empty($studioVisuals)): ?>
                    <div class="panel-list studio-visuals-list">
                        <?php foreach ($studioVisuals as $visual): ?>
                            <div class="panel-item">
                                <div class="studio-visual-thumb">
                                    <img src="<?php echo htmlspecialchars($visual['image_url']); ?>" alt="">
                                </div>
                                <div>
                                    <strong><?php echo htmlspecialchars($visual['title'] ?? 'Studio Visual'); ?></strong>
                                    <div class="muted"><?php echo date('M j, Y', strtotime($visual['created_at'])); ?></div>
                                </div>
                                <div class="panel-actions">
                                    <form method="POST">
                                        <input type="hidden" name="studio_action" value="delete_visual">
                                        <input type="hidden" name="visual_id" value="<?php echo (int)$visual['id']; ?>">
                                        <button class="btn danger" type="submit">Delete</button>
                                    </form>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    </div>
                <?php else: ?>
                    <div class="panel-list">
                        <div class="panel-item">No studio visuals yet.</div>
                    </div>
                <?php endif; ?>
            </section>

            <section class="studio-panel">
                <div class="panel-header">
                    <h3>YouTube Live Integration</h3>
                </div>
                <form method="POST" class="talent-request-form">
                    <input type="hidden" name="youtube_action" value="save_youtube">
                    <div class="form-group">
                        <label>YouTube API Key</label>
                        <input type="text" name="youtube_api_key" value="<?php echo htmlspecialchars($youtubeSettings['api_key'] ?? ''); ?>" placeholder="AIza...">
                    </div>
                    <div class="form-group">
                        <label>Channel Handle (easiest)</label>
                        <input type="text" name="youtube_channel_handle" value="<?php echo htmlspecialchars($youtubeSettings['channel_handle'] ?? ''); ?>" placeholder="@yourchannel">
                    </div>
                    <div class="form-group">
                        <label>Channel ID (optional)</label>
                        <input type="text" name="youtube_channel_id" value="<?php echo htmlspecialchars($youtubeSettings['channel_id'] ?? ''); ?>" placeholder="UC...">
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" name="youtube_enabled" <?php echo !empty($youtubeSettings['is_enabled']) ? 'checked' : ''; ?>>
                            Enable live sync
                        </label>
                    </div>
                    <div class="modal-actions">
                        <button class="btn" type="submit">Save YouTube Settings</button>
                    </div>
                    <div class="muted">Cron URL: <code>/cron/check_youtube_live.php?token=<?php echo htmlspecialchars(CRON_TOKEN); ?></code></div>
                </form>
            </section>

            <section class="studio-panel">
                <div class="panel-header">
                    <h3>Members</h3>
                    <?php if ($studio['role'] === 'owner'): ?>
                        <button class="btn" id="add-member">Add Member</button>
                    <?php endif; ?>
                </div>
                <div class="panel-list">
                    <?php foreach ($members as $member): ?>
                        <div class="panel-item">
                            <div>
                                <strong><?php echo htmlspecialchars($member['username']); ?></strong>
                                <div class="muted"><?php echo htmlspecialchars($member['email']); ?></div>
                            </div>
                            <div class="panel-actions">
                                <span class="role-pill"><?php echo htmlspecialchars(ucfirst($member['role'])); ?></span>
                                <?php if ($studio['role'] === 'owner' && $member['role'] !== 'owner'): ?>
                                    <button class="btn" data-action="role" data-user-id="<?php echo (int)$member['id']; ?>">Change Role</button>
                                    <button class="btn danger" data-action="remove" data-user-id="<?php echo (int)$member['id']; ?>">Remove</button>
                                <?php endif; ?>
                            </div>
                        </div>
                    <?php endforeach; ?>
                </div>
            </section>

            <section class="studio-panel">
                <div class="panel-header">
                    <h3>Talent Requests</h3>
                </div>
                <form method="POST" class="talent-request-form">
                    <input type="hidden" name="talent_action" value="add_request">
                    <div class="form-group">
                        <label>Title</label>
                        <input type="text" name="request_title" required>
                    </div>
                    <div class="form-group">
                        <label>Description</label>
                        <textarea name="request_description"></textarea>
                    </div>
                    <div class="form-group">
                        <label>Roles Needed</label>
                        <input type="text" name="request_roles" placeholder="Voice Actor, Prompt Engineer">
                    </div>
                    <div class="form-group">
                        <label>Tags</label>
                        <input type="text" name="request_tags" placeholder="fantasy, cinematic, synthwave">
                    </div>
                    <div class="form-group">
                        <label>Location</label>
                        <input type="text" name="request_location">
                    </div>
                    <div class="form-group">
                        <label>Compensation</label>
                        <input type="text" name="request_compensation" placeholder="Paid / Rev-share / Credit">
                    </div>
                    <div class="form-group">
                        <label>Contact Email</label>
                        <input type="email" name="request_contact">
                    </div>
                    <div class="modal-actions">
                        <button class="btn" type="submit">Post Request</button>
                    </div>
                </form>
                <div class="panel-list talent-request-list">
                    <?php if (empty($talentRequests)): ?>
                        <div class="panel-item">No talent requests yet.</div>
                    <?php else: ?>
                        <?php foreach ($talentRequests as $request): ?>
                            <div class="panel-item">
                                <div>
                                    <strong><?php echo htmlspecialchars($request['title']); ?></strong>
                                    <div class="muted"><?php echo htmlspecialchars($request['roles'] ?? ''); ?></div>
                                    <div class="muted"><?php echo htmlspecialchars($request['tags'] ?? ''); ?></div>
                                    <div class="muted"><?php echo htmlspecialchars($request['description'] ?? ''); ?></div>
                                    <div class="muted"><?php echo htmlspecialchars($request['status']); ?></div>
                                </div>
                                <div class="panel-actions">
                                    <?php if ($request['status'] === 'open'): ?>
                                        <form method="POST">
                                            <input type="hidden" name="talent_action" value="close_request">
                                            <input type="hidden" name="request_id" value="<?php echo (int)$request['id']; ?>">
                                            <button class="btn" type="submit">Close</button>
                                        </form>
                                    <?php endif; ?>
                                    <form method="POST">
                                        <input type="hidden" name="talent_action" value="delete_request">
                                        <input type="hidden" name="request_id" value="<?php echo (int)$request['id']; ?>">
                                        <button class="btn danger" type="submit">Delete</button>
                                    </form>
                                </div>
                            </div>
                        <?php endforeach; ?>
                    <?php endif; ?>
                </div>
            </section>
        </main>
    </div>
</div>

<div class="modal" id="member-modal" style="display:none;">
    <div class="modal-content">
        <h2>Add Member</h2>
        <div class="form-group">
            <label>Email or Username</label>
            <input type="text" id="member-identifier" placeholder="email@example.com or username">
        </div>
        <div class="form-group">
            <label>Role</label>
            <select id="member-role">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="member-cancel">Cancel</button>
            <button class="btn primary-btn" id="member-save" data-studio-id="<?php echo (int)$studio_id; ?>">Add</button>
        </div>
    </div>
</div>

<script src="js/studio_profile.js"></script>
