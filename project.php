<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$project_id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
$story_id = isset($_GET['story_id']) ? (int)$_GET['story_id'] : 0;
$episode_id = isset($_GET['episode_id']) ? (int)$_GET['episode_id'] : 0;

if ($project_id === 0 && $story_id === 0 && $episode_id === 0) {
    header('Location: writing_center.php');
    exit;
}

if ($project_id === 0) {
    if ($episode_id > 0) {
        $stmt = $pdo->prepare("
            SELECT p.id
            FROM projects p
            JOIN series_episodes e ON p.episode_id = e.id
            JOIN series_seasons ss ON e.season_id = ss.id
            JOIN series s ON ss.series_id = s.id
            WHERE p.episode_id = ? AND p.user_id = ?
        ");
        $stmt->execute([$episode_id, $_SESSION['user_id']]);
        $project_id = (int)$stmt->fetchColumn();

        if ($project_id === 0) {
            $stmt = $pdo->prepare("
                SELECT e.title, s.title as series_title
                FROM series_episodes e
                JOIN series_seasons ss ON e.season_id = ss.id
                JOIN series s ON ss.series_id = s.id
                WHERE e.id = ?
            ");
            $stmt->execute([$episode_id]);
            $episode = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$episode) {
                header('Location: writing_center.php');
                exit;
            }
            try {
                $stmt = $pdo->prepare("
                    SELECT s.id
                    FROM series s
                    JOIN series_seasons ss ON ss.series_id = s.id
                    JOIN series_episodes e ON e.season_id = ss.id
                    WHERE e.id = ?
                ");
                $stmt->execute([$episode_id]);
                $seriesId = (int)$stmt->fetchColumn();
                enforceSeriesAccess($pdo, $seriesId, (int)$_SESSION['user_id'], false);
            } catch (Exception $e) {
                header('Location: writing_center.php');
                exit;
            }
            $title = $episode['series_title'] . ' - ' . $episode['title'];
            $stmt = $pdo->prepare("
                INSERT INTO projects (user_id, project_type, episode_id, title)
                VALUES (?, 'episode', ?, ?)
            ");
            $stmt->execute([$_SESSION['user_id'], $episode_id, $title]);
            $project_id = (int)$pdo->lastInsertId();
        }
    } elseif ($story_id > 0) {
        $stmt = $pdo->prepare("SELECT id FROM projects WHERE story_id = ? AND user_id = ?");
        $stmt->execute([$story_id, $_SESSION['user_id']]);
        $project_id = (int)$stmt->fetchColumn();

        if ($project_id === 0) {
            $stmt = $pdo->prepare("SELECT title FROM stories WHERE id = ?");
            $stmt->execute([$story_id]);
            $story = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$story) {
                header('Location: writing_center.php');
                exit;
            }
            try {
                enforceStoryAccess($pdo, $story_id, (int)$_SESSION['user_id'], false);
            } catch (Exception $e) {
                header('Location: writing_center.php');
                exit;
            }
            $stmt = $pdo->prepare("
                INSERT INTO projects (user_id, project_type, story_id, title)
                VALUES (?, 'film', ?, ?)
            ");
            $stmt->execute([$_SESSION['user_id'], $story_id, $story['title']]);
            $project_id = (int)$pdo->lastInsertId();
        }
    }
}

$stmt = $pdo->prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?");
$stmt->execute([$project_id, $_SESSION['user_id']]);
$project = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$project) {
    header('Location: writing_center.php');
    exit;
}

$stmt = $pdo->prepare("SELECT * FROM project_tasks WHERE project_id = ? ORDER BY created_at DESC");
$stmt->execute([$project_id]);
$tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare("SELECT * FROM project_milestones WHERE project_id = ? ORDER BY target_date ASC, created_at ASC");
$stmt->execute([$project_id]);
$milestones = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmt = $pdo->prepare("SELECT * FROM project_shots WHERE project_id = ? ORDER BY created_at DESC");
$stmt->execute([$project_id]);
$shots = $stmt->fetchAll(PDO::FETCH_ASSOC);

$page_title = 'Project - ' . htmlspecialchars($project['title']);
$additional_css = ['css/project.css'];

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="project-header">
                <div>
                    <h1><?php echo htmlspecialchars($project['title']); ?></h1>
                    <p class="muted"><?php echo htmlspecialchars(ucfirst($project['project_type'])); ?> project | <?php echo htmlspecialchars($project['status']); ?></p>
                </div>
                <div class="project-actions">
                    <?php if ($project['project_type'] === 'episode'): ?>
                        <?php
                        $stmt = $pdo->prepare("
                            SELECT s.id
                            FROM series s
                            JOIN series_seasons ss ON ss.series_id = s.id
                            JOIN series_episodes e ON e.season_id = ss.id
                            WHERE e.id = ?
                        ");
                        $stmt->execute([(int)$project['episode_id']]);
                        $series_id = (int)$stmt->fetchColumn();
                        ?>
                        <a class="btn" href="series_planner.php?id=<?php echo $series_id; ?>">Back to Series</a>
                    <?php else: ?>
                        <a class="btn" href="story_planner.php?id=<?php echo (int)($project['story_id'] ?? 0); ?>">Back to Film</a>
                        <a class="btn" href="budget.php?project_id=<?php echo (int)$project_id; ?>">Film Budget</a>
                    <?php endif; ?>
                </div>
            </div>

            <div class="project-grid">
                <section class="project-panel">
                    <div class="panel-header">
                        <h2>Tasks</h2>
                        <button class="btn" id="add-task">Add Task</button>
                    </div>
                    <div class="panel-list" id="task-list">
                        <?php if (empty($tasks)): ?>
                            <p class="empty-state">No tasks yet.</p>
                        <?php else: ?>
                            <?php foreach ($tasks as $task): ?>
                                <div class="panel-item"
                                     data-id="<?php echo (int)$task['id']; ?>"
                                     data-title="<?php echo htmlspecialchars($task['title'], ENT_QUOTES); ?>"
                                     data-description="<?php echo htmlspecialchars($task['description'] ?? '', ENT_QUOTES); ?>"
                                     data-status="<?php echo htmlspecialchars($task['status'], ENT_QUOTES); ?>"
                                     data-priority="<?php echo htmlspecialchars($task['priority'], ENT_QUOTES); ?>"
                                     data-due-date="<?php echo htmlspecialchars($task['due_date'] ?? '', ENT_QUOTES); ?>">
                                    <div>
                                        <strong><?php echo htmlspecialchars($task['title']); ?></strong>
                                        <div class="muted"><?php echo htmlspecialchars($task['status']); ?> | <?php echo htmlspecialchars($task['priority']); ?></div>
                                    </div>
                                    <div class="panel-actions">
                                        <button class="btn" data-action="edit-task">Edit</button>
                                        <button class="btn danger" data-action="delete-task">Remove</button>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </section>

                <section class="project-panel">
                    <div class="panel-header">
                        <h2>Milestones</h2>
                        <button class="btn" id="add-milestone">Add Milestone</button>
                    </div>
                    <div class="panel-list" id="milestone-list">
                        <?php if (empty($milestones)): ?>
                            <p class="empty-state">No milestones yet.</p>
                        <?php else: ?>
                            <?php foreach ($milestones as $milestone): ?>
                                <div class="panel-item"
                                     data-id="<?php echo (int)$milestone['id']; ?>"
                                     data-title="<?php echo htmlspecialchars($milestone['title'], ENT_QUOTES); ?>"
                                     data-notes="<?php echo htmlspecialchars($milestone['notes'] ?? '', ENT_QUOTES); ?>"
                                     data-status="<?php echo htmlspecialchars($milestone['status'], ENT_QUOTES); ?>"
                                     data-target-date="<?php echo htmlspecialchars($milestone['target_date'] ?? '', ENT_QUOTES); ?>">
                                    <div>
                                        <strong><?php echo htmlspecialchars($milestone['title']); ?></strong>
                                        <div class="muted"><?php echo htmlspecialchars($milestone['status']); ?> <?php echo $milestone['target_date'] ? '| ' . htmlspecialchars($milestone['target_date']) : ''; ?></div>
                                    </div>
                                    <div class="panel-actions">
                                        <button class="btn" data-action="edit-milestone">Edit</button>
                                        <button class="btn danger" data-action="delete-milestone">Remove</button>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </section>

                <section class="project-panel">
                    <div class="panel-header">
                        <h2>Shot List</h2>
                        <button class="btn" id="add-shot">Add Shot</button>
                    </div>
                    <div class="panel-list" id="shot-list">
                        <?php if (empty($shots)): ?>
                            <p class="empty-state">No shots yet.</p>
                        <?php else: ?>
                            <?php foreach ($shots as $shot): ?>
                                <div class="panel-item"
                                     data-id="<?php echo (int)$shot['id']; ?>"
                                     data-label="<?php echo htmlspecialchars($shot['shot_label'] ?? '', ENT_QUOTES); ?>"
                                     data-description="<?php echo htmlspecialchars($shot['description'] ?? '', ENT_QUOTES); ?>"
                                     data-location="<?php echo htmlspecialchars($shot['location'] ?? '', ENT_QUOTES); ?>"
                                     data-shot-type="<?php echo htmlspecialchars($shot['shot_type'] ?? '', ENT_QUOTES); ?>"
                                     data-status="<?php echo htmlspecialchars($shot['status'], ENT_QUOTES); ?>">
                                    <div>
                                        <strong><?php echo htmlspecialchars($shot['shot_label'] ?: 'Shot'); ?></strong>
                                        <div class="muted"><?php echo htmlspecialchars($shot['shot_type'] ?? ''); ?><?php echo $shot['shot_type'] ? ' | ' : ''; ?><?php echo htmlspecialchars($shot['status']); ?></div>
                                    </div>
                                    <div class="panel-actions">
                                        <button class="btn" data-action="edit-shot">Edit</button>
                                        <button class="btn danger" data-action="delete-shot">Remove</button>
                                    </div>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                </section>
            </div>
        </main>
    </div>
</div>

<div class="modal" id="project-modal" style="display:none;">
    <div class="modal-content">
        <h2 id="modal-title">Add</h2>
        <div class="form-group">
            <label id="modal-title-label">Title</label>
            <input type="text" id="modal-title-input">
        </div>
        <div class="form-group" id="modal-extra"></div>
        <div class="modal-actions">
            <button class="btn secondary-btn" id="modal-cancel">Cancel</button>
            <button class="btn primary-btn" id="modal-save">Save</button>
        </div>
    </div>
</div>

<script>
window.projectContext = { projectId: <?php echo (int)$project_id; ?> };
</script>
<script src="js/project.js"></script>
