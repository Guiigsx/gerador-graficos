const http = require("http");
const fs = require("fs");
const path = require("path");

const port = Number(process.env.PORT || 4173);
const publicDir = path.join(__dirname, "dist");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

const server = http.createServer((request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
  const relativePath = requestPath === "/" ? "index.html" : requestPath.replace(/^\/+/, "");
  const candidate = path.resolve(publicDir, relativePath);

  if (!candidate.startsWith(publicDir)) {
    response.writeHead(403).end("Acesso negado");
    return;
  }

  fs.stat(candidate, (statError, stat) => {
    const filePath = !statError && stat.isFile() ? candidate : path.join(publicDir, "index.html");
    fs.readFile(filePath, (readError, content) => {
      if (readError) {
        response.writeHead(404).end("Pagina nao encontrada");
        return;
      }
      response.writeHead(200, {
        "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store"
      });
      response.end(content);
    });
  });
});

server.listen(port, () => {
  console.log(`Gerador de graficos em http://localhost:${port}`);
});
