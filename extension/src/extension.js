const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { parseFunctionReference } = require("./parser");
const { createCompletionProvider } = require("./completionProvider");
const { createActionCompletionProvider } = require("./actionCompletionProvider");
const { createHoverProvider } = require("./hoverProvider");
const { createSignatureHelpProvider } = require("./signatureHelpProvider");
const { createParametersCompletionProvider } = require("./parametersCompletionProvider");
const { registerFlowCommands } = require("./flowCommands");

let aDisposables = [];
let aIntellisenseDisposables = [];
let bCleaningUpAt = false;

/**
 * Document selectors for JSON files and untitled (new) files
 */
const aDocSelectors = [
    { scheme: "file", language: "json" },
    { scheme: "file", language: "jsonc" },
    { scheme: "untitled", language: "json" },
    { scheme: "untitled", language: "jsonc" },
    { scheme: "untitled", language: "plaintext" },
    { scheme: "file", language: "plaintext" }
];

/**
 * Register all IntelliSense providers (completion, hover, signature help)
 * @param {vscode.ExtensionContext} oContext
 * @param {Array} aFunctions
 */
function registerIntellisenseProviders(oContext, aFunctions) {
    // Register completion provider - triggers on @, {, and dot
    const oCompletionDisposable = vscode.languages.registerCompletionItemProvider(
        aDocSelectors,
        createCompletionProvider(aFunctions),
        "@", "{", "."
    );
    aIntellisenseDisposables.push(oCompletionDisposable);

    // Load actions.json and register action completion provider
    const sActionsPath = resolveActionsPath(oContext);
    if (sActionsPath) {
        try {
            const sActionsContent = fs.readFileSync(sActionsPath, "utf8");
            const oActions = JSON.parse(sActionsContent);
            const aActionKeys = Object.keys(oActions);
            console.log("Power Automate Utility: Loaded " + aActionKeys.length + " actions from actions.json");

            const oActionCompletionDisposable = vscode.languages.registerCompletionItemProvider(
                aDocSelectors,
                createActionCompletionProvider(oActions),
                "@"
            );
            aIntellisenseDisposables.push(oActionCompletionDisposable);
        } catch (oError) {
            console.log("Power Automate Utility: Could not load actions.json - " + oError.message);
        }
    }

    // Register hover provider
    const oHoverDisposable = vscode.languages.registerHoverProvider(
        aDocSelectors,
        createHoverProvider(aFunctions)
    );
    aIntellisenseDisposables.push(oHoverDisposable);

    // Register signature help provider - triggers on ( and ,
    const oSignatureDisposable = vscode.languages.registerSignatureHelpProvider(
        aDocSelectors,
        createSignatureHelpProvider(aFunctions),
        { triggerCharacters: ["(", ","], retriggerCharacters: [","] }
    );
    aIntellisenseDisposables.push(oSignatureDisposable);

    // Register parameters completion provider - triggers on ( for @parameters(...)
    const oParametersCompletionDisposable = vscode.languages.registerCompletionItemProvider(
        aDocSelectors,
        createParametersCompletionProvider(oContext),
        "("
    );
    aIntellisenseDisposables.push(oParametersCompletionDisposable);

    // Add all IntelliSense disposables to the extension context
    for (let i = 0; i < aIntellisenseDisposables.length; i++) {
        oContext.subscriptions.push(aIntellisenseDisposables[i]);
    }
}

/**
 * Dispose all IntelliSense providers
 */
function disposeIntellisenseProviders() {
    for (let i = 0; i < aIntellisenseDisposables.length; i++) {
        aIntellisenseDisposables[i].dispose();
    }
    aIntellisenseDisposables = [];
}

/**
 * Activate the extension - parse the reference file and register all providers
 * @param {vscode.ExtensionContext} oContext
 */
