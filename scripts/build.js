import fs from "fs-extra";
import path from "path";
import { marked } from "marked";
import frontMatter from "front-matter";
import handlebars from "handlebars";
import { SitemapStream } from "sitemap";
import { streamToPromise } from "sitemap";
import { Readable } from "stream";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure marked to allow HTML
marked.setOptions({
  headerIds: true,
  mangle: false,
  breaks: true,
  gfm: true,
  xhtml: true,
});

// Register Handlebars helpers
function registerHandlebarsHelpers() {
  handlebars.registerHelper("if_eq", function (a, b, opts) {
    if (a === b) return opts.fn(this);
    return opts.inverse(this);
  });

  handlebars.registerHelper("lookup", function (obj, key) {
    return obj[key];
  });

  // Add date formatting helper
  handlebars.registerHelper("formatDate", function (date) {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";

    const pad = (num) => String(num).padStart(2, "0");
    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();

    return `${day}-${month}-${year}`;
  });
}

// Register helpers first
registerHandlebarsHelpers();

// Register layouts and partials
function registerTemplates() {
  const defaultTemplateContent = fs.readFileSync(
    "layouts/default.html",
    "utf8"
  );
  const blogTemplateContent = fs.readFileSync("layouts/blog.html", "utf8");
  const postTemplateContent = fs.readFileSync("layouts/post.html", "utf8");

  // Compile templates
  const defaultTemplate = handlebars.compile(defaultTemplateContent);
  const blogTemplate = handlebars.compile(blogTemplateContent);
  const postTemplate = handlebars.compile(postTemplateContent);

  // Create wrapper functions that handle layout
  return {
    defaultTemplate: (data) => defaultTemplate(data),
    blogTemplate: (data) =>
      defaultTemplate({ ...data, content: blogTemplate(data) }),
    postTemplate: (data) =>
      defaultTemplate({ ...data, content: postTemplate(data) }),
  };
}

const templates = registerTemplates();

// Ensure the public directory exists
fs.ensureDirSync("public");

// Copy static assets
function copyStaticAssets() {
  // Copy CSS files
  fs.copySync("static/css", "public/css", {
    filter: (src) => {
      return path.extname(src) === ".css" || fs.statSync(src).isDirectory();
    },
  });

  // Copy JavaScript files
  fs.copySync("static/js", "public/js", {
    filter: (src) => {
      return path.extname(src) === ".js" || fs.statSync(src).isDirectory();
    },
  });

  // Copy images
  if (fs.existsSync("static/images")) {
    fs.copySync("static/images", "public/images");
  }
}

// Load and compile templates
function loadTemplate(templatePath) {
  const templateContent = fs.readFileSync(templatePath, "utf8");
  return handlebars.compile(templateContent);
}

