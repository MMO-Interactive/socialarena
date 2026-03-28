<?php
// Start session if not already started
if (session_status() === PHP_SESSION_NONE) {
    if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}

}

// Function to check if user is an admin
function isAdmin($pdo, $userId) {
    $stmt = $pdo->prepare("SELECT is_admin FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    return $user && $user['is_admin'] == 1;
}

// Check if user is logged in and is an admin
if (!isset($_SESSION['user_id']) || !isAdmin($pdo, $_SESSION['user_id'])) {
    // If accessing via AJAX, return JSON response
    if (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && 
        strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) == 'xmlhttprequest') {
        header('Content-Type: application/json');
        die(json_encode([
            'success' => false,
            'error' => 'Unauthorized access'
        ]));
    }
    // Otherwise redirect to login page
    header('Location: /adventure/login.php');
    exit;
}

// Add is_admin column to users table if it doesn't exist
try {
    $pdo->query("
        ALTER TABLE users 
        ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE
    ");
} catch (PDOException $e) {
    error_log("Error adding is_admin column: " . $e->getMessage());
} 