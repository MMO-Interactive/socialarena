<?php
require_once 'includes/db_connect.php';
require_once 'includes/auth.php';
require_once 'includes/studio_access.php';

$story_id = isset($_GET['story_id']) ? (int)$_GET['story_id'] : 0;
$include_chronology = isset($_GET['include_chronology']) && $_GET['include_chronology'] === '1';

$stmt = $pdo->prepare("SELECT s.*, ser.title as series_title, ser.universe_id as series_universe_id FROM stories s LEFT JOIN series ser ON s.series_id = ser.id WHERE s.id = ?");
$stmt->execute([$story_id]);
$story = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$story) {
    die('Story not found');
}
try {
    enforceStoryAccess($pdo, $story_id, (int)$_SESSION['user_id'], false);
} catch (Exception $e) {
    die('Unauthorized');
}

$universe_id = $story['universe_id'] ?? $story['series_universe_id'] ?? null;
$series_id = $story['series_id'] ?? null;

$page_title = "Story Codex - " . htmlspecialchars($story['title']);
$additional_css = ['css/universe_codex.css'];

// Build list of story IDs to include (for chronological option)
$story_ids = [$story_id];
if ($include_chronology) {
    if (!empty($series_id)) {
        [$storyWhere, $storyParams] = buildStudioVisibilityWhere('s', (int)$_SESSION['user_id'], 'stories');
        $stmt = $pdo->prepare("SELECT s.id, s.timeline_date, s.created_at FROM stories s WHERE s.series_id = ? AND {$storyWhere}");
        $stmt->execute(array_merge([$series_id], $storyParams));
    } else {
        [$storyWhere, $storyParams] = buildStudioVisibilityWhere('s', (int)$_SESSION['user_id'], 'stories');
        $stmt = $pdo->prepare("SELECT s.id, s.timeline_date, s.created_at FROM stories s WHERE s.universe_id = ? AND s.series_id IS NULL AND {$storyWhere}");
        $stmt->execute(array_merge([$universe_id], $storyParams));
    }
    $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($candidates as $candidate) {
        if ((int)$candidate['id'] === $story_id) {
            continue;
        }
        if (!empty($story['timeline_date']) && !empty($candidate['timeline_date'])) {
            if ($candidate['timeline_date'] <= $story['timeline_date']) {
                $story_ids[] = (int)$candidate['id'];
            }
        } else {
            if ($candidate['created_at'] <= $story['created_at']) {
                $story_ids[] = (int)$candidate['id'];
            }
        }
    }
}
$story_ids = array_values(array_unique($story_ids));

$placeholders = implode(',', array_fill(0, count($story_ids), '?'));

// Load entries: story-level + series-level + universe-level
$conditions = [];
$params = [];

$conditions[] = "ce.story_id IN ($placeholders)";
$params = array_merge($params, $story_ids);

if (!empty($series_id)) {
    $conditions[] = "ce.series_id = ?";
    $params[] = $series_id;
}

if (!empty($universe_id)) {
    $conditions[] = "(ce.is_universe_level = TRUE AND ce.universe_id = ?)";
    $params[] = $universe_id;
}

$query = "
    SELECT ce.*, 
           CASE
               WHEN ce.story_id IS NOT NULL THEN st.title
               WHEN ce.is_universe_level = TRUE THEN 'Universe Level'
               ELSE ser.title
           END as source_title,
           COALESCE(ser.chronological_order, 0) as source_order
    FROM codex_entries ce
    LEFT JOIN series ser ON ce.series_id = ser.id
    LEFT JOIN stories st ON ce.story_id = st.id
    WHERE " . implode(' OR ', $conditions) . "
    ORDER BY ce.is_universe_level DESC, ser.chronological_order ASC, ce.first_appearance_date ASC
";
$stmt = $pdo->prepare($query);
$stmt->execute($params);
$entries = $stmt->fetchAll(PDO::FETCH_ASSOC);

