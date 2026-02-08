const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { parseFunctionReference } = require("./parser");
const { createCompletionProvider } = require("./completionProvider");
const { createHoverProvider } = require("./hoverProvider");
const { createSignatureHelpProvider } = require("./signatureHelpProvider");

let aDisposables = [];

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

    // Document selectors for JSON files and untitled (new) files
    const aDocSelectors = [
        { scheme: "file", language: "json" },
        { scheme: "file", language: "jsonc" },
        { scheme: "untitled", language: "json" },
        { scheme: "untitled", language: "jsonc" },
        { scheme: "untitled", language: "plaintext" },
        { scheme: "file", language: "plaintext" }
    ];

    // Register completion provider - triggers on @, {, and dot
    const oCompletionDisposable = vscode.languages.registerCompletionItemProvider(
        aDocSelectors,
        createCompletionProvider(aFunctions),
        "@", "{", "."
    );
    aDisposables.push(oCompletionDisposable);

    // Register hover provider
    const oHoverDisposable = vscode.languages.registerHoverProvider(
        aDocSelectors,
        createHoverProvider(aFunctions)
    );
    aDisposables.push(oHoverDisposable);

    // Register signature help provider - triggers on ( and ,
    const oSignatureDisposable = vscode.languages.registerSignatureHelpProvider(
        aDocSelectors,
        createSignatureHelpProvider(aFunctions),
        { triggerCharacters: ["(", ","], retriggerCharacters: [","] }
    );
    aDisposables.push(oSignatureDisposable);

    // Add all disposables to the extension context
    for (let i = 0; i < aDisposables.length; i++) {
        oContext.subscriptions.push(aDisposables[i]);
    }

    // Register a command to show function count
    const oInfoCommand = vscode.commands.registerCommand("flowIntelliSense.showInfo", function () {
        vscode.window.showInformationMessage(
            "Power Automate Utility: " + aFunctions.length + " Logic App expression functions loaded"
        );
    });
    oContext.subscriptions.push(oInfoCommand);

    // Register a command to view the SKILL.md file
    const oSkillCommand = vscode.commands.registerCommand("flowIntelliSense.viewSkillFile", function () {
        viewSkillFile(oContext);
    });
    oContext.subscriptions.push(oSkillCommand);

    // Register a command to delete the SKILL.md file
    const oDeleteSkillCommand = vscode.commands.registerCommand("flowIntelliSense.deleteSkillFile", function () {
        deleteSkillFile(oContext);
    });
    oContext.subscriptions.push(oDeleteSkillCommand);

    const sInstallFlagKey = "bSkillFileInstalled";
    const bIsInstalled = oContext.globalState.get(sInstallFlagKey, false);
    const sSkillDestPath = path.join(os.homedir(), ".copilot", "skills", "flow-intellisense", "SKILL.md");

    if (!bIsInstalled || !fileExists(sSkillDestPath)) {
        installSkillFile(oContext);
        oContext.globalState.update(sInstallFlagKey, true);
    }

    //vscode.window.showInformationMessage("Power Automate Utility: Loaded " + aFunctions.length + " expression functions");
}

/**
 * Resolve the path to the expression-functions-reference.md file.
 * Checks: 1) user setting, 2) workspace root, 3) extension directory
 * @param {vscode.ExtensionContext} oContext
 * @returns {string|null}
 */
function resolveReferencePath(oContext) {
    // Check user-configured path
    const oConfig = vscode.workspace.getConfiguration("flowIntelliSense");
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

    // Check parent directory (dev scenario)
    const sParentPath = path.join(oContext.extensionPath, "..", "expression-functions-reference.md");
    if (fileExists(sParentPath)) {
        return sParentPath;
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
 * Delete the SKILL.md file from the Copilot skills directory and reset the install flag.
 * @param {vscode.ExtensionContext} oContext
 */
function deleteSkillFile(oContext) {
    try {
        const sHomeDir = os.homedir();
        const sExtensionName = "flow-intellisense";
        const sDestDir = path.join(sHomeDir, ".copilot", "skills", sExtensionName);
        const sDestPath = path.join(sDestDir, "SKILL.md");

        if (!fileExists(sDestPath)) {
            vscode.window.showInformationMessage("Power Automate Utility: SKILL.md is not installed");
            return;
        }

        fs.unlinkSync(sDestPath);
        oContext.globalState.update("bSkillFileInstalled", false);
        console.log("Power Automate Utility: Deleted SKILL.md from " + sDestPath);
        vscode.window.showInformationMessage("Power Automate Utility: Copilot skill removed from " + sDestPath);
    } catch (oError) {
        console.error("Power Automate Utility: Failed to delete SKILL.md - " + oError.message);
        vscode.window.showErrorMessage("Power Automate Utility: Failed to delete SKILL.md - " + oError.message);
    }
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