function activate(oContext) {
    const sRefPath = resolveReferencePath(oContext);
    if (!sRefPath) {
        vscode.window.showErrorMessage("Power Automate Utility: Could not find expression-functions-reference.md");
        return;
    }

    let aFunctions = [];
    try {
        aFunctions = parseFunctionReference(sRefPath);
        console.log("Power Automate Utility: Parsed " + aFunctions.length + " functions from reference file");
    } catch (oError) {
        vscode.window.showErrorMessage("Power Automate Utility: Error parsing reference file - " + oError.message);
        return;
    }

    if (aFunctions.length === 0) {
        vscode.window.showWarningMessage("Power Automate Utility: No functions found in reference file");
        return;
    }

    // Check persisted IntelliSense enabled state (default: true)
    const bIntellisenseEnabled = oContext.globalState.get("bIntellisenseEnabled", true);

    // Register IntelliSense providers if enabled
    if (bIntellisenseEnabled) {
        registerIntellisenseProviders(oContext, aFunctions);
    }

    // Show startup notification with current IntelliSense status
    const sStatus = bIntellisenseEnabled ? "ON" : "OFF";
    vscode.window.showInformationMessage("Power Automate Utility: IntelliSense is " + sStatus);

    // Register toggle IntelliSense command
    const oToggleCommand = vscode.commands.registerCommand("powerAutomateUtility.toggleIntellisense", function () {
        const bCurrentState = oContext.globalState.get("bIntellisenseEnabled", true);
        const bNewState = !bCurrentState;
        oContext.globalState.update("bIntellisenseEnabled", bNewState);

        if (bNewState) {
            registerIntellisenseProviders(oContext, aFunctions);
            vscode.window.showInformationMessage("Power Automate Utility: IntelliSense turned ON");
        } else {
            disposeIntellisenseProviders();
            vscode.window.showInformationMessage("Power Automate Utility: IntelliSense turned OFF");
        }
    });
    oContext.subscriptions.push(oToggleCommand);

    // Register listener to remove nested @ inside expressions
    registerNestedAtCleanup(oContext);

    // Register flow editing commands (sign in, list, open, update)
    const aFlowDisposables = registerFlowCommands(oContext);
    for (let i = 0; i < aFlowDisposables.length; i++) {
        oContext.subscriptions.push(aFlowDisposables[i]);
    }

    // Register a command to show function count
    const oInfoCommand = vscode.commands.registerCommand("powerAutomateUtility.showInfo", function () {
        vscode.window.showInformationMessage(
            "Power Automate Utility: " + aFunctions.length + " Logic App expression functions loaded"
        );
    });
    oContext.subscriptions.push(oInfoCommand);

    // Register a command to view the SKILL.md file
    const oSkillCommand = vscode.commands.registerCommand("powerAutomateUtility.viewSkillFile", function () {
        viewSkillFile(oContext);
    });
    oContext.subscriptions.push(oSkillCommand);

    // Register a command to delete the SKILL.md file
    const oDeleteSkillCommand = vscode.commands.registerCommand("powerAutomateUtility.deleteSkillFile", function () {
        deleteSkillFile(oContext);
    });
    oContext.subscriptions.push(oDeleteSkillCommand);

    const sInstallFlagKey = "bSkillFileInstalled";
    const bIsInstalled = oContext.globalState.get(sInstallFlagKey, false);
    const sSkillDestPath = path.join(os.homedir(), ".copilot", "skills", "powerAutomateUtility", "SKILL.md");

    if (!bIsInstalled || !fileExists(sSkillDestPath)) {
        installSkillFile(oContext);
        oContext.globalState.update(sInstallFlagKey, true);
    }

    const sFlowDefInstallFlagKey = "bFlowDefSkillFileInstalled";
    const bFlowDefIsInstalled = oContext.globalState.get(sFlowDefInstallFlagKey, false);
    const sFlowDefSkillDestPath = path.join(os.homedir(), ".copilot", "skills", "powerAutomateFlowDefinition", "SKILL.md");

    if (!bFlowDefIsInstalled || !fileExists(sFlowDefSkillDestPath)) {
        installFlowDefinitionSkillFile(oContext);
        oContext.globalState.update(sFlowDefInstallFlagKey, true);
    }
}

/**
 * Resolve the path to the expression-functions-reference.md file.
 * Checks: 1) user setting, 2) workspace root, 3) extension directory
 * @param {vscode.ExtensionContext} oContext
 * @returns {string|null}
 */
