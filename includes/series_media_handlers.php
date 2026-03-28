<?php
require_once 'db_connect.php';
require_once 'auth.php';
require_once 'studio_access.php';

header('Content-Type: application/json');

function getPayload(): array {
    if (!empty($_POST)) {
        return $_POST;
    }
    $raw = file_get_contents('php://input');
    if (empty($raw)) {
        return [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function handleThumbnailUpload(string $field): ?string {
    if (empty($_FILES[$field]['name'])) {
        return null;
    }
    $file = $_FILES[$field];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Thumbnail upload failed');
    }
    $allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!in_array($file['type'], $allowed, true)) {
        throw new Exception('Invalid thumbnail type');
    }
    $uploadDir = __DIR__ . '/../uploads/series_media_thumbs';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid('thumb_', true) . '.' . $ext;
    $dest = $uploadDir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        throw new Exception('Unable to save thumbnail');
    }
    return 'uploads/series_media_thumbs/' . $filename;
}

function handleMediaImageUpload(string $field): ?string {
    if (empty($_FILES[$field]['name'])) {
        return null;
    }
    $file = $_FILES[$field];
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Screenshot upload failed');
    }
    $allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!in_array($file['type'], $allowed, true)) {
        throw new Exception('Invalid screenshot type');
    }
    $uploadDir = __DIR__ . '/../uploads/series_media_images';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0777, true);
    }
    $ext = pathinfo($file['name'], PATHINFO_EXTENSION);
    $filename = uniqid('media_', true) . '.' . $ext;
    $dest = $uploadDir . '/' . $filename;
    if (!move_uploaded_file($file['tmp_name'], $dest)) {
        throw new Exception('Unable to save screenshot');
    }
    return 'uploads/series_media_images/' . $filename;
}

$data = getPayload();
$action = $data['action'] ?? '';

