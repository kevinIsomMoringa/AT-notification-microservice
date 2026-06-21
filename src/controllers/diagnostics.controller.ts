import type { Request, Response, NextFunction } from 'express';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { env, providerConfig } from '../config/env';
import { metricsRegistry } from '../config/metrics';

type LogRecord = Record<string, unknown> & { timestamp?: string; recordType?: string; jobId?: string };

function safeJsonParse(line: string): LogRecord | null {
  try {
    return JSON.parse(line) as LogRecord;
  } catch {
    return null;
  }
}

function readLastLines(filePath: string, maxLines: number): string[] {
  try {
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    return lines.slice(Math.max(0, lines.length - maxLines));
  } catch {
    return [];
  }
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function requireDiagnosticsEnabled(req: Request, res: Response): boolean {
  if (env.DIAGNOSTICS_ENABLED) {
    return true;
  }

  // In non-prod, allow diagnostics by default unless explicitly disabled.
  if (env.NODE_ENV !== 'production') {
    return true;
  }

  res.status(404).json({ success: false, error: 'Not found' });
  return false;
}

export async function diagnosticsDashboard(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireDiagnosticsEnabled(req, res)) {
      return;
    }

    const storePath = resolve(process.cwd(), env.NOTIFICATION_STORE_PATH);
    const lastRecords = readLastLines(storePath, 80)
      .map(safeJsonParse)
      .filter((r): r is LogRecord => Boolean(r));

    const metricsText = await metricsRegistry.metrics();

    // Keep this intentionally non-sensitive.
    const viewModel = {
      nodeEnv: env.NODE_ENV,
      port: env.PORT,
      rateLimit: {
        windowMs: env.RATE_LIMIT_WINDOW_MS,
        max: env.RATE_LIMIT_MAX,
      },
      storePath: env.NOTIFICATION_STORE_PATH,
      providers: {
        smsConfigured: providerConfig.hasSmsProvider,
        emailConfigured: providerConfig.hasEmailProvider,
        whatsappConfigured: providerConfig.hasWhatsappProvider,
      },
      corsOrigins: env.CORS_ORIGINS,
      lastRecords,
      metricsText,
      now: new Date().toISOString(),
    };

    const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Diagnostics · Notification Microservice</title>
    <style>
      :root {
        --bg: #0b1220;
        --panel: rgba(255, 255, 255, 0.06);
        --panel2: rgba(255, 255, 255, 0.08);
        --text: rgba(255, 255, 255, 0.92);
        --muted: rgba(255, 255, 255, 0.64);
        --border: rgba(255, 255, 255, 0.10);
        --good: #2dd4bf;
        --bad: #fb7185;
        --warn: #fbbf24;
        --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        --sans: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, "Noto Sans", "Liberation Sans", sans-serif;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: var(--sans);
        background: radial-gradient(1200px 600px at 15% 10%, rgba(45, 212, 191, 0.10), transparent 60%),
                    radial-gradient(900px 500px at 90% 20%, rgba(59, 130, 246, 0.12), transparent 55%),
                    radial-gradient(700px 500px at 70% 90%, rgba(251, 113, 133, 0.10), transparent 60%),
                    var(--bg);
        color: var(--text);
      }

      .wrap { max-width: 1100px; margin: 0 auto; padding: 24px; }
      header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
      h1 { font-size: 18px; margin: 0; letter-spacing: 0.3px; }
      .sub { margin-top: 6px; color: var(--muted); font-size: 12px; }
      .pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--border); background: var(--panel); border-radius: 999px; font-size: 12px; color: var(--muted); }
      .dot { width: 8px; height: 8px; border-radius: 999px; background: var(--warn); }
      .dot.good { background: var(--good); }
      .dot.bad { background: var(--bad); }

      .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
      @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }

      .card {
        border: 1px solid var(--border);
        background: linear-gradient(180deg, var(--panel2), var(--panel));
        border-radius: 14px;
        padding: 14px;
        overflow: hidden;
        box-shadow: 0 12px 28px rgba(0,0,0,0.25);
      }
      .card h2 { font-size: 13px; margin: 0 0 10px 0; color: rgba(255,255,255,0.88); font-weight: 600; letter-spacing: 0.2px; }
      .kv { display: grid; grid-template-columns: 170px 1fr; gap: 8px 10px; font-size: 12px; }
      .k { color: var(--muted); }
      .v { font-family: var(--mono); color: rgba(255,255,255,0.86); word-break: break-word; }

      .row { display: flex; flex-wrap: wrap; gap: 10px; }
      .tag { border: 1px solid var(--border); background: rgba(255,255,255,0.06); border-radius: 999px; padding: 6px 10px; font-size: 12px; color: rgba(255,255,255,0.86); }
      .tag.good { border-color: rgba(45,212,191,0.35); background: rgba(45,212,191,0.08); }
      .tag.bad { border-color: rgba(251,113,133,0.35); background: rgba(251,113,133,0.08); }

      pre {
        margin: 0;
        padding: 12px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: rgba(0,0,0,0.28);
        overflow: auto;
        font-family: var(--mono);
        font-size: 11px;
        line-height: 1.45;
        color: rgba(255,255,255,0.88);
      }
      .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin: 10px 0 12px; }
      .btn {
        cursor: pointer;
        padding: 8px 10px;
        border-radius: 12px;
        border: 1px solid var(--border);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.86);
        font-size: 12px;
      }
      .btn:hover { background: rgba(255,255,255,0.10); }
      .hint { color: var(--muted); font-size: 12px; }
      a { color: rgba(147, 197, 253, 0.95); text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <header>
        <div>
          <h1>Diagnostics</h1>
          <div class="sub">Last updated: ${escapeHtml(viewModel.now)} · Store: <span class="v">${escapeHtml(viewModel.storePath)}</span></div>
        </div>
        <div class="pill">
          <span id="statusDot" class="dot good"></span>
          <span>Service</span>
          <span class="v">notification-microservice</span>
        </div>
      </header>

      <div class="grid">
        <section class="card">
          <h2>Runtime</h2>
          <div class="kv">
            <div class="k">NODE_ENV</div><div class="v">${escapeHtml(viewModel.nodeEnv)}</div>
            <div class="k">PORT</div><div class="v">${escapeHtml(String(viewModel.port))}</div>
            <div class="k">Rate limit</div><div class="v">${escapeHtml(`${viewModel.rateLimit.max} / ${viewModel.rateLimit.windowMs}ms`)}</div>
            <div class="k">CORS origins</div><div class="v">${escapeHtml(viewModel.corsOrigins.length ? viewModel.corsOrigins.join(', ') : '(default)')}</div>
          </div>
          <div class="toolbar">
            <div class="hint">Quick links: <a href="/health" target="_blank">/health</a> · <a href="/ready" target="_blank">/ready</a> · <a href="/metrics" target="_blank">/metrics</a></div>
            <button class="btn" onclick="location.reload()">Refresh</button>
          </div>
        </section>

        <section class="card">
          <h2>Providers configured</h2>
          <div class="row">
            <span class="tag ${viewModel.providers.smsConfigured ? 'good' : 'bad'}">SMS: ${viewModel.providers.smsConfigured ? 'configured' : 'missing'}</span>
            <span class="tag ${viewModel.providers.emailConfigured ? 'good' : 'bad'}">Email: ${viewModel.providers.emailConfigured ? 'configured' : 'missing'}</span>
            <span class="tag ${viewModel.providers.whatsappConfigured ? 'good' : 'bad'}">WhatsApp: ${viewModel.providers.whatsappConfigured ? 'configured' : 'missing'}</span>
          </div>
          <div class="sub" style="margin-top:10px">
            This view never shows secrets. It only indicates whether required env vars are present.
          </div>
        </section>

        <section class="card" style="grid-column: 1 / -1;">
          <h2>Recent notification log (last ${escapeHtml(String(viewModel.lastRecords.length))} records)</h2>
          <div class="toolbar">
            <div class="hint">JSON API: <a href="/diagnostics/log?limit=200" target="_blank">/diagnostics/log</a></div>
            <div class="row">
              <button class="btn" onclick="copyText('logPre')">Copy</button>
              <button class="btn" onclick="toggleWrap()">Wrap</button>
            </div>
          </div>
          <pre id="logPre">${escapeHtml(JSON.stringify(viewModel.lastRecords, null, 2))}</pre>
        </section>

        <section class="card" style="grid-column: 1 / -1;">
          <h2>Metrics (snapshot)</h2>
          <div class="toolbar">
            <div class="hint">Rendered as text for speed; scrape via <a href="/metrics" target="_blank">/metrics</a>.</div>
            <button class="btn" onclick="copyText('metricsPre')">Copy</button>
          </div>
          <pre id="metricsPre">${escapeHtml(viewModel.metricsText)}</pre>
        </section>
      </div>
    </div>
    <script>
      function copyText(id) {
        const el = document.getElementById(id);
        if (!el) return;
        navigator.clipboard.writeText(el.innerText);
      }
      function toggleWrap() {
        const el = document.getElementById('logPre');
        if (!el) return;
        el.style.whiteSpace = el.style.whiteSpace === 'pre-wrap' ? 'pre' : 'pre-wrap';
      }
    </script>
  </body>
</html>`;

    res.status(200).type('html').send(html);
  } catch (error) {
    next(error);
  }
}

export function diagnosticsLogJson(req: Request, res: Response, next: NextFunction) {
  try {
    if (!requireDiagnosticsEnabled(req, res)) {
      return;
    }

    const limitRaw = req.query.limit;
    const limit = Math.min(
      500,
      Math.max(1, typeof limitRaw === 'string' ? Number(limitRaw) : 200)
    );

    const storePath = resolve(process.cwd(), env.NOTIFICATION_STORE_PATH);
    const records = readLastLines(storePath, limit)
      .map(safeJsonParse)
      .filter((r): r is LogRecord => Boolean(r));

    res.json({
      success: true,
      count: records.length,
      storePath: env.NOTIFICATION_STORE_PATH,
      records,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

