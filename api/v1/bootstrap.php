<?php

declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('html_errors', '0');

function api_get_bearer_token(): ?string
{
    $editorSessionHeader = $_SERVER['HTTP_X_EDITOR_SESSION'] ?? '';
    if ($editorSessionHeader !== '') {
        return trim($editorSessionHeader);
    }

    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if (preg_match('/Bearer\s+(.+)/i', $header, $matches)) {
        return trim($matches[1]);
    }

    return null;
}

$apiBearerToken = api_get_bearer_token();
if ($apiBearerToken !== null && session_status() !== PHP_SESSION_ACTIVE) {
    session_id($apiBearerToken);
}

require_once dirname(__DIR__, 2) . '/includes/db_connect.php';

header('Content-Type: application/json');

function api_json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES);
    exit;
}

function api_success(array $payload = [], int $status = 200): void
{
    api_json_response($payload, $status);
}

function api_error(string $code, string $message, int $status = 400): void
{
    api_json_response([
        'success' => false,
        'error' => [
            'code' => $code,
            'message' => $message,
        ],
    ], $status);
}

set_exception_handler(static function (Throwable $exception): void {
    error_log('[editor-api] ' . $exception->getMessage() . ' in ' . $exception->getFile() . ':' . $exception->getLine());
    api_error('INTERNAL_SERVER_ERROR', 'The API could not complete the request.', 500);
});

function api_request_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        api_error('INVALID_JSON', 'Request body must be valid JSON.', 400);
    }

    return $decoded;
}

function api_current_user_id(): ?int
{
    return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
}

function api_require_auth(): int
{
    $userId = api_current_user_id();
    if ($userId === null) {
        api_error('UNAUTHENTICATED', 'Authentication is required.', 401);
    }

    return $userId;
}

function api_require_method(string $expectedMethod): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== strtoupper($expectedMethod)) {
        api_error('METHOD_NOT_ALLOWED', 'Unsupported HTTP method.', 405);
    }
}

function api_route_segments(): array
{
    $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    $basePath = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
    if ($basePath !== '/' && str_starts_with($uriPath, $basePath)) {
        $uriPath = substr($uriPath, strlen($basePath));
    }

    return array_values(array_filter(explode('/', trim($uriPath, '/')), 'strlen'));
}

function api_session_expiry_iso(): string
{
    $ttl = (int) ini_get('session.gc_maxlifetime');
    if ($ttl <= 0) {
        $ttl = 86400;
    }

    return gmdate('c', time() + $ttl);
}

function api_list_user_studios(PDO $pdo, int $userId): array
{
    $studios = [];

    if (api_table_exists($pdo, 'studio_members') && api_table_exists($pdo, 'studios')) {
        $studioStmt = $pdo->prepare(
            "SELECT s.id, s.name, sm.role
            FROM studio_members sm
            INNER JOIN studios s ON sm.studio_id = s.id
            WHERE sm.user_id = ?
            ORDER BY s.name ASC"
        );
        $studioStmt->execute([$userId]);
        foreach ($studioStmt->fetchAll() as $row) {
            $studios[] = [
                'id' => (int) $row['id'],
                'name' => $row['name'] ?: ('Studio ' . $row['id']),
                'role' => ucfirst((string) ($row['role'] ?? 'member')),
            ];
        }
    }

    return $studios;
}

function api_resolve_current_studio_id(array $studios, $requestedStudioId): ?int
{
    if ($requestedStudioId !== null && $requestedStudioId !== '') {
        $requested = (int) $requestedStudioId;
        foreach ($studios as $studio) {
            if ((int) ($studio['id'] ?? 0) === $requested) {
                return $requested;
            }
        }
    }

    if ($studios) {
        return (int) $studios[0]['id'];
    }

    return null;
}

function api_current_studio_id(): ?int
{
    return isset($_SESSION['current_studio_id']) && $_SESSION['current_studio_id'] !== null && $_SESSION['current_studio_id'] !== ''
        ? (int) $_SESSION['current_studio_id']
        : null;
}

function api_set_current_studio_id(?int $studioId): void
{
    $_SESSION['current_studio_id'] = $studioId;
}

function api_user_has_studio_access(PDO $pdo, int $userId, int $studioId): bool
{
    foreach (api_list_user_studios($pdo, $userId) as $studio) {
        if ((int) ($studio['id'] ?? 0) === $studioId) {
            return true;
        }
    }

    return false;
}

function api_require_studio_membership(PDO $pdo, int $userId, int $studioId): void
{
    if (!api_user_has_studio_access($pdo, $userId, $studioId)) {
        api_error('STUDIO_FORBIDDEN', 'You do not have access to the requested studio.', 403);
    }
}

function api_error_resource_not_in_studio(string $resourceLabel = 'resource'): void
{
    api_error(
        'RESOURCE_NOT_IN_STUDIO',
        sprintf('The requested %s is not available in the current studio.', $resourceLabel),
        404
    );
}

function api_require_project_in_scope(PDO $pdo, int $userId, string $type, int $projectId, ?string $resourceLabel = null): array
{
    $project = api_find_project($pdo, $userId, $type, $projectId);
    if ($project) {
        return $project;
    }

    if (api_current_studio_id() !== null) {
        api_error_resource_not_in_studio($resourceLabel ?: 'project');
    }

    api_error(
        'PROJECT_NOT_FOUND',
        sprintf('Requested %s could not be found.', $resourceLabel ?: 'project'),
        404
    );
}

function api_require_series_in_scope(PDO $pdo, int $userId, int $projectId): array
{
    return api_require_project_in_scope($pdo, $userId, 'series', $projectId, 'series');
}

function api_resolve_effective_studio_id(PDO $pdo, int $userId, array $options = []): ?int
{
    $allowNull = !empty($options['allow_null']);
    $requestedStudioId = $options['requested_studio_id'] ?? null;

    if ($requestedStudioId !== null && $requestedStudioId !== '') {
        $studioId = (int) $requestedStudioId;
        api_require_studio_membership($pdo, $userId, $studioId);
        api_set_current_studio_id($studioId);
        return $studioId;
    }

    $currentStudioId = api_current_studio_id();
    if ($currentStudioId !== null) {
        api_require_studio_membership($pdo, $userId, $currentStudioId);
        return $currentStudioId;
    }

    $studios = api_list_user_studios($pdo, $userId);
    if ($studios) {
        $resolved = (int) $studios[0]['id'];
        api_set_current_studio_id($resolved);
        return $resolved;
    }

    if ($allowNull) {
        return null;
    }

    api_error('STUDIO_REQUIRED', 'Select a studio before continuing.', 409);
}

function api_table_exists(PDO $pdo, string $tableName): bool
{
    static $cache = [];
    $key = strtolower($tableName);
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
        FROM information_schema.tables
        WHERE table_schema = DATABASE() AND table_name = ?"
    );
    $stmt->execute([$tableName]);
    $cache[$key] = (bool) $stmt->fetchColumn();

    return $cache[$key];
}

function api_column_exists(PDO $pdo, string $tableName, string $columnName): bool
{
    static $cache = [];
    $key = strtolower($tableName . '.' . $columnName);
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?"
    );
    $stmt->execute([$tableName, $columnName]);
    $cache[$key] = (bool) $stmt->fetchColumn();

    return $cache[$key];
}

function api_enum_allows_value(PDO $pdo, string $tableName, string $columnName, string $value): bool
{
    static $cache = [];
    $key = strtolower($tableName . '.' . $columnName . '.' . $value);
    if (array_key_exists($key, $cache)) {
        return $cache[$key];
    }

    $stmt = $pdo->prepare(
        "SELECT COLUMN_TYPE
        FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?
        LIMIT 1"
    );
    $stmt->execute([$tableName, $columnName]);
    $columnType = (string) ($stmt->fetchColumn() ?: '');
    $cache[$key] = stripos($columnType, "'" . $value . "'") !== false;

    return $cache[$key];
}

function api_ensure_project_type_enum_support(PDO $pdo, string $tableName, array $values): void
{
    if (!api_table_exists($pdo, $tableName) || !api_column_exists($pdo, $tableName, 'project_type')) {
        return;
    }

    foreach ($values as $value) {
        if (!api_enum_allows_value($pdo, $tableName, 'project_type', $value)) {
            $enumValues = implode(', ', array_map(static fn(string $entry): string => "'" . $entry . "'", $values));
            $pdo->exec("ALTER TABLE {$tableName} MODIFY COLUMN project_type ENUM({$enumValues}) NOT NULL");
            break;
        }
    }
}

function api_allowed_editor_project_types(): array
{
    return ['film', 'episode', 'series'];
}

