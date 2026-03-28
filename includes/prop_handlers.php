<?php
require_once 'db_connect.php';
require_once 'auth.php';
require_once 'studio_access.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';

try {
    switch ($action) {
        case 'create_prop':
            $studioId = !empty($data['studio_id']) ? (int)$data['studio_id'] : null;
            $visibility = normalizeVisibility($data['visibility'] ?? 'private', $studioId);
            enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'props');
            $stmt = $pdo->prepare("
                INSERT INTO studio_props (user_id, studio_id, series_id, name, prop_type, description, tags, cover_image_url, visibility)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $seriesId = !empty($data['series_id']) ? (int)$data['series_id'] : null;
            $stmt->execute([
                $_SESSION['user_id'],
                $studioId,
                $seriesId,
                trim($data['name'] ?? ''),
                trim($data['prop_type'] ?? ''),
                trim($data['description'] ?? ''),
                trim($data['tags'] ?? ''),
                trim($data['cover_image_url'] ?? ''),
                $visibility
            ]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'update_prop':
            $prop_id = (int)($data['prop_id'] ?? 0);
            if (!$prop_id) {
                throw new Exception('Invalid prop');
            }
            $studioId = !empty($data['studio_id']) ? (int)$data['studio_id'] : null;
            $visibility = normalizeVisibility($data['visibility'] ?? 'private', $studioId);
            enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'props');
            $stmt = $pdo->prepare("
                UPDATE studio_props
                SET series_id = ?, name = ?, prop_type = ?, description = ?, tags = ?, cover_image_url = ?,
                    studio_id = ?, visibility = ?
                WHERE id = ? AND user_id = ?
            ");
            $seriesId = !empty($data['series_id']) ? (int)$data['series_id'] : null;
            $stmt->execute([
                $seriesId,
                trim($data['name'] ?? ''),
                trim($data['prop_type'] ?? ''),
                trim($data['description'] ?? ''),
                trim($data['tags'] ?? ''),
                trim($data['cover_image_url'] ?? ''),
                $studioId,
                $visibility,
                $prop_id,
                $_SESSION['user_id']
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_prop':
            $prop_id = (int)($data['prop_id'] ?? 0);
            if (!$prop_id) {
                throw new Exception('Invalid prop');
            }
            $stmt = $pdo->prepare("SELECT studio_id FROM studio_props WHERE id = ? AND user_id = ?");
            $stmt->execute([$prop_id, $_SESSION['user_id']]);
            $studioId = (int)$stmt->fetchColumn();
            if ($studioId) {
                enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'props');
            }
            $stmt = $pdo->prepare("DELETE FROM studio_props WHERE id = ? AND user_id = ?");
            $stmt->execute([$prop_id, $_SESSION['user_id']]);
            echo json_encode(['success' => true]);
            break;

        case 'list_props':
            [$whereClause, $whereParams] = buildStudioVisibilityWhere('p', (int)$_SESSION['user_id'], 'props');
            $stmt = $pdo->prepare("
                SELECT p.*, s.title AS series_title
                FROM studio_props p
                LEFT JOIN series s ON p.series_id = s.id
                WHERE {$whereClause}
                ORDER BY p.updated_at DESC
            ");
            $stmt->execute($whereParams);
            $props = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'props' => $props]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