// Load relationships for graph view
$relationships = [];
if (!empty($entries)) {
    $entry_ids = array_column($entries, 'id');
    $entry_placeholders = implode(',', array_fill(0, count($entry_ids), '?'));
    try {
        $stmt = $pdo->prepare("SELECT entry_id, related_entry_id FROM codex_relationships WHERE entry_id IN ($entry_placeholders)");
        $stmt->execute($entry_ids);
        $relationships = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        $relationships = [];
    }
}

// Load tags
$entry_tags = [];
$all_tags = [];
if (!empty($entries)) {
    $entry_ids = array_column($entries, 'id');
    $entry_placeholders = implode(',', array_fill(0, count($entry_ids), '?'));
    try {
        $stmt = $pdo->prepare("SELECT entry_id, tag_name FROM codex_tags WHERE entry_id IN ($entry_placeholders) ORDER BY tag_name ASC");
        $stmt->execute($entry_ids);
        $tags = $stmt->fetchAll(PDO::FETCH_ASSOC);
        foreach ($tags as $row) {
            $entry_tags[$row['entry_id']][] = $row['tag_name'];
            $all_tags[$row['tag_name']] = true;
        }
    } catch (Exception $e) {
        $entry_tags = [];
        $all_tags = [];
    }
}
$all_tags = array_keys($all_tags);
sort($all_tags);

$grouped_entries = [];
foreach ($entries as $entry) {
    $grouped_entries[$entry['entry_type']][] = $entry;
}

include 'includes/header.php';
?>