function api_find_project(PDO $pdo, int $userId, string $type, int $id): ?array
{
    $allowedTypes = api_allowed_editor_project_types();
    if (!in_array($type, $allowedTypes, true)) {
        return null;
    }

    if ($type === 'series') {
        $stmt = $pdo->prepare(
            "SELECT
                s.id,
                'series' AS type,
                s.title,
                s.description,
                s.studio_id,
                NULL AS story_id,
                NULL AS episode_id,
                s.status,
                s.updated_at,
                NULL AS season_id,
                s.id AS series_id
            FROM series s
            LEFT JOIN studio_members sm ON sm.studio_id = s.studio_id AND sm.user_id = ?
            WHERE s.id = ?
              AND (s.created_by = ? OR s.user_id = ? OR sm.user_id IS NOT NULL)
            LIMIT 1"
        );
        $stmt->execute([$userId, $id, $userId, $userId]);
        $project = $stmt->fetch();

        $currentStudioId = api_current_studio_id();
        if ($project && $currentStudioId !== null) {
            if ((int) ($project['studio_id'] ?? 0) !== $currentStudioId) {
                return null;
            }
        }

        return $project ?: null;
    }

    $stmt = $pdo->prepare(
        "SELECT
            p.id,
            p.project_type AS type,
            p.title,
            p.description,
            COALESCE(p.studio_id, st.studio_id) AS studio_id,
            p.story_id,
            p.episode_id,
            p.status,
            p.updated_at,
            e.season_id,
            sse.series_id
        FROM projects p
        LEFT JOIN stories st ON p.story_id = st.id
        LEFT JOIN series_episodes e ON p.episode_id = e.id
        LEFT JOIN series_seasons sse ON e.season_id = sse.id
        WHERE p.user_id = ? AND p.project_type = ? AND p.id = ?
        LIMIT 1"
    );
    $stmt->execute([$userId, $type, $id]);
    $project = $stmt->fetch();

    $currentStudioId = api_current_studio_id();
    if ($project && $currentStudioId !== null) {
        if ((int) ($project['studio_id'] ?? 0) !== $currentStudioId) {
            return null;
        }
    }

    return $project ?: null;
}

function api_project_story_id(array $project): ?int
{
    if (!empty($project['story_id'])) {
        return (int) $project['story_id'];
    }

    return null;
}

function api_series_outline(PDO $pdo, int $seriesId): array
{
    if (!api_table_exists($pdo, 'series_seasons') || !api_table_exists($pdo, 'series_episodes')) {
        return [
            'season_count' => 0,
            'episode_count' => 0,
            'seasons' => [],
        ];
    }

    $seasonStmt = $pdo->prepare(
        "SELECT id, title, season_number, description, created_at, updated_at
        FROM series_seasons
        WHERE series_id = ?
        ORDER BY season_number ASC, id ASC"
    );
    $seasonStmt->execute([$seriesId]);
    $seasons = [];
    $episodeCount = 0;
    $firstSeasonId = null;
    $firstEpisodeId = null;
    $entryProjectStmt = $pdo->prepare(
        "SELECT id, title, status, updated_at
        FROM projects
        WHERE episode_id = ?
        ORDER BY id ASC
        LIMIT 1"
    );

    foreach ($seasonStmt->fetchAll(PDO::FETCH_ASSOC) as $seasonRow) {
        if ($firstSeasonId === null) {
            $firstSeasonId = (int) $seasonRow['id'];
        }
        $episodeStmt = $pdo->prepare(
            "SELECT id, title, episode_number, description, story_id, created_at, updated_at
            FROM series_episodes
            WHERE season_id = ?
            ORDER BY episode_number ASC, id ASC"
        );
        $episodeStmt->execute([(int) $seasonRow['id']]);
        $episodes = [];
        foreach ($episodeStmt->fetchAll(PDO::FETCH_ASSOC) as $episodeRow) {
            if ($firstEpisodeId === null) {
                $firstEpisodeId = (int) $episodeRow['id'];
            }
            $entryProjectStmt->execute([(int) $episodeRow['id']]);
            $entryProject = $entryProjectStmt->fetch(PDO::FETCH_ASSOC) ?: null;
            $episodes[] = [
                'id' => (int) $episodeRow['id'],
                'title' => $episodeRow['title'],
                'episode_number' => (int) $episodeRow['episode_number'],
                'description' => $episodeRow['description'],
                'story_id' => $episodeRow['story_id'] !== null ? (int) $episodeRow['story_id'] : null,
                'entry_project_id' => $entryProject && isset($entryProject['id']) ? (int) $entryProject['id'] : null,
                'entry_project_title' => $entryProject['title'] ?? null,
                'entry_project_status' => $entryProject['status'] ?? null,
                'entry_project_updated_at' => $entryProject['updated_at'] ?? null,
                'created_at' => $episodeRow['created_at'],
                'updated_at' => $episodeRow['updated_at'],
            ];
        }
        $episodeCount += count($episodes);

        $seasons[] = [
            'id' => (int) $seasonRow['id'],
            'title' => $seasonRow['title'],
            'season_number' => (int) $seasonRow['season_number'],
            'description' => $seasonRow['description'],
            'created_at' => $seasonRow['created_at'],
            'updated_at' => $seasonRow['updated_at'],
            'episodes' => $episodes,
        ];
    }

    return [
        'season_count' => count($seasons),
        'episode_count' => $episodeCount,
        'first_season_id' => $firstSeasonId,
        'first_episode_id' => $firstEpisodeId,
        'seasons' => $seasons,
    ];
}

function api_create_series_season(PDO $pdo, int $userId, array $seriesProject, array $data): array
{
    if (($seriesProject['type'] ?? '') !== 'series' || empty($seriesProject['series_id'])) {
        api_error('INVALID_SERIES_PROJECT', 'A valid series container is required.', 400);
    }

    $seriesId = (int) $seriesProject['series_id'];
    $studioId = $seriesProject['studio_id'] !== null ? (int) $seriesProject['studio_id'] : null;
    $visibility = trim((string) ($data['visibility'] ?? 'private')) ?: 'private';

    $seasonTitle = trim((string) ($data['title'] ?? ''));
    $seasonDescription = trim((string) ($data['description'] ?? ''));

    $nextSeasonStmt = $pdo->prepare(
        "SELECT COALESCE(MAX(season_number), 0) + 1 FROM series_seasons WHERE series_id = ?"
    );
    $nextSeasonStmt->execute([$seriesId]);
    $seasonNumber = (int) $nextSeasonStmt->fetchColumn();
    if ($seasonNumber <= 0) {
        $seasonNumber = 1;
    }

    if ($seasonTitle === '') {
        $seasonTitle = 'Season ' . $seasonNumber;
    }

    $stmt = $pdo->prepare(
        'INSERT INTO series_seasons (series_id, studio_id, title, season_number, description, visibility)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $seriesId,
        $studioId,
        $seasonTitle,
        $seasonNumber,
        $seasonDescription !== '' ? $seasonDescription : null,
        $visibility,
    ]);

    $seasonId = (int) $pdo->lastInsertId();
    $outline = api_series_outline($pdo, $seriesId);

    return [
        'season' => [
            'id' => $seasonId,
            'title' => $seasonTitle,
            'season_number' => $seasonNumber,
            'description' => $seasonDescription,
        ],
        'series_outline' => $outline,
    ];
}

