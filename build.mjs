import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const outputDirectory = join(projectRoot, "dist");
const publicFiles = [
  "_headers",
  "index.html",
  "ink-reveal.js",
  "privacy.js",
  "privacidad.html",
  "script.js",
  "styles.css",
  "terminos.html",
  "assets/automation-workflow.svg",
  "assets/automation-workflow-en.svg",
  "assets/automation-workflow-pt.svg",
  "assets/automation-workflow-mobile.svg",
  "assets/automation-workflow-mobile-en.svg",
  "assets/automation-workflow-mobile-pt.svg",
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

const pages = [
  { file: "index.html", path: "/" },
  { file: "privacidad.html", path: "/privacidad.html" },
  { file: "terminos.html", path: "/terminos.html" },
];

for (const page of pages) {
  const pagePath = join(outputDirectory, page.file);
  let html = await readFile(pagePath, "utf8");
  const pageUrl = siteOrigin ? `${siteOrigin}${page.path}` : "";
  const siteMetadata = pageUrl
    ? `    <link rel="canonical" href="${pageUrl}">\n    <meta property="og:url" content="${pageUrl}">`
    : "";
  html = html.replace("    <!-- SITE_URL_METADATA -->", siteMetadata);
  await writeFile(pagePath, html, "utf8");
}

const sitemap = siteOrigin
  ? `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages
      .map((page) => `<url><loc>${siteOrigin}${page.path}</loc></url>`)
      .join("")}</urlset>\n`
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
