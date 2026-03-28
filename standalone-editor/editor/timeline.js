(function attachEditorTimelineModules(globalScope) {
  function createTimelineHelpers(deps) {
    const {
      state,
      getProject,
      escapeHtml,
      clipClass,
      getItemDuration,
      getTimelinePixelsPerSecond,
      getTimelineCanvasWidth,
      getProjectDuration,
      getTimelineSceneSegments,
      normalizeTransition
    } = deps;

    function formatTimecode(totalSeconds, fps) {
      const clamped = Math.max(0, totalSeconds);
      const hours = Math.floor(clamped / 3600);
      const minutes = Math.floor((clamped % 3600) / 60);
      const seconds = Math.floor(clamped % 60);
      const frames = Math.floor((clamped % 1) * fps);

      return [hours, minutes, seconds, frames]
        .map((value) => String(value).padStart(2, "0"))
        .join(":");
    }

    function renderTimelineClipContent(item) {
      const safeName = escapeHtml(item.name);
      const label = item.isBridge ? `Bridge · ${safeName}` : safeName;

      if ((item.kind === "image" || item.kind === "title") && item.sourceUrl) {
        return `
          <span class="timeline-thumb">
            <img class="timeline-thumb-image" src="${escapeHtml(item.sourceUrl)}" alt="${safeName}" />
          </span>
          <span class="timeline-clip-label">${label}</span>
        `;
      }

      if (item.kind === "video" && item.sourceUrl) {
        return `
          <span class="timeline-thumb">
            <video class="timeline-thumb-video" src="${escapeHtml(item.sourceUrl)}" muted playsinline preload="metadata"></video>
          </span>
          <span class="timeline-clip-label">${label}</span>
        `;
      }

      if (item.kind === "audio") {
        return `
          <span class="timeline-thumb timeline-thumb-audio">
            <span></span><span></span><span></span><span></span><span></span>
          </span>
          <span class="timeline-clip-label">${safeName}</span>
        `;
      }

      return `<span class="timeline-clip-label">${label}</span>`;
    }

    function renderInspectorSelectionSummary(selection) {
      if (!selection) {
        return `
          <div class="inspector-selection-card">
            <div class="inspector-selection-thumb inspector-selection-thumb-empty">No Clip</div>
            <div class="inspector-selection-meta">
              <strong>No clip selected</strong>
              <span>Select media or a timeline clip</span>
            </div>
          </div>
        `;
      }

      let thumb = `<div class="inspector-selection-thumb inspector-selection-thumb-empty">${escapeHtml(selection.kind || "clip")}</div>`;
      if ((selection.kind === "image" || selection.kind === "title") && selection.sourceUrl) {
        thumb = `<div class="inspector-selection-thumb"><img class="inspector-selection-image" src="${escapeHtml(selection.sourceUrl)}" alt="${escapeHtml(selection.name)}" /></div>`;
      } else if (selection.kind === "video" && selection.sourceUrl) {
        thumb = `<div class="inspector-selection-thumb"><video class="inspector-selection-image" src="${escapeHtml(selection.sourceUrl)}" muted playsinline preload="metadata"></video></div>`;
      } else if (selection.kind === "audio") {
        thumb = `
          <div class="inspector-selection-thumb inspector-selection-thumb-audio">
            <span></span><span></span><span></span><span></span><span></span>
          </div>
        `;
      } else if (selection.kind === "scene") {
        thumb = `<div class="inspector-selection-thumb inspector-selection-thumb-scene">Scene</div>`;
      }

      return `
        <div class="inspector-selection-card">
          ${thumb}
          <div class="inspector-selection-meta">
            <strong>${escapeHtml(selection.name || "Untitled")}</strong>
            <span>${escapeHtml(selection.kind || "clip")} · ${escapeHtml(selection.meta || selection.sourceOut || "--")}</span>
          </div>
        </div>
      `;
    }

    function renderTimelineSceneTrack(project) {
      const pixelsPerSecond = getTimelinePixelsPerSecond(project);
      const segments = getTimelineSceneSegments(project);
      const canvasWidth = getTimelineCanvasWidth(project);

      return `
        <div class="timeline-track timeline-scene-track">
          <div class="track-label track-label-scene">Scene</div>
          <div class="track-lane">
            <div class="track-lane-canvas scene-lane-canvas" style="width:${canvasWidth}px;">
              <div class="timeline-playhead" style="left:${state.currentSeconds * pixelsPerSecond}px;"></div>
              ${
                segments.length
                  ? segments.map((segment) => `
                    <button
                      class="timeline-scene-segment${segment.id === state.selectedSceneSegmentId ? " selected" : ""}"
                      type="button"
                      data-scene-segment-id="${segment.id}"
                      style="left:${segment.start * pixelsPerSecond}px; width:${Math.max(132, (segment.end - segment.start) * pixelsPerSecond)}px;"
                    >
                      <strong>${escapeHtml(segment.context.title)}</strong>
                      <span>${escapeHtml(segment.context.summary || segment.context.intent || "Scene context")}</span>
                    </button>
                  `).join("")
                  : '<div class="lane-empty">No scene segments yet</div>'
              }
            </div>
          </div>
        </div>
      `;
    }

    function renderTimelineRuler(project) {
      const duration = Math.ceil(getProjectDuration(project));
      const pixelsPerSecond = getTimelinePixelsPerSecond(project);
      const ticks = [];
      for (let second = 0; second <= duration; second += 5) {
        ticks.push(`
          <div class="timeline-tick" style="left:${second * pixelsPerSecond}px;">
            <span>${formatTimecode(second, project.fps).slice(3, 8)}</span>
          </div>
        `);
      }

      const markers = (project.timeline.markers || []).map((marker) => `
        <button class="timeline-marker" type="button" data-action="jump-to-marker" data-marker-id="${marker.id}" style="left:${marker.seconds * pixelsPerSecond}px;">
          <span>${escapeHtml(marker.label || "Marker")}</span>
        </button>
      `);

      return `
        <div class="timeline-ruler-canvas" data-timeline-ruler-canvas style="width:${getTimelineCanvasWidth(project)}px;">
          ${ticks.join("")}
          ${markers.join("")}
          <div class="timeline-playhead" style="left:${state.currentSeconds * pixelsPerSecond}px;"></div>
        </div>
      `;
    }

    function renderTimelineTracks(project) {
      const pixelsPerSecond = getTimelinePixelsPerSecond(project);
      const canvasWidth = getTimelineCanvasWidth(project);

      return [
        renderTimelineSceneTrack(project),
        ...project.timeline.tracks.map((track) => {
          let cursor = 0;
          const items = (track.items || []).map((item) => {
            const duration = getItemDuration(item);
            const left = cursor * pixelsPerSecond;
            const width = Math.max(92, duration * pixelsPerSecond);
            cursor += duration;
            return `
              <button
                class="${clipClass(item.kind)}${item.id === state.selectedTimelineItemId ? " selected" : ""}"
                type="button"
                data-timeline-item-id="${item.id}"
                data-track-id="${track.id}"
                draggable="true"
                style="left:${left}px; width:${width}px;"
              >
                <span class="clip-trim-handle clip-trim-handle-left" data-trim-handle="left" data-timeline-item-id="${item.id}"></span>
                ${renderTimelineClipContent(item)}
                <span class="clip-trim-handle clip-trim-handle-right" data-trim-handle="right" data-timeline-item-id="${item.id}"></span>
              </button>
            `;
          });

          let transitionCursor = 0;
          const transitions = (track.items || [])
            .slice(0, -1)
            .map((item) => {
              const duration = getItemDuration(item);
              transitionCursor += duration;
              const transition = normalizeTransition(item.transition);
              if (!track.id.startsWith("video") || transition.type === "cut") {
                return "";
              }

              const labelMap = {
                crossfade: "Crossfade",
                dip_black: "Dip",
                wipe_left: "Wipe"
              };

              return `
                <button
                  class="timeline-transition-badge"
                  type="button"
                  data-timeline-item-id="${item.id}"
                  style="left:${transitionCursor * pixelsPerSecond}px;"
                  title="${labelMap[transition.type] || "Transition"} ${transition.duration.toFixed(2)}s"
                >
                  ${escapeHtml(labelMap[transition.type] || "Transition")}
                </button>
              `;
            })
            .join("");

          let bridgeCursor = 0;
          const bridgeButtons = (track.items || [])
            .slice(0, -1)
            .map((item, index) => {
              const duration = getItemDuration(item);
              bridgeCursor += duration;
              const nextItem = track.items[index + 1];
              const canBridge = track.id.startsWith("video")
                && item.kind === "video"
                && nextItem
                && nextItem.kind === "video";
              if (!canBridge) {
                return "";
              }

              return `
                <button
                  class="timeline-bridge-button"
                  type="button"
                  data-action="open-bridge-clip-modal"
                  data-track-id="${track.id}"
                  data-before-item-id="${item.id}"
                  data-after-item-id="${nextItem.id}"
                  style="left:${bridgeCursor * pixelsPerSecond}px;"
                  title="Create bridge clip"
                >
                  + Bridge
                </button>
              `;
            })
            .join("");

          const markers = (project.timeline.markers || []).map((marker) => `
            <div class="timeline-lane-marker" style="left:${marker.seconds * pixelsPerSecond}px;"></div>
          `);

          const dropIndicator =
            state.timelineDropIndicator.trackId === track.id
              ? `<div class="timeline-drop-indicator" style="left:${state.timelineDropIndicator.seconds * pixelsPerSecond}px;"></div>`
              : "";

          return `
            <div class="timeline-track">
              <div class="track-label">${track.label}</div>
              <div class="track-lane">
                <div class="track-lane-canvas" data-track-lane-canvas data-track-id="${track.id}" style="width:${canvasWidth}px;">
                  ${markers.join("")}
                  <div class="timeline-playhead" style="left:${state.currentSeconds * pixelsPerSecond}px;"></div>
                  ${dropIndicator}
                  ${transitions}
                  ${bridgeButtons}
                  ${items.join("")}
                  ${items.length ? "" : '<div class="lane-empty">Empty track</div>'}
                </div>
              </div>
            </div>
          `;
        })
      ].join("");
    }

    function syncTimelinePlayheads() {
      const project = getProject();
      if (!project) {
        return;
      }

      const left = state.currentSeconds * getTimelinePixelsPerSecond(project);
      document.querySelectorAll(".timeline-playhead").forEach((playhead) => {
        playhead.style.left = `${left}px`;
      });

      const timelineScroll = document.querySelector(".timeline-scroll");
      if (!timelineScroll) {
        return;
      }

      const viewportLeft = timelineScroll.scrollLeft;
      const viewportRight = viewportLeft + timelineScroll.clientWidth;
      const safePadding = 160;

      if (left > viewportRight - safePadding) {
        timelineScroll.scrollLeft = Math.max(0, left - timelineScroll.clientWidth + safePadding);
      } else if (left < viewportLeft + safePadding) {
        timelineScroll.scrollLeft = Math.max(0, left - safePadding);
      }
    }

    return {
      formatTimecode,
      renderTimelineClipContent,
      renderInspectorSelectionSummary,
      renderTimelineSceneTrack,
      renderTimelineRuler,
      renderTimelineTracks,
      syncTimelinePlayheads
    };
  }

  globalScope.EditorTimelineModules = globalScope.EditorTimelineModules || {};
  globalScope.EditorTimelineModules.createTimelineHelpers = createTimelineHelpers;
})(window);
