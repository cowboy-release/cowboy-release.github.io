const menuButton = document.querySelector("[data-menu-button]");
const menuPanel = document.querySelector("[data-menu-panel]");

function setMenuOpen(isOpen) {
  if (!menuButton || !menuPanel) {
    return;
  }

  menuPanel.hidden = !isOpen;
  menuButton.setAttribute("aria-expanded", String(isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
}

if (menuButton && menuPanel) {
  menuButton.addEventListener("click", () => {
    setMenuOpen(menuPanel.hidden);
  });

  menuPanel.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setMenuOpen(false));
  });

  document.addEventListener("click", (event) => {
    if (!menuPanel.hidden && !event.target.closest(".site-menu")) {
      setMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
    }
  });
}

const REAL_WORLD_VIDEO_ROOT = "assets/videos/real_world_evals";
const DISTILLATION_VIDEO_ROOT = "assets/videos/distillation";
const MAX_PLAYING_EVAL_VIDEOS = 4;
const SHOWCASE_PAGE_SIZE = 4;
const DISTILLATION_PAGE_SIZE = 6;
const DISTILLATION_VIDEO_ORDER = [
  "sim_4.mp4",
  "sim_11.mp4",
  "sim_2.mp4",
  "sim_16.mp4",
  "sim_7.mp4",
  "sim_13.mp4",
  "sim_1.mp4",
  "sim_18.mp4",
  "sim_5.mp4",
  "sim_14.mp4",
  "sim_9.mp4",
  "sim_3.mp4",
  "sim_12.mp4",
  "sim_6.mp4",
  "sim_17.mp4",
  "sim_10.mp4",
  "sim_15.mp4",
  "sim_8.mp4"
];
const SUPPORTS_HOVER = window.matchMedia ? window.matchMedia("(hover: hover)").matches : true;
const playHint = document.querySelector("[data-play-hint]");

const sceneStates = [];
const playingStates = [];
const showcaseGrid = document.querySelector("[data-showcase-grid]");
const showcaseButtons = Array.from(document.querySelectorAll("[data-showcase-step]"));
const showcaseStatus = document.querySelector("[data-showcase-status]");
const distillationGrid = document.querySelector("[data-distillation-grid]");
const distillationButtons = Array.from(document.querySelectorAll("[data-distillation-step]"));
const distillationStatus = document.querySelector("[data-distillation-status]");
const contextualVideos = Array.from(document.querySelectorAll("[data-contextual-video]"));
let expandedVideo = null;
let expandedSourceState = null;
let standaloneExpandedVideo = null;
let standaloneExpandedSourceVideo = null;
let showcasePage = 0;
let distillationPage = 0;
let standaloneVideoRefreshQueued = false;

if (playHint) {
  playHint.textContent = SUPPORTS_HOVER ? "Hover to play video" : "Tap to play video";
}

function playVideo(video) {
  const playPromise = video.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(() => {});
  }
}

function keepVideoMuted(video) {
  video.defaultMuted = true;
  video.muted = true;
  video.volume = 0;
  video.addEventListener("volumechange", () => {
    if (!video.muted || video.volume !== 0) {
      video.muted = true;
      video.volume = 0;
    }
  });
}

function makeIconSvg(kind) {
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");

  const paths = {
    expand: [
      "M8 3H3v5",
      "M3 3l6 6",
      "M16 3h5v5",
      "M21 3l-6 6",
      "M8 21H3v-5",
      "M3 21l6-6",
      "M16 21h5v-5",
      "M21 21l-6-6"
    ],
    shrink: [
      "M9 3v6H3",
      "M9 9 3 3",
      "M15 3v6h6",
      "M15 9l6-6",
      "M9 21v-6H3",
      "M9 15l-6 6",
      "M15 21v-6h6",
      "M15 15l6 6"
    ]
  };

  paths[kind].forEach((d) => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    icon.append(path);
  });

  return icon;
}

function getLoopedIndex(index, length) {
  return ((index % length) + length) % length;
}

function resolveVideoPath(path) {
  if (path.startsWith("assets/") || path.startsWith("http")) {
    return path;
  }

  return `${REAL_WORLD_VIDEO_ROOT}/${path}`;
}