function api_create_series_episode(PDO $pdo, int $userId, array $seriesProject, array $data): array
{
    if (($seriesProject['type'] ?? '') !== 'series' || empty($seriesProject['series_id'])) {
        api_error('INVALID_SERIES_PROJECT', 'A valid series container is required.', 400);
    }

    $seriesId = (int) $seriesProject['series_id'];
    $studioId = $seriesProject['studio_id'] !== null ? (int) $seriesProject['studio_id'] : null;
    $visibility = trim((string) ($data['visibility'] ?? 'private')) ?: 'private';
    $episodeTitle = trim((string) ($data['title'] ?? ''));
    $episodeDescription = trim((string) ($data['description'] ?? ''));
    $seasonId = isset($data['season_id']) ? (int) $data['season_id'] : 0;

    if ($seasonId <= 0) {
        $seasonLookupStmt = $pdo->prepare(
            "SELECT id
             FROM series_seasons
             WHERE series_id = ?
             ORDER BY season_number DESC, id DESC
             LIMIT 1"
        );
        $seasonLookupStmt->execute([$seriesId]);
        $seasonId = (int) ($seasonLookupStmt->fetchColumn() ?: 0);
    }

    if ($seasonId <= 0) {
        $createdSeason = api_create_series_season($pdo, $userId, $seriesProject, [
            'title' => 'Season 1',
            'description' => '',
            'visibility' => $visibility,
        ]);
        $seasonId = (int) ($createdSeason['season']['id'] ?? 0);
    }

    $seasonProjectStmt = $pdo->prepare(
        "SELECT title, season_number
         FROM series_seasons
         WHERE id = ? AND series_id = ?
         LIMIT 1"
    );
    $seasonProjectStmt->execute([$seasonId, $seriesId]);
    $seasonRow = $seasonProjectStmt->fetch(PDO::FETCH_ASSOC);
    if (!$seasonRow) {
        api_error('SEASON_NOT_FOUND', 'The requested season could not be found.', 404);
    }

    $nextEpisodeStmt = $pdo->prepare(
        "SELECT COALESCE(MAX(episode_number), 0) + 1 FROM series_episodes WHERE season_id = ?"
    );
    $nextEpisodeStmt->execute([$seasonId]);
    $episodeNumber = (int) $nextEpisodeStmt->fetchColumn();
    if ($episodeNumber <= 0) {
        $episodeNumber = 1;
    }

    if ($episodeTitle === '') {
        $episodeTitle = 'Episode ' . $episodeNumber;
    }

    $storyTitle = $seriesProject['title'] . ' - ' . $episodeTitle;

    $pdo->beginTransaction();
    try {
        $storyStmt = $pdo->prepare(
            'INSERT INTO stories (title, genre, setting, description, story_type, status, user_id, studio_id, series_id, visibility, created_by, last_modified_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $storyStmt->execute([
            $storyTitle,
            'Fantasy',
            'Undisclosed Setting',
            $episodeDescription !== '' ? $episodeDescription : ('Episode scaffold for ' . $storyTitle),
            'series_episode',
            'draft',
            $userId,
            $studioId,
            $seriesId,
            $visibility,
            $userId,
            $userId,
        ]);
        $storyId = (int) $pdo->lastInsertId();

        $episodeStmt = $pdo->prepare(
            'INSERT INTO series_episodes (season_id, studio_id, title, episode_number, description, story_id, visibility)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $episodeStmt->execute([
            $seasonId,
            $studioId,
            $episodeTitle,
            $episodeNumber,
            $episodeDescription !== '' ? $episodeDescription : null,
            $storyId,
            $visibility,
        ]);
        $episodeId = (int) $pdo->lastInsertId();

        $projectStmt = $pdo->prepare(
            'INSERT INTO projects (user_id, studio_id, project_type, story_id, episode_id, title, description, visibility, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $projectStmt->execute([
            $userId,
            $studioId,
            'episode',
            $storyId,
            $episodeId,
            $storyTitle,
            $episodeDescription !== '' ? $episodeDescription : ('Editor project for ' . $storyTitle),
            $visibility,
            'planning',
        ]);
        $entryProjectId = (int) $pdo->lastInsertId();

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }

    $outline = api_series_outline($pdo, $seriesId);

    return [
        'season' => [
            'id' => $seasonId,
            'title' => $seasonRow['title'],
            'season_number' => (int) $seasonRow['season_number'],
        ],
        'episode' => [
            'id' => $episodeId,
            'title' => $episodeTitle,
            'episode_number' => $episodeNumber,
            'description' => $episodeDescription,
            'story_id' => $storyId,
            'entry_project_id' => $entryProjectId,
        ],
        'series_outline' => $outline,
    ];
}

function api_count_project_clips(PDO $pdo, ?int $storyId): int
{
    if (!$storyId) {
        return 0;
    }

    $stmt = $pdo->prepare(
        "SELECT COUNT(*)
        FROM story_scene_clips c
        INNER JOIN story_scenes sc ON c.scene_id = sc.id
        INNER JOIN story_chapters ch ON sc.chapter_id = ch.id
        INNER JOIN story_acts a ON ch.act_id = a.id
        WHERE a.story_id = ?"
    );
    $stmt->execute([$storyId]);

    return (int) $stmt->fetchColumn();
}

function api_list_editor_projects(PDO $pdo, int $userId, array $filters): array
{
    if (!array_key_exists('studio_id', $filters)) {
        $filters['studio_id'] = api_current_studio_id();
    }

    $where = ['p.user_id = ?'];
    $params = [$userId];

    if (!empty($filters['type']) && in_array($filters['type'], ['film', 'episode'], true)) {
        $where[] = 'p.project_type = ?';
        $params[] = $filters['type'];
    }

    if (!empty($filters['studio_id'])) {
        $where[] = 'COALESCE(p.studio_id, st.studio_id) = ?';
        $params[] = (int) $filters['studio_id'];
    }

    if (!empty($filters['status'])) {
        $where[] = 'p.status = ?';
        $params[] = $filters['status'];
    }

    $sql = "SELECT
            p.id,
            p.project_type AS type,
            p.title,
            p.description,
            COALESCE(p.studio_id, st.studio_id) AS studio_id,
            p.story_id,
            p.status,
            p.updated_at,
            e.id AS episode_id,
            e.season_id,
            sse.series_id
        FROM projects p
        LEFT JOIN stories st ON p.story_id = st.id
        LEFT JOIN series_episodes e ON p.episode_id = e.id
        LEFT JOIN series_seasons sse ON e.season_id = sse.id
        WHERE " . implode(' AND ', $where) . "
        ORDER BY p.updated_at DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $projects = [];

    foreach ($stmt->fetchAll() as $row) {
        $projects[] = [
            'id' => (int) $row['id'],
            'type' => $row['type'],
            'title' => $row['title'],
            'description' => $row['description'],
            'studio_id' => $row['studio_id'] !== null ? (int) $row['studio_id'] : null,
            'series_id' => $row['series_id'] !== null ? (int) $row['series_id'] : null,
            'season_id' => $row['season_id'] !== null ? (int) $row['season_id'] : null,
            'clip_count' => api_count_project_clips($pdo, api_project_story_id($row)),
            'status' => $row['status'],
            'updated_at' => $row['updated_at'],
        ];
    }

    $includeSeries = empty($filters['type']) || $filters['type'] === 'series';
    if ($includeSeries && api_table_exists($pdo, 'series')) {
        $seriesWhere = ['(s.created_by = ? OR s.user_id = ? OR sm.user_id IS NOT NULL)'];
        $seriesParams = [$userId, $userId, $userId];

        if (!empty($filters['studio_id'])) {
            $seriesWhere[] = 's.studio_id = ?';
            $seriesParams[] = (int) $filters['studio_id'];
        }

        if (!empty($filters['status'])) {
            $seriesWhere[] = 's.status = ?';
            $seriesParams[] = $filters['status'];
        }

        $seriesStmt = $pdo->prepare(
            "SELECT
                s.id,
                'series' AS type,
                s.title,
                s.description,
                s.studio_id,
                s.status,
                s.updated_at,
                s.id AS series_id
            FROM series s
            LEFT JOIN studio_members sm ON sm.studio_id = s.studio_id AND sm.user_id = ?
            WHERE " . implode(' AND ', $seriesWhere) . "
            ORDER BY s.updated_at DESC"
        );
        $seriesStmt->execute($seriesParams);

        foreach ($seriesStmt->fetchAll() as $row) {
            $outline = api_series_outline($pdo, (int) $row['series_id']);
            $entryProjectId = null;
            if (!empty($outline['first_episode_id'])) {
                $entryStmt = $pdo->prepare(
                    "SELECT id
                    FROM projects
                    WHERE user_id = ? AND project_type = 'episode' AND episode_id = ?
                    ORDER BY id ASC
                    LIMIT 1"
                );
                $entryStmt->execute([$userId, (int) $outline['first_episode_id']]);
                $entryProjectId = $entryStmt->fetchColumn();
            }
            $projects[] = [
                'id' => (int) $row['id'],
                'type' => 'series',
                'title' => $row['title'],
                'description' => $row['description'],
                'studio_id' => $row['studio_id'] !== null ? (int) $row['studio_id'] : null,
                'series_id' => (int) $row['series_id'],
                'season_id' => $outline['first_season_id'] !== null ? (int) $outline['first_season_id'] : null,
                'episode_id' => $outline['first_episode_id'] !== null ? (int) $outline['first_episode_id'] : null,
                'entry_project_id' => $entryProjectId !== false && $entryProjectId !== null ? (int) $entryProjectId : null,
                'clip_count' => 0,
                'season_count' => (int) ($outline['season_count'] ?? 0),
                'episode_count' => (int) ($outline['episode_count'] ?? 0),
                'status' => $row['status'],
                'updated_at' => $row['updated_at'],
            ];
        }
    }

    usort(
        $projects,
        static fn(array $left, array $right): int => strcmp((string) ($right['updated_at'] ?? ''), (string) ($left['updated_at'] ?? ''))
    );

    return $projects;
}

