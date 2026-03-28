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
$action = $_GET['action'] ?? ($data['action'] ?? '');

function verifySceneOwnership($pdo, $sceneId, $userId) {
    $stmt = $pdo->prepare("
        SELECT s.created_by, s.studio_id, s.visibility
        FROM story_scenes sc
        JOIN story_chapters ch ON sc.chapter_id = ch.id
        JOIN story_acts a ON ch.act_id = a.id
        JOIN stories s ON a.story_id = s.id
        WHERE sc.id = ?
    ");
    $stmt->execute([$sceneId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return false;
    }
    return canAccessStudioItem($pdo, (int)$row['created_by'], (int)$row['studio_id'], $row['visibility'], (int)$userId, 'stories', false);
}

try {
    switch ($action) {
        case 'get_blocks':
            $scene_id = isset($_GET['scene_id']) ? (int)$_GET['scene_id'] : 0;
            if (!$scene_id || !verifySceneOwnership($pdo, $scene_id, $_SESSION['user_id'])) {
                throw new Exception('Invalid scene');
            }
            $stmt = $pdo->prepare("
                SELECT id, block_type, content, sort_order
                FROM screenplay_blocks
                WHERE scene_id = ?
                ORDER BY sort_order ASC, id ASC
            ");
            $stmt->execute([$scene_id]);
            echo json_encode(['success' => true, 'blocks' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        case 'add_block':
            $scene_id = (int)($data['scene_id'] ?? 0);
            $block_type = $data['block_type'] ?? '';
            if (!$scene_id || !verifySceneOwnership($pdo, $scene_id, $_SESSION['user_id'])) {
                throw new Exception('Invalid scene');
            }
            $allowed = ['scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition'];
            if (!in_array($block_type, $allowed, true)) {
                throw new Exception('Invalid block type');
            }
            $stmt = $pdo->prepare("SELECT COALESCE(MAX(sort_order), 0) FROM screenplay_blocks WHERE scene_id = ?");
            $stmt->execute([$scene_id]);
            $nextOrder = (int)$stmt->fetchColumn() + 1;

            $stmt = $pdo->prepare("
                INSERT INTO screenplay_blocks (scene_id, block_type, content, sort_order)
                VALUES (?, ?, '', ?)
            ");
            $stmt->execute([$scene_id, $block_type, $nextOrder]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'update_block':
            $block_id = (int)($data['block_id'] ?? 0);
            $content = $data['content'] ?? '';
            if (!$block_id) {
                throw new Exception('Invalid block');
            }
            $stmt = $pdo->prepare("SELECT scene_id FROM screenplay_blocks WHERE id = ?");
            $stmt->execute([$block_id]);
            $scene_id = (int)$stmt->fetchColumn();
            if (!$scene_id || !verifySceneOwnership($pdo, $scene_id, $_SESSION['user_id'])) {
                throw new Exception('Invalid block');
            }
            $stmt = $pdo->prepare("UPDATE screenplay_blocks SET content = ? WHERE id = ?");
            $stmt->execute([$content, $block_id]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_block':
            $block_id = (int)($data['block_id'] ?? 0);
            if (!$block_id) {
                throw new Exception('Invalid block');
            }
            $stmt = $pdo->prepare("SELECT scene_id FROM screenplay_blocks WHERE id = ?");
            $stmt->execute([$block_id]);
            $scene_id = (int)$stmt->fetchColumn();
            if (!$scene_id || !verifySceneOwnership($pdo, $scene_id, $_SESSION['user_id'])) {
                throw new Exception('Invalid block');
            }
            $stmt = $pdo->prepare("DELETE FROM screenplay_blocks WHERE id = ?");
            $stmt->execute([$block_id]);
            echo json_encode(['success' => true]);
            break;

        case 'update_order':
            $order = $data['order'] ?? [];
            if (!is_array($order) || empty($order)) {
                throw new Exception('Invalid order');
            }
            $position = 1;
            foreach ($order as $blockId) {
                $blockId = (int)$blockId;
                $stmt = $pdo->prepare("SELECT scene_id FROM screenplay_blocks WHERE id = ?");
                $stmt->execute([$blockId]);
                $scene_id = (int)$stmt->fetchColumn();
                if (!$scene_id || !verifySceneOwnership($pdo, $scene_id, $_SESSION['user_id'])) {
                    throw new Exception('Invalid block');
                }
                $stmt = $pdo->prepare("UPDATE screenplay_blocks SET sort_order = ? WHERE id = ?");
                $stmt->execute([$position, $blockId]);
                $position++;
            }
            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
