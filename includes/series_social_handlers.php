<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/comfyui.php';
require_once __DIR__ . '/studio_access.php';

header('Content-Type: application/json');

set_error_handler(function ($severity, $message, $file, $line) {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

function jsonResponse(bool $success, array $payload = []): void {
    echo json_encode(array_merge(['success' => $success], $payload));
    exit;
}

function requireInt(array $payload, string $key): int {
    if (!isset($payload[$key])) {
        throw new Exception('Missing ' . $key);
    }
    $value = (int)$payload[$key];
    if ($value <= 0) {
        throw new Exception('Invalid ' . $key);
    }
    return $value;
}

function fetchSeries(PDO $pdo, int $seriesId, int $userId): array {
    $stmt = $pdo->prepare('SELECT * FROM series WHERE id = ?');
    $stmt->execute([$seriesId]);
    $series = $stmt->fetch();
    if (!$series) {
        throw new Exception('Series not found');
    }
    enforceSeriesAccess($pdo, $seriesId, $userId, true);
    return $series;
}

function fetchWeek(PDO $pdo, int $weekId, int $userId): array {
    $stmt = $pdo->prepare('SELECT w.*, s.title AS series_title, s.description AS series_description FROM series_social_weeks w JOIN series s ON s.id = w.series_id WHERE w.id = ?');
    $stmt->execute([$weekId]);
    $week = $stmt->fetch();
    if (!$week) {
        throw new Exception('Week not found');
    }
    enforceSeriesAccess($pdo, (int)$week['series_id'], $userId, true);
    return $week;
}

function getSettings(PDO $pdo, int $seriesId): array {
    $stmt = $pdo->prepare('SELECT * FROM series_social_settings WHERE series_id = ?');
    $stmt->execute([$seriesId]);
    $settings = $stmt->fetch();
    if (!$settings) {
        $settings = [
            'series_id' => $seriesId,
            'checkpoint_name' => '',
            'negative_prompt' => '',
            'width' => 1280,
            'height' => 1280,
            'steps' => 7,
            'cfg_scale' => 1.0,
            'sampler_name' => 'euler',
            'scheduler' => 'normal'
        ];
    }
    return $settings;
}

function getAsset(PDO $pdo, int $weekId, int $dayIndex): array {
    $stmt = $pdo->prepare('SELECT * FROM series_social_assets WHERE week_id = ? AND day_index = ?');
    $stmt->execute([$weekId, $dayIndex]);
    $asset = $stmt->fetch();
    if (!$asset) {
        $stmt = $pdo->prepare('INSERT INTO series_social_assets (week_id, day_index) VALUES (?, ?)');
        $stmt->execute([$weekId, $dayIndex]);
        $stmt = $pdo->prepare('SELECT * FROM series_social_assets WHERE week_id = ? AND day_index = ?');
        $stmt->execute([$weekId, $dayIndex]);
        $asset = $stmt->fetch();
    }
    return $asset;
}

function buildPrompt(array $week, int $dayIndex, string $customPrompt, string $shotType): string {
    $days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    $day = $days[$dayIndex] ?? 'Day ' . ($dayIndex + 1);
    $seriesTitle = trim((string)($week['series_title'] ?? ''));
    $seriesDescription = trim((string)($week['series_description'] ?? ''));
    $theme = trim((string)($week['theme'] ?? ''));

    $contextParts = [];
    if ($seriesTitle !== '') {
        $contextParts[] = 'Series: ' . $seriesTitle . '.';
    }
    if ($seriesDescription !== '') {
        $contextParts[] = 'Series description: ' . $seriesDescription . '.';
    }
    if ($theme !== '') {
        $contextParts[] = 'Weekly theme: ' . $theme . '.';
    }
    $contextParts[] = 'Day: ' . $day . ' social post concept.';
    if ($shotType !== '') {
        $contextParts[] = 'Shot type: ' . $shotType . '.';
    }
    $contextParts[] = 'Cinematic still, high detail, realistic lighting, filmic composition, key art.';

    $context = implode(' ', $contextParts);
    if ($customPrompt !== '') {
        return trim($customPrompt . ' ' . $context);
    }
    return $context;
}

function buildBtsPrompt(string $basePrompt): string {
    return trim('Behind-the-scenes / pipeline render. Show lighting rigs, crew hints, and production gear. ' . $basePrompt);
}

function applyWorkflowSettings(array $workflow, array $settings, string $promptText, int $seed, string $filenamePrefix): array {
    if (isset($workflow['42']['inputs']['text'])) {
        $workflow['42']['inputs']['text'] = $promptText;
    }
    if (!empty($settings['negative_prompt']) && isset($workflow['53']['inputs']['text'])) {
        $workflow['53']['inputs']['text'] = $settings['negative_prompt'];
    }
    if (isset($workflow['45']['inputs']['width'])) {
        $workflow['45']['inputs']['width'] = (int)$settings['width'];
    }
    if (isset($workflow['45']['inputs']['height'])) {
        $workflow['45']['inputs']['height'] = (int)$settings['height'];
    }
    if (isset($workflow['41']['inputs']['steps'])) {
        $workflow['41']['inputs']['steps'] = (int)$settings['steps'];
    }
    if (isset($workflow['41']['inputs']['cfg'])) {
        $workflow['41']['inputs']['cfg'] = (float)$settings['cfg_scale'];
    }
    if (!empty($settings['sampler_name']) && isset($workflow['41']['inputs']['sampler_name'])) {
        $workflow['41']['inputs']['sampler_name'] = $settings['sampler_name'];
    }
    if (!empty($settings['scheduler']) && isset($workflow['41']['inputs']['scheduler'])) {
        $workflow['41']['inputs']['scheduler'] = $settings['scheduler'];
    }
    if (isset($workflow['41']['inputs']['seed'])) {
        $workflow['41']['inputs']['seed'] = $seed;
    }
    if (!empty($settings['checkpoint_name']) && isset($workflow['47']['inputs']['unet_name'])) {
        $workflow['47']['inputs']['unet_name'] = $settings['checkpoint_name'];
    }
    if (isset($workflow['9']['inputs']['filename_prefix'])) {
        $workflow['9']['inputs']['filename_prefix'] = $filenamePrefix;
    }

    return $workflow;
}

function queueWorkflow(array $workflow): array {
    $result = comfyuiRequest('/prompt', 'POST', ['prompt' => $workflow]);
    if (!$result['success']) {
        return ['success' => false, 'error' => $result['error'] ?? 'ComfyUI error'];
    }
    $promptId = $result['data']['prompt_id'] ?? null;
    if (!$promptId) {
        return ['success' => false, 'error' => 'Missing prompt id'];
    }
    return ['success' => true, 'prompt_id' => $promptId];
}

function buildImageUrl(array $image): string {
    $filename = $image['filename'] ?? '';
    $subfolder = $image['subfolder'] ?? '';
    $type = $image['type'] ?? 'output';
    $params = [
        'filename' => $filename,
        'subfolder' => $subfolder,
        'type' => $type
    ];
    return rtrim(comfyuiBaseUrl(), '/') . '/view?' . http_build_query($params);
}

function extractImageUrl(array $history): ?string {
    foreach ($history as $promptData) {
        if (empty($promptData['outputs'])) {
            continue;
        }
        foreach ($promptData['outputs'] as $output) {
            if (!empty($output['images'][0])) {
                return buildImageUrl($output['images'][0]);
            }
        }
    }
    return null;
}

function refreshPrompt(string $promptId): array {
    $result = comfyuiRequest('/history/' . urlencode($promptId), 'GET');
    if (!$result['success']) {
        return ['success' => false, 'error' => $result['error'] ?? 'ComfyUI history error'];
    }
    $history = $result['data'] ?? [];
    $url = extractImageUrl($history);
    if ($url) {
        return ['success' => true, 'image_url' => $url];
    }
    return ['success' => true, 'image_url' => null];
}

function queueAsset(PDO $pdo, array $week, int $dayIndex, int $userId): void {
    $asset = getAsset($pdo, (int)$week['id'], $dayIndex);
    $settings = getSettings($pdo, (int)$week['series_id']);

    $workflowPath = __DIR__ . '/../comfy/Vantage-Z-Image-Turbo.json';
    $workflowRaw = file_get_contents($workflowPath);
    if ($workflowRaw === false) {
        throw new Exception('Workflow not found');
    }
    $workflow = json_decode($workflowRaw, true);
    if (!is_array($workflow)) {
        throw new Exception('Invalid workflow JSON');
    }

    $customPrompt = trim((string)($asset['custom_prompt'] ?? ''));
    $shotType = trim((string)($asset['shot_type'] ?? ''));
    $basePrompt = buildPrompt($week, $dayIndex, $customPrompt, $shotType);

    $filenamePrefix = 'series_social/' . $week['series_id'] . '/week_' . $week['id'] . '/day_' . ($dayIndex + 1);
    $seed = random_int(1, 999999999);
    $mainWorkflow = applyWorkflowSettings($workflow, $settings, $basePrompt, $seed, $filenamePrefix);

    $queueResult = queueWorkflow($mainWorkflow);
    if (!$queueResult['success']) {
        $stmt = $pdo->prepare('UPDATE series_social_assets SET status = ?, prompt = ? WHERE week_id = ? AND day_index = ?');
        $stmt->execute(['failed', $basePrompt, $week['id'], $dayIndex]);
        throw new Exception($queueResult['error']);
    }

    $stmt = $pdo->prepare('UPDATE series_social_assets SET prompt = ?, status = ?, prompt_id = ? WHERE week_id = ? AND day_index = ?');
    $stmt->execute([$basePrompt, 'queued', $queueResult['prompt_id'], $week['id'], $dayIndex]);

    if (!empty($asset['include_bts'])) {
        $btsPrompt = buildBtsPrompt($basePrompt);
        $btsSeed = random_int(1, 999999999);
        $btsPrefix = 'series_social/' . $week['series_id'] . '/week_' . $week['id'] . '/day_' . ($dayIndex + 1) . '_bts';
        $btsWorkflow = applyWorkflowSettings($workflow, $settings, $btsPrompt, $btsSeed, $btsPrefix);
        $btsResult = queueWorkflow($btsWorkflow);

        if ($btsResult['success']) {
            $stmt = $pdo->prepare('UPDATE series_social_assets SET alt_status = ?, alt_prompt_id = ? WHERE week_id = ? AND day_index = ?');
            $stmt->execute(['queued', $btsResult['prompt_id'], $week['id'], $dayIndex]);
        } else {
            $stmt = $pdo->prepare('UPDATE series_social_assets SET alt_status = ? WHERE week_id = ? AND day_index = ?');
            $stmt->execute(['failed', $week['id'], $dayIndex]);
        }
    } else {
        $stmt = $pdo->prepare('UPDATE series_social_assets SET alt_status = ?, alt_prompt_id = ?, alt_image_url = ? WHERE week_id = ? AND day_index = ?');
        $stmt->execute(['pending', null, null, $week['id'], $dayIndex]);
    }
}

try {
    $payload = json_decode(file_get_contents('php://input'), true);
    if (!is_array($payload)) {
        $payload = $_POST;
    }

    $action = $payload['action'] ?? '';
    if ($action === '') {
        throw new Exception('Missing action');
    }

    $userId = (int)$_SESSION['user_id'];

    switch ($action) {
        case 'save_settings': {
            $seriesId = requireInt($payload, 'series_id');
            fetchSeries($pdo, $seriesId, $userId);

            $stmt = $pdo->prepare('INSERT INTO series_social_settings (series_id, checkpoint_name, negative_prompt, width, height, steps, cfg_scale, sampler_name, scheduler) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE checkpoint_name = VALUES(checkpoint_name), negative_prompt = VALUES(negative_prompt), width = VALUES(width), height = VALUES(height), steps = VALUES(steps), cfg_scale = VALUES(cfg_scale), sampler_name = VALUES(sampler_name), scheduler = VALUES(scheduler)');
            $stmt->execute([
                $seriesId,
                $payload['checkpoint_name'] ?? null,
                $payload['negative_prompt'] ?? null,
                (int)($payload['width'] ?? 1280),
                (int)($payload['height'] ?? 1280),
                (int)($payload['steps'] ?? 7),
                (float)($payload['cfg_scale'] ?? 1.0),
                $payload['sampler_name'] ?? 'euler',
                $payload['scheduler'] ?? 'normal'
            ]);
            jsonResponse(true);
        }

        case 'create_week': {
            $seriesId = requireInt($payload, 'series_id');
            $weekStart = $payload['week_start'] ?? '';
            $theme = trim((string)($payload['theme'] ?? ''));
            if ($weekStart === '' || $theme === '') {
                throw new Exception('Missing week start or theme');
            }
            fetchSeries($pdo, $seriesId, $userId);

            $pdo->beginTransaction();
            $stmt = $pdo->prepare('INSERT INTO series_social_weeks (series_id, week_start, theme) VALUES (?, ?, ?)');
            $stmt->execute([$seriesId, $weekStart, $theme]);
            $weekId = (int)$pdo->lastInsertId();

            $assetStmt = $pdo->prepare('INSERT INTO series_social_assets (week_id, day_index) VALUES (?, ?)');
            for ($day = 0; $day < 7; $day++) {
                $assetStmt->execute([$weekId, $day]);
            }
            $pdo->commit();
            jsonResponse(true, ['week_id' => $weekId]);
        }

        case 'update_day': {
            $weekId = requireInt($payload, 'week_id');
            $dayIndex = (int)($payload['day_index'] ?? -1);
            if ($dayIndex < 0 || $dayIndex > 6) {
                throw new Exception('Invalid day');
            }

            $week = fetchWeek($pdo, $weekId, $userId);
            $customPrompt = trim((string)($payload['custom_prompt'] ?? ''));
            $shotType = trim((string)($payload['shot_type'] ?? ''));
            $includeBts = !empty($payload['include_bts']);

            $stmt = $pdo->prepare('UPDATE series_social_assets SET custom_prompt = ?, shot_type = ?, include_bts = ? WHERE week_id = ? AND day_index = ?');
            $stmt->execute([$customPrompt, $shotType, $includeBts ? 1 : 0, $weekId, $dayIndex]);
            jsonResponse(true);
        }

        case 'generate_week': {
            $weekId = requireInt($payload, 'week_id');
            $week = fetchWeek($pdo, $weekId, $userId);
            for ($day = 0; $day < 7; $day++) {
                queueAsset($pdo, $week, $day, $userId);
            }
            jsonResponse(true);
        }

        case 'generate_day': {
            $weekId = requireInt($payload, 'week_id');
            $dayIndex = (int)($payload['day_index'] ?? -1);
            if ($dayIndex < 0 || $dayIndex > 6) {
                throw new Exception('Invalid day');
            }
            $week = fetchWeek($pdo, $weekId, $userId);
            queueAsset($pdo, $week, $dayIndex, $userId);
            jsonResponse(true);
        }

        case 'refresh_week': {
            $weekId = requireInt($payload, 'week_id');
            $week = fetchWeek($pdo, $weekId, $userId);

            $stmt = $pdo->prepare('SELECT * FROM series_social_assets WHERE week_id = ? ORDER BY day_index ASC');
            $stmt->execute([$weekId]);
            $assets = $stmt->fetchAll();

            foreach ($assets as $asset) {
                if (!empty($asset['prompt_id'])) {
                    $refresh = refreshPrompt($asset['prompt_id']);
                    if ($refresh['success'] && !empty($refresh['image_url'])) {
                        $stmtUpdate = $pdo->prepare('UPDATE series_social_assets SET status = ?, image_url = ? WHERE id = ?');
                        $stmtUpdate->execute(['generated', $refresh['image_url'], $asset['id']]);
                    }
                }
                if (!empty($asset['alt_prompt_id'])) {
                    $refreshAlt = refreshPrompt($asset['alt_prompt_id']);
                    if ($refreshAlt['success'] && !empty($refreshAlt['image_url'])) {
                        $stmtUpdate = $pdo->prepare('UPDATE series_social_assets SET alt_status = ?, alt_image_url = ? WHERE id = ?');
                        $stmtUpdate->execute(['generated', $refreshAlt['image_url'], $asset['id']]);
                    }
                }
            }
            jsonResponse(true);
        }

        case 'refresh_day': {
            $weekId = requireInt($payload, 'week_id');
            $dayIndex = (int)($payload['day_index'] ?? -1);
            if ($dayIndex < 0 || $dayIndex > 6) {
                throw new Exception('Invalid day');
            }
            $week = fetchWeek($pdo, $weekId, $userId);
            $asset = getAsset($pdo, $weekId, $dayIndex);

            if (!empty($asset['prompt_id'])) {
                $refresh = refreshPrompt($asset['prompt_id']);
                if ($refresh['success'] && !empty($refresh['image_url'])) {
                    $stmtUpdate = $pdo->prepare('UPDATE series_social_assets SET status = ?, image_url = ? WHERE id = ?');
                    $stmtUpdate->execute(['generated', $refresh['image_url'], $asset['id']]);
                }
            }
            if (!empty($asset['alt_prompt_id'])) {
                $refreshAlt = refreshPrompt($asset['alt_prompt_id']);
                if ($refreshAlt['success'] && !empty($refreshAlt['image_url'])) {
                    $stmtUpdate = $pdo->prepare('UPDATE series_social_assets SET alt_status = ?, alt_image_url = ? WHERE id = ?');
                    $stmtUpdate->execute(['generated', $refreshAlt['image_url'], $asset['id']]);
                }
            }

            jsonResponse(true);
        }

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    jsonResponse(false, ['error' => $e->getMessage()]);
}
?>
