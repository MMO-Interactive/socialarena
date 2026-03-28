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

function getProjectIdForTask(PDO $pdo, int $taskId, int $userId): int {
    $stmt = $pdo->prepare("SELECT p.id FROM project_tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = ? AND p.user_id = ?");
    $stmt->execute([$taskId, $userId]);
    return (int)$stmt->fetchColumn();
}

function getProjectIdForMilestone(PDO $pdo, int $milestoneId, int $userId): int {
    $stmt = $pdo->prepare("SELECT p.id FROM project_milestones m JOIN projects p ON m.project_id = p.id WHERE m.id = ? AND p.user_id = ?");
    $stmt->execute([$milestoneId, $userId]);
    return (int)$stmt->fetchColumn();
}

function getProjectIdForShot(PDO $pdo, int $shotId, int $userId): int {
    $stmt = $pdo->prepare("SELECT p.id FROM project_shots s JOIN projects p ON s.project_id = p.id WHERE s.id = ? AND p.user_id = ?");
    $stmt->execute([$shotId, $userId]);
    return (int)$stmt->fetchColumn();
}

function getProject(PDO $pdo, int $projectId, int $userId): bool {
    $stmt = $pdo->prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?");
    $stmt->execute([$projectId, $userId]);
    return (bool)$stmt->fetchColumn();
}

