<?php
require_once 'db_connect.php';
require_once 'config.php';
require_once 'PromptManager.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}



if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

try {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        throw new Exception('Invalid request data');
    }

    $type = $data['type'] ?? '';
    $count = $data['count'] ?? 5;

    // Initialize PromptManager and get appropriate prompt
    $promptManager = new PromptManager($pdo, $_SESSION['user_id']);
    $prompt = $promptManager->getPrompt('universe', $type);

    // Format the prompt with variables
    $variables = [
        'count' => $count,
        'title' => $data['title'] ?? 'the universe'
    ];
    
    $formattedPrompt = $promptManager->formatPrompt($prompt, $variables);

    // Make API request
    $ch = curl_init(LMSTUDIO_API_URL);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_SSL_VERIFYPEER => false, // For local development
        CURLOPT_SSL_VERIFYHOST => 0,     // For local development
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode([
            'model' => LMSTUDIO_MODEL,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => 'You are a creative writing assistant helping to generate ideas for story universes.'
                ],
                [
                    'role' => 'user',
                    'content' => $formattedPrompt
                ]
            ]
        ])
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        throw new Exception('API request failed: ' . $error);
    }

    if ($httpCode !== 200) {
        throw new Exception('API returned error code: ' . $httpCode . ' Response: ' . $response);
    }

    $result = json_decode($response, true);
    if (!$result || !isset($result['choices'][0]['message']['content'])) {
        throw new Exception('Invalid API response format: ' . $response);
    }

    // Process the response
    $suggestions = array_filter(
        array_map(
            'trim',
            explode("\n", $result['choices'][0]['message']['content'])
        )
    );

    // Limit to requested count
    $suggestions = array_slice($suggestions, 0, $count);

    echo json_encode([
        'success' => true,
        'suggestions' => $suggestions
    ]);

} catch (Exception $e) {
    error_log('Universe Suggestions Error: ' . $e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} 
