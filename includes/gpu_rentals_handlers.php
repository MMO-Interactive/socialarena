<?php
require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/studio_access.php';
require_once __DIR__ . '/runpod.php';

header('Content-Type: application/json');

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'error' => 'Unauthorized']);
    exit;
}

function jsonPayload(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

$payload = jsonPayload();
$action = $_GET['action'] ?? $_POST['action'] ?? ($payload['action'] ?? '');

try {
    switch ($action) {
        case 'list_templates':
            $stmt = $pdo->query("SELECT * FROM gpu_templates WHERE is_active = 1 ORDER BY hourly_rate ASC");
            echo json_encode(['success' => true, 'items' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        case 'list_gpus':
            $query = 'query { gpuTypes { id displayName memoryInGb communityPrice securePrice communitySpotPrice secureSpotPrice } }';
            $result = runpodRequest($query);
            if (empty($result['success'])) {
                throw new Exception('Runpod error: ' . json_encode($result['error'] ?? $result));
            }
            echo json_encode(['success' => true, 'items' => $result['data']['gpuTypes'] ?? []]);
            break;

        case 'list_pod_templates':
            $templates = runpodListTemplates();
            $savedStmt = $pdo->query("SELECT runpod_template_id FROM gpu_templates");
            $saved = $savedStmt->fetchAll(PDO::FETCH_COLUMN);
            $savedMap = array_fill_keys($saved ?: [], true);
            $templates = array_map(static function ($tpl) use ($savedMap) {
                $tpl['isSaved'] = isset($savedMap[$tpl['id'] ?? '']);
                return $tpl;
            }, $templates);
            echo json_encode(['success' => true, 'items' => $templates]);
            break;

        case 'create_template':
            $name = trim((string)($payload['name'] ?? ''));
            $runpodTemplateId = trim((string)($payload['runpod_template_id'] ?? ''));
            $gpuType = trim((string)($payload['gpu_type'] ?? ''));
            $vramGb = isset($payload['vram_gb']) ? (int)$payload['vram_gb'] : null;
            $hourlyRate = isset($payload['hourly_rate']) ? (float)$payload['hourly_rate'] : 0;
            if ($name === '' || $runpodTemplateId === '') {
                throw new Exception('Template name and RunPod template ID are required.');
            }
            $stmt = $pdo->prepare("
                INSERT INTO gpu_templates (name, runpod_template_id, gpu_type, vram_gb, hourly_rate, is_active)
                VALUES (?, ?, ?, ?, ?, 1)
            ");
            $stmt->execute([$name, $runpodTemplateId, $gpuType ?: null, $vramGb ?: null, $hourlyRate]);
            echo json_encode(['success' => true]);
            break;

        case 'list_sessions':
            $stmt = $pdo->prepare("
                SELECT s.*, t.name AS template_name, t.hourly_rate
                FROM gpu_sessions s
                JOIN gpu_templates t ON s.template_id = t.id
                WHERE s.user_id = ?
                ORDER BY s.created_at DESC
                LIMIT 50
            ");
            $stmt->execute([$_SESSION['user_id']]);
            echo json_encode(['success' => true, 'items' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
            break;

        case 'list_live_pods':
            $result = runpodListPods();
            $pods = array_map(static function ($pod) {
                if (empty($pod['id'])) {
                    return $pod;
                }
                $metrics = runpodGetPodMetrics($pod['id']);
                if ($metrics) {
                    $pod['utilization'] = [
                        'gpu' => $metrics['gpuUtilization'] ?? ($metrics['gpu'] ?? null),
                        'cpu' => $metrics['cpuUtilization'] ?? ($metrics['cpu'] ?? null)
                    ];
                    $pod['memory'] = [
                        'used' => $metrics['memoryUsedGb'] ?? ($metrics['memoryUsed'] ?? null),
                        'total' => $metrics['memoryTotalGb'] ?? ($metrics['memoryTotal'] ?? null),
                        'percent' => $metrics['memoryUtilization'] ?? ($metrics['memoryPercent'] ?? null)
                    ];
                    $pod['disk'] = [
                        'used' => $metrics['diskUsedGb'] ?? ($metrics['diskUsed'] ?? null),
                        'total' => $metrics['diskTotalGb'] ?? ($metrics['diskTotal'] ?? null),
                        'percent' => $metrics['diskUtilization'] ?? ($metrics['diskPercent'] ?? null)
                    ];
                }
                return $pod;
            }, $result);
            echo json_encode(['success' => true, 'items' => $pods]);
            break;

        case 'stop_live_pod':
            $podId = trim((string)($payload['pod_id'] ?? ''));
            if ($podId === '') {
                throw new Exception('Pod ID required');
            }
            $result = runpodTerminatePod($podId);
            if (empty($result['success'])) {
                throw new Exception('Runpod error: ' . json_encode($result['error'] ?? $result));
            }
            echo json_encode(['success' => true]);
            break;

        case 'start_session':
            $podTemplateId = trim((string)($payload['pod_template_id'] ?? ''));
            $podTemplateName = trim((string)($payload['pod_template_name'] ?? ''));
            $gpuTypeId = trim((string)($payload['gpu_type_id'] ?? ''));
            $gpuCount = (int)($payload['gpu_count'] ?? 1);
            $pricingType = trim((string)($payload['pricing_type'] ?? 'on_demand'));
            $cloudType = trim((string)($payload['cloud_type'] ?? 'secure'));
            $podName = trim((string)($payload['pod_name'] ?? ''));
            $minutes = (int)($payload['requested_minutes'] ?? 60);
            if ($podTemplateId === '' || $gpuTypeId === '') {
                throw new Exception('Template and GPU are required');
            }
            $gpuCount = max(1, min(4, $gpuCount));
            $minutes = max(10, min(360, $minutes));

            $templateId = null;
            $stmt = $pdo->prepare("SELECT * FROM gpu_templates WHERE runpod_template_id = ? LIMIT 1");
            $stmt->execute([$podTemplateId]);
            $template = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$template) {
                $stmt = $pdo->prepare("
                    INSERT INTO gpu_templates (name, runpod_template_id, gpu_type, vram_gb, hourly_rate, is_active)
                    VALUES (?, ?, NULL, NULL, 0, 1)
                ");
                $stmt->execute([$podTemplateName ?: $podTemplateId, $podTemplateId]);
                $templateId = (int)$pdo->lastInsertId();
            } else {
                $templateId = (int)$template['id'];
            }

            $stmt = $pdo->prepare("
                INSERT INTO gpu_sessions (user_id, template_id, status, requested_minutes)
                VALUES (?, ?, 'pending', ?)
            ");
            $stmt->execute([$_SESSION['user_id'], $templateId, $minutes]);
            $sessionId = (int)$pdo->lastInsertId();

            $name = $podName !== '' ? $podName : ('user-' . $_SESSION['user_id'] . '-session-' . $sessionId);
            $result = runpodDeployPod($podTemplateId, $gpuTypeId, $gpuCount, $pricingType, $cloudType, $name);
            if (empty($result['success'])) {
                $stmt = $pdo->prepare("UPDATE gpu_sessions SET status = 'failed' WHERE id = ?");
                $stmt->execute([$sessionId]);
                throw new Exception('Runpod error: ' . json_encode($result['error'] ?? $result));
            }

            $podId = $result['data']['podCreate']['id'] ?? null;
            $stmt = $pdo->prepare("UPDATE gpu_sessions SET status = 'starting', runpod_pod_id = ? WHERE id = ?");
            $stmt->execute([$podId, $sessionId]);
            echo json_encode(['success' => true, 'session_id' => $sessionId, 'pod_id' => $podId]);
            break;

        case 'stop_session':
            $sessionId = (int)($payload['session_id'] ?? 0);
            if (!$sessionId) {
                throw new Exception('Session required');
            }
            $stmt = $pdo->prepare("
                SELECT s.*, t.hourly_rate
                FROM gpu_sessions s
                JOIN gpu_templates t ON s.template_id = t.id
                WHERE s.id = ? AND s.user_id = ?
            ");
            $stmt->execute([$sessionId, $_SESSION['user_id']]);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$session) {
                throw new Exception('Invalid session');
            }

            if (!empty($session['runpod_pod_id'])) {
                runpodTerminatePod($session['runpod_pod_id']);
            }

            $endedAt = date('Y-m-d H:i:s');
            $startedAt = $session['started_at'] ?? $session['created_at'];
            $elapsed = max(0, (strtotime($endedAt) - strtotime($startedAt)) / 3600);
            $cost = round($elapsed * (float)$session['hourly_rate'], 2);

            $stmt = $pdo->prepare("
                UPDATE gpu_sessions
                SET status = 'stopped', ended_at = ?, cost_usd = ?
                WHERE id = ?
            ");
            $stmt->execute([$endedAt, $cost, $sessionId]);
            echo json_encode(['success' => true, 'cost' => $cost]);
            break;

        case 'refresh_session':
            $sessionId = (int)($payload['session_id'] ?? 0);
            $stmt = $pdo->prepare("SELECT * FROM gpu_sessions WHERE id = ? AND user_id = ?");
            $stmt->execute([$sessionId, $_SESSION['user_id']]);
            $session = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$session) {
                throw new Exception('Invalid session');
            }
            if (empty($session['runpod_pod_id'])) {
                echo json_encode(['success' => true, 'session' => $session]);
                break;
            }
            $pod = runpodGetPod($session['runpod_pod_id']);
            if (!empty($pod['success'])) {
                $runtime = $pod['data']['pod']['runtime'] ?? [];
                $publicIp = $runtime['publicIp'] ?? null;
                $status = strtolower($pod['data']['pod']['desiredStatus'] ?? $session['status']);
                $connUrl = $publicIp ? 'http://' . $publicIp : $session['connection_url'];
                $stmt = $pdo->prepare("UPDATE gpu_sessions SET public_ip = ?, connection_url = ?, status = ? WHERE id = ?");
                $stmt->execute([$publicIp, $connUrl, $status, $sessionId]);
                $session['public_ip'] = $publicIp;
                $session['connection_url'] = $connUrl;
                $session['status'] = $status;
            }
            echo json_encode(['success' => true, 'session' => $session]);
            break;

        default:
            throw new Exception('Invalid action');
    }
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