try {
    switch ($action) {
        case 'create_task':
            $projectId = (int)($data['project_id'] ?? 0);
            $title = trim($data['title'] ?? '');
            $status = $data['status'] ?? 'todo';
            $priority = $data['priority'] ?? 'medium';
            $dueDate = $data['due_date'] ?? null;
            $description = trim($data['description'] ?? '');

            $allowedStatus = ['todo', 'in_progress', 'done'];
            $allowedPriority = ['low', 'medium', 'high'];

            if (!$projectId || $title === '' || !in_array($status, $allowedStatus, true) || !in_array($priority, $allowedPriority, true)) {
                throw new Exception('Invalid task data');
            }
            if (!getProject($pdo, $projectId, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }

            $dueDate = $dueDate !== '' ? $dueDate : null;
            $description = $description !== '' ? $description : null;

            $stmt = $pdo->prepare("INSERT INTO project_tasks (project_id, title, description, status, priority, due_date) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$projectId, $title, $description, $status, $priority, $dueDate]);
            $id = (int)$pdo->lastInsertId();

            $stmt = $pdo->prepare("SELECT * FROM project_tasks WHERE id = ?");
            $stmt->execute([$id]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'item' => $item]);
            break;

        case 'update_task':
            $taskId = (int)($data['task_id'] ?? 0);
            $title = trim($data['title'] ?? '');
            $status = $data['status'] ?? 'todo';
            $priority = $data['priority'] ?? 'medium';
            $dueDate = $data['due_date'] ?? null;
            $description = trim($data['description'] ?? '');

            $allowedStatus = ['todo', 'in_progress', 'done'];
            $allowedPriority = ['low', 'medium', 'high'];

            if (!$taskId || $title === '' || !in_array($status, $allowedStatus, true) || !in_array($priority, $allowedPriority, true)) {
                throw new Exception('Invalid task data');
            }

            $projectId = getProjectIdForTask($pdo, $taskId, $_SESSION['user_id']);
            if ($projectId === 0) {
                throw new Exception('Unauthorized');
            }

            $dueDate = $dueDate !== '' ? $dueDate : null;
            $description = $description !== '' ? $description : null;

            $stmt = $pdo->prepare("UPDATE project_tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ? WHERE id = ?");
            $stmt->execute([$title, $description, $status, $priority, $dueDate, $taskId]);

            $stmt = $pdo->prepare("SELECT * FROM project_tasks WHERE id = ?");
            $stmt->execute([$taskId]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'item' => $item]);
            break;

        case 'delete_task':
            $taskId = (int)($data['task_id'] ?? 0);
            if (!$taskId) {
                throw new Exception('Invalid task');
            }
            $projectId = getProjectIdForTask($pdo, $taskId, $_SESSION['user_id']);
            if ($projectId === 0) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("DELETE FROM project_tasks WHERE id = ?");
            $stmt->execute([$taskId]);
            echo json_encode(['success' => true]);
            break;

        case 'create_milestone':
            $projectId = (int)($data['project_id'] ?? 0);
            $title = trim($data['title'] ?? '');
            $targetDate = $data['target_date'] ?? null;
            $status = $data['status'] ?? 'upcoming';
            $notes = trim($data['notes'] ?? '');

            $allowedStatus = ['upcoming', 'at_risk', 'completed'];

            if (!$projectId || $title === '' || !in_array($status, $allowedStatus, true)) {
                throw new Exception('Invalid milestone data');
            }
            if (!getProject($pdo, $projectId, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }

            $targetDate = $targetDate !== '' ? $targetDate : null;
            $notes = $notes !== '' ? $notes : null;

            $stmt = $pdo->prepare("INSERT INTO project_milestones (project_id, title, target_date, status, notes) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$projectId, $title, $targetDate, $status, $notes]);
            $id = (int)$pdo->lastInsertId();

            $stmt = $pdo->prepare("SELECT * FROM project_milestones WHERE id = ?");
            $stmt->execute([$id]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'item' => $item]);
            break;

        case 'update_milestone':
            $milestoneId = (int)($data['milestone_id'] ?? 0);
            $title = trim($data['title'] ?? '');
            $targetDate = $data['target_date'] ?? null;
            $status = $data['status'] ?? 'upcoming';
            $notes = trim($data['notes'] ?? '');

            $allowedStatus = ['upcoming', 'at_risk', 'completed'];

            if (!$milestoneId || $title === '' || !in_array($status, $allowedStatus, true)) {
                throw new Exception('Invalid milestone data');
            }

            $projectId = getProjectIdForMilestone($pdo, $milestoneId, $_SESSION['user_id']);
            if ($projectId === 0) {
                throw new Exception('Unauthorized');
            }

            $targetDate = $targetDate !== '' ? $targetDate : null;
            $notes = $notes !== '' ? $notes : null;

            $stmt = $pdo->prepare("UPDATE project_milestones SET title = ?, target_date = ?, status = ?, notes = ? WHERE id = ?");
            $stmt->execute([$title, $targetDate, $status, $notes, $milestoneId]);

            $stmt = $pdo->prepare("SELECT * FROM project_milestones WHERE id = ?");
            $stmt->execute([$milestoneId]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'item' => $item]);
            break;

        case 'delete_milestone':
            $milestoneId = (int)($data['milestone_id'] ?? 0);
            if (!$milestoneId) {
                throw new Exception('Invalid milestone');
            }
            $projectId = getProjectIdForMilestone($pdo, $milestoneId, $_SESSION['user_id']);
            if ($projectId === 0) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("DELETE FROM project_milestones WHERE id = ?");
            $stmt->execute([$milestoneId]);
            echo json_encode(['success' => true]);
            break;

        case 'create_shot':
            $projectId = (int)($data['project_id'] ?? 0);
            $label = trim($data['shot_label'] ?? '');
            $shotType = trim($data['shot_type'] ?? '');
            $location = trim($data['location'] ?? '');
            $status = $data['status'] ?? 'planned';
            $description = trim($data['description'] ?? '');

            $allowedStatus = ['planned', 'blocked', 'shot'];

            if (!$projectId || !in_array($status, $allowedStatus, true)) {
                throw new Exception('Invalid shot data');
            }
            if (!getProject($pdo, $projectId, $_SESSION['user_id'])) {
                throw new Exception('Unauthorized');
            }

            $label = $label !== '' ? $label : null;
            $shotType = $shotType !== '' ? $shotType : null;
            $location = $location !== '' ? $location : null;
            $description = $description !== '' ? $description : null;

            $stmt = $pdo->prepare("INSERT INTO project_shots (project_id, shot_label, description, location, shot_type, status) VALUES (?, ?, ?, ?, ?, ?)");
            $stmt->execute([$projectId, $label, $description, $location, $shotType, $status]);
            $id = (int)$pdo->lastInsertId();

            $stmt = $pdo->prepare("SELECT * FROM project_shots WHERE id = ?");
            $stmt->execute([$id]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'item' => $item]);
            break;

        case 'update_shot':
            $shotId = (int)($data['shot_id'] ?? 0);
            $label = trim($data['shot_label'] ?? '');
            $shotType = trim($data['shot_type'] ?? '');
            $location = trim($data['location'] ?? '');
            $status = $data['status'] ?? 'planned';
            $description = trim($data['description'] ?? '');

            $allowedStatus = ['planned', 'blocked', 'shot'];

            if (!$shotId || !in_array($status, $allowedStatus, true)) {
                throw new Exception('Invalid shot data');
            }

            $projectId = getProjectIdForShot($pdo, $shotId, $_SESSION['user_id']);
            if ($projectId === 0) {
                throw new Exception('Unauthorized');
            }

            $label = $label !== '' ? $label : null;
            $shotType = $shotType !== '' ? $shotType : null;
            $location = $location !== '' ? $location : null;
            $description = $description !== '' ? $description : null;

            $stmt = $pdo->prepare("UPDATE project_shots SET shot_label = ?, description = ?, location = ?, shot_type = ?, status = ? WHERE id = ?");
            $stmt->execute([$label, $description, $location, $shotType, $status, $shotId]);

            $stmt = $pdo->prepare("SELECT * FROM project_shots WHERE id = ?");
            $stmt->execute([$shotId]);
            $item = $stmt->fetch(PDO::FETCH_ASSOC);

            echo json_encode(['success' => true, 'item' => $item]);
            break;

        case 'delete_shot':
            $shotId = (int)($data['shot_id'] ?? 0);
            if (!$shotId) {
                throw new Exception('Invalid shot');
            }
            $projectId = getProjectIdForShot($pdo, $shotId, $_SESSION['user_id']);
            if ($projectId === 0) {
                throw new Exception('Unauthorized');
            }
            $stmt = $pdo->prepare("DELETE FROM project_shots WHERE id = ?");
            $stmt->execute([$shotId]);
            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
