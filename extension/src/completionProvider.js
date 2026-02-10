const vscode = require("vscode");

/**
 * Build a CompletionItemProvider for Logic App expression functions.
 * Triggers on "@" character and function name typing.
 * @param {Array<Object>} aFunctions - parsed function definitions
 * @returns {vscode.CompletionItemProvider}
 */
function createCompletionProvider(aFunctions) {
    return {
        provideCompletionItems: function (oDocument, oPosition, oToken, oContext) {
            const aItems = [];
            const oLineText = oDocument.lineAt(oPosition).text;
            const sTextBefore = oLineText.substring(0, oPosition.character);

            // Check if we are inside a string value in JSON (common place for @{} expressions)
            const bInString = isInsideJsonString(oDocument, oPosition);
            const bAfterAt = sTextBefore.indexOf("@") !== -1;
            const bAfterAtBrace = sTextBefore.indexOf("@{") !== -1;

            // Show completions if user typed @{ or @ or is inside a JSON string value
            if (!bInString && !bAfterAt) {
                return aItems;
            }

            // Detect if we are inside a nested expression so the @ can be stripped
            const bNested = isNestedExpression(sTextBefore);
            let oReplaceRange = null;
            if (bNested) {
                const iLastAt = sTextBefore.lastIndexOf("@");
                oReplaceRange = new vscode.Range(
                    oPosition.line, iLastAt,
                    oPosition.line, oPosition.character
                );
            }

            for (let i = 0; i < aFunctions.length; i++) {
                const oFunc = aFunctions[i];
                const oItem = buildCompletionItem(oFunc, bAfterAt, oReplaceRange);
                aItems.push(oItem);
            }

            return aItems;
        }
    };
}

/**
 * Build a single CompletionItem from a function definition
 * @param {Object} oFunc - function definition object
 * @param {boolean} bAfterAt - whether the trigger was an @ character
 * @param {vscode.Range|null} oReplaceRange - range including the @ to replace when nested
 * @returns {vscode.CompletionItem}
 */
function buildCompletionItem(oFunc, bAfterAt, oReplaceRange) {
    const oItem = new vscode.CompletionItem(
        oFunc.sName,
        vscode.CompletionItemKind.Function
    );

    oItem.detail = "[" + oFunc.sCategory + "] " + oFunc.sName + "(" + formatParamList(oFunc.aParameters) + ")";
    oItem.documentation = buildMarkdownDocs(oFunc);

    // For parameters(), insert plain text (no snippet) so triggerSuggest works
    if (oFunc.sName === "parameters") {
        oItem.insertText = "parameters(";
        oItem.command = {
            command: "editor.action.triggerSuggest",
            title: "Trigger Parameter Suggestions"
        };
    } else {
        // Build the insert text with snippet tabstops for parameters
        const sSnippet = buildSnippetString(oFunc);
        oItem.insertText = new vscode.SnippetString(sSnippet);
    }

    if (oFunc.bDeprecated) {
        oItem.tags = [vscode.CompletionItemTag.Deprecated];
    }

    // Sort by category then name
    oItem.sortText = oFunc.sCategory + "_" + oFunc.sName;
    oItem.filterText = oFunc.sName;

    // When inside a nested expression, replace from the @ so it is stripped
    if (oReplaceRange) {
        oItem.filterText = "@" + oFunc.sName;
        oItem.range = oReplaceRange;
    }

    return oItem;
}

/**
 * Build a snippet string with tabstops for function parameters.
 * Wraps the expression in @{...} for proper Logic App interpolation.
 * @param {Object} oFunc
 * @returns {string}
 */
function buildSnippetString(oFunc) {
    let sInner;
    if (oFunc.aParameters.length === 0) {
        sInner = oFunc.sName + "()";
    } else {
        const aSnippetParams = [];
        let iTabStop = 1;

        for (let i = 0; i < oFunc.aParameters.length; i++) {
            const oParam = oFunc.aParameters[i];
            if (oParam.bRequired) {
                aSnippetParams.push("${" + iTabStop + ":" + oParam.sName + "}");
                iTabStop++;
            }
        }

        // If no required params, add a single tabstop
        if (aSnippetParams.length === 0) {
            sInner = oFunc.sName + "(${1:})";
        } else {
            sInner = oFunc.sName + "(" + aSnippetParams.join(", ") + ")";
        }
    }

    return sInner;
}

