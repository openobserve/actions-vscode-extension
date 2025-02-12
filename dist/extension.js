/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ([
/* 0 */
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {


var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.activate = activate;
const vscode = __importStar(__webpack_require__(1));
function activate(context) {
    const deployProvider = new DeployProvider();
    // vscode.window.registerTreeDataProvider("deployView", deployProvider);
    // vscode.window.registerTreeDataProvider("deployViewExplorer", deployProvider);
    context.subscriptions.push(vscode.commands.registerCommand("openobserve.action.deploy", () => {
        vscode.window.showInformationMessage("🚀 Deploying...");
    }));
}
class DeployProvider {
    getTreeItem(element) {
        return element;
    }
    getChildren() {
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


/***/ }),
/* 1 */
/***/ ((module) => {

module.exports = require("vscode");

/***/ })
/******/ 	]);
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __webpack_require__(0);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=extension.js.map