import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const calcDir = path.resolve(__dirname, "../../services/calculator");
const isWin = process.platform === "win32";
const python = process.env.SAGESPAN_CALC_PYTHON ?? (isWin ? path.join(calcDir, ".venv", "Scripts", "python.exe") : path.join(calcDir, ".venv", "bin", "python"));
// Optional: point at an already-installed Chrome/Chromium when Playwright's own download is unavailable (offline CI runners).
const executablePath = process.env.SAGESPAN_E2E_CHROME_PATH;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...(executablePath ? { launchOptions: { executablePath } } : {}) } }],
  webServer: [
    {
      command: `"${python}" -m uvicorn app.main:app --host 127.0.0.1 --port 8010`,
      cwd: calcDir,
      url: "http://127.0.0.1:8010/health",
      reuseExistingServer: true,
      env: { CALC_DEMO_MODE: "1" },
      timeout: 60_000,
    },
    {
      command: "npm run dev",
      cwd: __dirname,
      url: "http://localhost:3000/",
      reuseExistingServer: true,
      env: { CALC_SERVICE_URL: "http://127.0.0.1:8010", CALC_SERVICE_TOKEN: "demo-local-token", SAGESPAN_DEMO_MODE: "1", SAGESPAN_DEMO_STATE_PATH: "e2e-state.json" },
      timeout: 180_000,
    },
  ],
});
