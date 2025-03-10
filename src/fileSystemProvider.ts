/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/


import * as vscode from 'vscode';
import JSZip from 'jszip';

interface FileRecord {
	id: string;          // Unique identifier
	hash: string;        // Content hash for change detection
	data: Uint8Array;    // Zipped content
	timestamp: number;   // Last modified time
}

export class File implements vscode.FileStat {

	type: vscode.FileType;
	ctime: number;
	mtime: number;
	size: number;

	name: string;
	data?: Uint8Array;

	constructor(name: string) {
		this.type = vscode.FileType.File;
		this.ctime = Date.now();
		this.mtime = Date.now();
		this.size = 0;
		this.name = name;
	}
}

export class Directory implements vscode.FileStat {

	type: vscode.FileType;
	ctime: number;
	mtime: number;
	size: number;

	name: string;
	entries: Map<string, File | Directory>;

	constructor(public uri: vscode.Uri, name: string) {
		this.type = vscode.FileType.Directory;
		this.ctime = Date.now();
		this.mtime = Date.now();
		this.size = 0;
		this.name = name;
		this.entries = new Map();
	}
}

export type Entry = File | Directory;

export class MemFS implements vscode.FileSystemProvider {

	id: string;
	root: Directory;

	constructor(id: string) {
		this.id = id;
		console.log("constructor create new directory", id);
		this.root = new Directory(vscode.Uri.parse('memfs:/'), '');
	}

	private dbName = 'memfsCache';
	private storeName = 'files';

	// Cache operations

	private async generateHash(content: Uint8Array): Promise<string> {
		const buffer = await crypto.subtle.digest('SHA-256', content);
		return Array.from(new Uint8Array(buffer))
			.map(b => b.toString(16).padStart(2, '0'))
			.join('');
	}

	private async zipContent(content: Uint8Array): Promise<Uint8Array> {
		const zip = JSZip();
		zip.file('content', content);
		return await zip.generateAsync({ type: 'uint8array' });
	}

	private async unzipContent(zippedData: Uint8Array): Promise<Uint8Array> {
		const zip = await JSZip.loadAsync(zippedData);
		const content = await zip.file('content')?.async('uint8array');
		return content || new Uint8Array();
	}

	async loadWorkspaceFromCache(): Promise<boolean> {
		try {
			const db = await this.openDB();
			const transaction = db.transaction(this.storeName, 'readonly');
			const store = transaction.objectStore(this.storeName);

			console.log("loadWorkspaceFromCache id", this.id);

			const record = await new Promise<FileRecord | undefined>((resolve) => {
				const request = store.get(this.id);
				request.onsuccess = () => resolve(request.result as FileRecord);
				request.onerror = () => resolve(undefined);
			});

			console.log("cached record ---------------------------------------------", record);

			if (record) {
				const zip = await JSZip.loadAsync(record.data);

				// Clear existing workspace
				// this.root = new Directory(vscode.Uri.parse('memfs:/'), '');
				// const sampleFolder = new Directory(vscode.Uri.parse('memfs:/sample-folder'), 'sample-folder');
				// this.root.entries.set('sample-folder', sampleFolder);

				// Populate workspace from zip
				for (const [path, file] of Object.entries(zip.files)) {
					// Skip the root sample-folder itself
					console.log("path", path, file);
					if (path === 'sample-folder/' || path === 'sample-folder') {
						continue;
					}

					// Remove the leading 'sample-folder/' if it exists
					const normalizedPath = path.startsWith('sample-folder/')
						? path.substring('sample-folder/'.length)
						: path;


					if (file.dir) {
						const parentPath = getDirname(normalizedPath);
						console.log("creating directory", 'uri', vscode.Uri.parse(`memfs:/sample-folder/${parentPath}`), 'normalizedPath', parentPath);
						this.createDirectory(vscode.Uri.parse(`memfs:/sample-folder/${parentPath}`));
					} else {
						// Create parent directory if needed
						console.log("creating parent directory", 'normalizedPath', normalizedPath);
						const parentPath = getDirname(normalizedPath);
						if (parentPath && parentPath !== '/') {
							console.log("creating parent directory", 'uri', vscode.Uri.parse(`memfs:/sample-folder/${parentPath}`), 'parentPath', parentPath);
							this.createDirectory(vscode.Uri.parse(`memfs:/sample-folder/${parentPath}`));
						}

						const content = await file.async('uint8array');
						console.log("writing file", 'uri', vscode.Uri.parse(`memfs:/sample-folder/${normalizedPath}`), 'normalizedPath', normalizedPath);
						this.writeFile(
							vscode.Uri.parse(`memfs:/sample-folder/${normalizedPath}`),
							content,
							{ create: true, overwrite: true }
						);
					}
				}
				return true;
			}
			return false;
		} catch (error) {
			console.error("Failed to load workspace from cache", error);
			return false;
		}
	}

