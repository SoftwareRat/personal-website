import express from "express";
import path from "path";
import chokidar from "chokidar";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import fs from "fs-extra";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 3000;

// Ensure public directory exists
fs.ensureDirSync("public");

// Set proper MIME types
app.get("/feed.xml", (req, res) => {
  res.type("application/rss+xml");
  res.sendFile(path.join(process.cwd(), "public/feed.xml"));
});

// Serve static files from the public directory
app.use(express.static("public"));

// Handle all routes
app.get("*", (req, res) => {
  // Try to find the exact path first
  const reqPath = req.path.endsWith("/") ? req.path + "index.html" : req.path;
  const exactPath = path.join(process.cwd(), "public", reqPath);
  const indexPath = path.join(process.cwd(), "public", req.path, "index.html");
  const notFoundPath = path.join(process.cwd(), "public/404.html");

  // Check files in this order:
  // 1. Exact path (e.g., /about.html)
  // 2. Path with /index.html (e.g., /about/index.html)
  // 3. 404 page
  if (fs.existsSync(exactPath)) {
    res.sendFile(exactPath);
  } else if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).sendFile(notFoundPath);
  }
});

// Start the server
const server = app.listen(port, () => {
  console.log(`🌎 Development server running at http://localhost:${port}`);
});

// Watch for file changes
const watcher = chokidar.watch(
  ["content/**/*", "layouts/**/*", "static/**/*"],
  {
    ignored: /(^|[\/\\])\../,
    persistent: true,
    ignoreInitial: false,
  }
);

let buildInProgress = false;
let buildQueued = false;

async function runBuild() {
  if (buildInProgress) {
    buildQueued = true;
    return;
  }

  buildInProgress = true;
  console.log("🔄 Starting build...");

  try {
    const build = spawn("node", ["scripts/build.js"], {
      stdio: "inherit",
      shell: true,
    });

    build.on("close", async (code) => {
      if (code === 0) {
        // Generate RSS feed after successful build
        const rss = spawn("node", ["scripts/generate-rss.js"], {
          stdio: "inherit",
          shell: true,
        });

        rss.on("close", (rssCode) => {
          buildInProgress = false;

          if (rssCode === 0) {
            console.log("✅ Build completed successfully");
          } else {
            console.error("❌ RSS generation failed");
          }

          if (buildQueued) {
            buildQueued = false;
            runBuild();
          }
        });
      } else {
        buildInProgress = false;
        console.error("❌ Build failed");

        if (buildQueued) {
          buildQueued = false;
          runBuild();
        }
      }
    });
  } catch (error) {
    console.error("Error during build:", error);
    buildInProgress = false;
  }
}

// Watch for changes
watcher
  .on("ready", () => {
    console.log("👀 Watching for changes...");
  })
  .on("add", (path) => {
    console.log(`📝 File ${path} has been added`);
    runBuild();
  })
  .on("change", (path) => {
    console.log(`📝 File ${path} has been changed`);
    runBuild();
  })
  .on("unlink", (path) => {
    console.log(`🗑️  File ${path} has been removed`);
    runBuild();
  });

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Development server stopped");
  server.close(() => {
    process.exit(0);
  });
});
