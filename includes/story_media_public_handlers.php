<?php
require_once 'db_connect.php';
require_once 'auth.php';

header('Content-Type: application/json');
$data = json_decode(file_get_contents('php://input'), true) ?: [];
$action = $data['action'] ?? '';

try {
    switch ($action) {
        case 'toggle_like':
            $mediaId = (int)($data['media_id'] ?? 0);
            if (!$mediaId) {
                throw new Exception('Invalid media');
            }
            $stmt = $pdo->prepare("SELECT id FROM story_public_media_likes WHERE media_id = ? AND user_id = ?");
            $stmt->execute([$mediaId, $_SESSION['user_id']]);
            $existing = $stmt->fetchColumn();
            if ($existing) {
                $stmt = $pdo->prepare("DELETE FROM story_public_media_likes WHERE media_id = ? AND user_id = ?");
                $stmt->execute([$mediaId, $_SESSION['user_id']]);
                $liked = false;
            } else {
                $stmt = $pdo->prepare("INSERT INTO story_public_media_likes (media_id, user_id) VALUES (?, ?)");
                $stmt->execute([$mediaId, $_SESSION['user_id']]);
                $liked = true;
            }
            $stmt = $pdo->prepare("SELECT COUNT(*) FROM story_public_media_likes WHERE media_id = ?");
            $stmt->execute([$mediaId]);
            $count = (int)$stmt->fetchColumn();
            echo json_encode(['success' => true, 'liked' => $liked, 'count' => $count]);
            break;
        case 'add_comment':
            $mediaId = (int)($data['media_id'] ?? 0);
            $comment = trim($data['comment'] ?? '');
            if (!$mediaId || $comment === '') {
                throw new Exception('Invalid comment');
            }
            $stmt = $pdo->prepare("INSERT INTO story_public_media_comments (media_id, user_id, comment) VALUES (?, ?, ?)");
            $stmt->execute([$mediaId, $_SESSION['user_id'], $comment]);
            $stmt = $pdo->prepare("SELECT username, profile_photo FROM users WHERE id = ?");
            $stmt->execute([$_SESSION['user_id']]);
            $username = $stmt->fetch(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'comment' => $comment, 'username' => $username['username'] ?? $username, 'profile_photo' => $username['profile_photo'] ?? null]);
            break;
        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