try {
    switch ($action) {
        case 'list_media':
            $seriesId = (int)($data['series_id'] ?? 0);
            $stmt = $pdo->prepare("SELECT created_by, studio_id FROM series WHERE id = ?");
            $stmt->execute([$seriesId]);
            $seriesRow = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$seriesRow) {
                throw new Exception('Invalid series');
            }
            if ((int)$seriesRow['created_by'] !== (int)$_SESSION['user_id']) {
                $studioId = (int)($seriesRow['studio_id'] ?? 0);
                enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'series');
            }
            $stmt = $pdo->prepare("SELECT * FROM series_public_media WHERE series_id = ? ORDER BY created_at DESC");
            $stmt->execute([$seriesId]);
            echo json_encode(['success' => true, 'items' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;
        case 'add_media':
            $seriesId = (int)($data['series_id'] ?? 0);
            $mediaType = $data['media_type'] ?? 'trailer';
            $title = trim($data['title'] ?? '');
            $url = trim($data['url'] ?? '');
            $seasonId = !empty($data['season_id']) ? (int)$data['season_id'] : null;
            $episodeId = !empty($data['episode_id']) ? (int)$data['episode_id'] : null;
            $visibility = $data['visibility'] ?? 'public';
            if (!in_array($mediaType, ['trailer', 'clip', 'screenshot'], true)) {
                throw new Exception('Invalid media type');
            }
            if (!$seriesId) {
                throw new Exception('Missing fields');
            }
            $stmt = $pdo->prepare("SELECT created_by, studio_id FROM series WHERE id = ?");
            $stmt->execute([$seriesId]);
            $seriesRow = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$seriesRow) {
                throw new Exception('Invalid series');
            }
            $ownerId = (int)$seriesRow['created_by'];
            $studioId = !empty($seriesRow['studio_id']) ? (int)$seriesRow['studio_id'] : null;
            if ($ownerId !== (int)$_SESSION['user_id']) {
                enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'series');
            }
            $visibility = normalizeVisibility($visibility, $studioId);
            $thumbnailUrl = handleThumbnailUpload('thumbnail');
            if ($mediaType === 'screenshot') {
                $imageUrl = handleMediaImageUpload('media_image');
                if (empty($imageUrl)) {
                    throw new Exception('Screenshot image required');
                }
                $url = $imageUrl;
            } elseif (!$url) {
                throw new Exception('Missing fields');
            }
            $stmt = $pdo->prepare("INSERT INTO series_public_media (series_id, season_id, episode_id, studio_id, media_type, title, url, thumbnail_url, release_status, visibility) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)");
            $stmt->execute([$seriesId, $seasonId, $episodeId, $studioId, $mediaType, $title, $url, $thumbnailUrl, $visibility]);
            echo json_encode(['success' => true, 'id' => (int)$pdo->lastInsertId(), 'thumbnail_url' => $thumbnailUrl]);
            break;
        case 'release_media':
            $mediaId = (int)($data['media_id'] ?? 0);
            $releaseTitle = trim($data['release_title'] ?? '');
            $releaseDescription = trim($data['release_description'] ?? '');
            $releaseStatus = $data['release_status'] ?? 'released';
            $thumbnailUrl = trim($data['thumbnail_url'] ?? '');
            $visibility = $data['visibility'] ?? null;
            if (!$mediaId) {
                throw new Exception('Invalid media');
            }
            $stmt = $pdo->prepare("SELECT spm.series_id, spm.thumbnail_url, spm.visibility, s.created_by, s.studio_id FROM series_public_media spm JOIN series s ON spm.series_id = s.id WHERE spm.id = ?");
            $stmt->execute([$mediaId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                throw new Exception('Unauthorized');
            }
            if ((int)$row['created_by'] !== (int)$_SESSION['user_id']) {
                enforceStudioPermission($pdo, (int)($row['studio_id'] ?? 0), (int)$_SESSION['user_id'], 'series');
            }
            if (!in_array($releaseStatus, ['draft', 'released'], true)) {
                $releaseStatus = 'released';
            }
            $releasedAt = $releaseStatus === 'released' ? date('Y-m-d H:i:s') : null;
            $finalThumb = $thumbnailUrl !== '' ? $thumbnailUrl : ($row['thumbnail_url'] ?? null);
            if ($visibility !== null) {
                $visibility = normalizeVisibility($visibility, (int)($row['studio_id'] ?? 0));
            } else {
                $visibility = $row['visibility'] ?? 'public';
            }
            $stmt = $pdo->prepare("
                UPDATE series_public_media
                SET release_title = ?, release_description = ?, release_status = ?, released_at = ?, thumbnail_url = ?, visibility = ?
                WHERE id = ?
            ");
            $stmt->execute([$releaseTitle, $releaseDescription, $releaseStatus, $releasedAt, $finalThumb, $visibility, $mediaId]);
            echo json_encode(['success' => true, 'released_at' => $releasedAt]);
            break;
        case 'delete_media':
            $mediaId = (int)($data['media_id'] ?? 0);
            if (!$mediaId) {
                throw new Exception('Invalid media');
            }
            $stmt = $pdo->prepare("SELECT spm.series_id, spm.thumbnail_url, s.created_by, s.studio_id FROM series_public_media spm JOIN series s ON spm.series_id = s.id WHERE spm.id = ?");
            $stmt->execute([$mediaId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) {
                throw new Exception('Unauthorized');
            }
            if ((int)$row['created_by'] !== (int)$_SESSION['user_id']) {
                enforceStudioPermission($pdo, (int)($row['studio_id'] ?? 0), (int)$_SESSION['user_id'], 'series');
            }
            $stmt = $pdo->prepare("DELETE FROM series_public_media WHERE id = ?");
            $stmt->execute([$mediaId]);
            if (!empty($row['thumbnail_url'])) {
                $path = __DIR__ . '/../' . $row['thumbnail_url'];
                if (is_file($path)) {
                    @unlink($path);
                }
            }
            echo json_encode(['success' => true]);
            break;
        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