function getSceneVideos(sceneNumber) {
  const manifest = window.REAL_WORLD_EVAL_VIDEOS || {};
  const videoNames = manifest[String(sceneNumber)];

  if (!Array.isArray(videoNames)) {
    return [];
  }

  return videoNames.map((name) => {
    if (name.includes("/")) {
      return resolveVideoPath(name);
    }

    return resolveVideoPath(`scene_${sceneNumber}/${name}`);
  });
}

function getStateVideoUrl(state) {
  if (!state.videos.length) {
    return "";
  }

  const videoIndex = typeof state.videoIndex === "number" ? state.videoIndex : 0;
  return state.videos[getLoopedIndex(videoIndex, state.videos.length)];
}

function getPosterUrl(videoUrl) {
  const slashIndex = videoUrl.lastIndexOf("/");
  const directory = slashIndex >= 0 ? videoUrl.slice(0, slashIndex + 1) : "";
  const filename = slashIndex >= 0 ? videoUrl.slice(slashIndex + 1) : videoUrl;
  return `${directory}posters/${filename.replace(/\.mp4$/i, ".webp")}`;
}

function getShowcaseSceneId(videoPath) {
  const match = videoPath.match(/(?:^|\/)scene_(\d+)(?:\/|_)/);
  return match ? match[1] : videoPath;
}

function limitShowcaseVideosByScene(items) {
  const sceneCounts = new Map();

  return items.filter((item) => {
    const count = sceneCounts.get(item.sceneId) || 0;
    if (count >= 2) {
      return false;
    }

    item.sceneSlot = count;
    sceneCounts.set(item.sceneId, count + 1);
    return true;
  });
}

function arrangeShowcaseVideos(items) {
  const slots = [];

  items.forEach((item) => {
    const slot = item.sceneSlot || 0;
    if (!slots[slot]) {
      slots[slot] = [];
    }

    slots[slot].push(item);
  });

  return slots.flat();
}

function getStatePosterUrl(state) {
  const videoUrl = getStateVideoUrl(state);
  return videoUrl ? getPosterUrl(videoUrl) : "";
}

function setPoster(state) {
  const posterUrl = getStatePosterUrl(state);
  if (posterUrl) {
    state.video.poster = posterUrl;
  } else {
    state.video.removeAttribute("poster");
  }
}

function getShowcaseVideos() {
  const order = window.REAL_WORLD_EVAL_SHOWCASE_ORDER || [];
  const items = order.map((videoPath) => ({
    sceneId: getShowcaseSceneId(videoPath),
    url: resolveVideoPath(videoPath)
  }));

  return arrangeShowcaseVideos(limitShowcaseVideosByScene(items)).map((item) => item.url);
}

function getDistillationVideos() {
  return DISTILLATION_VIDEO_ORDER.map((name) => `${DISTILLATION_VIDEO_ROOT}/${name}`);
}

function setStateVideoIndex(state, nextIndex) {
  state.videoIndex = getLoopedIndex(nextIndex, state.videos.length);
}

function removePlayingState(state) {
  const index = playingStates.indexOf(state);
  if (index >= 0) {
    playingStates.splice(index, 1);
  }
}

function unloadVideo(state) {
  state.video.pause();
  state.video.removeAttribute("src");
  state.video.load();
  state.currentUrl = "";
  state.isPlaying = false;
  state.card.classList.remove("is-playing", "is-loaded", "is-switching");
  setPoster(state);
}

function stopStateVideo(state) {
  removePlayingState(state);
  unloadVideo(state);
}

function prepareVideoSwitch(state) {
  state.video.pause();
  state.video.removeAttribute("src");
  state.video.removeAttribute("poster");
  state.video.load();
  state.currentUrl = "";
  state.isPlaying = false;
  state.card.classList.remove("is-playing", "is-loaded");
  state.card.classList.add("is-switching");
}

function finishVideoLoad(state) {
  state.card.classList.add("is-loaded");
  state.card.classList.remove("is-switching");
}

function failVideoLoad(state) {
  removePlayingState(state);
  state.currentUrl = "";
  state.isPlaying = false;
  state.card.classList.remove("is-loaded", "is-switching");
  setPoster(state);
}

