(function attachSeriesManagementModules(globalScope) {
  function createSeriesManagementHelpers(deps) {
    const {
      state,
      projectsRef,
      normalizeProjectShape,
      createNewProjectDocument,
      normalizeStudioId,
      apiRequest,
      getStudioScopedProjects,
      importPlatformProject,
      getProject,
      resetSelectionForProject,
      setNotice,
      autosaveProjects
    } = deps;

    function syncSeriesProjectCounts(project) {
      if (!project || project.type !== "series") {
        return;
      }
      const seasons = Array.isArray(project.seriesOutline?.seasons) ? project.seriesOutline.seasons : [];
      project.seriesOutline = {
        season_count: seasons.length,
        episode_count: seasons.reduce((sum, season) => sum + ((season.episodes || []).length), 0),
        seasons
      };
      project.seasonCount = project.seriesOutline.season_count;
      project.episodeCount = project.seriesOutline.episode_count;
    }

    function createLocalEpisodeProjectForSeries(seriesProject, season, episode) {
      const document = createNewProjectDocument("episode");
      const episodeProject = document.projects[0];
      episodeProject.name = `${seriesProject.name} - ${episode.title}`;
      episodeProject.studioId = normalizeStudioId(seriesProject?.studioId ?? state.auth.currentStudioId);
      episodeProject.projectPitch.format = "episode";
      episodeProject.parentSeriesId = seriesProject.id;
      episodeProject.seriesContainerTitle = seriesProject.name;
      episodeProject.remoteSeriesId = seriesProject.remoteSeriesId || null;
      episodeProject.remoteSeasonId = season?.id || null;
      episodeProject.remoteEpisodeId = episode?.id || null;
      episodeProject.promotedAt = seriesProject.promotedAt || null;
      episodeProject.status = "Episode";
      episodeProject.workflow.currentStage = "idea_board";
      projectsRef.get().push(normalizeProjectShape(episodeProject));
      return episodeProject;
    }

    function addLocalSeriesSeason(project) {
      project.seriesOutline = project.seriesOutline || { season_count: 0, episode_count: 0, seasons: [] };
      const seasons = Array.isArray(project.seriesOutline.seasons) ? project.seriesOutline.seasons : [];
      const seasonNumber = seasons.length + 1;
      const season = {
        id: `local-season-${project.id}-${seasonNumber}`,
        title: `Season ${seasonNumber}`,
        season_number: seasonNumber,
        description: "",
        episodes: []
      };
      seasons.push(season);
      project.seriesOutline.seasons = seasons;
      syncSeriesProjectCounts(project);
      return season;
    }

    function addLocalSeriesEpisode(project, seasonId = "") {
      project.seriesOutline = project.seriesOutline || { season_count: 0, episode_count: 0, seasons: [] };
      let seasons = Array.isArray(project.seriesOutline.seasons) ? project.seriesOutline.seasons : [];
      if (!seasons.length) {
        addLocalSeriesSeason(project);
        seasons = project.seriesOutline.seasons;
      }
      let season = seasons.find((entry) => String(entry.id) === String(seasonId)) || seasons[seasons.length - 1];
      if (!season) {
        season = addLocalSeriesSeason(project);
      }
      const episodeNumber = (season.episodes || []).length + 1;
      const episode = {
        id: `local-episode-${project.id}-${season.id}-${episodeNumber}`,
        title: `Episode ${episodeNumber}`,
        episode_number: episodeNumber,
        description: "",
        story_id: null,
        entry_project_id: null,
        local_project_id: null
      };
      const episodeProject = createLocalEpisodeProjectForSeries(project, season, episode);
      episode.local_project_id = episodeProject.id;
      season.episodes = Array.isArray(season.episodes) ? season.episodes : [];
      season.episodes.push(episode);
      syncSeriesProjectCounts(project);
      return { season, episode, episodeProject };
    }

    async function refreshSeriesProjectOutline(project) {
      if (!project?.remoteSeriesId) {
        return project;
      }
      const payload = await apiRequest(`editor/projects/series/${project.remoteSeriesId}`);
      const remoteProject = payload?.project;
      if (!remoteProject) {
        return project;
      }
      project.seriesOutline = remoteProject.series_outline || project.seriesOutline;
      project.seasonCount = Number(remoteProject.series_outline?.season_count || remoteProject.season_count || project.seasonCount || 0);
      project.episodeCount = Number(remoteProject.series_outline?.episode_count || remoteProject.episode_count || project.episodeCount || 0);
      project.remoteSeriesId = remoteProject.series_id != null ? Number(remoteProject.series_id) : project.remoteSeriesId;
      project.remoteSeasonId = remoteProject.season_id != null ? Number(remoteProject.season_id) : project.remoteSeasonId;
      project.remoteEpisodeId = remoteProject.episode_id != null ? Number(remoteProject.episode_id) : project.remoteEpisodeId;
      project.entryProjectId = remoteProject.entry_project_id != null ? Number(remoteProject.entry_project_id) : project.entryProjectId;
      syncSeriesProjectCounts(project);
      return project;
    }

    async function createSeriesSeason(project) {
      if (project?.remoteSeriesId) {
        const result = await apiRequest(`editor/projects/series/${project.remoteSeriesId}/seasons`, "POST", {});
        project.seriesOutline = result?.series_outline || project.seriesOutline;
        syncSeriesProjectCounts(project);
        return result?.season || null;
      }
      return addLocalSeriesSeason(project);
    }

    async function createSeriesEpisode(project, seasonId = "") {
      if (project?.remoteSeriesId) {
        const result = await apiRequest(`editor/projects/series/${project.remoteSeriesId}/episodes`, "POST", {
          season_id: seasonId || undefined
        });
        project.seriesOutline = result?.series_outline || project.seriesOutline;
        syncSeriesProjectCounts(project);
        const entryProjectId = Number(result?.episode?.entry_project_id || 0);
        if (entryProjectId > 0) {
          project.entryProjectId = entryProjectId;
        }
        return result?.episode || null;
      }
      const created = addLocalSeriesEpisode(project, seasonId);
      return created?.episode || null;
    }

    function linkLocalEpisodeIntoSeriesOutline(seriesProject, remoteEpisodeId, localProjectId) {
      if (!seriesProject?.seriesOutline || !remoteEpisodeId || !localProjectId) {
        return;
      }
      const seasons = Array.isArray(seriesProject.seriesOutline.seasons) ? seriesProject.seriesOutline.seasons : [];
      for (const season of seasons) {
        const episode = (season.episodes || []).find((entry) => Number(entry.id) === Number(remoteEpisodeId));
        if (episode) {
          episode.local_project_id = localProjectId;
          return;
        }
      }
    }

    async function openSeriesEpisodeTarget(project, localProjectId = "", entryProjectId = 0, episodeTitle = "") {
      if (localProjectId) {
        state.selectedProjectId = localProjectId;
        state.currentView = "editor";
        resetSelectionForProject(getProject());
        setNotice(`Opened ${episodeTitle || "episode"}`, "success");
        autosaveProjects();
        return;
      }

      const remoteEntryProjectId = Number(entryProjectId || 0);
      if (remoteEntryProjectId > 0) {
        const existing = getStudioScopedProjects().find((entry) => entry.remoteType === "episode" && Number(entry.remoteId) === remoteEntryProjectId);
        if (existing) {
          state.selectedProjectId = existing.id;
          state.currentView = "editor";
          resetSelectionForProject(existing);
          setNotice(`Opened ${episodeTitle || existing.name || "episode"}`, "success");
          autosaveProjects();
          return;
        }
        await importPlatformProject({
          type: "episode",
          id: remoteEntryProjectId,
          title: episodeTitle || "Episode",
          clip_count: 0,
          updated_at: ""
        });
        const importedProject = getProject();
        if (project?.type === "series" && importedProject?.remoteEpisodeId) {
          linkLocalEpisodeIntoSeriesOutline(project, importedProject.remoteEpisodeId, importedProject.id);
        }
        state.currentView = "editor";
        setNotice(`Opened ${episodeTitle || importedProject?.name || "episode"}`, "success");
        autosaveProjects();
      }
    }

    return {
      syncSeriesProjectCounts,
      createLocalEpisodeProjectForSeries,
      addLocalSeriesSeason,
      addLocalSeriesEpisode,
      refreshSeriesProjectOutline,
      createSeriesSeason,
      createSeriesEpisode,
      linkLocalEpisodeIntoSeriesOutline,
      openSeriesEpisodeTarget
    };
  }

  globalScope.EditorStudioModules = globalScope.EditorStudioModules || {};
  globalScope.EditorStudioModules.createSeriesManagementHelpers = createSeriesManagementHelpers;
})(window);
