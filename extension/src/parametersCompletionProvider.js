const vscode = require("vscode");

/**
 * Build a CompletionItemProvider for @parameters('...') expressions.
 * When the user types @parameters( inside a JSON string, this provider
 * lists the environment variables fetched from Dataverse.
 * Selected items insert: '<DisplayName> (<SchemaName>') after the opening paren
 * @param {vscode.ExtensionContext} oContext - extension context for reading stored env vars
 * @returns {vscode.CompletionItemProvider}
 */
function createParametersCompletionProvider(oContext) {
    return {
        provideCompletionItems: function (oDocument, oPosition) {
            const aItems = [];
            const oLineText = oDocument.lineAt(oPosition).text;
            const sTextBefore = oLineText.substring(0, oPosition.character);

            // Check if the cursor is inside @parameters(...) or parameters(...)
            const oMatch = new RegExp("@?parameters\\($|@?parameters\\('?([^)']*)$").exec(sTextBefore);
            if (!oMatch) {
                return aItems;
            }

            // Find where the argument content starts (right after the opening paren)
            const sMatched = oMatch[0];
            const iParenPos = oMatch.index + sMatched.indexOf("(");
            const iArgStart = iParenPos + 1;

            // Also check if there is a quote right after the paren
            let iContentStart = iArgStart;
            if (iContentStart < sTextBefore.length && sTextBefore.charAt(iContentStart) === "'") {
                iContentStart = iContentStart + 1;
            }

            // Consume text after cursor up to closing quote+paren
            const sTextAfter = oLineText.substring(oPosition.character);
            let iEndChar = oPosition.character;
            const oEndMatch = new RegExp("^[^)']*'?\\)").exec(sTextAfter);
            if (oEndMatch) {
                iEndChar = oPosition.character + oEndMatch[0].length;
            }

            // Range covers from after the opening paren to the closing paren
            const oReplaceRange = new vscode.Range(
                new vscode.Position(oPosition.line, iArgStart),
                new vscode.Position(oPosition.line, iEndChar)
            );

            // Read environment variables from global state
            const aEnvVars = oContext.globalState.get("aEnvironmentVariables", []);

            if (aEnvVars.length === 0) {
                return aItems;
            }

            for (let i = 0; i < aEnvVars.length; i++) {
                const oVar = aEnvVars[i];
                const oItem = buildParameterCompletionItem(oVar, oReplaceRange);
                aItems.push(oItem);
            }

            return aItems;
        }
    };
}

/**
 * Build a single CompletionItem for an environment variable parameter.
 * Inserts the argument portion: '<DisplayName> (<SchemaName>')
 * @param {Object} oVar - environment variable definition {sName, sDisplayName, sType}
 * @param {vscode.Range} oReplaceRange - range to replace (inside the parens)
 * @returns {vscode.CompletionItem}
 */
function buildParameterCompletionItem(oVar, oReplaceRange) {
    const sLabel = oVar.sDisplayName + " (" + oVar.sName + ")";
    const oItem = new vscode.CompletionItem(
        sLabel,
        vscode.CompletionItemKind.Variable
    );

    // Insert only the argument: '<DisplayName> (<SchemaName>')
    const sInsertText = "'" + oVar.sDisplayName + " (" + oVar.sName + ")')";
    oItem.insertText = sInsertText;

    oItem.detail = "[Environment Variable] " + oVar.sDisplayName;

    // Build documentation
    const oMd = new vscode.MarkdownString();
    oMd.isTrusted = true;
    oMd.appendMarkdown("**" + oVar.sDisplayName + "**\n\n");
    oMd.appendMarkdown("Schema Name: `" + oVar.sName + "`\n\n");
    if (oVar.sType !== undefined && oVar.sType !== null) {
        const sTypeLabel = getVariableTypeLabel(oVar.sType);
        oMd.appendMarkdown("Type: " + sTypeLabel + "\n\n");
    }
    oMd.appendMarkdown("**Inserts:**\n");
    oMd.appendCodeblock("parameters('" + oVar.sDisplayName + " (" + oVar.sName + ")')", "plaintext");
    oItem.documentation = oMd;

    oItem.range = oReplaceRange;
    oItem.sortText = oVar.sDisplayName.toLowerCase();
    oItem.filterText = oVar.sDisplayName + " " + oVar.sName;

    return oItem;
}

/**
 * Get a human-readable label for the environment variable type code.
 * @param {number} iType - the type code from Dataverse
 * @returns {string}
 */
function getVariableTypeLabel(iType) {
    const oTypes = {
        100000000: "String",
        100000001: "Number",
        100000002: "Boolean",
        100000003: "JSON",
        100000004: "Data Source",
        100000005: "Secret"
    };
    return oTypes[iType] || "Type " + iType;
}

module.exports = { createParametersCompletionProvider };
