const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const publicDirectory = path.join(__dirname, "..", "public");
const origin = "https://heart-harbor.example";

async function testPublicPages() {
  const homepage = fs.readFileSync(path.join(publicDirectory, "index.html"), "utf8");
  const choices = [...homepage.matchAll(/<a class="home-choice[^"]*" href="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(choices, ["/chat?mode=listen", "/checkin", "/cards", "/mood-weather"]);

  const handlers = new Map();
  const assets = new Set();
  const deletedCaches = [];
  let currentCache;
  const cache = {
    async addAll(paths) {
      for (const url of paths) {
        const file = url === "/" ? "index.html" : url.slice(1);
        assert.ok(
          fs.existsSync(path.join(publicDirectory, file)) ||
          fs.existsSync(path.join(publicDirectory, `${file}.html`)),
          `Missing precache asset: ${url}`
        );
        assets.add(url);
      }
    },
    async match(url) {
      return assets.has(url) ? { cachedPath: url } : undefined;
    }
  };

  vm.runInNewContext(fs.readFileSync(path.join(publicDirectory, "service-worker.js"), "utf8"), {
    URL,
    self: {
      location: { origin },
      addEventListener: (event, handler) => handlers.set(event, handler),
      skipWaiting() {},
      clients: { claim() {} }
    },
    caches: {
      async open(name) {
        currentCache ||= name;
        assert.equal(name, currentCache);
        return cache;
      },
      async keys() {
        return [currentCache, "companion-hub-old", "another-app"];
      },
      async delete(name) {
        deletedCaches.push(name);
      }
    },
    fetch() {
      throw new Error("Offline");
    }
  });

  for (const event of ["install", "activate"]) {
    let work;
    handlers.get(event)({ waitUntil: (promise) => { work = promise; } });
    await work;
  }
  assert.deepEqual(deletedCaches, ["companion-hub-old"]);

  function handleFetch(url, method = "GET") {
    let response;
    handlers.get("fetch")({
      request: { url: new URL(url, origin).href, method },
      respondWith: (promise) => { response = promise; }
    });
    return response;
  }

  for (const choice of ["/", ...choices]) {
    const expectedPath = new URL(choice, origin).pathname;
    assert.deepEqual(await handleFetch(choice), { cachedPath: expectedPath });
  }
  for (const route of ["/admin", "/admin.html", "/admin-login", "/ai-config", "/api/public/bootstrap", "/missing", "https://other.example/chat"]) {
    assert.equal(handleFetch(route), undefined, route);
  }
  assert.equal(handleFetch("/checkin", "POST"), undefined);
}

module.exports = { testPublicPages };