function api_dashboard_summary(PDO $pdo, int $userId, ?int $studioId = null): array
{
    $effectiveStudioId = $studioId !== null ? $studioId : api_current_studio_id();
    $projects = api_list_editor_projects($pdo, $userId, ['studio_id' => $effectiveStudioId]);
    $studios = [];

    foreach (api_list_user_studios($pdo, $userId) as $studio) {
        if ($effectiveStudioId !== null && (int) $studio['id'] !== $effectiveStudioId) {
            continue;
        }
        $studios['studio-' . $studio['id']] = $studio + ['project_count' => 0];
    }

    foreach ($projects as $project) {
        if ($project['studio_id'] === null) {
            $key = 'personal';
            if (!isset($studios[$key])) {
                $studios[$key] = [
                    'id' => null,
                    'name' => 'Personal Studio',
                    'role' => 'Owner workspace',
                    'project_count' => 0,
                ];
            }
            $studios[$key]['project_count']++;
        } elseif (!isset($studios['studio-' . $project['studio_id']])) {
            $studios['studio-' . $project['studio_id']] = [
                'id' => (int) $project['studio_id'],
                'name' => 'Studio ' . $project['studio_id'],
                'role' => 'Member',
                'project_count' => 1,
            ];
        }
    }

    if (!$studios) {
        $studios['personal'] = [
            'id' => null,
            'name' => 'Personal Studio',
            'role' => 'Owner workspace',
            'project_count' => 0,
        ];
    }

    $recentProjects = array_slice($projects, 0, 6);
    $upcomingTasks = [];

    if (api_table_exists($pdo, 'project_tasks')) {
        $taskStmt = $pdo->prepare(
            "SELECT
                t.id,
                t.title,
                t.status,
                t.priority,
                t.due_date,
                p.id AS project_id,
                p.project_type,
                p.title AS project_title
            FROM project_tasks t
            INNER JOIN projects p ON t.project_id = p.id
            WHERE p.user_id = ? AND t.status <> 'done'
            ORDER BY
                CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                t.due_date IS NULL,
                t.due_date ASC,
                t.updated_at DESC
            LIMIT 6"
        );
        $taskStmt->execute([$userId]);
        foreach ($taskStmt->fetchAll() as $row) {
            $detail = trim(
                sprintf(
                    '%s priority%s',
                    ucfirst((string) $row['priority']),
                    !empty($row['due_date']) ? ' · due ' . $row['due_date'] : ''
                )
            );
            $upcomingTasks[] = [
                'id' => 'task-' . $row['id'],
                'title' => $row['title'],
                'detail' => $detail,
                'kind' => 'continue_project',
                'project_id' => (int) $row['project_id'],
                'project_type' => $row['project_type'],
                'tone' => $row['priority'] === 'high' ? 'accent' : 'neutral',
            ];
        }
    }

    foreach (array_slice($projects, 0, 4) as $project) {
        $upcomingTasks[] = [
            'id' => 'continue-' . $project['type'] . '-' . $project['id'],
            'title' => 'Continue ' . $project['title'],
            'detail' => ($project['clip_count'] ?? 0) . ' clips ready in ' . $project['type'],
            'kind' => 'continue_project',
            'project_id' => $project['id'],
            'project_type' => $project['type'],
            'tone' => count($upcomingTasks) === 0 ? 'accent' : 'neutral',
        ];
    }

    $upcomingTasks[] = [
        'id' => 'review-platform-projects',
        'title' => 'Review platform projects',
        'detail' => count($projects) . ' project' . (count($projects) === 1 ? '' : 's') . ' available for import and sync',
        'kind' => 'browse_platform',
        'tone' => 'neutral',
    ];

    $queuedExports = 0;
    if (api_table_exists($pdo, 'editor_exports')) {
        $exportStmt = $pdo->prepare(
            "SELECT COUNT(*)
            FROM editor_exports
            WHERE user_id = ? AND status IN ('initialized', 'queued', 'rendering', 'processing')"
        );
        $exportStmt->execute([$userId]);
        $queuedExports = (int) $exportStmt->fetchColumn();
    }

    $upcomingTasks[] = [
        'id' => 'check-job-queue',
        'title' => 'Check generation queue',
        'detail' => $queuedExports > 0
            ? $queuedExports . ' export job' . ($queuedExports === 1 ? '' : 's') . ' queued or rendering'
            : 'Review pending renders, sync work, and exports',
        'kind' => 'jobs',
        'tone' => 'neutral',
    ];

    $openTaskCount = 0;
    foreach ($upcomingTasks as $task) {
        if (str_starts_with((string) $task['id'], 'task-')) {
            $openTaskCount++;
        }
    }

    return [
        'studios' => array_values($studios),
        'recent_projects' => $recentProjects,
        'upcoming_tasks' => array_slice($upcomingTasks, 0, 6),
        'stats' => [
            'project_count' => count($projects),
            'studio_count' => count($studios),
            'active_project' => $recentProjects[0]['title'] ?? null,
            'open_tasks' => $openTaskCount,
            'platform_sync' => 'Ready',
            'queued_exports' => $queuedExports,
        ],
    ];
}

function api_create_editor_project(PDO $pdo, int $userId, array $data): array
{
    $projectType = (string) ($data['project_type'] ?? '');
    if (!in_array($projectType, api_allowed_editor_project_types(), true)) {
        api_error('INVALID_PROJECT_TYPE', 'Project type must be film, episode, or series.', 400);
    }

    $title = trim((string) ($data['title'] ?? ''));
    if ($title === '') {
        api_error('INVALID_TITLE', 'Project title is required.', 400);
    }

    $description = trim((string) ($data['description'] ?? ''));
    $studioId = isset($data['studio_id']) && $data['studio_id'] !== null && $data['studio_id'] !== ''
        ? (int) $data['studio_id']
        : api_current_studio_id();
    if ($studioId !== null) {
        api_require_studio_membership($pdo, $userId, $studioId);
    }
    $visibility = in_array((string) ($data['visibility'] ?? 'private'), ['private', 'studio', 'public'], true)
        ? (string) $data['visibility']
        : 'private';
    $genre = trim((string) ($data['genre'] ?? 'Fantasy'));
    $setting = trim((string) ($data['setting'] ?? 'Undisclosed Setting'));
    $storyDescription = trim((string) ($data['story_description'] ?? $description));

    if ($projectType === 'series') {
        $pdo->beginTransaction();

        try {
            $seriesStmt = $pdo->prepare(
                'INSERT INTO series (studio_id, title, description, created_by, user_id, visibility, status, last_modified_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $seriesStmt->execute([
                $studioId,
                $title,
                $description,
                $userId,
                $userId,
                $visibility,
                'planned',
                $userId,
            ]);
            $seriesId = (int) $pdo->lastInsertId();

            $seasonStmt = $pdo->prepare(
                'INSERT INTO series_seasons (series_id, studio_id, title, season_number, description, visibility)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            $seasonStmt->execute([
                $seriesId,
                $studioId,
                'Season 1',
                1,
                'Initial season scaffold for ' . $title,
                $visibility,
            ]);
            $seasonId = (int) $pdo->lastInsertId();

            $storyStmt = $pdo->prepare(
                'INSERT INTO stories (title, genre, setting, description, story_type, status, series_id, user_id, studio_id, visibility, created_by, last_modified_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $storyStmt->execute([
                $title . ' - Episode 1',
                $genre !== '' ? $genre : 'Fantasy',
                $setting !== '' ? $setting : 'Undisclosed Setting',
                $storyDescription !== '' ? $storyDescription : ('Pilot episode for ' . $title),
                'series_entry',
                'draft',
                $seriesId,
                $userId,
                $studioId,
                $visibility,
                $userId,
                $userId,
            ]);
            $storyId = (int) $pdo->lastInsertId();

            $episodeStmt = $pdo->prepare(
                'INSERT INTO series_episodes (season_id, studio_id, title, episode_number, description, story_id, visibility)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            $episodeStmt->execute([
                $seasonId,
                $studioId,
                'Episode 1',
                1,
                'Initial episode scaffold for ' . $title,
                $storyId,
                $visibility,
            ]);
            $episodeId = (int) $pdo->lastInsertId();

            $projectStmt = $pdo->prepare(
                'INSERT INTO projects (user_id, studio_id, project_type, story_id, episode_id, title, description, visibility, status)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $projectStmt->execute([
                $userId,
                $studioId,
                'episode',
                $storyId,
                $episodeId,
                $title . ' - Episode 1',
                'Initial editor project scaffold for ' . $title,
                $visibility,
                'planning',
            ]);
            $entryProjectId = (int) $pdo->lastInsertId();

            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $exception;
        }

        $project = api_find_project($pdo, $userId, 'series', $seriesId);
        if (!$project) {
            api_error('PROJECT_CREATE_FAILED', 'The platform series could not be created.', 500);
        }

        $outline = api_series_outline($pdo, $seriesId);

        return [
            'id' => (int) $project['id'],
            'type' => $project['type'],
            'title' => $project['title'],
            'description' => $project['description'],
            'studio_id' => $project['studio_id'] !== null ? (int) $project['studio_id'] : null,
            'story_id' => null,
            'episode_id' => $episodeId,
            'season_id' => $seasonId,
            'series_id' => (int) $project['series_id'],
            'entry_project_id' => $entryProjectId,
            'season_count' => (int) ($outline['season_count'] ?? 0),
            'episode_count' => (int) ($outline['episode_count'] ?? 0),
            'seasons' => $outline['seasons'] ?? [],
            'status' => $project['status'],
            'clip_count' => 0,
            'updated_at' => $project['updated_at'],
        ];
    }

    $pdo->beginTransaction();

    try {
        $storyStmt = $pdo->prepare(
            'INSERT INTO stories (title, genre, setting, description, story_type, status, user_id, studio_id, visibility, created_by, last_modified_by)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $storyStmt->execute([
            $title,
            $genre !== '' ? $genre : 'Fantasy',
            $setting !== '' ? $setting : 'Undisclosed Setting',
            $storyDescription,
            'standalone',
            'draft',
            $userId,
            $studioId,
            $visibility,
            $userId,
            $userId,
        ]);
        $storyId = (int) $pdo->lastInsertId();

        $projectStmt = $pdo->prepare(
            'INSERT INTO projects (user_id, studio_id, project_type, story_id, title, description, visibility, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $projectStmt->execute([
            $userId,
            $studioId,
            $projectType,
            $storyId,
            $title,
            $description,
            $visibility,
            'planning',
        ]);
        $projectId = (int) $pdo->lastInsertId();

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }

    $project = api_find_project($pdo, $userId, $projectType, $projectId);
    if (!$project) {
        api_error('PROJECT_CREATE_FAILED', 'The platform project could not be created.', 500);
    }

    return [
        'id' => (int) $project['id'],
        'type' => $project['type'],
        'title' => $project['title'],
        'description' => $project['description'],
        'studio_id' => $project['studio_id'] !== null ? (int) $project['studio_id'] : null,
        'story_id' => $project['story_id'] !== null ? (int) $project['story_id'] : null,
        'episode_id' => $project['episode_id'] !== null ? (int) $project['episode_id'] : null,
        'status' => $project['status'],
        'clip_count' => 0,
        'updated_at' => $project['updated_at'],
    ];
}