function isCardInViewport(card) {
  const rect = card.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

  return rect.bottom > 0 && rect.right > 0 && rect.top < viewportHeight && rect.left < viewportWidth;
}

function playSelectedVideo(state) {
  if (!isCardInViewport(state.card)) {
    stopStateVideo(state);
    return;
  }

  const nextUrl = getStateVideoUrl(state);
  if (!nextUrl) {
    return;
  }

  removePlayingState(state);
  playingStates.unshift(state);
  while (playingStates.length > MAX_PLAYING_EVAL_VIDEOS) {
    unloadVideo(playingStates.pop());
  }

  if (state.currentUrl !== nextUrl) {
    state.card.classList.remove("is-loaded");
    state.video.src = nextUrl;
    state.currentUrl = nextUrl;
    state.video.load();
  }

  state.isPlaying = true;
  state.card.classList.add("is-playing");
  playVideo(state.video);
}

function changeSceneObject(state) {
  if (state.videos.length < 2) {
    return;
  }

  setStateVideoIndex(state, state.videoIndex + 1);

  if (state.isPlaying || isCardInViewport(state.card)) {
    prepareVideoSwitch(state);
    playSelectedVideo(state);
  } else {
    setPoster(state);
  }
}

function unloadShowcaseVideos() {
  if (!showcaseGrid) {
    return;
  }

  showcaseGrid.querySelectorAll("video").forEach((video) => {
    if (showcaseVideoObserver) {
      showcaseVideoObserver.unobserve(video);
    }

    unloadStandaloneVideo(video);
  });
}

function unloadDistillationVideos() {
  if (!distillationGrid) {
    return;
  }

  distillationGrid.querySelectorAll("video").forEach((video) => {
    if (distillationVideoObserver) {
      distillationVideoObserver.unobserve(video);
    }

    unloadStandaloneVideo(video);
  });
}

function unloadStandaloneVideo(video) {
  video.pause();
  video.removeAttribute("src");
  video.load();
}

function loadShowcaseVideo(video, videoUrl) {
  const card = video.closest(".showcase-card");
  if (card && !isCardInViewport(card)) {
    unloadStandaloneVideo(video);
    return;
  }

  if (!video.getAttribute("src")) {
    video.src = videoUrl;
    video.load();
  }

  playVideo(video);
}

function refreshShowcaseVideo(video) {
  const card = video.closest(".showcase-card");
  if (card && isCardInViewport(card)) {
    loadShowcaseVideo(video, video.dataset.src || "");
  } else {
    unloadStandaloneVideo(video);
  }
}

function loadDistillationVideo(video) {
  const videoUrl = video.dataset.src || "";
  const card = video.closest(".distillation-card");
  if (!videoUrl) {
    return;
  }

  if (card && !isCardInViewport(card)) {
    unloadStandaloneVideo(video);
    return;
  }

  if (!video.getAttribute("src")) {
    video.src = videoUrl;
    video.load();
  }

  playVideo(video);
}

function refreshDistillationVideo(video) {
  const card = video.closest(".distillation-card");
  if (card && isCardInViewport(card)) {
    loadDistillationVideo(video);
  } else {
    unloadStandaloneVideo(video);
  }
}

const showcaseVideoObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting) {
        loadShowcaseVideo(video, video.dataset.src || "");
      } else {
        unloadStandaloneVideo(video);
      }
    });
  }, { threshold: 0.08 })
  : null;

const distillationVideoObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting) {
        loadDistillationVideo(video);
      } else {
        unloadStandaloneVideo(video);
      }
    });
  }, { threshold: 0.08 })
  : null;

function updateShowcaseControls(totalPages) {
  showcaseButtons.forEach((button) => {
    button.disabled = totalPages <= 1;
  });

  if (showcaseStatus) {
    showcaseStatus.textContent = totalPages ? `${showcasePage + 1} / ${totalPages}` : "";
  }
}

