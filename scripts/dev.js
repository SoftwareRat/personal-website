const express = require("express");
const chokidar = require("chokidar");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs-extra");

const app = express();
const PORT = 3000;

// Ensure public directory exists
fs.ensureDirSync("public");

// Set proper MIME type for RSS feed
app.get("/rss.xml", (req, res) => {
  res.type("application/rss+xml");
  res.sendFile(path.join(__dirname, "../public/rss.xml"));
});

// Serve static files from the public directory
app.use(express.static("public"));

// Handle all routes
app.get("*", (req, res) => {
  // Try to find the exact path first
  const reqPath = req.path.endsWith("/") ? req.path + "index.html" : req.path;
  const exactPath = path.join(__dirname, "../public", reqPath);
  const indexPath = path.join(__dirname, "../public", req.path, "index.html");
  const notFoundPath = path.join(__dirname, "../public/404.html");

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
const server = app.listen(PORT, () => {
  console.log(`🌎 Development server running at http://localhost:${PORT}`);
});

// Handle server errors
server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Please try a different port.`
    );
    process.exit(1);
  } else {
    console.error("Server error:", error);
  }
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

// Build on file changes
watcher
  .on("ready", () => {
    console.log("👀 Watching for changes...");
  })
  .on("add", (path) => {
    console.log(`File ${path} has been added`);
    runBuild();
  })
  .on("change", (path) => {
    console.log(`File ${path} has been changed`);
    runBuild();
  })
  .on("unlink", (path) => {
    console.log(`File ${path} has been removed`);
    runBuild();
  });

let buildInProgress = false;
let buildQueued = false;

async function runBuild() {
  if (buildInProgress) {
    buildQueued = true;
    return;
  }

  buildInProgress = true;

  try {
    // Clean the public directory
    await fs.emptyDir("public");

    // Run the build script and generate RSS feed
    const build = spawn("node", ["scripts/build.js"], {
      stdio: "inherit",
    });

    build.on("close", async (code) => {
      if (code === 0) {
        // Generate RSS feed after successful build
        const rss = spawn("node", ["scripts/generate-rss.js"], {
          stdio: "inherit",
        });

        rss.on("close", (rssCode) => {
          buildInProgress = false;

          if (rssCode === 0) {
            console.log("🔄 Site rebuilt successfully");
          } else {
            console.error("❌ RSS generation failed");
          }

          // If another build was queued, run it
          if (buildQueued) {
            buildQueued = false;
            runBuild();
          }
        });
      } else {
        buildInProgress = false;
        console.error("❌ Build failed");

        // If another build was queued, run it
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

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nDevelopment server stopped");
  server.close(() => {
    process.exit(0);
  });
});
