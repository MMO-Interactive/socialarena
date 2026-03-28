<?php
if (session_status() !== PHP_SESSION_ACTIVE) {
    if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

}

$fileParam = $_GET['file'] ?? '';
if ($fileParam === '') {
    http_response_code(400);
    exit('Missing file');
}

$fileParam = str_replace(['..', '\\'], ['', '/'], $fileParam);
$fileParam = ltrim($fileParam, '/');

if (strpos($fileParam, 'uploads/talent_files/') !== 0) {
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
    'pdf' => 'application/pdf',
    'zip' => 'application/zip'
];
$mime = $mimeMap[$ext] ?? 'application/octet-stream';

header('Content-Type: ' . $mime);
header('Content-Disposition: inline; filename="' . basename($fullPath) . '"');
header('Content-Length: ' . filesize($fullPath));
readfile($fullPath);
