const fs = require("fs-extra");
const path = require("path");
const { marked } = require("marked");
const frontMatter = require("front-matter");
const handlebars = require("handlebars");

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
    const d = new Date(date);
    const pad = (num) => String(num).padStart(2, "0");

    const day = pad(d.getDate());
    const month = pad(d.getMonth() + 1);
    const year = d.getFullYear();
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());

    return `${day}-${month}-${year} ${hours}:${minutes}`;
  });
}

// Register helpers
registerHandlebarsHelpers();

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

// Process blog posts and return metadata
function processBlogPosts() {
  const postsDir = path.join("content/blog/posts");
  const posts = [];
  const tagMap = new Map();

  if (fs.existsSync(postsDir)) {
    const files = fs.readdirSync(postsDir);
    files.forEach((file) => {
      if (path.extname(file) === ".md") {
        const content = fs.readFileSync(path.join(postsDir, file), "utf8");
        const { attributes, body } = frontMatter(content);
        const html = marked.parse(body);

        // Process tags for this post
        let tags = [];
        if (attributes.tags) {
          tags = Array.isArray(attributes.tags)
            ? attributes.tags.map((tag) => tag.trim())
            : attributes.tags.split(",").map((tag) => tag.trim());
        }

        // Count tag usage for this post's tags only
        tags.forEach((tag) => {
          const count = tagMap.get(tag) || 0;
          tagMap.set(tag, count + 1);
        });

        // Create the post object with its own tags
        posts.push({
          ...attributes,
          content: html,
          url: `/blog/posts/${path.basename(file, ".md")}`,
          excerpt: attributes.excerpt || "",
          tags: tags,
        });
      }
    });
  }

  // Sort posts by date
  return {
    posts: posts.sort((a, b) => new Date(b.date) - new Date(a.date)),
    tags: Array.from(tagMap.entries())
      .map(([tag, count]) => ({
        name: tag,
        count: count,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    tagList: Array.from(tagMap.keys()).sort(),
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

// Process markdown files recursively
function processDirectory(dir, baseOutputDir = "public") {
  const files = fs.readdirSync(dir);
  const defaultTemplate = loadTemplate("layouts/default.html");
  const postTemplate = loadTemplate("layouts/post.html");
  const blogTemplate = loadTemplate("layouts/blog.html");
  const { posts, tags, tagList } = processBlogPosts();

  // Generate tag pages first
  generateTagPages(posts, tags, baseOutputDir);

  // Generate 404 page
  const notFoundContent = fs.readFileSync("content/404.md", "utf8");
  const { attributes: notFoundAttr, body: notFoundBody } =
    frontMatter(notFoundContent);
  const notFoundHtml = marked.parse(notFoundBody);
  fs.writeFileSync(
    path.join(baseOutputDir, "404.html"),
    defaultTemplate({
      ...notFoundAttr,
      content: notFoundHtml,
    })
  );

  const tagCounts = {};
  posts.forEach((post) => {
    if (post.tags) {
      post.tags.forEach((tag) => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    }
  });

  files.forEach((file) => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // Create corresponding output directory
      const relativePath = path.relative("content", fullPath);
      const outputDir = path.join(baseOutputDir, relativePath);
      fs.ensureDirSync(outputDir);

      // Process files in subdirectory
      processDirectory(fullPath, baseOutputDir);
      return;
    }

    if (path.extname(file) !== ".md") return;

    const content = fs.readFileSync(fullPath, "utf8");
    const { attributes, body } = frontMatter(content);
    const html = marked.parse(body);

    // Determine output path
    const relativePath = path.relative("content", dir);
    const basename = path.basename(file, ".md");
    let outputPath;

    if (basename === "index") {
      outputPath = path.join(baseOutputDir, relativePath, "index.html");
    } else {
      const dirPath = path.join(baseOutputDir, relativePath, basename);
      fs.ensureDirSync(dirPath);
      outputPath = path.join(dirPath, "index.html");
    }

    // Generate page title
    let title = attributes.title || "SoftwareRat";
    if (title !== "SoftwareRat") {
      title += " - SoftwareRat";
    }

    // Prepare template data
    let templateData;
    if (relativePath.startsWith("blog/posts")) {
      // For individual blog posts, use the post's own tags
      templateData = {
        ...attributes,
        title,
        content: html,
        tags: attributes.tags || [],
        thumbnail: attributes.thumbnail || null,
      };
    } else {
      // For other pages, including blog index
      templateData = {
        ...attributes,
        title,
        content: html,
        posts: posts,
        tags: tagList,
        tagCounts: tagCounts,
      };
    }

    // Choose template based on path
    let template = defaultTemplate;
    if (relativePath.startsWith("blog/posts")) {
      template = postTemplate;
    } else if (relativePath === "blog" && basename === "index") {
      template = blogTemplate;
    }

    // Render the template
    const finalHtml = template(templateData);

    fs.writeFileSync(outputPath, finalHtml);
  });
}

// Build process
try {
  // Clean the public directory
  fs.emptyDirSync("public");

  // Copy static assets
  copyStaticAssets();

  // Process all markdown files recursively
  processDirectory("content");

  console.log("Build completed successfully!");
} catch (error) {
  console.error("Build failed:", error);
  process.exit(1);
}
