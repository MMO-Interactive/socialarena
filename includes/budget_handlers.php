<?php
require_once 'db_connect.php';
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
$action = $data['action'] ?? '';

function getBudgetId(PDO $pdo, int $budgetId, int $userId): int {
    $stmt = $pdo->prepare("SELECT b.id FROM film_budgets b JOIN projects p ON b.project_id = p.id WHERE b.id = ? AND p.user_id = ? AND p.project_type = 'film'");
    $stmt->execute([$budgetId, $userId]);
    return (int)$stmt->fetchColumn();
}

function getCategoryId(PDO $pdo, int $categoryId, int $userId): int {
    $stmt = $pdo->prepare("SELECT c.id FROM film_budget_categories c JOIN film_budgets b ON c.budget_id = b.id JOIN projects p ON b.project_id = p.id WHERE c.id = ? AND p.user_id = ? AND p.project_type = 'film'");
    $stmt->execute([$categoryId, $userId]);
    return (int)$stmt->fetchColumn();
}

function getItemId(PDO $pdo, int $itemId, int $userId): int {
    $stmt = $pdo->prepare("SELECT i.id FROM film_budget_items i JOIN film_budget_categories c ON i.category_id = c.id JOIN film_budgets b ON c.budget_id = b.id JOIN projects p ON b.project_id = p.id WHERE i.id = ? AND p.user_id = ? AND p.project_type = 'film'");
    $stmt->execute([$itemId, $userId]);
    return (int)$stmt->fetchColumn();
}

try {
    switch ($action) {
        case 'create_category':
            $budget_id = (int)($data['budget_id'] ?? 0);
            $name = trim($data['name'] ?? '');
            if (!$budget_id || $name === '') {
                throw new Exception('Invalid category');
            }
            if (!getBudgetId($pdo, $budget_id, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("INSERT INTO film_budget_categories (budget_id, name, description) VALUES (?, ?, ?)");
            $stmt->execute([$budget_id, $name, trim($data['description'] ?? '')]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'update_category':
            $category_id = (int)($data['category_id'] ?? 0);
            $name = trim($data['name'] ?? '');
            if (!$category_id || $name === '') {
                throw new Exception('Invalid category');
            }
            if (!getCategoryId($pdo, $category_id, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("UPDATE film_budget_categories SET name = ?, description = ? WHERE id = ?");
            $stmt->execute([$name, trim($data['description'] ?? ''), $category_id]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_category':
            $category_id = (int)($data['category_id'] ?? 0);
            if (!$category_id) {
                throw new Exception('Invalid category');
            }
            if (!getCategoryId($pdo, $category_id, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("DELETE FROM film_budget_categories WHERE id = ?");
            $stmt->execute([$category_id]);
            echo json_encode(['success' => true]);
            break;

        case 'create_item':
            $category_id = (int)($data['category_id'] ?? 0);
            $item_name = trim($data['item_name'] ?? '');
            $status = $data['status'] ?? 'planned';
            $allowed = ['planned', 'approved', 'spent'];
            if (!$category_id || $item_name === '' || !in_array($status, $allowed, true)) {
                throw new Exception('Invalid item');
            }
            if (!getCategoryId($pdo, $category_id, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("INSERT INTO film_budget_items (category_id, item_name, vendor, notes, quantity, unit_cost, status) VALUES (?, ?, ?, ?, ?, ?, ?)");
            $stmt->execute([
                $category_id,
                $item_name,
                trim($data['vendor'] ?? ''),
                trim($data['notes'] ?? ''),
                (float)($data['quantity'] ?? 1),
                (float)($data['unit_cost'] ?? 0),
                $status
            ]);
            echo json_encode(['success' => true, 'id' => $pdo->lastInsertId()]);
            break;

        case 'update_item':
            $item_id = (int)($data['item_id'] ?? 0);
            $item_name = trim($data['item_name'] ?? '');
            $status = $data['status'] ?? 'planned';
            $allowed = ['planned', 'approved', 'spent'];
            if (!$item_id || $item_name === '' || !in_array($status, $allowed, true)) {
                throw new Exception('Invalid item');
            }
            if (!getItemId($pdo, $item_id, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("UPDATE film_budget_items SET item_name = ?, vendor = ?, notes = ?, quantity = ?, unit_cost = ?, status = ? WHERE id = ?");
            $stmt->execute([
                $item_name,
                trim($data['vendor'] ?? ''),
                trim($data['notes'] ?? ''),
                (float)($data['quantity'] ?? 1),
                (float)($data['unit_cost'] ?? 0),
                $status,
                $item_id
            ]);
            echo json_encode(['success' => true]);
            break;

        case 'delete_item':
            $item_id = (int)($data['item_id'] ?? 0);
            if (!$item_id) {
                throw new Exception('Invalid item');
            }
            if (!getItemId($pdo, $item_id, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("DELETE FROM film_budget_items WHERE id = ?");
            $stmt->execute([$item_id]);
            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
