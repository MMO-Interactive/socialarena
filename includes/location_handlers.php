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
        case 'create_location':
            $name = trim($data['name'] ?? '');
            if ($name === '') {
                throw new Exception('Name required');
            }
            $studioId = !empty($data['studio_id']) ? (int)$data['studio_id'] : null;
            $visibility = normalizeVisibility($data['visibility'] ?? 'private', $studioId);
            enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'locations');
            $stmt = $pdo->prepare("
                INSERT INTO studio_locations (user_id, studio_id, name, location_type, region, description, tags, cover_image_url, visibility)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $_SESSION['user_id'],
                $studioId,
                $name,
                trim($data['location_type'] ?? ''),
                trim($data['region'] ?? ''),
                trim($data['description'] ?? ''),
                trim($data['tags'] ?? ''),
                trim($data['cover_image_url'] ?? ''),
                $visibility
            ]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'update_location':
            $location_id = (int)($data['location_id'] ?? 0);
            if (!$location_id) {
                throw new Exception('Invalid location');
            }
            $studioId = !empty($data['studio_id']) ? (int)$data['studio_id'] : null;
            $visibility = normalizeVisibility($data['visibility'] ?? 'private', $studioId);
            enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'locations');
            $stmt = $pdo->prepare("
                UPDATE studio_locations
                SET name = ?, location_type = ?, region = ?, description = ?, tags = ?, cover_image_url = ?,
                    studio_id = ?, visibility = ?
                WHERE id = ? AND user_id = ?
            ");
            $stmt->execute([
                trim($data['name'] ?? ''),
                trim($data['location_type'] ?? ''),
                trim($data['region'] ?? ''),
                trim($data['description'] ?? ''),
                trim($data['tags'] ?? ''),
                trim($data['cover_image_url'] ?? ''),
                $studioId,
                $visibility,
                $location_id,
                $_SESSION['user_id']
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_location':
            $location_id = (int)($data['location_id'] ?? 0);
            if (!$location_id) {
                throw new Exception('Invalid location');
            }
            $stmt = $pdo->prepare("SELECT studio_id FROM studio_locations WHERE id = ? AND user_id = ?");
            $stmt->execute([$location_id, $_SESSION['user_id']]);
            $studioId = (int)$stmt->fetchColumn();
            if ($studioId) {
                enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'locations');
            }
            $stmt = $pdo->prepare("DELETE FROM studio_locations WHERE id = ? AND user_id = ?");
            $stmt->execute([$location_id, $_SESSION['user_id']]);
            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
