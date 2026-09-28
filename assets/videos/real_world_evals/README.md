# Real World Evaluation Videos

Each scene folder powers one tile in the Real World Evaluations grid.
Scenes with multiple videos are switched independently with the `Change Object` control.

Required naming convention:

- `scene_1/scene_1_1.mp4`
- `scene_1/scene_1_2.mp4`
- `scene_2/scene_2_1.mp4`
- ...

In general, save videos as `scene_<scene-number>_<video-number>.mp4` inside the matching `scene_<scene-number>/` folder.

After adding or removing MP4s, update `cowboy-manip.github.io/assets/js/video-manifest.js`. The page uses that small manifest instead of probing video files in the browser, which keeps the evaluation grid from doing hundreds of metadata requests on load. New videos should also be appended to `REAL_WORLD_EVAL_SHOWCASE_ORDER` at the end so existing carousel groups remain stable.

The grid shows lightweight poster frames by default. On hover-capable devices, hovering or focusing a card starts playback, and that video keeps playing after the pointer leaves. Hover/focus also reveals an expand icon that opens the current video in a larger modal viewer with native video controls. On touch devices, tapping a card opens the expanded viewer directly and the small-card controls are hidden. The modal closes with its shrink icon, the Escape key, or a click on the backdrop. Videos are always forced muted, including in the expanded viewer. Scenes with multiple videos show a `Change Object` button on hover/focus, and that same control is available in the expanded viewer; clicking it advances only that scene to its next video. The page keeps at most six evaluation videos playing at once; selecting another video unloads the oldest active one. Videos also stop and unload when their card leaves the viewport.

Poster frames live in each scene folder under `posters/` with the same base name as the MP4, for example:

- `scene_1/scene_1_1.mp4`
- `scene_1/posters/scene_1_1.webp`

Regenerate posters with `videos/generate_video_posters.ps1`; it extracts a frame from halfway through each MP4.
