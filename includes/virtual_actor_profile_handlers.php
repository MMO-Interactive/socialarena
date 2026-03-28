<?php
require_once 'db_connect.php';
require_once 'studio_access.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

$action = $_POST['action'] ?? '';
$actor_id = isset($_POST['actor_id']) ? (int)$_POST['actor_id'] : 0;

if ($actor_id === 0) {
    header('Location: virtual_actors.php');
    exit;
}

$stmt = $pdo->prepare("SELECT user_id, studio_id, visibility FROM virtual_actors WHERE id = ?");
$stmt->execute([$actor_id]);
$actorRow = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$actorRow) {
    header('Location: virtual_actors.php');
    exit;
}
try {
    enforceStudioItemAccess(
        $pdo,
        (int)$actorRow['user_id'],
        (int)$actorRow['studio_id'],
        $actorRow['visibility'],
        (int)$_SESSION['user_id'],
        'virtual_cast',
        true
    );
} catch (Exception $e) {
    header('Location: virtual_actors.php');
    exit;
}

function saveUpload($file, $dir, array $allowed) {
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $allowed, true)) {
        throw new Exception('Invalid file type');
    }
    if (!is_dir($dir)) {
        mkdir($dir, 0777, true);
    }
    $filename = uniqid('asset_') . '.' . $ext;
    $target = $dir . $filename;
    if (!move_uploaded_file($file['tmp_name'], $target)) {
        throw new Exception('Failed to save file');
    }
    return str_replace(__DIR__ . '/../', '', $target);
}

try {
    switch ($action) {
        case 'update_notes':
            $notes = trim($_POST['profile_notes'] ?? '');
            $stmt = $pdo->prepare("UPDATE virtual_actors SET profile_notes = ? WHERE id = ? AND user_id = ?");
            $stmt->execute([$notes, $actor_id, $_SESSION['user_id']]);
            break;

        case 'upload_gallery':
            if (empty($_FILES['gallery_image']) || $_FILES['gallery_image']['error'] !== UPLOAD_ERR_OK) {
                throw new Exception('Upload failed');
            }
            $stmt = $pdo->prepare("SELECT id FROM virtual_actor_galleries WHERE actor_id = ? ORDER BY created_at ASC LIMIT 1");
            $stmt->execute([$actor_id]);
            $gallery_id = (int)$stmt->fetchColumn();

            if ($gallery_id === 0) {
                $stmt = $pdo->prepare("INSERT INTO virtual_actor_galleries (actor_id, title) VALUES (?, ?)");
                $stmt->execute([$actor_id, 'Main Gallery']);
                $gallery_id = (int)$pdo->lastInsertId();
            }

            $path = saveUpload($_FILES['gallery_image'], __DIR__ . '/../uploads/actors/gallery/', ['jpg', 'jpeg', 'png', 'gif', 'webp']);
            $caption = trim($_POST['caption'] ?? '');
            $stmt = $pdo->prepare("INSERT INTO virtual_actor_gallery_images (gallery_id, image_url, caption) VALUES (?, ?, ?)");
            $stmt->execute([$gallery_id, $path, $caption]);
            break;

        case 'create_gallery':
            $title = trim($_POST['title'] ?? '');
            if ($title === '') {
                throw new Exception('Title required');
            }
            $description = trim($_POST['description'] ?? '');
            $stmt = $pdo->prepare("INSERT INTO virtual_actor_galleries (actor_id, title, description) VALUES (?, ?, ?)");
            $stmt->execute([$actor_id, $title, $description]);
            break;

        case 'upload_gallery_image':
            if (empty($_FILES['gallery_image']) || $_FILES['gallery_image']['error'] !== UPLOAD_ERR_OK) {
                throw new Exception('Upload failed');
            }
            $gallery_id = isset($_POST['gallery_id']) ? (int)$_POST['gallery_id'] : 0;
            if ($gallery_id === 0) {
                throw new Exception('Gallery required');
            }
            $stmt = $pdo->prepare("SELECT id FROM virtual_actor_galleries WHERE id = ? AND actor_id = ?");
            $stmt->execute([$gallery_id, $actor_id]);
            if (!$stmt->fetchColumn()) {
                throw new Exception('Invalid gallery');
            }
            $path = saveUpload($_FILES['gallery_image'], __DIR__ . '/../uploads/actors/gallery/', ['jpg', 'jpeg', 'png', 'gif', 'webp']);
            $caption = trim($_POST['caption'] ?? '');
            $stmt = $pdo->prepare("INSERT INTO virtual_actor_gallery_images (gallery_id, image_url, caption) VALUES (?, ?, ?)");
            $stmt->execute([$gallery_id, $path, $caption]);
            break;

        case 'upload_audio':
            if (empty($_FILES['audio_file']) || $_FILES['audio_file']['error'] !== UPLOAD_ERR_OK) {
                throw new Exception('Upload failed');
            }
            $path = saveUpload($_FILES['audio_file'], __DIR__ . '/../uploads/actors/audio/', ['mp3', 'wav', 'ogg', 'm4a']);
            $label = trim($_POST['label'] ?? '');
            $stmt = $pdo->prepare("INSERT INTO virtual_actor_audio (actor_id, audio_url, label) VALUES (?, ?, ?)");
            $stmt->execute([$actor_id, $path, $label]);
            break;
    }
} catch (Exception $e) {
    // Swallow for now; could add flash messaging later.
}

header('Location: ../virtual_actor_profile.php?id=' . $actor_id);
