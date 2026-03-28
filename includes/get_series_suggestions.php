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
    // Decode and validate input data
    $rawData = file_get_contents('php://input');
    if (!$rawData) {
        throw new Exception('No input data received');
    }

    // Remove any invalid characters before JSON decode
    $rawData = preg_replace('/[[:cntrl:]]/', '', $rawData);
    $data = json_decode($rawData, true);
    
    if (!$data) {
        throw new Exception('Invalid JSON data: ' . json_last_error_msg());
    }

    $type = $data['type'] ?? '';
    $count = $data['count'] ?? 5;
    $universeContext = isset($data['universe_context']) ? strip_tags($data['universe_context']) : '';

    // Initialize PromptManager and get appropriate prompt
    $promptManager = new PromptManager($pdo, $_SESSION['user_id']);
    $prompt = $promptManager->getPrompt('series', $type);

    // Format the prompt with variables
    $variables = [
        'count' => $count,
        'title' => isset($data['title']) ? strip_tags($data['title']) : 'the series',
        'universe_context' => $universeContext
    ];
    
    $formattedPrompt = $promptManager->formatPrompt($prompt, $variables);

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
                    'content' => 'You are a creative writing assistant helping to generate ideas for story series.'
                ],
                [
                    'role' => 'user',
                    'content' => $formattedPrompt
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

    // Process the response
    $content = $result['choices'][0]['message']['content'];
    $content = strip_tags($content); // Remove any HTML tags
    
    $suggestions = array_filter(
        array_map(
            function($line) {
                return trim(strip_tags($line));
            },
            explode("\n", $content)
        )
    );

    // Limit to requested count
    $suggestions = array_slice($suggestions, 0, $count);

    header('Content-Type: application/json');
    echo json_encode([
        'success' => true,
        'suggestions' => $suggestions
    ]);

} catch (Exception $e) {
    error_log('Series Suggestions Error: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
} 
