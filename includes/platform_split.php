<?php

if (!function_exists('sa_get_request_host')) {
    function sa_get_request_host(): string
    {
        return isset($_SERVER['HTTP_HOST']) ? strtolower((string) $_SERVER['HTTP_HOST']) : '';
    }
}

if (!function_exists('sa_host_has_prefix')) {
    function sa_host_has_prefix(string $host, string $prefix): bool
    {
        return $host !== '' && strncmp($host, $prefix, strlen($prefix)) === 0;
    }
}

if (!function_exists('sa_string_contains')) {
    function sa_string_contains(string $haystack, string $needle): bool
    {
        return $needle === '' || strpos($haystack, $needle) !== false;
    }
}

if (!function_exists('sa_is_creator_host')) {
    function sa_is_creator_host(): bool
    {
        return sa_host_has_prefix(sa_get_request_host(), 'create.');
    }
}

if (!function_exists('sa_is_secure_request')) {
    function sa_is_secure_request(): bool
    {
        return !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    }
}

if (!function_exists('sa_get_creator_hub_url')) {
    function sa_get_creator_hub_url(string $path = ''): string
    {
        $normalizedPath = $path !== '' ? '/' . ltrim($path, '/') : '';

        if (sa_is_creator_host()) {
            $scheme = sa_is_secure_request() ? 'https' : 'http';
            return $scheme . '://' . sa_get_request_host() . $normalizedPath;
        }

        return 'https://create.socialarena.org' . $normalizedPath;
    }
}

if (!function_exists('sa_get_stream_hub_url')) {
    function sa_get_stream_hub_url(string $path = ''): string
    {
        $normalizedPath = $path !== '' ? '/' . ltrim($path, '/') : '';
        return 'https://socialarena.org' . $normalizedPath;
    }
}

if (!function_exists('sa_get_script_name')) {
    function sa_get_script_name(): string
    {
        if (empty($_SERVER['SCRIPT_NAME'])) {
            return '';
        }

        return strtolower(basename((string) $_SERVER['SCRIPT_NAME']));
    }
}

if (!function_exists('sa_is_streaming_page')) {
    function sa_is_streaming_page(string $scriptName): bool
    {
        static $streamingPages = [
            'join.php',
            'login.php',
            'register.php',
            'forgot_password.php',
            'news.php',
            'news_article.php',
            'story_public.php',
            'series_public.php',
            'story_media_watch.php',
            'series_media_watch.php',
            'talent_scout.php',
            'subscribe.php'
        ];

        return in_array($scriptName, $streamingPages, true);
    }
}

if (!function_exists('sa_is_neutral_page')) {
    function sa_is_neutral_page(string $scriptName): bool
    {
        static $neutralPages = [
            'index.php'
        ];

        return in_array($scriptName, $neutralPages, true);
    }
}

if (!function_exists('sa_should_skip_domain_enforcement')) {
    function sa_should_skip_domain_enforcement(): bool
    {
        if (PHP_SAPI === 'cli') {
            return true;
        }

        $host = sa_get_request_host();
        if ($host === '' || $host === 'localhost' || $host === '127.0.0.1' || sa_string_contains($host, '.local')) {
            return true;
        }

        if (defined('SOCIALARENA_SKIP_DOMAIN_REDIRECTS') && SOCIALARENA_SKIP_DOMAIN_REDIRECTS) {
            return true;
        }

        $scriptPath = strtolower((string) ($_SERVER['SCRIPT_NAME'] ?? ''));
        return sa_host_has_prefix($scriptPath, '/api/')
            || sa_host_has_prefix($scriptPath, '/admin/')
            || sa_host_has_prefix($scriptPath, '/cron/');
    }
}

if (!function_exists('sa_enforce_platform_domain')) {
    function sa_enforce_platform_domain(): void
    {
        if (sa_should_skip_domain_enforcement()) {
            return;
        }

        $scriptName = sa_get_script_name();
        if ($scriptName === '') {
            return;
        }
        if (sa_is_neutral_page($scriptName)) {
            return;
        }

        $isStreamingPage = sa_is_streaming_page($scriptName);
        $isCreatorHost = sa_is_creator_host();

        if ($isStreamingPage && $isCreatorHost) {
            $target = sa_get_stream_hub_url($scriptName);
        } elseif (!$isStreamingPage && !$isCreatorHost) {
            $target = sa_get_creator_hub_url($scriptName);
        } else {
            return;
        }

        $queryString = (string) ($_SERVER['QUERY_STRING'] ?? '');
        if ($queryString !== '') {
            $target .= '?' . $queryString;
        }

        header('Location: ' . $target, true, 302);
        exit;
    }
}
