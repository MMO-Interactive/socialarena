<?php

declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$segments = api_route_segments();

if (($segments[0] ?? '') === 'health' && count($segments) === 1) {
    api_require_method('GET');
    api_success([
        'status' => 'ok',
        'service' => 'socialarena-editor-api',
        'time' => gmdate('c'),
    ]);
}

if (($segments[0] ?? '') === 'meta' && count($segments) === 1) {
    api_require_method('GET');
    api_success([
        'api' => [
            'name' => 'SocialArena Editor API',
            'version' => 'v1',
            'auth' => [
                'primary' => 'session_bearer',
                'headers' => ['Authorization: Bearer <session_id>', 'X-Editor-Session: <session_id>'],
            ],
            'features' => [
                'studio_scoping' => true,
                'session_introspection' => true,
                'strict_studio_selection' => true,
                'healthcheck' => true,
                'studio_listing' => true,
                'session_bootstrap' => true,
                'auth_capabilities' => true,
                'project_summary' => true,
                'project_management' => true,
                'idea_board' => true,
                'generation_starting_images' => true,
                'generation_video_clips' => true,
                'bridge_clips' => true,
                'timeline' => true,
                'exports' => true,
                'request_id' => true,
            ],
            'routes' => [
                'public' => ['GET /health', 'GET /meta', 'POST /auth/editor-login'],
                'authenticated' => ['GET /auth/session', 'POST /auth/refresh', 'GET /auth/me', 'GET /auth/studios', 'GET /auth/capabilities', 'POST /auth/select-studio', 'POST /auth/logout'],
            ],
        ],
    ]);
}

if (($segments[0] ?? '') === 'auth' && ($segments[1] ?? '') === 'editor-login') {
    api_require_method('POST');
    $data = api_request_json();
    $username = trim((string) ($data['username'] ?? ''));
    $email = trim((string) ($data['email'] ?? ''));
    $password = (string) ($data['password'] ?? '');

    $identity = $username !== '' ? $username : $email;
    if ($identity === '' || $password === '') {
        api_error('INVALID_CREDENTIALS', 'Username and password are required.', 400);
    }

    $stmt = $pdo->prepare('SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ? LIMIT 1');
    $stmt->execute([$identity, $identity]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['password_hash'])) {
        api_error('INVALID_CREDENTIALS', 'Username or password is incorrect.', 401);
    }

    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['username'] = $user['username'];
    $studios = api_list_user_studios($pdo, (int) $user['id']);
    api_set_current_studio_id(api_resolve_current_studio_id($studios, api_current_studio_id()));

    api_success([
        'token' => session_id(),
        'user' => [
            'id' => (int) $user['id'],
            'username' => (string) $user['username'],
            'email' => (string) $user['email'],
        ],
        'studios' => $studios,
        'current_studio_id' => api_current_studio_id(),
        'expires_at' => api_session_expiry_iso(),
    ]);
}

if (($segments[0] ?? '') === 'auth' && ($segments[1] ?? '') === 'session') {
    api_require_method('GET');
    $userId = api_require_auth();
    api_success(api_auth_context($pdo, $userId));
}

if (($segments[0] ?? '') === 'auth' && ($segments[1] ?? '') === 'refresh') {
    api_require_method('POST');
    $userId = api_require_auth();
    api_success(api_auth_context($pdo, $userId));
}

if (($segments[0] ?? '') === 'auth' && ($segments[1] ?? '') === 'me') {
    api_require_method('GET');
    $userId = api_require_auth();
    $user = api_user_profile($pdo, $userId);

    $studios = api_list_user_studios($pdo, $userId);
    api_set_current_studio_id(api_resolve_current_studio_id($studios, api_current_studio_id()));

    api_success([
        'user' => [
            'id' => (int) $user['id'],
            'username' => (string) $user['username'],
            'email' => (string) $user['email'],
        ],
        'studios' => $studios,
        'current_studio_id' => api_current_studio_id(),
        'expires_at' => api_session_expiry_iso(),
    ]);
}

