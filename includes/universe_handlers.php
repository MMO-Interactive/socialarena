<?php

// Set JSON content type header
header('Content-Type: application/json');

require_once 'db_connect.php';
require_once 'auth.php';
require_once 'studio_access.php';

// Get the raw input
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (!$data) {
    $data = $_POST;
}

try {
    if (!isset($data['action'])) {
        throw new Exception('No action specified');
    }

    switch($data['action']) {
        case 'update_universe':
            // Validate required fields
            if (!isset($data['universe_id'])) {
                throw new Exception('Universe ID is required');
            }

            // Start transaction
            $pdo->beginTransaction();

            try {
                $studioId = !empty($data['studio_id']) ? (int)$data['studio_id'] : null;
                $visibility = normalizeVisibility($data['visibility'] ?? 'private', $studioId);
                enforceStudioPermission($pdo, $studioId, (int)$_SESSION['user_id'], 'universes');

                // Update basic universe info
                $stmt = $pdo->prepare("
                    UPDATE universes 
                    SET title = ?,
                        description = ?,
                        date_format = ?,
                        date_description = ?,
                        studio_id = ?,
                        visibility = ?
                    WHERE id = ?
                ");

                $dateFormatInput = $data['date_format'] ?? [];
                if (is_string($dateFormatInput)) {
                    $decoded = json_decode($dateFormatInput, true);
                    if (is_array($decoded)) {
                        $dateFormatInput = $decoded;
                    }
                }

                $dateFormat = [
                    'calendar_type' => $dateFormatInput['calendar_type'] ?? 'standard',
                    'eras' => $dateFormatInput['eras'] ?? [],
                    'era_names' => $dateFormatInput['era_names'] ?? [],
                    'divisions' => $dateFormatInput['divisions'] ?? [],
                    'custom_months' => $dateFormatInput['custom_months'] ?? [],
                    'custom_divisions' => $dateFormatInput['custom_divisions'] ?? []
                ];

                if (isset($_FILES['cover_image']) && $_FILES['cover_image']['error'] === UPLOAD_ERR_OK) {
                    $allowed = ['jpg', 'jpeg', 'png', 'gif'];
                    $filename = $_FILES['cover_image']['name'];
                    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
                    
                    if (!in_array($ext, $allowed)) {
                        throw new Exception('Invalid file type. Allowed types: ' . implode(', ', $allowed));
                    }
                    
                    // Generate unique filename
                    $newFilename = uniqid() . '.' . $ext;
                    $uploadPath = '../uploads/covers/' . $newFilename;
                    
                    if (!move_uploaded_file($_FILES['cover_image']['tmp_name'], $uploadPath)) {
                        throw new Exception('Failed to upload image');
                    }
                    
                    // Update the cover_image field in the database query
                    $stmt = $pdo->prepare("
                        UPDATE universes 
                        SET title = ?,
                            description = ?,
                            date_format = ?,
                            date_description = ?,
                            cover_image = ?,
                            studio_id = ?,
                            visibility = ?
                        WHERE id = ?
                    ");
                    
                    $stmt->execute([
                        $data['title'],
                        $data['description'],
                        json_encode($dateFormat),
                        $data['date_description'],
                        'uploads/covers/' . $newFilename,
                        $studioId,
                        $visibility,
                        $data['universe_id']
                    ]);
                } else {
                    // Original update without changing cover image
                    $stmt = $pdo->prepare("
                        UPDATE universes 
                        SET title = ?,
                            description = ?,
                            date_format = ?,
                            date_description = ?,
                            studio_id = ?,
                            visibility = ?
                        WHERE id = ?
                    ");
                    
                    $stmt->execute([
                        $data['title'],
                        $data['description'],
                        json_encode($dateFormat),
                        $data['date_description'],
                        $studioId,
                        $visibility,
                        $data['universe_id']
                    ]);
                }

                // Update any existing codex entries to use new date format if needed
                if ($dateFormat['calendar_type'] !== 'standard') {
                    // Clear old date fields that don't apply to new format
                    $stmt = $pdo->prepare("
                        UPDATE codex_entries 
                        SET universe_era = NULL,
                            universe_season = NULL
                        WHERE universe_id = ?
                    ");
                    $stmt->execute([$data['universe_id']]);
                }

                $pdo->commit();

                echo json_encode([
                    'success' => true,
                    'universe_id' => $data['universe_id'],
                    'message' => 'Universe updated successfully'
                ]);

            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
            break;

        case 'get_date_format':
            if (!isset($data['universe_id'])) {
                throw new Exception('Universe ID is required');
            }

            $stmt = $pdo->prepare("
                SELECT date_format, date_description 
                FROM universes 
                WHERE id = ?
            ");
            $stmt->execute([$data['universe_id']]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$result) {
                throw new Exception('Universe not found');
            }

            echo json_encode([
                'success' => true,
                'date_format' => json_decode($result['date_format'], true),
                'date_description' => $result['date_description']
            ]);
            break;

        case 'format_date':
            // Helper endpoint to format dates according to universe rules
            if (!isset($data['universe_id']) || !isset($data['date'])) {
                throw new Exception('Universe ID and date are required');
            }

            $stmt = $pdo->prepare("SELECT date_format FROM universes WHERE id = ?");
            $stmt->execute([$data['universe_id']]);
            $universe = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$universe) {
                throw new Exception('Universe not found');
            }

            $dateFormat = json_decode($universe['date_format'], true);
            $formattedDate = formatUniverseDate($data['date'], $dateFormat);

            echo json_encode([
                'success' => true,
                'formatted_date' => $formattedDate
            ]);
            break;

        default:
            throw new Exception('Invalid action');
    }

} catch (Exception $e) {
    error_log("Error in universe_handlers.php: " . $e->getMessage());
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

function formatUniverseDate($date, $dateFormat) {
    switch($dateFormat['calendar_type']) {
        case 'standard':
            return sprintf(
                "%s %d %s",
                $date['division'] ?? '',
                $date['year'],
                $date['era']
            );

        case 'age':
            return sprintf(
                "Year %d of the %s",
                $date['year'],
                $date['age']
            );

        case 'lunar':
            return sprintf(
                "Year %d, %s",
                $date['year'],
                $date['moon']
            );

        default:
            return 'Unknown date format';
    }
} 