function renderShowcasePage() {
  if (!showcaseGrid) {
    return;
  }

  const videos = getShowcaseVideos();
  const totalPages = Math.ceil(videos.length / SHOWCASE_PAGE_SIZE);
  unloadShowcaseVideos();
  showcaseGrid.textContent = "";

  if (!videos.length) {
    updateShowcaseControls(0);
    return;
  }

  showcasePage = getLoopedIndex(showcasePage, totalPages);
  const pageVideos = videos.slice(
    showcasePage * SHOWCASE_PAGE_SIZE,
    showcasePage * SHOWCASE_PAGE_SIZE + SHOWCASE_PAGE_SIZE
  );

  pageVideos.forEach((videoUrl) => {
    const card = document.createElement("figure");
    card.className = "showcase-card";

    const media = document.createElement("div");
    media.className = "showcase-media";

    const video = document.createElement("video");
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.poster = getPosterUrl(videoUrl);
    video.dataset.src = videoUrl;
    keepVideoMuted(video);

    card.addEventListener("pointerenter", () => loadShowcaseVideo(video, videoUrl));
    card.addEventListener("focusin", () => loadShowcaseVideo(video, videoUrl));

    media.append(video);
    card.append(media);
    showcaseGrid.append(card);

    if (showcaseVideoObserver) {
      showcaseVideoObserver.observe(video);
    } else {
      loadShowcaseVideo(video, videoUrl);
    }
  });

  updateShowcaseControls(totalPages);
}

function updateDistillationControls(totalPages) {
  distillationButtons.forEach((button) => {
    button.disabled = totalPages <= 1;
  });

  if (distillationStatus) {
    distillationStatus.textContent = totalPages ? `${distillationPage + 1} / ${totalPages}` : "";
  }
}

function renderDistillationPage() {
  if (!distillationGrid) {
    return;
  }

  const videos = getDistillationVideos();
  const totalPages = Math.ceil(videos.length / DISTILLATION_PAGE_SIZE);
  unloadDistillationVideos();
  distillationGrid.textContent = "";

  if (!videos.length) {
    updateDistillationControls(0);
    return;
  }

  distillationPage = getLoopedIndex(distillationPage, totalPages);
  const pageVideos = videos.slice(
    distillationPage * DISTILLATION_PAGE_SIZE,
    distillationPage * DISTILLATION_PAGE_SIZE + DISTILLATION_PAGE_SIZE
  );

  pageVideos.forEach((videoUrl, index) => {
    const card = document.createElement("figure");
    card.className = "distillation-card";

    const video = document.createElement("video");
    video.className = "distillation-video";
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    video.preload = "none";
    video.poster = getPosterUrl(videoUrl);
    video.dataset.src = videoUrl;
    video.setAttribute("aria-label", `Distillation demonstration video ${distillationPage * DISTILLATION_PAGE_SIZE + index + 1}`);
    keepVideoMuted(video);

    const expandButton = document.createElement("button");
    expandButton.className = "distillation-expand-button";
    expandButton.type = "button";
    expandButton.setAttribute("aria-label", `Expand distillation demonstration video ${distillationPage * DISTILLATION_PAGE_SIZE + index + 1}`);
    expandButton.append(makeIconSvg("expand"));
    expandButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openStandaloneExpandedVideo(
        video,
        videoUrl,
        getPosterUrl(videoUrl),
        "Expanded distillation video"
      );
    });

    card.tabIndex = 0;
    card.addEventListener("pointerenter", () => loadDistillationVideo(video));
    card.addEventListener("focusin", () => loadDistillationVideo(video));

    card.append(video, expandButton);
    distillationGrid.append(card);

    if (distillationVideoObserver) {
      distillationVideoObserver.observe(video);
    } else {
      loadDistillationVideo(video);
    }
  });

  updateDistillationControls(totalPages);
}

showcaseButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const step = Number(button.getAttribute("data-showcase-step")) || 0;
    const totalPages = Math.ceil(getShowcaseVideos().length / SHOWCASE_PAGE_SIZE);
    if (totalPages <= 1) {
      return;
    }

    showcasePage = getLoopedIndex(showcasePage + step, totalPages);
    renderShowcasePage();
  });
});

distillationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const step = Number(button.getAttribute("data-distillation-step")) || 0;
    const totalPages = Math.ceil(getDistillationVideos().length / DISTILLATION_PAGE_SIZE);
    if (totalPages <= 1) {
      return;
    }

    distillationPage = getLoopedIndex(distillationPage + step, totalPages);
    renderDistillationPage();
  });
});

