import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const projectRoot = dirname(fileURLToPath(import.meta.url));
const outputDirectory = join(projectRoot, "dist");

// Allowlist: only these files are published. Workspace files (graph, notes, CV) never ship.
const staticFiles = [
  "_headers",
  "favicon.ico",
  "favicon.svg",
  "ink-reveal.js",
  "privacy.js",
  "script.js",
  "styles.css",
  "assets/automation-workflow.svg",
  "assets/automation-workflow-en.svg",
  "assets/automation-workflow-pt.svg",
  "assets/automation-workflow-mobile.svg",
  "assets/automation-workflow-mobile-en.svg",
  "assets/automation-workflow-mobile-pt.svg",
  "assets/apple-touch-icon.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/og-image.png",
  "assets/404-chase.gif",
  "assets/404-chase.webp",
  "assets/404-chase-still.jpg",
];

// Referenced from HTML/manifest with a content hash (?v=…) so they can be cached as immutable.
const versionedFiles = staticFiles.filter(
  (file) => /\.(css|js|svg|png|gif|webp|jpg)$/.test(file) && file !== "favicon.svg",
);

const languages = {
  es: { name: "Español", route: "/", hreflang: "es" },
  en: { name: "English", route: "/en/", hreflang: "en" },
  pt: { name: "Português", route: "/pt/", hreflang: "pt" },
};

const legalPages = [
  { file: "privacidad.html", path: "/privacidad" },
  { file: "terminos.html", path: "/terminos" },
];

const ogImage = { path: "assets/og-image.png", width: 1200, height: 630 };

// ---------------------------------------------------------------------------
// Configuration

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
} else {
  console.warn(
    "Aviso: SITE_URL no está definido. Se omiten canonical, hreflang, og:image y sitemap.",
  );
}

// ---------------------------------------------------------------------------
// Helpers

const escapeHtml = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeAttribute = (value) => escapeHtml(value).replace(/"/g, "&quot;");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function replaceOnce(html, search, replacement, label) {
  const index = html.indexOf(search);
  if (index === -1) throw new Error(`No se encontró el marcador de compilación: ${label}`);
  return html.slice(0, index) + replacement + html.slice(index + search.length);
}

async function loadTranslations() {
  // The runtime translations live in privacy.js; evaluate only the object literal.
  const source = await readFile(join(projectRoot, "privacy.js"), "utf8");
  const marker = "const copy = ";
  const start = source.indexOf(marker);
  const closing = start === -1 ? null : /\r?\n  };\r?\n/.exec(source.slice(start));
  if (start === -1 || !closing) throw new Error("No se encontraron las traducciones en privacy.js.");
  const literal = source.slice(
    start + marker.length,
    start + closing.index + closing[0].indexOf("}") + 1,
  );
  return vm.runInNewContext(`(${literal})`, Object.create(null), { timeout: 1000 });
}

async function hashFiles() {
  const hashes = new Map();
  for (const file of versionedFiles) {
    const content = await readFile(join(projectRoot, file));
    hashes.set(file, createHash("sha256").update(content).digest("hex").slice(0, 10));
  }
  return hashes;
}

