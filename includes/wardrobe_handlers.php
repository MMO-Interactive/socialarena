<?php
require_once 'db_connect.php';
require_once 'auth.php';
require_once 'studio_access.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';

try {
    switch ($action) {
        case 'list_wardrobes':
            [$whereClause, $whereParams] = buildStudioVisibilityWhere('w', (int)$_SESSION['user_id'], 'wardrobe');
            $stmt = $pdo->prepare("
                SELECT w.*, s.title AS series_title
                FROM studio_wardrobes w
                LEFT JOIN series s ON w.series_id = s.id
                WHERE {$whereClause}
                ORDER BY w.updated_at DESC
            ");
            $stmt->execute($whereParams);
            $wardrobes = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'wardrobes' => $wardrobes]);
            break;
        case 'list_variations':
            $wardrobe_id = (int)($data['wardrobe_id'] ?? 0);
            if (!$wardrobe_id) {
                throw new Exception('Invalid wardrobe');
            }
            $stmt = $pdo->prepare("SELECT id FROM studio_wardrobes WHERE id = ? AND user_id = ?");
            $stmt->execute([$wardrobe_id, $_SESSION['user_id']]);
            if (!$stmt->fetchColumn()) {
                throw new Exception('Invalid wardrobe');
            }
            $stmt = $pdo->prepare("
                SELECT id, wardrobe_id, name, description, image_url
                FROM studio_wardrobe_variations
                WHERE wardrobe_id = ?
                ORDER BY created_at DESC
            ");
            $stmt->execute([$wardrobe_id]);
            $variations = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'variations' => $variations]);
            break;
        case 'create_wardrobe':
            $studioId = !empty($data['studio_id']) ? (int)$data['studio_id'] : null;
            $visibility = normalizeVisibility($data['visibility'] ?? 'private', $studioId);
            enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'wardrobe');
            $stmt = $pdo->prepare("
                INSERT INTO studio_wardrobes (user_id, studio_id, series_id, name, wardrobe_type, description, tags, cover_image_url, visibility)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $seriesId = !empty($data['series_id']) ? (int)$data['series_id'] : null;
            $stmt->execute([
                $_SESSION['user_id'],
                $studioId,
                $seriesId,
                trim($data['name'] ?? ''),
                trim($data['wardrobe_type'] ?? ''),
                trim($data['description'] ?? ''),
                trim($data['tags'] ?? ''),
                trim($data['cover_image_url'] ?? ''),
                $visibility
            ]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'update_wardrobe':
            $wardrobe_id = (int)($data['wardrobe_id'] ?? 0);
            if (!$wardrobe_id) {
                throw new Exception('Invalid wardrobe');
            }
            $studioId = !empty($data['studio_id']) ? (int)$data['studio_id'] : null;
            $visibility = normalizeVisibility($data['visibility'] ?? 'private', $studioId);
            enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'wardrobe');
            $stmt = $pdo->prepare("
                UPDATE studio_wardrobes
                SET series_id = ?, name = ?, wardrobe_type = ?, description = ?, tags = ?, cover_image_url = ?,
                    studio_id = ?, visibility = ?
                WHERE id = ? AND user_id = ?
            ");
            $seriesId = !empty($data['series_id']) ? (int)$data['series_id'] : null;
            $stmt->execute([
                $seriesId,
                trim($data['name'] ?? ''),
                trim($data['wardrobe_type'] ?? ''),
                trim($data['description'] ?? ''),
                trim($data['tags'] ?? ''),
                trim($data['cover_image_url'] ?? ''),
                $studioId,
                $visibility,
                $wardrobe_id,
                $_SESSION['user_id']
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_wardrobe':
            $wardrobe_id = (int)($data['wardrobe_id'] ?? 0);
            if (!$wardrobe_id) {
                throw new Exception('Invalid wardrobe');
            }
            $stmt = $pdo->prepare("SELECT studio_id FROM studio_wardrobes WHERE id = ? AND user_id = ?");
            $stmt->execute([$wardrobe_id, $_SESSION['user_id']]);
            $studioId = (int)$stmt->fetchColumn();
            if ($studioId) {
                enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'wardrobe');
            }
            $stmt = $pdo->prepare("DELETE FROM studio_wardrobes WHERE id = ? AND user_id = ?");
            $stmt->execute([$wardrobe_id, $_SESSION['user_id']]);
            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
