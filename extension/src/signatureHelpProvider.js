const vscode = require("vscode");

/**
 * Build a SignatureHelpProvider for Logic App expression functions.
 * Shows parameter hints when typing inside function parentheses.
 * @param {Array<Object>} aFunctions - parsed function definitions
 * @returns {vscode.SignatureHelpProvider}
 */
function createSignatureHelpProvider(aFunctions) {
    // Build a lookup map for fast access
    const oFuncMap = {};
    for (let i = 0; i < aFunctions.length; i++) {
        oFuncMap[aFunctions[i].sName.toLowerCase()] = aFunctions[i];
    }

    return {
        provideSignatureHelp: function (oDocument, oPosition, oToken, oContext) {
            const sLineText = oDocument.lineAt(oPosition).text;
            const sTextBefore = sLineText.substring(0, oPosition.character);

            // Find the function name by walking backwards from cursor to find the matching (
            const oCallInfo = findActiveFunctionCall(sTextBefore);
            if (!oCallInfo) {
                return null;
            }

            const oFunc = oFuncMap[oCallInfo.sFuncName.toLowerCase()];
            if (!oFunc) {
                return null;
            }

            const oSignatureHelp = new vscode.SignatureHelp();
            const oSignature = buildSignatureInfo(oFunc);
            oSignatureHelp.signatures = [oSignature];
            oSignatureHelp.activeSignature = 0;
            oSignatureHelp.activeParameter = oCallInfo.iActiveParam;

            return oSignatureHelp;
        }
    };
}

/**
 * Find the active function call context from text before cursor.
 * Returns the function name and which parameter index is active.
 * @param {string} sTextBefore
 * @returns {{ sFuncName: string, iActiveParam: number }|null}
 */
function findActiveFunctionCall(sTextBefore) {
    // Walk backwards to find the opening paren, tracking nesting
    let iParenDepth = 0;
    let iCommaCount = 0;
    let iOpenParenPos = -1;

    for (let i = sTextBefore.length - 1; i >= 0; i--) {
        const sChar = sTextBefore[i];
        if (sChar === ")") {
            iParenDepth++;
        } else if (sChar === "(") {
            if (iParenDepth === 0) {
                iOpenParenPos = i;
                break;
            }
            iParenDepth--;
        } else if (sChar === "," && iParenDepth === 0) {
            iCommaCount++;
        }
    }

    if (iOpenParenPos < 0) {
        return null;
    }

    // Extract the function name before the (
    const sBeforeParen = sTextBefore.substring(0, iOpenParenPos);
    const oNameMatch = sBeforeParen.match(new RegExp("([a-zA-Z][a-zA-Z0-9]*)\\s*$", ""));
    if (!oNameMatch) {
        return null;
    }

    return {
        sFuncName: oNameMatch[1],
        iActiveParam: iCommaCount
    };
}

/**
 * Build a SignatureInformation for a function
 * @param {Object} oFunc
 * @returns {vscode.SignatureInformation}
 */
function buildSignatureInfo(oFunc) {
    const sLabel = oFunc.sName + "(" + formatSignatureParams(oFunc.aParameters) + ")";
    const oSignature = new vscode.SignatureInformation(sLabel, oFunc.sDescription);

    oSignature.parameters = [];
    for (let i = 0; i < oFunc.aParameters.length; i++) {
        const oParam = oFunc.aParameters[i];
        const sParamLabel = oParam.sName + (oParam.bRequired ? "" : "?");
        const sParamDoc = "(" + oParam.sType + ") " + oParam.sDescription;
        oSignature.parameters.push(
            new vscode.ParameterInformation(sParamLabel, sParamDoc)
        );
    }

    return oSignature;
}

/**
 * Format parameter list for signature label
 * @param {Array<Object>} aParams
 * @returns {string}
 */
function formatSignatureParams(aParams) {
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

module.exports = { createSignatureHelpProvider };