// Mirrors setLocalizedCopy() in privacy.js so each language is real, crawlable HTML.
function applyTranslations(html, strings, language) {
  html = html.replace(
    /<([a-zA-Z][\w-]*)(\s(?:[^>]*?\s)?data-copy="([^"]+)"[^>]*)>([^<]*)/g,
    (match, tag, attributes, key, text, offset, whole) => {
      const value = strings[key];
      if (typeof value !== "string") {
        throw new Error(`Falta la traducción "${key}" para ${language}.`);
      }

      const attributeTarget = attributes.match(/\sdata-copy-attr="([^"]+)"/)?.[1];
      if (attributeTarget) {
        const pattern = new RegExp(`(\\s${escapeRegExp(attributeTarget)}=")[^"]*(")`);
        const nextAttributes = pattern.test(attributes)
          ? attributes.replace(pattern, (_, before, after) => `${before}${escapeAttribute(value)}${after}`)
          : `${attributes} ${attributeTarget}="${escapeAttribute(value)}"`;
        return `<${tag}${nextAttributes}>${text}`;
      }

      const following = whole.slice(offset + match.length, offset + match.length + 2);
      if (following !== "</") {
        throw new Error(`El elemento con data-copy="${key}" debe contener solo texto.`);
      }
      return `<${tag}${attributes}>${escapeHtml(value)}`;
    },
  );

  // Language switcher state.
  const { name } = languages[language];
  html = html.replace(
    /(<span data-language-current>)[^<]*(<\/span>)/,
    `$1${escapeHtml(name)}$2`,
  );
  html = html.replace(
    /(data-language-current-code aria-hidden="true">)[^<]*(<)/,
    `$1${language.toUpperCase()}$2`,
  );
  html = html.replace(
    /(aria-label=")[^"]*("\s+aria-haspopup="listbox")/,
    `$1${escapeAttribute(`${strings["language.aria"]}: ${name}`)}$2`,
  );
  const triggerIndex = html.indexOf("data-site-language");
  const flagIndex = html.indexOf('<use href="#site-flag-es">', triggerIndex);
  if (triggerIndex !== -1 && flagIndex !== -1) {
    html =
      html.slice(0, flagIndex) +
      `<use href="#site-flag-${language}">` +
      html.slice(flagIndex + '<use href="#site-flag-es">'.length);
  }
  html = html.replace(
    /aria-selected="(?:true|false)" data-language-option="(\w+)"/g,
    (_, option) => `aria-selected="${option === language}" data-language-option="${option}"`,
  );

  // Localized legal links and workflow artwork.
  html = html.replace(/\?lang=es"/g, `?lang=${language}"`);
  if (language !== "es") {
    // Anchor on whitespace so data-src-es="…" (same URL) is never rewritten.
    html = html.replace(
      /(\s)src="\.\/assets\/automation-workflow\.svg"/,
      `$1src="./assets/automation-workflow-${language}.svg"`,
    );
    html = html.replace(
      /(\s)srcset="\.\/assets\/automation-workflow-mobile\.svg"/,
      `$1srcset="./assets/automation-workflow-mobile-${language}.svg"`,
    );
  }
  return html;
}

// Cloudflare serves /page.html at /page; link to the final URL to avoid redirects.
function rewriteInternalLinks(html) {
  return html
    .replace(/(["'])\.\/index\.html(["'#?])/g, "$1./$2")
    .replace(/privacidad\.html/g, "privacidad")
    .replace(/terminos\.html/g, "terminos");
}

// The Worker serves the site from the domain root, so built pages use root-absolute
// URLs. This keeps assets valid when the language route changes via history.replaceState.
function useRootPaths(content) {
  return content.replace(/((?:\s(?:href|src|srcset|data-src-\w+)=|"(?:src|start_url|scope)":\s*)")\.\//g, "$1/");
}

function versionAssets(html, hashes) {
  for (const [file, hash] of hashes) {
    const pattern = new RegExp(`"((?:\\.{1,2}/|/)?)${escapeRegExp(file)}"`, "g");
    html = html.replace(pattern, `"$1${file}?v=${hash}"`);
  }
  return html;
}

function buildHeadMetadata({ pageUrl, alternates, localeAlternates, hashes }) {
  const lines = [];
  if (pageUrl) {
    lines.push(`<link rel="canonical" href="${pageUrl}">`);
    lines.push(`<meta property="og:url" content="${pageUrl}">`);
  }
  if (alternates) {
    for (const [hreflang, href] of alternates) {
      lines.push(`<link rel="alternate" hreflang="${hreflang}" href="${href}">`);
    }
  }
  for (const locale of localeAlternates ?? []) {
    lines.push(`<meta property="og:locale:alternate" content="${locale}">`);
  }
  if (siteOrigin) {
    const imageUrl = `${siteOrigin}/${ogImage.path}?v=${hashes.get(ogImage.path)}`;
    lines.push(`<meta property="og:image" content="${imageUrl}">`);
    lines.push(`<meta property="og:image:width" content="${ogImage.width}">`);
    lines.push(`<meta property="og:image:height" content="${ogImage.height}">`);
    lines.push(`<meta property="og:image:alt" content="Lucian Rodríguez Plasencia · Portafolio">`);
    lines.push(`<meta name="twitter:image" content="${imageUrl}">`);
  }
  return lines.map((line) => `    ${line}`).join("\n");
}

function enrichStructuredData(html, { language, strings, pageUrl, hashes }) {
  const pattern = /(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/;
  const match = html.match(pattern);
  if (!match) return html;

  const data = JSON.parse(match[2]);
  const nodes = data["@graph"] ?? [data];
  const absoluteId = (id) => (siteOrigin && id?.startsWith("#") ? `${siteOrigin}/${id}` : id);

  for (const node of nodes) {
    if (node["@type"] === "ProfilePage") {
      node.inLanguage = language;
      node.name = strings["meta.title"];
      node.description = strings["meta.description"];
      if (pageUrl) {
        node.url = pageUrl;
        node["@id"] = `${pageUrl}#profile`;
      }
    } else {
      node["@id"] = absoluteId(node["@id"]);
    }
    if (siteOrigin && node["@type"] === "WebSite") node.url = `${siteOrigin}/`;
    if (siteOrigin && node["@type"] === "Person") {
      node.url = `${siteOrigin}/`;
      node.image = `${siteOrigin}/${ogImage.path}?v=${hashes.get(ogImage.path)}`;
    }
    for (const key of ["isPartOf", "mainEntity", "publisher"]) {
      if (node[key]?.["@id"]) node[key]["@id"] = absoluteId(node[key]["@id"]);
    }
  }

  // Escape "<" so the JSON can never close the script element.
  const json = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
  const indented = json.split("\n").map((line) => `      ${line}`).join("\n");
  return html.replace(pattern, (_, open, __, close) => `${open}\n${indented}\n    ${close}`);
}

