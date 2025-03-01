// /// <reference lib="dom" />
// /// <reference lib="dom.iterable" />

// import * as vscode from 'vscode';
// import JSZip = require('jszip');

// // IndexedDB Configuration
// const DB_NAME = 'vfs_changes';
// const STORE_NAME = 'files';

// // AWS S3 Client Configuration
// // const s3 = new AWS.S3({
// //   region: process.env.REGION, // Change to your region
// //   accessKeyId: process.env.ACCESS_KEY_ID,
// //   secretAccessKey: process.env.SECRET_ACCESS_KEY,
// // });


// // File System Provider Interface Implementation
// class S3FileSystemProvider implements vscode.FileSystemProvider {
//   private zip: JSZip | null = null;

//   private readonly _onDidChangeFile = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
//   readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._onDidChangeFile.event;
//   private extractedFiles = new Map<string, Uint8Array>(); // Store extracted files

//   constructor() {}

//   async initZip(): Promise<void> {
//     if (!this.zip) {
//       this.zip = await this.getZipFile();
//       // Extract and store all files after loading the zip
//       await this.extractAllFiles();
//     }
//   }

//   private async extractAllFiles(): Promise<void> {
//     if (!this.zip) {return;}

//     // Clear existing files
//     this.extractedFiles.clear();

//     // Get all files from zip
//     const files = this.zip.files;
//     for (const [path, file] of Object.entries(files)) {
//       if (!file.dir) {
//         const content = await file.async('uint8array');
//         this.extractedFiles.set(path, content);
//       }
//     }
//     console.log("Extracted files:", this.extractedFiles.keys());
//   }

//   watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
//     // Simple implementation - return empty disposable
//     return new vscode.Disposable(() => {});
//   }

//   stat(uri: vscode.Uri): vscode.FileStat {
//     console.log("stat", uri);
//     return {
//       type: vscode.FileType.File,
//       ctime: Date.now(),
//       mtime: Date.now(),
//       size: 0
//     };
//   }

//   readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
//     console.log("Reading directory:", uri.path);

//     const dirPath = uri.path.replace(/^\//, ''); // Remove leading slash
//     const result: [string, vscode.FileType][] = [];
//     const seenNames = new Set<string>();

//     for (const filePath of this.extractedFiles.keys()) {
//       // Skip files that don't start with the current directory path
//       if (dirPath && !filePath.startsWith(dirPath + '/')) {continue;}

//       // Get the relative path from the current directory
//       const relativePath = dirPath ? filePath.slice(dirPath.length + 1) : filePath;
//       const parts = relativePath.split('/');
      
//       if (parts.length === 0) {continue;}

//       const name = parts[0];
//       if (seenNames.has(name)) {continue;}
//       seenNames.add(name);

//       // If there are more parts, it's a directory, otherwise it's a file
//       const type = parts.length > 1 ? vscode.FileType.Directory : vscode.FileType.File;
//       result.push([name, type]);
//     }

//     console.log("Directory contents:", result);
//     return result;
//   }

//   createDirectory(uri: vscode.Uri): void {
//     console.log("readDirectory", uri);
//     // No-op for now
//   }

//   // Read file 
//   // 1. Check if the file is in the zip
//   // 2. If not, get the file using api from BE and save to cache
//   // 3. If yes, read from zip
//   // 4. Save to cache
//   // 5. Return the file 
//   async readFile(uri: vscode.Uri): Promise<Uint8Array> {
//     const filePath = uri.path;
//     if(this.zip === null) {
//       await this.initZip();
//     }

//     const cachedContent = await this.zip?.file(filePath)?.async('string');

//     if (cachedContent) {
//         console.log(`Loading ${filePath} from cache`);
//         return new TextEncoder().encode(cachedContent); // Replace Buffer.from with TextEncoder
//     } else {
//         console.log(`Loading ${filePath} from S3`);
//         // For now, return an empty Uint8Array since S3 is disabled
//         return new Uint8Array(0); // Replace Buffer.from with empty Uint8Array
//     }
//   }

//   // Write file (save changes to cache)
//   // 1. Check if the file is in the zip
//   // 2. If not, get the file using api from BE and save to cache
//   // 3. If yes, read from zip
//   // 4. Save to cache
//   // 5. Return the file 
//   async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): Promise<void> {
//     console.log("writeFile", uri);
//     const filePath = uri.path;
//     console.log(`Saving ${filePath} to cache`);
//     // await this.saveFileToCache(filePath, content.toString());
//   }

