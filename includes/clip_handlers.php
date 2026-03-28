<?php
require_once 'db_connect.php';
require_once 'studio_access.php';
require_once 'comfyui.php';
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
$action = $_GET['action'] ?? $_POST['action'] ?? ($data['action'] ?? '');

function verifyClipOwnership(PDO $pdo, int $clipId, int $userId): bool {
    $stmt = $pdo->prepare("
        SELECT s.created_by, s.studio_id, s.visibility
        FROM story_scene_clips scp
        JOIN story_scenes ss ON scp.scene_id = ss.id
        JOIN story_chapters ch ON ss.chapter_id = ch.id
        JOIN story_acts a ON ch.act_id = a.id
        JOIN stories s ON a.story_id = s.id
        WHERE scp.id = ?
    ");
    $stmt->execute([$clipId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return false;
    }
    return canAccessStudioItem($pdo, (int)$row['created_by'], (int)$row['studio_id'], $row['visibility'], $userId, 'stories', false);
}

function fetchComfyHistory(string $promptId, string $type = 'image'): array {
    $history = comfyuiRequest('/history/' . urlencode($promptId), 'GET', null, [], $type);
    if (!empty($history['success']) && !empty($history['data'])) {
        return $history['data'];
    }
    $all = comfyuiRequest('/history', 'GET', null, [], $type);
    if (!empty($all['success']) && !empty($all['data']) && isset($all['data'][$promptId])) {
        return [$promptId => $all['data'][$promptId]];
    }
    return [];
}

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

function loadComfyTemplate(string $path): array {
    if (!file_exists($path)) {
        throw new Exception('ComfyUI workflow not found');
    }
    $json = file_get_contents($path);
    $workflow = json_decode($json, true);
    if (!$workflow || !is_array($workflow)) {
        throw new Exception('Invalid ComfyUI workflow JSON');
    }
    return $workflow;
}

function injectPromptIntoWorkflow(array $workflow, string $prompt): array {
    $updated = false;
    foreach ($workflow as $nodeId => $node) {
        if (($node['class_type'] ?? '') === 'CLIPTextEncode' && isset($node['inputs']['text'])) {
            $workflow[$nodeId]['inputs']['text'] = $prompt;
            $updated = true;
            break;
        }
    }
    if (!$updated && isset($workflow['42']['inputs']['text'])) {
        $workflow['42']['inputs']['text'] = $prompt;
    }
    return $workflow;
}

function injectVideoPrompt(array $workflow, string $prompt): array {
    if (isset($workflow['92:3']['inputs']['text'])) {
        $workflow['92:3']['inputs']['text'] = $prompt;
        return $workflow;
    }
    return injectPromptIntoWorkflow($workflow, $prompt);
}

function injectVideoImage(array $workflow, string $uploadedName): array {
    if (isset($workflow['98']['inputs']['image'])) {
        $workflow['98']['inputs']['image'] = $uploadedName;
    }
    return $workflow;
}

function buildClipPrompt(PDO $pdo, int $clipId): string {
    $stmt = $pdo->prepare("
        SELECT scp.title as clip_title, scp.description as clip_description,
               ss.title as scene_title, ss.description as scene_description,
               s.title as story_title
        FROM story_scene_clips scp
        JOIN story_scenes ss ON scp.scene_id = ss.id
        JOIN story_chapters ch ON ss.chapter_id = ch.id
        JOIN story_acts a ON ch.act_id = a.id
        JOIN stories s ON a.story_id = s.id
        WHERE scp.id = ?
    ");
    $stmt->execute([$clipId]);
    $ctx = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

    $stmt = $pdo->prepare("
        SELECT block_type, content
        FROM clip_blocks
        WHERE clip_id = ? AND block_type != 'image'
        ORDER BY sort_order ASC, id ASC
    ");
    $stmt->execute([$clipId]);
    $blocks = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $parts = [];
    if (!empty($ctx['story_title'])) {
        $parts[] = 'Story: ' . $ctx['story_title'];
    }
    if (!empty($ctx['scene_title'])) {
        $parts[] = 'Scene: ' . $ctx['scene_title'];
    }
    if (!empty($ctx['scene_description'])) {
        $parts[] = 'Scene Description: ' . $ctx['scene_description'];
    }
    if (!empty($ctx['clip_title'])) {
        $parts[] = 'Clip: ' . $ctx['clip_title'];
    }
    if (!empty($ctx['clip_description'])) {
        $parts[] = 'Clip Notes: ' . $ctx['clip_description'];
    }

    foreach ($blocks as $block) {
        $content = trim($block['content'] ?? '');
        if ($content === '') {
            continue;
        }
        $label = strtoupper(str_replace('_', ' ', $block['block_type']));
        $parts[] = $label . ': ' . $content;
    }

    return implode("\n\n", $parts);
}

function ensureImageBlock(PDO $pdo, int $clipId): int {
    $stmt = $pdo->prepare("SELECT id FROM clip_blocks WHERE clip_id = ? AND block_type = 'image' ORDER BY sort_order ASC, id ASC LIMIT 1");
    $stmt->execute([$clipId]);
    $existing = $stmt->fetchColumn();
    if ($existing) {
        return (int)$existing;
    }
    $stmt = $pdo->prepare("SELECT COALESCE(MAX(sort_order), 0) FROM clip_blocks WHERE clip_id = ?");
    $stmt->execute([$clipId]);
    $nextOrder = (int)$stmt->fetchColumn() + 1;
    $stmt = $pdo->prepare("INSERT INTO clip_blocks (clip_id, block_type, content, sort_order, image_url) VALUES (?, 'image', '', ?, NULL)");
    $stmt->execute([$clipId, $nextOrder]);
    return (int)$pdo->lastInsertId();
}

function getClipImageUrl(PDO $pdo, int $clipId): ?string {
    $stmt = $pdo->prepare("SELECT image_url FROM clip_blocks WHERE clip_id = ? AND block_type = 'image' AND image_url IS NOT NULL ORDER BY sort_order ASC, id ASC LIMIT 1");
    $stmt->execute([$clipId]);
    $url = $stmt->fetchColumn();
    return $url ? (string)$url : null;
}

try {
    switch ($action) {
        case 'get_blocks':
            $clip_id = isset($_GET['clip_id']) ? (int)$_GET['clip_id'] : 0;
            if (!$clip_id || !verifyClipOwnership($pdo, $clip_id, (int)$_SESSION['user_id'])) {
                throw new Exception('Invalid clip');
            }
            $stmt = $pdo->prepare("
                SELECT id, block_type, content, sort_order, image_url
                FROM clip_blocks
                WHERE clip_id = ?
                ORDER BY sort_order ASC, id ASC
            ");
            $stmt->execute([$clip_id]);
            echo json_encode(['success' => true, 'blocks' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        case 'add_block':
            $clip_id = (int)($data['clip_id'] ?? 0);
            $block_type = $data['block_type'] ?? '';
            if (!$clip_id || !verifyClipOwnership($pdo, $clip_id, (int)$_SESSION['user_id'])) {
                throw new Exception('Invalid clip');
            }
            $allowed = ['scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'image'];
            if (!in_array($block_type, $allowed, true)) {
                throw new Exception('Invalid block type');
            }
            $stmt = $pdo->prepare("SELECT COALESCE(MAX(sort_order), 0) FROM clip_blocks WHERE clip_id = ?");
            $stmt->execute([$clip_id]);
            $nextOrder = (int)$stmt->fetchColumn() + 1;

            $stmt = $pdo->prepare("
                INSERT INTO clip_blocks (clip_id, block_type, content, sort_order, image_url)
                VALUES (?, ?, '', ?, NULL)
            ");
            $stmt->execute([$clip_id, $block_type, $nextOrder]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'update_block':
            $block_id = (int)($data['block_id'] ?? 0);
            $content = $data['content'] ?? '';
            if (!$block_id) {
                throw new Exception('Invalid block');
            }
            $stmt = $pdo->prepare("SELECT clip_id FROM clip_blocks WHERE id = ?");
            $stmt->execute([$block_id]);
            $clip_id = (int)$stmt->fetchColumn();
            if (!$clip_id || !verifyClipOwnership($pdo, $clip_id, (int)$_SESSION['user_id'])) {
                throw new Exception('Invalid block');
            }
            $stmt = $pdo->prepare("UPDATE clip_blocks SET content = ? WHERE id = ?");
            $stmt->execute([$content, $block_id]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_block':
            $block_id = (int)($data['block_id'] ?? 0);
            if (!$block_id) {
                throw new Exception('Invalid block');
            }
            $stmt = $pdo->prepare("SELECT clip_id FROM clip_blocks WHERE id = ?");
            $stmt->execute([$block_id]);
            $clip_id = (int)$stmt->fetchColumn();
            if (!$clip_id || !verifyClipOwnership($pdo, $clip_id, (int)$_SESSION['user_id'])) {
                throw new Exception('Invalid block');
            }
            $stmt = $pdo->prepare("DELETE FROM clip_blocks WHERE id = ?");
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
                $stmt = $pdo->prepare("SELECT clip_id FROM clip_blocks WHERE id = ?");
                $stmt->execute([$blockId]);
                $clip_id = (int)$stmt->fetchColumn();
                if (!$clip_id || !verifyClipOwnership($pdo, $clip_id, (int)$_SESSION['user_id'])) {
                    throw new Exception('Invalid block');
                }
                $stmt = $pdo->prepare("UPDATE clip_blocks SET sort_order = ? WHERE id = ?");
                $stmt->execute([$position, $blockId]);
                $position++;
            }
            echo json_encode(['success' => true]);
            break;

        case 'upload_image':
            $block_id = (int)($_POST['block_id'] ?? 0);
            if (!$block_id) {
                throw new Exception('Invalid block');
            }
            $stmt = $pdo->prepare("SELECT clip_id FROM clip_blocks WHERE id = ?");
            $stmt->execute([$block_id]);
            $clip_id = (int)$stmt->fetchColumn();
            if (!$clip_id || !verifyClipOwnership($pdo, $clip_id, (int)$_SESSION['user_id'])) {
                throw new Exception('Invalid block');
            }
            if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
                throw new Exception('Upload failed');
            }
            $file = $_FILES['image'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            if (!in_array($ext, $allowed, true)) {
                throw new Exception('Invalid file type');
            }
            $upload_dir = __DIR__ . '/../uploads/clips/';
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0777, true);
            }
            $filename = 'clip_' . $_SESSION['user_id'] . '_' . uniqid() . '.' . $ext;
            $target = $upload_dir . $filename;
            if (!move_uploaded_file($file['tmp_name'], $target)) {
                throw new Exception('Failed to save file');
            }
            $url = 'uploads/clips/' . $filename;
            $stmt = $pdo->prepare("UPDATE clip_blocks SET image_url = ? WHERE id = ?");
            $stmt->execute([$url, $block_id]);
            echo json_encode(['success' => true, 'url' => $url]);
            break;

        case 'generate_prompt':
            $clip_id = (int)($data['clip_id'] ?? 0);
            if (!$clip_id || !verifyClipOwnership($pdo, $clip_id, (int)$_SESSION['user_id'])) {
                throw new Exception('Invalid clip');
            }
            $promptText = buildClipPrompt($pdo, $clip_id);
            $stmt = $pdo->prepare("UPDATE story_scene_clips SET clip_prompt = ? WHERE id = ?");
            $stmt->execute([$promptText, $clip_id]);
            echo json_encode(['success' => true, 'prompt' => $promptText]);
            break;

        case 'view_prompt':
            $clip_id = (int)($data['clip_id'] ?? 0);
            if (!$clip_id || !verifyClipOwnership($pdo, $clip_id, (int)$_SESSION['user_id'])) {
                throw new Exception('Invalid clip');
            }
            $stmt = $pdo->prepare("SELECT clip_prompt, starting_image_prompt FROM story_scene_clips WHERE id = ?");
            $stmt->execute([$clip_id]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
            echo json_encode(['success' => true, 'prompt' => $row['clip_prompt'] ?? '', 'starting_prompt' => $row['starting_image_prompt'] ?? '']);
            break;

        case 'generate_starting_image':
            $clip_id = (int)($data['clip_id'] ?? 0);
            if (!$clip_id || !verifyClipOwnership($pdo, $clip_id, (int)$_SESSION['user_id'])) {
                throw new Exception('Invalid clip');
            }
            $promptText = buildClipPrompt($pdo, $clip_id);
            $startingPrompt = "Starting frame, cinematic still.\n" . $promptText;
            $workflow = loadComfyTemplate(__DIR__ . '/../comfy/Vantage-Z-Image-Turbo.json');
            $workflow = injectPromptIntoWorkflow($workflow, $startingPrompt);
            if (isset($workflow['9']['inputs']['filename_prefix'])) {
                $workflow['9']['inputs']['filename_prefix'] = 'clips/starting_' . $clip_id;
            }

            $request = comfyuiRequest('/prompt', 'POST', ['prompt' => $workflow], [], 'image');
            if (empty($request['success'])) {
                throw new Exception('ComfyUI error: ' . (is_array($request['error']) ? json_encode($request['error']) : $request['error']));
            }
            $promptId = $request['data']['prompt_id'] ?? null;
            if (!$promptId) {
                throw new Exception('Missing prompt id');
            }
            $stmt = $pdo->prepare("
                UPDATE story_scene_clips
                SET starting_image_prompt = ?, starting_image_prompt_id = ?, starting_image_status = 'queued'
                WHERE id = ?
            ");
            $stmt->execute([$startingPrompt, $promptId, $clip_id]);
            echo json_encode(['success' => true, 'prompt_id' => $promptId]);
            break;

        case 'generate_clip':
            $clip_id = (int)($data['clip_id'] ?? 0);
            if (!$clip_id || !verifyClipOwnership($pdo, $clip_id, (int)$_SESSION['user_id'])) {
                throw new Exception('Invalid clip');
            }
            $imageUrl = getClipImageUrl($pdo, $clip_id);
            if (!$imageUrl) {
                throw new Exception('Starting image not found');
            }
            $promptText = buildClipPrompt($pdo, $clip_id);
            $workflow = loadComfyTemplate(__DIR__ . '/../comfy/video_ltx2_i2v.json');
            $upload = comfyuiUploadImageFromUrl($imageUrl, 'video');
            if (empty($upload['success'])) {
                throw new Exception('ComfyUI upload error: ' . $upload['error']);
            }
            $workflow = injectVideoPrompt($workflow, $promptText);
            $workflow = injectVideoImage($workflow, $upload['name']);
            if (isset($workflow['75']['inputs']['filename_prefix'])) {
                $workflow['75']['inputs']['filename_prefix'] = 'clips/ltx2_' . $clip_id;
            }

            $request = comfyuiRequest('/prompt', 'POST', ['prompt' => $workflow], [], 'video');
            if (empty($request['success'])) {
                throw new Exception('ComfyUI error: ' . (is_array($request['error']) ? json_encode($request['error']) : $request['error']));
            }
            $promptId = $request['data']['prompt_id'] ?? null;
            if (!$promptId) {
                throw new Exception('Missing prompt id');
            }
            $stmt = $pdo->prepare("
                UPDATE story_scene_clips
                SET clip_prompt = ?, clip_prompt_id = ?, clip_status = 'queued'
                WHERE id = ?
            ");
            $stmt->execute([$promptText, $promptId, $clip_id]);
            echo json_encode(['success' => true, 'prompt_id' => $promptId]);
            break;

        case 'get_status':
            $clip_id = isset($_GET['clip_id']) ? (int)$_GET['clip_id'] : (int)($data['clip_id'] ?? 0);
            if (!$clip_id || !verifyClipOwnership($pdo, $clip_id, (int)$_SESSION['user_id'])) {
                throw new Exception('Invalid clip');
            }
            $stmt = $pdo->prepare("
                SELECT starting_image_prompt_id, starting_image_status, clip_prompt_id, clip_status, clip_video_url
                FROM story_scene_clips
                WHERE id = ?
            ");
            $stmt->execute([$clip_id]);
            $clipRow = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

            $startingUrl = getClipImageUrl($pdo, $clip_id);
            if (!empty($clipRow['starting_image_prompt_id']) && $clipRow['starting_image_status'] !== 'generated') {
                $history = fetchComfyHistory($clipRow['starting_image_prompt_id'], 'image');
                $imageUrl = extractComfyImageUrl($history, 'image');
                if ($imageUrl) {
                    $imageBlockId = ensureImageBlock($pdo, $clip_id);
                    $stmt = $pdo->prepare("UPDATE clip_blocks SET image_url = ? WHERE id = ?");
                    $stmt->execute([$imageUrl, $imageBlockId]);
                    $stmt = $pdo->prepare("UPDATE story_scene_clips SET starting_image_status = 'generated' WHERE id = ?");
                    $stmt->execute([$clip_id]);
                    $startingUrl = $imageUrl;
                    $clipRow['starting_image_status'] = 'generated';
                }
            }

            $clipUrl = $clipRow['clip_video_url'] ?? null;
            if (!empty($clipRow['clip_prompt_id']) && $clipRow['clip_status'] !== 'generated') {
                $history = fetchComfyHistory($clipRow['clip_prompt_id'], 'video');
                $videoUrl = extractComfyVideoUrl($history, 'video');
                if ($videoUrl) {
                    $stmt = $pdo->prepare("UPDATE story_scene_clips SET clip_video_url = ?, clip_status = 'generated' WHERE id = ?");
                    $stmt->execute([$videoUrl, $clip_id]);
                    $clipUrl = $videoUrl;
                    $clipRow['clip_status'] = 'generated';
                }
            }

            echo json_encode([
                'success' => true,
                'starting_image_url' => $startingUrl,
                'starting_image_status' => $clipRow['starting_image_status'] ?? 'idle',
                'clip_video_url' => $clipUrl,
                'clip_status' => $clipRow['clip_status'] ?? 'idle'
            ]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
