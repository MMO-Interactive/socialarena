<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    exit('Unauthorized');
}

$fileParam = $_GET['file'] ?? '';
if ($fileParam === '') {
    http_response_code(400);
    exit('Missing file');
}

$fileParam = str_replace(['..', '\\'], ['', '/'], $fileParam);

if (preg_match('#^https?://#i', $fileParam)) {
    $parsed = parse_url($fileParam);
    if (!empty($parsed['path'])) {
        $fileParam = $parsed['path'];
    }
}

$fileParam = ltrim($fileParam, '/');

$allowedPrefixes = [
    'uploads/idea_board_audio/',
    'uploads/music/',
    'uploads/talent_audio/',
];

$allowed = false;
foreach ($allowedPrefixes as $prefix) {
    if (strpos($fileParam, $prefix) === 0) {
        $allowed = true;
        break;
    }
}

if (!$allowed) {
    http_response_code(403);
    exit('Forbidden');
}

$fullPath = __DIR__ . DIRECTORY_SEPARATOR . $fileParam;
if (!is_file($fullPath)) {
    http_response_code(404);
    exit('Not found');
}

$ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
$mimeMap = [
    'mp3' => 'audio/mpeg',
    'wav' => 'audio/wav',
    'ogg' => 'audio/ogg',
    'm4a' => 'audio/mp4'
];
$mime = $mimeMap[$ext] ?? 'application/octet-stream';

$size = filesize($fullPath);
$start = 0;
$end = $size - 1;

header('Content-Type: ' . $mime);
header('Accept-Ranges: bytes');
header('Cache-Control: no-store');

if (isset($_SERVER['HTTP_RANGE'])) {
    if (preg_match('/bytes=(\\d+)-(\\d*)/', $_SERVER['HTTP_RANGE'], $matches)) {
        $start = (int)$matches[1];
        if ($matches[2] !== '') {
            $end = (int)$matches[2];
        }
    }
    if ($start > $end || $end >= $size) {
        http_response_code(416);
        exit;
    }
    http_response_code(206);
    header("Content-Range: bytes $start-$end/$size");
}

$length = $end - $start + 1;
header('Content-Length: ' . $length);

$fp = fopen($fullPath, 'rb');
if ($fp === false) {
    http_response_code(500);
    exit('Failed to open file');
}

fseek($fp, $start);
$bufferSize = 8192;
while (!feof($fp) && $length > 0) {
    $read = ($length > $bufferSize) ? $bufferSize : $length;
    $data = fread($fp, $read);
    if ($data === false) {
        break;
    }
    echo $data;
    flush();
    $length -= strlen($data);
}
fclose($fp);