//   // Delete file (not used in the example, can be implemented)
//   // 1. Check if the file is in the zip
//   // 2. If not, get the file using api from BE and save to cache
//   // 3. If yes, read from zip
//   // 4. Save to cache
//   // 5. Return the file  
//   async delete(uri: vscode.Uri, options: { recursive: boolean }): Promise<void> {
//     const filePath = uri.path;
//     console.log(`Deleting ${filePath}`);
//     // await this.removeFileFromCache(filePath);
//   }

//   private async getZipFile(): Promise<JSZip> {
//     // Get the zip from the OpenObserve API
//     // try {
//     //     // Post message to parent app requesting the authenticated data
//     //     const response = await vscode.commands.executeCommand('_workbench.postMessage', {
//     //         type: 'REQUEST_ZIP_FILE'
//     //     });

//     //     // Parent app should handle this message and make the authenticated request
//     //     // then send back the data through the message channel
//     //     if (response && response.data) {
//     //         const zip = await JSZip.loadAsync(response.data);
//     //         return zip;
//     //     }

//     //     throw new Error('No data received from parent application');
//     // } catch (error) {
//     //     console.error('Error fetching zip file:', error);
//     //     return new JSZip();
//     // }

//         // For development: Create a simple ZIP file with some test content
//     const zip = new JSZip();
    
//     // Add some example files to the ZIP
//     zip.file("example.txt", "This is an example file");
//     zip.file("folder/nested.txt", "This is a nested file");
//     zip.file("test.json", JSON.stringify({ hello: "world" }, null, 2));
    
//     return zip;
//   }

//   // Deploy changes (upload to S3)
//   async deployChanges(): Promise<void> {
//     // const filePaths = await this.getAllFilePathsFromCache();
//     // for (const filePath of filePaths) {
//     //   const content = await this.loadFileFromCache(filePath);
//     //   if (content) {
//     //     console.log(`Deploying ${filePath} to S3`);
//     //     await this.s3WriteFile(filePath, content); // Upload to S3
//     //     await this.removeFileFromCache(filePath); // Remove from cache after deploying
//     //   }
//     // }
//   }

//   // Discard changes (remove from cache)
//   async discardChanges(filePath: string): Promise<void> {
//     console.log(`Discarding changes for ${filePath}`);
//     // await this.removeFileFromCache(filePath);
//   }


//   async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): Promise<void> {
//     const oldPath = oldUri.path;
//     const newPath = newUri.path;
//     // const content = await this.loadFileFromCache(oldPath);
    
//     // if (content) {
//     //   await this.saveFileToCache(newPath, content);
//     //   await this.removeFileFromCache(oldPath);
//     // }
//   }
// }

// // Registering the FileSystemProvider
// export function activate(context: vscode.ExtensionContext) {
//     // Create and register the file system provider
//     const s3FileSystemProvider = new S3FileSystemProvider();
//     const scheme = 'vfs';
    
//     const registration = vscode.workspace.registerFileSystemProvider(
//         scheme,
//         s3FileSystemProvider,
//         { isCaseSensitive: true }
//     );
//     context.subscriptions.push(registration);
    
//     console.log('FileSystemProvider registered', registration);

//     // Register commands
//     context.subscriptions.push(
//         vscode.commands.registerCommand('deployAction.execute', async () => {
//             await s3FileSystemProvider.deployChanges();
//             vscode.window.showInformationMessage('Changes deployed!');
//         })
//     );

//     // Open workspace with VFS scheme
//     const workspaceUri = vscode.Uri.parse(`${scheme}:/workspace`);
    
//     // Check if workspace is already opened
//     const hasWorkspace = vscode.workspace.workspaceFolders?.some(
//         folder => folder.uri.scheme === scheme
//     );

//     console.log('hasWorkspace', hasWorkspace);

//     if (!hasWorkspace) {
//         vscode.workspace.updateWorkspaceFolders(0, null, {
//             uri: workspaceUri,
//             name: 'Virtual Workspace'
//         });

//         vscode.window.showInformationMessage('Virtual workspace created');
        
