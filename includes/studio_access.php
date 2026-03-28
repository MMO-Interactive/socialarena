<?php

function getUserStudios(PDO $pdo, int $userId): array {
    $stmt = $pdo->prepare("
        SELECT s.*
        FROM studios s
        JOIN studio_members sm ON sm.studio_id = s.id
        WHERE sm.user_id = ?
        ORDER BY s.name ASC
    ");
    $stmt->execute([$userId]);
    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getStudioRole(PDO $pdo, int $studioId, int $userId): ?string {
    $stmt = $pdo->prepare("SELECT role FROM studio_members WHERE studio_id = ? AND user_id = ?");
    $stmt->execute([$studioId, $userId]);
    $role = $stmt->fetchColumn();
    return $role ?: null;
}

function userHasStudioPermission(PDO $pdo, int $studioId, int $userId, string $permissionKey): bool {
    $role = getStudioRole($pdo, $studioId, $userId);
    if (!$role) {
        return false;
    }
    if ($role === 'owner') {
        return true;
    }
    $stmt = $pdo->prepare("
        SELECT allowed
        FROM studio_permissions
        WHERE studio_id = ? AND user_id = ? AND permission_key = ?
        LIMIT 1
    ");
    $stmt->execute([$studioId, $userId, $permissionKey]);
    return (int)$stmt->fetchColumn() === 1;
}

function enforceStudioPermission(PDO $pdo, ?int $studioId, int $userId, string $permissionKey): void {
    if (!$studioId) {
        return;
    }
    if (!userHasStudioPermission($pdo, $studioId, $userId, $permissionKey)) {
        throw new Exception('You do not have access to this studio item.');
    }
}

function normalizeVisibility(?string $visibility, ?int $studioId): string {
    $visibility = $visibility ?: 'private';
    if (!$studioId && $visibility !== 'private') {
        return 'private';
    }
    if (!in_array($visibility, ['private', 'studio', 'public'], true)) {
        return 'private';
    }
    return $visibility;
}

function buildStudioVisibilityWhere(string $alias, int $userId, string $permissionKey): array {
    $sql = "
        (
            {$alias}.user_id = ?
            OR {$alias}.visibility = 'public'
            OR (
                {$alias}.studio_id IN (
                    SELECT studio_id
                    FROM studio_permissions
                    WHERE user_id = ? AND permission_key = ? AND allowed = 1
                )
                AND {$alias}.visibility IN ('studio', 'public')
            )
        )
    ";
    $params = [$userId, $userId, $permissionKey];
    return [$sql, $params];
}

function canAccessStudioItem(PDO $pdo, int $ownerId, ?int $studioId, ?string $visibility, int $userId, string $permissionKey, bool $requireWrite = false): bool {
    if ($ownerId === $userId) {
        return true;
    }
    if (!$studioId) {
        return false;
    }
    $visibility = $visibility ?: 'private';
    if ($visibility === 'private') {
        return false;
    }
    if (!userHasStudioPermission($pdo, $studioId, $userId, $permissionKey)) {
        return false;
    }
    return true;
}

function enforceStudioItemAccess(PDO $pdo, int $ownerId, ?int $studioId, ?string $visibility, int $userId, string $permissionKey, bool $requireWrite = false): void {
    if (!canAccessStudioItem($pdo, $ownerId, $studioId, $visibility, $userId, $permissionKey, $requireWrite)) {
        throw new Exception('Unauthorized access to this item.');
    }
}

function enforceUniverseAccess(PDO $pdo, int $universeId, int $userId, bool $requireWrite = false): array {
    $stmt = $pdo->prepare("SELECT id, created_by, studio_id, visibility FROM universes WHERE id = ?");
    $stmt->execute([$universeId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new Exception('Universe not found');
    }
    enforceStudioItemAccess($pdo, (int)$row['created_by'], (int)$row['studio_id'], $row['visibility'], $userId, 'universes', $requireWrite);
    return $row;
}

function enforceSeriesAccess(PDO $pdo, int $seriesId, int $userId, bool $requireWrite = false): array {
    $stmt = $pdo->prepare("SELECT id, created_by, studio_id, visibility FROM series WHERE id = ?");
    $stmt->execute([$seriesId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new Exception('Series not found');
    }
    enforceStudioItemAccess($pdo, (int)$row['created_by'], (int)$row['studio_id'], $row['visibility'], $userId, 'series', $requireWrite);
    return $row;
}

function enforceStoryAccess(PDO $pdo, int $storyId, int $userId, bool $requireWrite = false): array {
    $stmt = $pdo->prepare("SELECT id, created_by, studio_id, visibility FROM stories WHERE id = ?");
    $stmt->execute([$storyId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        throw new Exception('Story not found');
    }
    enforceStudioItemAccess($pdo, (int)$row['created_by'], (int)$row['studio_id'], $row['visibility'], $userId, 'stories', $requireWrite);
    return $row;
}
