const http = require("http");
const fs = require("fs");
const path = require("path");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function resolvePath(urlPath) {
  const cleanPath = decodeURIComponent((urlPath || "/").split("?")[0]);
  const requested = cleanPath === "/" ? "/index.html" : cleanPath;
  const absolutePath = path.normalize(path.join(ROOT, requested));

  if (!absolutePath.startsWith(ROOT)) {
    return null;
  }

  return absolutePath;
}

function sendFile(filePath, response) {
  fs.readFile(filePath, (error, data) => {
    if (error) {
      if (error.code === "ENOENT") {
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not Found");
        return;
      }

      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Internal Server Error");
      return;
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": MIME_TYPES[extension] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(data);
  });
}

function createServer() {
  return http.createServer((request, response) => {
    const filePath = resolvePath(request.url);

    if (!filePath) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    fs.stat(filePath, (error, stats) => {
      if (!error && stats.isDirectory()) {
        sendFile(path.join(filePath, "index.html"), response);
        return;
      }

      sendFile(filePath, response);
    });
  });
}

function startServer(options = {}) {
  const host = options.host || HOST;
  const port = Number(options.port || PORT);
  const server = createServer();

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      console.log(`Preview server running at http://${host}:${port}`);
      resolve(server);
    });
  });
}

module.exports = {
  createServer,
  startServer
};

if (require.main === module) {
  startServer().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