function loadContextualVideo(video) {
  const videoUrl = video.getAttribute("data-src");
  if (!videoUrl) {
    return;
  }

  if (!isCardInViewport(video)) {
    unloadContextualVideo(video);
    return;
  }

  if (!video.getAttribute("src")) {
    video.src = videoUrl;
    video.load();
  }

  playVideo(video);
}

function unloadContextualVideo(video) {
  unloadStandaloneVideo(video);
}

function refreshContextualVideo(video) {
  if (isCardInViewport(video)) {
    loadContextualVideo(video);
  } else {
    unloadContextualVideo(video);
  }
}

function refreshStandaloneVideos() {
  if (showcaseGrid) {
    showcaseGrid.querySelectorAll("video").forEach(refreshShowcaseVideo);
  }

  if (distillationGrid) {
    distillationGrid.querySelectorAll("video").forEach(refreshDistillationVideo);
  }

  contextualVideos.forEach(refreshContextualVideo);
}

function scheduleStandaloneVideoRefresh() {
  if (standaloneVideoRefreshQueued) {
    return;
  }

  standaloneVideoRefreshQueued = true;
  window.requestAnimationFrame(() => {
    standaloneVideoRefreshQueued = false;
    refreshStandaloneVideos();
  });
}

const contextualVideoObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const video = entry.target;
      if (entry.isIntersecting) {
        loadContextualVideo(video);
      } else {
        unloadContextualVideo(video);
      }
    });
  }, { threshold: 0.08 })
  : null;

contextualVideos.forEach((video) => {
  keepVideoMuted(video);
  video.addEventListener("pointerenter", () => loadContextualVideo(video));
  video.addEventListener("focusin", () => loadContextualVideo(video));

  if (contextualVideoObserver) {
    contextualVideoObserver.observe(video);
  } else {
    loadContextualVideo(video);
  }
});

const visibilityObserver = "IntersectionObserver" in window
  ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting && entry.target._evalState) {
        stopStateVideo(entry.target._evalState);
      }
    });
  }, { threshold: 0 })
  : null;

function createExpandedVideo() {
  const dialog = document.createElement("div");
  dialog.className = "eval-lightbox";
  dialog.hidden = true;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Expanded evaluation video");

  const frame = document.createElement("div");
  frame.className = "eval-lightbox__frame";

  const video = document.createElement("video");
  video.className = "eval-lightbox__video";
  video.loop = true;
  video.controls = true;
  video.playsInline = true;
  video.preload = "none";
  keepVideoMuted(video);

  const changeButton = document.createElement("button");
  changeButton.className = "eval-lightbox__change";
  changeButton.type = "button";
  changeButton.textContent = "Change Object";

  const closeButton = document.createElement("button");
  closeButton.className = "eval-lightbox__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Shrink video");
  closeButton.append(makeIconSvg("shrink"));

  video.addEventListener("loadeddata", () => dialog.classList.remove("is-loading"));
  video.addEventListener("canplay", () => dialog.classList.remove("is-loading"));
  video.addEventListener("error", () => dialog.classList.remove("is-loading"));
  changeButton.addEventListener("click", () => changeExpandedObject());
  closeButton.addEventListener("click", () => closeExpandedVideo());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeExpandedVideo();
    }
  });

  frame.append(video, changeButton, closeButton);
  dialog.append(frame);
  document.body.append(dialog);

  expandedVideo = { dialog, video, changeButton, closeButton };
}

function createStandaloneExpandedVideo() {
  const dialog = document.createElement("div");
  dialog.className = "eval-lightbox standalone-lightbox";
  dialog.hidden = true;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-label", "Expanded video");

  const frame = document.createElement("div");
  frame.className = "eval-lightbox__frame";

  const video = document.createElement("video");
  video.className = "eval-lightbox__video";
  video.loop = true;
  video.controls = true;
  video.playsInline = true;
  video.preload = "none";
  keepVideoMuted(video);

  const closeButton = document.createElement("button");
  closeButton.className = "eval-lightbox__close";
  closeButton.type = "button";
  closeButton.setAttribute("aria-label", "Shrink video");
  closeButton.append(makeIconSvg("shrink"));

  video.addEventListener("loadeddata", () => dialog.classList.remove("is-loading"));
  video.addEventListener("canplay", () => dialog.classList.remove("is-loading"));
  video.addEventListener("error", () => dialog.classList.remove("is-loading"));
  closeButton.addEventListener("click", () => closeStandaloneExpandedVideo());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeStandaloneExpandedVideo();
    }
  });

  frame.append(video, closeButton);
  dialog.append(frame);
  document.body.append(dialog);

  standaloneExpandedVideo = { dialog, video, closeButton };
}

