import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let i18nData: Record<string, any> = {};
let decorationType: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
    console.log('i18n EJS Preview extension activated');

    // Create decoration type for inline hints
    decorationType = vscode.window.createTextEditorDecorationType({
        after: {
            margin: '0 0 0 1em',
            color: new vscode.ThemeColor('editorCodeLens.foreground')
        }
    });

    // Load i18n data
    loadI18nData();

    // Register hover provider
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(['ejs', 'html', 'js', 'ts'], {
            provideHover(document, position, token) {
                return provideHover(document, position);
            }
        })
    );

    // Register completion provider
    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(['ejs', 'html', 'js', 'ts'], {
            provideCompletionItems(document, position) {
                return provideCompletionItems(document, position);
            }
        }, "'", '"', '.')
    );

    // Update decorations when active editor changes
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                updateDecorations(editor);
            }
        })
    );

    // Update decorations when document changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
            const editor = vscode.window.activeTextEditor;
            if (editor && event.document === editor.document) {
                updateDecorations(editor);
            }
        })
    );

    // Watch for i18n file changes
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        const config = vscode.workspace.getConfiguration('i18nEjsPreview');
        const i18nFolder = config.get<string>('i18nFolder', 'locales');
        const i18nPath = path.join(workspaceFolder.uri.fsPath, i18nFolder);
        
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(i18nPath, '**/*.json')
        );
        
        watcher.onDidChange(() => loadI18nData());
        watcher.onDidCreate(() => loadI18nData());
        watcher.onDidDelete(() => loadI18nData());
        
        context.subscriptions.push(watcher);
    }

    // Update decorations for current editor
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor);
    }
}

function loadI18nData() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        return;
    }

    const config = vscode.workspace.getConfiguration('i18nEjsPreview');
    const i18nFolder = config.get<string>('i18nFolder', 'locales');
    const defaultLocale = config.get<string>('defaultLocale', 'en');
    
    // Try multiple possible paths
    const possiblePaths = [
        path.join(workspaceFolder.uri.fsPath, i18nFolder, `${defaultLocale}.json`),
        path.join(workspaceFolder.uri.fsPath, `${defaultLocale}.json`),
        path.join(workspaceFolder.uri.fsPath, 'example files', `${defaultLocale}.json`)
    ];

    for (const i18nFilePath of possiblePaths) {
        if (fs.existsSync(i18nFilePath)) {
            try {
                const fileContent = fs.readFileSync(i18nFilePath, 'utf8');
                i18nData = JSON.parse(fileContent);
                console.log(`Loaded i18n data from: ${i18nFilePath}`);
                
                // Update decorations for all visible editors
                vscode.window.visibleTextEditors.forEach(editor => {
                    updateDecorations(editor);
                });
                
                return;
            } catch (error) {
                console.error(`Error loading i18n file: ${error}`);
            }
        }
    }
    
    console.warn('No i18n file found. Checked paths:', possiblePaths);
}

function getNestedValue(obj: any, key: string): any {
    const keys = key.split('.');
    let value = obj;
    
    for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
            value = value[k];
        } else {
            return undefined;
        }
    }
    
    return value;
}

function extractI18nKey(line: string, position: number): string | null {
    const config = vscode.workspace.getConfiguration('i18nEjsPreview');
    const functionName = config.get<string>('functionName', '__');
    
    // Match patterns like __('key') or __("key")
    const regex = new RegExp(`${functionName}\\s*\\(\\s*['"]([^'"]+)['"]\\s*\\)`, 'g');
    
    let match;
    while ((match = regex.exec(line)) !== null) {
        const startPos = match.index;
        const endPos = match.index + match[0].length;
        
        if (position >= startPos && position <= endPos) {
            return match[1];
        }
    }
    
    return null;
}

function getAllKeys(obj: any, prefix: string = ''): string[] {
    const keys: string[] = [];
    
    for (const key in obj) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
            // Recursively get nested keys
            keys.push(...getAllKeys(obj[key], fullKey));
        } else {
            // Add leaf keys (strings, arrays, primitives)
            keys.push(fullKey);
        }
    }
    
    return keys;
}

function provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] {
    const line = document.lineAt(position.line).text;
    const textBeforeCursor = line.substring(0, position.character);
    
    const config = vscode.workspace.getConfiguration('i18nEjsPreview');
    const functionName = config.get<string>('functionName', '__');
    
    // Check if we're inside __('...') or __("...")
    const singleQuoteMatch = textBeforeCursor.match(new RegExp(`${functionName}\\s*\\(\\s*'([^']*)`));
    const doubleQuoteMatch = textBeforeCursor.match(new RegExp(`${functionName}\\s*\\(\\s*"([^"]*)`));
    
    const match = singleQuoteMatch || doubleQuoteMatch;
    
    if (!match) {
        return [];
    }
    
    const partialKey = match[1];
    const allKeys = getAllKeys(i18nData);
    
    // Filter keys that start with the partial key
    const matchingKeys = allKeys.filter(key => key.startsWith(partialKey));
    
    // Create completion items
    const completionItems = matchingKeys.map(key => {
        const value = getNestedValue(i18nData, key);
        const item = new vscode.CompletionItem(key, vscode.CompletionItemKind.Value);
        
        // Set the text to insert (just the remaining part of the key)
        item.insertText = key.substring(partialKey.length);
        
        // Add documentation showing the translation value
        if (Array.isArray(value)) {
            item.detail = `[${value.length} items]`;
            item.documentation = new vscode.MarkdownString(value.map((v, i) => `${i + 1}. ${v}`).join('\n'));
        } else if (typeof value === 'object') {
            item.detail = '{object}';
            item.documentation = new vscode.MarkdownString('```json\n' + JSON.stringify(value, null, 2) + '\n```');
        } else {
            item.detail = String(value);
            item.documentation = new vscode.MarkdownString(String(value));
        }
        
        return item;
    });
    
    return completionItems;
}

function provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
    const line = document.lineAt(position.line).text;
    const key = extractI18nKey(line, position.character);
    
    if (!key) {
        return null;
    }
    
    const value = getNestedValue(i18nData, key);
    
    if (value === undefined) {
        return new vscode.Hover(`**i18n key not found:** \`${key}\``);
    }
    
    // Handle arrays
    if (Array.isArray(value)) {
        const arrayPreview = value.map((item, index) => `${index + 1}. ${item}`).join('\n');
        return new vscode.Hover(`**Translation (${key}):**\n\n${arrayPreview}`);
    }
    
    // Handle objects
    if (typeof value === 'object') {
        const objPreview = JSON.stringify(value, null, 2);
        return new vscode.Hover(`**Translation (${key}):**\n\`\`\`json\n${objPreview}\n\`\`\``);
    }
    
    // Handle strings and primitives
    return new vscode.Hover(`**Translation:** ${value}`);
}

function updateDecorations(editor: vscode.TextEditor) {
    if (!editor || (editor.document.languageId !== 'ejs' && editor.document.languageId !== 'html')) {
        return;
    }
    
    const config = vscode.workspace.getConfiguration('i18nEjsPreview');
    const functionName = config.get<string>('functionName', '__');
    const regex = new RegExp(`${functionName}\\s*\\(\\s*['"]([^'"]+)['"]\\s*\\)`, 'g');
    
    const decorations: vscode.DecorationOptions[] = [];
    const text = editor.document.getText();
    
    let match;
    while ((match = regex.exec(text)) !== null) {
        const key = match[1];
        const value = getNestedValue(i18nData, key);
        
        if (value !== undefined) {
            const startPos = editor.document.positionAt(match.index);
            const endPos = editor.document.positionAt(match.index + match[0].length);
            
            let displayValue: string;
            if (Array.isArray(value)) {
                displayValue = `[${value.length} items]`;
            } else if (typeof value === 'object') {
                displayValue = '{...}';
            } else {
                displayValue = String(value).substring(0, 50);
                if (String(value).length > 50) {
                    displayValue += '...';
                }
            }
            
            const decoration: vscode.DecorationOptions = {
                range: new vscode.Range(startPos, endPos),
                renderOptions: {
                    after: {
                        contentText: `→ ${displayValue}`,
                        fontStyle: 'italic'
                    }
                }
            };
            
            decorations.push(decoration);
        }
    }
    
    editor.setDecorations(decorationType, decorations);
}

export function deactivate() {
    if (decorationType) {
        decorationType.dispose();
    }
}
