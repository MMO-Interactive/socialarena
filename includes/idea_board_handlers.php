<?php
require_once 'db_connect.php';
require_once 'comfyui.php';
require_once 'studio_access.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


header('Content-Type: application/json');

function extractComfyImageUrl(array $history, string $connectionType = 'image'): ?string {
    $possibleSets = [];
    if (isset($history['outputs'])) {
        $possibleSets[] = $history;
    } else {
        foreach ($history as $promptData) {
            if (isset($promptData['outputs'])) {
                $possibleSets[] = $promptData;
            }
        }
    }

    foreach ($possibleSets as $promptData) {
        foreach ($promptData['outputs'] as $output) {
            if (!empty($output['images'][0])) {
                $image = $output['images'][0];
                return rtrim(comfyuiBaseUrl($connectionType, false), '/') . '/view?' . http_build_query([
                    'filename' => $image['filename'] ?? '',
                    'subfolder' => $image['subfolder'] ?? '',
                    'type' => $image['type'] ?? 'output'
                ]);
            }
        }
    }
    return null;
}

function extractComfyVideoUrl(array $history, string $connectionType = 'video'): ?string {
    $possibleSets = [];
    if (isset($history['outputs'])) {
        $possibleSets[] = $history;
    } else {
        foreach ($history as $promptData) {
            if (isset($promptData['outputs'])) {
                $possibleSets[] = $promptData;
            }
        }
    }

    foreach ($possibleSets as $promptData) {
        foreach ($promptData['outputs'] as $output) {
            if (!empty($output['videos'][0])) {
                $video = $output['videos'][0];
                return rtrim(comfyuiBaseUrl($connectionType, false), '/') . '/view?' . http_build_query([
                    'filename' => $video['filename'] ?? '',
                    'subfolder' => $video['subfolder'] ?? '',
                    'type' => $video['type'] ?? 'output'
                ]);
            }
            if (!empty($output['gifs'][0])) {
                $video = $output['gifs'][0];
                return rtrim(comfyuiBaseUrl($connectionType, false), '/') . '/view?' . http_build_query([
                    'filename' => $video['filename'] ?? '',
                    'subfolder' => $video['subfolder'] ?? '',
                    'type' => $video['type'] ?? 'output'
                ]);
            }
            if (!empty($output['images'][0])) {
                $candidate = $output['images'][0];
                $filename = (string) ($candidate['filename'] ?? '');
                $isAnimated = !empty($output['animated'][0]);
                if ($filename !== '' && ($isAnimated || preg_match('/\.(mp4|webm|mov|mkv|avi)$/i', $filename))) {
                    return rtrim(comfyuiBaseUrl($connectionType, false), '/') . '/view?' . http_build_query([
                        'filename' => $candidate['filename'] ?? '',
                        'subfolder' => $candidate['subfolder'] ?? '',
                        'type' => $candidate['type'] ?? 'output'
                    ]);
                }
            }
        }
    }
    return null;
}

function getBoardOrFail(PDO $pdo, int $boardId, int $userId, bool $requireWrite = true): array {
    $stmt = $pdo->prepare("SELECT * FROM idea_boards WHERE id = ?");
    $stmt->execute([$boardId]);
    $board = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$board) {
        throw new Exception('Invalid board');
    }
    if ((int)$board['user_id'] === $userId) {
        return $board;
    }
    $studioId = (int)($board['studio_id'] ?? 0);
    if (!$studioId) {
        throw new Exception('Unauthorized');
    }
    if (!userHasStudioPermission($pdo, $studioId, $userId, 'idea_boards')) {
        throw new Exception('Unauthorized');
    }
    $visibility = $board['visibility'] ?? 'private';
    if ($visibility === 'private' && $requireWrite) {
        throw new Exception('Unauthorized');
    }
    if ($visibility === 'private' && !$requireWrite) {
        throw new Exception('Unauthorized');
    }
    return $board;
}

function ensureItemWriteAccess(PDO $pdo, int $itemId, int $userId): array {
    $stmt = $pdo->prepare("
        SELECT ib.*
        FROM idea_board_items i
        JOIN idea_boards ib ON i.board_id = ib.id
        WHERE i.id = ?
    ");
    $stmt->execute([$itemId]);
    $board = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$board) {
        throw new Exception('Invalid item');
    }
    if ((int)$board['user_id'] === $userId) {
        return $board;
    }
    $studioId = (int)($board['studio_id'] ?? 0);
    if (!$studioId) {
        throw new Exception('Unauthorized');
    }
    if (!userHasStudioPermission($pdo, $studioId, $userId, 'idea_boards')) {
        throw new Exception('Unauthorized');
    }
    $visibility = $board['visibility'] ?? 'private';
    if (!in_array($visibility, ['studio', 'public'], true)) {
        throw new Exception('Unauthorized');
    }
    return $board;
}

function fetchComfyHistory(string $promptId, string $type = 'image'): array {
    $result = fetchComfyHistoryResult($promptId, $type);
    return $result['data'];
}

function fetchComfyHistoryResult(string $promptId, string $type = 'image'): array {
    $history = comfyuiRequest('/history/' . urlencode($promptId), 'GET', null, [], $type);
    if (empty($history['success'])) {
        return [
            'success' => false,
            'error' => is_string($history['error'] ?? null) ? $history['error'] : 'ComfyUI request failed',
            'data' => []
        ];
    }
    if (!empty($history['success']) && !empty($history['data'])) {
        return ['success' => true, 'error' => null, 'data' => $history['data']];
    }
    $all = comfyuiRequest('/history', 'GET', null, [], $type);
    if (empty($all['success'])) {
        return [
            'success' => false,
            'error' => is_string($all['error'] ?? null) ? $all['error'] : 'ComfyUI request failed',
            'data' => []
        ];
    }
    if (!empty($all['success']) && !empty($all['data']) && isset($all['data'][$promptId])) {
        return ['success' => true, 'error' => null, 'data' => [$promptId => $all['data'][$promptId]]];
    }
    return ['success' => true, 'error' => null, 'data' => []];
}