	private async updateWorkspaceCache(): Promise<void> {
		try {
			const zip = new JSZip();

			// Helper function to recursively add directory contents to zip
			const addToZip = (dir: Directory, currentPath: string = '') => {
				for (const [name, entry] of dir.entries) {
					console.log("adding to zip", name, entry);

					// Skip the root sample-folder
					if (currentPath === '' && name === 'sample-folder') {
						// Instead of skipping entirely, we'll add its contents
						if (entry instanceof Directory) {
							addToZip(entry, '');  // Start with empty path for sample-folder contents
						}
						continue;
					}

					const entryPath = currentPath ? `${currentPath}/${name}` : name;
					if (entry instanceof Directory) {
						zip.folder(entryPath);
						addToZip(entry, entryPath);
					} else if (entry instanceof File && entry.data) {
						zip.file(entryPath, entry.data);
					}
				}
			};

			// Add all files to zip
			addToZip(this.root);

			// Generate zip content
			const zipContent = await zip.generateAsync({ type: 'uint8array' });
			const hash = await this.generateHash(zipContent);
			// Save to IndexedDB
			const db = await this.openDB();
			const transaction = db.transaction(this.storeName, 'readwrite');
			const store = transaction.objectStore(this.storeName);

			const record: FileRecord = {
				id: this.id,
				hash,
				data: zipContent,
				timestamp: Date.now(),
			};

			console.log("record", record.id, record?.data?.byteLength);

			await new Promise<void>((resolve, reject) => {
				const request = store.put(record);
				request.onsuccess = () => {
					console.log("success", request.result);
					resolve();
				};
				request.onerror = () => {
					console.log("error", request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.error("Failed to update workspace cache", error);
			throw error;
		}
	}


	private async updateCache(uri: vscode.Uri, content: Uint8Array): Promise<void> {
		try {
			const hash = await this.generateHash(content);
			const zippedContent = await this.zipContent(content);

			const db = await this.openDB();
			const transaction = db.transaction(this.storeName, 'readwrite');
			const store = transaction.objectStore(this.storeName);

			const record: FileRecord = {
				id: this.id,
				hash,
				data: zippedContent,
				timestamp: Date.now(),
			};
			// Remove all existing records for this path
			const pathIndex = store.index('path');
			const existingKey = await new Promise((resolve, reject) => {
				const request = pathIndex.getKey(uri.toString());
				request.onsuccess = () => {
					console.log("success existingKey", request.result);
					resolve(request.result);
				};

				request.onerror = () => {
					console.log("existingKey error", request.error);
					reject(request.error);
				};
			});

			console.log("existingKey", existingKey);

			if (existingKey !== undefined) {
				store.delete(existingKey as unknown as IDBValidKey);
			}

			await new Promise((resolve, reject) => {
				const request = store.put(record);
				request.onsuccess = () => {
					console.log("success put", request.result);
					resolve(request.result);
				};

				request.onerror = () => {
					console.log("put error", request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.log("Failed to update cache", error);
			throw error;
		}
	}

	private async getFromCache(uri: vscode.Uri): Promise<Uint8Array | undefined> {
		try {
			const db = await this.openDB();
			// console.log("db", uri, db);
			const transaction = (await db).transaction(this.storeName, 'readonly');
			const store = transaction.objectStore(this.storeName);
			const pathIndex = store.index('path');

			const record = await pathIndex.get(uri.toString());

			if (record) {
				return await this.unzipContent((record as unknown as FileRecord).data);
			}

			return undefined;
		} catch (error) {
			// console.log("Failed to get from cache", error);
			return undefined;
		}


	}


	// IndexDB operations

	private async openDB(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.dbName, 1);

			request.onerror = () => { console.log("db open error ---------------------------"); reject(new Error('Failed to open IndexedDB')); };
			request.onsuccess = () => { console.log("db opened ---------------------------"); resolve(request.result); };

			request.onupgradeneeded = (event: any) => {
				const db = (event.target as IDBOpenDBRequest).result;

				if (!db.objectStoreNames.contains(this.storeName)) {
					const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
				}
			};

		});
	}



	// --- manage file metadata

	stat(uri: vscode.Uri): vscode.FileStat {
		return this._lookup(uri, false);
	}

	readDirectory(uri: vscode.Uri): [string, vscode.FileType][] {
		const entry = this._lookupAsDirectory(uri, false);
		const result: [string, vscode.FileType][] = [];
		for (const [name, child] of entry.entries) {
			result.push([name, child.type]);
		}
		return result;
	}

	// --- manage file contents

	async readFile(uri: vscode.Uri): Promise<Uint8Array> {
		const data = this._lookupAsFile(uri, false).data;
		if (data) {
			return data;
		}
		throw vscode.FileSystemError.FileNotFound();
	}

	async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean, overwrite: boolean }): Promise<void> {
		const basename = getBasename(uri.path);
		const parent = this._lookupParentDirectory(uri);
		let entry = parent.entries.get(basename);
		if (entry instanceof Directory) {
			throw vscode.FileSystemError.FileIsADirectory(uri);
		}
		if (!entry && !options.create) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		if (entry && options.create && !options.overwrite) {
			throw vscode.FileSystemError.FileExists(uri);
		}
		if (!entry) {
			entry = new File(basename);
			parent.entries.set(basename, entry);
			this._fireSoon({ type: vscode.FileChangeType.Created, uri });
		}
		entry.mtime = Date.now();
		entry.size = content.byteLength;
		entry.data = content;


		await this.updateWorkspaceCache();

		this._fireSoon({ type: vscode.FileChangeType.Changed, uri });
	}

	// --- manage files/folders

	rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean }): void {

		if (!options.overwrite && this._lookup(newUri, true)) {
			throw vscode.FileSystemError.FileExists(newUri);
		}

		const entry = this._lookup(oldUri, false);
		const oldParent = this._lookupParentDirectory(oldUri);

		const newParent = this._lookupParentDirectory(newUri);
		const newName = getBasename(newUri.path);

		oldParent.entries.delete(entry.name);
		entry.name = newName;
		newParent.entries.set(newName, entry);

		this._fireSoon(
			{ type: vscode.FileChangeType.Deleted, uri: oldUri },
			{ type: vscode.FileChangeType.Created, uri: newUri }
		);
	}

	delete(uri: vscode.Uri): void {
		const dirname = uri.with({ path: getDirname(uri.path) });
		const basename = getBasename(uri.path);
		const parent = this._lookupAsDirectory(dirname, false);
		if (!parent.entries.has(basename)) {
			throw vscode.FileSystemError.FileNotFound(uri);
		}
		parent.entries.delete(basename);
		parent.mtime = Date.now();
		parent.size -= 1;
		this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { uri, type: vscode.FileChangeType.Deleted });
	}

