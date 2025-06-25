import { SetupOptions } from '../types';

export abstract class BaseAction {
  abstract name: string;
  abstract description: string;

  abstract canExecute(projectPath: string): Promise<boolean>;
  abstract execute(projectPath: string, options: SetupOptions): Promise<boolean>;
  abstract rollback(projectPath: string): Promise<boolean>;

  protected async runCommand(command: string, cwd: string): Promise<{ success: boolean; output: string }> {
    const { spawn } = await import('child_process');
    
    return new Promise((resolve) => {
      const [cmd, ...args] = command.split(' ');
      const child = spawn(cmd, args, { 
        cwd, 
        stdio: 'pipe',
        shell: true 
      });
      
      let output = '';
      let errorOutput = '';

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        resolve({
          success: code === 0,
          output: output + errorOutput
        });
      });
    });
  }

  protected async fileExists(filePath: string): Promise<boolean> {
    const fs = await import('fs-extra');
    return fs.pathExists(filePath);
  }

  protected async readJsonFile(filePath: string): Promise<any> {
    const fs = await import('fs-extra');
    try {
      return await fs.readJson(filePath);
    } catch {
      return null;
    }
  }

  protected async writeJsonFile(filePath: string, data: any): Promise<void> {
    const fs = await import('fs-extra');
    await fs.writeJson(filePath, data, { spaces: 2 });
  }

  protected async createBackup(filePath: string): Promise<string> {
    const fs = await import('fs-extra');
    const backupPath = `${filePath}.wau-backup-${Date.now()}`;
    
    if (await fs.pathExists(filePath)) {
      await fs.copy(filePath, backupPath);
    }
    
    return backupPath;
  }
}