// Calculate reading time
function calculateReadingTime(content) {
  const wordsPerMinute = 200;
  const words = content.trim().split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

// Process blog posts and return metadata
function processBlogPosts() {
  const postsDir = path.join("content/blog/posts");
  const posts = [];
  const tagMap = new Map();

  if (fs.existsSync(postsDir)) {
    const files = fs.readdirSync(postsDir);
    files.forEach((file) => {
      if (path.extname(file) === ".md" && !file.endsWith(".template")) {
        const content = fs.readFileSync(path.join(postsDir, file), "utf8");
        const { attributes, body } = frontMatter(content);

        // Process markdown content through Handlebars first
        const processedBody = handlebars.compile(body)({
          ...attributes,
          currentYear: new Date().getFullYear(),
        });
        const html = marked.parse(processedBody);

        // Calculate reading time
        const readingTime = calculateReadingTime(processedBody);

        // Process tags
        const tags = attributes.tags
          ? (Array.isArray(attributes.tags)
              ? attributes.tags
              : attributes.tags.split(",")
            ).map((tag) => tag.trim())
          : [];

        // Update tag counts
        tags.forEach((tag) => {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        });

        // Set the slug from the filename
        const slug = path.basename(file, ".md");

        // Create excerpt if not provided
        const excerpt = attributes.excerpt || processedBody.split("\n")[0];

        posts.push({
          ...attributes,
          content: html,
          excerpt: excerpt,
          tags,
          readingTime,
          slug,
          path: `/blog/posts/${slug}/`,
          isBlogPost: true,
          description: attributes.description || excerpt,
        });
      }
    });
  }

  return {
    posts: posts.sort((a, b) => new Date(b.date) - new Date(a.date)),
    tags: Array.from(tagMap.keys()).sort(),
    tagCounts: Object.fromEntries(tagMap),
  };
}

// Generate tag pages
function generateTagPages(posts, tags, baseOutputDir) {
  const tagTemplate = loadTemplate("layouts/tag.html");

  // Create tags directory
  const tagsDir = path.join(baseOutputDir, "tags");
  fs.ensureDirSync(tagsDir);

  // Get all unique tags from posts
  const uniqueTags = new Set();
  posts.forEach((post) => {
    if (post.tags) {
      post.tags.forEach((tag) => uniqueTags.add(tag));
    }
  });

  // Generate a page for each unique tag
  uniqueTags.forEach((tag) => {
    const taggedPosts = posts.filter(
      (post) => post.tags && post.tags.includes(tag)
    );
    const outputPath = path.join(tagsDir, tag, "index.html");

    // Create directory for this tag
    fs.ensureDirSync(path.dirname(outputPath));

    // Render tag page
    const html = tagTemplate({
      tag,
      posts: taggedPosts,
      title: `Posts tagged "${tag}"`,
    });

    fs.writeFileSync(outputPath, html);
  });
}

// Generate search index
function generateSearchIndex(posts) {
  const searchIndex = posts.map((post) => ({
    title: post.title,
    content: post.content.replace(/<[^>]*>/g, ""), // Strip HTML tags
    excerpt: post.excerpt,
    url: post.path,
    date: post.date,
    tags: post.tags || [],
    readingTime: post.readingTime,
  }));

  // Ensure the public directory exists
  fs.ensureDirSync("public");

  // Write the search index to a JSON file
  fs.writeFileSync("public/search-index.json", JSON.stringify(searchIndex));
  console.log(`Search index generated with ${searchIndex.length} posts`);

  // Also write a pretty version for debugging
  fs.writeFileSync(
    "public/search-index.pretty.json",
    JSON.stringify(searchIndex, null, 2)
  );
}

// Generate RSS feed
async function generateRSSFeed(posts) {
  const siteURL = "https://softwarerat.tech";
  const links = posts.map((post) => ({
    url: `${siteURL}${post.path}`,
    changefreq: "weekly",
    priority: 0.7,
    lastmod: post.date,
  }));

  const stream = new SitemapStream({ hostname: siteURL });
  const data = await streamToPromise(Readable.from(links).pipe(stream));
  fs.writeFileSync("public/rss.xml", data.toString());
  console.log("RSS feed generated successfully!");
}

// Process directory
async function processDirectory(dir, baseOutputDir = "public") {
  try {
    // Process blog posts first
    const { posts, tags, tagCounts } = processBlogPosts();

    // Generate search index before anything else
    generateSearchIndex(posts);

    // Build blog index
    buildBlogIndex(posts, tags, tagCounts);

    // Generate tag pages
    generateTagPages(posts, tags, baseOutputDir);

    // Copy static assets
    copyStaticAssets();

    // Process all markdown files
    processMarkdownFiles(dir, baseOutputDir);

    // Generate RSS feed
    await generateRSSFeed(posts);

    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

// Process markdown files
function processMarkdownFiles(dir, baseOutputDir) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Create corresponding output directory
      const relativePath = path.relative("content", fullPath);
      const outputDir = path.join(baseOutputDir, relativePath);
      fs.ensureDirSync(outputDir);

      // Process files in subdirectory
      processMarkdownFiles(fullPath, baseOutputDir);
      return;
    }

    // Skip non-markdown files and templates
    if (path.extname(file) !== ".md" || file.endsWith(".template")) return;

    // Skip blog index.md since we generate it separately
    if (path.relative("content", dir) === "blog" && file === "index.md") return;

    const content = fs.readFileSync(fullPath, "utf8");
    const { attributes, body } = frontMatter(content);

    // Prepare template data
    const templateData = {
      ...attributes,
      currentYear: new Date().getFullYear(),
      currentDate: new Date().toISOString().split("T")[0],
    };

    // Process markdown content through Handlebars first
    const processedBody = handlebars.compile(body)(templateData);
    const html = marked.parse(processedBody);

    // Determine output path
    const relativePath = path.relative("content", dir);
    const basename = path.basename(file, ".md");
    let outputPath;

    if (basename === "404") {
      outputPath = path.join(baseOutputDir, "404.html");
    } else if (basename === "index") {
      outputPath = path.join(baseOutputDir, relativePath, "index.html");
    } else {
      const dirPath = path.join(baseOutputDir, relativePath, basename);
      fs.ensureDirSync(dirPath);
      outputPath = path.join(dirPath, "index.html");
    }

    // Generate page title
    let title = attributes.title || "SoftwareRat";
    if (title !== "SoftwareRat") {
      title = `${title} - SoftwareRat`;
    }

    // Calculate reading time for blog posts
    let readingTime;
    if (relativePath.startsWith("blog/posts")) {
      readingTime = calculateReadingTime(processedBody);
    }

    // Update template data with processed content
    templateData.title = title;
    templateData.content = html;
    templateData.path = `/${relativePath}/${basename}/`.replace(/\/+/g, "/");
    templateData.readingTime = readingTime;
    templateData.isBlogPost = relativePath.startsWith("blog/posts");
    templateData.description =
      attributes.description || html.split("\n")[0].replace(/<[^>]*>/g, "");

    // Choose template based on path
    let template = templates.defaultTemplate;
    if (relativePath.startsWith("blog/posts")) {
      template = templates.postTemplate;
      templateData.content = html; // Ensure content is passed correctly for blog posts
    }

    // Render the template
    const finalHtml = template(templateData);
    fs.writeFileSync(outputPath, finalHtml);
  });
}

