<?php
require_once 'db_connect.php';
require_once 'auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method Not Allowed');
}

$action = $_POST['action'] ?? '';

if ($action === 'apply') {
    $requestId = (int)($_POST['request_id'] ?? 0);
    $message = trim($_POST['message'] ?? '');
    $portfolioUrl = trim($_POST['portfolio_url'] ?? '');

    if (!$requestId || $message === '') {
        header('Location: ../talent_scout.php?error=missing');
        exit;
    }

    $stmt = $pdo->prepare("SELECT id FROM studio_talent_requests WHERE id = ? AND status = 'open'");
    $stmt->execute([$requestId]);
    if (!$stmt->fetchColumn()) {
        header('Location: ../talent_scout.php?error=closed');
        exit;
    }

    $stmt = $pdo->prepare("
        INSERT INTO studio_talent_applications (request_id, user_id, message, portfolio_url)
        VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE message = VALUES(message), portfolio_url = VALUES(portfolio_url)
    ");
    $stmt->execute([$requestId, (int)$_SESSION['user_id'], $message, $portfolioUrl]);

    $redirect = $_SERVER['HTTP_REFERER'] ?? '../talent_scout.php';
    header('Location: ' . $redirect);
    exit;
}

http_response_code(400);
echo 'Invalid action';
