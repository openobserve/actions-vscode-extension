/// <reference lib="dom" />
import * as vscode from 'vscode';
import { MemFS } from "./fileSystemProvider";
import JSZip from 'jszip';

export async function activate(context: vscode.ExtensionContext) {
	let id = context.workspaceState.get('actionId') as string;

	if (!id) {
		throw new Error("No action id found");
	}

	console.log(`action id ---------------------------------------------`, id);

	const memFs = new MemFS(id);
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('memfs', memFs, { isCaseSensitive: true }));
	let initialized = false;

	// Add file system watcher
	const fileSystemWatcher = vscode.workspace.createFileSystemWatcher('memfs:/sample-folder/**');

	// Listen for file changes
	fileSystemWatcher.onDidChange((uri) => {
		console.log('File changed:', uri.path);
		// Handle file change here
	});

	// Listen for file creation
	fileSystemWatcher.onDidCreate((uri) => {
		console.log('File created:', uri.path);
		// Handle file creation here
	});

	// Listen for file deletion
	fileSystemWatcher.onDidDelete((uri) => {
		console.log('File deleted:', uri.path);
		// Handle file deletion here
	});

	// Listen for text document saves
	vscode.workspace.onDidSaveTextDocument((document) => {
		if (document.uri.scheme === 'memfs') {
			console.log('File saved:', document.uri.path);
			console.log('File content:', document.getText());
			// Handle saved content here
		}
	});

	context.subscriptions.push(fileSystemWatcher);

	console.log("activated");

	memFs.createDirectory(vscode.Uri.parse(`memfs:/sample-folder`));


	try {
		const loaded = await memFs.loadWorkspaceFromCache();
		if (!loaded) {
			await fetch(`https://main.dev.zinclabs.dev/api/default/actions/download/${id}`, {
				method: 'GET',
				credentials: 'include',
				headers: {
					'Content-Type': 'application/zip'
				},
			}).then(async response => {
				console.log("response", await response);
				const data = await response.arrayBuffer();
				const zip = await JSZip.loadAsync(data);

				// First pass: create all directories
				for (const [filename, file] of Object.entries(zip.files)) {
					if (file.dir) {
						memFs.createDirectory(vscode.Uri.parse(`memfs:/sample-folder/${filename}`));
					} else {
						// Create parent directory for files
						const parentDir = filename.split('/').slice(0, -1).join('/');
						if (parentDir) {
							memFs.createDirectory(vscode.Uri.parse(`memfs:/sample-folder/${parentDir}`));
						}
					}
				}

				// Second pass: write all files
				for (const [filename, file] of Object.entries(zip.files)) {
					if (!file.dir) {
						const content = await file.async('uint8array');
						memFs.writeFile(
							vscode.Uri.parse(`memfs:/sample-folder/${filename}`),
							content,
							{ create: true, overwrite: true }
						);
					}
				}
			}).catch(error => {
				console.error('Error fetching alerts:', error);
				vscode.window.showErrorMessage(`Failed to process ZIP file: ${error?.message}`);
			});
		}
	} catch (error: any) {
		console.error('Error processing zip file:', error);
		vscode.window.showErrorMessage(`Failed to process ZIP file: ${error?.message}`);
	}

	// context.subscriptions.push(vscode.commands.registerCommand('memfs.init', async _ => {}));

	// vscode.commands.executeCommand('vscode.open', );

	context.subscriptions.push(vscode.commands.registerCommand('memfs.workspaceInit', _ => {
		vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse('memfs:/sample-folder'), name: "MemFS - Sample" });
	}));
}
