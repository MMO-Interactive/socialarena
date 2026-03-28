<?php
require_once 'db_connect.php';
require_once 'studio_access.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


if (!isset($_SESSION['user_id'])) {
    header('Location: ../login.php');
    exit;
}

$action = $_POST['action'] ?? '';

if ($action === 'upload_gallery') {
    $location_id = isset($_POST['location_id']) ? (int)$_POST['location_id'] : 0;
    if (!$location_id) {
        header('Location: ../locations.php');
        exit;
    }

    $stmt = $pdo->prepare("SELECT user_id, studio_id, visibility FROM studio_locations WHERE id = ?");
    $stmt->execute([$location_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        header('Location: ../locations.php');
        exit;
    }
    $isOwner = (int)$row['user_id'] === (int)$_SESSION['user_id'];
    $studioId = (int)($row['studio_id'] ?? 0);
    $visibility = $row['visibility'] ?? 'private';
    if (!$isOwner) {
        if (!$studioId || !userHasStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'locations') || !in_array($visibility, ['studio', 'public'], true)) {
            header('Location: ../locations.php');
            exit;
        }
    }

    if (empty($_FILES['gallery_image']) || $_FILES['gallery_image']['error'] !== UPLOAD_ERR_OK) {
        header('Location: ../location_profile.php?id=' . $location_id);
        exit;
    }

    $file = $_FILES['gallery_image'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!in_array($ext, $allowed, true)) {
        header('Location: ../location_profile.php?id=' . $location_id);
        exit;
    }

    $upload_dir = __DIR__ . '/../uploads/locations/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0777, true);
    }

    $filename = 'location_gallery_' . $location_id . '_' . uniqid() . '.' . $ext;
    $target = $upload_dir . $filename;

    if (move_uploaded_file($file['tmp_name'], $target)) {
        $url = 'uploads/locations/' . $filename;
        $caption = trim($_POST['caption'] ?? '');
        $stmt = $pdo->prepare("INSERT INTO studio_location_gallery (location_id, image_url, caption) VALUES (?, ?, ?)");
        $stmt->execute([$location_id, $url, $caption]);
    }

    header('Location: ../location_profile.php?id=' . $location_id);
    exit;
}

header('Location: ../locations.php');
exit;
