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
$action = $data['action'] ?? '';

function getProject(PDO $pdo, int $projectId, int $userId): bool {
    $stmt = $pdo->prepare("SELECT id FROM timeline_projects WHERE id = ? AND user_id = ?");
    $stmt->execute([$projectId, $userId]);
    return (bool)$stmt->fetchColumn();
}

function getTrack(PDO $pdo, int $trackId, int $userId): bool {
    $stmt = $pdo->prepare("SELECT t.id FROM timeline_tracks t JOIN timeline_projects p ON t.project_id = p.id WHERE t.id = ? AND p.user_id = ?");
    $stmt->execute([$trackId, $userId]);
    return (bool)$stmt->fetchColumn();
}

function getItem(PDO $pdo, int $itemId, int $userId): bool {
    $stmt = $pdo->prepare("SELECT i.id FROM timeline_items i JOIN timeline_tracks t ON i.track_id = t.id JOIN timeline_projects p ON t.project_id = p.id WHERE i.id = ? AND p.user_id = ?");
    $stmt->execute([$itemId, $userId]);
    return (bool)$stmt->fetchColumn();
}

try {
    switch ($action) {
        case 'update_project':
            $projectId = (int)($data['project_id'] ?? 0);
            $duration = (int)($data['duration_seconds'] ?? 0);
            if (!$projectId || $duration < 1) {
                throw new Exception('Invalid project');
            }
            if (!getProject($pdo, $projectId, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("UPDATE timeline_projects SET duration_seconds = ? WHERE id = ?");
            $stmt->execute([$duration, $projectId]);
            echo json_encode(['success' => true]);
            break;

        case 'create_track':
            $projectId = (int)($data['project_id'] ?? 0);
            $name = trim($data['name'] ?? '');
            $trackType = $data['track_type'] ?? 'video';
            $allowedTypes = ['video', 'audio', 'image', 'text'];
            if (!$projectId || $name === '' || !in_array($trackType, $allowedTypes, true)) {
                throw new Exception('Invalid track');
            }
            if (!getProject($pdo, $projectId, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("SELECT COALESCE(MAX(track_order), 0) FROM timeline_tracks WHERE project_id = ?");
            $stmt->execute([$projectId]);
            $order = (int)$stmt->fetchColumn() + 1;

            $stmt = $pdo->prepare("INSERT INTO timeline_tracks (project_id, name, track_type, track_order) VALUES (?, ?, ?, ?)");
            $stmt->execute([$projectId, $name, $trackType, $order]);
            echo json_encode(['success' => true]);
            break;

        case 'update_track':
            $trackId = (int)($data['track_id'] ?? 0);
            $name = trim($data['name'] ?? '');
            $trackType = $data['track_type'] ?? 'video';
            $allowedTypes = ['video', 'audio', 'image', 'text'];
            if (!$trackId || $name === '' || !in_array($trackType, $allowedTypes, true)) {
                throw new Exception('Invalid track');
            }
            if (!getTrack($pdo, $trackId, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("UPDATE timeline_tracks SET name = ?, track_type = ? WHERE id = ?");
            $stmt->execute([$name, $trackType, $trackId]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_track':
            $trackId = (int)($data['track_id'] ?? 0);
            if (!$trackId) {
                throw new Exception('Invalid track');
            }
            if (!getTrack($pdo, $trackId, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("DELETE FROM timeline_tracks WHERE id = ?");
            $stmt->execute([$trackId]);
            echo json_encode(['success' => true]);
            break;

        case 'create_item':
            $trackId = (int)($data['track_id'] ?? 0);
            $itemType = $data['item_type'] ?? 'video';
            $allowedTypes = ['video', 'audio', 'image', 'text'];
            if (!$trackId || !in_array($itemType, $allowedTypes, true)) {
                throw new Exception('Invalid item');
            }
            if (!getTrack($pdo, $trackId, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("INSERT INTO timeline_items (track_id, item_type, label, file_url, start_time, duration, notes) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $trackId,
                $itemType,
                trim($data['label'] ?? ''),
                trim($data['file_url'] ?? ''),
                (float)($data['start_time'] ?? 0),
                (float)($data['duration'] ?? 5),
                trim($data['notes'] ?? '')
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'update_item':
            $itemId = (int)($data['item_id'] ?? 0);
            $itemType = $data['item_type'] ?? 'video';
            $allowedTypes = ['video', 'audio', 'image', 'text'];
            if (!$itemId || !in_array($itemType, $allowedTypes, true)) {
                throw new Exception('Invalid item');
            }
            if (!getItem($pdo, $itemId, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("UPDATE timeline_items SET item_type = ?, label = ?, file_url = ?, start_time = ?, duration = ?, notes = ? WHERE id = ?");
            $stmt->execute([
                $itemType,
                trim($data['label'] ?? ''),
                trim($data['file_url'] ?? ''),
                (float)($data['start_time'] ?? 0),
                (float)($data['duration'] ?? 5),
                trim($data['notes'] ?? ''),
                $itemId
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_item':
            $itemId = (int)($data['item_id'] ?? 0);
            if (!$itemId) {
                throw new Exception('Invalid item');
            }
            if (!getItem($pdo, $itemId, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("DELETE FROM timeline_items WHERE id = ?");
            $stmt->execute([$itemId]);
            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