if (($segments[0] ?? '') === 'auth' && ($segments[1] ?? '') === 'select-studio') {
    api_require_method('POST');
    $userId = api_require_auth();
    $data = api_request_json();
    $studios = api_list_user_studios($pdo, $userId);
    $requestedStudioId = api_require_studio_id($data['studio_id'] ?? null);
    api_require_studio_membership($pdo, $userId, $requestedStudioId);
    api_set_current_studio_id($requestedStudioId);
    api_success([
        'studios' => $studios,
        'current_studio_id' => api_current_studio_id(),
    ]);
}

if (($segments[0] ?? '') === 'auth' && ($segments[1] ?? '') === 'studios') {
    api_require_method('GET');
    $userId = api_require_auth();
    $studios = api_list_user_studios($pdo, $userId);
    $currentStudioId = api_resolve_current_studio_id($studios, api_current_studio_id());
    api_set_current_studio_id($currentStudioId);
    api_success([
        'studios' => $studios,
        'current_studio_id' => api_current_studio_id(),
    ]);
}

if (($segments[0] ?? '') === 'auth' && ($segments[1] ?? '') === 'capabilities') {
    api_require_method('GET');
    $userId = api_require_auth();
    $studios = api_list_user_studios($pdo, $userId);
    $roles = array_values(array_unique(array_map(
        static fn (array $studio): string => strtolower((string) ($studio['role'] ?? 'member')),
        $studios
    )));
    sort($roles);

    api_success([
        'capabilities' => [
            'can_access_editor' => true,
            'can_manage_studio' => in_array('owner', $roles, true) || in_array('admin', $roles, true),
            'can_create_projects' => !empty($studios),
            'roles' => $roles,
            'studio_count' => count($studios),
        ],
    ]);
}

if (($segments[0] ?? '') === 'auth' && ($segments[1] ?? '') === 'logout') {
    api_require_method('POST');
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }

    api_success(['success' => true]);
}

