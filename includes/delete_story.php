<?php
require_once 'db_connect.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Check if story ID was provided
if (!isset($_POST['story_id'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Story ID is required']);
    exit;
}

$story_id = (int)$_POST['story_id'];
$user_id = $_SESSION['user_id'];

try {
    // Begin transaction
    $pdo->beginTransaction();
    
    // Verify story ownership
    $stmt = $pdo->prepare("SELECT id, thumbnail_url FROM stories WHERE id = ? AND user_id = ?");
    $stmt->execute([$story_id, $user_id]);
    $story = $stmt->fetch();
    
    if (!$story) {
        throw new Exception('Story not found or unauthorized');
    }
    
    // Delete the story (cascading will handle related records)
    $stmt = $pdo->prepare("DELETE FROM stories WHERE id = ? AND user_id = ?");
    $stmt->execute([$story_id, $user_id]);
    
    // Delete the thumbnail file if it exists
    if (!empty($story['thumbnail_url'])) {
        $thumbnail_path = $_SERVER['DOCUMENT_ROOT'] . $story['thumbnail_url'];
        if (file_exists($thumbnail_path)) {
            unlink($thumbnail_path);
        }
    }
    
    $pdo->commit();
    echo json_encode(['success' => true]);
    
} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
} 