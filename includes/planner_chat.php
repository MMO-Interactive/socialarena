<?php
require_once 'db_connect.php';
require_once 'config.php';
require_once 'studio_access.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!$data || empty($data['messages'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid request']);
    exit;
}

$story_id = isset($data['story_id']) ? (int)$data['story_id'] : 0;
$season_id = isset($data['season_id']) ? (int)$data['season_id'] : 0;
$episode_id = isset($data['episode_id']) ? (int)$data['episode_id'] : 0;

$scope = 'story';
if ($episode_id > 0) {
    $scope = 'episode';
} elseif ($season_id > 0) {
    $scope = 'season';
}

if ($scope === 'story') {
    $stmt = $pdo->prepare("
        SELECT s.*, ser.title as series_title, uni.title as universe_title
        FROM stories s
        LEFT JOIN series ser ON s.series_id = ser.id
        LEFT JOIN universes uni ON s.universe_id = uni.id
        WHERE s.id = ?
    ");
    $stmt->execute([$story_id]);
    $story = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$story) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Story not found']);
        exit;
    }
    try {
        enforceStoryAccess($pdo, $story_id, (int)$_SESSION['user_id'], false);
    } catch (Exception $e) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }
} else {
    $stmt = $pdo->prepare("
        SELECT s.id, s.created_by, s.studio_id, s.visibility
        FROM series s
        LEFT JOIN series_seasons ss ON ss.series_id = s.id
        LEFT JOIN series_episodes se ON se.season_id = ss.id
        WHERE (ss.id = ? OR se.id = ?)
        LIMIT 1
    ");
    $stmt->execute([$season_id, $episode_id]);
    $seriesRow = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$seriesRow) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'Series not found']);
        exit;
    }
    try {
        enforceStudioItemAccess(
            $pdo,
            (int)$seriesRow['created_by'],
            (int)$seriesRow['studio_id'],
            $seriesRow['visibility'],
            (int)$_SESSION['user_id'],
            'series',
            false
        );
    } catch (Exception $e) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'Unauthorized']);
        exit;
    }
}

$outline = $data['context'] ?? '';

$systemPrompt = "You are a story planning assistant. Help the author plan scenes, arcs, and ideas. "
    . "Be concise, practical, and focused on actionable suggestions. If the author asks for outlines, "
    . "provide bullet lists. If they ask for options, provide 3-5 choices.\n\n"
    . ucfirst($scope) . " Context:\n" . $outline;

$messages = [
    [
        'role' => 'system',
        'content' => $systemPrompt
    ]
];

foreach ($data['messages'] as $message) {
    if (!isset($message['role'], $message['content'])) {
        continue;
    }
    $role = $message['role'] === 'assistant' ? 'assistant' : 'user';
    $messages[] = [
        'role' => $role,
        'content' => $message['content']
    ];
}

$payload = [
    'model' => LMSTUDIO_MODEL,
    'messages' => $messages,
    'temperature' => 0.7,
    'max_tokens' => 800
];

$ch = curl_init(LMSTUDIO_API_URL);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => 0,
    CURLOPT_HTTPHEADER => [
        'Content-Type: application/json'
    ],
    CURLOPT_POSTFIELDS => json_encode($payload)
]);

$response = curl_exec($ch);
if ($response === false) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Curl error: ' . curl_error($ch)]);
    exit;
}

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'LM Studio error: ' . $response]);
    exit;
}

$result = json_decode($response, true);
if (!$result || empty($result['choices'][0]['message']['content'])) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Invalid LM Studio response']);
    exit;
}

echo json_encode([
    'success' => true,
    'reply' => trim($result['choices'][0]['message']['content'])
]);