$userId = api_require_auth();

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'dashboard' && count($segments) === 2) {
    api_require_method('GET');
    $currentStudioId = api_resolve_effective_studio_id($pdo, $userId, [
        'requested_studio_id' => $_GET['studio_id'] ?? null,
        'allow_null' => true,
    ]);
    api_success([
        'dashboard' => api_dashboard_summary($pdo, $userId, $currentStudioId !== null ? (int) $currentStudioId : null),
    ]);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 2) {
    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $filters = $_GET;
        $filters['studio_id'] = api_resolve_effective_studio_id($pdo, $userId, [
            'requested_studio_id' => $_GET['studio_id'] ?? null,
            'allow_null' => true,
        ]);
        api_success([
            'projects' => api_list_editor_projects($pdo, $userId, $filters),
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = api_request_json();
        $data['studio_id'] = api_resolve_effective_studio_id($pdo, $userId, [
            'requested_studio_id' => $data['studio_id'] ?? null,
            'allow_null' => true,
        ]);
        api_success([
            'project' => api_create_editor_project($pdo, $userId, $data),
        ], 201);
    }

    api_method_not_allowed(['GET', 'POST']);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 4) {
    api_require_method('GET');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $type = $segments[2];
    $projectId = (int) $segments[3];
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);

    api_success([
        'project' => [
            'id' => (int) $project['id'],
            'type' => $project['type'],
            'title' => $project['title'],
            'description' => $project['description'],
            'studio_id' => $project['studio_id'] !== null ? (int) $project['studio_id'] : null,
            'story_id' => $project['story_id'] !== null ? (int) $project['story_id'] : null,
            'episode_id' => $project['episode_id'] !== null ? (int) $project['episode_id'] : null,
            'season_id' => $project['season_id'] !== null ? (int) $project['season_id'] : null,
            'series_id' => $project['series_id'] !== null ? (int) $project['series_id'] : null,
            'status' => $project['status'],
            'updated_at' => $project['updated_at'],
            'series_outline' => $project['type'] === 'series' && !empty($project['series_id'])
                ? api_series_outline($pdo, (int) $project['series_id'])
                : null,
            'scenes' => api_story_scenes($pdo, api_project_story_id($project)),
            'clips' => api_story_clips($pdo, api_project_story_id($project)),
            'asset_count' => count(api_project_assets($pdo, $userId, $project)),
        ],
    ]);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 5 && $segments[4] === 'summary') {
    api_require_method('GET');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $type = $segments[2];
    $projectId = (int) $segments[3];
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);

    $storyId = api_project_story_id($project);
    $scenes = api_story_scenes($pdo, $storyId);
    $clips = api_story_clips($pdo, $storyId);
    $assets = api_project_assets($pdo, $userId, $project);

    api_success([
        'summary' => [
            'project_id' => (int) $project['id'],
            'project_type' => (string) $project['type'],
            'story_id' => $storyId !== null ? (int) $storyId : null,
            'scene_count' => count($scenes),
            'clip_count' => count($clips),
            'asset_count' => count($assets),
            'status' => (string) ($project['status'] ?? 'draft'),
            'updated_at' => $project['updated_at'] ?? null,
        ],
    ]);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 5 && $segments[2] === 'series' && $segments[4] === 'seasons') {
    api_require_method('POST');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $projectId = (int) $segments[3];
    $project = api_require_series_in_scope($pdo, $userId, $projectId);

    $data = api_request_json();
    api_success(api_create_series_season($pdo, $userId, $project, $data), 201);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 5 && $segments[2] === 'series' && $segments[4] === 'episodes') {
    api_require_method('POST');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $projectId = (int) $segments[3];
    $project = api_require_series_in_scope($pdo, $userId, $projectId);

    $data = api_request_json();
    api_success(api_create_series_episode($pdo, $userId, $project, $data), 201);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 5 && $segments[4] === 'assets') {
    api_require_method('GET');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $type = $segments[2];
    $projectId = (int) $segments[3];
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);

    api_success([
        'assets' => api_project_assets($pdo, $userId, $project),
    ]);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 5 && $segments[4] === 'idea-board') {
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $type = $segments[2];
    $projectId = (int) $segments[3];
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        api_success([
            'idea_board' => api_load_project_idea_board($pdo, $userId, $project),
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = api_request_json();
        api_success([
            'idea_board' => api_save_project_idea_board($pdo, $userId, $project, $data),
        ]);
    }

    api_method_not_allowed(['GET', 'POST']);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 6 && $segments[4] === 'starting-images' && $segments[5] === 'generate') {
    api_require_method('POST');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $type = $segments[2];
    $projectId = (int) $segments[3];
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);

    $data = api_request_json();
    $item = api_upsert_starting_image_item($pdo, $userId, $project, $data);
    $result = api_post_idea_board_handler('generate_item', ['item_id' => (int) $item['id']]);
    $freshItem = api_find_idea_board_item($pdo, (int) $item['board_id'], (int) $item['id']);

    api_success([
        'queued' => true,
        'starting_image' => [
            'board_item_id' => (int) $item['id'],
            'board_id' => (int) $item['board_id'],
            'item_type' => $freshItem['item_type'] ?? $item['item_type'],
            'title' => $freshItem['title'] ?? $item['title'],
            'content' => $freshItem['content'] ?? $item['content'],
            'image_url' => $freshItem['image_url'] ?? $item['image_url'],
            'generated_image_url' => $freshItem['generated_image_url'] ?? $item['generated_image_url'],
            'generation_status' => $freshItem['generation_status'] ?? $item['generation_status'],
            'generation_count' => isset($freshItem['generation_count']) ? (int) $freshItem['generation_count'] : (int) ($item['generation_count'] ?? 0),
            'last_generated_at' => $freshItem['last_generated_at'] ?? $item['last_generated_at'],
            'last_error' => $freshItem['last_error'] ?? $item['last_error'],
            'prompt_id' => $freshItem['prompt_id'] ?? $item['prompt_id'],
        ],
        'generation' => $result,
    ]);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 6 && $segments[4] === 'starting-images' && $segments[5] === 'refresh') {
    api_require_method('POST');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $type = $segments[2];
    $projectId = (int) $segments[3];
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);

    $board = api_find_project_idea_board($pdo, $userId, $project);
    if (!$board) {
        api_error('IDEA_BOARD_NOT_FOUND', 'This project does not have an idea board yet.', 404);
    }

    $data = api_request_json();
    $itemId = (int) ($data['board_item_id'] ?? 0);
    if ($itemId <= 0) {
        api_error('INVALID_STARTING_IMAGE_ITEM', 'A valid starting image board item id is required.', 400);
    }

    $item = api_find_idea_board_item($pdo, (int) $board['board_id'], $itemId);
    if (!$item) {
        api_error('STARTING_IMAGE_ITEM_NOT_FOUND', 'The requested starting image item could not be found.', 404);
    }

    $result = api_post_idea_board_handler('refresh_item', ['item_id' => $itemId]);
    $freshItem = api_find_idea_board_item($pdo, (int) $board['board_id'], $itemId) ?? $item;

    api_success([
        'generated' => (bool) ($result['generated'] ?? false),
        'starting_image' => [
            'board_item_id' => (int) $freshItem['id'],
            'board_id' => (int) $freshItem['board_id'],
            'item_type' => $freshItem['item_type'],
            'title' => $freshItem['title'],
            'content' => $freshItem['content'],
            'image_url' => $freshItem['image_url'],
            'generated_image_url' => $freshItem['generated_image_url'],
            'generation_status' => $freshItem['generation_status'],
            'generation_count' => (int) ($freshItem['generation_count'] ?? 0),
            'last_generated_at' => $freshItem['last_generated_at'],
            'last_error' => $freshItem['last_error'],
            'prompt_id' => $freshItem['prompt_id'],
        ],
        'refresh' => $result,
    ]);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 6 && $segments[4] === 'video-clips' && $segments[5] === 'generate') {
    api_require_method('POST');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $type = $segments[2];
    $projectId = (int) $segments[3];
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);

    $data = api_request_json();
    $item = api_upsert_video_clip_item($pdo, $userId, $project, $data);
    $result = api_post_idea_board_handler('clip_generate', ['item_id' => (int) $item['id']]);
    $freshItem = api_find_idea_board_item($pdo, (int) $item['board_id'], (int) $item['id']);

    api_success([
        'queued' => true,
        'video_clip' => [
            'board_item_id' => (int) $item['id'],
            'board_id' => (int) $item['board_id'],
            'item_type' => $freshItem['item_type'] ?? $item['item_type'],
            'title' => $freshItem['title'] ?? $item['title'],
            'content' => $freshItem['content'] ?? $item['content'],
            'image_url' => $freshItem['image_url'] ?? $item['image_url'],
            'generated_video_url' => $freshItem['image_url'] ?? $item['image_url'],
            'generation_status' => $freshItem['generation_status'] ?? $item['generation_status'],
            'generation_count' => isset($freshItem['generation_count']) ? (int) $freshItem['generation_count'] : (int) ($item['generation_count'] ?? 0),
            'last_generated_at' => $freshItem['last_generated_at'] ?? $item['last_generated_at'],
            'last_error' => $freshItem['last_error'] ?? $item['last_error'],
            'prompt_id' => $freshItem['prompt_id'] ?? $item['prompt_id'],
        ],
        'generation' => $result,
    ]);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 6 && $segments[4] === 'video-clips' && $segments[5] === 'refresh') {
    api_require_method('POST');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $type = $segments[2];
    $projectId = (int) $segments[3];
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);

    $board = api_find_project_idea_board($pdo, $userId, $project);
    if (!$board) {
        api_error('IDEA_BOARD_NOT_FOUND', 'This project does not have an idea board yet.', 404);
    }

    $data = api_request_json();
    $itemId = (int) ($data['board_item_id'] ?? 0);
    if ($itemId <= 0) {
        api_error('INVALID_VIDEO_CLIP_ITEM', 'A valid video clip board item id is required.', 400);
    }

    $item = api_find_idea_board_item($pdo, (int) $board['board_id'], $itemId);
    if (!$item) {
        api_error('VIDEO_CLIP_ITEM_NOT_FOUND', 'The requested video clip item could not be found.', 404);
    }

    $result = api_post_idea_board_handler('refresh_item', ['item_id' => $itemId]);
    $freshItem = api_find_idea_board_item($pdo, (int) $board['board_id'], $itemId) ?? $item;

    api_success([
        'generated' => (bool) ($result['generated'] ?? false),
        'video_clip' => [
            'board_item_id' => (int) $freshItem['id'],
            'board_id' => (int) $freshItem['board_id'],
            'item_type' => $freshItem['item_type'],
            'title' => $freshItem['title'],
            'content' => $freshItem['content'],
            'generated_video_url' => $freshItem['image_url'],
            'generation_status' => $freshItem['generation_status'],
            'generation_count' => (int) ($freshItem['generation_count'] ?? 0),
            'last_generated_at' => $freshItem['last_generated_at'],
            'last_error' => $freshItem['last_error'],
            'prompt_id' => $freshItem['prompt_id'],
        ],
        'refresh' => $result,
    ]);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 6 && $segments[4] === 'bridge-clips' && $segments[5] === 'generate') {
    api_require_method('POST');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $type = $segments[2];
    $projectId = (int) $segments[3];
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);

    $data = api_request_json();
    $request = api_queue_bridge_clip_request($pdo, $userId, $project, $data);

    api_success([
        'queued' => true,
        'bridge_clip' => [
            'request_id' => (int) $request['id'],
            'track_id' => $request['track_id'],
            'before_item_id' => $request['before_item_id'],
            'after_item_id' => $request['after_item_id'],
            'prompt' => $request['prompt'],
            'duration_seconds' => (float) $request['duration_seconds'],
            'status' => $request['status'],
            'generated_video_url' => $request['generated_video_url'],
            'last_error' => $request['last_error'],
            'created_at' => $request['created_at'],
            'updated_at' => $request['updated_at'],
        ],
    ]);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'bridge-clips' && count($segments) === 4 && is_numeric($segments[2]) && $segments[3] === 'refresh') {
    api_require_method('POST');
    $requestId = (int) $segments[2];
    $request = api_find_bridge_clip_request($pdo, $userId, $requestId);
    if (!$request) {
        api_error('BRIDGE_REQUEST_NOT_FOUND', 'The requested bridge clip request could not be found.', 404);
    }
    $project = api_find_project($pdo, $userId, $request['project_type'], (int) $request['project_id']);
    if (!$project) {
        api_error_resource_not_in_studio('bridge clip request');
    }

    api_success([
        'bridge_clip' => [
            'request_id' => (int) $request['id'],
            'project_type' => $request['project_type'],
            'track_id' => $request['track_id'],
            'before_item_id' => $request['before_item_id'],
            'after_item_id' => $request['after_item_id'],
            'prompt' => $request['prompt'],
            'duration_seconds' => (float) $request['duration_seconds'],
            'status' => $request['status'],
            'generated_video_url' => $request['generated_video_url'],
            'last_error' => $request['last_error'],
            'created_at' => $request['created_at'],
            'updated_at' => $request['updated_at'],
        ],
    ]);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 8 && $segments[4] === 'idea-board' && $segments[5] === 'items' && is_numeric($segments[6])) {
    api_require_method('POST');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $type = $segments[2];
    $projectId = (int) $segments[3];
    $itemId = (int) $segments[6];
    $actionSlug = $segments[7];
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);
    $board = api_find_project_idea_board($pdo, $userId, $project);
    if (!$board) {
        api_error('IDEA_BOARD_NOT_FOUND', 'This project does not have an idea board yet.', 404);
    }

    $actionMap = [
        'prompt-preview' => 'prompt_preview',
        'generate' => 'generate_item',
        'refresh' => 'refresh_item',
        'clip-preview' => 'clip_preview',
        'clip-generate' => 'clip_generate',
        'history' => 'get_generation_history',
    ];
    $handlerAction = $actionMap[$actionSlug] ?? null;
    if ($handlerAction === null) {
        api_error('NOT_FOUND', 'Requested idea board action could not be found.', 404);
    }

    $result = api_post_idea_board_handler($handlerAction, ['item_id' => $itemId]);
    api_success($result);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 5 && $segments[4] === 'timeline') {
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $type = $segments[2];
    $projectId = (int) $segments[3];
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        api_success([
            'timeline_project' => api_load_editor_timeline($pdo, $userId, $type, $projectId),
        ]);
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $data = api_request_json();
        $name = trim((string) ($data['name'] ?? 'Untitled Timeline'));
        $timelineJson = $data['timeline_json'] ?? new stdClass();
        $timelinePayload = json_encode($timelineJson, JSON_UNESCAPED_SLASHES);
        if ($timelinePayload === false) {
            api_error('INVALID_TIMELINE', 'Timeline JSON could not be encoded.', 400);
        }

        $existing = api_load_editor_timeline($pdo, $userId, $type, $projectId);
        if ($existing) {
            $nextVersion = $existing['version'] + 1;
            $stmt = $pdo->prepare(
                'UPDATE editor_timeline_projects
                SET name = ?, timeline_json = ?, version = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?'
            );
            $stmt->execute([$name, $timelinePayload, $nextVersion, $existing['id']]);
            api_success([
                'success' => true,
                'timeline_project_id' => $existing['id'],
                'version' => $nextVersion,
                'saved_at' => gmdate('c'),
            ]);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO editor_timeline_projects (user_id, project_type, project_id, name, version, timeline_json)
            VALUES (?, ?, ?, ?, 1, ?)'
        );
        $stmt->execute([$userId, $type, $projectId, $name, $timelinePayload]);
        api_success([
            'success' => true,
            'timeline_project_id' => (int) $pdo->lastInsertId(),
            'version' => 1,
            'saved_at' => gmdate('c'),
        ], 201);
    }

    api_method_not_allowed(['GET', 'POST']);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'timeline' && count($segments) === 4 && $segments[3] === 'autosave') {
    api_require_method('POST');
    $timelineProjectId = (int) $segments[2];
    $timelineProject = api_find_editor_timeline_by_id($pdo, $userId, $timelineProjectId);
    if (!$timelineProject) {
        api_error('TIMELINE_NOT_FOUND', 'Timeline project could not be found.', 404);
    }
    $project = api_find_project($pdo, $userId, $timelineProject['project_type'], (int) $timelineProject['project_id']);
    if (!$project) {
        api_error_resource_not_in_studio('timeline');
    }
    $data = api_request_json();
    $timelineJson = $data['timeline_json'] ?? new stdClass();
    $timelinePayload = json_encode($timelineJson, JSON_UNESCAPED_SLASHES);
    if ($timelinePayload === false) {
        api_error('INVALID_TIMELINE', 'Timeline JSON could not be encoded.', 400);
    }

    $stmt = $pdo->prepare(
        'UPDATE editor_timeline_projects
        SET timeline_json = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP, autosaved_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?'
    );
    $stmt->execute([$timelinePayload, $timelineProjectId, $userId]);
    if ($stmt->rowCount() === 0) {
        api_error('TIMELINE_NOT_FOUND', 'Timeline project could not be found.', 404);
    }

    api_success([
        'success' => true,
        'timeline_project_id' => $timelineProjectId,
        'saved_at' => gmdate('c'),
    ]);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'exports' && count($segments) === 3 && $segments[2] === 'init') {
    api_require_method('POST');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $data = api_request_json();
    $type = (string) ($data['project_type'] ?? '');
    $projectId = (int) ($data['project_id'] ?? 0);
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);

    $title = trim((string) ($data['title'] ?? 'Untitled Export'));
    $exportType = trim((string) ($data['export_type'] ?? 'draft'));
    $durationSeconds = (float) ($data['duration_seconds'] ?? 0);
    $resolution = trim((string) ($data['resolution'] ?? '1920x1080'));
    $storagePath = 'uploads/editor_exports/' . $type . '_' . $projectId . '_' . time() . '.mp4';

    api_ensure_project_type_enum_support($pdo, 'editor_exports', ['film', 'episode', 'series', 'clip']);

    $stmt = $pdo->prepare(
        'INSERT INTO editor_exports (user_id, project_type, project_id, title, export_type, duration_seconds, resolution, status, storage_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$userId, $type, $projectId, $title, $exportType, $durationSeconds, $resolution, 'initialized', $storagePath]);

    api_success([
        'export_id' => (int) $pdo->lastInsertId(),
        'upload_url' => null,
        'storage_path' => $storagePath,
    ], 201);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'exports' && count($segments) === 4 && is_numeric($segments[2]) && $segments[3] === 'complete') {
    api_require_method('POST');
    $exportId = (int) $segments[2];
    $export = api_find_editor_export($pdo, $userId, $exportId);
    if (!$export) {
        api_error('EXPORT_NOT_FOUND', 'Export could not be found.', 404);
    }
    $project = api_find_project($pdo, $userId, $export['project_type'], (int) $export['project_id']);
    if (!$project) {
        api_error_resource_not_in_studio('export');
    }
    $data = api_request_json();
    $stmt = $pdo->prepare(
        'UPDATE editor_exports
        SET file_size_bytes = ?, thumbnail_url = ?, status = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND user_id = ?'
    );
    $stmt->execute([
        (int) ($data['file_size_bytes'] ?? 0),
        $data['thumbnail_url'] ?? null,
        'complete',
        $exportId,
        $userId,
    ]);

    if ($stmt->rowCount() === 0) {
        api_error('EXPORT_NOT_FOUND', 'Export could not be found.', 404);
    }

    api_success(['success' => true]);
}

