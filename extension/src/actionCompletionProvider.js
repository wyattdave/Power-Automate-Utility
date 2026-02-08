const vscode = require("vscode");

/**
 * Build a CompletionItemProvider for Power Automate action templates.
 * Triggers on "@@" pattern and shows available actions from actions.json.
 * @param {Object} oActions - parsed action definitions from actions.json
 * @returns {vscode.CompletionItemProvider}
 */
function createActionCompletionProvider(oActions) {
    return {
        provideCompletionItems: function (oDocument, oPosition, oToken, oContext) {
            const aItems = [];
            const oLineText = oDocument.lineAt(oPosition).text;
            const sTextBefore = oLineText.substring(0, oPosition.character);

            // Check if user typed @@ pattern
            const oMatch = sTextBefore.match(new RegExp("@@(\\w*)$"));
            if (!oMatch) {
                return aItems;
            }

            // Get the prefix after @@ for filtering
            const sPrefix = oMatch[1] || "";

            // Calculate the range to replace (from @@ to current position)
            const iStartChar = oPosition.character - oMatch[0].length;
            const oRange = new vscode.Range(
                new vscode.Position(oPosition.line, iStartChar),
                oPosition
            );

            // Get all action keys from the actions object
            const aActionKeys = Object.keys(oActions);

            for (let i = 0; i < aActionKeys.length; i++) {
                const sActionName = aActionKeys[i];
                const oAction = oActions[sActionName];

                // Filter by prefix if provided
                if (sPrefix && sActionName.toLowerCase().indexOf(sPrefix.toLowerCase()) === -1) {
                    continue;
                }

                const oItem = buildActionCompletionItem(sActionName, oAction, oRange);
                aItems.push(oItem);
            }

            return aItems;
        }
    };
}

/**
 * Build a single CompletionItem from an action definition
 * @param {string} sActionName - the action key name
 * @param {Object} oAction - the action definition object
 * @param {vscode.Range} oRange - the range to replace
 * @returns {vscode.CompletionItem}
 */
function buildActionCompletionItem(sActionName, oAction, oRange) {
    const oItem = new vscode.CompletionItem(
        sActionName,
        vscode.CompletionItemKind.Snippet
    );

    // Get the action type for detail
    const sType = oAction.type || "Action";
    oItem.detail = "[" + sType + "] " + sActionName;

    // Build documentation with a preview of the action
    const oMd = new vscode.MarkdownString();
    oMd.isTrusted = true;
    oMd.appendMarkdown("**" + sActionName + "**\n\n");
    oMd.appendMarkdown("Type: `" + sType + "`\n\n");
    oMd.appendMarkdown("**Preview:**\n");
    
    // Create a clean action object with the action name as key
    const oActionWithKey = {};
    oActionWithKey[sActionName] = oAction;
    const sPreview = JSON.stringify(oActionWithKey, null, 4);
    oMd.appendCodeblock(sPreview, "json");
    oItem.documentation = oMd;

    // Build the insert text - the full action JSON
    const oActionObj = {};
    oActionObj[sActionName] = oAction;
    const sInsertText = JSON.stringify(oActionObj, null, 4);
    oItem.insertText = sInsertText;

    // Set the range to replace (removes the @@ and any typed characters)
    oItem.range = oRange;

    // Sort by action name
    oItem.sortText = sActionName.toLowerCase();
    oItem.filterText = "@@" + sActionName;

    return oItem;
}

module.exports = { createActionCompletionProvider };
