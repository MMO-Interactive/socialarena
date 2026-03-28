-- Adventure schema (clean base)

CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(191) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    profile_photo VARCHAR(255) DEFAULT NULL,
    profile_header VARCHAR(255) DEFAULT NULL,
    bio TEXT,
    location VARCHAR(100) DEFAULT NULL,
    website VARCHAR(255) DEFAULT NULL,
    social_links JSON,
    story_count INT DEFAULT 0,
    favorite_genres JSON,
    theme_preference VARCHAR(10) DEFAULT 'light',
    is_admin BOOLEAN DEFAULT FALSE,
    UNIQUE KEY unique_username (username),
    UNIQUE KEY unique_email (email)
);

CREATE TABLE IF NOT EXISTS studios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    owner_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    banner_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);


CREATE TABLE IF NOT EXISTS user_comfy_connections (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    connection_type ENUM('image', 'audio', 'video') NOT NULL,
    base_url VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) DEFAULT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_connection (user_id, connection_type),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS universes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    studio_id INT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image VARCHAR(255),
    created_by INT NOT NULL,
    user_id INT NULL,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('active', 'completed', 'on_hold', 'cancelled') DEFAULT 'active',
    is_public BOOLEAN DEFAULT TRUE,
    date_format JSON DEFAULT NULL,
    date_description TEXT NOT NULL DEFAULT '',
    last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_modified_by INT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (last_modified_by) REFERENCES users(id),
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS series (
    id INT PRIMARY KEY AUTO_INCREMENT,
    universe_id INT NULL,
    studio_id INT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    cover_image VARCHAR(255),
    created_by INT NOT NULL,
    user_id INT NULL,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    status ENUM('ongoing', 'completed', 'planned', 'on_hold', 'cancelled') DEFAULT 'ongoing',
    series_order INT NULL,
    chronological_order INT NULL,
    timeline_start DATETIME NULL,
    timeline_end DATETIME NULL,
    is_public BOOLEAN DEFAULT TRUE,
    last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_modified_by INT NULL,
    FOREIGN KEY (universe_id) REFERENCES universes(id) ON DELETE SET NULL,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (last_modified_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS stories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    genre VARCHAR(100) NOT NULL,
    setting VARCHAR(255) NOT NULL,
    main_character TEXT,
    default_style VARCHAR(255) DEFAULT NULL,
    default_perspective VARCHAR(255) DEFAULT NULL,
    description TEXT,
    thumbnail_url TEXT,
    is_ai_generated BOOLEAN DEFAULT TRUE,
    story_type ENUM('standalone', 'series_entry', 'universe_entry') DEFAULT 'standalone',
    status ENUM('draft', 'published', 'archived') DEFAULT 'draft',
    story_order INT NULL,
    timeline_date DATETIME NULL,
    chronological_order INT NULL,
    universe_id INT NULL,
    series_id INT NULL,
    user_id INT NULL,
    studio_id INT NULL,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_modified_by INT NULL,
    FOREIGN KEY (universe_id) REFERENCES universes(id) ON DELETE SET NULL,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (last_modified_by) REFERENCES users(id)
);


CREATE TABLE IF NOT EXISTS series_seasons (
    id INT PRIMARY KEY AUTO_INCREMENT,
    series_id INT NOT NULL,
    studio_id INT NULL,
    title VARCHAR(255) NOT NULL,
    season_number INT NOT NULL,
    description TEXT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    UNIQUE KEY unique_season_number (series_id, season_number)
);

CREATE TABLE IF NOT EXISTS series_episodes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    season_id INT NOT NULL,
    studio_id INT NULL,
    title VARCHAR(255) NOT NULL,
    episode_number INT NOT NULL,
    description TEXT,
    story_id INT NULL,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (season_id) REFERENCES series_seasons(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE SET NULL,
    UNIQUE KEY unique_episode_number (season_id, episode_number)
);

CREATE TABLE IF NOT EXISTS projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    studio_id INT NULL,
    project_type ENUM('film', 'episode') NOT NULL,
    story_id INT NULL,
    episode_id INT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    status ENUM('planning', 'in_progress', 'paused', 'completed') DEFAULT 'planning',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_project_story (story_id),
    UNIQUE KEY unique_project_episode (episode_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE SET NULL,
    FOREIGN KEY (episode_id) REFERENCES series_episodes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS project_tasks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    studio_id INT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status ENUM('todo', 'in_progress', 'done') DEFAULT 'todo',
    priority ENUM('low', 'medium', 'high') DEFAULT 'medium',
    due_date DATE NULL,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS project_milestones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    studio_id INT NULL,
    title VARCHAR(255) NOT NULL,
    target_date DATE NULL,
    status ENUM('upcoming', 'at_risk', 'completed') DEFAULT 'upcoming',
    notes TEXT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS project_shots (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    studio_id INT NULL,
    shot_label VARCHAR(50),
    description TEXT,
    location VARCHAR(255),
    shot_type VARCHAR(100),
    status ENUM('planned', 'blocked', 'shot') DEFAULT 'planned',
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS film_budgets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    studio_id INT NULL,
    currency VARCHAR(10) DEFAULT 'USD',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_film_budget (project_id),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS film_budget_categories (
    id INT PRIMARY KEY AUTO_INCREMENT,
    budget_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (budget_id) REFERENCES film_budgets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS film_budget_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    category_id INT NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    vendor VARCHAR(255),
    notes TEXT,
    quantity DECIMAL(10,2) DEFAULT 1,
    unit_cost DECIMAL(12,2) DEFAULT 0,
    status ENUM('planned', 'approved', 'spent') DEFAULT 'planned',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES film_budget_categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS timeline_projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    story_id INT NULL,
    studio_id INT NULL,
    title VARCHAR(255) NOT NULL,
    fps INT DEFAULT 24,
    duration_seconds INT DEFAULT 300,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_timeline_story (story_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE SET NULL,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS timeline_tracks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    project_id INT NOT NULL,
    studio_id INT NULL,
    name VARCHAR(255) NOT NULL,
    track_type ENUM('video', 'audio', 'image', 'text') DEFAULT 'video',
    track_order INT DEFAULT 0,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES timeline_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS timeline_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    track_id INT NOT NULL,
    studio_id INT NULL,
    item_type ENUM('video', 'audio', 'image', 'text') NOT NULL,
    label VARCHAR(255),
    file_url TEXT,
    start_time DECIMAL(10,2) DEFAULT 0,
    duration DECIMAL(10,2) DEFAULT 5,
    notes TEXT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (track_id) REFERENCES timeline_tracks(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS pages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    story_id INT,
    studio_id INT NULL,
    content TEXT NOT NULL,
    mood VARCHAR(100),
    location VARCHAR(255),
    active_characters TEXT,
    image_url TEXT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS story_responses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    page_id INT,
    next_page_id INT,
    user_response TEXT NOT NULL,
    FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
    FOREIGN KEY (next_page_id) REFERENCES pages(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS story_progress (
    user_id INT,
    story_id INT,
    current_page_id INT,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, story_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (story_id) REFERENCES stories(id),
    FOREIGN KEY (current_page_id) REFERENCES pages(id)
);

CREATE TABLE IF NOT EXISTS user_api_keys (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    key_type VARCHAR(50) NOT NULL,
    key_value TEXT NOT NULL,
    encrypted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used TIMESTAMP NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY unique_user_key_type (user_id, key_type)
);

CREATE TABLE IF NOT EXISTS user_favorites (
    user_id INT,
    story_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, story_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (story_id) REFERENCES stories(id)
);

CREATE TABLE IF NOT EXISTS story_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    story_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_story_rating (user_id, story_id)
);

CREATE TABLE IF NOT EXISTS story_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    story_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS story_completions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    story_id INT NOT NULL,
    user_id INT NOT NULL,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_follows (
    follower_id INT NOT NULL,
    following_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_bookmarks (
    user_id INT NOT NULL,
    story_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    PRIMARY KEY (user_id, story_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS story_achievements (
    id INT PRIMARY KEY AUTO_INCREMENT,
    story_id INT NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS user_achievements (
    user_id INT NOT NULL,
    achievement_id INT NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, achievement_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES story_achievements(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS universe_details (
    id INT PRIMARY KEY AUTO_INCREMENT,
    universe_id INT NOT NULL,
    studio_id INT NULL,
    detail_type ENUM('lore', 'magic_system', 'technology', 'rules', 'timeline', 'other'),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    order_position INT DEFAULT 0,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    FOREIGN KEY (universe_id) REFERENCES universes(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS characters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar_image VARCHAR(255),
    universe_id INT NULL,
    series_id INT NULL,
    story_id INT NULL,
    studio_id INT NULL,
    created_by INT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    character_type ENUM('protagonist', 'antagonist', 'supporting', 'minor') DEFAULT 'supporting',
    status ENUM('active', 'deceased', 'unknown') DEFAULT 'active',
    FOREIGN KEY (universe_id) REFERENCES universes(id) ON DELETE CASCADE,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS locations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image VARCHAR(255),
    universe_id INT NULL,
    series_id INT NULL,
    story_id INT NULL,
    studio_id INT NULL,
    parent_location_id INT NULL,
    created_by INT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (universe_id) REFERENCES universes(id) ON DELETE CASCADE,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_location_id) REFERENCES locations(id),
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS element_relationships (
    id INT PRIMARY KEY AUTO_INCREMENT,
    element_type_1 ENUM('character', 'location', 'item', 'story', 'series', 'universe'),
    element_id_1 INT NOT NULL,
    element_type_2 ENUM('character', 'location', 'item', 'story', 'series', 'universe'),
    element_id_2 INT NOT NULL,
    relationship_type VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collaborators (
    id INT PRIMARY KEY AUTO_INCREMENT,
    element_type ENUM('universe', 'series', 'story'),
    element_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('owner', 'admin', 'editor', 'writer', 'viewer') DEFAULT 'viewer',
    invited_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (invited_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS system_prompts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    type ENUM('universe', 'series', 'story', 'character', 'location', 'plot') NOT NULL,
    purpose ENUM('title', 'description', 'content', 'suggestion') NOT NULL,
    prompt_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_prompt (name, type, purpose)
);

CREATE TABLE IF NOT EXISTS user_prompts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    type ENUM('universe', 'series', 'story', 'character', 'location', 'plot') NOT NULL,
    purpose ENUM('title', 'description', 'content', 'suggestion') NOT NULL,
    prompt_text TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS story_acts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    story_id INT NOT NULL,
    studio_id INT NULL,
    title VARCHAR(255) NOT NULL,
    act_order INT NOT NULL,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS story_chapters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    act_id INT NOT NULL,
    studio_id INT NULL,
    title VARCHAR(255) NOT NULL,
    chapter_order INT NOT NULL,
    word_count INT DEFAULT 0,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (act_id) REFERENCES story_acts(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS story_scenes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    chapter_id INT NOT NULL,
    studio_id INT NULL,
    title VARCHAR(255),
    description TEXT,
    scene_order INT NOT NULL,
    word_count INT DEFAULT 0,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (chapter_id) REFERENCES story_chapters(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);


CREATE TABLE IF NOT EXISTS story_scene_clips (
    id INT PRIMARY KEY AUTO_INCREMENT,
    scene_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    clip_order INT NOT NULL,
    starting_image_prompt TEXT,
    starting_image_prompt_id VARCHAR(64),
    starting_image_status ENUM('idle', 'queued', 'generated', 'failed') DEFAULT 'idle',
    clip_prompt TEXT,
    clip_prompt_id VARCHAR(64),
    clip_status ENUM('idle', 'queued', 'generated', 'failed') DEFAULT 'idle',
    clip_video_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (scene_id) REFERENCES story_scenes(id) ON DELETE CASCADE,
    INDEX idx_scene_clip_order (scene_id, clip_order)
);

CREATE TABLE IF NOT EXISTS clip_blocks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    clip_id INT NOT NULL,
    block_type ENUM('scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'image') NOT NULL,
    content TEXT NOT NULL,
    image_url TEXT,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (clip_id) REFERENCES story_scene_clips(id) ON DELETE CASCADE,
    INDEX idx_clip_order (clip_id, sort_order)
);



CREATE TABLE IF NOT EXISTS scene_characters (
    scene_id INT NOT NULL,
    character_name VARCHAR(191) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scene_id, character_name),
    FOREIGN KEY (scene_id) REFERENCES story_scenes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scene_locations (
    scene_id INT NOT NULL,
    location_name VARCHAR(191) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scene_id, location_name),
    FOREIGN KEY (scene_id) REFERENCES story_scenes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scene_labels (
    scene_id INT NOT NULL,
    label_name VARCHAR(191) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (scene_id, label_name),
    FOREIGN KEY (scene_id) REFERENCES story_scenes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scene_content (
    id INT PRIMARY KEY AUTO_INCREMENT,
    scene_id INT NOT NULL,
    studio_id INT NULL,
    content TEXT,
    word_count INT DEFAULT 0,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (scene_id) REFERENCES story_scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS screenplay_blocks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    scene_id INT NOT NULL,
    studio_id INT NULL,
    block_type ENUM('scene_heading', 'action', 'character', 'parenthetical', 'dialogue', 'transition', 'image') NOT NULL,
    content TEXT,
    sort_order INT NOT NULL,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (scene_id) REFERENCES story_scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    INDEX idx_scene_order (scene_id, sort_order)
);

CREATE TABLE IF NOT EXISTS scene_choices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    scene_id INT NOT NULL,
    next_scene_id INT,
    choice_text TEXT,
    choice_order INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (scene_id) REFERENCES story_scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (next_scene_id) REFERENCES story_scenes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS scene_references (
    id INT PRIMARY KEY AUTO_INCREMENT,
    scene_id INT NOT NULL,
    term VARCHAR(255) NOT NULL,
    reference_type ENUM('character', 'location', 'item', 'ability', 'event', 'other'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scene_id) REFERENCES story_scenes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scene_beat_references (
    id INT PRIMARY KEY AUTO_INCREMENT,
    scene_id INT NOT NULL,
    codex_entry_id INT NOT NULL,
    mention_text VARCHAR(255) NOT NULL,
    mention_position INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (scene_id) REFERENCES story_scenes(id) ON DELETE CASCADE,
    FOREIGN KEY (codex_entry_id) REFERENCES codex_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS codex_entries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    universe_id INT,
    series_id INT NULL,
    story_id INT NULL,
    studio_id INT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    ai_context TEXT,
    entry_type VARCHAR(50),
    mention_token VARCHAR(50) UNIQUE,
    universe_era VARCHAR(10) NULL,
    universe_year INT NULL,
    universe_season VARCHAR(10) NULL,
    timeline_date DATETIME NULL,
    chronological_order INT NULL,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    visibility_level ENUM('universe', 'series', 'story') DEFAULT 'story',
    first_appearance_story_id INT NULL,
    first_appearance_date DATETIME NULL,
    last_modified_date DATETIME NULL,
    is_universe_level BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (universe_id) REFERENCES universes(id) ON DELETE CASCADE,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    FOREIGN KEY (first_appearance_story_id) REFERENCES stories(id),
    INDEX idx_timeline (timeline_date, chronological_order),
    INDEX idx_universe_date (universe_era, universe_year, universe_season)
);

CREATE TABLE IF NOT EXISTS codex_relationships (
    id INT PRIMARY KEY AUTO_INCREMENT,
    entry_id INT,
    related_entry_id INT,
    relationship_type VARCHAR(50),
    FOREIGN KEY (entry_id) REFERENCES codex_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (related_entry_id) REFERENCES codex_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS codex_tags (
    entry_id INT,
    tag_name VARCHAR(50),
    PRIMARY KEY (entry_id, tag_name),
    FOREIGN KEY (entry_id) REFERENCES codex_entries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS codex_availability (
    id INT PRIMARY KEY AUTO_INCREMENT,
    codex_entry_id INT NOT NULL,
    universe_id INT NULL,
    series_id INT NULL,
    story_id INT NULL,
    available_from DATETIME NOT NULL,
    FOREIGN KEY (codex_entry_id) REFERENCES codex_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (universe_id) REFERENCES universes(id) ON DELETE CASCADE,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    INDEX idx_codex_chronology (universe_id, series_id, story_id, available_from)
);

CREATE TABLE IF NOT EXISTS story_chronology (
    id INT PRIMARY KEY AUTO_INCREMENT,
    universe_id INT,
    series_id INT NULL,
    story_id INT,
    chronological_order INT NOT NULL,
    timeline_date DATETIME,
    FOREIGN KEY (universe_id) REFERENCES universes(id),
    FOREIGN KEY (series_id) REFERENCES series(id),
    FOREIGN KEY (story_id) REFERENCES stories(id),
    UNIQUE KEY unique_chronology (universe_id, series_id, chronological_order)
);

CREATE TABLE IF NOT EXISTS admin_activity_log (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS admin_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(50) UNIQUE NOT NULL,
    setting_value TEXT,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    updated_by INT,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS admin_activity (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id INT NOT NULL,
    action_type VARCHAR(50) NOT NULL,
    action_details TEXT,
    affected_table VARCHAR(50),
    affected_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS idea_boards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    studio_id INT NULL,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS idea_board_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    board_id INT NOT NULL,
    studio_id INT NULL,
    item_type ENUM('note', 'image', 'link', 'style', 'style_selector', 'character', 'location', 'scene', 'camera', 'prop', 'wardrobe', 'lighting', 'vfx', 'audio', 'dialogue', 'beat', 'clip') NOT NULL,
    title VARCHAR(255),
    content TEXT,
    image_url TEXT,
    link_url TEXT,
    prompt_text TEXT,
    generated_image_url TEXT,
    generation_status ENUM('idle', 'queued', 'generated', 'failed') DEFAULT 'idle',
    generation_count INT DEFAULT 0,
    last_generated_at TIMESTAMP NULL,
    last_error TEXT,
    prompt_id VARCHAR(64),
    pos_x INT DEFAULT 20,
    pos_y INT DEFAULT 20,
    width INT DEFAULT 240,
    height INT DEFAULT 160,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES idea_boards(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    INDEX idx_board_position (board_id, pos_x, pos_y)
);

CREATE TABLE IF NOT EXISTS idea_board_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    board_id INT NOT NULL,
    source_item_id INT NOT NULL,
    target_item_id INT NOT NULL,
    link_type ENUM('style', 'note') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (board_id) REFERENCES idea_boards(id) ON DELETE CASCADE,
    FOREIGN KEY (source_item_id) REFERENCES idea_board_items(id) ON DELETE CASCADE,
    FOREIGN KEY (target_item_id) REFERENCES idea_board_items(id) ON DELETE CASCADE,
    UNIQUE KEY unique_link (source_item_id, target_item_id)
);

CREATE TABLE IF NOT EXISTS idea_board_generations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    item_id INT NOT NULL,
    prompt_text TEXT,
    prompt_id VARCHAR(64),
    image_url TEXT,
    status ENUM('queued', 'generated', 'failed') DEFAULT 'queued',
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (item_id) REFERENCES idea_board_items(id) ON DELETE CASCADE,
    INDEX idx_item_created (item_id, created_at)
);

CREATE TABLE IF NOT EXISTS idea_board_generation_links (
    id INT PRIMARY KEY AUTO_INCREMENT,
    generation_id INT NOT NULL,
    source_item_id INT NOT NULL,
    source_type VARCHAR(50),
    source_title VARCHAR(255),
    link_type ENUM('style', 'note') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (generation_id) REFERENCES idea_board_generations(id) ON DELETE CASCADE,
    FOREIGN KEY (source_item_id) REFERENCES idea_board_items(id) ON DELETE CASCADE,
    INDEX idx_generation (generation_id)
);

CREATE TABLE IF NOT EXISTS editor_project_idea_boards (
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
);

CREATE TABLE IF NOT EXISTS editor_bridge_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
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
);

CREATE TABLE IF NOT EXISTS virtual_actors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    studio_id INT NULL,
    name VARCHAR(255) NOT NULL,
    gender VARCHAR(50),
    age_range VARCHAR(50),
    description TEXT,
    tags VARCHAR(255),
    avatar_url TEXT,
    profile_notes TEXT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS studio_locations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    studio_id INT NULL,
    name VARCHAR(255) NOT NULL,
    location_type VARCHAR(100),
    region VARCHAR(255),
    description TEXT,
    tags VARCHAR(255),
    cover_image_url TEXT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS studio_wardrobes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    studio_id INT NULL,
    series_id INT NULL,
    name VARCHAR(255) NOT NULL,
    wardrobe_type VARCHAR(100),
    description TEXT,
    tags VARCHAR(255),
    cover_image_url TEXT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS studio_wardrobe_gallery (
    id INT PRIMARY KEY AUTO_INCREMENT,
    wardrobe_id INT NOT NULL,
    image_url TEXT NOT NULL,
    caption VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wardrobe_id) REFERENCES studio_wardrobes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS studio_wardrobe_variations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    wardrobe_id INT NOT NULL,
    studio_id INT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_url TEXT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (wardrobe_id) REFERENCES studio_wardrobes(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS studio_props (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    studio_id INT NULL,
    series_id INT NULL,
    name VARCHAR(255) NOT NULL,
    prop_type VARCHAR(100),
    description TEXT,
    tags VARCHAR(255),
    cover_image_url TEXT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS studio_prop_gallery (
    id INT PRIMARY KEY AUTO_INCREMENT,
    prop_id INT NOT NULL,
    image_url TEXT NOT NULL,
    caption VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prop_id) REFERENCES studio_props(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS studio_music_library (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    studio_id INT NULL,
    title VARCHAR(255) NOT NULL,
    artist VARCHAR(255),
    genre VARCHAR(100),
    bpm VARCHAR(20),
    musical_key VARCHAR(50),
    mood VARCHAR(100),
    description TEXT,
    tags VARCHAR(255),
    file_url TEXT NOT NULL,
    cover_image_url TEXT,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'private',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);




CREATE TABLE IF NOT EXISTS studio_youtube_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    studio_id INT NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    channel_id VARCHAR(64) DEFAULT NULL,
    channel_handle VARCHAR(100) DEFAULT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_studio_youtube (studio_id),
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS studio_livestreams (
    id INT PRIMARY KEY AUTO_INCREMENT,
    studio_id INT NOT NULL,
    channel_id VARCHAR(64) NOT NULL,
    channel_title VARCHAR(255) DEFAULT NULL,
    video_id VARCHAR(32) NOT NULL,
    title VARCHAR(255) DEFAULT NULL,
    description TEXT,
    thumbnail_url TEXT,
    is_live BOOLEAN DEFAULT TRUE,
    started_at DATETIME NULL,
    ended_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_studio_video (studio_id, video_id),
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);



CREATE TABLE IF NOT EXISTS studio_members (
    id INT PRIMARY KEY AUTO_INCREMENT,
    studio_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('owner', 'admin', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_member (studio_id, user_id),
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS studio_permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    studio_id INT NOT NULL,
    user_id INT NOT NULL,
    permission_key VARCHAR(100) NOT NULL,
    allowed TINYINT(1) DEFAULT 0,
    UNIQUE KEY unique_permission (studio_id, user_id, permission_key),
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS studio_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    studio_id INT NOT NULL,
    user_id INT NOT NULL,
    post_type ENUM('update', 'theme', 'visual') DEFAULT 'update',
    title VARCHAR(255),
    body TEXT,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS studio_post_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES studio_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS studio_followers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    studio_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_follow (studio_id, user_id),
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS studio_visual_posts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    studio_id INT NOT NULL,
    title VARCHAR(255),
    image_url TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS paypal_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    mode ENUM('sandbox', 'live') DEFAULT 'sandbox',
    client_id VARCHAR(255) NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    webhook_id VARCHAR(255) DEFAULT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscription_plans (
    id INT PRIMARY KEY AUTO_INCREMENT,
    slug VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_monthly DECIMAL(10,2) DEFAULT 0,
    price_yearly DECIMAL(10,2) DEFAULT 0,
    currency VARCHAR(10) DEFAULT 'USD',
    paypal_plan_id_monthly VARCHAR(255) DEFAULT NULL,
    paypal_plan_id_yearly VARCHAR(255) DEFAULT NULL,
    features JSON DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    plan_id INT NOT NULL,
    provider ENUM('paypal') DEFAULT 'paypal',
    status ENUM('created', 'active', 'cancelled', 'past_due', 'expired') DEFAULT 'created',
    billing_interval ENUM('month', 'year') DEFAULT 'month',
    provider_subscription_id VARCHAR(255) DEFAULT NULL,
    current_period_end DATETIME NULL,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    started_at DATETIME NULL,
    ended_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_provider_subscription (provider_subscription_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES subscription_plans(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscription_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    provider ENUM('paypal') DEFAULT 'paypal',
    event_type VARCHAR(255) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    user_id INT NULL,
    payload JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_event (provider, event_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS studio_location_gallery (
    id INT PRIMARY KEY AUTO_INCREMENT,
    location_id INT NOT NULL,
    image_url TEXT NOT NULL,
    caption VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (location_id) REFERENCES studio_locations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS series_cast (
    id INT PRIMARY KEY AUTO_INCREMENT,
    series_id INT NOT NULL,
    actor_id INT NOT NULL,
    role_name VARCHAR(255),
    character_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_series_actor (series_id, actor_id),
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES virtual_actors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS virtual_actor_gallery (
    id INT PRIMARY KEY AUTO_INCREMENT,
    actor_id INT NOT NULL,
    image_url TEXT NOT NULL,
    caption VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES virtual_actors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS virtual_actor_audio (
    id INT PRIMARY KEY AUTO_INCREMENT,
    actor_id INT NOT NULL,
    audio_url TEXT NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES virtual_actors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS virtual_actor_galleries (
    id INT PRIMARY KEY AUTO_INCREMENT,
    actor_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES virtual_actors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS virtual_actor_gallery_images (
    id INT PRIMARY KEY AUTO_INCREMENT,
    gallery_id INT NOT NULL,
    image_url TEXT NOT NULL,
    caption VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (gallery_id) REFERENCES virtual_actor_galleries(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS series_social_settings (
    series_id INT PRIMARY KEY,
    checkpoint_name VARCHAR(255) DEFAULT NULL,
    negative_prompt TEXT,
    width INT DEFAULT 1024,
    height INT DEFAULT 1024,
    steps INT DEFAULT 30,
    cfg_scale DECIMAL(5,2) DEFAULT 7.0,
    sampler_name VARCHAR(50) DEFAULT 'euler',
    scheduler VARCHAR(50) DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS series_social_weeks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    series_id INT NOT NULL,
    week_start DATE NOT NULL,
    theme VARCHAR(255) NOT NULL,
    status ENUM('draft', 'queued', 'generated') DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS series_social_assets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    week_id INT NOT NULL,
    day_index INT NOT NULL,
    prompt TEXT,
    custom_prompt TEXT,
    shot_type VARCHAR(255),
    include_bts BOOLEAN DEFAULT FALSE,
    image_url TEXT,
    alt_image_url TEXT,
    status ENUM('pending', 'queued', 'generated', 'failed') DEFAULT 'pending',
    prompt_id VARCHAR(64),
    alt_status ENUM('pending', 'queued', 'generated', 'failed') DEFAULT 'pending',
    alt_prompt_id VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (week_id) REFERENCES series_social_weeks(id) ON DELETE CASCADE,
    UNIQUE KEY unique_week_day (week_id, day_index)
);

CREATE TABLE IF NOT EXISTS series_public_media (
    id INT PRIMARY KEY AUTO_INCREMENT,
    series_id INT NOT NULL,
    season_id INT NULL,
    episode_id INT NULL,
    studio_id INT NULL,
    media_type ENUM('trailer', 'clip', 'screenshot') NOT NULL,
    title VARCHAR(255),
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    release_title VARCHAR(255),
    release_description TEXT,
    release_status ENUM('draft', 'released') NOT NULL DEFAULT 'draft',
    released_at DATETIME NULL,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'public',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE CASCADE,
    FOREIGN KEY (season_id) REFERENCES series_seasons(id) ON DELETE SET NULL,
    FOREIGN KEY (episode_id) REFERENCES series_episodes(id) ON DELETE SET NULL,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS series_public_media_likes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    media_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_media_like (media_id, user_id),
    FOREIGN KEY (media_id) REFERENCES series_public_media(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS series_public_media_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    media_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (media_id) REFERENCES series_public_media(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS story_public_media (
    id INT PRIMARY KEY AUTO_INCREMENT,
    story_id INT NOT NULL,
    studio_id INT NULL,
    media_type ENUM('trailer', 'clip', 'screenshot') NOT NULL,
    title VARCHAR(255),
    url TEXT NOT NULL,
    thumbnail_url TEXT,
    release_title VARCHAR(255),
    release_description TEXT,
    release_status ENUM('draft', 'released') NOT NULL DEFAULT 'draft',
    released_at DATETIME NULL,
    visibility ENUM('private', 'studio', 'public') DEFAULT 'public',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS story_public_media_likes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    media_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_story_media_like (media_id, user_id),
    FOREIGN KEY (media_id) REFERENCES story_public_media(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS story_public_media_comments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    media_id INT NOT NULL,
    user_id INT NOT NULL,
    comment TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (media_id) REFERENCES story_public_media(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS talent_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL UNIQUE,
    description VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS talent_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    headline VARCHAR(255),
    bio TEXT,
    location VARCHAR(255),
    website VARCHAR(255),
    contact_email VARCHAR(255),
    availability ENUM('available', 'limited', 'unavailable') DEFAULT 'available',
    avatar_url TEXT,
    banner_url TEXT,
    is_public TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS talent_profile_roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    profile_id INT NOT NULL,
    role_id INT NOT NULL,
    is_primary TINYINT(1) DEFAULT 0,
    UNIQUE KEY unique_profile_role (profile_id, role_id),
    FOREIGN KEY (profile_id) REFERENCES talent_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES talent_roles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS talent_portfolio_items (
    id INT PRIMARY KEY AUTO_INCREMENT,
    profile_id INT NOT NULL,
    item_type ENUM('link', 'audio', 'file', 'image') NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    item_url TEXT NOT NULL,
    file_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (profile_id) REFERENCES talent_profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS studio_talent_requests (
    id INT PRIMARY KEY AUTO_INCREMENT,
    studio_id INT NOT NULL,
    created_by INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    roles VARCHAR(255),
    tags VARCHAR(255),
    location VARCHAR(255),
    compensation VARCHAR(255),
    contact_email VARCHAR(255),
    status ENUM('open', 'closed') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS studio_talent_applications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    request_id INT NOT NULL,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    portfolio_url TEXT,
    status ENUM('new', 'reviewed', 'archived') DEFAULT 'new',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_application (request_id, user_id),
    FOREIGN KEY (request_id) REFERENCES studio_talent_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public_news (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    excerpt TEXT,
    body TEXT NOT NULL,
    cover_image_url TEXT,
    author_id INT NOT NULL,
    status ENUM('draft', 'published') DEFAULT 'draft',
    published_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
);

INSERT IGNORE INTO system_prompts (name, type, purpose, prompt_text) VALUES
('Universe Title Generator', 'universe', 'title',
 'Generate {count} unique and creative names for a story universe. Each name should be intriguing and suitable for a collection of stories. Return only the names, one per line, without numbers or bullet points.'),
('Universe Description Generator', 'universe', 'description',
 'Generate {count} unique and engaging descriptions for a story universe named "{title}". Each description should be 2-3 sentences long and paint a vivid picture of the universe''s essence. Return only the descriptions, one per line, without numbers or bullet points.'),
('Series Title Generator', 'series', 'title',
 'Generate {count} unique and creative names for a story series {universe_context}. Each name should be intriguing and suitable for a collection of related stories. Return only the names, one per line, without numbers or bullet points.'),
('Series Description Generator', 'series', 'description',
 'Generate {count} unique and engaging descriptions for a story series titled "{title}" {universe_context}. Each description should be 2-3 sentences long and paint a vivid picture of what readers can expect from the series. Return only the descriptions, one per line, without numbers or bullet points.'),
('Story Title Generator', 'story', 'title',
 'Generate {count} unique and creative titles for a {genre} story. {context}. Each title should be intriguing and suitable for an interactive story. Return only the titles, one per line, without numbers or bullet points.'),
('Story Description Generator', 'story', 'description',
 'Generate {count} unique and engaging descriptions for a {genre} story titled "{title}". {context}. Each description should be 2-3 sentences long and paint a vivid picture of what readers can expect. Return only the descriptions, one per line, without numbers or bullet points.');

INSERT IGNORE INTO admin_settings (setting_key, setting_value, description) VALUES
('analytics_retention_days', '365', 'Number of days to retain detailed analytics data'),
('max_failed_logins', '5', 'Maximum failed login attempts before account lockout'),
('lockout_duration_minutes', '30', 'Duration of account lockout in minutes');

INSERT IGNORE INTO subscription_plans (slug, name, description, price_monthly, price_yearly, currency, features, is_active, sort_order) VALUES
('creator', 'Creator', 'Solo creators building AI films and short series.', 19.00, 190.00, 'USD', JSON_ARRAY('Idea boards + ComfyUI hooks', 'Screenplay editor + Fountain export', 'Public studio + series pages'), 1, 1),
('studio', 'Studio', 'Teams managing multi-series production pipelines.', 59.00, 590.00, 'USD', JSON_ARRAY('Team studios + permissions', 'Production boards, budgets, timelines', 'Public media pages + clips'), 1, 2),
('enterprise', 'Enterprise', 'Advanced studio controls and custom workflows.', 199.00, 1990.00, 'USD', JSON_ARRAY('Priority integrations', 'Custom workflows', 'Dedicated support'), 1, 3);

CREATE TABLE IF NOT EXISTS gpu_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    runpod_template_id VARCHAR(128) NOT NULL,
    gpu_type VARCHAR(100) DEFAULT NULL,
    vram_gb INT DEFAULT NULL,
    hourly_rate DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gpu_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    studio_id INT NULL,
    template_id INT NOT NULL,
    runpod_pod_id VARCHAR(128) DEFAULT NULL,
    status ENUM('pending','starting','running','stopped','failed') DEFAULT 'pending',
    requested_minutes INT DEFAULT 60,
    connection_url TEXT,
    public_ip VARCHAR(64) DEFAULT NULL,
    region VARCHAR(64) DEFAULT NULL,
    started_at DATETIME NULL,
    ended_at DATETIME NULL,
    last_heartbeat DATETIME NULL,
    cost_usd DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (studio_id) REFERENCES studios(id) ON DELETE SET NULL,
    FOREIGN KEY (template_id) REFERENCES gpu_templates(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS gpu_usage_events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    session_id INT NOT NULL,
    event_type ENUM('start','stop','heartbeat','billing_tick','failure') NOT NULL,
    meta_json JSON DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES gpu_sessions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS editor_timeline_projects (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    project_type ENUM('film', 'episode', 'series', 'clip') NOT NULL,
    project_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    timeline_json LONGTEXT NOT NULL,
    autosaved_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_editor_timeline (user_id, project_type, project_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS editor_exports (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    project_type ENUM('film', 'episode', 'series', 'clip') NOT NULL,
    project_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    export_type VARCHAR(50) NOT NULL DEFAULT 'draft',
    duration_seconds DECIMAL(10,2) DEFAULT 0,
    resolution VARCHAR(32) DEFAULT '1920x1080',
    status VARCHAR(50) NOT NULL DEFAULT 'initialized',
    storage_path TEXT NULL,
    thumbnail_url TEXT NULL,
    file_size_bytes BIGINT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

