<?php
require_once 'db_connect.php';
require_once 'config.php';
require_once 'PromptManager.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}



header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

try {
    // Get request data
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data || !isset($data['beat'])) {
        throw new Exception('Invalid request data');
    }

    $beatContent = trim($data['beat']);
    $mentions = isset($data['mentions']) && is_array($data['mentions']) ? $data['mentions'] : [];
    $storyId = isset($data['story_id']) ? (int)$data['story_id'] : 0;
    $sceneId = isset($data['scene_id']) ? (int)$data['scene_id'] : 0;

    $styleContext = '';
    if ($storyId > 0) {
        try {
            $stmt = $pdo->prepare("SELECT default_style, default_perspective FROM stories WHERE id = ?");
            $stmt->execute([$storyId]);
            $storyPrefs = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!empty($storyPrefs['default_style'])) {
                $styleContext .= "Default Style: " . $storyPrefs['default_style'] . "\n";
            }
            if (!empty($storyPrefs['default_perspective'])) {
                $styleContext .= "Default Perspective: " . $storyPrefs['default_perspective'] . "\n";
            }
        } catch (Exception $e) {
            $styleContext = '';
        }
    }

    $sceneContext = '';
    if ($sceneId > 0) {
        try {
            $stmt = $pdo->prepare("SELECT description FROM story_scenes WHERE id = ?");
            $stmt->execute([$sceneId]);
            $sceneDescription = $stmt->fetchColumn();
            if (!empty($sceneDescription)) {
                $sceneContext = "Scene Description: " . $sceneDescription . "\n";
            }
        } catch (Exception $e) {
            $sceneContext = '';
        }
    }

    // Prepare the prompt for the AI
    $contextText = '';
    if (!empty($mentions)) {
        $uniqueMentions = array_values(array_unique(array_filter($mentions)));
        $placeholders = implode(',', array_fill(0, count($uniqueMentions), '?'));
        try {
            $stmt = $pdo->prepare("
                SELECT mention_token, ai_context
                FROM codex_entries
                WHERE mention_token IN ($placeholders)
                AND ai_context IS NOT NULL
                AND ai_context <> ''
            ");
            $stmt->execute($uniqueMentions);
            $contexts = $stmt->fetchAll(PDO::FETCH_ASSOC);
            if (!empty($contexts)) {
                $contextLines = [];
                foreach ($contexts as $row) {
                    $contextLines[] = $row['mention_token'] . ': ' . $row['ai_context'];
                }
                $contextText = "Codex Context:\n" . implode("\n", $contextLines) . "\n\n";
            }
        } catch (Exception $e) {
            // Optional: ignore if codex_entries or ai_context not available
        }
    }

    $prompt = $contextText .
              ($styleContext ? $styleContext . "\n" : '') .
              ($sceneContext ? $sceneContext . "\n" : '') .
              "Based on this scene beat description:\n\n" . 
              $beatContent . "\n\n" .
              "Generate a detailed scene that captures this moment. Focus on showing rather than telling, " .
              "include sensory details, and maintain a natural flow. The scene should feel like a cohesive " .
              "part of a larger story.";

    // Make API request
    $ch = curl_init(LMSTUDIO_API_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => LMSTUDIO_MODEL,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are a creative writing assistant helping to expand scene beats into fully realized scenes.'
                ],
                [
                    'role' => 'user',
                    'content' => $prompt
                ]
            ]
        ])
    ]);

    $response = curl_exec($ch);
    
    if ($response === false) {
        throw new Exception('Curl error: ' . curl_error($ch));
    }

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new Exception('API returned error code: ' . $httpCode . ' Response: ' . $response);
    }

    // Clean the response before JSON decode
    $response = preg_replace('/[[:cntrl:]]/', '', $response);
    $result = json_decode($response, true);
    
    if (!$result || !isset($result['choices'][0]['message']['content'])) {
        throw new Exception('Invalid API response format: ' . htmlspecialchars($response));
    }

    // Get the generated prose
    $generatedProse = $result['choices'][0]['message']['content'];
    
    // Clean up the prose
    $generatedProse = trim($generatedProse);

    echo json_encode([
        'success' => true,
        'prose' => $generatedProse
    ]);

} catch (Exception $e) {
    error_log('Generate Prose Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} 
