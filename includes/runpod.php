<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db_connect.php';

function runpodApiKey(): string {
    if (defined('RUNPOD_API_KEY') && RUNPOD_API_KEY !== '') {
        return RUNPOD_API_KEY;
    }
    try {
        global $pdo;
        if (!$pdo) {
            return '';
        }
        $stmt = $pdo->prepare("SELECT setting_value FROM admin_settings WHERE setting_key = 'runpod_api_key' LIMIT 1");
        $stmt->execute();
        $value = $stmt->fetchColumn();
        return $value ? (string)$value : '';
    } catch (Throwable $e) {
        return '';
    }
}

function runpodRequest(string $query, array $variables = []): array {
    $apiKey = runpodApiKey();
    if ($apiKey === '') {
        return ['success' => false, 'error' => 'Runpod API key not configured'];
    }

    $payloadData = ['query' => $query];
    if (!empty($variables)) {
        $payloadData['variables'] = $variables;
    }
    $payload = json_encode($payloadData);
    $ch = curl_init('https://api.runpod.io/graphql');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $apiKey,
        'Content-Type: application/json'
    ]);
    curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    if (!defined('APP_ENV') || APP_ENV !== 'production') {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    }

    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        return ['success' => false, 'error' => $error];
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $decoded = json_decode($response, true);
    if ($status >= 400 || isset($decoded['errors'])) {
        return ['success' => false, 'error' => $decoded['errors'] ?? $decoded, 'status' => $status];
    }
    return ['success' => true, 'data' => $decoded['data'] ?? $decoded];
}

function runpodRestRequest(string $path, array $params = []): array {
    $apiKey = runpodApiKey();
    if ($apiKey === '') {
        return ['success' => false, 'error' => 'Runpod API key not configured'];
    }
    $query = http_build_query($params);
    $url = 'https://rest.runpod.io/v1/' . ltrim($path, '/');
    if ($query) {
        $url .= '?' . $query;
    }
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $apiKey
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 20);
    if (!defined('APP_ENV') || APP_ENV !== 'production') {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    }
    $response = curl_exec($ch);
    if ($response === false) {
        $error = curl_error($ch);
        curl_close($ch);
        return ['success' => false, 'error' => $error];
    }
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $decoded = json_decode($response, true);
    if ($status >= 400) {
        return ['success' => false, 'error' => $decoded ?: $response, 'status' => $status];
    }
    return ['success' => true, 'data' => $decoded];
}

function runpodListTemplates(): array {
    $result = runpodRestRequest('templates', [
        'includeRunpodTemplates' => 'true',
        'includePublicTemplates' => 'true',
        'includeEndpointBoundTemplates' => 'false',
        'isServerless' => 'false'
    ]);
    if (empty($result['success'])) {
        throw new Exception('Runpod error: ' . json_encode($result['error'] ?? $result));
    }
    $items = $result['data'] ?? [];
    if (isset($items['templates']) && is_array($items['templates'])) {
        $items = $items['templates'];
    }
    return array_map(static function ($tpl) {
        return [
            'id' => $tpl['id'] ?? null,
            'name' => $tpl['name'] ?? ($tpl['templateName'] ?? 'Template'),
            'imageName' => $tpl['imageName'] ?? '',
            'category' => $tpl['category'] ?? ($tpl['type'] ?? ''),
            'isRunpod' => $tpl['isRunpod'] ?? false,
            'isPublic' => $tpl['isPublic'] ?? false,
            'dockerArgs' => $tpl['dockerArgs'] ?? '',
            'ports' => $tpl['ports'] ?? [],
            'env' => $tpl['env'] ?? [],
            'volumeInGb' => $tpl['volumeInGb'] ?? null,
            'containerDiskInGb' => $tpl['containerDiskInGb'] ?? null,
            'volumeMountPath' => $tpl['volumeMountPath'] ?? null
        ];
    }, $items);
}

function runpodListPods(): array {
    $result = runpodRestRequest('pods');
    if (empty($result['success'])) {
        throw new Exception('Runpod error: ' . json_encode($result['error'] ?? $result));
    }
    $items = $result['data'] ?? [];
    if (isset($items['pods']) && is_array($items['pods'])) {
        $items = $items['pods'];
    }
    return array_map(static function ($pod) {
        $runtime = $pod['runtime'] ?? [];
        $ports = $runtime['ports'] ?? ($pod['ports'] ?? []);
        $publicPort = '';
        if (is_array($ports)) {
            foreach ($ports as $port) {
                if (!is_array($port)) {
                    continue;
                }
                $isPublic = $port['isIpPublic'] ?? ($port['isPublic'] ?? null);
                if ($isPublic === true || $isPublic === 1 || $isPublic === 'true') {
                    $publicPort = $port['publicPort'] ?? $port['port'] ?? '';
                    if ($publicPort !== '') {
                        break;
                    }
                }
            }
        }
        $util = $pod['utilization'] ?? ($runtime['utilization'] ?? []);
        $memory = $pod['memory'] ?? ($runtime['memory'] ?? []);
        $disk = $pod['disk'] ?? ($runtime['disk'] ?? []);
        $gpuCount = $pod['gpuCount'] ?? ($pod['gpuCountRequested'] ?? 1);
        $cost = $pod['costPerHr'] ?? ($pod['pricePerHr'] ?? ($pod['costPerHour'] ?? null));
        return [
            'id' => $pod['id'] ?? null,
            'name' => $pod['name'] ?? '',
            'status' => strtolower($pod['desiredStatus'] ?? ($pod['status'] ?? 'unknown')),
            'machineId' => $pod['machineId'] ?? '',
            'gpuTypeId' => $pod['gpuTypeId'] ?? ($pod['gpuType'] ?? ''),
            'gpuCount' => $gpuCount,
            'utilization' => [
                'gpu' => $util['gpu'] ?? ($util['gpuUtilization'] ?? null),
                'cpu' => $util['cpu'] ?? ($util['cpuUtilization'] ?? null)
            ],
            'memory' => [
                'used' => $memory['used'] ?? ($memory['usedGb'] ?? null),
                'total' => $memory['total'] ?? ($memory['totalGb'] ?? null),
                'percent' => $memory['percent'] ?? null
            ],
            'disk' => [
                'used' => $disk['used'] ?? ($disk['usedGb'] ?? null),
                'total' => $disk['total'] ?? ($disk['totalGb'] ?? null),
                'percent' => $disk['percent'] ?? null
            ],
            'costPerHr' => $cost,
            'publicIp' => $pod['publicIp'] ?? ($runtime['publicIp'] ?? ''),
            'publicPort' => $publicPort,
            'createdAt' => $pod['createdAt'] ?? null
        ];
    }, $items);
}