function updateExpandedChangeButton(state) {
  if (!expandedVideo) {
    return;
  }

  const hasMultipleVideos = state.videos.length > 1;
  const caption = state.card.querySelector(".eval-caption")?.textContent?.trim() || "this scene";
  expandedVideo.changeButton.hidden = !hasMultipleVideos;
  expandedVideo.changeButton.disabled = !hasMultipleVideos;
  expandedVideo.changeButton.setAttribute("aria-label", `Change Object for ${caption}`);
}

function loadExpandedStateVideo(state) {
  const videoUrl = getStateVideoUrl(state);
  if (!expandedVideo || !videoUrl) {
    return;
  }

  const posterUrl = getStatePosterUrl(state);
  expandedVideo.dialog.classList.add("is-loading");
  expandedVideo.video.pause();
  expandedVideo.video.removeAttribute("src");
  expandedVideo.video.poster = posterUrl;
  expandedVideo.video.src = videoUrl;
  expandedVideo.video.load();
  playVideo(expandedVideo.video);
}

function changeExpandedObject() {
  if (!expandedSourceState || expandedSourceState.videos.length < 2) {
    return;
  }

  setStateVideoIndex(expandedSourceState, expandedSourceState.videoIndex + 1);
  loadExpandedStateVideo(expandedSourceState);
}

function openExpandedVideo(state) {
  const videoUrl = getStateVideoUrl(state);
  if (!videoUrl) {
    return;
  }

  closeStandaloneExpandedVideo(false);

  if (!expandedVideo) {
    createExpandedVideo();
  }

  expandedSourceState = state;
  stopStateVideo(state);
  updateExpandedChangeButton(state);
  expandedVideo.dialog.hidden = false;
  document.body.classList.add("has-eval-lightbox");
  loadExpandedStateVideo(state);
  expandedVideo.closeButton.focus({ preventScroll: true });
}

function openStandaloneExpandedVideo(sourceVideo, videoUrl, posterUrl, label) {
  if (!videoUrl) {
    return;
  }

  closeExpandedVideo();

  if (!standaloneExpandedVideo) {
    createStandaloneExpandedVideo();
  }

  standaloneExpandedSourceVideo = sourceVideo || null;
  if (sourceVideo) {
    unloadStandaloneVideo(sourceVideo);
  }

  standaloneExpandedVideo.dialog.setAttribute("aria-label", label || "Expanded video");
  standaloneExpandedVideo.dialog.classList.add("is-loading");
  standaloneExpandedVideo.dialog.hidden = false;
  standaloneExpandedVideo.video.pause();
  standaloneExpandedVideo.video.removeAttribute("src");
  standaloneExpandedVideo.video.poster = posterUrl || getPosterUrl(videoUrl);
  standaloneExpandedVideo.video.src = videoUrl;
  standaloneExpandedVideo.video.load();
  document.body.classList.add("has-eval-lightbox");
  playVideo(standaloneExpandedVideo.video);
  standaloneExpandedVideo.closeButton.focus({ preventScroll: true });
}

function closeExpandedVideo() {
  if (!expandedVideo || expandedVideo.dialog.hidden) {
    return;
  }

  expandedVideo.video.pause();
  expandedVideo.video.removeAttribute("src");
  expandedVideo.video.load();
  expandedVideo.dialog.hidden = true;
  document.body.classList.remove("has-eval-lightbox");

  if (expandedSourceState) {
    setPoster(expandedSourceState);
    expandedSourceState.card.focus({ preventScroll: true });
  }

  expandedSourceState = null;
}

