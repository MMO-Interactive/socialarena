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
    $userId = (int)$_SESSION['user_id'];
    switch ($action) {
        case 'add_cast':
            $series_id = (int)($data['series_id'] ?? 0);
            $actor_id = (int)($data['actor_id'] ?? 0);
            if (!$series_id || !$actor_id) {
                throw new Exception('Invalid cast');
            }
            enforceSeriesAccess($pdo, $series_id, $userId, true);
            $stmt = $pdo->prepare("SELECT user_id, studio_id, visibility FROM virtual_actors WHERE id = ?");
            $stmt->execute([$actor_id]);
            $actorRow = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$actorRow) {
                throw new Exception('Actor not found');
            }
            enforceStudioItemAccess(
                $pdo,
                (int)$actorRow['user_id'],
                (int)$actorRow['studio_id'],
                $actorRow['visibility'],
                $userId,
                'virtual_cast',
                false
            );
            $stmt = $pdo->prepare("
                INSERT INTO series_cast (series_id, actor_id, role_name, character_name, notes)
                VALUES (?, ?, ?, ?, '')
                ON DUPLICATE KEY UPDATE role_name = VALUES(role_name), character_name = VALUES(character_name)
            ");
            $stmt->execute([
                $series_id,
                $actor_id,
                trim($data['role_name'] ?? ''),
                trim($data['character_name'] ?? '')
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'remove_cast':
            $cast_id = (int)($data['cast_id'] ?? 0);
            if (!$cast_id) {
                throw new Exception('Invalid cast');
            }
            $stmt = $pdo->prepare("
                SELECT s.created_by, s.studio_id, s.visibility
                FROM series_cast sc
                JOIN series s ON sc.series_id = s.id
                WHERE sc.id = ?
            ");
            $stmt->execute([$cast_id]);
            $seriesRow = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$seriesRow) {
                throw new Exception('Cast entry not found');
            }
            enforceStudioItemAccess(
                $pdo,
                (int)$seriesRow['created_by'],
                (int)$seriesRow['studio_id'],
                $seriesRow['visibility'],
                $userId,
                'series',
                true
            );
            $stmt = $pdo->prepare("DELETE FROM series_cast WHERE id = ?");
            $stmt->execute([$cast_id]);
            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
