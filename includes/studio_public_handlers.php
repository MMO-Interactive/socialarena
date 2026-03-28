<?php
require_once 'db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $data['action'] ?? '';
$userId = $_SESSION['user_id'] ?? null;

function ensureLoggedIn($userId): void {
    if (!$userId) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'Not authenticated']);
        exit;
    }
}

function isMember(PDO $pdo, int $studioId, int $userId): bool {
    $stmt = $pdo->prepare('SELECT 1 FROM studio_members WHERE studio_id = ? AND user_id = ?');
    $stmt->execute([$studioId, $userId]);
    return (bool)$stmt->fetchColumn();
}

try {
    switch ($action) {
        case 'follow_toggle':
            ensureLoggedIn($userId);
            $studioId = (int)($data['studio_id'] ?? 0);
            if (!$studioId) {
                throw new Exception('Invalid studio');
            }
            $stmt = $pdo->prepare('SELECT id FROM studio_followers WHERE studio_id = ? AND user_id = ?');
            $stmt->execute([$studioId, $userId]);
            $existing = $stmt->fetchColumn();
            if ($existing) {
                $stmt = $pdo->prepare('DELETE FROM studio_followers WHERE studio_id = ? AND user_id = ?');
                $stmt->execute([$studioId, $userId]);
                echo json_encode(['success' => true, 'followed' => false]);
            } else {
                $stmt = $pdo->prepare('INSERT INTO studio_followers (studio_id, user_id) VALUES (?, ?)');
                $stmt->execute([$studioId, $userId]);
                echo json_encode(['success' => true, 'followed' => true]);
            }
            break;

        case 'add_post':
            ensureLoggedIn($userId);
            $studioId = (int)($data['studio_id'] ?? 0);
            if (!$studioId) {
                throw new Exception('Invalid studio');
            }
            if (!isMember($pdo, $studioId, (int)$userId)) {
                throw new Exception('Members only');
            }
            $title = trim($data['title'] ?? '');
            $body = trim($data['body'] ?? '');
            $imageUrl = trim($data['image_url'] ?? '');
            if ($title === '' && $body === '') {
                throw new Exception('Post cannot be empty');
            }
            $stmt = $pdo->prepare('INSERT INTO studio_posts (studio_id, user_id, title, body, image_url) VALUES (?, ?, ?, ?, ?)');
            $stmt->execute([$studioId, $userId, $title, $body, $imageUrl]);
            echo json_encode(['success' => true, 'post_id' => (int)$pdo->lastInsertId()]);
            break;

        case 'add_comment':
            ensureLoggedIn($userId);
            $postId = (int)($data['post_id'] ?? 0);
            $comment = trim($data['comment'] ?? '');
            if (!$postId || $comment === '') {
                throw new Exception('Invalid comment');
            }
            $stmt = $pdo->prepare('SELECT studio_id FROM studio_posts WHERE id = ?');
            $stmt->execute([$postId]);
            $studioId = (int)$stmt->fetchColumn();
            if (!$studioId) {
                throw new Exception('Invalid post');
            }
            if (!isMember($pdo, $studioId, (int)$userId)) {
                throw new Exception('Members only');
            }
            $stmt = $pdo->prepare('INSERT INTO studio_post_comments (post_id, user_id, comment) VALUES (?, ?, ?)');
            $stmt->execute([$postId, $userId, $comment]);
            echo json_encode(['success' => true, 'comment' => $comment]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
