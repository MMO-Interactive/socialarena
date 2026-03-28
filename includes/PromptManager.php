<?php
class PromptManager {
    private $pdo;
    private $user_id;

    public function __construct($pdo, $user_id = null) {
        $this->pdo = $pdo;
        $this->user_id = $user_id;
    }

    public function getPrompt($type, $purpose) {
        // First check for user custom prompt
        if ($this->user_id) {
            $stmt = $this->pdo->prepare("
                SELECT prompt_text 
                FROM user_prompts 
                WHERE user_id = ? AND type = ? AND purpose = ? AND is_active = 1
                LIMIT 1
            ");
            $stmt->execute([$this->user_id, $type, $purpose]);
            $customPrompt = $stmt->fetchColumn();
            
            if ($customPrompt) {
                return $customPrompt;
            }
        }

        // Fall back to system prompt
        $stmt = $this->pdo->prepare("
            SELECT prompt_text 
            FROM system_prompts 
            WHERE type = ? AND purpose = ? AND is_active = 1
            LIMIT 1
        ");
        $stmt->execute([$type, $purpose]);
        return $stmt->fetchColumn();
    }

    public function formatPrompt($prompt, $variables) {
        foreach ($variables as $key => $value) {
            $prompt = str_replace('{' . $key . '}', $value, $prompt);
        }
        return $prompt;
    }

    public function saveUserPrompt($name, $type, $purpose, $promptText) {
        $stmt = $this->pdo->prepare("
            INSERT INTO user_prompts (user_id, name, type, purpose, prompt_text)
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE prompt_text = VALUES(prompt_text)
        ");
        return $stmt->execute([$this->user_id, $name, $type, $purpose, $promptText]);
    }
} 