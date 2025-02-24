/// <reference lib="dom" />
/// <reference lib="dom.iterable" />

import * as vscode from 'vscode';
import * as AWS from 'aws-sdk';
import * as JSZip from 'jszip';

// IndexedDB Configuration
const DB_NAME = 'vfs_changes';
const STORE_NAME = 'files';

// AWS S3 Client Configuration
const s3 = new AWS.S3({
  region: process.env.REGION, // Change to your region
  accessKeyId: process.env.ACCESS_KEY_ID,
  secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

// File System Provider Interface Implementation
class S3FileSystemProvider implements vscode.FileSystemProvider {
  private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
  readonly onDidChangeFile = this._emitter.event;

  constructor() {}

  watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
    // Simple implementation - return empty disposable
    return new vscode.Disposable(() => {});
  }

  stat(uri: vscode.Uri): vscode.FileStat {
    return {
      type: vscode.FileType.File,
      ctime: Date.now(),
      mtime: Date.now(),
      size: 0
    };
  }

  readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
    console.log("readDirectory", uri);
    return []; // Return empty directory for now
  }

  createDirectory(uri: vscode.Uri): void {
    console.log("readDirectory", uri);
    // No-op for now
  }

  async readFile(uri: vscode.Uri): Promise<Uint8Array> {
    console.log("readFile", uri);
    const filePath = uri.path;
    const cachedContent = await this.loadFileFromCache(filePath);

    if (cachedContent !== null) {
      console.log(`Loading ${filePath} from cache`);
      return Buffer.from(cachedContent, 'utf8');
    } else {
      console.log(`Loading ${filePath} from S3`);
      return this.s3ReadFile(filePath); // Read from S3
    }
  }

  // Write file (save changes to cache)
  async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): Promise<void> {
    console.log("writeFile", uri);
    const filePath = uri.path;
    console.log(`Saving ${filePath} to cache`);
    await this.saveFileToCache(filePath, content.toString());
  }

  // Delete file (not used in the example, can be implemented)
  async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
    const filePath = uri.path;
    console.log(`Deleting ${filePath}`);
    await this.removeFileFromCache(filePath);
  }

  // Deploy changes (upload to S3)
  async deployChanges(): Promise<void> {
    const filePaths = await this.getAllFilePathsFromCache();
    for (const filePath of filePaths) {
      const content = await this.loadFileFromCache(filePath);
      if (content) {
        console.log(`Deploying ${filePath} to S3`);
        await this.s3WriteFile(filePath, content); // Upload to S3
        await this.removeFileFromCache(filePath); // Remove from cache after deploying
      }
    }
  }

  // Discard changes (remove from cache)
  async discardChanges(filePath: string): Promise<void> {
    console.log(`Discarding changes for ${filePath}`);
    await this.removeFileFromCache(filePath);
  }

  // S3 read file (implement S3 read logic)
  private async s3ReadFile(filePath: string): Promise<Uint8Array> {
    console.log("s3ReadFile", filePath);
    if (filePath.includes(`/${process.env.BUCKET_NAME}/`)) {
      filePath = filePath.replace(`/${process.env.BUCKET_NAME}/`, '');
    }
    const params = { Bucket: process.env.BUCKET_NAME, Key: filePath };
    try {
      const result = await s3.getObject(params).promise();
      return Buffer.from(result.Body as string, 'utf8');
    } catch (err: any) {
      console.error(`Error reading file from S3: ${err.message}`);
      throw err;
    }
  }

  // S3 write file (implement S3 write logic)
  private async s3WriteFile(filePath: string, content: string): Promise<void> {
    const params = {
      Bucket: process.env.BUCKET_NAME,
      Key: filePath,
      Body: content,
    };
    try {
      await s3.putObject(params).promise();
      console.log(`Successfully uploaded ${filePath} to S3`);
    } catch (err: any) {
      console.error(`Error uploading file to S3: ${err.message}`);
      throw err;
    }
  }


  async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
    const oldPath = oldUri.path;
    const newPath = newUri.path;
    const content = await this.loadFileFromCache(oldPath);
    
    if (content) {
      await this.saveFileToCache(newPath, content);
      await this.removeFileFromCache(oldPath);
    }
  }

  // IndexedDB Operations
  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result);
      };
      request.onerror = () => reject(request.error);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBRequest).result;
        db.createObjectStore(STORE_NAME);
      };
    });
  }

  private async saveFileToCache(filePath: string, content: string): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(content, filePath);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = reject;
    });
  }

  private async loadFileFromCache(filePath: string): Promise<string | null> {
    const db = await this.openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const request = store.get(filePath);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  private async removeFileFromCache(filePath: string): Promise<void> {
    const db = await this.openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(filePath);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = reject;
    });
  }

  private async getAllFilePathsFromCache(): Promise<string[]> {
    const db = await this.openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    return new Promise((resolve, reject) => {
      const filePaths: string[] = [];
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          filePaths.push(cursor.key as string);
          cursor.continue();
        } else {
          resolve(filePaths);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

async function downloadAndExtractZip(bucketName: string, zipKey: string): Promise<Map<string, string>> {
  try {
    // Fetch the zip file from S3
    const params = { Bucket: bucketName, Key: zipKey };
    const data = await s3.getObject(params).promise();

    // Load the zip file
    const zip = await JSZip.loadAsync(data.Body as Buffer);

    // Extract files and store them in a Map
    const files = new Map<string, string>();
    for (const [filePath, file] of Object.entries(zip.files)) {
      if (!file.dir) {
        const content = await file.async('string');
        files.set(filePath, content);
      }
    }

    return files;
  } catch (error) {
    console.error('Error downloading or extracting zip:', error);
    throw error;
  }
}

// Registering the FileSystemProvider
export function activate(context: vscode.ExtensionContext) {

  context.subscriptions.push(
    vscode.commands.registerCommand("deployAction.execute", () => {
      vscode.window.showInformationMessage("🚀 Deploying...");
    })
  );

  const s3FileSystemProvider = new S3FileSystemProvider();

  // Register the provider for a specific scheme (e.g., 's3fs')
  vscode.window.showInformationMessage("🚀 registering vfs");

  const fileSystemProvider = vscode.workspace.registerFileSystemProvider(
    'vfs',
    s3FileSystemProvider,
    { isCaseSensitive: true }
  );

  vscode.window.showInformationMessage("🚀 registered vfs");

  context.subscriptions.push(fileSystemProvider);

  // Example of how to trigger deploy and discard changes in VS Code extension
  vscode.commands.registerCommand('deployAction.execute', async () => {
    await s3FileSystemProvider.deployChanges();
    vscode.window.showInformationMessage('Changes deployed to S3!');
  });

  // vscode.commands.registerCommand('extension.discardChanges', async () => {
  //   const filePath = vscode.window.activeTextEditor?.document.uri.path;
  //   if (filePath) {
  //     await s3FileSystemProvider.discardChanges(filePath);
  //     vscode.window.showInformationMessage(`Changes discarded for ${filePath}`);
  //   }
  // });
}

export function deactivate() {}
