import * as chokidar from 'chokidar';
import { EventEmitter } from 'events';
import * as path from 'path';
import debounce from 'debounce';
import { FileChange } from './types';

export class FileWatcher extends EventEmitter {
  private watcher?: chokidar.FSWatcher;
  private projectPath: string;
  private ignorePatterns: RegExp[];
  private fileChangeQueue = new Map<string, FileChange>();

  // Debounced processing to handle rapid file changes
  private processChanges = debounce(() => {
    const changes = Array.from(this.fileChangeQueue.values());
    this.fileChangeQueue.clear();

    if (changes.length > 0) {
      this.emit('batch_changes', changes);
    }
  }, 1000);

  constructor(projectPath: string) {
    super();
    this.projectPath = projectPath;
    this.ignorePatterns = [
      /(^|[\/\\])\../, // Dotfiles
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /\.next/,
      /coverage/,
      /\.log$/,
      /\.woaru/,
      /\.DS_Store/,
      /package-lock\.json$/,
      /yarn\.lock$/,
      /pnpm-lock\.yaml$/,
      // Python virtual environments
      /venv/,
      /\.venv/,
      /env/,
      /\.env/,
      /__pycache__/,
      /\.pytest_cache/,
      // Additional common directories
      /target/, // Rust
      /vendor/, // Go, PHP
      /bin/,
      /obj/,
      /out/,
      /tmp/,
      /temp/,
    ];
  }

  start(): void {
    if (this.watcher) {
      console.warn('Watcher already running');
      return;
    }

    this.watcher = chokidar.watch(this.projectPath, {
      ignored: this.ignorePatterns,
      persistent: true,
      ignoreInitial: true, // Don't process all files on startup
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
      depth: 10, // Limit directory traversal depth
      followSymlinks: false, // Don't follow symlinks
    });

    this.watcher
      .on('add', filePath => this.handleFileEvent('add', filePath))
      .on('change', filePath => this.handleFileEvent('change', filePath))
      .on('unlink', filePath => this.handleFileEvent('unlink', filePath))
      .on('error', error => this.emit('error', error))
      .on('ready', () => {
        console.log(
          '✅ Initial file scan complete. WOARU is now actively watching for changes.'
        );
        this.emit('ready');
      });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = undefined;
      this.fileChangeQueue.clear();
    }
  }

  private handleFileEvent(
    type: 'add' | 'change' | 'unlink',
    filePath: string
  ): void {
    // Only watch relevant files
    if (!this.isRelevantFile(filePath)) {
      return;
    }

    const relativePath = path.relative(this.projectPath, filePath);
    const change: FileChange = {
      type,
      path: relativePath,
      timestamp: new Date(),
    };

    // Queue the change
    this.fileChangeQueue.set(relativePath, change);

    // Emit immediate event for critical files
    if (this.isCriticalFile(filePath)) {
      this.emit('critical_file_change', change);
    }

    // Trigger debounced processing
    this.processChanges();
  }

  private isRelevantFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const relevantExtensions = [
      // JavaScript/TypeScript
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
      '.mjs',
      '.cjs',
      // Python
      '.py',
      '.pyw',
      // Rust
      '.rs',
      // Go
      '.go',
      // C#
      '.cs',
      // Java
      '.java',
      // Config files
      '.json',
      '.yaml',
      '.yml',
      '.toml',
      '.xml',
      // Other
      '.md',
      '.txt',
    ];

    return relevantExtensions.includes(ext);
  }

  private isCriticalFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const criticalFiles = [
      'package.json',
      'tsconfig.json',
      'requirements.txt',
      'Cargo.toml',
      'go.mod',
      'pom.xml',
      'build.gradle',
      '.eslintrc.json',
      '.prettierrc',
      'pyproject.toml',
      '.gitignore',
    ];

    return criticalFiles.includes(fileName);
  }

  addIgnorePattern(pattern: string): void {
    // Convert string pattern to RegExp
    const regexPattern = new RegExp(pattern.replace(/\*/g, '.*'));
    this.ignorePatterns.push(regexPattern);

    // Restart watcher with new patterns
    if (this.watcher) {
      this.stop();
      this.start();
    }
  }

  getWatchedFileCount(): number {
    if (!this.watcher) return 0;

    const watched = this.watcher.getWatched();
    let count = 0;

    Object.values(watched).forEach(files => {
      count += files.length;
    });

    return count;
  }
}
