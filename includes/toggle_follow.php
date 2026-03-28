<?php
require_once 'db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$authorId = isset($data['author_id']) ? (int)$data['author_id'] : 0;

if ($authorId === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Author ID is required']);
    exit;
}

if ($authorId === (int)$_SESSION['user_id']) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Cannot follow yourself']);
    exit;
}

$stmt = $pdo->prepare("SELECT 1 FROM user_follows WHERE follower_id = ? AND following_id = ?");
$stmt->execute([$_SESSION['user_id'], $authorId]);
$alreadyFollowing = (bool)$stmt->fetchColumn();

if ($alreadyFollowing) {
    $stmt = $pdo->prepare("DELETE FROM user_follows WHERE follower_id = ? AND following_id = ?");
    $stmt->execute([$_SESSION['user_id'], $authorId]);
    $isFollowing = false;
} else {
    $stmt = $pdo->prepare("INSERT INTO user_follows (follower_id, following_id) VALUES (?, ?)");
    $stmt->execute([$_SESSION['user_id'], $authorId]);
    $isFollowing = true;
}

echo json_encode(['success' => true, 'isFollowing' => $isFollowing]);
