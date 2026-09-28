// Generates app icons from one SVG mark. Run: node scripts/generate-icons.mjs
import { writeFile } from "node:fs/promises";
import sharp from "sharp";

const INK = "#161513";
const ACCENT = "#c8f169";
const PAPER = "#f3f1ec";

// Three stacked bars: a list of spends shrinking as the month goes well.
const bars = (scale = 1) => {
  const w = [240, 176, 112].map((v) => v * scale);
  const h = 56 * scale;
  const gap = 12 * scale;
  const top = 256 - (h * 3 + gap * 2) / 2;
  const left = 256 - w[0] / 2;
  const fills = [ACCENT, PAPER, PAPER];
  const opacity = [1, 0.85, 0.45];
  return w
    .map(
      (width, i) =>
        `<rect x="${left}" y="${top + i * (h + gap)}" width="${width}" height="${h}" rx="${h / 2}" fill="${fills[i]}" fill-opacity="${opacity[i]}"/>`,
    )
    .join("");
};

const svg = ({ radius, scale }) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="${radius}" fill="${INK}"/>${bars(scale)}</svg>`;

const rounded = svg({ radius: 112, scale: 1 });
const fullBleed = svg({ radius: 0, scale: 1 });
const maskable = svg({ radius: 0, scale: 0.8 }); // stays inside the maskable safe zone

const png = (source, size, out) => sharp(Buffer.from(source)).resize(size, size).png().toFile(out);

await Promise.all([
  png(rounded, 192, "public/icons/icon-192.png"),
  png(rounded, 512, "public/icons/icon-512.png"),
  png(maskable, 512, "public/icons/maskable-512.png"),
  png(fullBleed, 180, "src/app/apple-icon.png"),
  writeFile("src/app/icon.svg", rounded),
  // Android status-bar badge: white shape on transparent.
  png(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bars().replaceAll(/fill="[^"]+"/g, 'fill="#fff"').replaceAll(/fill-opacity="[^"]+"/g, "")}</svg>`,
    96,
    "public/icons/badge-96.png",
  ),
]);
console.log("Icons generated.");
