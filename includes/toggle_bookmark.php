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
$storyId = isset($data['story_id']) ? (int)$data['story_id'] : 0;

if ($storyId === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Story ID is required']);
    exit;
}

$stmt = $pdo->prepare("SELECT 1 FROM stories WHERE id = ?");
$stmt->execute([$storyId]);
if (!$stmt->fetchColumn()) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Story not found']);
    exit;
}

$stmt = $pdo->prepare("SELECT 1 FROM user_bookmarks WHERE user_id = ? AND story_id = ?");
$stmt->execute([$_SESSION['user_id'], $storyId]);
$alreadyBookmarked = (bool)$stmt->fetchColumn();

if ($alreadyBookmarked) {
    $stmt = $pdo->prepare("DELETE FROM user_bookmarks WHERE user_id = ? AND story_id = ?");
    $stmt->execute([$_SESSION['user_id'], $storyId]);
    $isBookmarked = false;
} else {
    $stmt = $pdo->prepare("INSERT INTO user_bookmarks (user_id, story_id) VALUES (?, ?)");
    $stmt->execute([$_SESSION['user_id'], $storyId]);
    $isBookmarked = true;
}

echo json_encode(['success' => true, 'isBookmarked' => $isBookmarked]);
