<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/session_bootstrap.php';

function comfyuiNormalizeBaseUrl(string $url): string {
    $trimmed = trim($url);
    $parts = parse_url($trimmed);
    if (!$parts || empty($parts['scheme']) || empty($parts['host'])) {
        if (preg_match('#^(https?://[^/]+)#i', $trimmed, $matches)) {
            return rtrim($matches[1], '/');
        }
        return rtrim($trimmed, '/');
    }
    $normalized = $parts['scheme'] . '://' . $parts['host'];
    if (!empty($parts['port']) && stripos($parts['host'], 'trycloudflare.com') === false) {
        $normalized .= ':' . $parts['port'];
    }
    return rtrim($normalized, '/');
}

function comfyuiConnectionInfo(string $type = 'image'): array {
    $default = defined('COMFYUI_BASE_URL') ? COMFYUI_BASE_URL : '';
    $info = [
        'base_url' => $default ? comfyuiNormalizeBaseUrl($default) : '',
        'is_enabled' => true
    ];

    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }

    $userId = $_SESSION['user_id'] ?? null;
    if (!$userId) {
        return $info;
    }

    try {
        require_once __DIR__ . '/db_connect.php';
        global $pdo;
        if (!isset($pdo)) {
            return $info;
        }
        $stmt = $pdo->prepare("SELECT base_url, is_enabled FROM user_comfy_connections WHERE user_id = ? AND connection_type = ? ORDER BY updated_at DESC LIMIT 1");
        $stmt->execute([$userId, $type]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!empty($row['base_url'])) {
            $info['base_url'] = comfyuiNormalizeBaseUrl($row['base_url']);
        }
        if (isset($row['is_enabled'])) {
            $info['is_enabled'] = (int)$row['is_enabled'] === 1;
        }
    } catch (Throwable $e) {
        return $info;
    }

    return $info;
}

function comfyuiBaseUrl(string $type = 'image', bool $requireEnabled = true): string {
    $info = comfyuiConnectionInfo($type);
    if ($requireEnabled && !$info['is_enabled']) {
        return '';
    }
    return $info['base_url'] ?? '';
}

function comfyuiRequest(string $path, string $method = 'GET', array $payload = null, array $headers = [], string $type = 'image', bool $requireEnabled = true): array {
    $info = comfyuiConnectionInfo($type);
    $base = $info['base_url'] ?? '';
    if ($base === '') {
        return ['success' => false, 'error' => 'ComfyUI base URL not configured', 'url' => null];
    }
    if ($requireEnabled && empty($info['is_enabled'])) {
        return ['success' => false, 'error' => 'ComfyUI connection disabled', 'url' => $base];
    }
    $url = rtrim($base, '/') . '/' . ltrim($path, '/');

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($method));
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    if (defined('CURL_REDIR_POST_ALL')) {
        curl_setopt($ch, CURLOPT_POSTREDIR, CURL_REDIR_POST_ALL);
    } else {
        curl_setopt($ch, CURLOPT_POSTREDIR, 7);
    }
    $isLocalEnv = defined('APP_ENV') && APP_ENV === 'local';
    if ($isLocalEnv || stripos($url, '.trycloudflare.com') !== false) {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    }

    $defaultHeaders = ['Accept: application/json'];
    if ($payload !== null) {
        $json = json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if ($json === false) {
            return [
                'success' => false,
                'error' => 'Failed to encode JSON payload: ' . json_last_error_msg(),
                'url' => $url
            ];
        }
        $defaultHeaders[] = 'Content-Type: application/json';
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
    }

    $allHeaders = array_merge($defaultHeaders, $headers);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $allHeaders);

    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        return ['success' => false, 'error' => $error, 'url' => $url];
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($response, true);
    if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
        $snippet = mb_substr($response, 0, 800);
        return [
            'success' => false,
            'status' => $status,
            'error' => 'Invalid JSON response from ComfyUI (HTTP ' . $status . '): ' . $snippet,
            'raw' => $response,
            'url' => $url
        ];
    }

    if ($status >= 400) {
        return [
            'success' => false,
            'status' => $status,
            'error' => $decoded ?: $response,
            'url' => $url
        ];
    }

    return ['success' => true, 'data' => $decoded, 'url' => $url];
}

function comfyuiUploadImageFromUrl(string $imageUrl, string $type = 'image'): array {
    $info = comfyuiConnectionInfo($type);
    $base = $info['base_url'] ?? '';
    if ($base === '') {
        return ['success' => false, 'error' => 'ComfyUI base URL not configured'];
    }
    if (empty($info['is_enabled'])) {
        return ['success' => false, 'error' => 'ComfyUI connection disabled'];
    }

    $tmpFile = tempnam(sys_get_temp_dir(), 'comfyimg_');
    if ($tmpFile === false) {
        return ['success' => false, 'error' => 'Failed to create temp file'];
    }

    $ch = curl_init($imageUrl);
    $fp = fopen($tmpFile, 'wb');
    if (!$fp) {
        return ['success' => false, 'error' => 'Failed to open temp file'];
    }
    curl_setopt($ch, CURLOPT_FILE, $fp);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    $downloaded = curl_exec($ch);
    $httpStatus = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $downloadError = curl_error($ch);
    curl_close($ch);
    fclose($fp);

    if ($downloaded === false || $httpStatus >= 400) {
        @unlink($tmpFile);
        return [
            'success' => false,
            'error' => 'Failed to download image (' . $httpStatus . '): ' . ($downloadError ?: 'HTTP error')
        ];
    }

    $fileName = basename(parse_url($imageUrl, PHP_URL_PATH) ?? '') ?: ('input_' . uniqid() . '.png');
    $uploadUrl = rtrim($base, '/') . '/upload/image';

    $ch = curl_init($uploadUrl);
    $postFields = [
        'image' => new CURLFile($tmpFile, 'image/png', $fileName)
    ];
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $postFields);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 8);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
    if (defined('CURL_REDIR_POST_ALL')) {
        curl_setopt($ch, CURLOPT_POSTREDIR, CURL_REDIR_POST_ALL);
    } else {
        curl_setopt($ch, CURLOPT_POSTREDIR, 7);
    }
    $isLocalEnv = defined('APP_ENV') && APP_ENV === 'local';
    if ($isLocalEnv || stripos($uploadUrl, '.trycloudflare.com') !== false) {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    }

    $response = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    @unlink($tmpFile);

    if ($response === false) {
        return ['success' => false, 'error' => 'Upload failed: ' . $error];
    }
    $decoded = json_decode($response, true);
    if ($decoded === null && json_last_error() !== JSON_ERROR_NONE) {
        return ['success' => false, 'error' => 'Invalid upload response: ' . mb_substr($response, 0, 200)];
    }
    if ($status >= 400) {
        return ['success' => false, 'error' => $decoded ?: $response];
    }

    $uploadedName = $decoded['name'] ?? $decoded['filename'] ?? $fileName;
    return ['success' => true, 'name' => $uploadedName, 'data' => $decoded];
}
