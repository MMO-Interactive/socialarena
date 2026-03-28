<?php
require_once 'config.php';
require_once 'comfyui.php';

class StoryGenerator {
    private $pdo;
    private $api_url;
    private $model;

    public function __construct($pdo) {
        $this->pdo = $pdo;
        $this->api_url = defined('LMSTUDIO_API_URL') ? LMSTUDIO_API_URL : 'http://127.0.0.1:1234/v1/chat/completions';
        $this->model = defined('LMSTUDIO_MODEL') ? LMSTUDIO_MODEL : 'local-model';
    }

    private function generateStoryContent($prompt, $model = null) {
        $headers = [
            'Content-Type: application/json'
        ];

        $data = [
            'model' => $model ?: $this->model,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => $prompt
                ]
            ]
        ];

        $ch = curl_init($this->api_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        
        // SSL Configuration
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        
        if (curl_errno($ch)) {
            throw new Exception('Curl error: ' . curl_error($ch));
        }
        
        curl_close($ch);
        
        $responseData = json_decode($response, true);
        
        if ($httpCode !== 200) {
            throw new Exception('API Error: ' . ($responseData['error']['message'] ?? 'Unknown error') . 
                              ' (HTTP Code: ' . $httpCode . ')');
        }
        
        return $responseData;
    }

    public function createNewStory($theme, $genre, $setting, $characterType, $tone) {
        $prompt = <<<EOT
Create an opening scene for a story with the following parameters:
Theme: $theme
Genre: $genre
Setting: $setting
Main Character Type: $characterType
Tone: $tone

Write an engaging opening scene that introduces the main character and setting. 
Make it immersive and descriptive, setting up an interesting scenario that invites user interaction.
Focus on sensory details and atmosphere while establishing the story's tone.
EOT;

        try {
            $response = $this->generateStoryContent($prompt);
            $content = $response['choices'][0]['message']['content'];
            
            // Modified title prompt to be very specific about format
            $titlePrompt = "Create a short, punchy title (2-4 words) for a $genre story. Return ONLY the title with no quotes, explanations, or additional text. The title should be memorable and fitting for the theme: $theme";
            $titleResponse = $this->generateStoryContent($titlePrompt);
            $title = trim($titleResponse['choices'][0]['message']['content']);
            
            // Clean up the title
            $title = preg_replace('/^(Title:\s*|\"|\'|Here\'s your title:\s*)/i', '', $title);
            $title = preg_replace('/[\"\'\.]$/', '', $title);
            $title = explode("\n", $title)[0]; // Take only the first line
            
            // Ensure title is not too long
            if (str_word_count($title) > 4) {
                $words = explode(' ', $title);
                $title = implode(' ', array_slice($words, 0, 4));
            }

            // Modified thumbnail prompt to be more neutral and safe
            $thumbnailPrompt = "Create a safe, family-friendly illustration for a $genre story. Scene: A scenic view of $setting in a $tone style. Focus on the landscape and atmosphere, avoiding any controversial or sensitive content.";
            try {
                $thumbnailUrl = $this->generateImage($thumbnailPrompt);
            } catch (Exception $e) {
                $thumbnailUrl = null;
            }
            
            // Insert the story with all parameters including thumbnail
            try {
                $stmt = $this->pdo->prepare("INSERT INTO stories (
                    title, genre, setting, main_character, description, 
                    thumbnail_url, user_id, created_by, status, story_type, is_ai_generated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', 'interactive', TRUE)");
                
                $stmt->execute([
                    $title, 
                    $genre, 
                    $setting, 
                    $characterType, 
                    "A $tone $genre story about a $characterType in $setting",
                    $thumbnailUrl,
                    $_SESSION['user_id'],
                    $_SESSION['user_id']
                ]);
            } catch (PDOException $e) {
                if (strpos($e->getMessage(), 'Unknown column') === false) {
                    throw $e;
                }
                // Fallback for older schema without created_by/status/story_type columns
                $stmt = $this->pdo->prepare("INSERT INTO stories (
                    title, genre, setting, main_character, description, 
                    thumbnail_url, user_id, is_ai_generated
                ) VALUES (?, ?, ?, ?, ?, ?, ?, TRUE)");
                $stmt->execute([
                    $title, 
                    $genre, 
                    $setting, 
                    $characterType, 
                    "A $tone $genre story about a $characterType in $setting",
                    $thumbnailUrl,
                    $_SESSION['user_id']
                ]);
            }
            $storyId = $this->pdo->lastInsertId();

            // Update user's story count
            $stmt = $this->pdo->prepare("
                UPDATE users 
                SET story_count = (
                    SELECT COUNT(*) 
                    FROM stories 
                    WHERE user_id = ?
                )
                WHERE id = ?
            ");
            $stmt->execute([$_SESSION['user_id'], $_SESSION['user_id']]);

            // Insert first page with additional metadata
            $stmt = $this->pdo->prepare("INSERT INTO pages (story_id, content, mood, location, active_characters) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$storyId, $content, $tone, $setting, $characterType]);

            return $storyId;
        } catch (Exception $e) {
            throw new Exception('Story generation failed: ' . $e->getMessage());
        }
    }

    public function generateNextPage($currentContent, $userResponse, $model = null) {
        // Get the story's metadata for context
        try {
            $stmt = $this->pdo->prepare("
                SELECT s.genre, s.setting, s.main_character, s.default_style, s.default_perspective, p.mood, p.location
                FROM pages p
                JOIN stories s ON p.story_id = s.id
                WHERE p.content = ?
                LIMIT 1
            ");
            $stmt->execute([$currentContent]);
            $metadata = $stmt->fetch(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            $stmt = $this->pdo->prepare("
                SELECT s.genre, s.setting, s.main_character, p.mood, p.location
                FROM pages p
                JOIN stories s ON p.story_id = s.id
                WHERE p.content = ?
                LIMIT 1
            ");
            $stmt->execute([$currentContent]);
            $metadata = $stmt->fetch(PDO::FETCH_ASSOC);
        }

        $style = $metadata['default_style'] ?? '';
        $perspective = $metadata['default_perspective'] ?? '';
        $styleLine = $style !== '' ? "Style: {$style}\n" : '';
        $perspectiveLine = $perspective !== '' ? "Perspective: {$perspective}\n" : '';

        $prompt = <<<EOT
Story context:
Genre: {$metadata['genre']}
Setting: {$metadata['setting']}
Main Character: {$metadata['main_character']}
{$styleLine}{$perspectiveLine}Current Location: {$metadata['location']}
Current Mood: {$metadata['mood']}

Current situation:
$currentContent

User action:
$userResponse

Continue the story based on this action. Maintain the established tone and genre while advancing the plot naturally.
Focus on vivid descriptions and emotional impact. Keep the response focused on the immediate consequences of the action.
EOT;

        try {
            // Generate the story content
            $response = $this->generateStoryContent($prompt, $model);
            $storyContent = $response['choices'][0]['message']['content'];

            // Modified image prompt to be more neutral and safe
            $imagePrompt = "Create a safe, family-friendly illustration of a scenic moment from this story. Focus on the environment and atmosphere, avoiding any controversial elements. Show the setting and mood through landscape and environmental details.";
            $imageUrl = null;
            try {
                $imageUrl = $this->generateImage($imagePrompt);
            } catch (Exception $e) {
                $imageUrl = null;
            }

            return [
                'content' => $storyContent,
                'image_url' => $imageUrl
            ];
        } catch (Exception $e) {
            // If image generation fails, still return the story content
            if (strpos($e->getMessage(), 'OpenAI API Error') !== false) {
                return [
                    'content' => $storyContent,
                    'image_url' => null
                ];
            }
            throw new Exception('Failed to generate next page: ' . $e->getMessage());
        }
    }

    public function generateSuggestions($currentContent) {
        // Get story context
        $stmt = $this->pdo->prepare("
            SELECT s.genre, s.setting, s.main_character
            FROM pages p
            JOIN stories s ON p.story_id = s.id
            WHERE p.content = ?
            LIMIT 1
        ");
        $stmt->execute([$currentContent]);
        $context = $stmt->fetch(PDO::FETCH_ASSOC);

        $prompt = <<<EOT
Given this situation in a {$context['genre']} story about a {$context['main_character']}:
$currentContent

Suggest 3 different possible actions the user could take next. 
Make them interesting and appropriate for the genre and setting.
Each suggestion should be dramatic and consequential.
Return only the 3 suggestions, one per line, without any numbering or extra text.
EOT;

        try {
            $response = $this->generateStoryContent($prompt);
            $suggestions = explode("\n", trim($response['choices'][0]['message']['content']));
            return array_slice($suggestions, 0, 3);
        } catch (Exception $e) {
            return [
                "Take a cautious approach...",
                "Try something bold...",
                "Consider another option..."
            ];
        }
    }

    public function generateImage($prompt) {
        $workflowPath = __DIR__ . '/../comfy/Vantage-Z-Image-Turbo.json';
        if (!is_file($workflowPath)) {
            throw new Exception('ComfyUI workflow not found.');
        }
        $workflowRaw = file_get_contents($workflowPath);
        $workflow = json_decode($workflowRaw, true);
        if (!is_array($workflow)) {
            throw new Exception('Invalid ComfyUI workflow.');
        }

        if (isset($workflow['42']['inputs']['text'])) {
            $workflow['42']['inputs']['text'] = $prompt;
        }

        if (isset($workflow['9']['inputs']['filename_prefix'])) {
            $workflow['9']['inputs']['filename_prefix'] = 'stories/interactive/story_' . time();
        }

        $queue = comfyuiRequest('/prompt', 'POST', ['prompt' => $workflow]);
        if (empty($queue['success'])) {
            throw new Exception('ComfyUI queue failed.');
        }
        $promptId = $queue['data']['prompt_id'] ?? $queue['data']['id'] ?? null;
        if (!$promptId) {
            throw new Exception('ComfyUI prompt id missing.');
        }

        $imageUrl = null;
        for ($i = 0; $i < 25; $i++) {
            $history = comfyuiRequest('/history/' . urlencode($promptId), 'GET');
            if (!empty($history['success']) && !empty($history['data'])) {
                $imageUrl = $this->extractComfyImageUrl($history['data']);
                if ($imageUrl) {
                    break;
                }
            }
            sleep(1);
        }

        if (!$imageUrl) {
            throw new Exception('ComfyUI image not ready.');
        }
        return $imageUrl;
    }

    private function extractComfyImageUrl(array $history): ?string {
        $possibleSets = [];
        if (isset($history['outputs'])) {
            $possibleSets[] = $history;
        } else {
            foreach ($history as $promptData) {
                if (isset($promptData['outputs'])) {
                    $possibleSets[] = $promptData;
                }
            }
        }

        foreach ($possibleSets as $promptData) {
            foreach ($promptData['outputs'] as $output) {
                if (!empty($output['images'][0])) {
                    $image = $output['images'][0];
                    return rtrim(comfyuiBaseUrl(), '/') . '/view?' . http_build_query([
                        'filename' => $image['filename'] ?? '',
                        'subfolder' => $image['subfolder'] ?? '',
                        'type' => $image['type'] ?? 'output'
                    ]);
                }
            }
        }
        return null;
    }
}
?> 