function runpodGetPodMetrics(string $podId): ?array {
    $result = runpodRestRequest('pods/' . $podId . '/metrics');
    if (empty($result['success'])) {
        return null;
    }
    $data = $result['data'] ?? [];
    if (isset($data['metrics'])) {
        $data = $data['metrics'];
    }
    return $data;
}

function runpodGetTemplateById(string $templateId): ?array {
    $templates = runpodListTemplates();
    foreach ($templates as $tpl) {
        if ((string)$tpl['id'] === (string)$templateId) {
            return $tpl;
        }
    }
    return null;
}

function runpodGetGpuTypeById(string $gpuTypeId): ?array {
    $query = 'query($id: String!) { gpuTypes(id: $id) { id displayName memoryInGb communityPrice securePrice communitySpotPrice secureSpotPrice } }';
    $result = runpodRequest($query, ['id' => $gpuTypeId]);
    if (empty($result['success'])) {
        return null;
    }
    $items = $result['data']['gpuTypes'] ?? [];
    return $items[0] ?? null;
}

function runpodDeployPod(string $templateId, string $gpuTypeId, int $gpuCount, string $pricingType, string $cloudType, string $name): array {
    if ($pricingType === 'spot') {
        $template = runpodGetTemplateById($templateId);
        if (!$template) {
            return ['success' => false, 'error' => 'Template not found'];
        }
        $gpu = runpodGetGpuTypeById($gpuTypeId);
        if (!$gpu) {
            return ['success' => false, 'error' => 'GPU type not found'];
        }
        $cloudType = strtolower($cloudType) === 'secure' ? 'SECURE' : 'COMMUNITY';
        $bid = $cloudType === 'SECURE'
            ? ($gpu['secureSpotPrice'] ?? null)
            : ($gpu['communitySpotPrice'] ?? null);
        if (!$bid) {
            $bid = $cloudType === 'SECURE'
                ? ($gpu['securePrice'] ?? 0)
                : ($gpu['communityPrice'] ?? 0);
        }
        $query = <<<'GQL'
mutation($input: PodRentInterruptableInput!) {
  podRentInterruptable(input: $input) {
    id
    desiredStatus
  }
}
GQL;
        $envInput = [];
        if (!empty($template['env'])) {
            if (array_is_list($template['env'])) {
                $envInput = $template['env'];
            } else {
                foreach ($template['env'] as $key => $value) {
                    $envInput[] = ['key' => $key, 'value' => $value];
                }
            }
        }
        $variables = [
            'input' => [
                'name' => $name,
                'gpuCount' => $gpuCount,
                'gpuTypeId' => $gpuTypeId,
                'bidPerGpu' => (float)$bid,
                'cloudType' => $cloudType,
                'imageName' => $template['imageName'] ?? '',
                'dockerArgs' => $template['dockerArgs'] ?? '',
                'ports' => $template['ports'] ?? [],
                'volumeMountPath' => $template['volumeMountPath'] ?? null,
                'volumeInGb' => $template['volumeInGb'] ?? null,
                'containerDiskInGb' => $template['containerDiskInGb'] ?? null,
                'env' => $envInput
            ]
        ];
        return runpodRequest($query, $variables);
    }

    $query = <<<'GQL'
mutation($input: PodFindAndDeployOnDemandInput!) {
  podFindAndDeployOnDemand(input: $input) {
    id
    desiredStatus
  }
}
GQL;
    $variables = [
        'input' => [
            'name' => $name,
            'templateId' => $templateId,
            'gpuTypeId' => $gpuTypeId,
            'gpuCount' => $gpuCount
        ]
    ];
    return runpodRequest($query, $variables);
}

function runpodCreatePod(string $templateId, string $name): array {
    $query = <<<'GQL'
mutation($input: PodCreateInput!) {
  podCreate(input: $input) {
    id
    desiredStatus
  }
}
GQL;
    $variables = [
        'input' => [
            'name' => $name,
            'templateId' => $templateId
        ]
    ];
    return runpodRequest($query, $variables);
}

function runpodTerminatePod(string $podId): array {
    $query = <<<'GQL'
mutation($input: PodTerminateInput!) {
  podTerminate(input: $input)
}
GQL;
    return runpodRequest($query, ['input' => ['podId' => $podId]]);
}

function runpodGetPod(string $podId): array {
    $query = <<<'GQL'
query($podId: String!) {
  pod(podId: $podId) {
    id
    desiredStatus
    runtime {
      publicIp
      ports {
        ip
        isIpPublic
        privatePort
        publicPort
      }
    }
  }
}
GQL;
    return runpodRequest($query, ['podId' => $podId]);
}