	createDirectory(uri: vscode.Uri): void {
		const basename = getBasename(uri.path);
		const dirname = uri.with({ path: getDirname(uri.path) });

		const parent = this._lookupAsDirectory(dirname, false);

		const entry = new Directory(uri, basename);

		console.log("creating directory", 'uri', uri, 'dirname', dirname, 'basename', basename, 'entry', entry, 'parent', structuredClone(parent));
		parent.entries.set(entry.name, entry);
		parent.mtime = Date.now();
		parent.size += 1;
		this._fireSoon({ type: vscode.FileChangeType.Changed, uri: dirname }, { type: vscode.FileChangeType.Created, uri });

		console.log("created directory", uri, structuredClone(this.root));
	}

	// --- lookup

	private _lookup(uri: vscode.Uri, silent: false): Entry;
	private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined;
	private _lookup(uri: vscode.Uri, silent: boolean): Entry | undefined {
		const parts = uri.path.split('/');
		let entry: Entry | undefined = this.root;

		if (uri.toString().includes('sample-folder')) {console.log("lookup ----", uri, parts, entry, entry instanceof Directory, entry instanceof Directory && entry.entries);}
		for (const part of parts) {
			if (!part) {
				continue;
			}
			let child: Entry | undefined;

			if (entry instanceof Directory) {
				child = entry.entries.get(part);
			}
			if (!child) {
				if (!silent) {
					throw vscode.FileSystemError.FileNotFound(uri);
				} else {
					return undefined;
				}
			}
			entry = child;
		}
		return entry;
	}

	private _lookupAsDirectory(uri: vscode.Uri, silent: boolean): Directory {
		const entry = this._lookup(uri, silent);

		console.log("lookupAsDirectory", uri, entry);

		if (entry instanceof Directory) {
			return entry;
		}
		throw vscode.FileSystemError.FileNotADirectory(uri);
	}

	private _lookupAsFile(uri: vscode.Uri, silent: boolean): File {
		const entry = this._lookup(uri, silent);
		if (entry instanceof File) {
			return entry;
		}
		throw vscode.FileSystemError.FileIsADirectory(uri);
	}

	private _lookupParentDirectory(uri: vscode.Uri): Directory {
		const dirname = uri.with({ path: getDirname(uri.path) });
		return this._lookupAsDirectory(dirname, false);
	}

	// --- manage file events

	private _emitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
	private _bufferedEvents: vscode.FileChangeEvent[] = [];
	private _fireSoonHandle?: NodeJS.Timeout;

	readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this._emitter.event;

	watch(_resource: vscode.Uri): vscode.Disposable {
		// ignore, fires for all changes...
		return new vscode.Disposable(() => { });
	}

	private _fireSoon(...events: vscode.FileChangeEvent[]): void {
		this._bufferedEvents.push(...events);

		if (this._fireSoonHandle) {
			clearTimeout(this._fireSoonHandle);
		}

		this._fireSoonHandle = setTimeout(() => {
			this._emitter.fire(this._bufferedEvents);
			this._bufferedEvents.length = 0;
		}, 5);
	}
}

function getBasename(path: string): string {
	const parts = path.split('/');
	return parts[parts.length - 1] || parts[parts.length - 2] || '';
}

function getDirname(path: string): string {
	const parts = path.split('/');
	parts.pop();
	return parts.join('/') || '/';
}
