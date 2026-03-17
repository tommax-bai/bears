const http = require("http");
const { spawn } = require("child_process");
const { startServer } = require("./server.js");

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 4173);
const TARGET_URL = `http://${HOST}:${PORT}/`;

function openCommand(url) {
  if (process.platform === "darwin") {
    return { command: "open", args: [url] };
  }
  if (process.platform === "win32") {
    return { command: "cmd", args: ["/c", "start", "", url] };
  }
  return { command: "xdg-open", args: [url] };
}

function waitForServer(url, attempts) {
  return new Promise((resolve, reject) => {
    let remaining = attempts;

    function tryRequest() {
      const request = http.get(url, (response) => {
        response.resume();
        resolve();
      });

      request.on("error", () => {
        remaining -= 1;
        if (remaining <= 0) {
          reject(new Error("Preview server did not become ready in time."));
          return;
        }
        setTimeout(tryRequest, 150);
      });
    }

    tryRequest();
  });
}

function launchBrowser(url) {
  const opener = openCommand(url);
  const child = spawn(opener.command, opener.args, {
    detached: true,
    stdio: "ignore"
  });
  child.unref();
}

async function main() {
  try {
    await startServer({ host: HOST, port: PORT });
    await waitForServer(TARGET_URL, 20);
    launchBrowser(TARGET_URL);
    console.log(`Opened browser at ${TARGET_URL}`);
  } catch (error) {
    console.error(error.message || error);
    process.exit(1);
  }
}

main();