function markComfyUnavailable(PDO $pdo, int $itemId, string $message = 'ComfyUI unreachable'): void {
    $stmt = $pdo->prepare("
        UPDATE idea_board_items
        SET generation_status = 'failed',
            prompt_text = COALESCE(prompt_text, ''),
            last_error = ?,
            content = content
        WHERE id = ?
    ");
    $stmt->execute([$message, $itemId]);
    $stmt = $pdo->prepare("
        UPDATE idea_board_generations
        SET status = 'failed', error = ?, completed_at = NOW()
        WHERE item_id = ? AND status = 'queued'
        ORDER BY id DESC
        LIMIT 1
    ");
    $stmt->execute([$message, $itemId]);
}

function formatStyleSelector(string $raw): string {
    $raw = trim($raw);
    if ($raw === '') {
        return '';
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return $raw;
    }
    $parts = [];
    if (!empty($data['style'])) {
        $parts[] = $data['style'];
    }
    if (!empty($data['medium'])) {
        $parts[] = $data['medium'];
    }
    if (!empty($data['palette'])) {
        $parts[] = $data['palette'];
    }
    if (!empty($data['mood'])) {
        $parts[] = $data['mood'];
    }
    return implode(', ', $parts);
}

function resolveStyleContent(PDO $pdo, int $styleId): string {
    $stmt = $pdo->prepare("
        SELECT s.content
        FROM idea_board_links l
        JOIN idea_board_items s ON l.source_item_id = s.id
        WHERE l.target_item_id = ? AND s.item_type = 'style_selector'
        ORDER BY l.id DESC
        LIMIT 1
    ");
    $stmt->execute([$styleId]);
    $selector = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($selector && isset($selector['content'])) {
        $formatted = formatStyleSelector((string)$selector['content']);
        if ($formatted !== '') {
            return $formatted;
        }
    }

    $stmt = $pdo->prepare("SELECT content FROM idea_board_items WHERE id = ?");
    $stmt->execute([$styleId]);
    $style = $stmt->fetch(PDO::FETCH_ASSOC);
    return trim((string)($style['content'] ?? ''));
}

function formatLightingContent(?string $content): string {
    if ($content === null || trim($content) === '') {
        return '';
    }
    $decoded = json_decode($content, true);
    if (!is_array($decoded)) {
        return trim($content);
    }
    $mode = $decoded['mode'] ?? 'visual';
    if ($mode === 'advanced') {
        $text = trim((string)($decoded['text'] ?? ''));
        return $text !== '' ? $text : '';
    }
    $parts = [];
    foreach (['key' => 'Key', 'fill' => 'Fill', 'rim' => 'Rim', 'colorTemp' => 'Color temp', 'intensity' => 'Intensity', 'mood' => 'Mood'] as $field => $label) {
        $value = trim((string)($decoded[$field] ?? ''));
        if ($value !== '') {
            $parts[] = $label . ': ' . $value;
        }
    }
    return implode(', ', $parts);
}

function formatVfxContent(?string $content): string {
    if ($content === null || trim($content) === '') {
        return '';
    }
    $decoded = json_decode($content, true);
    if (!is_array($decoded)) {
        return trim($content);
    }
    $mode = $decoded['mode'] ?? 'visual';
    if ($mode === 'advanced') {
        $text = trim((string)($decoded['text'] ?? ''));
        return $text !== '' ? $text : '';
    }
    $parts = [];
    foreach (['type' => 'Type', 'intensity' => 'Intensity', 'integration' => 'Integration', 'priority' => 'Priority', 'notes' => 'Notes'] as $field => $label) {
        $value = trim((string)($decoded[$field] ?? ''));
        if ($value !== '') {
            $parts[] = $label . ': ' . $value;
        }
    }
    return implode(', ', $parts);
}

function formatWardrobeContent(PDO $pdo, ?string $content, int $userId): string {
    if ($content === null || trim($content) === '') {
        return '';
    }
    $decoded = json_decode($content, true);
    if (!is_array($decoded)) {
        return trim($content);
    }
    $wardrobeId = (int)($decoded['wardrobe_id'] ?? 0);
    $variationId = (int)($decoded['variation_id'] ?? 0);
    $notes = trim((string)($decoded['notes'] ?? ''));
    if ($wardrobeId) {
        $stmt = $pdo->prepare("SELECT id, user_id, studio_id, visibility, name, wardrobe_type, description FROM studio_wardrobes WHERE id = ?");
        $stmt->execute([$wardrobeId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $isOwner = (int)$row['user_id'] === $userId;
            $studioId = (int)($row['studio_id'] ?? 0);
            $visibility = $row['visibility'] ?? 'private';
            $hasAccess = $isOwner;
            if (!$hasAccess && $studioId && in_array($visibility, ['studio', 'public'], true)) {
                $hasAccess = userHasStudioPermission($pdo, $studioId, $userId, 'wardrobe');
            }
            if (!$hasAccess) {
                return $notes !== '' ? $notes : '';
            }
            $parts = [];
            if (!empty($row['name'])) {
                $parts[] = $row['name'];
            }
            if (!empty($row['wardrobe_type'])) {
                $parts[] = $row['wardrobe_type'];
            }
            if (!empty($row['description'])) {
                $parts[] = $row['description'];
            }
            if ($variationId) {
                $stmt = $pdo->prepare("SELECT name, description FROM studio_wardrobe_variations WHERE id = ? AND wardrobe_id = ?");
                $stmt->execute([$variationId, $wardrobeId]);
                $variation = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($variation) {
                    if (!empty($variation['name'])) {
                        $parts[] = 'Variation: ' . $variation['name'];
                    }
                    if (!empty($variation['description'])) {
                        $parts[] = $variation['description'];
                    }
                }
            }
            $base = implode(' - ', $parts);
            if ($notes !== '') {
                $base .= ' (Notes: ' . $notes . ')';
            }
            return trim($base);
        }
    }
    return $notes !== '' ? $notes : '';
}

function formatPropContent(PDO $pdo, ?string $content, int $userId): string {
    if ($content === null || trim($content) === '') {
        return '';
    }
    $decoded = json_decode($content, true);
    if (!is_array($decoded)) {
        return trim($content);
    }
    $propId = (int)($decoded['prop_id'] ?? 0);
    $notes = trim((string)($decoded['notes'] ?? ''));
    if ($propId) {
        $stmt = $pdo->prepare("SELECT id, user_id, studio_id, visibility, name, prop_type, description FROM studio_props WHERE id = ?");
        $stmt->execute([$propId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) {
            $isOwner = (int)$row['user_id'] === $userId;
            $studioId = (int)($row['studio_id'] ?? 0);
            $visibility = $row['visibility'] ?? 'private';
            $hasAccess = $isOwner;
            if (!$hasAccess && $studioId && in_array($visibility, ['studio', 'public'], true)) {
                $hasAccess = userHasStudioPermission($pdo, $studioId, $userId, 'props');
            }
            if (!$hasAccess) {
                return $notes !== '' ? $notes : '';
            }
            $parts = [];
            if (!empty($row['name'])) {
                $parts[] = $row['name'];
            }
            if (!empty($row['prop_type'])) {
                $parts[] = $row['prop_type'];
            }
            if (!empty($row['description'])) {
                $parts[] = $row['description'];
            }
            $base = implode(' - ', $parts);
            if ($notes !== '') {
                $base .= ' (Notes: ' . $notes . ')';
            }
            return trim($base);
        }
    }
    return $notes !== '' ? $notes : '';
}

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? ($_POST['action'] ?? ($_GET['action'] ?? ''));

try {
    switch ($action) {
        case 'comfy_status':
            $info = comfyuiConnectionInfo('image');
            $baseUrl = $info['base_url'] ?? '';
            if ($baseUrl === '') {
                echo json_encode(['success' => false, 'status' => 'degraded', 'error' => 'ComfyUI not configured', 'url' => null]);
                break;
            }
            if (empty($info['is_enabled'])) {
                echo json_encode(['success' => false, 'status' => 'degraded', 'error' => 'ComfyUI connection disabled', 'url' => $baseUrl]);
                break;
            }
            $status = comfyuiRequest('/queue', 'GET');
            if (!empty($status['success'])) {
                echo json_encode(['success' => true, 'status' => 'connected', 'url' => $status['url'] ?? null]);
            } else {
                echo json_encode(['success' => false, 'status' => 'offline', 'error' => 'ComfyUI offline', 'url' => $status['url'] ?? null]);
            }
            break;
        case 'upload_audio':
            $board_id = (int)($_POST['board_id'] ?? 0);
            if (!$board_id) {
                throw new Exception('Invalid board');
            }
            getBoardOrFail($pdo, $board_id, (int)$_SESSION['user_id'], true);
            if (empty($_FILES['audio']) || $_FILES['audio']['error'] !== UPLOAD_ERR_OK) {
                throw new Exception('Audio upload failed');
            }
            $audio = $_FILES['audio'];
            $ext = strtolower(pathinfo($audio['name'], PATHINFO_EXTENSION));
            $allowed = ['mp3', 'wav', 'ogg', 'm4a'];
            if (!in_array($ext, $allowed, true)) {
                throw new Exception('Unsupported audio format');
            }
            $uploadDir = __DIR__ . '/../uploads/idea_board_audio/' . $board_id;
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0777, true);
            }
            $safeName = preg_replace('/[^a-zA-Z0-9._-]/', '_', pathinfo($audio['name'], PATHINFO_FILENAME));
            $fileName = $safeName . '_' . uniqid('', true) . '.' . $ext;
            $destPath = $uploadDir . '/' . $fileName;
            if (!move_uploaded_file($audio['tmp_name'], $destPath)) {
                throw new Exception('Failed to save audio');
            }
            $url = 'uploads/idea_board_audio/' . $board_id . '/' . $fileName;
            echo json_encode(['success' => true, 'url' => $url]);
            break;
        case 'create_board':
            $title = trim($data['title'] ?? '');
            if ($title === '') {
                throw new Exception('Title required');
            }
            $description = trim($data['description'] ?? '');
            $studioId = !empty($data['studio_id']) ? (int)$data['studio_id'] : null;
            $visibility = normalizeVisibility($data['visibility'] ?? 'private', $studioId);
            enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'idea_boards');
            $stmt = $pdo->prepare("
                INSERT INTO idea_boards (user_id, studio_id, title, description, visibility)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([$_SESSION['user_id'], $studioId, $title, $description, $visibility]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'get_items':
            $board_id = (int)($_GET['board_id'] ?? 0);
            getBoardOrFail($pdo, $board_id, (int)$_SESSION['user_id'], false);
            $stmt = $pdo->prepare("SELECT * FROM idea_board_items WHERE board_id = ? ORDER BY id ASC");
            $stmt->execute([$board_id]);
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $lineageByItem = [];
            if (!empty($items)) {
                $ids = array_map(static fn($row) => (int)$row['id'], $items);
                $placeholders = implode(',', array_fill(0, count($ids), '?'));
                $stmt = $pdo->prepare("
                    SELECT g.*
                    FROM idea_board_generations g
                    JOIN (
                        SELECT item_id, MAX(id) AS max_id
                        FROM idea_board_generations
                        WHERE item_id IN ($placeholders)
                        GROUP BY item_id
                    ) latest ON g.id = latest.max_id
                ");
                $stmt->execute($ids);
                $latest = $stmt->fetchAll(PDO::FETCH_ASSOC);
                if ($latest) {
                    $genIds = array_column($latest, 'id');
                    $genMap = [];
                    foreach ($latest as $row) {
                        $genMap[(int)$row['id']] = (int)$row['item_id'];
                    }
                    $in = implode(',', array_fill(0, count($genIds), '?'));
                    $stmt = $pdo->prepare("
                        SELECT generation_id, source_item_id, source_type, source_title, link_type
                        FROM idea_board_generation_links
                        WHERE generation_id IN ($in)
                        ORDER BY id ASC
                    ");
                    $stmt->execute($genIds);
                    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $link) {
                        $itemId = $genMap[(int)$link['generation_id']] ?? null;
                        if ($itemId) {
                            $lineageByItem[$itemId][] = $link;
                        }
                    }
                }
            }
            $stmt = $pdo->prepare("
                SELECT l.id, l.source_item_id, l.target_item_id, l.link_type,
                       s.title AS source_title, s.content AS source_content, s.item_type AS source_type
                FROM idea_board_links l
                JOIN idea_board_items s ON l.source_item_id = s.id
                WHERE l.board_id = ?
            ");
            $stmt->execute([$board_id]);
            $links = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $updatedItems = [];
            foreach ($items as $item) {
                if (
                    in_array($item['item_type'], ['character', 'location'], true)
                    && $item['generation_status'] === 'queued'
                    && !empty($item['prompt_id'])
                ) {
                    $historyResult = fetchComfyHistoryResult($item['prompt_id']);
                    $historyData = $historyResult['data'];
                    if (!empty($historyData)) {
                        $imageUrl = extractComfyImageUrl($historyData);
                        if ($imageUrl) {
                            $stmtUpdate = $pdo->prepare("
                                UPDATE idea_board_items
                                SET generated_image_url = ?,
                                    generation_status = 'generated',
                                    generation_count = generation_count + 1,
                                    last_generated_at = NOW(),
                                    last_error = NULL
                                WHERE id = ?
                            ");
                            $stmtUpdate->execute([$imageUrl, $item['id']]);
                            $stmtUpdate = $pdo->prepare("
                                UPDATE idea_board_generations
                                SET status = 'generated', image_url = ?, completed_at = NOW(), error = NULL
                                WHERE item_id = ? AND prompt_id = ?
                                ORDER BY id DESC
                                LIMIT 1
                            ");
                            $stmtUpdate->execute([$imageUrl, $item['id'], $item['prompt_id']]);
                            $item['generated_image_url'] = $imageUrl;
                            $item['generation_status'] = 'generated';
                        }
                    } elseif (empty($historyResult['success'])) {
                        markComfyUnavailable($pdo, (int)$item['id'], (string) ($historyResult['error'] ?? 'ComfyUI unreachable'));
                        $item['generation_status'] = 'failed';
                        $item['last_error'] = (string) ($historyResult['error'] ?? 'ComfyUI unreachable');
                    }
                }
                $itemId = (int)$item['id'];
                if (isset($lineageByItem[$itemId])) {
                    $item['generation_lineage'] = $lineageByItem[$itemId];
                } else {
                    $item['generation_lineage'] = [];
                }
                $updatedItems[] = $item;
            }
            echo json_encode(['success' => true, 'items' => $updatedItems, 'links' => $links]);
            break;

        case 'create_item':
            $board_id = (int)($data['board_id'] ?? 0);
            $item_type = $data['item_type'] ?? '';
            $allowed = ['note', 'image', 'link', 'style', 'style_selector', 'character', 'location', 'scene', 'camera', 'prop', 'wardrobe', 'lighting', 'vfx', 'audio', 'dialogue', 'beat', 'clip'];
            if (!$board_id || !in_array($item_type, $allowed, true)) {
                throw new Exception('Invalid item');
            }
            $board = getBoardOrFail($pdo, $board_id, (int)$_SESSION['user_id'], true);
            $stmt = $pdo->prepare("
                INSERT INTO idea_board_items (board_id, studio_id, item_type, title, content, image_url, link_url, pos_x, pos_y)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $board_id,
                $board['studio_id'] ?? null,
                $item_type,
                trim($data['title'] ?? ''),
                trim($data['content'] ?? ''),
                trim($data['image_url'] ?? ''),
                trim($data['link_url'] ?? ''),
                (int)($data['pos_x'] ?? 30),
                (int)($data['pos_y'] ?? 30)
            ]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'update_item':
            $item_id = (int)($data['item_id'] ?? 0);
            if (!$item_id) {
                throw new Exception('Invalid item');
            }
            ensureItemWriteAccess($pdo, $item_id, (int)$_SESSION['user_id']);
            $stmt = $pdo->prepare("
                UPDATE idea_board_items
                SET title = ?, content = ?, image_url = ?, link_url = ?
                WHERE id = ?
            ");
            $stmt->execute([
                trim($data['title'] ?? ''),
                trim($data['content'] ?? ''),
                trim($data['image_url'] ?? ''),
                trim($data['link_url'] ?? ''),
                $item_id
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'update_position':
            $item_id = (int)($data['item_id'] ?? 0);
            if (!$item_id) {
                throw new Exception('Invalid item');
            }
            ensureItemWriteAccess($pdo, $item_id, (int)$_SESSION['user_id']);
            $stmt = $pdo->prepare("
                UPDATE idea_board_items
                SET pos_x = ?, pos_y = ?
                WHERE id = ?
            ");
            $stmt->execute([
                (int)($data['pos_x'] ?? 0),
                (int)($data['pos_y'] ?? 0),
                $item_id
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'update_size':
            $item_id = (int)($data['item_id'] ?? 0);
            if (!$item_id) {
                throw new Exception('Invalid item');
            }
            $width = max(180, (int)($data['width'] ?? 240));
            $height = max(120, (int)($data['height'] ?? 160));
            ensureItemWriteAccess($pdo, $item_id, (int)$_SESSION['user_id']);
            $stmt = $pdo->prepare("
                UPDATE idea_board_items
                SET width = ?, height = ?
                WHERE id = ?
            ");
            $stmt->execute([$width, $height, $item_id]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_item':
            $item_id = (int)($data['item_id'] ?? 0);
            if (!$item_id) {
                throw new Exception('Invalid item');
            }
            ensureItemWriteAccess($pdo, $item_id, (int)$_SESSION['user_id']);
            $stmt = $pdo->prepare("DELETE FROM idea_board_items WHERE id = ?");
            $stmt->execute([$item_id]);
            echo json_encode(['success' => true]);
            break;

        case 'prompt_preview':
        case 'generate_item':
            $item_id = (int)($data['item_id'] ?? 0);
            if (!$item_id) {
                throw new Exception('Invalid item');
            }
            ensureItemWriteAccess($pdo, $item_id, (int)$_SESSION['user_id']);
            $stmt = $pdo->prepare("SELECT * FROM idea_board_items WHERE id = ?");
            $stmt->execute([$item_id]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$item) {
                throw new Exception('Item not found');
            }
            if (!in_array($item['item_type'], ['character', 'location', 'scene'], true)) {
                throw new Exception('Only character, location, or scene items can be generated');
            }

            $desc = trim($item['content'] ?? '');
            if ($desc === '' && $item['item_type'] !== 'scene') {
                throw new Exception('Description required');
            }

            $stmt = $pdo->prepare("
                SELECT l.link_type, s.id AS source_id, s.title, s.content, s.item_type
                FROM idea_board_links l
                JOIN idea_board_items s ON l.source_item_id = s.id
                WHERE l.board_id = ? AND l.target_item_id = ?
                ORDER BY l.id ASC
            ");
            $stmt->execute([$item['board_id'], $item_id]);
            $linked = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $styleParts = [];
            $noteParts = [];
            $characterParts = [];
            $locationParts = [];
            $characterImages = [];
            $locationImages = [];
            foreach ($linked as $link) {
                $text = trim($link['content'] ?? '');
                if ($text === '' && !empty($link['title'])) {
                    $text = trim($link['title']);
                }
                if ($text === '') {
                    continue;
                }
                if ($link['link_type'] === 'style') {
                    $styleParts[] = resolveStyleContent($pdo, (int)$link['source_id']);
                } elseif ($link['link_type'] === 'note') {
                    if (($link['item_type'] ?? '') === 'lighting') {
                        $formatted = formatLightingContent($link['content'] ?? '');
                        if ($formatted !== '') {
                            $noteParts[] = 'Lighting: ' . $formatted;
                        }
                    } elseif (($link['item_type'] ?? '') === 'vfx') {
                        $formatted = formatVfxContent($link['content'] ?? '');
                        if ($formatted !== '') {
                            $noteParts[] = 'VFX: ' . $formatted;
                        }
                    } elseif (($link['item_type'] ?? '') === 'wardrobe') {
                        $formatted = formatWardrobeContent($pdo, $link['content'] ?? '', (int)$_SESSION['user_id']);
                        if ($formatted !== '') {
                            $noteParts[] = 'Wardrobe: ' . $formatted;
                        }
                    } else {
                        $noteParts[] = $text;
                    }
                }
            }

            if (!empty($styleParts)) {
                $styleParts = array_map(static fn($value) => $value, $styleParts);
            }

            if (empty($styleParts)) {
                $stmt = $pdo->prepare("
                    SELECT content, title
                    FROM idea_board_items
                    WHERE board_id = ? AND item_type = 'style'
                    ORDER BY id DESC
                    LIMIT 1
                ");
                $stmt->execute([$item['board_id']]);
                $styleRow = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($styleRow) {
                    $styleText = trim($styleRow['content'] ?? '');
                    if ($styleText === '' && !empty($styleRow['title'])) {
                        $styleText = trim($styleRow['title']);
                    }
                    if ($styleText !== '') {
                        $styleParts[] = $styleText;
                    }
                }
            }

            $prompt = '';
            if ($item['item_type'] === 'character') {
                $prompt = 'Character concept: ' . $desc . '.';
            } elseif ($item['item_type'] === 'location') {
                $prompt = 'Location concept: ' . $desc . '.';
            } else {
                $prompt = 'Scene: ' . ($desc ?: 'Two characters interacting in a setting.') . '.';
            }
            if (!empty($styleParts)) {
                $prompt .= ' Style: ' . implode(' / ', $styleParts) . '.';
            }
            if (!empty($noteParts)) {
                $prompt .= ' Notes: ' . implode(' ', $noteParts) . '.';
            }
            $prompt .= ' Cinematic, high detail, concept art, realistic lighting, filmic composition.';

            $workflowPath = __DIR__ . '/../comfy/Vantage-Z-Image-Turbo.json';
            $workflowRaw = file_get_contents($workflowPath);
            if ($workflowRaw === false) {
                throw new Exception('Workflow not found');
            }
            $workflow = json_decode($workflowRaw, true);
            if (!is_array($workflow)) {
                throw new Exception('Invalid workflow JSON');
            }

            if ($item['item_type'] === 'scene') {
            $stmt = $pdo->prepare("
                SELECT l.link_type, s.id AS source_id, s.item_type, s.content, s.prompt_text
                FROM idea_board_links l
                JOIN idea_board_items s ON l.source_item_id = s.id
                WHERE l.board_id = ? AND l.target_item_id = ?
                ORDER BY l.id ASC
            ");
                $stmt->execute([$item['board_id'], $item_id]);
                $sceneLinks = $stmt->fetchAll(PDO::FETCH_ASSOC);
                foreach ($sceneLinks as $link) {
                    $text = trim($link['prompt_text'] ?? $link['content'] ?? '');
                    if ($text === '') {
                        continue;
                    }
                    if ($link['item_type'] === 'character') {
                        $characterParts[] = $text;
                    } elseif ($link['item_type'] === 'location') {
                        $locationParts[] = $text;
                    } elseif ($link['item_type'] === 'camera') {
                        $noteParts[] = 'Camera: ' . $text;
                    } elseif (in_array($link['item_type'], ['note', 'prop', 'wardrobe', 'lighting', 'vfx', 'audio', 'dialogue', 'beat'], true)) {
                        if ($link['item_type'] === 'lighting') {
                            $formatted = formatLightingContent($link['content'] ?? '');
                            if ($formatted !== '') {
                                $noteParts[] = 'Lighting: ' . $formatted;
                            }
                        } elseif ($link['item_type'] === 'vfx') {
                            $formatted = formatVfxContent($link['content'] ?? '');
                            if ($formatted !== '') {
                                $noteParts[] = 'VFX: ' . $formatted;
                            }
                        } elseif ($link['item_type'] === 'wardrobe') {
                            $formatted = formatWardrobeContent($pdo, $link['content'] ?? '', (int)$_SESSION['user_id']);
                            if ($formatted !== '') {
                                $noteParts[] = 'Wardrobe: ' . $formatted;
                            }
                        } else {
                            $noteParts[] = $text;
                        }
                    } elseif ($link['item_type'] === 'style') {
                        $styleParts[] = resolveStyleContent($pdo, (int)$link['source_id']);
                    }
                }

                if (!empty($characterParts)) {
                    $prompt .= ' Characters: ' . implode(' | ', array_slice($characterParts, 0, 2)) . '.';
                }
                if (!empty($locationParts)) {
                    $prompt .= ' Location: ' . implode(' | ', array_slice($locationParts, 0, 1)) . '.';
                }
                if (!empty($styleParts)) {
                    $prompt .= ' Style: ' . implode(' / ', $styleParts) . '.';
                }
                if (!empty($noteParts)) {
                    $prompt .= ' Notes: ' . implode(' ', $noteParts) . '.';
                }
            }

            if (isset($workflow['42']['inputs']['text'])) {
                $workflow['42']['inputs']['text'] = $prompt;
            }
            if (isset($workflow['41']['inputs']['seed'])) {
                $workflow['41']['inputs']['seed'] = random_int(1, 999999999);
            }
            if (isset($workflow['9']['inputs']['filename_prefix'])) {
                $workflow['9']['inputs']['filename_prefix'] = 'idea_board/' . $item['board_id'] . '/item_' . $item_id;
            }

            if ($action === 'prompt_preview') {
                echo json_encode(['success' => true, 'prompt' => $prompt]);
                break;
            }

            $result = comfyuiRequest('/prompt', 'POST', ['prompt' => $workflow], [], 'image', false);
            if (empty($result['success'])) {
                $connInfo = comfyuiConnectionInfo('image');
                if (!empty($connInfo['base_url']) && empty($connInfo['is_enabled'])) {
                    $result['error'] = 'ComfyUI connection disabled';
                }
                $stmt = $pdo->prepare("
                    UPDATE idea_board_items
                    SET generation_status = 'failed',
                        last_error = ?
                    WHERE id = ?
                ");
                $stmt->execute(['ComfyUI error: ' . json_encode($result['error'] ?? $result), $item_id]);
                $stmt = $pdo->prepare("
                    INSERT INTO idea_board_generations (item_id, prompt_text, status, error, completed_at)
                    VALUES (?, ?, 'failed', ?, NOW())
                ");
                $stmt->execute([$item_id, $prompt, 'ComfyUI error: ' . json_encode($result['error'] ?? $result)]);
                throw new Exception('ComfyUI error: ' . json_encode($result['error'] ?? $result));
            }
            $promptId = $result['data']['prompt_id'] ?? null;
            if (!$promptId) {
                throw new Exception('Missing prompt id: ' . json_encode($result['data'] ?? $result));
            }

            $stmt = $pdo->prepare("
                UPDATE idea_board_items
                SET prompt_text = ?,
                    prompt_id = ?,
                    generation_status = 'queued',
                    generated_image_url = NULL,
                    last_error = NULL
                WHERE id = ?
            ");
            $stmt->execute([$prompt, $promptId, $item_id]);

            $stmt = $pdo->prepare("
                INSERT INTO idea_board_generations (item_id, prompt_text, prompt_id, status)
                VALUES (?, ?, ?, 'queued')
            ");
            $stmt->execute([$item_id, $prompt, $promptId]);
            $generationId = (int)$pdo->lastInsertId();
            if ($generationId) {
                $stmt = $pdo->prepare("
                    SELECT l.link_type, s.id AS source_id, s.item_type, s.title
                    FROM idea_board_links l
                    JOIN idea_board_items s ON l.source_item_id = s.id
                    WHERE l.board_id = ? AND l.target_item_id = ?
                    ORDER BY l.id ASC
                ");
                $stmt->execute([$item['board_id'], $item_id]);
                $links = $stmt->fetchAll(PDO::FETCH_ASSOC);
                if ($links) {
                    $insert = $pdo->prepare("
                        INSERT INTO idea_board_generation_links (generation_id, source_item_id, source_type, source_title, link_type)
                        VALUES (?, ?, ?, ?, ?)
                    ");
                    foreach ($links as $link) {
                        $insert->execute([
                            $generationId,
                            $link['source_id'],
                            $link['item_type'],
                            $link['title'],
                            $link['link_type']
                        ]);
                    }
                }
            }

            echo json_encode(['success' => true, 'prompt_id' => $promptId]);
            break;
        case 'clip_preview':
            $item_id = (int)($data['item_id'] ?? 0);
            if (!$item_id) {
                throw new Exception('Invalid item');
            }
            ensureItemWriteAccess($pdo, $item_id, (int)$_SESSION['user_id']);
            $stmt = $pdo->prepare("SELECT * FROM idea_board_items WHERE id = ?");
            $stmt->execute([$item_id]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$item || $item['item_type'] !== 'clip') {
                throw new Exception('Clip not found');
            }

            $stmt = $pdo->prepare("
                SELECT l.link_type, s.id AS source_id, s.item_type, s.content, s.prompt_text, s.generated_image_url
                FROM idea_board_links l
                JOIN idea_board_items s ON l.source_item_id = s.id
                WHERE l.board_id = ? AND l.target_item_id = ?
                ORDER BY l.id ASC
            ");
            $stmt->execute([$item['board_id'], $item_id]);
            $links = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $characterParts = [];
            $locationParts = [];
            $styleParts = [];
            $noteParts = [];
            $sceneText = '';
            $sceneImage = '';

            foreach ($links as $link) {
                $text = trim($link['prompt_text'] ?? $link['content'] ?? '');
                if ($link['item_type'] === 'scene') {
                    if ($sceneText === '' && $text !== '') {
                        $sceneText = $text;
                    }
                    if (empty($sceneImage) && !empty($link['generated_image_url'])) {
                        $sceneImage = $link['generated_image_url'];
                    }
                }
                if ($text === '') {
                    continue;
                }
                if ($link['item_type'] === 'character') {
                    $characterParts[] = $text;
                } elseif ($link['item_type'] === 'location') {
                    $locationParts[] = $text;
                } elseif ($link['item_type'] === 'style') {
                    $styleParts[] = resolveStyleContent($pdo, (int)$link['source_id']);
                } elseif ($link['item_type'] === 'lighting') {
                    $formatted = formatLightingContent($link['content'] ?? '');
                    if ($formatted !== '') {
                        $noteParts[] = 'Lighting: ' . $formatted;
                    }
                } elseif ($link['item_type'] === 'vfx') {
                    $formatted = formatVfxContent($link['content'] ?? '');
                    if ($formatted !== '') {
                        $noteParts[] = 'VFX: ' . $formatted;
                    }
                } elseif ($link['item_type'] === 'wardrobe') {
                    $formatted = formatWardrobeContent($pdo, $link['content'] ?? '', (int)$_SESSION['user_id']);
                    if ($formatted !== '') {
                        $noteParts[] = 'Wardrobe: ' . $formatted;
                    }
                } elseif ($link['item_type'] === 'prop') {
                    $formatted = formatPropContent($pdo, $link['content'] ?? '', (int)$_SESSION['user_id']);
                    if ($formatted !== '') {
                        $noteParts[] = 'Props: ' . $formatted;
                    }
                } elseif ($link['item_type'] === 'camera') {
                    $noteParts[] = 'Camera: ' . $text;
                } elseif (in_array($link['item_type'], ['note', 'audio', 'dialogue', 'beat'], true)) {
                    $noteParts[] = $text;
                }
            }

            $prompt = 'LTX-2 Clip Prompt: ';
            $clipNotes = trim($item['content'] ?? '');
            if ($clipNotes !== '') {
                $noteParts[] = $clipNotes;
            }
            if (!empty($characterParts)) {
                $prompt .= 'Characters: ' . implode(' | ', array_slice($characterParts, 0, 3)) . '. ';
            }
            if (!empty($locationParts)) {
                $prompt .= 'Location: ' . implode(' | ', array_slice($locationParts, 0, 1)) . '. ';
            }
            if (!empty($styleParts)) {
                $prompt .= 'Style: ' . implode(' / ', $styleParts) . '. ';
            }
            if (!empty($noteParts)) {
                $prompt .= 'Notes: ' . implode(' ', $noteParts) . '. ';
            }
            $prompt = trim($prompt);

            $stmt = $pdo->prepare("
                UPDATE idea_board_items
                SET prompt_text = ?, link_url = ?
                WHERE id = ?
            ");
            $stmt->execute([$prompt, $sceneImage, $item_id]);

            echo json_encode([
                'success' => true,
                'prompt' => $prompt,
                'scene_image_url' => $sceneImage
            ]);
            break;
        case 'clip_generate':
            $item_id = (int)($data['item_id'] ?? 0);
            if (!$item_id) {
                throw new Exception('Invalid item');
            }
            ensureItemWriteAccess($pdo, $item_id, (int)$_SESSION['user_id']);
            $stmt = $pdo->prepare("SELECT * FROM idea_board_items WHERE id = ?");
            $stmt->execute([$item_id]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$item || $item['item_type'] !== 'clip') {
                throw new Exception('Clip not found');
            }

            // Build prompt + scene image using existing logic
            $stmt = $pdo->prepare("
                SELECT l.link_type, s.id AS source_id, s.item_type, s.content, s.prompt_text, s.generated_image_url
                FROM idea_board_links l
                JOIN idea_board_items s ON l.source_item_id = s.id
                WHERE l.board_id = ? AND l.target_item_id = ?
                ORDER BY l.id ASC
            ");
            $stmt->execute([$item['board_id'], $item_id]);
            $links = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $characterParts = [];
            $locationParts = [];
            $styleParts = [];
            $noteParts = [];
            $sceneImage = '';

            foreach ($links as $link) {
                $text = trim($link['prompt_text'] ?? $link['content'] ?? '');
                if ($link['item_type'] === 'scene' && empty($sceneImage) && !empty($link['generated_image_url'])) {
                    $sceneImage = $link['generated_image_url'];
                }
                if ($text === '') {
                    continue;
                }
                if ($link['item_type'] === 'character') {
                    $characterParts[] = $text;
                } elseif ($link['item_type'] === 'location') {
                    $locationParts[] = $text;
                } elseif ($link['item_type'] === 'style') {
                    $styleParts[] = resolveStyleContent($pdo, (int)$link['source_id']);
                } elseif ($link['item_type'] === 'lighting') {
                    $formatted = formatLightingContent($link['content'] ?? '');
                    if ($formatted !== '') {
                        $noteParts[] = 'Lighting: ' . $formatted;
                    }
                } elseif ($link['item_type'] === 'vfx') {
                    $formatted = formatVfxContent($link['content'] ?? '');
                    if ($formatted !== '') {
                        $noteParts[] = 'VFX: ' . $formatted;
                    }
                } elseif ($link['item_type'] === 'wardrobe') {
                    $formatted = formatWardrobeContent($pdo, $link['content'] ?? '', (int)$_SESSION['user_id']);
                    if ($formatted !== '') {
                        $noteParts[] = 'Wardrobe: ' . $formatted;
                    }
                } elseif ($link['item_type'] === 'prop') {
                    $formatted = formatPropContent($pdo, $link['content'] ?? '', (int)$_SESSION['user_id']);
                    if ($formatted !== '') {
                        $noteParts[] = 'Props: ' . $formatted;
                    }
                } elseif ($link['item_type'] === 'camera') {
                    $noteParts[] = 'Camera: ' . $text;
                } elseif (in_array($link['item_type'], ['note', 'audio', 'dialogue', 'beat'], true)) {
                    $noteParts[] = $text;
                }
            }

            $prompt = 'LTX-2 Clip Prompt: ';
            $clipNotes = trim($item['content'] ?? '');
            if ($clipNotes !== '') {
                $noteParts[] = $clipNotes;
            }
            if (!empty($characterParts)) {
                $prompt .= 'Characters: ' . implode(' | ', array_slice($characterParts, 0, 3)) . '. ';
            }
            if (!empty($locationParts)) {
                $prompt .= 'Location: ' . implode(' | ', array_slice($locationParts, 0, 1)) . '. ';
            }
            if (!empty($styleParts)) {
                $prompt .= 'Style: ' . implode(' / ', $styleParts) . '. ';
            }
            if (!empty($noteParts)) {
                $prompt .= 'Notes: ' . implode(' ', $noteParts) . '. ';
            }
            $prompt = trim($prompt);

            if (!$sceneImage) {
                throw new Exception('Scene image required to generate a clip.');
            }

            // Ensure absolute URL for download
            if (!preg_match('#^https?://#i', $sceneImage)) {
                $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
                $sceneImage = $scheme . '://' . $host . '/' . ltrim($sceneImage, '/');
            }

            $upload = comfyuiUploadImageFromUrl($sceneImage, 'video');
            if (empty($upload['success'])) {
                throw new Exception('ComfyUI upload failed: ' . json_encode($upload['error'] ?? $upload));
            }
            $uploadedName = $upload['name'] ?? '';
            if ($uploadedName === '') {
                throw new Exception('ComfyUI upload failed: missing filename');
            }

            $workflowPath = __DIR__ . '/../comfy/video_ltx2_i2v.json';
            if (!file_exists($workflowPath)) {
                throw new Exception('Video workflow template not found.');
            }
            $workflow = json_decode(file_get_contents($workflowPath), true);
            if (!$workflow) {
                throw new Exception('Failed to load video workflow.');
            }

            if (isset($workflow['98']['inputs']['image'])) {
                $workflow['98']['inputs']['image'] = $uploadedName;
            }
            if (isset($workflow['92:3']['inputs']['text'])) {
                $workflow['92:3']['inputs']['text'] = $prompt;
            }
            if (isset($workflow['92:11']['inputs']['noise_seed'])) {
                $workflow['92:11']['inputs']['noise_seed'] = random_int(1, 999999999);
            }
            if (isset($workflow['92:67']['inputs']['noise_seed'])) {
                $workflow['92:67']['inputs']['noise_seed'] = random_int(1, 999999999);
            }
            if (isset($workflow['75']['inputs']['filename_prefix'])) {
                $workflow['75']['inputs']['filename_prefix'] = 'idea_board/' . $item['board_id'] . '/clip_' . $item_id;
            }

            $result = comfyuiRequest('/prompt', 'POST', ['prompt' => $workflow], [], 'video', true);
            if (empty($result['success'])) {
                $stmt = $pdo->prepare("
                    UPDATE idea_board_items
                    SET generation_status = 'failed',
                        last_error = ?
                    WHERE id = ?
                ");
                $stmt->execute(['ComfyUI error: ' . json_encode($result['error'] ?? $result), $item_id]);
                throw new Exception('ComfyUI error: ' . json_encode($result['error'] ?? $result));
            }

            $promptId = $result['data']['prompt_id'] ?? null;
            if (!$promptId) {
                throw new Exception('Missing prompt id: ' . json_encode($result['data'] ?? $result));
            }

            $stmt = $pdo->prepare("
                UPDATE idea_board_items
                SET prompt_text = ?,
                    prompt_id = ?,
                    link_url = ?,
                    generation_status = 'queued',
                    image_url = NULL,
                    last_error = NULL
                WHERE id = ?
            ");
            $stmt->execute([$prompt, $promptId, $sceneImage, $item_id]);

            $stmt = $pdo->prepare("
                INSERT INTO idea_board_generations (item_id, prompt_text, prompt_id, status)
                VALUES (?, ?, ?, 'queued')
            ");
            $stmt->execute([$item_id, $prompt, $promptId]);

            echo json_encode(['success' => true, 'prompt_id' => $promptId]);
            break;

        case 'refresh_item':
            $item_id = (int)($data['item_id'] ?? 0);
            if (!$item_id) {
                throw new Exception('Invalid item');
            }
            ensureItemWriteAccess($pdo, $item_id, (int)$_SESSION['user_id']);
            $stmt = $pdo->prepare("SELECT * FROM idea_board_items WHERE id = ?");
            $stmt->execute([$item_id]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$item) {
                throw new Exception('Item not found');
            }
            if (empty($item['prompt_id'])) {
                echo json_encode(['success' => true, 'generated' => false, 'status' => $item['generation_status']]);
                break;
            }

            $historyResult = fetchComfyHistoryResult($item['prompt_id'], $item['item_type'] === 'clip' ? 'video' : 'image');
            $historyData = $historyResult['data'];
            $imageUrl = $item['item_type'] === 'clip'
                ? extractComfyVideoUrl($historyData, 'video')
                : extractComfyImageUrl($historyData, 'image');

            if ($imageUrl) {
                $stmt = $pdo->prepare("
                    UPDATE idea_board_items
                    SET generated_image_url = ?,
                        image_url = CASE WHEN item_type = 'clip' THEN ? ELSE image_url END,
                        generation_status = 'generated',
                        generation_count = generation_count + 1,
                        last_generated_at = NOW(),
                        last_error = NULL
                    WHERE id = ?
                ");
                $stmt->execute([$imageUrl, $imageUrl, $item_id]);
                $stmt = $pdo->prepare("
                    UPDATE idea_board_generations
                    SET status = 'generated', image_url = ?, completed_at = NOW(), error = NULL
                    WHERE item_id = ? AND prompt_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                ");
                $stmt->execute([$imageUrl, $item_id, $item['prompt_id']]);
                echo json_encode(['success' => true, 'generated' => true, 'image_url' => $imageUrl, 'status' => 'generated']);
            } else {
                if (empty($historyResult['success'])) {
                    $errorMessage = (string) ($historyResult['error'] ?? 'ComfyUI unreachable');
                    markComfyUnavailable($pdo, $item_id, $errorMessage);
                    echo json_encode(['success' => true, 'generated' => false, 'status' => 'failed', 'error' => $errorMessage]);
                } else {
                    echo json_encode(['success' => true, 'generated' => false, 'status' => $item['generation_status']]);
                }
            }
            break;

        case 'get_generation_history':
            $item_id = (int)($data['item_id'] ?? 0);
            if (!$item_id) {
                throw new Exception('Invalid item');
            }
            ensureItemWriteAccess($pdo, $item_id, (int)$_SESSION['user_id']);
            $stmt = $pdo->prepare("
                SELECT id, prompt_text, prompt_id, image_url, status, error, created_at, completed_at
                FROM idea_board_generations
                WHERE item_id = ?
                ORDER BY created_at DESC
                LIMIT 5
            ");
            $stmt->execute([$item_id]);
            $generations = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $ids = array_column($generations, 'id');
            $linksByGen = [];
            if ($ids) {
                $in = implode(',', array_fill(0, count($ids), '?'));
                $stmt = $pdo->prepare("
                    SELECT generation_id, source_item_id, source_type, source_title, link_type
                    FROM idea_board_generation_links
                    WHERE generation_id IN ($in)
                    ORDER BY id ASC
                ");
                $stmt->execute($ids);
                foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $link) {
                    $linksByGen[$link['generation_id']][] = $link;
                }
            }
            echo json_encode(['success' => true, 'generations' => $generations, 'links' => $linksByGen]);
            break;

        case 'create_link':
            $board_id = (int)($data['board_id'] ?? 0);
            $source_id = (int)($data['source_item_id'] ?? 0);
            $target_id = (int)($data['target_item_id'] ?? 0);
            if (!$board_id || !$source_id || !$target_id || $source_id === $target_id) {
                throw new Exception('Invalid link');
            }
            getBoardOrFail($pdo, $board_id, (int)$_SESSION['user_id'], true);
            $stmt = $pdo->prepare("
                SELECT id, item_type FROM idea_board_items
                WHERE id IN (?, ?) AND board_id = ?
            ");
            $stmt->execute([$source_id, $target_id, $board_id]);
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (count($items) !== 2) {
                throw new Exception('Items not found');
            }
            $types = [];
            foreach ($items as $row) {
                $types[$row['id']] = $row['item_type'];
            }
            $sourceType = $types[$source_id] ?? '';
            $targetType = $types[$target_id] ?? '';
            if (!in_array($sourceType, ['style', 'style_selector', 'note', 'character', 'location', 'scene', 'camera', 'prop', 'wardrobe', 'lighting', 'vfx', 'audio', 'dialogue', 'beat'], true)) {
                throw new Exception('Source must be a style, style selector, note, camera, character, location, scene, or production node');
            }
            if (!in_array($targetType, ['character', 'location', 'scene', 'clip'], true)) {
                if (!($sourceType === 'style_selector' && $targetType === 'style')) {
                    throw new Exception('Target must be a character, location, scene, clip, or style (for style selectors)');
                }
            }
            $linkType = in_array($sourceType, ['style', 'style_selector'], true) ? 'style' : 'note';

            $stmt = $pdo->prepare("
                INSERT INTO idea_board_links (board_id, source_item_id, target_item_id, link_type)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE link_type = VALUES(link_type)
            ");
            $stmt->execute([$board_id, $source_id, $target_id, $linkType]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_link':
            $link_id = (int)($data['link_id'] ?? 0);
            if (!$link_id) {
                throw new Exception('Invalid link');
            }
            $stmt = $pdo->prepare("
                SELECT b.id
                FROM idea_board_links l
                JOIN idea_boards b ON l.board_id = b.id
                WHERE l.id = ?
            ");
            $stmt->execute([$link_id]);
            $boardId = (int)$stmt->fetchColumn();
            if (!$boardId) {
                throw new Exception('Invalid link');
            }
            getBoardOrFail($pdo, $boardId, (int)$_SESSION['user_id'], true);
            $stmt = $pdo->prepare("DELETE FROM idea_board_links WHERE id = ?");
            $stmt->execute([$link_id]);
            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}