function resolveReferencePath(oContext) {
    // Check user-configured path
    const oConfig = vscode.workspace.getConfiguration("powerAutomateUtility");
    const sConfigPath = oConfig.get("referencePath");
    if (sConfigPath && fileExists(sConfigPath)) {
        return sConfigPath;
    }

    // Check workspace folders
    const aWorkspaceFolders = vscode.workspace.workspaceFolders;
    if (aWorkspaceFolders) {
        for (let i = 0; i < aWorkspaceFolders.length; i++) {
            const sWorkspacePath = path.join(aWorkspaceFolders[i].uri.fsPath, "expression-functions-reference.md");
            if (fileExists(sWorkspacePath)) {
                return sWorkspacePath;
            }
        }
    }

    // Check extension directory (bundled copy)
    const sExtPath = path.join(oContext.extensionPath, "expression-functions-reference.md");
    if (fileExists(sExtPath)) {
        return sExtPath;
    }

    return null;
}

/**
 * Resolve the path to the actions.json file.
 * Checks: 1) user setting, 2) workspace root, 3) extension directory, 4) parent directory
 * @param {vscode.ExtensionContext} oContext
 * @returns {string|null}
 */
function resolveActionsPath(oContext) {
    // Check user-configured path
    const oConfig = vscode.workspace.getConfiguration("powerAutomateUtility");
    const sConfigPath = oConfig.get("actionsPath");
    if (sConfigPath && fileExists(sConfigPath)) {
        return sConfigPath;
    }

    // Check workspace folders
    const aWorkspaceFolders = vscode.workspace.workspaceFolders;
    if (aWorkspaceFolders) {
        for (let i = 0; i < aWorkspaceFolders.length; i++) {
            const sWorkspacePath = path.join(aWorkspaceFolders[i].uri.fsPath, "actions.json");
            if (fileExists(sWorkspacePath)) {
                return sWorkspacePath;
            }
        }
    }

    // Check extension directory (bundled copy)
    const sExtPath = path.join(oContext.extensionPath, "actions.json");
    if (fileExists(sExtPath)) {
        return sExtPath;
    }

    return null;
}

/**
 * Open the SKILL.md file in the editor.
 * Checks the installed Copilot skills location first, then falls back to the bundled source.
 * @param {vscode.ExtensionContext} oContext
 */
function viewSkillFile(oContext) {
    const sHomeDir = os.homedir();
    const sExtensionName = "flow-intellisense";
    const sInstalledPath = path.join(sHomeDir, ".copilot", "skills", sExtensionName, "SKILL.md");
    const sSourcePath = path.join(oContext.extensionPath, "src", "skill.md");

    let sFilePath = null;
    if (fileExists(sInstalledPath)) {
        sFilePath = sInstalledPath;
    } else if (fileExists(sSourcePath)) {
        sFilePath = sSourcePath;
    }

    if (sFilePath) {
        const oUri = vscode.Uri.file(sFilePath);
        vscode.commands.executeCommand("markdown.showPreview", oUri);
    } else {
        vscode.window.showErrorMessage("Power Automate Utility: SKILL.md file not found");
    }
}

/**
 * Install the skill.md file to the Copilot skills directory.
 * Windows:      %USERPROFILE%/.copilot/skills/<extension-name>/SKILL.md
 * macOS / Linux: ~/.copilot/skills/<extension-name>/SKILL.md
 * @param {vscode.ExtensionContext} oContext
 */
function installSkillFile(oContext) {
    try {
        const sSourcePath = path.join(oContext.extensionPath, "src", "skill.md");
        if (!fileExists(sSourcePath)) {
            console.log("Power Automate Utility: skill.md not found at " + sSourcePath);
            return;
        }

        const sHomeDir = os.homedir();
        const sExtensionName = "flow-intellisense";
        const sDestDir = path.join(sHomeDir, ".copilot", "skills", sExtensionName);
        const sDestPath = path.join(sDestDir, "SKILL.md");

        if (!fs.existsSync(sDestDir)) {
            fs.mkdirSync(sDestDir, { recursive: true });
        }

        fs.copyFileSync(sSourcePath, sDestPath);
        console.log("Power Automate Utility: Installed SKILL.md to " + sDestPath);
        vscode.window.showInformationMessage("Power Automate Utility: Copilot skill installed to " + sDestPath);
    } catch (oError) {
        console.error("Power Automate Utility: Failed to install SKILL.md - " + oError.message);
    }
}

