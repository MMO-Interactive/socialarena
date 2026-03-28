(function attachEditorPlaybackModules(globalScope) {
  function createPlaybackHelpers(deps) {
    const {
      state,
      playbackView,
      escapeHtml,
      getProject,
      getActiveSegment,
      getProjectDuration,
      formatTimecode,
      setNotice,
      render,
      syncTimelinePlayheads,
      timerRef
    } = deps;

    function renderPreviewContent(selection, project) {
      if (!selection) {
        return `
          <div class="preview-copy">
            <strong>No clip selected</strong>
            <span>Import media or start adding timeline clips</span>
          </div>
        `;
      }

      if ((selection.kind === "image" || selection.kind === "title") && selection.sourceUrl) {
        return `<img class="preview-media-image" src="${escapeHtml(selection.sourceUrl)}" alt="${escapeHtml(selection.name)}" />`;
      }

      if (selection.kind === "video" && selection.sourceUrl) {
        return `<video class="preview-media-video" data-preview-media="video" src="${escapeHtml(selection.sourceUrl)}" playsinline preload="metadata"></video>`;
      }

      if (selection.kind === "audio" && selection.sourceUrl) {
        return `
          <div class="preview-audio-shell">
            <div class="preview-audio-wave">
              <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
            </div>
            <div class="preview-copy">
              <strong>${escapeHtml(selection.name)}</strong>
              <span>${escapeHtml(project.name)}</span>
            </div>
            <audio class="preview-audio-player" data-preview-media="audio" src="${escapeHtml(selection.sourceUrl)}" controls preload="metadata"></audio>
          </div>
        `;
      }

      return `
        <div class="preview-copy">
          <strong>${escapeHtml(selection.name)}</strong>
          <span>${escapeHtml(project.name)}</span>
        </div>
      `;
    }

    function syncCurrentProjectTimecode() {
      const project = getProject();
      if (!project) {
        return;
      }
      project.timecode = formatTimecode(state.currentSeconds, project.fps);
    }

    function stopPlaybackTimer() {
      if (timerRef.get()) {
        clearInterval(timerRef.get());
        timerRef.set(null);
      }
    }

    function getPreviewSelection(project, getSelectedTimelineItem, getSelection) {
      const activeVideo = getActiveSegment(project, "video", state.currentSeconds);
      const activeAudio = getActiveSegment(project, "audio", state.currentSeconds);

      if ((state.playing || state.currentSeconds > 0) && activeVideo?.item) {
        return activeVideo.item;
      }

      if ((state.playing || state.currentSeconds > 0) && activeAudio?.item) {
        return activeAudio.item;
      }

      return getSelectedTimelineItem(project) || getSelection(project);
    }

    function renderHiddenAudioContent(project) {
      const activeVideo = getActiveSegment(project, "video", state.currentSeconds);
      const activeAudio = getActiveSegment(project, "audio", state.currentSeconds);

      if (activeVideo?.item && activeAudio?.item?.sourceUrl && activeAudio.item.kind === "audio") {
        return `<audio data-preview-media="audio-layer" src="${escapeHtml(activeAudio.item.sourceUrl)}" preload="metadata"></audio>`;
      }

      return "";
    }

    function syncPlaybackView() {
      const project = getProject();
      const activeVideo = getActiveSegment(project, "video", state.currentSeconds);
      const activeAudio = getActiveSegment(project, "audio", state.currentSeconds);
      const timecode = document.querySelector("[data-role='timecode']");
      const previewVideo = document.querySelector("[data-preview-media='video']");
      const previewAudio = document.querySelector("[data-preview-media='audio']");
      const layeredAudio = document.querySelector("[data-preview-media='audio-layer']");

      if (timecode) {
        timecode.textContent = formatTimecode(state.currentSeconds, project.fps);
      }

      syncTimelinePlayheads();

      if (previewVideo && activeVideo?.item?.sourceUrl && activeVideo.item.kind === "video") {
        const targetTime = Math.max(0, state.currentSeconds - activeVideo.start);
        previewVideo.muted = false;
        previewVideo.volume = Math.max(0, Math.min(1, (activeVideo.item.volume ?? 100) / 100));
        if (Math.abs((previewVideo.currentTime || 0) - targetTime) > 0.35) {
          previewVideo.currentTime = targetTime;
        }
        if (state.playing && previewVideo.paused) {
          previewVideo.play().catch(() => {});
        }
        if (!state.playing && !previewVideo.paused) {
          previewVideo.pause();
        }
      } else if (previewVideo && !previewVideo.paused) {
        previewVideo.pause();
      }

      if (previewAudio && activeAudio?.item?.sourceUrl && activeAudio.item.kind === "audio") {
        const targetTime = Math.max(0, state.currentSeconds - activeAudio.start);
        previewAudio.volume = Math.max(0, Math.min(1, (activeAudio.item.volume ?? 100) / 100));
        if (Math.abs((previewAudio.currentTime || 0) - targetTime) > 0.35) {
          previewAudio.currentTime = targetTime;
        }
        if (state.playing && previewAudio.paused) {
          previewAudio.play().catch(() => {});
        }
        if (!state.playing && !previewAudio.paused) {
          previewAudio.pause();
        }
      } else if (previewAudio && !previewAudio.paused) {
        previewAudio.pause();
      }

      if (layeredAudio && activeAudio?.item?.sourceUrl && activeAudio.item.kind === "audio") {
        const targetTime = Math.max(0, state.currentSeconds - activeAudio.start);
        layeredAudio.volume = Math.max(0, Math.min(1, (activeAudio.item.volume ?? 100) / 100));
        if (Math.abs((layeredAudio.currentTime || 0) - targetTime) > 0.35) {
          layeredAudio.currentTime = targetTime;
        }
        if (state.playing && layeredAudio.paused) {
          layeredAudio.play().catch(() => {});
        }
        if (!state.playing && !layeredAudio.paused) {
          layeredAudio.pause();
        }
      } else if (layeredAudio && !layeredAudio.paused) {
        layeredAudio.pause();
      }
    }

    function syncPreviewSelectionView(getSelectedTimelineItem, getSelection) {
      const project = getProject();
      const container = document.querySelector("[data-role='preview-content']");
      const audioLayerContainer = document.querySelector("[data-role='preview-audio-layer']");

      if (!container) {
        return;
      }

      container.innerHTML = renderPreviewContent(getPreviewSelection(project, getSelectedTimelineItem, getSelection), project);
      if (audioLayerContainer) {
        audioLayerContainer.innerHTML = renderHiddenAudioContent(project);
      }
      syncPlaybackView();
    }

    function syncTransportButtons() {
      const playButton = document.querySelector("[data-action='playback-play']");
      if (!playButton) {
        return;
      }

      playButton.classList.toggle("is-live", state.playing);
    }

    function updatePlaybackFrame(syncPreviewSelectionViewWithDeps) {
      const project = getProject();
      const activeVideoId = getActiveSegment(project, "video", state.currentSeconds)?.item?.id || "";
      const activeAudioId = getActiveSegment(project, "audio", state.currentSeconds)?.item?.id || "";

      if (
        activeVideoId !== playbackView.activePreviewItemId ||
        activeAudioId !== playbackView.activeAudioItemId
      ) {
        playbackView.activePreviewItemId = activeVideoId;
        playbackView.activeAudioItemId = activeAudioId;
        syncPreviewSelectionViewWithDeps();
        return;
      }

      syncPlaybackView();
    }

    function startPlayback(syncPreviewSelectionViewWithDeps) {
      const project = getProject();
      stopPlaybackTimer();
      state.playing = true;
      setNotice(`Playing ${project.name}`, "neutral");
      playbackView.activePreviewItemId = getActiveSegment(project, "video", state.currentSeconds)?.item?.id || "";
      playbackView.activeAudioItemId = getActiveSegment(project, "audio", state.currentSeconds)?.item?.id || "";
      syncTransportButtons();
      syncPreviewSelectionViewWithDeps();
      timerRef.set(setInterval(() => {
        const activeProject = getProject();
        state.currentSeconds = Math.min(
          state.currentSeconds + 0.1,
          getProjectDuration(activeProject)
        );
        syncCurrentProjectTimecode();
        if (state.currentSeconds >= getProjectDuration(activeProject)) {
          state.playing = false;
          stopPlaybackTimer();
          setNotice(`Reached end of ${activeProject.name}`, "neutral");
          syncTransportButtons();
          render();
          return;
        }
        updatePlaybackFrame(syncPreviewSelectionViewWithDeps);
      }, 100));
    }

    function pausePlayback() {
      state.playing = false;
      stopPlaybackTimer();
      setNotice("Playback paused", "neutral");
      syncTransportButtons();
      syncPlaybackView();
    }

    function stopPlayback() {
      state.playing = false;
      state.currentSeconds = 0;
      syncCurrentProjectTimecode();
      stopPlaybackTimer();
      setNotice("Playback stopped", "neutral");
      playbackView.activePreviewItemId = "";
      playbackView.activeAudioItemId = "";
      syncTransportButtons();
    }

    function stepPlayback(syncPreviewSelectionViewWithDeps) {
      const project = getProject();
      state.playing = false;
      stopPlaybackTimer();
      state.currentSeconds = Math.min(
        state.currentSeconds + 1 / project.fps,
        getProjectDuration(project)
      );
      syncCurrentProjectTimecode();
      setNotice("Advanced one frame", "neutral");
      playbackView.activePreviewItemId = getActiveSegment(project, "video", state.currentSeconds)?.item?.id || "";
      playbackView.activeAudioItemId = getActiveSegment(project, "audio", state.currentSeconds)?.item?.id || "";
      syncTransportButtons();
      syncPreviewSelectionViewWithDeps();
    }

    return {
      renderPreviewContent,
      syncCurrentProjectTimecode,
      stopPlaybackTimer,
      getPreviewSelection,
      renderHiddenAudioContent,
      syncPlaybackView,
      syncPreviewSelectionView,
      syncTransportButtons,
      updatePlaybackFrame,
      startPlayback,
      pausePlayback,
      stopPlayback,
      stepPlayback
    };
  }

  globalScope.EditorPlaybackModules = {
    createPlaybackHelpers
  };
})(window);
