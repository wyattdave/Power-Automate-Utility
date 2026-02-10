let vscode;
try {
    vscode = require("vscode");
} catch (e) {
    // Running in test/node environment where 'vscode' is not available
    vscode = null;
}
const path = require("path");
const fs = require("fs");
const os = require("os");
const { getToken, clearToken, listFlows, getClientData, updateClientData, listEnvironmentVariables } = require("./dataverseClient");

/**
 * Prompt the user for the Power Platform environment URL. Shows saved environments for the current tenant if available.
 * @param {vscode.ExtensionContext} oContext
 * @returns {Promise<string|undefined>}
 */
function promptForEnvUrl(oContext) {
    const sStoredTenant = oContext.globalState.get("flowTenantId", "");
    const sPrompt = "Enter the Power Platform environment URL";

    const aSaved = getEnvListForTenant(oContext, sStoredTenant);
    if (aSaved && aSaved.length > 0) {
        const aItems = aSaved.map(function (s) {
            return { label: s };
        });
        aItems.push({ label: "Add new environment..." });

        return vscode.window.showQuickPick(aItems, {
            placeHolder: "Select an environment or add a new one",
            matchOnDescription: true
        }).then(function (oSelected) {
            if (!oSelected) {
                return undefined;
            }

            if (oSelected.label === "Add new environment...") {
                return vscode.window.showInputBox({
                    prompt: sPrompt,
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
                        const sTrim = sValue.replace(new RegExp("[/]+$", ""), "");
                        if (sStoredTenant) {
                            addEnvToTenantList(oContext, sStoredTenant, sTrim);
                        }
                        return sTrim;
                    }
                    return undefined;
                });
            }

            return oSelected.label;
        });
    }

    // No saved environments - prompt for new one
    return vscode.window.showInputBox({
        prompt: sPrompt,
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
            const sTrim = sValue.replace(new RegExp("[/]+$", ""), "");
            if (sStoredTenant) {
                addEnvToTenantList(oContext, sStoredTenant, sTrim);
            }
            return sTrim;
        }
        return undefined;
    });
}

/**
 * Prompt the user for their Entra ID tenant ID.
 * @returns {Promise<string|undefined>}
 */
function promptForTenantId(oContext) {
    const sStoredTenant = oContext.globalState.get("flowTenantId", "");

    return vscode.window.showInputBox({
        prompt: "Enter your Entra ID (Azure AD) Tenant ID or domain",
        placeHolder: "e.g., contoso.onmicrosoft.com or 12345678-abcd-...",
        value: sStoredTenant || undefined,
        ignoreFocusOut: true,
        validateInput: function (sValue) {
            if (!sValue || !sValue.trim()) {
                return "Tenant ID is required";
            }
            return null;
        }
    }).then(function (sValue) {
        if (sValue) {
            const sTrim = sValue.trim();
            // If tenant changed, clear saved environment list for previous tenant
            if (sStoredTenant && sStoredTenant !== sTrim) {
                oContext.globalState.update("flowEnvList_" + sStoredTenant, []);
            }
            oContext.globalState.update("flowTenantId", sTrim);
            return sTrim;
        }
        return undefined;
    });
}

/**
 * Get saved environment list for a tenant
 * @param {vscode.ExtensionContext} oContext
 * @param {string} sTenant
 * @returns {Array<string>}
 */
function getEnvListForTenant(oContext, sTenant) {
    if (!sTenant) {
        return [];
    }
    return oContext.globalState.get("flowEnvList_" + sTenant, []);
}

/**
 * Add an environment URL to a tenant's saved list
 * @param {vscode.ExtensionContext} oContext
 * @param {string} sTenant
 * @param {string} sEnvUrl
 */
function addEnvToTenantList(oContext, sTenant, sEnvUrl) {
    if (!sTenant || !sEnvUrl) {
        return;
    }
    const aList = getEnvListForTenant(oContext, sTenant);
    for (let i = 0; i < aList.length; i++) {
        if (aList[i] === sEnvUrl) {
            return;
        }
    }
    aList.push(sEnvUrl);
    oContext.globalState.update("flowEnvList_" + sTenant, aList);
}

/**
 * Clear saved environment list for a tenant
 * @param {vscode.ExtensionContext} oContext
 * @param {string} sTenant
 */
function clearEnvListForTenant(oContext, sTenant) {
    if (!sTenant) {
        return;
    }
    oContext.globalState.update("flowEnvList_" + sTenant, []);
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
        // Prompt for tenant first so we can show saved environments
        promptForTenantId(oContext).then(function (sTenantId) {
            if (!sTenantId) {
                return;
            }

            promptForEnvUrl(oContext).then(function (sEnvUrl) {
                if (!sEnvUrl) {
                    return;
                }

                // Persist the selected environment and tenant
                oContext.globalState.update("flowEnvUrl", sEnvUrl);
                oContext.globalState.update("flowTenantId", sTenantId);

                // Add the environment to the tenant's saved list
                addEnvToTenantList(oContext, sTenantId, sEnvUrl);

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
        const sStoredEnv = oContext.globalState.get("flowEnvUrl");
        const sStoredTenant = oContext.globalState.get("flowTenantId");

        const oDoList = function (sEnvUrl, sTenantId) {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Retrieving flows...",
                cancellable: false
            }, function () {
                return getToken(sEnvUrl, sTenantId).then(function (sToken) {
                    return Promise.all([
                        listFlows(sEnvUrl, sToken),
                        listEnvironmentVariables(sEnvUrl, sToken).catch(function () { return []; })
                    ]);
                }).then(function (aResults) {
                    const aFlows = aResults[0];
                    const aEnvVars = aResults[1];

                    // Store environment variables for use by the parameters completion provider
                    oContext.globalState.update("aEnvironmentVariables", aEnvVars);

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
            // Prompt for tenant first so we can show saved environments
            promptForTenantId(oContext).then(function (sTenantId) {
                if (!sTenantId) {
                    return;
                }
                promptForEnvUrl(oContext).then(function (sEnvUrl) {
                    if (!sEnvUrl) {
                        return;
                    }

                    // Persist selections and ensure the environment is saved for this tenant
                    oContext.globalState.update("flowEnvUrl", sEnvUrl);
                    oContext.globalState.update("flowTenantId", sTenantId);
                    addEnvToTenantList(oContext, sTenantId, sEnvUrl);

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
    registerFlowCommands: registerFlowCommands,
    // exported for unit testing
    promptForTenantId: promptForTenantId,
    promptForEnvUrl: promptForEnvUrl,
    getEnvListForTenant: getEnvListForTenant,
    addEnvToTenantList: addEnvToTenantList,
    clearEnvListForTenant: clearEnvListForTenant
};
