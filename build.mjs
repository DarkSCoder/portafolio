import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const outputDirectory = join(projectRoot, "dist");
const publicFiles = [
  "_headers",
  "Curriculum Lucian_1.pdf",
  "index.html",
  "ink-reveal.js",
  "script.js",
  "styles.css",
  "assets/automation-workflow.svg",
];
const configuredSiteUrl = process.env.SITE_URL;
let siteOrigin = "";

if (configuredSiteUrl) {
  const siteUrl = new URL(configuredSiteUrl);
  if (
    siteUrl.protocol !== "https:" ||
    siteUrl.username ||
    siteUrl.password ||
    siteUrl.pathname !== "/" ||
    siteUrl.search ||
    siteUrl.hash
  ) {
    throw new Error("SITE_URL debe ser el origen HTTPS del sitio, sin ruta ni parámetros.");
  }
  siteOrigin = siteUrl.origin;
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of publicFiles) {
  const destination = join(outputDirectory, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(projectRoot, file), destination);
}

const indexPath = join(outputDirectory, "index.html");
let html = await readFile(indexPath, "utf8");
const siteMetadata = siteOrigin
  ? `    <link rel="canonical" href="${siteOrigin}/">\n    <meta property="og:url" content="${siteOrigin}/">`
  : "";
html = html.replace("    <!-- SITE_URL_METADATA -->", siteMetadata);
await writeFile(indexPath, html, "utf8");

const sitemap = siteOrigin
  ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${siteOrigin}/</loc></url></urlset>\n`
  : "";
const sitemapDirective = sitemap ? `Sitemap: ${siteOrigin}/sitemap.xml\n` : "";
await writeFile(
  join(outputDirectory, "robots.txt"),
  `User-agent: *\nAllow: /\n${sitemapDirective}`,
  "utf8",
);

if (sitemap) {
  await writeFile(join(outputDirectory, "sitemap.xml"), sitemap, "utf8");
}
