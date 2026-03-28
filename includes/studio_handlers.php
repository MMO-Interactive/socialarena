<?php
require_once 'db_connect.php';
require_once 'auth.php';

header('Content-Type: application/json');

$data = json_decode(file_get_contents('php://input'), true);
$action = $data['action'] ?? '';

$permissionKeys = [
    'dashboard', 'writing_center', 'idea_boards', 'series', 'universes', 'stories',
    'projects', 'budgets', 'virtual_cast', 'locations', 'wardrobe', 'props',
    'music_library', 'music_composer', 'timeline', 'social', 'settings'
];

function ensureOwner(PDO $pdo, int $studioId, int $userId): void {
    $stmt = $pdo->prepare("SELECT role FROM studio_members WHERE studio_id = ? AND user_id = ?");
    $stmt->execute([$studioId, $userId]);
    $role = $stmt->fetchColumn();
    if ($role !== 'owner') {
        throw new Exception('Unauthorized');
    }
}

try {
    switch ($action) {
        case 'create_studio':
            $stmt = $pdo->prepare("
                INSERT INTO studios (owner_id, name, description, logo_url, banner_url)
                VALUES (?, ?, ?, ?, ?)
            ");
            $stmt->execute([
                $_SESSION['user_id'],
                trim($data['name'] ?? ''),
                trim($data['description'] ?? ''),
                trim($data['logo_url'] ?? ''),
                trim($data['banner_url'] ?? '')
            ]);
            $studioId = (int)$pdo->lastInsertId();
            $stmt = $pdo->prepare("INSERT INTO studio_members (studio_id, user_id, role) VALUES (?, ?, 'owner')");
            $stmt->execute([$studioId, $_SESSION['user_id']]);
            foreach ($permissionKeys as $key) {
                $stmt = $pdo->prepare("
                    INSERT INTO studio_permissions (studio_id, user_id, permission_key, allowed)
                    VALUES (?, ?, ?, 1)
                ");
                $stmt->execute([$studioId, $_SESSION['user_id'], $key]);
            }
            echo json_encode(['success' => true, 'id' => $studioId]);
            break;

        case 'add_member':
            $studioId = (int)($data['studio_id'] ?? 0);
            ensureOwner($pdo, $studioId, $_SESSION['user_id']);
            $identifier = trim($data['identifier'] ?? '');
            $role = in_array($data['role'] ?? 'member', ['admin', 'member'], true) ? $data['role'] : 'member';
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1");
            $stmt->execute([$identifier, $identifier]);
            $userId = (int)$stmt->fetchColumn();
            if (!$userId) {
                throw new Exception('User not found');
            }
            $stmt = $pdo->prepare("INSERT IGNORE INTO studio_members (studio_id, user_id, role) VALUES (?, ?, ?)");
            $stmt->execute([$studioId, $userId, $role]);
            foreach ($permissionKeys as $key) {
                $stmt = $pdo->prepare("
                    INSERT IGNORE INTO studio_permissions (studio_id, user_id, permission_key, allowed)
                    VALUES (?, ?, ?, 0)
                ");
                $stmt->execute([$studioId, $userId, $key]);
            }
            echo json_encode(['success' => true]);
            break;

        case 'update_role':
            $studioId = (int)($data['studio_id'] ?? 0);
            ensureOwner($pdo, $studioId, $_SESSION['user_id']);
            $memberId = (int)($data['member_id'] ?? 0);
            $role = in_array($data['role'] ?? 'member', ['admin', 'member'], true) ? $data['role'] : 'member';
            $stmt = $pdo->prepare("UPDATE studio_members SET role = ? WHERE studio_id = ? AND user_id = ?");
            $stmt->execute([$role, $studioId, $memberId]);
            echo json_encode(['success' => true]);
            break;

        case 'remove_member':
            $studioId = (int)($data['studio_id'] ?? 0);
            ensureOwner($pdo, $studioId, $_SESSION['user_id']);
            $memberId = (int)($data['member_id'] ?? 0);
            if ($memberId === (int)$_SESSION['user_id']) {
                throw new Exception('Cannot remove owner');
            }
            $stmt = $pdo->prepare("DELETE FROM studio_members WHERE studio_id = ? AND user_id = ?");
            $stmt->execute([$studioId, $memberId]);
            $stmt = $pdo->prepare("DELETE FROM studio_permissions WHERE studio_id = ? AND user_id = ?");
            $stmt->execute([$studioId, $memberId]);
            echo json_encode(['success' => true]);
            break;

        case 'list_permissions':
            $studioId = (int)($data['studio_id'] ?? 0);
            ensureOwner($pdo, $studioId, $_SESSION['user_id']);
            $stmt = $pdo->prepare("
                SELECT u.id, u.username, u.email, sm.role
                FROM studio_members sm
                JOIN users u ON sm.user_id = u.id
                WHERE sm.studio_id = ?
                ORDER BY sm.role DESC, u.username ASC
            ");
            $stmt->execute([$studioId]);
            $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
            $stmt = $pdo->prepare("
                SELECT user_id, permission_key, allowed
                FROM studio_permissions
                WHERE studio_id = ?
            ");
            $stmt->execute([$studioId]);
            $permissions = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode([
                'success' => true,
                'members' => $members,
                'permissions' => $permissions,
                'permission_keys' => $permissionKeys
            ]);
            break;

        case 'update_permission':
            $studioId = (int)($data['studio_id'] ?? 0);
            ensureOwner($pdo, $studioId, $_SESSION['user_id']);
            $memberId = (int)($data['member_id'] ?? 0);
            $key = $data['permission_key'] ?? '';
            $allowed = !empty($data['allowed']) ? 1 : 0;
            if (!in_array($key, $permissionKeys, true)) {
                throw new Exception('Invalid permission');
            }
            $stmt = $pdo->prepare("SELECT role FROM studio_members WHERE studio_id = ? AND user_id = ?");
            $stmt->execute([$studioId, $memberId]);
            $role = $stmt->fetchColumn();
            if ($role === 'owner') {
                $allowed = 1;
            }
            $stmt = $pdo->prepare("
                INSERT INTO studio_permissions (studio_id, user_id, permission_key, allowed)
                VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE allowed = VALUES(allowed)
            ");
            $stmt->execute([$studioId, $memberId, $key, $allowed]);
            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
