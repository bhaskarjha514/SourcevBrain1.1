import { spawn, ChildProcess } from 'child_process';
import { loadConfig } from '../utils/config.js';

export interface DevServerStatus {
  isRunning: boolean;
  url: string;
  port: number;
  process?: ChildProcess;
}

export class DevServerManager {
  private config = loadConfig();
  private serverProcess: ChildProcess | null = null;
  private status: DevServerStatus = {
    isRunning: false,
    url: this.config.devServer.url,
    port: this.config.devServer.port,
  };

  async checkServerStatus(): Promise<boolean> {
    try {
      const response = await fetch(this.status.url, {
        method: 'HEAD',
        signal: AbortSignal.timeout(2000),
      });
      this.status.isRunning = response.ok;
      return this.status.isRunning;
    } catch {
      this.status.isRunning = false;
      return false;
    }
  }

  async ensureServerRunning(): Promise<DevServerStatus> {
    const isRunning = await this.checkServerStatus();

    if (isRunning) {
      return this.status;
    }

    await this.startServer();
    await this.waitForServer();

    return this.status;
  }

  private async startServer(): Promise<void> {
    if (this.serverProcess) {
      return;
    }

    const command = this.config.devServer.startCommand;
    const [cmd, ...args] = command.split(' ');

    this.serverProcess = spawn(cmd, args, {
      stdio: 'pipe',
      shell: true,
      cwd: process.cwd(),
    });

    this.serverProcess.stdout?.on('data', (data) => {
      console.log(`[Dev Server] ${data.toString()}`);
    });

    this.serverProcess.stderr?.on('data', (data) => {
      console.error(`[Dev Server Error] ${data.toString()}`);
    });

    this.serverProcess.on('exit', (code) => {
      console.log(`[Dev Server] Process exited with code ${code}`);
      this.serverProcess = null;
      this.status.isRunning = false;
    });

    this.status.process = this.serverProcess;
  }

  private async waitForServer(maxWait: number = 60000): Promise<void> {
    const startTime = Date.now();
    const checkInterval = 2000;

    while (Date.now() - startTime < maxWait) {
      const isRunning = await this.checkServerStatus();
      if (isRunning) {
        this.status.isRunning = true;
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    throw new Error(`Dev server did not start within ${maxWait}ms`);
  }

  async stopServer(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
      this.status.isRunning = false;
    }
  }

  getStatus(): DevServerStatus {
    return { ...this.status };
  }
}