<div class="page-wrapper">
    <div class="content-wrapper">
        <?php include 'includes/navigation.php'; ?>
        <main class="main-content">
            <div class="codex-header">
                <h1><?php echo htmlspecialchars($story['title']); ?> - Story Codex</h1>
                <a href="create_codex_entry.php?story_id=<?php echo (int)$story_id; ?>" class="btn create-entry">
                    <i class="fas fa-plus"></i> New Entry
                </a>
            </div>

            <div class="codex-controls">
                <input type="text" id="codex-search" placeholder="Search entries...">
                <select id="codex-type-filter">
                    <option value="">All Types</option>
                    <?php foreach (array_keys($grouped_entries) as $type): ?>
                        <option value="<?php echo htmlspecialchars($type); ?>"><?php echo ucfirst($type); ?></option>
                    <?php endforeach; ?>
                </select>
                <select id="codex-tag-filter">
                    <option value="">All Tags</option>
                    <?php foreach ($all_tags as $tag): ?>
                        <option value="<?php echo htmlspecialchars($tag); ?>"><?php echo htmlspecialchars($tag); ?></option>
                    <?php endforeach; ?>
                </select>
                <select id="codex-sort">
                    <option value="date">Sort: Date</option>
                    <option value="title">Sort: Title</option>
                    <option value="source">Sort: Source Order</option>
                </select>
                <select id="codex-view">
                    <option value="cards">View: Cards</option>
                    <option value="timeline">View: Timeline</option>
                    <option value="graph">View: Graph</option>
                </select>
                <a class="btn" href="story_codex.php?story_id=<?php echo $story_id; ?>&include_chronology=<?php echo $include_chronology ? '0' : '1'; ?>">
                    <?php echo $include_chronology ? 'Hide Chronology' : 'Include Chronology'; ?>
                </a>
                <button type="button" class="btn" id="codex-clear">Clear Filters</button>
                <button type="button" class="btn" id="codex-export">Export CSV</button>
                <div class="codex-count" id="codex-count"></div>
            </div>

            <div class="codex-layout" id="codex-cards-view">
                <div class="codex-sidebar">
                    <div class="entry-types">
                        <h3>Entry Types</h3>
                        <ul>
                            <?php foreach ($grouped_entries as $type => $entries): ?>
                            <li>
                                <a href="#<?php echo $type; ?>" class="type-link">
                                    <i class="fas fa-<?php echo getTypeIcon($type); ?>"></i>
                                    <?php echo ucfirst($type); ?>
                                    <span class="count"><?php echo count($entries); ?></span>
                                </a>
                            </li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                </div>

                <div class="codex-content">
                    <?php foreach ($grouped_entries as $type => $entries): ?>
                    <section id="<?php echo $type; ?>" class="entry-section">
                        <h2><?php echo ucfirst($type); ?></h2>
                        <div class="entries-grid">
                            <?php foreach ($entries as $entry): ?>
                            <?php $tags = $entry_tags[$entry['id']] ?? []; ?>
                            <div class="entry-card"
                                 data-id="<?php echo htmlspecialchars($entry['id']); ?>"
                                 data-title="<?php echo htmlspecialchars(strtolower($entry['title'])); ?>"
                                 data-type="<?php echo htmlspecialchars($entry['entry_type']); ?>"
                                 data-tags="<?php echo htmlspecialchars(strtolower(implode(',', $tags))); ?>"
                                 data-token="<?php echo htmlspecialchars($entry['mention_token']); ?>"
                                 data-content="<?php echo htmlspecialchars(strtolower(substr($entry['content'], 0, 300))); ?>"
                                 data-date="<?php echo htmlspecialchars($entry['first_appearance_date'] ?? ''); ?>"
                                 data-source-order="<?php echo htmlspecialchars($entry['source_order'] ?? 0); ?>">
                                <div class="entry-card-header">
                                    <h3><?php echo htmlspecialchars($entry['title']); ?></h3>
                                    <span class="source-tag <?php echo $entry['is_universe_level'] ? 'universe' : 'series'; ?>">
                                        <?php echo htmlspecialchars($entry['source_title']); ?>
                                    </span>
                                </div>
                                <div class="entry-card-content">
                                    <?php echo substr(htmlspecialchars($entry['content']), 0, 150) . '...'; ?>
                                </div>
                                <div class="entry-card-footer">
                                    <span class="mention-token"><?php echo htmlspecialchars($entry['mention_token']); ?></span>
                                    <?php if (!empty($tags)): ?>
                                        <span class="entry-tags"><?php echo htmlspecialchars(implode(', ', $tags)); ?></span>
                                    <?php endif; ?>
                                    <div class="entry-actions">
                                        <button onclick="quickView(<?php echo $entry['id']; ?>)"><i class="fas fa-info-circle"></i></button>
                                        <button onclick="editEntry(<?php echo $entry['id']; ?>)"><i class="fas fa-edit"></i></button>
                                        <button onclick="viewEntry(<?php echo $entry['id']; ?>)"><i class="fas fa-eye"></i></button>
                                    </div>
                                </div>
                            </div>
                            <?php endforeach; ?>
                        </div>
                    </section>
                    <?php endforeach; ?>
                </div>
            </div>

            <div class="codex-layout codex-timeline" id="codex-timeline-view" style="display: none;">
                <div class="codex-content">
                    <div class="entry-section">
                        <h2>Timeline</h2>
                        <div id="codex-timeline-list"></div>
                    </div>
                </div>
            </div>

            <div class="codex-layout codex-graph" id="codex-graph-view" style="display: none;">
                <div class="codex-content">
                    <div class="entry-section">
                        <h2>Relationship Graph</h2>
                        <canvas id="codex-graph-canvas" width="900" height="500"></canvas>
                    </div>
                </div>
            </div>
        </main>
    </div>
</div>

<script>
window.codexGraph = {
    nodes: <?php echo json_encode(array_map(function($e) {
        return [
            'id' => (int)$e['id'],
            'title' => $e['title'],
            'token' => $e['mention_token'],
            'type' => $e['entry_type']
        ];
    }, $entries)); ?>,
    edges: <?php echo json_encode($relationships); ?>
};
</script>

<script src="js/universe_codex.js"></script>

<?php
function getTypeIcon($type) {
    $icons = [
        'character' => 'user',
        'location' => 'map-marker-alt',
        'item' => 'box',
        'concept' => 'lightbulb',
        'event' => 'calendar-alt'
    ];
    return $icons[$type] ?? 'book';
}
?>
