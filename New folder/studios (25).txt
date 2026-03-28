<?php
require_once 'includes/db_connect.php';
require_once 'includes/studio_access.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    header('Location: login.php');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['story_id'])) {
    $story_id = (int)$_POST['story_id'];
    
    try {
        // Verify the story belongs to the user or studio access
        $stmt = $pdo->prepare("SELECT created_by, studio_id, visibility, thumbnail_url FROM stories WHERE id = ?");
        $stmt->execute([$story_id]);
        $story = $stmt->fetch();
        
        if ($story && canAccessStudioItem($pdo, (int)$story['created_by'], (int)$story['studio_id'], $story['visibility'], (int)$_SESSION['user_id'], 'stories', true)) {
            // Begin transaction
            $pdo->beginTransaction();
            
            // Delete story responses
            $stmt = $pdo->prepare("
                DELETE sr FROM story_responses sr
                JOIN pages p ON sr.page_id = p.id
                WHERE p.story_id = ?
            ");
            $stmt->execute([$story_id]);
            
            // Delete story progress
            $stmt = $pdo->prepare("DELETE FROM story_progress WHERE story_id = ?");
            $stmt->execute([$story_id]);
            
            // Delete favorites
            $stmt = $pdo->prepare("DELETE FROM user_favorites WHERE story_id = ?");
            $stmt->execute([$story_id]);
            
            // Delete pages
            $stmt = $pdo->prepare("DELETE FROM pages WHERE story_id = ?");
            $stmt->execute([$story_id]);
            
            // Delete the story
            $stmt = $pdo->prepare("DELETE FROM stories WHERE id = ?");
            $stmt->execute([$story_id]);
            
            // Delete the thumbnail file if it exists
            if ($story['thumbnail_url'] && file_exists($story['thumbnail_url'])) {
                unlink($story['thumbnail_url']);
            }
            
            // Update user's story count
            $stmt = $pdo->prepare("
                UPDATE users 
                SET story_count = (
                    SELECT COUNT(*) 
                    FROM stories 
                    WHERE user_id = ?
                )
                WHERE id = ?
            ");
            $stmt->execute([$_SESSION['user_id'], $_SESSION['user_id']]);
            
            // Commit transaction
            $pdo->commit();
            
            // Return success response
            echo json_encode(['success' => true]);
            exit;
        }
    } catch (Exception $e) {
        // Rollback transaction on error
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Failed to delete story']);
        exit;
    }
}

// If we get here, something went wrong
http_response_code(400);
echo json_encode(['success' => false, 'error' => 'Invalid request']); 
