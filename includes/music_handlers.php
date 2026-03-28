<?php
require_once 'db_connect.php';
require_once 'auth.php';
require_once 'studio_access.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';

try {
    switch ($action) {
        case 'create_track':
            $studioId = !empty($data['studio_id']) ? (int)$data['studio_id'] : null;
            $visibility = normalizeVisibility($data['visibility'] ?? 'private', $studioId);
            enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'music_library');
            $stmt = $pdo->prepare("
                INSERT INTO studio_music_library (user_id, studio_id, title, artist, genre, bpm, musical_key, mood, description, tags, file_url, cover_image_url, visibility)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $_SESSION['user_id'],
                $studioId,
                trim($data['title'] ?? ''),
                trim($data['artist'] ?? ''),
                trim($data['genre'] ?? ''),
                trim($data['bpm'] ?? ''),
                trim($data['musical_key'] ?? ''),
                trim($data['mood'] ?? ''),
                trim($data['description'] ?? ''),
                trim($data['tags'] ?? ''),
                trim($data['file_url'] ?? ''),
                trim($data['cover_image_url'] ?? ''),
                $visibility
            ]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'update_track':
            $track_id = (int)($data['track_id'] ?? 0);
            if (!$track_id) {
                throw new Exception('Invalid track');
            }
            $studioId = !empty($data['studio_id']) ? (int)$data['studio_id'] : null;
            $visibility = normalizeVisibility($data['visibility'] ?? 'private', $studioId);
            enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'music_library');
            $stmt = $pdo->prepare("
                UPDATE studio_music_library
                SET title = ?, artist = ?, genre = ?, bpm = ?, musical_key = ?, mood = ?, description = ?, tags = ?, cover_image_url = ?, file_url = COALESCE(NULLIF(?, ''), file_url),
                    studio_id = ?, visibility = ?
                WHERE id = ? AND user_id = ?
            ");
            $stmt->execute([
                trim($data['title'] ?? ''),
                trim($data['artist'] ?? ''),
                trim($data['genre'] ?? ''),
                trim($data['bpm'] ?? ''),
                trim($data['musical_key'] ?? ''),
                trim($data['mood'] ?? ''),
                trim($data['description'] ?? ''),
                trim($data['tags'] ?? ''),
                trim($data['cover_image_url'] ?? ''),
                trim($data['file_url'] ?? ''),
                $studioId,
                $visibility,
                $track_id,
                $_SESSION['user_id']
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_track':
            $track_id = (int)($data['track_id'] ?? 0);
            if (!$track_id) {
                throw new Exception('Invalid track');
            }
            $stmt = $pdo->prepare("SELECT studio_id FROM studio_music_library WHERE id = ? AND user_id = ?");
            $stmt->execute([$track_id, $_SESSION['user_id']]);
            $studioId = (int)$stmt->fetchColumn();
            if ($studioId) {
                enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'music_library');
            }
            $stmt = $pdo->prepare("DELETE FROM studio_music_library WHERE id = ? AND user_id = ?");
            $stmt->execute([$track_id, $_SESSION['user_id']]);
            echo json_encode(['success' => true]);
            break;

        case 'list_tracks':
            [$whereClause, $whereParams] = buildStudioVisibilityWhere('m', (int)$_SESSION['user_id'], 'music_library');
            $stmt = $pdo->prepare("SELECT * FROM studio_music_library m WHERE {$whereClause} ORDER BY updated_at DESC");
            $stmt->execute($whereParams);
            $tracks = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode(['success' => true, 'tracks' => $tracks]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
