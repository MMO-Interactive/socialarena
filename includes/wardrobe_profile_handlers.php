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
    $wardrobe_id = isset($_POST['wardrobe_id']) ? (int)$_POST['wardrobe_id'] : 0;
    if (!$wardrobe_id) {
        header('Location: ../wardrobes.php');
        exit;
    }

    $stmt = $pdo->prepare("SELECT user_id, studio_id, visibility FROM studio_wardrobes WHERE id = ?");
    $stmt->execute([$wardrobe_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        header('Location: ../wardrobes.php');
        exit;
    }
    $isOwner = (int)$row['user_id'] === (int)$_SESSION['user_id'];
    $studioId = (int)($row['studio_id'] ?? 0);
    $visibility = $row['visibility'] ?? 'private';
    if (!$isOwner) {
        if (!$studioId || !userHasStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'wardrobe') || !in_array($visibility, ['studio', 'public'], true)) {
            header('Location: ../wardrobes.php');
            exit;
        }
    }

    if (empty($_FILES['gallery_image']) || $_FILES['gallery_image']['error'] !== UPLOAD_ERR_OK) {
        header('Location: ../wardrobe_profile.php?id=' . $wardrobe_id);
        exit;
    }

    $file = $_FILES['gallery_image'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    if (!in_array($ext, $allowed, true)) {
        header('Location: ../wardrobe_profile.php?id=' . $wardrobe_id);
        exit;
    }

    $upload_dir = __DIR__ . '/../uploads/wardrobes/';
    if (!is_dir($upload_dir)) {
        mkdir($upload_dir, 0777, true);
    }

    $filename = 'wardrobe_gallery_' . $wardrobe_id . '_' . uniqid() . '.' . $ext;
    $target = $upload_dir . $filename;

    if (move_uploaded_file($file['tmp_name'], $target)) {
        $url = 'uploads/wardrobes/' . $filename;
        $caption = trim($_POST['caption'] ?? '');
        $stmt = $pdo->prepare("INSERT INTO studio_wardrobe_gallery (wardrobe_id, image_url, caption) VALUES (?, ?, ?)");
        $stmt->execute([$wardrobe_id, $url, $caption]);
    }

    header('Location: ../wardrobe_profile.php?id=' . $wardrobe_id);
    exit;
}

if ($action === 'add_variation') {
    $wardrobe_id = isset($_POST['wardrobe_id']) ? (int)$_POST['wardrobe_id'] : 0;
    if (!$wardrobe_id) {
        header('Location: ../wardrobes.php');
        exit;
    }

    $stmt = $pdo->prepare("SELECT user_id, studio_id, visibility FROM studio_wardrobes WHERE id = ?");
    $stmt->execute([$wardrobe_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        header('Location: ../wardrobes.php');
        exit;
    }
    $isOwner = (int)$row['user_id'] === (int)$_SESSION['user_id'];
    $studioId = (int)($row['studio_id'] ?? 0);
    $visibility = $row['visibility'] ?? 'private';
    if (!$isOwner) {
        if (!$studioId || !userHasStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'wardrobe') || !in_array($visibility, ['studio', 'public'], true)) {
            header('Location: ../wardrobes.php');
            exit;
        }
    }

    $name = trim($_POST['variation_name'] ?? '');
    if ($name === '') {
        header('Location: ../wardrobe_profile.php?id=' . $wardrobe_id);
        exit;
    }

    $imageUrl = '';
    if (!empty($_FILES['variation_image']) && $_FILES['variation_image']['error'] === UPLOAD_ERR_OK) {
        $file = $_FILES['variation_image'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
        if (in_array($ext, $allowed, true)) {
            $upload_dir = __DIR__ . '/../uploads/wardrobes/';
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0777, true);
            }
            $filename = 'wardrobe_variation_' . $wardrobe_id . '_' . uniqid() . '.' . $ext;
            $target = $upload_dir . $filename;
            if (move_uploaded_file($file['tmp_name'], $target)) {
                $imageUrl = 'uploads/wardrobes/' . $filename;
            }
        }
    }

    $description = trim($_POST['variation_description'] ?? '');
    $stmt = $pdo->prepare("
        INSERT INTO studio_wardrobe_variations (wardrobe_id, name, description, image_url)
        VALUES (?, ?, ?, ?)
    ");
    $stmt->execute([$wardrobe_id, $name, $description, $imageUrl]);

    header('Location: ../wardrobe_profile.php?id=' . $wardrobe_id);
    exit;
}

header('Location: ../wardrobes.php');
exit;