function api_story_scenes(PDO $pdo, ?int $storyId): array
{
    if (!$storyId) {
        return [];
    }

    $stmt = $pdo->prepare(
        "SELECT sc.id, sc.title, sc.description, sc.scene_order
        FROM story_scenes sc
        INNER JOIN story_chapters ch ON sc.chapter_id = ch.id
        INNER JOIN story_acts a ON ch.act_id = a.id
        WHERE a.story_id = ?
        ORDER BY sc.scene_order ASC, sc.id ASC"
    );
    $stmt->execute([$storyId]);

    return array_map(
        static fn(array $scene): array => [
            'id' => (int) $scene['id'],
            'title' => $scene['title'],
            'description' => $scene['description'],
            'scene_order' => (int) $scene['scene_order'],
        ],
        $stmt->fetchAll()
    );
}

function api_story_clips(PDO $pdo, ?int $storyId): array
{
    if (!$storyId) {
        return [];
    }

    $hasClipVideoUrl = api_column_exists($pdo, 'story_scene_clips', 'clip_video_url');
    $selectClipVideo = $hasClipVideoUrl ? 'c.clip_video_url' : 'NULL AS clip_video_url';

    $stmt = $pdo->prepare(
        "SELECT c.id, c.scene_id, c.title, c.description, c.clip_order, c.clip_status, {$selectClipVideo}
        FROM story_scene_clips c
        INNER JOIN story_scenes sc ON c.scene_id = sc.id
        INNER JOIN story_chapters ch ON sc.chapter_id = ch.id
        INNER JOIN story_acts a ON ch.act_id = a.id
        WHERE a.story_id = ?
        ORDER BY sc.scene_order ASC, c.clip_order ASC, c.id ASC"
    );
    $stmt->execute([$storyId]);

    return array_map(
        static fn(array $clip): array => [
            'id' => (int) $clip['id'],
            'scene_id' => (int) $clip['scene_id'],
            'title' => $clip['title'],
            'description' => $clip['description'],
            'clip_order' => (int) $clip['clip_order'],
            'clip_status' => $clip['clip_status'],
            'clip_video_url' => $clip['clip_video_url'],
        ],
        $stmt->fetchAll()
    );
}

function api_project_assets(PDO $pdo, int $userId, array $project): array
{
    $storyId = api_project_story_id($project);
    $assets = [];
    $projectStudioId = isset($project['studio_id']) && $project['studio_id'] !== null ? (int) $project['studio_id'] : null;

    if ($storyId) {
        if (api_column_exists($pdo, 'story_scene_clips', 'clip_video_url')) {
            $videoStmt = $pdo->prepare(
                "SELECT
                    c.id,
                    c.title,
                    c.clip_video_url,
                    c.updated_at
                FROM story_scene_clips c
                INNER JOIN story_scenes sc ON c.scene_id = sc.id
                INNER JOIN story_chapters ch ON sc.chapter_id = ch.id
                INNER JOIN story_acts a ON ch.act_id = a.id
                WHERE a.story_id = ? AND c.clip_video_url IS NOT NULL AND c.clip_video_url <> ''
                ORDER BY c.updated_at DESC, c.id DESC"
            );
            $videoStmt->execute([$storyId]);
            foreach ($videoStmt->fetchAll() as $row) {
                $assets[] = [
                    'id' => 'clip-' . $row['id'],
                    'asset_type' => 'video',
                    'title' => $row['title'],
                    'source_type' => 'story_clip',
                    'source_id' => (int) $row['id'],
                    'url' => $row['clip_video_url'],
                    'thumbnail_url' => null,
                    'duration_seconds' => null,
                    'created_at' => $row['updated_at'],
                ];
            }
        }

        $imageStmt = $pdo->prepare(
            "SELECT
                b.id,
                c.id AS clip_id,
                c.title,
                b.image_url,
                b.updated_at
            FROM clip_blocks b
            INNER JOIN story_scene_clips c ON b.clip_id = c.id
            INNER JOIN story_scenes sc ON c.scene_id = sc.id
            INNER JOIN story_chapters ch ON sc.chapter_id = ch.id
            INNER JOIN story_acts a ON ch.act_id = a.id
            WHERE a.story_id = ? AND b.image_url IS NOT NULL AND b.image_url <> ''
            ORDER BY b.updated_at DESC, b.id DESC"
        );
        $imageStmt->execute([$storyId]);
        foreach ($imageStmt->fetchAll() as $row) {
            $assets[] = [
                'id' => 'image-' . $row['id'],
                'asset_type' => 'image',
                'title' => $row['title'] . ' Image',
                'source_type' => 'clip_block',
                'source_id' => (int) $row['id'],
                'url' => $row['image_url'],
                'thumbnail_url' => $row['image_url'],
                'duration_seconds' => null,
                'created_at' => $row['updated_at'],
            ];
        }
    }

    $audioSql = "SELECT id, title, file_url, cover_image_url, updated_at
        FROM studio_music_library";
    $audioParams = [];
    if ($projectStudioId !== null) {
        $audioSql .= " WHERE studio_id = ?";
        $audioParams[] = $projectStudioId;
    } else {
        $audioSql .= " WHERE user_id = ? AND (studio_id IS NULL OR studio_id = 0)";
        $audioParams[] = $userId;
    }
    $audioSql .= " ORDER BY updated_at DESC, id DESC";
    $audioStmt = $pdo->prepare($audioSql);
    $audioStmt->execute($audioParams);
    foreach ($audioStmt->fetchAll() as $row) {
        $assets[] = [
            'id' => 'audio-' . $row['id'],
            'asset_type' => 'audio',
            'title' => $row['title'],
            'source_type' => 'music_library',
            'source_id' => (int) $row['id'],
            'url' => $row['file_url'],
            'thumbnail_url' => $row['cover_image_url'],
            'duration_seconds' => null,
            'created_at' => $row['updated_at'],
        ];
    }

    return $assets;
}

