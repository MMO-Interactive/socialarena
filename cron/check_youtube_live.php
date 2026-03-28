<?php
require_once __DIR__ . '/../includes/db_connect.php';
require_once __DIR__ . '/../includes/config.php';

header('Content-Type: application/json');

$token = $_GET['token'] ?? '';
if ($token !== CRON_TOKEN) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

function youtubeRequest(string $url): ?array {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    $response = curl_exec($ch);
    if ($response === false) {
        curl_close($ch);
        return null;
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($status >= 400) {
        return null;
    }
    return json_decode($response, true);
}

$stmt = $pdo->query("
    SELECT studio_id, api_key, channel_id, channel_handle
    FROM studio_youtube_settings
    WHERE is_enabled = 1
");
$settings = $stmt->fetchAll(PDO::FETCH_ASSOC);

$results = [];

foreach ($settings as $setting) {
    $studioId = (int)$setting['studio_id'];
    $apiKey = $setting['api_key'];
    $channelId = $setting['channel_id'];
    $channelHandle = $setting['channel_handle'];

    if (!$channelId && $channelHandle) {
        $handle = ltrim(trim($channelHandle), '@');
        $resolveUrl = 'https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=' . urlencode($handle) . '&key=' . urlencode($apiKey);
        $resolved = youtubeRequest($resolveUrl);
        if (!empty($resolved['items'][0]['id'])) {
            $channelId = $resolved['items'][0]['id'];
            $update = $pdo->prepare("UPDATE studio_youtube_settings SET channel_id = ? WHERE studio_id = ?");
            $update->execute([$channelId, $studioId]);
        }
    }

    if (!$channelId) {
        $results[] = ['studio_id' => $studioId, 'status' => 'missing_channel'];
        continue;
    }

    $searchUrl = 'https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=' . urlencode($channelId) . '&eventType=live&type=video&key=' . urlencode($apiKey);
    $search = youtubeRequest($searchUrl);

    if (empty($search['items'])) {
        $stmt = $pdo->prepare("UPDATE studio_livestreams SET is_live = 0, ended_at = NOW() WHERE studio_id = ? AND is_live = 1");
        $stmt->execute([$studioId]);
        $results[] = ['studio_id' => $studioId, 'status' => 'offline'];
        continue;
    }

    $liveIds = [];
    foreach ($search['items'] as $item) {
        $videoId = $item['id']['videoId'] ?? null;
        if (!$videoId) continue;
        $liveIds[] = $videoId;

        $snippet = $item['snippet'] ?? [];
        $title = $snippet['title'] ?? null;
        $description = $snippet['description'] ?? null;
        $thumbnail = $snippet['thumbnails']['high']['url'] ?? ($snippet['thumbnails']['default']['url'] ?? null);
        $channelTitle = $snippet['channelTitle'] ?? null;
        $startedAt = $snippet['publishedAt'] ?? null;

        $stmt = $pdo->prepare("
            INSERT INTO studio_livestreams (studio_id, channel_id, channel_title, video_id, title, description, thumbnail_url, is_live, started_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
            ON DUPLICATE KEY UPDATE
                title = VALUES(title),
                description = VALUES(description),
                thumbnail_url = VALUES(thumbnail_url),
                is_live = 1,
                ended_at = NULL,
                updated_at = CURRENT_TIMESTAMP
        ");
        $stmt->execute([
            $studioId,
            $channelId,
            $channelTitle,
            $videoId,
            $title,
            $description,
            $thumbnail,
            $startedAt
        ]);
    }

    if (!empty($liveIds)) {
        $placeholders = implode(',', array_fill(0, count($liveIds), '?'));
        $stmt = $pdo->prepare("UPDATE studio_livestreams SET is_live = 0, ended_at = NOW() WHERE studio_id = ? AND video_id NOT IN ($placeholders)");
        $stmt->execute(array_merge([$studioId], $liveIds));
    }

    $results[] = ['studio_id' => $studioId, 'status' => 'live', 'count' => count($liveIds)];
}

echo json_encode(['success' => true, 'results' => $results]);
