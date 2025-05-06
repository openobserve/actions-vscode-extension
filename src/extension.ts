/// <reference lib="dom" />
import * as vscode from 'vscode';
import { MemFS } from "./fileSystemProvider";
import JSZip from 'jszip';


let API_ORIGIN = ''; 
let ORG_IDENTIFIER = '';
let HTTP_PROTOCOL = '';
export async function activate(context: vscode.ExtensionContext) {
	let id = context.workspaceState.get('actionId') as string;
	let folderName = (context.workspaceState.get('actionName') || 'Untitled') as string;


	let origin = context.workspaceState.get('origin') as string;

	try {
		origin.split('?')[1].split('&').forEach((key: any) => {
			const query = key.split('=');
				if (query[0] === 'id') {
		  		id = query[1];
			}
	
			if (query[0] === 'name') {
				folderName = query[1];
			}

			if (query[0] === 'org_identifier') {
				ORG_IDENTIFIER = query[1];
			}
	  	});

		API_ORIGIN = origin.split('/')[2];
		HTTP_PROTOCOL = origin.split(':')[0];

	} catch (error) {
		console.error("Error parsing origin:", error);
	}

	console.log( "id:" ,id, "folderName:" ,folderName, "org_identifier:" ,ORG_IDENTIFIER, "api_origin:" ,API_ORIGIN, "http_protocol:" ,HTTP_PROTOCOL);




	if (!id) {
		console.error("No action ID found");
		return;
	}

	let action;

	if (id !== 'untitled') {
		action = await getActionById(id);
	}

	if (action?.name) {
		folderName = action.name;
	}

	// Register the memfs provider early
	const memFs = new MemFS(id, folderName);
	context.subscriptions.push(vscode.workspace.registerFileSystemProvider('memfs', memFs, { isCaseSensitive: true }));

	// Ensure workspace folder is created
	memFs.createDirectory(vscode.Uri.parse(`memfs:/${folderName}`));



	// Load existing files if present
	if (id === 'untitled') {
		try {
			const fileUri = vscode.Uri.parse(`memfs:/${folderName}/main.py`);
			memFs.writeFile(fileUri, new TextEncoder().encode(''), { create: true, overwrite: true });
		} catch (error) {
			console.error('Error creating main.py:', error);
		}
	} else {
		const loaded = await memFs.loadWorkspaceFromCache();
		if (!loaded) {
			try {
				await loadFilesFromApi(id, memFs, folderName);
			} catch (error) {
				console.error('Error loading files:', error);
			}
		}
	}


	context.subscriptions.push(vscode.commands.registerCommand('openobserve.action.deploy', async () => {
		// Get the zip file from the memfs
		const zipBlob = new Blob([await memFs.getZipFile()], { type: 'application/zip' });
		const formData = new FormData();
		formData.append('file', zipBlob, 'Archive.zip');

		// Show a temporary status bar message
		const disposable = vscode.window.setStatusBarMessage('Uploading action...'); // Disappears after 2 seconds
		
		try {
			await uploadAction(id, memFs, folderName);
			// Show success message in status bar that disappears after 3 seconds
			vscode.window.setStatusBarMessage('Action uploaded successfully!', 3000);
		} catch (error) {
			// Show an error notification if something goes wrong
			vscode.window.showErrorMessage('Failed to upload action');
		} finally {
			disposable.dispose();	
		}
	}));
}

async function getActionById(id: string) {
	const response = await fetch(`${HTTP_PROTOCOL}://${API_ORIGIN}/api/${ORG_IDENTIFIER}/actions/${id}`, {
		method: 'GET',
		credentials: 'include',
	});

	const data = await response.json();
	return data;
}

// Function to fetch and load files into memfs
async function loadFilesFromApi(id: string, memFs: MemFS, folderName: string) {
	const response = await fetch(`${HTTP_PROTOCOL}://${API_ORIGIN}/api/${ORG_IDENTIFIER}/actions/download/${id}`, {
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

async function uploadAction(id: string, memFs: MemFS, folderName: string) {
	const zipBlob = new Blob([await memFs.getZipFile()], { type: 'application/zip' });
	const formData = new FormData();
	formData.append('file', zipBlob);
	formData.append('filename', (zipBlob as File).name || "");

	try {
		await fetch(`${HTTP_PROTOCOL}://${API_ORIGIN}/api/${ORG_IDENTIFIER}/actions/${id}`, {
			method: 'PUT',
			body: formData,
			credentials: 'include',
		});
	} catch (error) {
		console.error('Error uploading action:', error);
		return null;
	}
}