// ---------------------------------------------------------------------------
// Build

const translations = await loadTranslations();
const hashes = await hashFiles();
const buildDate = new Date().toISOString().slice(0, 10);

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of staticFiles) {
  const destination = join(outputDirectory, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(projectRoot, file), destination);
}

async function writeOutput(relativePath, content) {
  const destination = join(outputDirectory, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, "utf8");
}

// Portfolio: one static page per language.
const indexSource = await readFile(join(projectRoot, "index.html"), "utf8");
const portfolioAlternates = siteOrigin
  ? [
      ...Object.values(languages).map(({ hreflang, route }) => [hreflang, `${siteOrigin}${route}`]),
      ["x-default", `${siteOrigin}/`],
    ]
  : null;

for (const [language, { route }] of Object.entries(languages)) {
  const strings = translations[language];
  const isNested = route !== "/";
  const pageUrl = siteOrigin ? `${siteOrigin}${route}` : "";
  let html = applyTranslations(indexSource, strings, language);

  html = replaceOnce(
    html,
    '<html lang="es">',
    `<html lang="${language}"${isNested ? ` data-page-language="${language}"` : ""} data-i18n-routes="true" data-site-root="/">`,
    "<html lang>",
  );
  html = rewriteInternalLinks(html);
  html = replaceOnce(
    html,
    "    <!-- SITE_URL_METADATA -->",
    buildHeadMetadata({
      pageUrl,
      alternates: portfolioAlternates,
      localeAlternates: Object.keys(languages)
        .filter((other) => other !== language)
        .map((other) => translations[other]["meta.locale"]),
      hashes,
    }),
    "SITE_URL_METADATA",
  );
  if (siteOrigin) {
    html = html.replace('content="summary"', 'content="summary_large_image"');
  }
  html = enrichStructuredData(html, { language, strings, pageUrl, hashes });
  html = useRootPaths(versionAssets(html, hashes));

  await writeOutput(isNested ? `${route.slice(1)}index.html` : "index.html", html);
}

// Legal pages keep their in-page language sections.
for (const page of legalPages) {
  let html = await readFile(join(projectRoot, page.file), "utf8");
  html = replaceOnce(html, '<html lang="es">', '<html lang="es" data-site-root="/">', "<html lang>");
  html = rewriteInternalLinks(html);
  html = replaceOnce(
    html,
    "    <!-- SITE_URL_METADATA -->",
    buildHeadMetadata({ pageUrl: siteOrigin ? `${siteOrigin}${page.path}` : "", hashes }),
    `SITE_URL_METADATA (${page.file})`,
  );
  html = useRootPaths(versionAssets(html, hashes));
  await writeOutput(page.file, html);
}

// 404 page (served by the Worker for unknown paths) and manifest.
await writeOutput(
  "404.html",
  useRootPaths(versionAssets(await readFile(join(projectRoot, "404.html"), "utf8"), hashes)),
);
await writeOutput(
  "site.webmanifest",
  useRootPaths(versionAssets(await readFile(join(projectRoot, "site.webmanifest"), "utf8"), hashes)),
);

// Crawling.
const sitemapEntries = [
  ...Object.values(languages).map(({ route }) => ({
    loc: `${siteOrigin}${route}`,
    alternates: portfolioAlternates,
  })),
  ...legalPages.map((page) => ({ loc: `${siteOrigin}${page.path}`, alternates: null })),
];
const sitemap = siteOrigin
  ? `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${sitemapEntries
  .map(
    ({ loc, alternates }) =>
      `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${buildDate}</lastmod>\n${(alternates ?? [])
        .map(([hreflang, href]) => `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}"/>\n`)
        .join("")}  </url>`,
  )
  .join("\n")}
</urlset>
`
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

console.log(
  `Build completado en dist/ (${Object.keys(languages).length} idiomas${siteOrigin ? `, ${siteOrigin}` : ", sin SITE_URL"}).`,
);