/**
 * Install the flowDefinitionSkill.md file to the Copilot skills directory.
 * Windows:      %USERPROFILE%/.copilot/skills/powerAutomateFlowDefinition/SKILL.md
 * macOS / Linux: ~/.copilot/skills/powerAutomateFlowDefinition/SKILL.md
 * @param {vscode.ExtensionContext} oContext
 */
function installFlowDefinitionSkillFile(oContext) {
    try {
        const sSourcePath = path.join(oContext.extensionPath, "src", "flowDefinitionSkill.md");
        if (!fileExists(sSourcePath)) {
            console.log("Power Automate Utility: flowDefinitionSkill.md not found at " + sSourcePath);
            return;
        }

        const sHomeDir = os.homedir();
        const sDestDir = path.join(sHomeDir, ".copilot", "skills", "powerAutomateFlowDefinition");
        const sDestPath = path.join(sDestDir, "SKILL.md");

        if (!fs.existsSync(sDestDir)) {
            fs.mkdirSync(sDestDir, { recursive: true });
        }

        fs.copyFileSync(sSourcePath, sDestPath);
        console.log("Power Automate Utility: Installed flow definition SKILL.md to " + sDestPath);
    } catch (oError) {
        console.error("Power Automate Utility: Failed to install flow definition SKILL.md - " + oError.message);
    }
}

/**
 * Delete the SKILL.md files from the Copilot skills directory and reset the install flags.
 * @param {vscode.ExtensionContext} oContext
 */
function deleteSkillFile(oContext) {
    try {
        const sHomeDir = os.homedir();
        let bDeleted = false;

        const aSkillDirs = [
            { sDir: "flow-intellisense", sFlagKey: "bSkillFileInstalled" },
            { sDir: "powerAutomateUtility", sFlagKey: "bSkillFileInstalled" },
            { sDir: "powerAutomateFlowDefinition", sFlagKey: "bFlowDefSkillFileInstalled" }
        ];

        for (let i = 0; i < aSkillDirs.length; i++) {
            const sDestPath = path.join(sHomeDir, ".copilot", "skills", aSkillDirs[i].sDir, "SKILL.md");
            if (fileExists(sDestPath)) {
                fs.unlinkSync(sDestPath);
                oContext.globalState.update(aSkillDirs[i].sFlagKey, false);
                console.log("Power Automate Utility: Deleted SKILL.md from " + sDestPath);
                bDeleted = true;
            }
        }

        if (bDeleted) {
            vscode.window.showInformationMessage("Power Automate Utility: Copilot skill files removed");
        } else {
            vscode.window.showInformationMessage("Power Automate Utility: No SKILL.md files are installed");
        }
    } catch (oError) {
        console.error("Power Automate Utility: Failed to delete SKILL.md - " + oError.message);
        vscode.window.showErrorMessage("Power Automate Utility: Failed to delete SKILL.md - " + oError.message);
    }
}

/**
 * Check if a character is a letter (a-z, A-Z).
 * @param {string} sChar - single character
 * @returns {boolean}
 */
function isLetter(sChar) {
    return (sChar >= "a" && sChar <= "z") || (sChar >= "A" && sChar <= "Z");
}

/**
 * Scan a line of text for @ symbols that appear inside an outer expression's
 * parentheses (nested function calls) and return TextEdits to delete them.
 * Skips @ inside single-quoted string literals.
 * @param {string} sLine - the full line text
 * @param {number} iLine - zero-based line number
 * @returns {Array<vscode.TextEdit>}
 */
