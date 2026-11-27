// Generates the PWA icons (public/icons/) and the Android icon + splash (assets/images/) from the SVG below. Run: node scripts/web-icons.mjs
// (Output is committed; only re-run after changing the design.)
import sharp from 'sharp';

const BG = '#0A0A0A';
const ACCENT = '#F97316';

// A dumbbell on the app's dark background, drawn on a 512 grid. Everything sits inside the
// central circle Android keeps for maskable icons (radius 205), so cropping never cuts it.
const mark = `
  <rect x="72" y="220" width="28" height="72" rx="10" fill="${ACCENT}"/>
  <rect x="104" y="168" width="40" height="176" rx="12" fill="${ACCENT}"/>
  <rect x="148" y="140" width="40" height="232" rx="12" fill="${ACCENT}"/>
  <rect x="188" y="240" width="136" height="32" rx="6" fill="${ACCENT}"/>
  <rect x="324" y="140" width="40" height="232" rx="12" fill="${ACCENT}"/>
  <rect x="368" y="168" width="40" height="176" rx="12" fill="${ACCENT}"/>
  <rect x="412" y="220" width="28" height="72" rx="10" fill="${ACCENT}"/>`;

const svg = (corner) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${corner}" fill="${BG}"/>${mark}</svg>`);

const out = [
  // [file, size, rounded corners]
  ['icon-192.png', 192, 112],
  ['icon-512.png', 512, 112],
  ['maskable-512.png', 512, 0],
  ['maskable-192.png', 192, 0],
  ['apple-touch-icon.png', 180, 0], // iOS rounds the corners itself and needs no transparency
];
for (const [file, size, corner] of out) {
  await sharp(svg(corner)).resize(size, size).png().toFile(`public/icons/${file}`);
  console.log(file);
}
await sharp(svg(112)).resize(48, 48).png().toFile('assets/images/favicon.png');
console.log('favicon.png');

// Android app icon (also used by `expo prebuild`): adaptive layers on a 108 dp canvas,
// where only the central 66 dp circle is guaranteed visible, so the mark is scaled to fit it.
const scaled = (k, fill) =>
  `<g transform="translate(256 256) scale(${k}) translate(-256 -256)">${fill ? mark.replaceAll(ACCENT, fill) : mark}</g>`;
const layer = (body, bg) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg ? `<rect width="512" height="512" fill="${bg}"/>` : ''}${body}</svg>`);
const android = [
  ['assets/images/icon.png', 1024, layer(mark, BG)],
  ['assets/images/android-icon-foreground.png', 1024, layer(scaled(0.78))],
  ['assets/images/android-icon-background.png', 1024, layer('', BG)],
  ['assets/images/android-icon-monochrome.png', 1024, layer(scaled(0.78, '#FFFFFF'))],
  // Splash: just the mark (the splash background is #0A0A0A, set in app.json).
  ['assets/images/splash-icon.png', 736, Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="72 140 368 232">${mark}</svg>`)],
];
for (const [file, size, src] of android) {
  await sharp(src).resize(size).png().toFile(file);
  console.log(file);
}
