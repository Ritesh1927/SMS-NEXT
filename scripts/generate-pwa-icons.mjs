// Generates every PWA / favicon asset from one SVG source: the same white
// lucide GraduationCap on the primary -> accent gradient tile that the
// sidebar, mobile top bar and login page use as the EduNivo logo.
//
// Output is committed, so this only needs re-running when the logo or brand
// colors change:
//
//   node scripts/generate-pwa-icons.mjs
//
// `sharp` isn't a direct dependency -- it ships with Next.js (image
// optimization), which is why it's resolvable here without an install.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ICONS_DIR = path.join(root, "public", "icons");
const APP_DIR = path.join(root, "src", "app");

// Hex equivalents of --primary hsl(243 75% 59%) and --accent hsl(258 88% 67%)
// in globals.css. Keep src/pwa/config.ts (theme_color) in sync.
const PRIMARY = "#5048e5";
const ACCENT = "#8d61f5";

// lucide-react graduation-cap (24x24 viewBox, stroke icon).
const CAP = `
  <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
  <path d="M22 10v6"/>
  <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>`;

// Shortcut glyphs (lucide layout-dashboard, megaphone, message-square).
const SHORTCUT_GLYPHS = {
  dashboard: `
    <rect width="7" height="9" x="3" y="3" rx="1"/>
    <rect width="7" height="5" x="14" y="3" rx="1"/>
    <rect width="7" height="9" x="14" y="12" rx="1"/>
    <rect width="7" height="5" x="3" y="16" rx="1"/>`,
  notices: `
    <path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>
    <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14"/>
    <path d="M8 6v8"/>`,
  chat: `
    <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"/>`,
};

/**
 * Builds a square icon SVG.
 * @param glyph      inner SVG markup in a 24x24 coordinate space
 * @param glyphScale fraction of the canvas the 24x24 glyph box occupies
 * @param radius     corner radius as a fraction of the canvas (0 = full bleed)
 */
function iconSvg({ glyph = CAP, glyphScale = 0.58, radius = 0.225 } = {}) {
  const size = 512;
  const box = size * glyphScale;
  const offset = (size - box) / 2;
  const scale = box / 24;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${PRIMARY}"/>
      <stop offset="1" stop-color="${ACCENT}"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${size * radius}" fill="url(#g)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff"
     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</svg>`;
}

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toBuffer();

// A .ico is a tiny header + directory pointing at embedded images; every
// browser since IE Vista accepts PNG payloads, so no BMP encoding needed.
function toIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });
  const written = [];
  const out = async (file, data) => {
    await writeFile(file, data);
    written.push(path.relative(root, file));
  };

  // "any" purpose: rounded tile, shown as-is by desktop OSes and launchers.
  const standard = iconSvg();
  for (const size of [72, 96, 128, 144, 152, 192, 256, 384, 512]) {
    await out(path.join(ICONS_DIR, `icon-${size}x${size}.png`), await png(standard, size));
  }

  // "maskable" purpose: full-bleed background, glyph kept inside the 80%
  // safe zone so Android's circle/squircle masks never clip the cap.
  const maskable = iconSvg({ radius: 0, glyphScale: 0.48 });
  for (const size of [192, 512]) {
    await out(path.join(ICONS_DIR, `maskable-${size}x${size}.png`), await png(maskable, size));
  }

  // iOS applies its own rounded mask and renders transparency as black, so
  // the touch icon must be a full-bleed opaque square.
  const apple = iconSvg({ radius: 0, glyphScale: 0.56 });
  // Next.js file convention: app/apple-icon.png -> <link rel="apple-touch-icon">.
  await out(path.join(APP_DIR, "apple-icon.png"), await png(apple, 180));

  for (const [name, glyph] of Object.entries(SHORTCUT_GLYPHS)) {
    await out(path.join(ICONS_DIR, `shortcut-${name}.png`), await png(iconSvg({ glyph, glyphScale: 0.5 }), 96));
  }

  // Favicons: replaces create-next-app's default favicon.ico, plus an SVG
  // icon (app/icon.svg file convention) for crisp tabs on modern browsers.
  const favicon = iconSvg({ glyphScale: 0.66, radius: 0.2 });
  const icoImages = await Promise.all([16, 32, 48].map(async (size) => ({ size, data: await png(favicon, size) })));
  await out(path.join(APP_DIR, "favicon.ico"), toIco(icoImages));
  await out(path.join(APP_DIR, "icon.svg"), favicon);

  console.log(`Generated ${written.length} files:\n  ${written.join("\n  ")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
