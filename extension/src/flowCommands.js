const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { getToken, clearToken, listFlows, getClientData, updateClientData } = require("./dataverseClient");

/**
 * Prompt the user for the Power Platform environment URL.
 * @returns {Promise<string|undefined>}
 */
function promptForEnvUrl() {
    return vscode.window.showInputBox({
        prompt: "Enter the Power Platform environment URL",
        placeHolder: "https://yourorg.crm.dynamics.com",
        ignoreFocusOut: true,
        validateInput: function (sValue) {
            if (!sValue || !sValue.trim()) {
                return "Environment URL is required";
            }
            let bIsHttp = sValue.indexOf("https://") === 0 || sValue.indexOf("http://") === 0;
            if (!bIsHttp) {
                return "URL must start with https:// or http://";
            }
            return null;
        }
    }).then(function (sValue) {
        if (sValue) {
            // Remove trailing slash if present
            return sValue.replace(new RegExp("[/]+$", ""), "");
        }
        return undefined;
    });
}

/**
 * Prompt the user for their Entra ID tenant ID.
 * @returns {Promise<string|undefined>}
 */
function promptForTenantId() {
    return vscode.window.showInputBox({
        prompt: "Enter your Entra ID (Azure AD) Tenant ID or domain",
        placeHolder: "e.g., contoso.onmicrosoft.com or 12345678-abcd-...",
        ignoreFocusOut: true,
        validateInput: function (sValue) {
            if (!sValue || !sValue.trim()) {
                return "Tenant ID is required";
            }
            return null;
        }
    }).then(function (sValue) {
        if (sValue) {
            return sValue.trim();
        }
        return undefined;
    });
}

/**
 * Extract the flow ID from a clientdata filename.
 * Expected format: <flowname>.<guid>.clientdata.json
 * @param {string} sFileName
 * @returns {string|null}
 */
function extractFlowIdFromFileName(sFileName) {
    const oMatch = new RegExp("([0-9a-fA-F\\-]{36})\\.clientdata\\.json$").exec(sFileName);
    if (oMatch) {
        return oMatch[1];
    }
    return null;
}

/**
 * Get the state label for a statecode value.
 * @param {number} iStateCode
 * @returns {string}
 */
function getStateLabel(iStateCode) {
    if (iStateCode === 0) {
        return "Draft";
    } else if (iStateCode === 1) {
        return "Activated";
    } else if (iStateCode === 2) {
        return "Suspended";
    }
    return "Unknown";
}

/**
 * Register all flow editing commands.
 * @param {vscode.ExtensionContext} oContext
 * @returns {Array<vscode.Disposable>}
 */