function api_load_editor_timeline(PDO $pdo, int $userId, string $type, int $projectId): ?array
{
    if (!api_table_exists($pdo, 'editor_timeline_projects')) {
        return null;
    }

    api_ensure_project_type_enum_support($pdo, 'editor_timeline_projects', ['film', 'episode', 'series', 'clip']);

    $stmt = $pdo->prepare(
        "SELECT id, project_type, project_id, name, version, timeline_json, updated_at
        FROM editor_timeline_projects
        WHERE user_id = ? AND project_type = ? AND project_id = ?
        LIMIT 1"
    );
    $stmt->execute([$userId, $type, $projectId]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    return [
        'id' => (int) $row['id'],
        'project_type' => $row['project_type'],
        'project_id' => (int) $row['project_id'],
        'name' => $row['name'],
        'version' => (int) $row['version'],
        'timeline_json' => json_decode($row['timeline_json'], true) ?: new stdClass(),
        'updated_at' => $row['updated_at'],
    ];
}

function api_find_editor_timeline_by_id(PDO $pdo, int $userId, int $timelineProjectId): ?array
{
    if (!api_table_exists($pdo, 'editor_timeline_projects')) {
        return null;
    }

    api_ensure_project_type_enum_support($pdo, 'editor_timeline_projects', ['film', 'episode', 'series', 'clip']);

    $stmt = $pdo->prepare(
        "SELECT id, project_type, project_id, name, version, timeline_json, updated_at
        FROM editor_timeline_projects
        WHERE id = ? AND user_id = ?
        LIMIT 1"
    );
    $stmt->execute([$timelineProjectId, $userId]);
    $row = $stmt->fetch();

    if (!$row) {
        return null;
    }

    return [
        'id' => (int) $row['id'],
        'project_type' => $row['project_type'],
        'project_id' => (int) $row['project_id'],
        'name' => $row['name'],
        'version' => (int) $row['version'],
        'timeline_json' => json_decode($row['timeline_json'], true) ?: new stdClass(),
        'updated_at' => $row['updated_at'],
    ];
}

function api_ensure_project_idea_board_table(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS editor_project_idea_boards (
            id INT PRIMARY KEY AUTO_INCREMENT,
            user_id INT NOT NULL,
            project_type ENUM('film', 'episode', 'series') NOT NULL,
            project_id INT NOT NULL,
            board_id INT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_project_board (project_type, project_id),
            INDEX idx_user_project (user_id, project_type, project_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (board_id) REFERENCES idea_boards(id) ON DELETE CASCADE
        )"
    );

    api_ensure_project_type_enum_support($pdo, 'editor_project_idea_boards', ['film', 'episode', 'series']);
}

function api_find_project_idea_board(PDO $pdo, int $userId, array $project): ?array
{
    if (!api_table_exists($pdo, 'idea_boards') || !api_table_exists($pdo, 'idea_board_items') || !api_table_exists($pdo, 'idea_board_links')) {
        return null;
    }

    api_ensure_project_idea_board_table($pdo);

    $stmt = $pdo->prepare(
        "SELECT
            m.board_id,
            b.title,
            b.description,
            b.studio_id,
            b.visibility,
            b.created_at,
            b.updated_at
        FROM editor_project_idea_boards m
        INNER JOIN idea_boards b ON b.id = m.board_id
        WHERE m.user_id = ? AND m.project_type = ? AND m.project_id = ?
        LIMIT 1"
    );
    $stmt->execute([$userId, $project['type'], (int) $project['id']]);
    $board = $stmt->fetch(PDO::FETCH_ASSOC);

    return $board ?: null;
}

function api_create_project_idea_board(PDO $pdo, int $userId, array $project): array
{
    if (!api_table_exists($pdo, 'idea_boards') || !api_table_exists($pdo, 'idea_board_items') || !api_table_exists($pdo, 'idea_board_links')) {
        api_error('IDEA_BOARD_SCHEMA_MISSING', 'Idea board tables are not available in this environment.', 500);
    }

    api_ensure_project_idea_board_table($pdo);

    $stmt = $pdo->prepare(
        'INSERT INTO idea_boards (user_id, title, description, studio_id, visibility)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $userId,
        (string) ($project['title'] ?? 'Untitled Idea Board'),
        (string) ($project['description'] ?? ''),
        $project['studio_id'] !== null ? (int) $project['studio_id'] : null,
        'private',
    ]);
    $boardId = (int) $pdo->lastInsertId();

    $stmt = $pdo->prepare(
        'INSERT INTO editor_project_idea_boards (user_id, project_type, project_id, board_id)
         VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$userId, $project['type'], (int) $project['id'], $boardId]);

    return [
        'board_id' => $boardId,
        'title' => (string) ($project['title'] ?? 'Untitled Idea Board'),
        'description' => (string) ($project['description'] ?? ''),
        'studio_id' => $project['studio_id'] !== null ? (int) $project['studio_id'] : null,
        'visibility' => 'private',
        'created_at' => gmdate('Y-m-d H:i:s'),
        'updated_at' => gmdate('Y-m-d H:i:s'),
    ];
}

function api_load_project_idea_board(PDO $pdo, int $userId, array $project): ?array
{
    $board = api_find_project_idea_board($pdo, $userId, $project);
    if (!$board) {
        return null;
    }

    $boardId = (int) $board['board_id'];
    $itemStmt = $pdo->prepare(
        'SELECT id, item_type, title, content, image_url, link_url, prompt_text, generated_image_url, generation_status, generation_count, last_generated_at, last_error, prompt_id, pos_x, pos_y, width, height, created_at, updated_at
         FROM idea_board_items
         WHERE board_id = ?
         ORDER BY id ASC'
    );
    $itemStmt->execute([$boardId]);
    $items = array_map(
        static fn(array $row): array => [
            'id' => (int) $row['id'],
            'item_type' => $row['item_type'],
            'title' => $row['title'],
            'content' => $row['content'],
            'image_url' => $row['image_url'],
            'link_url' => $row['link_url'],
            'prompt_text' => $row['prompt_text'],
            'generated_image_url' => $row['generated_image_url'],
            'generation_status' => $row['generation_status'],
            'generation_count' => (int) ($row['generation_count'] ?? 0),
            'last_generated_at' => $row['last_generated_at'],
            'last_error' => $row['last_error'],
            'prompt_id' => $row['prompt_id'],
            'pos_x' => (int) ($row['pos_x'] ?? 20),
            'pos_y' => (int) ($row['pos_y'] ?? 20),
            'width' => (int) ($row['width'] ?? 240),
            'height' => (int) ($row['height'] ?? 160),
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ],
        $itemStmt->fetchAll(PDO::FETCH_ASSOC)
    );

    $linkStmt = $pdo->prepare(
        'SELECT id, source_item_id, target_item_id, link_type, created_at
         FROM idea_board_links
         WHERE board_id = ?
         ORDER BY id ASC'
    );
    $linkStmt->execute([$boardId]);
    $links = array_map(
        static fn(array $row): array => [
            'id' => (int) $row['id'],
            'source_item_id' => (int) $row['source_item_id'],
            'target_item_id' => (int) $row['target_item_id'],
            'link_type' => $row['link_type'],
            'created_at' => $row['created_at'],
        ],
        $linkStmt->fetchAll(PDO::FETCH_ASSOC)
    );

    return [
        'id' => $boardId,
        'title' => $board['title'],
        'description' => $board['description'],
        'studio_id' => $board['studio_id'] !== null ? (int) $board['studio_id'] : null,
        'visibility' => $board['visibility'],
        'created_at' => $board['created_at'],
        'updated_at' => $board['updated_at'],
        'items' => $items,
        'links' => $links,
    ];
}

function api_save_project_idea_board(PDO $pdo, int $userId, array $project, array $payload): array
{
    $board = api_find_project_idea_board($pdo, $userId, $project) ?? api_create_project_idea_board($pdo, $userId, $project);
    $boardId = (int) $board['board_id'];
    $items = isset($payload['items']) && is_array($payload['items']) ? $payload['items'] : [];
    $links = isset($payload['links']) && is_array($payload['links']) ? $payload['links'] : [];
    $allowedTypes = ['note', 'image', 'link', 'style', 'style_selector', 'character', 'location', 'scene', 'camera', 'prop', 'wardrobe', 'lighting', 'vfx', 'audio', 'dialogue', 'beat', 'clip'];

    $pdo->beginTransaction();

    try {
        $existingStmt = $pdo->prepare('SELECT id FROM idea_board_items WHERE board_id = ?');
        $existingStmt->execute([$boardId]);
        $existingIds = array_map('intval', $existingStmt->fetchAll(PDO::FETCH_COLUMN));
        $keepIds = [];
        $idMap = [];

        foreach ($items as $index => $item) {
            $itemType = (string) ($item['item_type'] ?? '');
            if (!in_array($itemType, $allowedTypes, true)) {
                continue;
            }

            $rawId = $item['id'] ?? null;
            $numericId = is_numeric($rawId) ? (int) $rawId : 0;
            $title = trim((string) ($item['title'] ?? ''));
            $content = trim((string) ($item['content'] ?? ''));
            $imageUrl = trim((string) ($item['image_url'] ?? ''));
            $linkUrl = trim((string) ($item['link_url'] ?? ''));
            $posX = (int) ($item['pos_x'] ?? 20);
            $posY = (int) ($item['pos_y'] ?? 20);
            $width = max(180, (int) ($item['width'] ?? 240));
            $height = max(120, (int) ($item['height'] ?? 160));

            if ($numericId > 0 && in_array($numericId, $existingIds, true)) {
                $stmt = $pdo->prepare(
                    'UPDATE idea_board_items
                     SET item_type = ?, title = ?, content = ?, image_url = ?, link_url = ?, pos_x = ?, pos_y = ?, width = ?, height = ?
                     WHERE id = ? AND board_id = ?'
                );
                $stmt->execute([$itemType, $title, $content, $imageUrl, $linkUrl, $posX, $posY, $width, $height, $numericId, $boardId]);
                $keepIds[] = $numericId;
                $idMap[(string) $rawId] = $numericId;
            } else {
                $stmt = $pdo->prepare(
                    'INSERT INTO idea_board_items (board_id, studio_id, item_type, title, content, image_url, link_url, pos_x, pos_y, width, height)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
                );
                $stmt->execute([
                    $boardId,
                    $project['studio_id'] !== null ? (int) $project['studio_id'] : null,
                    $itemType,
                    $title,
                    $content,
                    $imageUrl,
                    $linkUrl,
                    $posX,
                    $posY,
                    $width,
                    $height,
                ]);
                $newId = (int) $pdo->lastInsertId();
                $keepIds[] = $newId;
                $idMap[(string) ($rawId ?: 'new-' . $index)] = $newId;
            }
        }

        $deleteIds = array_values(array_diff($existingIds, $keepIds));
        if ($deleteIds) {
            $in = implode(',', array_fill(0, count($deleteIds), '?'));
            $stmt = $pdo->prepare("DELETE FROM idea_board_items WHERE board_id = ? AND id IN ($in)");
            $stmt->execute(array_merge([$boardId], $deleteIds));
        }

        $stmt = $pdo->prepare('DELETE FROM idea_board_links WHERE board_id = ?');
        $stmt->execute([$boardId]);

        foreach ($links as $link) {
            $sourceId = $idMap[(string) ($link['source_item_id'] ?? '')] ?? (is_numeric($link['source_item_id'] ?? null) ? (int) $link['source_item_id'] : 0);
            $targetId = $idMap[(string) ($link['target_item_id'] ?? '')] ?? (is_numeric($link['target_item_id'] ?? null) ? (int) $link['target_item_id'] : 0);
            $linkType = in_array((string) ($link['link_type'] ?? 'note'), ['style', 'note'], true) ? (string) ($link['link_type'] ?? 'note') : 'note';
            if (!$sourceId || !$targetId || $sourceId === $targetId) {
                continue;
            }

            $stmt = $pdo->prepare(
                'INSERT INTO idea_board_links (board_id, source_item_id, target_item_id, link_type)
                 VALUES (?, ?, ?, ?)'
            );
            $stmt->execute([$boardId, $sourceId, $targetId, $linkType]);
        }

        $stmt = $pdo->prepare('UPDATE idea_boards SET title = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        $stmt->execute([
            (string) ($payload['title'] ?? $project['title'] ?? 'Untitled Idea Board'),
            (string) ($payload['description'] ?? $project['description'] ?? ''),
            $boardId,
        ]);

        $pdo->commit();
    } catch (Throwable $exception) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $exception;
    }

    return api_load_project_idea_board($pdo, $userId, $project) ?? [
        'id' => $boardId,
        'items' => [],
        'links' => [],
    ];
}

