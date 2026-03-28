<?php
require_once 'db_connect.php';
require_once 'comfyui.php';
if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}


header('Content-Type: application/json');

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$type = $_GET['type'] ?? $_POST['type'] ?? 'image';

try {
    switch ($action) {
        case 'status':
            $result = comfyuiRequest('/queue', 'GET', null, [], $type, false);
            if (!$result['success']) {
                $fallback = comfyuiRequest('/system_stats', 'GET', null, [], $type, false);
                if ($fallback['success']) {
                    $result = $fallback;
                }
            }
            echo json_encode($result);
            break;

        case 'queue':
            $payload = json_decode(file_get_contents('php://input'), true);
            if (empty($payload['prompt'])) {
                throw new Exception('Missing prompt payload');
            }
            $result = comfyuiRequest('/prompt', 'POST', ['prompt' => $payload['prompt']], [], $type);
            if (!$result['success']) {
                http_response_code(400);
            }
            echo json_encode($result);
            break;

        case 'history':
            $promptId = $_GET['prompt_id'] ?? '';
            if ($promptId === '') {
                throw new Exception('Missing prompt_id');
            }
            $result = comfyuiRequest('/history/' . urlencode($promptId), 'GET', null, [], $type);
            if (!$result['success']) {
                http_response_code(400);
            }
            echo json_encode($result);
            break;

        case 'queue_from_workflow':
            $payload = json_decode(file_get_contents('php://input'), true);
            if (empty($payload['workflow'])) {
                throw new Exception('Missing workflow');
            }
            $result = comfyuiRequest('/prompt', 'POST', ['prompt' => $payload['workflow']], [], $type);
            if (!$result['success']) {
                http_response_code(400);
            }
            echo json_encode($result);
            break;

        case 'upload_image':
            if (empty($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
                throw new Exception('Upload failed');
            }
            $file = $_FILES['image'];
            $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
            $allowed = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
            if (!in_array($ext, $allowed, true)) {
                throw new Exception('Invalid file type');
            }

            $upload_dir = __DIR__ . '/../uploads/comfyui/';
            if (!is_dir($upload_dir)) {
                mkdir($upload_dir, 0777, true);
            }
            $filename = 'comfyui_' . $_SESSION['user_id'] . '_' . uniqid() . '.' . $ext;
            $target = $upload_dir . $filename;

            if (!move_uploaded_file($file['tmp_name'], $target)) {
                throw new Exception('Failed to save file');
            }

            echo json_encode(['success' => true, 'url' => 'uploads/comfyui/' . $filename]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
