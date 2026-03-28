<?php
require_once 'db_connect.php';
require_once 'studio_access.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


// Check if user is logged in
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Get request data
$data = json_decode(file_get_contents('php://input'), true);
if (!isset($data['action'])) {
    http_response_code(400);
    echo json_encode(['error' => 'No action specified']);
    exit;
}

try {
    $userId = (int)$_SESSION['user_id'];

    $enforceStoryAccessForAct = function(int $actId) use ($pdo, $userId): void {
        $stmt = $pdo->prepare("
            SELECT s.created_by, s.studio_id, s.visibility
            FROM story_acts sa
            JOIN stories s ON sa.story_id = s.id
            WHERE sa.id = ?
        ");
        $stmt->execute([$actId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new Exception('Act not found');
        }
        enforceStudioItemAccess($pdo, (int)$row['created_by'], (int)$row['studio_id'], $row['visibility'], $userId, 'stories', true);
    };

    $enforceStoryAccessForChapter = function(int $chapterId) use ($pdo, $userId): void {
        $stmt = $pdo->prepare("
            SELECT s.created_by, s.studio_id, s.visibility
            FROM story_chapters sc
            JOIN story_acts sa ON sc.act_id = sa.id
            JOIN stories s ON sa.story_id = s.id
            WHERE sc.id = ?
        ");
        $stmt->execute([$chapterId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new Exception('Chapter not found');
        }
        enforceStudioItemAccess($pdo, (int)$row['created_by'], (int)$row['studio_id'], $row['visibility'], $userId, 'stories', true);
    };

    $enforceStoryAccessForScene = function(int $sceneId) use ($pdo, $userId): void {
        $stmt = $pdo->prepare("
            SELECT s.created_by, s.studio_id, s.visibility
            FROM story_scenes ss
            JOIN story_chapters sc ON ss.chapter_id = sc.id
            JOIN story_acts sa ON sc.act_id = sa.id
            JOIN stories s ON sa.story_id = s.id
            WHERE ss.id = ?
        ");
        $stmt->execute([$sceneId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new Exception('Scene not found');
        }
        enforceStudioItemAccess($pdo, (int)$row['created_by'], (int)$row['studio_id'], $row['visibility'], $userId, 'stories', true);
    };

    $enforceStoryAccessForClip = function(int $clipId) use ($pdo, $userId): void {
        $stmt = $pdo->prepare("
            SELECT s.created_by, s.studio_id, s.visibility
            FROM story_scene_clips scp
            JOIN story_scenes ss ON scp.scene_id = ss.id
            JOIN story_chapters sc ON ss.chapter_id = sc.id
            JOIN story_acts sa ON sc.act_id = sa.id
            JOIN stories s ON sa.story_id = s.id
            WHERE scp.id = ?
        ");
        $stmt->execute([$clipId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new Exception('Clip not found');
        }
        enforceStudioItemAccess($pdo, (int)$row['created_by'], (int)$row['studio_id'], $row['visibility'], $userId, 'stories', true);
    };

    switch ($data['action']) {
        case 'add_act':
            enforceStoryAccess($pdo, (int)$data['story_id'], $userId, true);

            // Get next order position
            $stmt = $pdo->prepare("SELECT MAX(act_order) FROM story_acts WHERE story_id = ?");
            $stmt->execute([$data['story_id']]);
            $nextOrder = ($stmt->fetchColumn() ?? -1) + 1;

            // Insert new act
            $stmt = $pdo->prepare("
                INSERT INTO story_acts (story_id, title, act_order)
                VALUES (?, 'New Act', ?)
            ");
            $stmt->execute([$data['story_id'], $nextOrder]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'add_chapter':
            $enforceStoryAccessForAct((int)$data['act_id']);

            // Get next order position
            $stmt = $pdo->prepare("SELECT MAX(chapter_order) FROM story_chapters WHERE act_id = ?");
            $stmt->execute([$data['act_id']]);
            $nextOrder = ($stmt->fetchColumn() ?? -1) + 1;

            // Insert new chapter
            $stmt = $pdo->prepare("
                INSERT INTO story_chapters (act_id, title, chapter_order)
                VALUES (?, 'New Chapter', ?)
            ");
            $stmt->execute([$data['act_id'], $nextOrder]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'add_scene':
            $enforceStoryAccessForChapter((int)$data['chapter_id']);

            // Get next order position
            $stmt = $pdo->prepare("SELECT MAX(scene_order) FROM story_scenes WHERE chapter_id = ?");
            $stmt->execute([$data['chapter_id']]);
            $nextOrder = ($stmt->fetchColumn() ?? -1) + 1;

            // Insert new scene
            $stmt = $pdo->prepare("
                INSERT INTO story_scenes (chapter_id, title, scene_order)
                VALUES (?, 'New Scene', ?)
            ");
            $stmt->execute([$data['chapter_id'], $nextOrder]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'add_clip':
            $enforceStoryAccessForScene((int)$data['scene_id']);

            $stmt = $pdo->prepare("SELECT COALESCE(MAX(clip_order), -1) FROM story_scene_clips WHERE scene_id = ?");
            $stmt->execute([$data['scene_id']]);
            $nextOrder = (int)$stmt->fetchColumn() + 1;

            $stmt = $pdo->prepare("
                INSERT INTO story_scene_clips (scene_id, title, clip_order)
                VALUES (?, 'New Clip', ?)
            ");
            $stmt->execute([$data['scene_id'], $nextOrder]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'update_title':
            switch ($data['type']) {
                case 'act':
                    $enforceStoryAccessForAct((int)$data['id']);
                    $stmt = $pdo->prepare("
                        UPDATE story_acts sa
                        JOIN stories s ON sa.story_id = s.id
                        SET sa.title = ?
                        WHERE sa.id = ?
                    ");
                    $stmt->execute([$data['title'], $data['id']]);
                    break;

                case 'chapter':
                    $enforceStoryAccessForChapter((int)$data['id']);
                    $stmt = $pdo->prepare("
                        UPDATE story_chapters sc
                        JOIN story_acts sa ON sc.act_id = sa.id
                        JOIN stories s ON sa.story_id = s.id
                        SET sc.title = ?
                        WHERE sc.id = ?
                    ");
                    $stmt->execute([$data['title'], $data['id']]);
                    break;

                case 'scene':
                    $enforceStoryAccessForScene((int)$data['id']);
                    $stmt = $pdo->prepare("
                        UPDATE story_scenes ss
                        JOIN story_chapters sc ON ss.chapter_id = sc.id
                        JOIN story_acts sa ON sc.act_id = sa.id
                        JOIN stories s ON sa.story_id = s.id
                        SET ss.title = ?
                        WHERE ss.id = ?
                    ");
                    $stmt->execute([$data['title'], $data['id']]);
                    break;
                case 'clip':
                    $enforceStoryAccessForClip((int)$data['id']);
                    $stmt = $pdo->prepare("
                        UPDATE story_scene_clips
                        SET title = ?
                        WHERE id = ?
                    ");
                    $stmt->execute([$data['title'], $data['id']]);
                    break;

                default:
                    throw new Exception('Invalid type');
            }
            echo json_encode(['success' => true]);
            break;

        case 'update_act_order':
            foreach ($data['order'] as $item) {
                $enforceStoryAccessForAct((int)$item['id']);
                $stmt = $pdo->prepare("
                    UPDATE story_acts sa
                    JOIN stories s ON sa.story_id = s.id
                    SET sa.act_order = ?
                    WHERE sa.id = ?
                ");
                $stmt->execute([$item['order'], $item['id']]);
            }
            echo json_encode(['success' => true]);
            break;

        case 'update_chapter_order':
            foreach ($data['order'] as $item) {
                $enforceStoryAccessForChapter((int)$item['id']);
                $stmt = $pdo->prepare("
                    UPDATE story_chapters sc
                    JOIN story_acts sa ON sc.act_id = sa.id
                    JOIN stories s ON sa.story_id = s.id
                    SET sc.chapter_order = ?, sc.act_id = ?
                    WHERE sc.id = ?
                ");
                $stmt->execute([$item['order'], $data['act_id'], $item['id']]);
            }
            echo json_encode(['success' => true]);
            break;

        case 'update_scene_order':
            foreach ($data['order'] as $item) {
                $enforceStoryAccessForScene((int)$item['id']);
                $stmt = $pdo->prepare("
                    UPDATE story_scenes ss
                    JOIN story_chapters sc ON ss.chapter_id = sc.id
                    JOIN story_acts sa ON sc.act_id = sa.id
                    JOIN stories s ON sa.story_id = s.id
                    SET ss.scene_order = ?, ss.chapter_id = ?
                    WHERE ss.id = ?
                ");
                $stmt->execute([$item['order'], $data['chapter_id'], $item['id']]);
            }
            echo json_encode(['success' => true]);
            break;

        case 'update_clip_order':
            foreach ($data['order'] as $item) {
                $enforceStoryAccessForClip((int)$item['id']);
                $stmt = $pdo->prepare("
                    UPDATE story_scene_clips
                    SET clip_order = ?, scene_id = ?
                    WHERE id = ?
                ");
                $stmt->execute([$item['order'], $data['scene_id'], $item['id']]);
            }
            echo json_encode(['success' => true]);
            break;

        case 'delete_act':
            $enforceStoryAccessForAct((int)$data['act_id']);
            $stmt = $pdo->prepare("
                DELETE sa FROM story_acts sa
                JOIN stories s ON sa.story_id = s.id
                WHERE sa.id = ?
            ");
            $stmt->execute([$data['act_id']]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_chapter':
            $enforceStoryAccessForChapter((int)$data['chapter_id']);
            $stmt = $pdo->prepare("
                DELETE sc FROM story_chapters sc
                JOIN story_acts sa ON sc.act_id = sa.id
                JOIN stories s ON sa.story_id = s.id
                WHERE sc.id = ?
            ");
            $stmt->execute([$data['chapter_id']]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_scene':
            $enforceStoryAccessForScene((int)$data['scene_id']);
            $stmt = $pdo->prepare("
                DELETE ss FROM story_scenes ss
                JOIN story_chapters sc ON ss.chapter_id = sc.id
                JOIN story_acts sa ON sc.act_id = sa.id
                JOIN stories s ON sa.story_id = s.id
                WHERE ss.id = ?
            ");
            $stmt->execute([$data['scene_id']]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_clip':
            $enforceStoryAccessForClip((int)$data['clip_id']);
            $stmt = $pdo->prepare("DELETE FROM story_scene_clips WHERE id = ?");
            $stmt->execute([$data['clip_id']]);
            echo json_encode(['success' => true]);
            break;

        case 'update_scene_description':
            try {
                // Debug log
                error_log('Updating scene description - Scene ID: ' . $data['scene_id'] . ', Description: ' . substr($data['description'], 0, 50) . '...');
                
                $enforceStoryAccessForScene((int)$data['scene_id']);
                $stmt = $pdo->prepare("
                    UPDATE story_scenes ss
                    JOIN story_chapters sc ON ss.chapter_id = sc.id
                    JOIN story_acts sa ON sc.act_id = sa.id
                    JOIN stories s ON sa.story_id = s.id
                    SET ss.description = ?
                    WHERE ss.id = ?
                ");
                
                $result = $stmt->execute([
                    $data['description'],
                    $data['scene_id']
                ]);
                
                if ($result) {
                    echo json_encode(['success' => true]);
                } else {
                    throw new Exception('Failed to update scene description');
                }
            } catch (Exception $e) {
                error_log('Error updating scene description: ' . $e->getMessage());
                http_response_code(500);
                echo json_encode(['error' => $e->getMessage()]);
            }
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
} 
