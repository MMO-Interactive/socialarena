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
    $prop_id = isset($_POST['prop_id']) ? (int)$_POST['prop_id'] : 0;
    if (!$prop_id) {
        header('Location: ../props.php');
        exit;
    }

    $stmt = $pdo->prepare("SELECT user_id, studio_id, visibility FROM studio_props WHERE id = ?");
    $stmt->execute([$prop_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        header('Location: ../props.php');
        exit;
    }
    $isOwner = (int)$row['user_id'] === (int)$_SESSION['user_id'];
    $studioId = (int)($row['studio_id'] ?? 0);
    $visibility = $row['visibility'] ?? 'private';
    if (!$isOwner) {
        if (!$studioId || !userHasStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'props') || !in_array($visibility, ['studio', 'public'], true)) {
            header('Location: ../props.php');
            exit;
        }
    }

    if (empty($_FILES['gallery_image']) || $_FILES['gallery_image']['error'] !== UPLOAD_ERR_OK) {
        header('Location: ../prop_profile.php?id=' . $prop_id);
        exit;
    }

    $file = $_FILES['gallery_image'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!in_array($ext, $allowed, true)) {
        header('Location: ../prop_profile.php?id=' . $prop_id);
        exit;
    }

    $upload_dir = __DIR__ . '/../uploads/props/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0777, true);
    }

    $filename = 'prop_gallery_' . $prop_id . '_' . uniqid() . '.' . $ext;
    $target = $upload_dir . $filename;

    if (move_uploaded_file($file['tmp_name'], $target)) {
        $url = 'uploads/props/' . $filename;
        $caption = trim($_POST['caption'] ?? '');
        $stmt = $pdo->prepare("INSERT INTO studio_prop_gallery (prop_id, image_url, caption) VALUES (?, ?, ?)");
        $stmt->execute([$prop_id, $url, $caption]);
    }

    header('Location: ../prop_profile.php?id=' . $prop_id);
    exit;
}

header('Location: ../props.php');
exit;