if (($segments[0] ?? '') === 'editor' && ($segments[1] ?? '') === 'projects' && count($segments) === 5 && $segments[4] === 'exports') {
    api_require_method('GET');
    api_resolve_effective_studio_id($pdo, $userId, ['allow_null' => true]);
    $type = $segments[2];
    $projectId = (int) $segments[3];
    $project = api_require_project_in_scope($pdo, $userId, $type, $projectId);

    api_ensure_project_type_enum_support($pdo, 'editor_exports', ['film', 'episode', 'series', 'clip']);

    $stmt = $pdo->prepare(
        'SELECT id, title, export_type, duration_seconds, resolution, status, storage_path, thumbnail_url, file_size_bytes, created_at, completed_at
        FROM editor_exports
        WHERE user_id = ? AND project_type = ? AND project_id = ?
        ORDER BY created_at DESC'
    );
    $stmt->execute([$userId, $type, $projectId]);
    api_success([
        'exports' => array_map(
            static fn(array $row): array => [
                'id' => (int) $row['id'],
                'title' => $row['title'],
                'export_type' => $row['export_type'],
                'duration_seconds' => (float) $row['duration_seconds'],
                'resolution' => $row['resolution'],
                'status' => $row['status'],
                'storage_path' => $row['storage_path'],
                'thumbnail_url' => $row['thumbnail_url'],
                'file_size_bytes' => $row['file_size_bytes'] !== null ? (int) $row['file_size_bytes'] : null,
                'created_at' => $row['created_at'],
                'completed_at' => $row['completed_at'],
            ],
            $stmt->fetchAll()
        ),
    ]);
}

api_error('NOT_FOUND', 'Requested API route could not be found.', 404);
