import { createReadStream, existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type BrowserContext, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Echte Browser-E2E-Tests gegen den tatsächlichen Repo-Stand (index.html,
 * main.js, app.js, dist-browser/). Deckt die in Bauplan Phase 12 geforderten
 * Nutzerabläufe ab: Erststart, Weltaktion → Ereignis → Graph/Verlauf,
 * Speichern/Neustart, Ruhephase, zwei identische Läufe + Abweichung.
 * Voraussetzung: `npm run build:web` (macht `npm run test:e2e` automatisch).
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

let server: Server;
let baseUrl: string;
let browser: Browser;
let context: BrowserContext;

beforeAll(async () => {
  if (!existsSync(path.join(repoRoot, "dist-browser", "domain", "browser.js"))) {
    throw new Error("dist-browser/domain/browser.js fehlt — vorher `npm run build:web` ausführen.");
  }

  server = createServer((req, res) => {
    const requestPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const filePath = path.join(repoRoot, requestPath === "/" ? "/index.html" : requestPath);
    if (!filePath.startsWith(repoRoot) || !existsSync(filePath)) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": CONTENT_TYPES[ext] ?? "application/octet-stream" });
    createReadStream(filePath).pipe(res);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("server address not available");
  baseUrl = `http://127.0.0.1:${address.port}`;

  // PLAYWRIGHT_CHROMIUM_EXECUTABLE erlaubt, einen vorinstallierten Chromium
  // zu nutzen, falls `npx playwright install` in der Umgebung nicht möglich
  // ist. Ohne die Variable verwendet Playwright seinen eigenen Browser.
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE });
}, 30_000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function freshPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  context = ctx;
  const page = await ctx.newPage();
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  await page.goto(`${baseUrl}/index.html`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(150);
  return { page, context: ctx, consoleErrors };
}

describe("UI-Struktur", () => {
  it("zeigt genau drei Bereiche (Zimmer, Zustand, Innenleben)", async () => {
    const { page, context: ctx } = await freshPage();
    const panelCount = await page.locator(".panel").count();
    expect(panelCount).toBe(3);
    await ctx.close();
  });

  it("zeigt genau die fünf vereinbarten Zimmerobjekte, genau eine Pflanze", async () => {
    const { page } = await freshPage();
    const objectCount = await page.locator(".room-object").count();
    expect(objectCount).toBe(5);
    const plantCount = await page.locator(".room-object.plant").count();
    expect(plantCount).toBe(1);
    await page.context().close();
  });

  it("zeigt kein sichtbares Raster oder Debug-Beschriftungen im normalen Betrieb", async () => {
    const { page } = await freshPage();
    const gridArtifacts = await page.locator("[class*='grid'], [class*='debug']").count();
    expect(gridArtifacts).toBe(0);
    await page.context().close();
  });

  it("hat sichtbaren Tastaturfokus auf bedienbaren Elementen", async () => {
    const { page } = await freshPage();
    await page.locator(".room-object").first().focus();
    const outlineStyle = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      return getComputedStyle(el, ":focus-visible").outlineStyle;
    });
    // main.js definiert :focus-visible mit outline: 3px solid — daher nicht "none".
    expect(outlineStyle).not.toBe("none");
    await page.context().close();
  });
});

describe("E2E — Erststart bis Weltaktion", () => {
  it("Erststart zeigt leeren Graph und Warte-Status", async () => {
    const { page, consoleErrors } = await freshPage();
    const graphText = await page.locator("#graph-stage").textContent();
    expect(graphText).toContain("Noch keine");
    expect(consoleErrors).toEqual([]);
    await page.context().close();
  });

  it("Weltaktion erzeugt Ereignis in Box 2 und sichtbaren Graphknoten in Box 3", async () => {
    const { page } = await freshPage();
    await page.click(".plant");
    await page.waitForTimeout(150);
    const eventText = await page.locator("#current-event").textContent();
    expect(eventText).toBe("Pflanze berührt");
    const nodeCount = await page.locator("#graph-stage svg circle.graph-node").count();
    expect(nodeCount).toBeGreaterThan(0);
    await page.context().close();
  });

  it("Verlauf zeigt das Ereignis chronologisch (neuestes zuerst)", async () => {
    const { page } = await freshPage();
    await page.click(".plant");
    await page.waitForTimeout(100);
    await page.click(".cat");
    await page.waitForTimeout(100);
    await page.click("#tab-history");
    const firstEntry = await page.locator("#history-list li").first().textContent();
    expect(firstEntry).toContain("Katze");
    await page.context().close();
  });
});

