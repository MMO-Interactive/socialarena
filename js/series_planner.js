const listEl = document.getElementById('series-stories');

if (listEl) {
    new Sortable(listEl, {
        animation: 150,
        handle: '.story-drag',
        onEnd: async () => {
            const ids = Array.from(listEl.querySelectorAll('.series-story-card'))
                .map(item => Number(item.dataset.id));

            if (!ids.length) return;

            await fetch('includes/series_planner_handlers.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'update_story_order',
                    order: ids
                })
            });
        }
    });
}

async function addSeason(seriesId) {
    const response = await fetch('includes/series_planner_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_season', series_id: seriesId })
    });
    const data = await response.json();
    if (data.success) {
        window.location.reload();
    }
}

async function addEpisode(seasonId) {
    const response = await fetch('includes/series_planner_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'add_episode', season_id: seasonId })
    });
    const data = await response.json();
    if (data.success) {
        window.location.reload();
    }
}

async function updateSeasonTitle(seasonId, title) {
    await fetch('includes/series_planner_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_season_title', season_id: seasonId, title })
    });
}

async function updateEpisodeTitle(episodeId, title) {
    await fetch('includes/series_planner_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_episode_title', episode_id: episodeId, title })
    });
}

async function assignEpisodeStory(episodeId, storyId) {
    await fetch('includes/series_planner_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign_episode_story', episode_id: episodeId, story_id: storyId })
    });
}

async function addCastMember(seriesId) {
    const actorId = document.getElementById('cast-actor')?.value;
    const roleName = document.getElementById('cast-role')?.value || '';
    if (!actorId) return;

    await fetch('includes/series_cast_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'add_cast',
            series_id: seriesId,
            actor_id: actorId,
            role_name: roleName
        })
    });
    window.location.reload();
}

async function removeCastMember(castId) {
    await fetch('includes/series_cast_handlers.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            action: 'remove_cast',
            cast_id: castId
        })
    });
    window.location.reload();
}
