<?php

// Set JSON content type header
header('Content-Type: application/json');

require_once 'db_connect.php';
require_once 'auth.php';

// Log the request method and raw input
error_log("Request Method: " . $_SERVER['REQUEST_METHOD']);
$rawInput = file_get_contents('php://input');
error_log("Raw input: " . $rawInput);
$inputData = json_decode($rawInput, true);

// Get the action from GET or POST
$action = $_GET['action'] ?? $_POST['action'] ?? ($inputData['action'] ?? '');

try {
    switch($action) {
        case 'get_entry':
            $entryId = $_GET['id'] ?? 0;
            
            $stmt = $pdo->prepare("
                SELECT * FROM codex_entries WHERE id = ?
            ");
            $stmt->execute([$entryId]);
            $entry = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$entry) {
                throw new Exception('Entry not found');
            }

            $tags = [];
            $related = [];
            try {
                $stmt = $pdo->prepare("
                    SELECT tag_name FROM codex_tags WHERE entry_id = ?
                ");
                $stmt->execute([$entryId]);
                $tags = $stmt->fetchAll(PDO::FETCH_COLUMN);

                $stmt = $pdo->prepare("
                    SELECT ce2.id, ce2.title, ce2.mention_token
                    FROM codex_relationships cr
                    JOIN codex_entries ce2 ON cr.related_entry_id = ce2.id
                    WHERE cr.entry_id = ?
                ");
                $stmt->execute([$entryId]);
                $related = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } catch (Exception $e) {
                // Optional tables may not exist in older schemas
            }
            
            $entry['tags'] = $tags;
            $entry['related'] = $related;

            echo json_encode([
                'success' => true,
                'entry' => $entry
            ]);
            break;

        case 'update_entry':
            $data = $inputData;
            if (!$data) {
                throw new Exception('Invalid JSON data received');
            }
            
            $stmt = $pdo->prepare("
                UPDATE codex_entries 
                SET title = ?,
                    entry_type = ?,
                    content = ?,
                    ai_context = ?,
                    first_appearance_date = ?,
                    last_modified_date = CURRENT_TIMESTAMP
                WHERE id = ?
            ");
            
            $result = $stmt->execute([
                $data['title'],
                $data['entry_type'],
                $data['content'],
                $data['ai_context'],
                $data['first_appearance_date'],
                $data['entry_id']
            ]);
            
            if (!$result) {
                throw new Exception('Failed to update entry');
            }

            $tags = normalizeTags($data['tags'] ?? '');
            $relatedTokens = normalizeTags($data['related_tokens'] ?? '');

            try {
                $stmt = $pdo->prepare("DELETE FROM codex_tags WHERE entry_id = ?");
                $stmt->execute([$data['entry_id']]);
                if (!empty($tags)) {
                    $stmt = $pdo->prepare("INSERT INTO codex_tags (entry_id, tag_name) VALUES (?, ?)");
                    foreach ($tags as $tag) {
                        $stmt->execute([$data['entry_id'], $tag]);
                    }
                }

                $stmt = $pdo->prepare("DELETE FROM codex_relationships WHERE entry_id = ?");
                $stmt->execute([$data['entry_id']]);
                if (!empty($relatedTokens)) {
                    $relatedIds = resolveMentionTokens($pdo, $relatedTokens);
                    if (!empty($relatedIds)) {
                        $stmt = $pdo->prepare("
                            INSERT INTO codex_relationships (entry_id, related_entry_id, relationship_type)
                            VALUES (?, ?, ?)
                        ");
                        foreach ($relatedIds as $relatedId) {
                            $stmt->execute([$data['entry_id'], $relatedId, 'related']);
                        }
                    }
                }
            } catch (Exception $e) {
                // Optional tables may not exist in older schemas
            }
            
            echo json_encode([
                'success' => true,
                'message' => 'Entry updated successfully'
            ]);
            break;

        case 'create_entry':
            $data = $inputData;
            if (!$data) {
                throw new Exception('Invalid JSON data received');
            }

            $visibility = $data['visibility_level'] ?? 'story';
            $isUniverseLevel = $visibility === 'universe';
            $universeId = $data['universe_id'] ?? null;
            $seriesId = $data['series_id'] ?? null;
            $storyId = $data['story_id'] ?? null;
            $tags = normalizeTags($data['tags'] ?? '');
            $relatedTokens = normalizeTags($data['related_tokens'] ?? '');
            
            // Start transaction
            $pdo->beginTransaction();
            
            try {
                // Insert into codex_entries
                try {
                    $stmt = $pdo->prepare("
                        INSERT INTO codex_entries (
                            title, 
                            entry_type, 
                            content, 
                            ai_context, 
                            mention_token,
                            visibility_level,
                            universe_id,
                            series_id,
                            story_id,
                            is_universe_level,
                            universe_era,
                            universe_year,
                            universe_season
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ");
                    
                    $stmt->execute([
                        $data['title'],
                        $data['entry_type'],
                        $data['content'],
                        $data['ai_context'] ?? '',
                        $data['mention_token'],
                        $visibility,
                        $universeId,
                        $seriesId,
                        $storyId,
                        $isUniverseLevel,
                        $data['era'] ?? null,
                        $data['year'] ?? null,
                        $data['season'] ?? null
                    ]);
                } catch (PDOException $e) {
                    if (strpos($e->getMessage(), 'Unknown column') === false) {
                        throw $e;
                    }
                    // Fallback for older schema without story_id/series_id/visibility fields
                    $stmt = $pdo->prepare("
                        INSERT INTO codex_entries (
                            title, 
                            entry_type, 
                            content, 
                            ai_context, 
                            mention_token,
                            universe_id,
                            universe_era,
                            universe_year,
                            universe_season
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ");
                    
                    $stmt->execute([
                        $data['title'],
                        $data['entry_type'],
                        $data['content'],
                        $data['ai_context'] ?? '',
                        $data['mention_token'],
                        $universeId,
                        $data['era'] ?? null,
                        $data['year'] ?? null,
                        $data['season'] ?? null
                    ]);
                }
                
                $entryId = $pdo->lastInsertId();
                
                // Insert into codex_availability
                try {
                    $stmt = $pdo->prepare("
                        INSERT INTO codex_availability (
                            codex_entry_id,
                            universe_id,
                            series_id,
                            story_id,
                            available_from
                        ) VALUES (?, ?, ?, ?, ?)
                    ");
                    
                    $stmt->execute([
                        $entryId,
                        $universeId,
                        $seriesId,
                        $storyId,
                        $data['first_appearance_date']
                    ]);
                } catch (PDOException $e) {
                    if (strpos($e->getMessage(), 'Unknown column') === false) {
                        throw $e;
                    }
                    $stmt = $pdo->prepare("
                        INSERT INTO codex_availability (
                            codex_entry_id,
                            universe_id,
                            available_from
                        ) VALUES (?, ?, ?)
                    ");
                    $stmt->execute([
                        $entryId,
                        $universeId,
                        $data['first_appearance_date']
                    ]);
                }

                try {
                    if (!empty($tags)) {
                        $stmt = $pdo->prepare("INSERT INTO codex_tags (entry_id, tag_name) VALUES (?, ?)");
                        foreach ($tags as $tag) {
                            $stmt->execute([$entryId, $tag]);
                        }
                    }

                    if (!empty($relatedTokens)) {
                        $relatedIds = resolveMentionTokens($pdo, $relatedTokens);
                        if (!empty($relatedIds)) {
                            $stmt = $pdo->prepare("
                                INSERT INTO codex_relationships (entry_id, related_entry_id, relationship_type)
                                VALUES (?, ?, ?)
                            ");
                            foreach ($relatedIds as $relatedId) {
                                $stmt->execute([$entryId, $relatedId, 'related']);
                            }
                        }
                    }
                } catch (Exception $e) {
                    // Optional tables may not exist in older schemas
                }
                
                $pdo->commit();
                
                echo json_encode([
                    'success' => true,
                    'mention_token' => $data['mention_token'],
                    'entry_id' => $entryId
                ]);
                
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            break;

        case 'search_mentions':
            $query = $_GET['query'] ?? '';
            $currentStoryId = $_GET['story_id'] ?? 0;
            $currentSeriesId = $_GET['series_id'] ?? 0;
            $currentUniverseId = $_GET['universe_id'] ?? 0;

            if (empty($currentStoryId)) {
                echo json_encode([
                    'success' => true,
                    'suggestions' => []
                ]);
                break;
            }
            
            // Get current story's timeline date
            $stmt = $pdo->prepare("
                SELECT timeline_date, series_id, universe_id 
                FROM stories 
                WHERE id = ?
            ");
            $stmt->execute([$currentStoryId]);
            $currentStory = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$currentStory) {
                throw new Exception('Story not found');
            }

            if (empty($currentSeriesId)) {
                $currentSeriesId = $currentStory['series_id'] ?? 0;
            }
            if (empty($currentUniverseId)) {
                $currentUniverseId = $currentStory['universe_id'] ?? 0;
            }
            
            // Query for available codex entries
            $stmt = $pdo->prepare("
                SELECT DISTINCT ce.mention_token, ce.title, ce.entry_type 
                FROM codex_entries ce
                LEFT JOIN codex_availability ca ON ce.id = ca.codex_entry_id
                WHERE (
                    -- Universe level entries are always available (within current universe if set)
                    (ce.is_universe_level = TRUE AND (:universeId = 0 OR ce.universe_id = :universeId))
                    OR
                    -- Series level entries from the same series
                    (ca.series_id = :currentSeriesId AND ca.available_from <= :currentDate)
                    OR
                    -- Series level entries from other series that came before
                    (ca.series_id IN (
                        SELECT id FROM series 
                        WHERE universe_id = :universeId 
                        AND chronological_order < (
                            SELECT chronological_order FROM series WHERE id = :currentSeriesId
                        )
                    ))
                    OR
                    -- Story level entries from current or previous stories
                    (ca.story_id IN (
                        SELECT id FROM stories 
                        WHERE timeline_date <= :currentDate
                        AND (series_id = :currentSeriesId OR series_id IN (
                            SELECT id FROM series 
                            WHERE chronological_order < (
                                SELECT chronological_order FROM series WHERE id = :currentSeriesId
                            )
                        ))
                    ))
                )
                AND (ce.mention_token LIKE :query OR ce.title LIKE :query)
                ORDER BY ce.title
                LIMIT 5
            ");
            
            $stmt->execute([
                'currentSeriesId' => $currentSeriesId,
                'currentDate' => $currentStory['timeline_date'],
                'universeId' => $currentUniverseId,
                'query' => "%$query%"
            ]);
            
            $suggestions = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            error_log("Found suggestions: " . print_r($suggestions, true));
            
            echo json_encode([
                'success' => true,
                'suggestions' => $suggestions
            ]);
            break;

        case 'get_scene_contexts':
            $sceneId = $_GET['scene_id'] ?? 0;
            error_log("Getting contexts for scene: " . $sceneId);
            
            $stmt = $pdo->prepare("
                SELECT ce.ai_context 
                FROM scene_beat_references sbr
                JOIN codex_entries ce ON sbr.codex_entry_id = ce.id
                WHERE sbr.scene_id = ?
            ");
            $stmt->execute([$sceneId]);
            $contexts = $stmt->fetchAll(PDO::FETCH_COLUMN);
            
            echo json_encode([
                'success' => true,
                'contexts' => $contexts
            ]);
            break;

        default:
            throw new Exception('Invalid action: ' . $action);
    }
} catch (Exception $e) {
    error_log("Error in codex_handlers.php: " . $e->getMessage());
    error_log("Stack trace: " . $e->getTraceAsString());
    
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function normalizeTags($tagsInput) {
    if (is_array($tagsInput)) {
        $raw = $tagsInput;
    } else {
        $raw = preg_split('/[,\\n]+/', (string)$tagsInput);
    }
    $tags = [];
    foreach ($raw as $tag) {
        $tag = trim($tag);
        if ($tag === '') {
            continue;
        }
        $tags[] = $tag;
    }
    return array_values(array_unique($tags));
}

function resolveMentionTokens($pdo, $tokens) {
    if (empty($tokens)) {
        return [];
    }
    $cleanTokens = [];
    foreach ($tokens as $token) {
        $token = trim($token);
        if ($token === '') {
            continue;
        }
        if ($token[0] !== '@') {
            $token = '@' . $token;
        }
        $cleanTokens[] = $token;
    }
    if (empty($cleanTokens)) {
        return [];
    }
    $placeholders = implode(',', array_fill(0, count($cleanTokens), '?'));
    $stmt = $pdo->prepare("SELECT id FROM codex_entries WHERE mention_token IN ($placeholders)");
    $stmt->execute($cleanTokens);
    return $stmt->fetchAll(PDO::FETCH_COLUMN);
}
