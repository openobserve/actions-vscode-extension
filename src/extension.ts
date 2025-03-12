/// <reference lib="dom" />
import * as vscode from 'vscode';
import { MemFS } from "./fileSystemProvider";
import JSZip from 'jszip';

export async function activate(context: vscode.ExtensionContext) {
	console.log("Activating Extension...");

	let id = context.workspaceState.get('actionId') as string;

	if (!id) {
		console.error("No action ID found");
		return;
	}

	let folderName = id; // Dynamic folder name

	// Register the memfs provider early
	const memFs = new MemFS(id, folderName);
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('memfs', memFs, { isCaseSensitive: true }));

	// Ensure workspace folder is created
	memFs.createDirectory(vscode.Uri.parse(`memfs:/${folderName}`));

	// Load existing files if present
	const loaded = await memFs.loadWorkspaceFromCache();
	if (!loaded) {
		try {
			await loadFilesFromApi(id, memFs, folderName);
		} catch (error) {
			console.error('Error loading files:', error);
		}
	}


	context.subscriptions.push(vscode.commands.registerCommand('openobserve.action.deploy', async () => {
		// Get the zip file from the memfs
		const zipBlob = new Blob([await memFs.getZipFile()], { type: 'application/zip' });
		const formData = new FormData();
		formData.append('file', zipBlob, 'Archive.zip');

		// Upload the zip file to the API
		vscode.window.showInformationMessage('Uploading action...!');
		// const response = await fetch('https://main.dev.zinclabs.dev/api/default/actions/upload', {
		// 	method: 'POST',
		// 	body: formData,
		// });
	}));
}

// Function to fetch and load files into memfs
async function loadFilesFromApi(id: string, memFs: MemFS, folderName: string) {
	const response = await fetch(`https://main.dev.zinclabs.dev/api/default/actions/download/${id}`, {
		method: 'GET',
		credentials: 'include',
		headers: {
			'Content-Type': 'application/zip'
		},
	});

	const data = await response.arrayBuffer();
	const zip = await JSZip.loadAsync(data);

	// Process and create files in memfs
	for (const [filename, file] of Object.entries(zip.files)) {
		const fileUri = vscode.Uri.parse(`memfs:/${folderName}/${filename}`);
		if (file.dir) {
			memFs.createDirectory(fileUri);
		} else {
			const content = await file.async('uint8array');
			memFs.writeFile(fileUri, content, { create: true, overwrite: true });
		}
	}
}