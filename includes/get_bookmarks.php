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

$userId = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
if ($userId === 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'User ID is required']);
    exit;
}

if ($userId !== (int)$_SESSION['user_id']) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

$stmt = $pdo->prepare("
    SELECT b.story_id, b.created_at, b.notes,
           s.title, s.genre, s.thumbnail_url
    FROM user_bookmarks b
    JOIN stories s ON b.story_id = s.id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
");
$stmt->execute([$userId]);
$bookmarks = $stmt->fetchAll(PDO::FETCH_ASSOC);

echo json_encode($bookmarks);
