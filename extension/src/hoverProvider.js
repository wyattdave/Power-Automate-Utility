const vscode = require("vscode");

/**
 * Build a HoverProvider for Logic App expression functions.
 * Shows documentation when hovering over a function name.
 * @param {Array<Object>} aFunctions - parsed function definitions
 * @returns {vscode.HoverProvider}
 */
function createHoverProvider(aFunctions) {
    // Build a lookup map for fast access
    const oFuncMap = {};
    for (let i = 0; i < aFunctions.length; i++) {
        oFuncMap[aFunctions[i].sName.toLowerCase()] = aFunctions[i];
    }

    return {
        provideHover: function (oDocument, oPosition, oToken) {
            const oWordRange = oDocument.getWordRangeAtPosition(oPosition, new RegExp("[a-zA-Z][a-zA-Z0-9]*", ""));
            if (!oWordRange) {
                return null;
            }

            const sWord = oDocument.getText(oWordRange);
            const oFunc = oFuncMap[sWord.toLowerCase()];
            if (!oFunc) {
                return null;
            }

            // Verify it's likely a function call context - check for @ or ( nearby
            const sLineText = oDocument.lineAt(oPosition).text;
            const iWordEnd = oWordRange.end.character;
            const iWordStart = oWordRange.start.character;

            const bHasParenAfter = iWordEnd < sLineText.length && sLineText[iWordEnd] === "(";
            const bHasAtBefore = iWordStart > 0 && sLineText[iWordStart - 1] === "@";
            const bHasAtBraceBefore = iWordStart > 1 && sLineText.substring(iWordStart - 2, iWordStart) === "@{";
            const bInsideAtBraceBlock = isInsideAtBraceBlock(sLineText, iWordStart);
            const bInsideString = isInString(sLineText, iWordStart);

            if (!bHasParenAfter && !bHasAtBefore && !bHasAtBraceBefore && !bInsideAtBraceBlock && !bInsideString) {
                return null;
            }

            const oMd = buildHoverMarkdown(oFunc);
            return new vscode.Hover(oMd, oWordRange);
        }
    };
}

/**
 * Build the markdown content for hover display
 * @param {Object} oFunc
 * @returns {vscode.MarkdownString}
 */
function buildHoverMarkdown(oFunc) {
    const oMd = new vscode.MarkdownString();
    oMd.isTrusted = true;

    // Header with category badge
    oMd.appendMarkdown("### " + oFunc.sName);
    if (oFunc.bDeprecated) {
        oMd.appendMarkdown(" ~~deprecated~~");
    }
    oMd.appendMarkdown("  \n");
    oMd.appendMarkdown("_Category: " + oFunc.sCategory + "_\n\n");

    // Description
    oMd.appendMarkdown(oFunc.sDescription + "\n\n");

    // Syntax
    if (oFunc.sSyntax) {
        oMd.appendMarkdown("**Syntax:**\n");
        oMd.appendCodeblock(oFunc.sSyntax, "plaintext");
    }

    // Parameters
    if (oFunc.aParameters.length > 0) {
        oMd.appendMarkdown("\n**Parameters:**\n\n");
        oMd.appendMarkdown("| Name | Required | Type | Description |\n");
        oMd.appendMarkdown("| --- | --- | --- | --- |\n");
        for (let i = 0; i < oFunc.aParameters.length; i++) {
            const oParam = oFunc.aParameters[i];
            const sReq = oParam.bRequired ? "Yes" : "No";
            oMd.appendMarkdown("| " + oParam.sName + " | " + sReq + " | " + oParam.sType + " | " + oParam.sDescription + " |\n");
        }
    }

    // Return value
    if (oFunc.sReturnType) {
        oMd.appendMarkdown("\n**Returns:** `" + oFunc.sReturnType + "` — " + oFunc.sReturnDescription + "\n");
    }

    // Examples
    if (oFunc.aExamples.length > 0) {
        oMd.appendMarkdown("\n**Examples:**\n");
        for (let e = 0; e < oFunc.aExamples.length; e++) {
            oMd.appendCodeblock(oFunc.aExamples[e], "plaintext");
        }
    }

    return oMd;
}

/**
 * Basic check if a position is inside a string in a line
 * @param {string} sLineText
 * @param {number} iPos
 * @returns {boolean}
 */
function isInString(sLineText, iPos) {
    let iQuoteCount = 0;
    for (let i = 0; i < iPos; i++) {
        if (sLineText[i] === '"' && (i === 0 || sLineText[i - 1] !== "\\")) {
            iQuoteCount++;
        }
    }
    return iQuoteCount % 2 === 1;
}

/**
 * Check if a position is inside an @{...} expression block
 * @param {string} sLineText
 * @param {number} iPos
 * @returns {boolean}
 */
function isInsideAtBraceBlock(sLineText, iPos) {
    // Walk backwards from iPos to find @{ without a closing }
    let i = iPos - 1;
    while (i >= 0) {
        if (sLineText[i] === "}" ) {
            return false;
        }
        if (sLineText[i] === "{" && i > 0 && sLineText[i - 1] === "@") {
            return true;
        }
        i--;
    }
    return false;
}

module.exports = { createHoverProvider };