function closeStandaloneExpandedVideo(shouldRefresh = true) {
  if (!standaloneExpandedVideo || standaloneExpandedVideo.dialog.hidden) {
    return;
  }

  standaloneExpandedVideo.video.pause();
  standaloneExpandedVideo.video.removeAttribute("src");
  standaloneExpandedVideo.video.load();
  standaloneExpandedVideo.dialog.hidden = true;
  document.body.classList.remove("has-eval-lightbox");

  if (standaloneExpandedSourceVideo) {
    const card = standaloneExpandedSourceVideo.closest(".distillation-card");
    if (card && document.contains(card)) {
      card.focus({ preventScroll: true });
    }
  }

  standaloneExpandedSourceVideo = null;
  if (shouldRefresh && !document.hidden) {
    scheduleStandaloneVideoRefresh();
  }
}

function addExpandButton(state) {
  const media = state.card.querySelector(".eval-media");
  if (!media) {
    return;
  }

  const caption = state.card.querySelector(".eval-caption")?.textContent?.trim() || "this scene";
  const button = document.createElement("button");
  button.className = "eval-expand-button";
  button.type = "button";
  button.setAttribute("aria-label", `Expand video for ${caption}`);
  button.append(makeIconSvg("expand"));
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openExpandedVideo(state);
  });

  media.append(button);
}

function addChangeObjectButton(state) {
  if (state.videos.length < 2) {
    return;
  }

  const media = state.card.querySelector(".eval-media");
  if (!media) {
    return;
  }

  const caption = state.card.querySelector(".eval-caption")?.textContent?.trim() || "this scene";
  const button = document.createElement("button");
  button.className = "eval-change-button";
  button.type = "button";
  button.textContent = "Change Object";
  button.setAttribute("aria-label", `Change Object for ${caption}`);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    changeSceneObject(state);
  });

  state.card.classList.add("has-multiple-videos");
  media.append(button);
}

Array.from(document.querySelectorAll(".eval-card")).forEach((card) => {
  const video = card.querySelector("video");
  if (!video) {
    return;
  }

  const sceneNumber = Number(video.getAttribute("data-scene"));
  const videos = getSceneVideos(sceneNumber);
  if (!videos.length) {
    return;
  }

  card.classList.add("has-video");
  card.tabIndex = 0;

  const state = { card, video, videos, currentUrl: "", isPlaying: false, videoIndex: 0 };
  keepVideoMuted(video);
  setPoster(state);
  card._evalState = state;
  addExpandButton(state);
  addChangeObjectButton(state);
  video.addEventListener("loadeddata", () => finishVideoLoad(state));
  video.addEventListener("canplay", () => finishVideoLoad(state));
  video.addEventListener("error", () => failVideoLoad(state));

  card.addEventListener("pointerenter", () => {
    if (SUPPORTS_HOVER) {
      playSelectedVideo(state);
    }
  });
  card.addEventListener("focusin", () => {
    if (SUPPORTS_HOVER) {
      playSelectedVideo(state);
    }
  });
  card.addEventListener("click", () => {
    if (SUPPORTS_HOVER) {
      return;
    }

    openExpandedVideo(state);
  });

  sceneStates.push(state);
  if (visibilityObserver) {
    visibilityObserver.observe(card);
  }
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    closeExpandedVideo();
    closeStandaloneExpandedVideo(false);
    unloadShowcaseVideos();
    unloadDistillationVideos();
    contextualVideos.forEach(unloadContextualVideo);
    sceneStates.forEach(stopStateVideo);
  } else {
    scheduleStandaloneVideoRefresh();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeExpandedVideo();
    closeStandaloneExpandedVideo();
  }
});
window.addEventListener("scroll", scheduleStandaloneVideoRefresh, { passive: true });
window.addEventListener("resize", scheduleStandaloneVideoRefresh);
window.addEventListener("pageshow", scheduleStandaloneVideoRefresh);
window.addEventListener("pagehide", () => {
  closeExpandedVideo();
  closeStandaloneExpandedVideo(false);
  unloadShowcaseVideos();
  unloadDistillationVideos();
  contextualVideos.forEach(unloadContextualVideo);
  sceneStates.forEach(stopStateVideo);
});

renderShowcasePage();
renderDistillationPage();