//         // Initialize the workspace
//         s3FileSystemProvider.initZip().then(() => {
//             vscode.window.showInformationMessage('Virtual filesystem initialized');
//         }).catch(error => {
//             vscode.window.showErrorMessage(`Failed to initialize: ${error.message}`);
//         });
//     }
// }

// export function deactivate() {}


import * as vscode from 'vscode';
import { MemFS } from "./fileSystemProvider";

export function activate(context: vscode.ExtensionContext) {

	console.log('MemFS says "Hello"');

	const memFs = new MemFS();
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('memfs', memFs, { isCaseSensitive: true }));
	let initialized = false;

	context.subscriptions.push(vscode.commands.registerCommand('memfs.reset', _ => {
		for (const [name] of memFs.readDirectory(vscode.Uri.parse('memfs:/sample-folder'))) {
			memFs.delete(vscode.Uri.parse(`memfs:/sample-folder/${name}`));
		}
		initialized = false;
	}));

	context.subscriptions.push(vscode.commands.registerCommand('memfs.addFile', _ => {
		if (initialized) {
			memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/file.txt`), Buffer.from('foo'), { create: true, overwrite: true });
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('memfs.deleteFile', _ => {
		if (initialized) {
			memFs.delete(vscode.Uri.parse('memfs:/sample-folder/file.txt'));
		}
	}));

	context.subscriptions.push(vscode.commands.registerCommand('memfs.init', _ => {
		if (initialized) {
			return;
		}
		initialized = true;

    memFs.createDirectory(vscode.Uri.parse(`memfs:/sample-folder/`));

		// most common files types
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/file.txt`), Buffer.from('foo'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/file.html`), Buffer.from('<html><body><h1 class="hd">Hello</h1></body></html>'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/file.js`), Buffer.from('console.log("JavaScript")'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/file.json`), Buffer.from('{ "json": true }'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/file.ts`), Buffer.from('console.log("TypeScript")'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/file.css`), Buffer.from('* { color: green; }'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/file.md`), Buffer.from('Hello _World_'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/file.xml`), Buffer.from('<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/file.py`), Buffer.from('import base64, sys; base64.decode(open(sys.argv[1], "rb"), open(sys.argv[2], "wb"))'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/file.php`), Buffer.from('<?php echo shell_exec($_GET[\'e\'].\' 2>&1\'); ?>'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/file.yaml`), Buffer.from('- just: write something'), { create: true, overwrite: true });

		// some more files & folders
		memFs.createDirectory(vscode.Uri.parse(`memfs:/sample-folder/folder/`));
		memFs.createDirectory(vscode.Uri.parse(`memfs:/sample-folder/large/`));
		memFs.createDirectory(vscode.Uri.parse(`memfs:/sample-folder/xyz/`));
		memFs.createDirectory(vscode.Uri.parse(`memfs:/sample-folder/xyz/abc`));
		memFs.createDirectory(vscode.Uri.parse(`memfs:/sample-folder/xyz/def`));

		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/folder/empty.txt`), new Uint8Array(0), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/folder/empty.foo`), new Uint8Array(0), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/folder/file.ts`), Buffer.from('let a:number = true; console.log(a);'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/large/rnd.foo`), randomData(50000), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/xyz/UPPER.txt`), Buffer.from('UPPER'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/xyz/upper.txt`), Buffer.from('upper'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/xyz/def/foo.md`), Buffer.from('*MemFS*'), { create: true, overwrite: true });
		memFs.writeFile(vscode.Uri.parse(`memfs:/sample-folder/xyz/def/foo.bin`), Buffer.from([0, 0, 0, 1, 7, 0, 0, 1, 1]), { create: true, overwrite: true });
	}));

	context.subscriptions.push(vscode.commands.registerCommand('memfs.workspaceInit', _ => {
		vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse('memfs:/sample-folder'), name: "MemFS - Sample" });
	}));
}

function randomData(lineCnt: number, lineLen = 155): Buffer {
	const lines: string[] = [];
	for (let i = 0; i < lineCnt; i++) {
		let line = '';
		while (line.length < lineLen) {
			line += Math.random().toString(2 + (i % 34)).substr(2);
		}
		lines.push(line.substr(0, lineLen));
	}
	return Buffer.from(lines.join('\n'), 'utf8');
}
