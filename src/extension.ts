import * as vscode from 'vscode';
import * as path from 'path';

const openPanels = new Map<string, vscode.WebviewPanel>();

export function activate(context: vscode.ExtensionContext) {

    const createOrShowViewer = (editor: vscode.TextEditor) => {
        const document = editor.document;
        const docUri = document.uri.toString();

        // If a panel for this document is already open, just reveal it.
        if (openPanels.has(docUri)) {
            openPanels.get(docUri)!.reveal(vscode.ViewColumn.Beside);
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            'zeroBasedViewer',
            `Zero-Based: ${path.basename(document.fileName)}`,
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        openPanels.set(docUri, panel);

        panel.webview.html = getWebviewContent(document);

        const changeSubscription = vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.uri.toString() === docUri) {
                panel.webview.html = getWebviewContent(event.document);
            }
        });

        panel.onDidDispose(() => {
            openPanels.delete(docUri);
            changeSubscription.dispose();
        }, null, context.subscriptions);
    };

    // Manual command to show the viewer
    const showCommand = vscode.commands.registerCommand('zero-based-viewer.showViewer', () => {
        if (vscode.window.activeTextEditor) {
            createOrShowViewer(vscode.window.activeTextEditor);
        } else {
            vscode.window.showInformationMessage('No active editor to show.');
        }
    });
    context.subscriptions.push(showCommand);

    // Event listener to automatically open viewer for new files
    const autoOpenListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        const config = vscode.workspace.getConfiguration('zeroBasedViewer');
        if (config.get<boolean>('autoOpen') && editor) {
            createOrShowViewer(editor);
        }
    });
    context.subscriptions.push(autoOpenListener);
    
    // Automatically open for the currently active file on startup
    const config = vscode.workspace.getConfiguration('zeroBasedViewer');
    if (config.get<boolean>('autoOpen') && vscode.window.activeTextEditor) {
        createOrShowViewer(vscode.window.activeTextEditor);
    }
    
    // Clean up panels when the source document is closed
    const cleanupListener = vscode.workspace.onDidCloseTextDocument(document => {
        const docUri = document.uri.toString();
        if (openPanels.has(docUri)) {
            openPanels.get(docUri)!.dispose();
        }
    });
    context.subscriptions.push(cleanupListener);
}

export function deactivate() {
    openPanels.forEach(panel => panel.dispose());
    openPanels.clear();
}

function getWebviewContent(document: vscode.TextDocument): string {
    const code = document.getText();
    const lines = code.split('\n');
    const fileName = path.basename(document.fileName);

    const linesHtml = lines.map((line, index) => `
        <div class="line">
            <span class="line-number">${index}</span>
            <span class="line-code">${line === '' ? '&nbsp;' : escapeHtml(line)}</span>
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
                    font-family: var(--vscode-editor-font-family, monospace);
                    font-size: var(--vscode-editor-font-size, 14px);
                    background: var(--vscode-editor-background, #1e1e1e);
                    color: var(--vscode-editor-foreground, #d4d4d4);
                    margin: 0;
                    padding: 1em;
                    box-sizing: border-box;
                }
                .line {
                    display: flex;
                    white-space: pre;
                    line-height: var(--vscode-editor-line-height, 1.5);
                }
                .line-number {
                    min-width: 32px;
                    text-align: right;
                    padding-right: 1em;
                    color: var(--vscode-editorLineNumber-foreground, #858585);
                    user-select: none;
                }
                .line-code {
                    flex: 1;
                }
            </style>
        </head>
        <body>
            <div style="font-weight:bold; margin-bottom:0.5em;">${fileName}</div>
            ${linesHtml}
        </body>
        </html>
    `;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;')
               .replace(/</g, '&lt;')
               .replace(/>/g, '&gt;');
} 