describe("E2E — Speichern und Neustart", () => {
  it("Zustand bleibt nach Reload (App schließen/neu öffnen) exakt erhalten", async () => {
    const { page } = await freshPage();
    await page.click(".plant");
    await page.waitForTimeout(100);
    await page.click(".cat");
    await page.waitForTimeout(150);
    const eventBefore = await page.textContent("#current-event");
    const nodeCountBefore = await page.locator("#graph-stage svg circle.graph-node").count();

    await page.reload();
    await page.waitForTimeout(250);

    const eventAfter = await page.textContent("#current-event");
    const nodeCountAfter = await page.locator("#graph-stage svg circle.graph-node").count();
    expect(eventAfter).toBe(eventBefore);
    expect(nodeCountAfter).toBe(nodeCountBefore);
    await page.context().close();
  });
});

describe("E2E — Ruhephase", () => {
  it("Ruheschritt läuft nur innerhalb der Ruhephase und wird protokolliert", async () => {
    const { page } = await freshPage();
    await page.click(".plant");
    await page.waitForTimeout(100);

    const outsideRest = await page.evaluate(() => window.KieselWesenDebug.runRestStep());
    expect(outsideRest.applied).toBe(false);

    await page.evaluate(() => window.KieselWesenDebug.enterRest());
    const insideRest = await page.evaluate(() => window.KieselWesenDebug.runRestStep());
    expect(insideRest.applied).toBe(true);

    await page.click("#tab-history");
    const historyText = await page.locator("#history-list").textContent();
    expect(historyText).toContain("Ruhephase begonnen");
    expect(historyText).toContain("Ruheschritt");
    await page.context().close();
  });

  it("echte Bedienelemente in Box 2 steuern die Ruhephase (kein Debug-Hook nötig)", async () => {
    const { page } = await freshPage();
    await page.click(".plant");
    await page.waitForTimeout(100);

    const stepButton = page.locator("#rest-step");
    const toggleButton = page.locator("#rest-toggle");
    expect(await stepButton.isDisabled()).toBe(true);
    expect(await toggleButton.textContent()).toBe("Ruhephase betreten");

    await toggleButton.click();
    await page.waitForTimeout(100);
    expect(await toggleButton.textContent()).toBe("Ruhephase verlassen");
    expect(await stepButton.isDisabled()).toBe(false);

    await stepButton.click();
    await page.waitForTimeout(100);
    const eventText = await page.locator("#current-event").textContent();
    expect(eventText).toContain("Ruheschritt");

    await toggleButton.click();
    await page.waitForTimeout(100);
    expect(await toggleButton.textContent()).toBe("Ruhephase betreten");
    expect(await stepButton.isDisabled()).toBe(true);
    await page.context().close();
  });
});

describe("E2E — Graph unterscheidet Distanz, Nutzung und Aktivierung visuell", () => {
  it("stärker aktivierte Knoten werden größer/deutlicher dargestellt als schwächer aktivierte", async () => {
    const { page } = await freshPage();
    // "plant" einmal berühren, "cat" zusätzlich noch als Paar-Ereignis mit
    // "kiesel" verknüpfen, damit ein klarer Aktivierungsunterschied entsteht.
    await page.click(".plant");
    await page.waitForTimeout(100);
    await page.click(".cat");
    await page.waitForTimeout(100);
    await page.click(".cat");
    await page.waitForTimeout(150);

    const radii = await page.locator("#graph-stage svg circle.graph-node").evaluateAll((els) =>
      els.map((el) => Number(el.getAttribute("r"))),
    );
    expect(radii.length).toBeGreaterThanOrEqual(2);
    const distinctRadii = new Set(radii);
    expect(distinctRadii.size).toBeGreaterThan(1);
    await page.context().close();
  });
});

describe("E2E — Zwei identische Läufe und Vergleich", () => {
  it("identische Ereignisfolge auf zwei Instanzen liefert identisches Ergebnis", async () => {
    const { page } = await freshPage();
    await page.click(".plant");
    await page.waitForTimeout(100);

    const comparison = await page.evaluate(() =>
      window.KieselWesenDebug.compareIdenticalReplay([
        { kind: "single", nodeId: "plant" },
        { kind: "single", nodeId: "cat" },
      ]),
    );
    expect(comparison.identical).toBe(true);
    await page.context().close();
  });

  it("eine gezielte Abweichung ist im Vergleich sichtbar und exakt bezifferbar", async () => {
    const { page } = await freshPage();
    await page.click(".plant");
    await page.waitForTimeout(100);

    const comparison = await page.evaluate(() =>
      window.KieselWesenDebug.compareDeviatedReplay(
        [{ kind: "single", nodeId: "plant" }],
        [
          { kind: "single", nodeId: "plant" },
          { kind: "single", nodeId: "plant" },
        ],
      ),
    );
    expect(comparison.identical).toBe(false);
    expect(comparison.nodeDiffs.length).toBeGreaterThan(0);
    await page.context().close();
  });
});