/**
 * Format the parameter list as a readable string
 * @param {Array<Object>} aParams
 * @returns {string}
 */
function formatParamList(aParams) {
    const aParts = [];
    for (let i = 0; i < aParams.length; i++) {
        const oParam = aParams[i];
        let sPart = oParam.sName;
        if (!oParam.bRequired) {
            sPart = sPart + "?";
        }
        aParts.push(sPart);
    }
    return aParts.join(", ");
}

/**
 * Build a MarkdownString for the documentation popup
 * @param {Object} oFunc
 * @returns {vscode.MarkdownString}
 */
function buildMarkdownDocs(oFunc) {
    const oMd = new vscode.MarkdownString();
    oMd.isTrusted = true;

    oMd.appendMarkdown("**" + oFunc.sName + "**");
    if (oFunc.bDeprecated) {
        oMd.appendMarkdown(" _(deprecated)_");
    }
    oMd.appendMarkdown("\n\n");
    oMd.appendMarkdown(oFunc.sDescription + "\n\n");

    if (oFunc.sSyntax) {
        oMd.appendCodeblock(oFunc.sSyntax, "plaintext");
    }

    if (oFunc.aParameters.length > 0) {
        oMd.appendMarkdown("\n**Parameters:**\n\n");
        for (let i = 0; i < oFunc.aParameters.length; i++) {
            const oParam = oFunc.aParameters[i];
            const sReq = oParam.bRequired ? "required" : "optional";
            oMd.appendMarkdown("- `" + oParam.sName + "` (" + oParam.sType + ", " + sReq + "): " + oParam.sDescription + "\n");
        }
    }

    if (oFunc.sReturnType) {
        oMd.appendMarkdown("\n**Returns:** " + oFunc.sReturnType + " — " + oFunc.sReturnDescription + "\n");
    }

    if (oFunc.aExamples.length > 0) {
        oMd.appendMarkdown("\n**Examples:**\n");
        for (let e = 0; e < oFunc.aExamples.length; e++) {
            oMd.appendCodeblock(oFunc.aExamples[e], "plaintext");
        }
    }

    return oMd;
}

/**
 * Determine whether the cursor is inside an already-opened expression.
 * This is true when an earlier @ has opened parentheses or @{} braces
 * that have not yet been closed.
 * @param {string} sTextBefore - text on the line before the cursor
 * @returns {boolean}
 */
function isNestedExpression(sTextBefore) {
    let sCheck = sTextBefore;
    // Remove trailing @ (the one that just triggered the completion)
    if (sCheck.endsWith("@")) {
        sCheck = sCheck.substring(0, sCheck.length - 1);
    }

    let iAtIndex = sCheck.indexOf("@");
    if (iAtIndex === -1) {
        return false;
    }

    // Walk from the first @ and track open parens / @{} braces
    let iParenDepth = 0;
    let iAtBraceDepth = 0;
    for (let i = iAtIndex; i < sCheck.length; i++) {
        if (sCheck[i] === "@" && i + 1 < sCheck.length && sCheck[i + 1] === "{") {
            iAtBraceDepth++;
            i++; // skip the {
        } else if (sCheck[i] === "}" && iAtBraceDepth > 0) {
            iAtBraceDepth--;
        } else if (sCheck[i] === "(") {
            iParenDepth++;
        } else if (sCheck[i] === ")") {
            iParenDepth--;
        }
    }

    return iParenDepth > 0 || iAtBraceDepth > 0;
}

/**
 * Check if the cursor position is inside a JSON string value
 * @param {vscode.TextDocument} oDocument
 * @param {vscode.Position} oPosition
 * @returns {boolean}
 */
function isInsideJsonString(oDocument, oPosition) {
    const sLineText = oDocument.lineAt(oPosition).text;
    const sTextBefore = sLineText.substring(0, oPosition.character);

    // Count unescaped quotes before cursor
    let iQuoteCount = 0;
    for (let i = 0; i < sTextBefore.length; i++) {
        if (sTextBefore[i] === '"' && (i === 0 || sTextBefore[i - 1] !== "\\")) {
            iQuoteCount++;
        }
    }

    // Odd number of quotes means we're inside a string
    return iQuoteCount % 2 === 1;
}

module.exports = { createCompletionProvider };
