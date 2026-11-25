function initializeComparison(card) {
  card.append(document.querySelector("#comparison-controls").content.cloneNode(true));
  const { method, baselineFps, oursFps } = card.dataset;
  const scene = card.querySelector("h3").textContent;
  card.querySelectorAll(".backbone").forEach(label => { label.textContent = method; });
  card.querySelector(".baseline .render-rate").textContent = `${baselineFps} FPS`;
  card.querySelector(".ours .render-rate").textContent = `${oursFps} FPS`;
  const video = card.querySelector(".pair-source");
  const view = card.querySelector(".comparison-view");
  const canvas = view.querySelector("canvas");
  if (video.width && video.height) {
    canvas.width = video.width / 2;
    canvas.height = video.height;
  }
  canvas.setAttribute("aria-label", `${scene} rendered by ${method} on the left and ${method} with CUESPLAT on the right`);
  const context = canvas.getContext("2d");
  const split = view.querySelector(".split-control");
  const timeline = card.querySelector(".timeline");
  const toggle = card.querySelector(".play-toggle");
  const timecode = card.querySelector(".timecode");
  const status = card.querySelector(".media-error");
  const fps = Number(card.dataset.fps);
  const frames = Number(card.dataset.frames);
  timeline.max = frames - 1;
  displayFrame(0);
  let animationId;

  // Each decoded frame holds the same camera and timestamp in both halves.
  function paint() {
    if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
    const width = canvas.width;
    const height = canvas.height;
    const boundary = Math.round(width * split.valueAsNumber / 100);
    if (boundary > 0) {
      context.drawImage(video, 0, 0, boundary, height, 0, 0, boundary, height);
    }
    if (boundary < width) {
      const rest = width - boundary;
      context.drawImage(video, width + boundary, 0, rest, height, boundary, 0, rest, height);
    }
  }

  function displayFrame(frame) {
    timeline.value = frame;
    const seconds = (frame / fps).toFixed(2);
    timeline.setAttribute("aria-valuetext", `Frame ${frame + 1} of ${frames}, ${seconds} seconds`);
    timecode.textContent = `${seconds} / ${(frames / fps).toFixed(2)} s`;
  }

  function updateAt(time) {
    paint();
    displayFrame(Math.max(0, Math.min(frames - 1, Math.floor(time * fps + 0.0001))));
  }

  function nextFrame() {
    if (video.paused || video.ended) return;
    if (video.requestVideoFrameCallback) {
      animationId = video.requestVideoFrameCallback((_, metadata) => {
        if (!video.seeking) updateAt(metadata.mediaTime);
        nextFrame();
      });
    } else {
      animationId = requestAnimationFrame(() => {
        if (!video.seeking) updateAt(video.currentTime);
        nextFrame();
      });
    }
  }

  function ready() {
    canvas.width = video.videoWidth / 2;
    canvas.height = video.videoHeight;
    timeline.disabled = false;
    toggle.disabled = false;
    updateAt(video.currentTime);
  }

  function showError() {
    status.textContent = "The comparison video could not be loaded.";
    timeline.disabled = true;
    toggle.disabled = true;
  }

  split.addEventListener("input", () => {
    view.style.setProperty("--split", `${split.value}%`);
    split.setAttribute("aria-valuetext", `${split.value} percent baseline`);
    paint();
  });

  timeline.addEventListener("input", () => {
    video.pause();
    const frame = timeline.valueAsNumber;
    displayFrame(frame);
    // Seek inside the selected frame to avoid rounding across a frame boundary.
    video.currentTime = (frame + 0.5) / fps;
  });
  video.addEventListener("seeked", () => updateAt(video.currentTime));
  toggle.addEventListener("click", async () => {
    if (!video.paused) {
      video.pause();
      return;
    }
    if (timeline.valueAsNumber === frames - 1) video.currentTime = 0;
    try {
      await video.play();
      status.textContent = "";
    } catch (error) {
      if (error.name !== "AbortError") status.textContent = "Playback could not start. Press Play to try again.";
    }
  });
  video.addEventListener("play", () => {
    toggle.textContent = "Pause";
    nextFrame();
  });
  video.addEventListener("pause", () => {
    if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(animationId);
    else cancelAnimationFrame(animationId);
    toggle.textContent = "Play";
    if (!video.seeking) updateAt(video.currentTime);
  });
  video.addEventListener("ended", () => updateAt(video.duration));
  video.addEventListener("error", showError);
  if (video.error) showError();
  else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) ready();
  else video.addEventListener("loadeddata", ready, { once: true });
}

document.querySelectorAll(".comparison").forEach(initializeComparison);
