"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const path = require("path");
const shiki_1 = require("shiki");
const openPanels = new Map();
let highlighter;
async function activate(context) {
    // Initialize the Shiki highlighter. This is an async operation.
    highlighter = await (0, shiki_1.getHighlighter)({
        themes: Object.keys(shiki_1.bundledThemes),
        langs: Object.keys(shiki_1.bundledLanguages),
    });
    const createOrShowViewer = async (editor) => {
        const document = editor.document;
        const docUri = document.uri.toString();
        if (openPanels.has(docUri)) {
            openPanels.get(docUri).reveal(vscode.ViewColumn.Beside);
            return;
        }
        const panel = vscode.window.createWebviewPanel('zeroBasedViewer', `Zero-Based: ${path.basename(document.fileName)}`, vscode.ViewColumn.Beside, {
            enableScripts: true,
            retainContextWhenHidden: true,
        });
        openPanels.set(docUri, panel);
        // The content generation is now async
        panel.webview.html = await getWebviewContent(document);
        const changeSubscription = vscode.workspace.onDidChangeTextDocument(async (event) => {
            if (event.document.uri.toString() === docUri) {
                panel.webview.html = await getWebviewContent(event.document);
            }
        });
        panel.onDidDispose(() => {
            openPanels.delete(docUri);
            changeSubscription.dispose();
        }, null, context.subscriptions);
    };
    const showCommand = vscode.commands.registerCommand('zero-based-viewer.showViewer', () => {
        if (vscode.window.activeTextEditor) {
            createOrShowViewer(vscode.window.activeTextEditor);
        }
    });
    context.subscriptions.push(showCommand);
    const autoOpenListener = vscode.window.onDidChangeActiveTextEditor((editor) => {
        const config = vscode.workspace.getConfiguration('zeroBasedViewer');
        if (config.get('autoOpen') && editor) {
            createOrShowViewer(editor);
        }
    });
    context.subscriptions.push(autoOpenListener);
    const config = vscode.workspace.getConfiguration('zeroBasedViewer');
    if (config.get('autoOpen') && vscode.window.activeTextEditor) {
        createOrShowViewer(vscode.window.activeTextEditor);
    }
    const cleanupListener = vscode.workspace.onDidCloseTextDocument((document) => {
        const docUri = document.uri.toString();
        if (openPanels.has(docUri)) {
            openPanels.get(docUri).dispose();
        }
    });
    context.subscriptions.push(cleanupListener);
}
exports.activate = activate;
function deactivate() {
    openPanels.forEach((panel) => panel.dispose());
    openPanels.clear();
}
exports.deactivate = deactivate;
async function getWebviewContent(document) {
    if (!highlighter) {
        return "Error: Syntax highlighter not available.";
    }
    const code = document.getText();
    const fileName = path.basename(document.fileName);
    const lang = document.languageId || 'plaintext';
    // Get the current VS Code theme and map it to a Shiki theme
    const theme = mapTheme(vscode.window.activeColorTheme.kind);
    // Generate the highlighted HTML using Shiki
    const highlightedCode = highlighter.codeToHtml(code, {
        lang,
        theme,
    });
    // Custom logic to split the highlighted code into lines and add zero-based numbers
    const lines = highlightedCode.split('\n');
    const linesHtml = lines.slice(1, -2).map((line, index) => `
        <div class="line">
            <span class="line-number">${index}</span>
            <span class="line-code">${line || '&nbsp;'}</span>
        </div>
    `).join('');
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Zero-Based: ${fileName}</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                }
                .shiki {
                    padding: 1em;
                    box-sizing: border-box;
                    border-radius: 4px;
                }
                .line {
                    display: flex;
                    white-space: pre;
                }
                .line-number {
                    min-width: 32px;
                    text-align: right;
                    padding-right: 1em;
                    user-select: none;
                    /* Use the line number color from the theme's JSON */
                    color: var(--shiki-color-line-number, var(--shiki-color-text));
                    opacity: 0.6;
                }
            </style>
        </head>
        <body>
            <div style="font-family: var(--vscode-editor-font-family, monospace); font-weight: bold; padding: 0.5em 1em;">${fileName}</div>
            <div class="shiki" style="background-color: var(--shiki-color-background)">
                <code>
                    ${linesHtml}
                </code>
            </div>
        </body>
        </html>
    `;
}
function mapTheme(themeKind) {
    switch (themeKind) {
        case vscode.ColorThemeKind.Dark:
        case vscode.ColorThemeKind.HighContrast:
            return 'dark-plus'; // VS Code's default dark theme
        case vscode.ColorThemeKind.Light:
        case vscode.ColorThemeKind.HighContrastLight:
            return 'light-plus'; // VS Code's default light theme
        default:
            return 'dark-plus';
    }
}
//# sourceMappingURL=extension.js.map