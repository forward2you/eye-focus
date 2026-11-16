import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";

const root = new URL("../", import.meta.url);
const routes = [
  { from: "index.html", variants: ["", "index.html"], to: "bounce/index.html", label: "弹球版" },
  { from: "bounce/index.html", variants: ["bounce/", "bounce/index.html"], to: "index.html", label: "点阵版" },
];

for (const base of [
  "https://forward2you.github.io/eye-focus/",
  "http://127.0.0.1:8080/",
  "file:///tmp/eye-focus/",
]) {
  for (const route of routes) {
    test(`${route.label} navigation resolves to an explicit page under ${base}`, () => {
      const html = readFileSync(new URL(route.from, root), "utf8");
      const link = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)]
        .find(([, , text]) => text.includes(route.label));
      assert.ok(link, `Missing ${route.label} link`);
      assert.ok(statSync(new URL(route.to, root)).isFile());
      for (const from of route.variants) {
        const destination = new URL(link[1], new URL(from, base));
        assert.equal(destination.pathname, new URL(route.to, base).pathname);
        assert.equal(destination.origin, new URL(base).origin);
        assert.equal(destination.searchParams.get("v"), "__BUILD_VERSION__");
      }
    });
  }
}