function findNestedAtEdits(sLine, iLine) {
    const aEdits = [];
    let i = 0;

    while (i < sLine.length) {
        // Look for the start of an expression: @ followed by a letter
        if (sLine[i] === "@" && i + 1 < sLine.length && isLetter(sLine[i + 1])) {
            i++; // skip the leading @
            // Skip the function name
            while (i < sLine.length && (isLetter(sLine[i]) || (sLine[i] >= "0" && sLine[i] <= "9") || sLine[i] === "_")) {
                i++;
            }

            // Check for opening parenthesis
            if (i < sLine.length && sLine[i] === "(") {
                i++; // skip (
                let iDepth = 1;

                while (i < sLine.length && iDepth > 0) {
                    if (sLine[i] === "'") {
                        // Skip single-quoted string literal
                        i++;
                        while (i < sLine.length) {
                            if (sLine[i] === "'" && i + 1 < sLine.length && sLine[i + 1] === "'") {
                                i += 2; // escaped quote ''
                            } else if (sLine[i] === "'") {
                                i++; // closing quote
                                break;
                            } else {
                                i++;
                            }
                        }
                    } else if (sLine[i] === "(") {
                        iDepth++;
                        i++;
                    } else if (sLine[i] === ")") {
                        iDepth--;
                        i++;
                    } else if (sLine[i] === "@" && i + 1 < sLine.length && isLetter(sLine[i + 1])) {
                        // Nested @ before a function name — mark for removal
                        aEdits.push(vscode.TextEdit.delete(
                            new vscode.Range(iLine, i, iLine, i + 1)
                        ));
                        i++;
                    } else {
                        i++;
                    }
                }
            }
        } else {
            i++;
        }
    }

    return aEdits;
}

/**
 * Register a listener that removes @ symbols from nested function calls
 * inside expression parentheses whenever the document changes.
 * @param {vscode.ExtensionContext} oContext
 */
function registerNestedAtCleanup(oContext) {
    const oDisposable = vscode.workspace.onDidChangeTextDocument(function (oEvent) {
        if (bCleaningUpAt) {
            return;
        }

        const oEditor = vscode.window.activeTextEditor;
        if (!oEditor || oEditor.document !== oEvent.document) {
            return;
        }

        const sLangId = oEvent.document.languageId;
        if (sLangId !== "json" && sLangId !== "jsonc" && sLangId !== "plaintext") {
            return;
        }

        const aAllEdits = [];
        const oProcessedLines = {};

        for (let c = 0; c < oEvent.contentChanges.length; c++) {
            const oChange = oEvent.contentChanges[c];
            const iStartLine = oChange.range.start.line;
            const aNewLines = oChange.text.split("\n");
            const iEndLine = iStartLine + aNewLines.length - 1;

            for (let iLine = iStartLine; iLine <= iEndLine; iLine++) {
                if (oProcessedLines[iLine] || iLine >= oEvent.document.lineCount) {
                    continue;
                }
                oProcessedLines[iLine] = true;

                const sLineText = oEvent.document.lineAt(iLine).text;
                const aLineEdits = findNestedAtEdits(sLineText, iLine);
                for (let e = 0; e < aLineEdits.length; e++) {
                    aAllEdits.push(aLineEdits[e]);
                }
            }
        }

        if (aAllEdits.length > 0) {
            bCleaningUpAt = true;
            const oWorkspaceEdit = new vscode.WorkspaceEdit();
            oWorkspaceEdit.set(oEvent.document.uri, aAllEdits);
            vscode.workspace.applyEdit(oWorkspaceEdit).then(function () {
                bCleaningUpAt = false;
            }, function () {
                bCleaningUpAt = false;
            });
        }
    });

    oContext.subscriptions.push(oDisposable);
}

/**
 * Check if a file exists
 * @param {string} sFilePath
 * @returns {boolean}
 */
function fileExists(sFilePath) {
    try {
        return fs.existsSync(sFilePath);
    } catch (e) {
        return false;
    }
}

/**
 * Deactivate the extension
 */
function deactivate() {
    for (let i = 0; i < aDisposables.length; i++) {
        aDisposables[i].dispose();
    }
    aDisposables = [];
}

module.exports = { activate, deactivate };
