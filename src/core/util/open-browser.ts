import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/** Open a local file in the default browser (file:// URL). */
export async function openInBrowser(filePath: string): Promise<void> {
  const url = `file://${filePath}`;
  const platform = process.platform;
  try {
    if (platform === "darwin") {
      await execAsync(`open "${filePath}"`);
    } else if (platform === "win32") {
      await execAsync(`start "" "${filePath}"`, { shell: "cmd.exe" });
    } else {
      await execAsync(`xdg-open "${filePath}"`);
    }
    console.log(`Opened ${url}`);
  } catch (e) {
    console.warn(
      `Could not open browser automatically: ${e instanceof Error ? e.message : e}`,
    );
  }
}