function api_post_idea_board_handler(string $action, array $payload): array
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $scriptDir = str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? ''));
    $appBase = preg_replace('#/api/v1$#', '', $scriptDir) ?: '';
    $url = $scheme . '://' . $host . rtrim($appBase, '/') . '/includes/idea_board_handlers.php';

    $body = json_encode(array_merge(['action' => $action], $payload), JSON_UNESCAPED_SLASHES);
    if ($body === false) {
        api_error('INVALID_PAYLOAD', 'Idea board payload could not be encoded.', 400);
    }

    $headers = [
        'Content-Type: application/json',
        'Cookie: ' . session_name() . '=' . session_id(),
    ];

    // Release the active PHP session before making an internal HTTP request that
    // reuses the same session cookie, otherwise the nested request can block on
    // the session file lock until this request times out.
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_write_close();
    }

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 60,
        ]);
        $response = curl_exec($ch);
        $statusCode = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($response === false) {
            api_error('UPSTREAM_REQUEST_FAILED', 'Idea board handler request failed: ' . $error, 502);
        }
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headers),
                'content' => $body,
                'timeout' => 60,
                'ignore_errors' => true,
            ],
        ]);
        $response = file_get_contents($url, false, $context);
        $statusCode = 200;
        if (isset($http_response_header) && is_array($http_response_header)) {
            foreach ($http_response_header as $headerLine) {
                if (preg_match('#HTTP/\S+\s+(\d{3})#', $headerLine, $matches)) {
                    $statusCode = (int) $matches[1];
                    break;
                }
            }
        }

        if ($response === false) {
            api_error('UPSTREAM_REQUEST_FAILED', 'Idea board handler request failed.', 502);
        }
    }

    $decoded = json_decode((string) $response, true);
    if (!is_array($decoded)) {
        api_error('UPSTREAM_INVALID_RESPONSE', 'Idea board handler returned invalid JSON.', 502);
    }
    if ($statusCode >= 400 || empty($decoded['success'])) {
        api_error('IDEA_BOARD_ACTION_FAILED', (string) ($decoded['error'] ?? 'Idea board action failed.'), $statusCode >= 400 ? $statusCode : 400);
    }

    return $decoded;
}

function api_find_idea_board_item(PDO $pdo, int $boardId, int $itemId): ?array
{
    $stmt = $pdo->prepare(
        'SELECT id, board_id, item_type, title, content, image_url, link_url, generated_image_url, generation_status, generation_count, last_generated_at, last_error, prompt_id, created_at, updated_at
         FROM idea_board_items
         WHERE board_id = ? AND id = ?
         LIMIT 1'
    );
    $stmt->execute([$boardId, $itemId]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);

    return $item ?: null;
}

function api_upsert_starting_image_item(PDO $pdo, int $userId, array $project, array $payload): array
{
    if (!api_table_exists($pdo, 'idea_boards') || !api_table_exists($pdo, 'idea_board_items')) {
        api_error('IDEA_BOARD_SCHEMA_MISSING', 'Idea board tables are not available in this environment.', 500);
    }

    $prompt = trim((string) ($payload['prompt'] ?? ''));
    if ($prompt === '') {
        api_error('INVALID_PROMPT', 'A starting image prompt is required.', 400);
    }

    $sceneRef = trim((string) ($payload['scene_id'] ?? ''));
    $sceneTitle = trim((string) ($payload['scene_title'] ?? ''));
    $shotNotes = trim((string) ($payload['shot_notes'] ?? ''));
    $referenceImageUrl = trim((string) ($payload['reference_image_url'] ?? ''));
    $board = api_find_project_idea_board($pdo, $userId, $project) ?? api_create_project_idea_board($pdo, $userId, $project);
    $boardId = (int) $board['board_id'];
    $itemId = (int) ($payload['board_item_id'] ?? 0);
    $content = $prompt;
    if ($shotNotes !== '') {
        $content .= "\n\nShot notes: " . $shotNotes;
    }

    $sceneMarker = $sceneRef !== '' ? 'sa://starting-image-scene/' . rawurlencode($sceneRef) : '';

    if ($itemId > 0) {
        $item = api_find_idea_board_item($pdo, $boardId, $itemId);
        if (!$item) {
            api_error('STARTING_IMAGE_ITEM_NOT_FOUND', 'The requested starting image item could not be found.', 404);
        }

        $stmt = $pdo->prepare(
            'UPDATE idea_board_items
             SET item_type = ?, title = ?, content = ?, image_url = ?, link_url = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND board_id = ?'
        );
        $stmt->execute([
            'scene',
            $sceneTitle !== '' ? $sceneTitle : ($item['title'] ?: 'Starting Image Scene'),
            $content,
            $referenceImageUrl !== '' ? $referenceImageUrl : ($item['image_url'] ?? ''),
            $sceneMarker !== '' ? $sceneMarker : ($item['link_url'] ?? ''),
            $itemId,
            $boardId,
        ]);
    } else {
        if ($sceneMarker !== '') {
            $stmt = $pdo->prepare(
                'SELECT id
                 FROM idea_board_items
                 WHERE board_id = ? AND link_url = ?
                 ORDER BY id DESC
                 LIMIT 1'
            );
            $stmt->execute([$boardId, $sceneMarker]);
            $existingId = (int) ($stmt->fetchColumn() ?: 0);
            if ($existingId > 0) {
                $itemId = $existingId;
                $stmt = $pdo->prepare(
                    'UPDATE idea_board_items
                     SET item_type = ?, title = ?, content = ?, image_url = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ? AND board_id = ?'
                );
                $stmt->execute([
                    'scene',
                    $sceneTitle !== '' ? $sceneTitle : 'Starting Image Scene',
                    $content,
                    $referenceImageUrl,
                    $itemId,
                    $boardId,
                ]);
            }
        }

        if ($itemId === 0) {
            $stmt = $pdo->prepare(
                'INSERT INTO idea_board_items (board_id, studio_id, item_type, title, content, image_url, link_url, pos_x, pos_y, width, height)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $boardId,
                $project['studio_id'] !== null ? (int) $project['studio_id'] : null,
                'scene',
                $sceneTitle !== '' ? $sceneTitle : 'Starting Image Scene',
                $content,
                $referenceImageUrl,
                $sceneMarker,
                160,
                160,
                280,
                200,
            ]);
            $itemId = (int) $pdo->lastInsertId();
        }
    }

    $item = api_find_idea_board_item($pdo, $boardId, $itemId);
    if (!$item) {
        api_error('STARTING_IMAGE_ITEM_NOT_FOUND', 'The starting image item could not be prepared.', 500);
    }

    return $item;
}

