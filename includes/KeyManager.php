<?php
class KeyManager {
    private $pdo;
    private $encryption_key;

    public function __construct($pdo) {
        $this->pdo = $pdo;
        // Use a secure encryption key - set APP_ENCRYPTION_KEY in the environment when possible
        $envKey = getenv('APP_ENCRYPTION_KEY');
        $this->encryption_key = $envKey ? $envKey : 'your-secure-encryption-key';
    }

    public function getKey($keyType) {
        $stmt = $this->pdo->prepare("
            SELECT key_value 
            FROM user_api_keys 
            WHERE user_id = ? AND key_type = ?
        ");
        $stmt->execute([$_SESSION['user_id'], $keyType]);
        $encryptedKey = $stmt->fetchColumn();
        
        if ($encryptedKey) {
            return $this->decrypt($encryptedKey);
        }
        return null;
    }

    public function storeKey($keyType, $keyValue) {
        $encryptedKey = $this->encrypt($keyValue);
        $stmt = $this->pdo->prepare("
            INSERT INTO user_api_keys (user_id, key_type, key_value)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE key_value = VALUES(key_value)
        ");
        return $stmt->execute([$_SESSION['user_id'], $keyType, $encryptedKey]);
    }

    public function encryptKey($value) {
        return $this->encrypt($value);
    }

    public function decryptKey($value) {
        return $this->decrypt($value);
    }

    private function encrypt($value) {
        $iv = openssl_random_pseudo_bytes(openssl_cipher_iv_length('aes-256-cbc'));
        $encrypted = openssl_encrypt($value, 'aes-256-cbc', $this->encryption_key, 0, $iv);
        return base64_encode($iv . $encrypted);
    }

    private function decrypt($value) {
        $value = base64_decode($value);
        $iv_length = openssl_cipher_iv_length('aes-256-cbc');
        $iv = substr($value, 0, $iv_length);
        $encrypted = substr($value, $iv_length);
        return openssl_decrypt($encrypted, 'aes-256-cbc', $this->encryption_key, 0, $iv);
    }
}
?> 
