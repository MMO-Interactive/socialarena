<?php
require_once 'db_connect.php';
require_once 'studio_access.php';
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

try {
    $userId = (int)$_SESSION['user_id'];

    $enforceSeriesAccessForSeason = function(int $seasonId) use ($pdo, $userId): void {
        $stmt = $pdo->prepare("
            SELECT s.created_by, s.studio_id, s.visibility
            FROM series_seasons ss
            JOIN series s ON ss.series_id = s.id
            WHERE ss.id = ?
        ");
        $stmt->execute([$seasonId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new Exception('Season not found');
        }
        enforceStudioItemAccess($pdo, (int)$row['created_by'], (int)$row['studio_id'], $row['visibility'], $userId, 'series', true);
    };

    $enforceSeriesAccessForEpisode = function(int $episodeId) use ($pdo, $userId): void {
        $stmt = $pdo->prepare("
            SELECT s.created_by, s.studio_id, s.visibility
            FROM series_episodes se
            JOIN series_seasons ss ON se.season_id = ss.id
            JOIN series s ON ss.series_id = s.id
            WHERE se.id = ?
        ");
        $stmt->execute([$episodeId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            throw new Exception('Episode not found');
        }
        enforceStudioItemAccess($pdo, (int)$row['created_by'], (int)$row['studio_id'], $row['visibility'], $userId, 'series', true);
    };

    switch ($action) {
        case 'add_season':
            $series_id = (int)($data['series_id'] ?? 0);
            if (!$series_id) {
                throw new Exception('Invalid series');
            }
            enforceSeriesAccess($pdo, $series_id, $userId, true);
            $stmt = $pdo->prepare("SELECT COALESCE(MAX(season_number), 0) FROM series_seasons WHERE series_id = ?");
            $stmt->execute([$series_id]);
            $next = (int)$stmt->fetchColumn() + 1;

            $stmt = $pdo->prepare("
                INSERT INTO series_seasons (series_id, title, season_number)
                VALUES (?, ?, ?)
            ");
            $stmt->execute([$series_id, 'Season ' . $next, $next]);
            echo json_encode(['success' => true]);
            break;

        case 'add_episode':
            $season_id = (int)($data['season_id'] ?? 0);
            if (!$season_id) {
                throw new Exception('Invalid season');
            }
            $enforceSeriesAccessForSeason($season_id);
            $stmt = $pdo->prepare("SELECT COALESCE(MAX(episode_number), 0) FROM series_episodes WHERE season_id = ?");
            $stmt->execute([$season_id]);
            $next = (int)$stmt->fetchColumn() + 1;

            $stmt = $pdo->prepare("
                INSERT INTO series_episodes (season_id, title, episode_number)
                VALUES (?, ?, ?)
            ");
            $stmt->execute([$season_id, 'Episode ' . $next, $next]);
            echo json_encode(['success' => true]);
            break;

        case 'update_season_title':
            $season_id = (int)($data['season_id'] ?? 0);
            $title = trim($data['title'] ?? '');
            if (!$season_id || $title === '') {
                throw new Exception('Invalid season');
            }
            $enforceSeriesAccessForSeason($season_id);
            $stmt = $pdo->prepare("
                UPDATE series_seasons ss
                JOIN series s ON ss.series_id = s.id
                SET ss.title = ?
                WHERE ss.id = ?
            ");
            $stmt->execute([$title, $season_id]);
            echo json_encode(['success' => true]);
            break;

        case 'update_episode_title':
            $episode_id = (int)($data['episode_id'] ?? 0);
            $title = trim($data['title'] ?? '');
            if (!$episode_id || $title === '') {
                throw new Exception('Invalid episode');
            }
            $enforceSeriesAccessForEpisode($episode_id);
            $stmt = $pdo->prepare("
                UPDATE series_episodes se
                JOIN series_seasons ss ON se.season_id = ss.id
                JOIN series s ON ss.series_id = s.id
                SET se.title = ?
                WHERE se.id = ?
            ");
            $stmt->execute([$title, $episode_id]);
            echo json_encode(['success' => true]);
            break;

        case 'assign_episode_story':
            $episode_id = (int)($data['episode_id'] ?? 0);
            $story_id = !empty($data['story_id']) ? (int)$data['story_id'] : null;
            if (!$episode_id) {
                throw new Exception('Invalid episode');
            }
            $enforceSeriesAccessForEpisode($episode_id);
            $stmt = $pdo->prepare("
                UPDATE series_episodes se
                JOIN series_seasons ss ON se.season_id = ss.id
                JOIN series s ON ss.series_id = s.id
                SET se.story_id = ?
                WHERE se.id = ?
            ");
            $stmt->execute([$story_id, $episode_id]);
            echo json_encode(['success' => true]);
            break;

        case 'update_story_order':
            $order = $data['order'] ?? [];
            if (!is_array($order) || empty($order)) {
                throw new Exception('Invalid order');
            }

            $stmt = $pdo->prepare("
                UPDATE stories s
                JOIN series se ON s.series_id = se.id
                SET s.story_order = ?
                WHERE s.id = ?
            ");

            $position = 1;
            foreach ($order as $storyId) {
                $storyId = (int)$storyId;
                $row = enforceStoryAccess($pdo, $storyId, $userId, true);
                $stmt->execute([$position, $storyId]);
                $position++;
            }

            echo json_encode(['success' => true]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
