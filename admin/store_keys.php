<?php
require_once '../includes/db_connect.php';
require_once '../includes/KeyManager.php';

// This script should only be accessible to administrators
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

if (!isset($_SESSION['is_admin']) || $_SESSION['is_admin'] !== true) {
    die('Unauthorized access');
}

$keyManager = new KeyManager($pdo);

// Store the keys (run this once)
$keyManager->storeKey('openrouter', 'your-openrouter-key');
$keyManager->storeKey('openai', 'your-openai-key');

echo "Keys stored successfully";
?> 