function api_upsert_video_clip_item(PDO $pdo, int $userId, array $project, array $payload): array
{
    if (!api_table_exists($pdo, 'idea_boards') || !api_table_exists($pdo, 'idea_board_items') || !api_table_exists($pdo, 'idea_board_links')) {
        api_error('IDEA_BOARD_SCHEMA_MISSING', 'Idea board tables are not available in this environment.', 500);
    }

    $sceneRef = trim((string) ($payload['scene_id'] ?? ''));
    $sceneTitle = trim((string) ($payload['scene_title'] ?? ''));
    $clipPrompt = trim((string) ($payload['clip_prompt'] ?? ''));
    if ($clipPrompt === '') {
        api_error('INVALID_CLIP_PROMPT', 'A video clip prompt is required.', 400);
    }

    $shotNotes = trim((string) ($payload['shot_notes'] ?? ''));
    $sceneBoardItemId = (int) ($payload['scene_board_item_id'] ?? 0);
    if ($sceneBoardItemId <= 0) {
        api_error('SCENE_ITEM_REQUIRED', 'A generated starting image scene item is required before clip generation.', 400);
    }

    $board = api_find_project_idea_board($pdo, $userId, $project);
    if (!$board) {
        api_error('IDEA_BOARD_NOT_FOUND', 'This project does not have an idea board yet.', 404);
    }

    $boardId = (int) $board['board_id'];
    $sceneItem = api_find_idea_board_item($pdo, $boardId, $sceneBoardItemId);
    if (!$sceneItem || $sceneItem['item_type'] !== 'scene') {
        api_error('SCENE_ITEM_NOT_FOUND', 'The linked starting image scene item could not be found.', 404);
    }

    $itemId = (int) ($payload['board_item_id'] ?? 0);
    $clipMarker = $sceneRef !== '' ? 'sa://video-clip-scene/' . rawurlencode($sceneRef) : '';
    $content = $clipPrompt;
    if ($shotNotes !== '') {
        $content .= "\n\nMotion notes: " . $shotNotes;
    }

    if ($itemId > 0) {
        $item = api_find_idea_board_item($pdo, $boardId, $itemId);
        if (!$item) {
            api_error('VIDEO_CLIP_ITEM_NOT_FOUND', 'The requested video clip item could not be found.', 404);
        }

        $stmt = $pdo->prepare(
            'UPDATE idea_board_items
             SET item_type = ?, title = ?, content = ?, link_url = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ? AND board_id = ?'
        );
        $stmt->execute([
            'clip',
            $sceneTitle !== '' ? $sceneTitle . ' Clip' : ($item['title'] ?: 'Video Clip'),
            $content,
            $clipMarker !== '' ? $clipMarker : ($item['link_url'] ?? ''),
            $itemId,
            $boardId,
        ]);
    } else {
        if ($clipMarker !== '') {
            $stmt = $pdo->prepare(
                'SELECT id
                 FROM idea_board_items
                 WHERE board_id = ? AND link_url = ?
                 ORDER BY id DESC
                 LIMIT 1'
            );
            $stmt->execute([$boardId, $clipMarker]);
            $existingId = (int) ($stmt->fetchColumn() ?: 0);
            if ($existingId > 0) {
                $itemId = $existingId;
                $stmt = $pdo->prepare(
                    'UPDATE idea_board_items
                     SET item_type = ?, title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
                     WHERE id = ? AND board_id = ?'
                );
                $stmt->execute([
                    'clip',
                    $sceneTitle !== '' ? $sceneTitle . ' Clip' : 'Video Clip',
                    $content,
                    $itemId,
                    $boardId,
                ]);
            }
        }

        if ($itemId === 0) {
            $stmt = $pdo->prepare(
                'INSERT INTO idea_board_items (board_id, studio_id, item_type, title, content, image_url, link_url, pos_x, pos_y, width, height)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
            );
            $stmt->execute([
                $boardId,
                $project['studio_id'] !== null ? (int) $project['studio_id'] : null,
                'clip',
                $sceneTitle !== '' ? $sceneTitle . ' Clip' : 'Video Clip',
                $content,
                '',
                $clipMarker,
                520,
                160,
                300,
                180,
            ]);
            $itemId = (int) $pdo->lastInsertId();
        }
    }

    $stmt = $pdo->prepare(
        'SELECT id FROM idea_board_links WHERE board_id = ? AND source_item_id = ? AND target_item_id = ? LIMIT 1'
    );
    $stmt->execute([$boardId, $sceneBoardItemId, $itemId]);
    $linkExists = (int) ($stmt->fetchColumn() ?: 0);
    if ($linkExists === 0) {
        $stmt = $pdo->prepare(
            'INSERT INTO idea_board_links (board_id, source_item_id, target_item_id, link_type) VALUES (?, ?, ?, ?)'
        );
        $stmt->execute([$boardId, $sceneBoardItemId, $itemId, 'scene']);
    }

    $item = api_find_idea_board_item($pdo, $boardId, $itemId);
    if (!$item) {
        api_error('VIDEO_CLIP_ITEM_NOT_FOUND', 'The video clip item could not be prepared.', 500);
    }

    return $item;
}

function api_ensure_bridge_request_table(PDO $pdo): void
{
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS editor_bridge_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            project_type ENUM('film', 'episode', 'series', 'clip') NOT NULL DEFAULT 'episode',
            project_id INT NOT NULL,
            track_id VARCHAR(64) NOT NULL,
            before_item_id VARCHAR(128) NOT NULL,
            after_item_id VARCHAR(128) NOT NULL,
            prompt TEXT NOT NULL,
            duration_seconds DECIMAL(8,3) NOT NULL DEFAULT 2.000,
            start_frame_data LONGTEXT NULL,
            end_frame_data LONGTEXT NULL,
            status VARCHAR(32) NOT NULL DEFAULT 'queued',
            generated_video_url TEXT NULL,
            last_error TEXT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_bridge_user_project (user_id, project_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
    );

    if (!api_column_exists($pdo, 'editor_bridge_requests', 'project_type')) {
        $pdo->exec("ALTER TABLE editor_bridge_requests ADD COLUMN project_type ENUM('film', 'episode', 'series', 'clip') NOT NULL DEFAULT 'episode' AFTER user_id");
    }

    api_ensure_project_type_enum_support($pdo, 'editor_bridge_requests', ['film', 'episode', 'series', 'clip']);
}

function api_queue_bridge_clip_request(PDO $pdo, int $userId, array $project, array $payload): array
{
    api_ensure_bridge_request_table($pdo);

    $trackId = trim((string) ($payload['track_id'] ?? ''));
    $beforeItemId = trim((string) ($payload['before_item_id'] ?? ''));
    $afterItemId = trim((string) ($payload['after_item_id'] ?? ''));
    $prompt = trim((string) ($payload['prompt'] ?? ''));
    $durationSeconds = max(0.6, min(8.0, (float) ($payload['duration_seconds'] ?? 2.0)));

    if ($trackId === '' || $beforeItemId === '' || $afterItemId === '') {
        api_error('INVALID_BRIDGE_CONTEXT', 'Bridge clip requests require track and adjacent item identifiers.', 400);
    }
    if ($prompt === '') {
        api_error('INVALID_BRIDGE_PROMPT', 'A bridge clip prompt is required.', 400);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO editor_bridge_requests
         (user_id, project_type, project_id, track_id, before_item_id, after_item_id, prompt, duration_seconds, start_frame_data, end_frame_data, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $userId,
        (string) $project['type'],
        (int) $project['id'],
        $trackId,
        $beforeItemId,
        $afterItemId,
        $prompt,
        $durationSeconds,
        (string) ($payload['start_frame_data'] ?? ''),
        (string) ($payload['end_frame_data'] ?? ''),
        'queued',
    ]);

    $requestId = (int) $pdo->lastInsertId();
    $request = api_find_bridge_clip_request($pdo, $userId, $requestId);
    if (!$request) {
        api_error('BRIDGE_REQUEST_FAILED', 'The bridge clip request could not be created.', 500);
    }

    return $request;
}

function api_find_bridge_clip_request(PDO $pdo, int $userId, int $requestId): ?array
{
    api_ensure_bridge_request_table($pdo);
    $stmt = $pdo->prepare(
        'SELECT id, project_type, project_id, track_id, before_item_id, after_item_id, prompt, duration_seconds, status, generated_video_url, last_error, created_at, updated_at
         FROM editor_bridge_requests
         WHERE id = ? AND user_id = ?
         LIMIT 1'
    );
    $stmt->execute([$requestId, $userId]);
    $row = $stmt->fetch();
    return $row ?: null;
}

function api_find_editor_export(PDO $pdo, int $userId, int $exportId): ?array
{
    if (!api_table_exists($pdo, 'editor_exports')) {
        return null;
    }

    api_ensure_project_type_enum_support($pdo, 'editor_exports', ['film', 'episode', 'series', 'clip']);

    $stmt = $pdo->prepare(
        'SELECT id, project_type, project_id, title, export_type, duration_seconds, resolution, status, storage_path, thumbnail_url, file_size_bytes, created_at, completed_at
         FROM editor_exports
         WHERE id = ? AND user_id = ?
         LIMIT 1'
    );
    $stmt->execute([$exportId, $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    return $row ?: null;
}
