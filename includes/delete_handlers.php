<?php
require_once 'db_connect.php';
require_once 'studio_access.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

function deleteStory($pdo, $story_id, $user_id) {
    // Check if user owns the story
    $stmt = $pdo->prepare("SELECT thumbnail_url FROM stories WHERE id = ?");
    $stmt->execute([$story_id]);
    $story = $stmt->fetch();

    if (!$story) {
        throw new Exception('Story not found or unauthorized');
    }
    enforceStoryAccess($pdo, $story_id, (int)$user_id, true);

    // Delete thumbnail if exists
    if ($story['thumbnail_url'] && file_exists($story['thumbnail_url'])) {
        unlink($story['thumbnail_url']);
    }

    // Delete story and related data
    $pdo->beginTransaction();
    try {
        // Delete ratings
        $stmt = $pdo->prepare("DELETE FROM story_ratings WHERE story_id = ?");
        $stmt->execute([$story_id]);

        // Delete story
        $stmt = $pdo->prepare("DELETE FROM stories WHERE id = ?");
        $stmt->execute([$story_id]);

        $pdo->commit();
        return true;
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function deleteSeries($pdo, $series_id, $user_id) {
    // Check if user owns the series
    $stmt = $pdo->prepare("SELECT cover_image FROM series WHERE id = ?");
    $stmt->execute([$series_id]);
    $series = $stmt->fetch();

    if (!$series) {
        throw new Exception('Series not found or unauthorized');
    }
    enforceSeriesAccess($pdo, $series_id, (int)$user_id, true);

    // Delete cover image if exists
    if ($series['cover_image'] && file_exists($series['cover_image'])) {
        unlink($series['cover_image']);
    }

    $pdo->beginTransaction();
    try {
        // Get all stories in series
        $stmt = $pdo->prepare("SELECT id FROM stories WHERE series_id = ?");
        $stmt->execute([$series_id]);
        $stories = $stmt->fetchAll(PDO::FETCH_COLUMN);

        // Delete each story
        foreach ($stories as $story_id) {
            deleteStory($pdo, $story_id, $user_id);
        }

        // Delete series
        $stmt = $pdo->prepare("DELETE FROM series WHERE id = ?");
        $stmt->execute([$series_id]);

        $pdo->commit();
        return true;
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function deleteUniverse($pdo, $universe_id, $user_id) {
    // Check if user owns the universe
    $stmt = $pdo->prepare("SELECT cover_image FROM universes WHERE id = ?");
    $stmt->execute([$universe_id]);
    $universe = $stmt->fetch();

    if (!$universe) {
        throw new Exception('Universe not found or unauthorized');
    }
    enforceUniverseAccess($pdo, $universe_id, (int)$user_id, true);

    // Delete cover image if exists
    if ($universe['cover_image'] && file_exists($universe['cover_image'])) {
        unlink($universe['cover_image']);
    }

    $pdo->beginTransaction();
    try {
        // Get all series in universe
        $stmt = $pdo->prepare("SELECT id FROM series WHERE universe_id = ?");
        $stmt->execute([$universe_id]);
        $series = $stmt->fetchAll(PDO::FETCH_COLUMN);

        // Delete each series and its stories
        foreach ($series as $series_id) {
            deleteSeries($pdo, $series_id, $user_id);
        }

        // Delete standalone stories in universe
        $stmt = $pdo->prepare("SELECT id FROM stories WHERE universe_id = ? AND series_id IS NULL");
        $stmt->execute([$universe_id]);
        $stories = $stmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($stories as $story_id) {
            deleteStory($pdo, $story_id, $user_id);
        }

        // Delete universe
        $stmt = $pdo->prepare("DELETE FROM universes WHERE id = ?");
        $stmt->execute([$universe_id]);

        $pdo->commit();
        return true;
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

// Handle delete requests
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        $data = json_decode(file_get_contents('php://input'), true);
        
        if (!isset($data['type']) || !isset($data['id'])) {
            throw new Exception('Missing required parameters');
        }

        $type = $data['type'];
        $id = (int)$data['id'];

        switch ($type) {
            case 'story':
                $result = deleteStory($pdo, $id, $_SESSION['user_id']);
                break;
            case 'series':
                $result = deleteSeries($pdo, $id, $_SESSION['user_id']);
                break;
            case 'universe':
                $result = deleteUniverse($pdo, $id, $_SESSION['user_id']);
                break;
            default:
                throw new Exception('Invalid delete type');
        }

        echo json_encode(['success' => true]);

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'error' => $e->getMessage()
        ]);
    }
} 