// Main build function
async function build() {
  try {
    // Clean the public directory
    fs.emptyDirSync("public");

    // Process all content
    await processDirectory("content");

    // Generate sitemap and robots.txt
    const { posts } = processBlogPosts();
    await generateSitemap(posts);
    generateRobotsTxt();

    console.log("Build completed successfully!");
  } catch (error) {
    console.error("Build failed:", error);
    process.exit(1);
  }
}

async function generateSitemap(blogPosts) {
  const links = [
    { url: "/", changefreq: "daily", priority: 1.0 },
    { url: "/about/", changefreq: "monthly", priority: 0.8 },
    { url: "/blog/", changefreq: "daily", priority: 0.9 },
    { url: "/projects/", changefreq: "weekly", priority: 0.8 },
    { url: "/contact/", changefreq: "monthly", priority: 0.7 },
    { url: "/donate/", changefreq: "monthly", priority: 0.7 },
  ];

  // Add blog posts to sitemap
  blogPosts.forEach((post) => {
    links.push({
      url: `/blog/posts/${post.slug}/`,
      changefreq: "monthly",
      priority: 0.6,
      lastmod: post.date,
    });
  });

  // Add tag pages to sitemap
  const tags = new Set();
  blogPosts.forEach((post) => {
    (post.tags || []).forEach((tag) => tags.add(tag));
  });
  tags.forEach((tag) => {
    links.push({
      url: `/tags/${tag}/`,
      changefreq: "weekly",
      priority: 0.5,
    });
  });

  const stream = new SitemapStream({ hostname: "https://softwarerat.tech" });
  const data = await streamToPromise(Readable.from(links).pipe(stream));
  fs.writeFileSync("public/sitemap.xml", data.toString());
}

function generateRobotsTxt() {
  const robotsTxt = `User-agent: *
Allow: /

# Sitemaps
Sitemap: https://softwarerat.tech/sitemap.xml

# Files subdomain
Allow: https://files.softwarerat.tech/

# Crawl-delay
Crawl-delay: 10

# Disallow
Disallow: /api/
Disallow: /admin/
Disallow: /private/
`;

  fs.writeFileSync("public/robots.txt", robotsTxt);
}

// Build blog index page
function buildBlogIndex(posts, tags, tagCounts) {
  const html = templates.blogTemplate({
    title: "Blog - SoftwareRat",
    description:
      "SoftwareRat's Blog - Thoughts on software development, tech, and life",
    isBlogPage: true,
    posts: posts.map((post) => ({
      ...post,
      url: post.path,
    })),
    tags: Object.entries(tagCounts).map(([tag, count]) => ({
      name: tag,
      count: count,
    })),
    path: "/blog",
    currentYear: new Date().getFullYear(),
  });

  const outputPath = path.join("public/blog/index.html");
  fs.ensureDirSync(path.dirname(outputPath));
  fs.writeFileSync(outputPath, html);
}

// Run build
build().catch(console.error);
