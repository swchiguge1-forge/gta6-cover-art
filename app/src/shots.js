// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample
// photo loaded; ?shot=cover shows the cover alone, full-bleed in the window.
// Query knobs: layout, grade, titleStyle, photo (boulevard|pier), caption,
// subtitle, badge, size (1080x1080|1080x1350|1920x1080).
// window.__shotReady is set once the scene has painted.
export async function runShot(shot, query, hooks) {
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const subtitle = query.get('subtitle') ?? '';
  const badge = query.get('badge') ?? 'NEON COAST';
  const layout = query.get('layout') ?? 'quad';
  const grade = query.get('grade') ?? 'sunset';
  const titleStyle = query.get('titleStyle') ?? 'block';
  const size = query.get('size') ?? '1080x1080';

  if (shot === 'cover') document.body.classList.add('shot-cover');
  await hooks.loadSample(photo);
  hooks.applyShot({
    layout, grade, titleStyle, size,
    title: caption, subtitle, badge,
  });
  // Two frames so the canvas paint lands before the screenshot is taken.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    window.__shotReady = true;
  }));
}