function registerFlowCommands(oContext) {
    let aDisposables = [];

    // ----------------------------------------------------------------
    // Command: Sign In
    // ----------------------------------------------------------------
    const oSignInCmd = vscode.commands.registerCommand("powerAutomateUtility.signIn", function () {
        promptForEnvUrl().then(function (sEnvUrl) {
            if (!sEnvUrl) {
                return;
            }

            promptForTenantId().then(function (sTenantId) {
                if (!sTenantId) {
                    return;
                }

                // Store tenant and env for later commands
                oContext.workspaceState.update("flowEnvUrl", sEnvUrl);
                oContext.workspaceState.update("flowTenantId", sTenantId);

                // Clear any cached token for this environment
                clearToken(sEnvUrl);

                vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Signing in via browser...",
                    cancellable: false
                }, function () {
                    return getToken(sEnvUrl, sTenantId).then(function () {
                        vscode.window.showInformationMessage("Signed in to " + sEnvUrl + " successfully.");
                    }).catch(function (oError) {
                        vscode.window.showErrorMessage("Sign-in failed: " + oError.message);
                    });
                });
            });
        });
    });
    aDisposables.push(oSignInCmd);

    // ----------------------------------------------------------------
    // Command: List Flows
    // ----------------------------------------------------------------
    const oListCmd = vscode.commands.registerCommand("powerAutomateUtility.listFlows", function () {
        const sStoredEnv = oContext.workspaceState.get("flowEnvUrl");
        const sStoredTenant = oContext.workspaceState.get("flowTenantId");

        const oDoList = function (sEnvUrl, sTenantId) {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Retrieving flows...",
                cancellable: false
            }, function () {
                return getToken(sEnvUrl, sTenantId).then(function (sToken) {
                    return listFlows(sEnvUrl, sToken);
                }).then(function (aFlows) {
                    if (aFlows.length === 0) {
                        vscode.window.showInformationMessage("No cloud flows found in this environment.");
                        return;
                    }

                    const aItems = aFlows.map(function (oFlow) {
                        return {
                            label: oFlow.sName,
                            description: getStateLabel(oFlow.iStateCode),
                            detail: oFlow.sId + (oFlow.sDescription ? " - " + oFlow.sDescription : ""),
                            sFlowId: oFlow.sId,
                            sEnvUrl: sEnvUrl,
                            sTenantId: sTenantId
                        };
                    });

                    return vscode.window.showQuickPick(aItems, {
                        placeHolder: "Select a flow to open its clientdata",
                        matchOnDescription: true,
                        matchOnDetail: true
                    }).then(function (oSelected) {
                        if (oSelected) {
                            vscode.commands.executeCommand(
                                "powerAutomateUtility.openFlow",
                                oSelected.sEnvUrl,
                                oSelected.sFlowId,
                                oSelected.sTenantId
                            );
                        }
                    });
                }).catch(function (oError) {
                    vscode.window.showErrorMessage("Failed to list flows: " + oError.message);
                });
            });
        };

        if (sStoredEnv && sStoredTenant) {
            oDoList(sStoredEnv, sStoredTenant);
        } else {
            promptForEnvUrl().then(function (sEnvUrl) {
                if (!sEnvUrl) {
                    return;
                }
                promptForTenantId().then(function (sTenantId) {
                    if (!sTenantId) {
                        return;
                    }
                    oContext.workspaceState.update("flowEnvUrl", sEnvUrl);
                    oContext.workspaceState.update("flowTenantId", sTenantId);
                    oDoList(sEnvUrl, sTenantId);
                });
            });
        }
    });
    aDisposables.push(oListCmd);

    // ----------------------------------------------------------------
    // Command: Open Flow ClientData
    // ----------------------------------------------------------------
    const oOpenCmd = vscode.commands.registerCommand("powerAutomateUtility.openFlow", function (sEnvUrl, sFlowId, sTenantId) {
        const oDoOpen = function (sUrl, sId, sTenant) {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Downloading flow clientdata...",
                cancellable: false
            }, function () {
                return getToken(sUrl, sTenant).then(function (sToken) {
                    return getClientData(sUrl, sToken, sId);
                }).then(function (oResult) {
                    // Sanitize the flow name for use as a filename
                    const sSafeName = oResult.sName.replace(new RegExp("[^a-zA-Z0-9_\\-]", "g"), "-");
                    const sFileName = sSafeName + "." + sId + ".clientdata.json";
                    const sTempDir = os.tmpdir();
                    const sFilePath = path.join(sTempDir, sFileName);

                    // Parse and pretty-print the clientdata JSON
                    let sPrettyJson;
                    try {
                        const oClientData = JSON.parse(oResult.sClientData);
                        sPrettyJson = JSON.stringify(oClientData, null, 2);
                    } catch (oParseError) {
                        // If it's not valid JSON, write the raw string
                        sPrettyJson = oResult.sClientData;
                    }

                    fs.writeFileSync(sFilePath, sPrettyJson, "utf8");

                    // Store the environment URL and tenant alongside the file for later updates
                    oContext.workspaceState.update("flowEnvUrl_" + sId, sUrl);
                    oContext.workspaceState.update("flowTenantId_" + sId, sTenant);

                    return vscode.workspace.openTextDocument(sFilePath).then(function (oDoc) {
                        return vscode.window.showTextDocument(oDoc);
                    });
                }).catch(function (oError) {
                    vscode.window.showErrorMessage("Failed to open flow: " + oError.message);
                });
            });
        };

        // If called with arguments (from list command), use them directly
        if (sEnvUrl && sFlowId && sTenantId) {
            oDoOpen(sEnvUrl, sFlowId, sTenantId);
            return;
        }

        // Otherwise prompt for all values
        promptForEnvUrl().then(function (sUrl) {
            if (!sUrl) {
                return;
            }
            promptForTenantId().then(function (sTenant) {
                if (!sTenant) {
                    return;
                }
                vscode.window.showInputBox({
                    prompt: "Enter the Workflow ID (GUID)",
                    placeHolder: "12345678-abcd-efgh-ijkl-123456789012",
                    ignoreFocusOut: true
                }).then(function (sId) {
                    if (sId) {
                        oDoOpen(sUrl, sId.trim(), sTenant);
                    }
                });
            });
        });
    });
    aDisposables.push(oOpenCmd);

    // ----------------------------------------------------------------
    // Command: Update Flow ClientData
    // ----------------------------------------------------------------
    const oUpdateCmd = vscode.commands.registerCommand("powerAutomateUtility.updateFlow", function () {
        const oEditor = vscode.window.activeTextEditor;
        if (!oEditor) {
            vscode.window.showErrorMessage("No active editor. Open a .clientdata.json file first.");
            return;
        }

        const sFilePath = oEditor.document.uri.fsPath;
        const sFileName = path.basename(sFilePath);
        const sFlowId = extractFlowIdFromFileName(sFileName);

        if (!sFlowId) {
            vscode.window.showErrorMessage(
                "Cannot determine flow ID from filename. Expected format: <name>.<guid>.clientdata.json"
            );
            return;
        }

        // Try to get the stored environment URL and tenant for this flow
        const sStoredEnvUrl = oContext.workspaceState.get("flowEnvUrl_" + sFlowId);
        const sStoredTenantId = oContext.workspaceState.get("flowTenantId_" + sFlowId);

        const oDoUpdate = function (sEnvUrl, sTenantId) {
            // Confirm before updating
            vscode.window.showWarningMessage(
                "Update flow " + sFlowId + " with the contents of this file?",
                { modal: true },
                "Update"
            ).then(function (sChoice) {
                if (sChoice !== "Update") {
                    return;
                }

                // Save the file first
                oEditor.document.save().then(function () {
                    vscode.window.withProgress({
                        location: vscode.ProgressLocation.Notification,
                        title: "Updating flow clientdata...",
                        cancellable: false
                    }, function () {
                        return getToken(sEnvUrl, sTenantId).then(function (sToken) {
                            const sFileContent = fs.readFileSync(sFilePath, "utf8");

                            // Validate it is valid JSON before sending
                            try {
                                JSON.parse(sFileContent);
                            } catch (oParseError) {
                                throw new Error("File contains invalid JSON: " + oParseError.message);
                            }

                            // Compact the JSON and send as the clientdata string value
                            const sCompactJson = JSON.stringify(JSON.parse(sFileContent));
                            return updateClientData(sEnvUrl, sToken, sFlowId, sCompactJson);
                        }).then(function () {
                            vscode.window.showInformationMessage("Flow clientdata updated successfully.");
                        }).catch(function (oError) {
                            vscode.window.showErrorMessage("Failed to update flow: " + oError.message);
                        });
                    });
                });
            });
        };

        if (sStoredEnvUrl && sStoredTenantId) {
            oDoUpdate(sStoredEnvUrl, sStoredTenantId);
        } else {
            promptForEnvUrl().then(function (sEnvUrl) {
                if (sEnvUrl) {
                    promptForTenantId().then(function (sTenantId) {
                        if (sTenantId) {
                            oDoUpdate(sEnvUrl, sTenantId);
                        }
                    });
                }
            });
        }
    });
    aDisposables.push(oUpdateCmd);

    return aDisposables;
}

module.exports = {
    registerFlowCommands: registerFlowCommands
};
