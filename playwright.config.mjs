// E2E-проверки сайта (tests/e2e, их пишет таск сайта) против встроенного PHP-сервера.
// Настройки заявок пустые: сервер отвечает not_configured, письма — только в файл.
import { defineConfig, devices } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.E2E_PORT || 8091);
const storageDir = process.env.E2E_STORAGE_DIR || mkdtempSync(join(tmpdir(), 'vsecheki-e2e-'));
process.env.E2E_STORAGE_DIR = storageDir;

export default defineConfig({
  testDir: join(ROOT, 'tests', 'e2e'),
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'line' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `php -S 127.0.0.1:${PORT} -t public`,
    cwd: ROOT,
    port: PORT,
    reuseExistingServer: false,
    timeout: 15_000,
    stdout: 'ignore',
    stderr: 'ignore',
    env: {
      MAIL_TRANSPORT: 'file',
      STORAGE_DIR: storageDir,
      // Даже если в окружении разработчика есть токен, запрос не уйдёт в настоящий Telegram.
      TELEGRAM_API_BASE: 'http://127.0.0.1:9',
    },
  },
});
