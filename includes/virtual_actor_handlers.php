<?php
require_once 'db_connect.php';
require_once 'studio_access.php';
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
$action = $data['action'] ?? '';

try {
    switch ($action) {
        case 'create_actor':
            $name = trim($data['name'] ?? '');
            if ($name === '') {
                throw new Exception('Name required');
            }
            $studioId = !empty($data['studio_id']) ? (int)$data['studio_id'] : null;
            $visibility = normalizeVisibility($data['visibility'] ?? 'private', $studioId);
            enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'virtual_cast');
            $stmt = $pdo->prepare("
                INSERT INTO virtual_actors (user_id, studio_id, name, gender, age_range, description, tags, avatar_url, visibility)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $_SESSION['user_id'],
                $studioId,
                $name,
                trim($data['gender'] ?? ''),
                trim($data['age_range'] ?? ''),
                trim($data['description'] ?? ''),
                trim($data['tags'] ?? ''),
                trim($data['avatar_url'] ?? ''),
                $visibility
            ]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'update_actor':
            $actor_id = (int)($data['actor_id'] ?? 0);
            if (!$actor_id) {
                throw new Exception('Invalid actor');
            }
            $studioId = !empty($data['studio_id']) ? (int)$data['studio_id'] : null;
            $visibility = normalizeVisibility($data['visibility'] ?? 'private', $studioId);
            enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'virtual_cast');
            $stmt = $pdo->prepare("
                UPDATE virtual_actors
                SET name = ?, gender = ?, age_range = ?, description = ?, tags = ?, avatar_url = ?,
                    studio_id = ?, visibility = ?
                WHERE id = ? AND user_id = ?
            ");
            $stmt->execute([
                trim($data['name'] ?? ''),
                trim($data['gender'] ?? ''),
                trim($data['age_range'] ?? ''),
                trim($data['description'] ?? ''),
                trim($data['tags'] ?? ''),
                trim($data['avatar_url'] ?? ''),
                $studioId,
                $visibility,
                $actor_id,
                $_SESSION['user_id']
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_actor':
            $actor_id = (int)($data['actor_id'] ?? 0);
            if (!$actor_id) {
                throw new Exception('Invalid actor');
            }
            $stmt = $pdo->prepare("SELECT studio_id FROM virtual_actors WHERE id = ? AND user_id = ?");
            $stmt->execute([$actor_id, $_SESSION['user_id']]);
            $studioId = (int)$stmt->fetchColumn();
            if ($studioId) {
                enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'virtual_cast');
            }
            $stmt = $pdo->prepare("DELETE FROM virtual_actors WHERE id = ? AND user_id = ?");
            $stmt->execute([$actor_id, $_SESSION['user_id']]);
            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
