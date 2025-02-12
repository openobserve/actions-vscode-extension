import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const deployProvider = new DeployProvider();


	// vscode.window.registerTreeDataProvider("deployView", deployProvider);

	// vscode.window.registerTreeDataProvider("deployViewExplorer", deployProvider);

	context.subscriptions.push(
		vscode.commands.registerCommand("openobserve.action.deploy", () => {
			vscode.window.showInformationMessage("🚀 Deploying...");
		})
	);
}

class DeployProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
		return element;
	}

	getChildren(): vscode.TreeItem[] {
		const deployButton = new vscode.TreeItem("Deploy", vscode.TreeItemCollapsibleState.None);
		deployButton.command = { command: "deployAction.execute", title: "Deploy" };
		return [deployButton];
	}
}


// export function activate(context: vscode.ExtensionContext) {

// 	const provider = new ColorsViewProvider();

// 	// context.subscriptions.push(
// 	// 	vscode.window.registerWebviewViewProvider('deployView', provider));

// 	// context.subscriptions.push(
// 	// 	vscode.window.registerWebviewViewProvider('deployViewExplorer', provider));
// }

// class ColorsViewProvider implements vscode.WebviewViewProvider {

// 	public static readonly viewType = 'deployView';

// 	private _view?: vscode.WebviewView;

// 	constructor(
// 	) { }

// 	public resolveWebviewView(
// 		webviewView: vscode.WebviewView,
// 		_context: vscode.WebviewViewResolveContext,
// 		_token: vscode.CancellationToken,
// 	) {
// 		this._view = webviewView;

// 		webviewView.webview.options = {
// 			// Allow scripts in the webview
// 			enableScripts: true,
// 		};

// 		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

// 		vscode.window.showInformationMessage('Webview created!');

// 		console.log('Webview created!', this._view);

// 		webviewView.webview.onDidReceiveMessage(data => {
// 			console.log('Received message from webview:', data);
// 			switch (data.type) {
// 				case 'colorSelected':
// 					{
// 						vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(`#${data.value}`));
// 						break;
// 					}
// 			}
// 		});
// 	}

// 	private _getHtmlForWebview(webview: vscode.Webview) {
// 		// Use a nonce to only allow a specific script to be run.
// 		const nonce = getNonce();
// 		return ``;
// 	}


// }

// function getNonce() {
// 	let text = '';
// 	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
// 	for (let i = 0; i < 32; i++) {
// 		text += possible.charAt(Math.floor(Math.random() * possible.length));
// 	}
// 	return text;
// }

