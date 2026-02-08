const fs = require("fs");
const path = require("path");

/**
 * Parse the expression-functions-reference.md and extract function definitions.
 * Returns an array of function objects with name, description, syntax, parameters, returnType, returnDescription, category, and examples.
 * @param {string} sFilePath - path to the markdown file
 * @returns {Array<Object>} array of function definition objects
 */
function parseFunctionReference(sFilePath) {
    const sContent = fs.readFileSync(sFilePath, "utf8");
    const aLines = sContent.split("\n");
    const aFunctions = [];
    const oCategoryMap = buildCategoryMap(sContent);

    let iLineIndex = 0;
    const iLineCount = aLines.length;

    // Find the alphabetical list section
    const iAlphaStart = findAlphabeticalListStart(aLines);
    if (iAlphaStart < 0) {
        return aFunctions;
    }

    iLineIndex = iAlphaStart;

    while (iLineIndex < iLineCount) {
        const sLine = aLines[iLineIndex];

        // Detect function heading: ### functionName
        const oHeadingMatch = matchFunctionHeading(sLine);
        if (oHeadingMatch) {
            const oResult = extractFunctionBlock(aLines, iLineIndex, iLineCount, oCategoryMap);
            if (oResult.oFunc) {
                aFunctions.push(oResult.oFunc);
            }
            iLineIndex = oResult.iNextIndex;
        } else {
            iLineIndex++;
        }
    }

    return aFunctions;
}

/**
 * Find the line index where the alphabetical list section starts
 * @param {Array<string>} aLines
 * @returns {number}
 */
function findAlphabeticalListStart(aLines) {
    for (let i = 0; i < aLines.length; i++) {
        if (aLines[i].indexOf("alphabetical-list") !== -1 && aLines[i].indexOf("<a name=") !== -1) {
            return i;
        }
    }
    return 0;
}

/**
 * Match a line to see if it's a ### functionName heading
 * @param {string} sLine
 * @returns {Object|null}
 */
function matchFunctionHeading(sLine) {
    const oRegex = new RegExp("^### ([a-zA-Z][a-zA-Z0-9]*)\\s*(?:\\(.*\\))?\\s*$", "");
    const oMatch = sLine.match(oRegex);
    if (oMatch) {
        return { sName: oMatch[1] };
    }
    // Also match "### functionName (deprecated)" style  
    const oRegex2 = new RegExp("^### ([a-zA-Z][a-zA-Z0-9]*)\\s+\\(deprecated\\)", "i");
    const oMatch2 = sLine.match(oRegex2);
    if (oMatch2) {
        return { sName: oMatch2[1], bDeprecated: true };
    }
    return null;
}

/**
 * Extract a full function block starting at the heading line
 * @param {Array<string>} aLines
 * @param {number} iStartIndex
 * @param {number} iLineCount
 * @param {Object} oCategoryMap
 * @returns {{ oFunc: Object|null, iNextIndex: number }}
 */
function extractFunctionBlock(aLines, iStartIndex, iLineCount, oCategoryMap) {
    const oHeading = matchFunctionHeading(aLines[iStartIndex]);
    if (!oHeading) {
        return { oFunc: null, iNextIndex: iStartIndex + 1 };
    }

    const sName = oHeading.sName;
    const bDeprecated = oHeading.bDeprecated || false;

    // Skip known non-function headings
    const aSkipNames = ["Base64", "Implicit", "Considerations"];
    if (aSkipNames.indexOf(sName) !== -1) {
        return { oFunc: null, iNextIndex: iStartIndex + 1 };
    }

    // Find the end of this function block (next ### or ## heading, or EOF)
    let iEndIndex = iStartIndex + 1;
    while (iEndIndex < iLineCount) {
        const sCheckLine = aLines[iEndIndex];
        if (new RegExp("^##[#]? [A-Za-z]", "").test(sCheckLine) && iEndIndex > iStartIndex + 1) {
            break;
        }
        iEndIndex++;
    }

    const aBlock = aLines.slice(iStartIndex + 1, iEndIndex);
    const sDescription = extractDescription(aBlock);
    const sSyntax = extractSyntax(aBlock);
    const aParameters = extractParameters(aBlock);
    const oReturnInfo = extractReturnInfo(aBlock);
    const aExamples = extractExamples(aBlock);
    const sCategory = oCategoryMap[sName] || "Other";

    const oFunc = {
        sName: sName,
        sDescription: sDescription,
        sSyntax: sSyntax,
        aParameters: aParameters,
        sReturnType: oReturnInfo.sType,
        sReturnDescription: oReturnInfo.sDescription,
        sCategory: sCategory,
        aExamples: aExamples,
        bDeprecated: bDeprecated
    };

    return { oFunc: oFunc, iNextIndex: iEndIndex };
}

/**
 * Build a map of functionName -> category from the table sections at the top
 * @param {string} sContent
 * @returns {Object}
 */
function buildCategoryMap(sContent) {
    const oMap = {};
    const aCategoryDefs = [
        { sLabel: "String", oRegex: new RegExp("## String functions", "i") },
        { sLabel: "Collection", oRegex: new RegExp("## Collection functions", "i") },
        { sLabel: "Logical comparison", oRegex: new RegExp("## Logical comparison functions", "i") },
        { sLabel: "Conversion", oRegex: new RegExp("## Conversion functions", "i") },
        { sLabel: "Math", oRegex: new RegExp("## Math functions", "i") },
        { sLabel: "Date and time", oRegex: new RegExp("## Date and time functions", "i") },
        { sLabel: "Workflow", oRegex: new RegExp("## Workflow functions", "i") },
        { sLabel: "URI parsing", oRegex: new RegExp("## URI parsing functions", "i") },
        { sLabel: "Manipulation", oRegex: new RegExp("## Manipulation functions", "i") }
    ];

    const aLines = sContent.split("\n");
    let sCurrentCategory = "";

    for (let i = 0; i < aLines.length; i++) {
        const sLine = aLines[i];

        // Check if this line starts a new category section
        for (let c = 0; c < aCategoryDefs.length; c++) {
            if (aCategoryDefs[c].oRegex.test(sLine)) {
                sCurrentCategory = aCategoryDefs[c].sLabel;
                break;
            }
        }

        // Stop parsing categories once we reach the alphabetical list
        if (sLine.indexOf("alphabetical-list") !== -1 && sLine.indexOf("<a name=") !== -1) {
            break;
        }

        // Extract function names from table rows: | [funcName](...) | description |
        if (sCurrentCategory && sLine.indexOf("|") !== -1) {
            const oFuncNameMatch = sLine.match(new RegExp("\\| \\[([a-zA-Z][a-zA-Z0-9]*)\\]", ""));
            if (oFuncNameMatch) {
                oMap[oFuncNameMatch[1]] = sCurrentCategory;
            }
        }
    }

    return oMap;
}

/**
 * Extract the description text from a function block
 * @param {Array<string>} aBlock
 * @returns {string}
 */
function extractDescription(aBlock) {
    const aDescLines = [];
    let bStarted = false;

    for (let i = 0; i < aBlock.length; i++) {
        const sLine = aBlock[i].trim();

        // Skip anchor tags, empty lines at the start, and note blocks
        if (!bStarted) {
            if (sLine === "" || sLine.indexOf("<a name=") !== -1) {
                continue;
            }
            if (sLine.indexOf("```") !== -1) {
                break;
            }
            if (sLine.indexOf("| Parameter") !== -1 || sLine.indexOf("| Return") !== -1) {
                break;
            }
            if (sLine.indexOf("> [!NOTE]") !== -1) {
                // Skip the note block
                i = skipNoteBlock(aBlock, i);
                continue;
            }
            bStarted = true;
        }

        if (bStarted) {
            if (sLine.indexOf("```") !== -1) {
                break;
            }
            if (sLine.indexOf("| Parameter") !== -1 || sLine.indexOf("| Return") !== -1) {
                break;
            }
            if (sLine === "") {
                // Check if next non-empty line is a code block or table
                let iNext = findNextNonEmpty(aBlock, i + 1);
                if (iNext >= 0 && (aBlock[iNext].trim().indexOf("```") !== -1 || aBlock[iNext].trim().indexOf("| ") !== -1)) {
                    break;
                }
                if (aDescLines.length > 0) {
                    aDescLines.push("");
                }
                continue;
            }
            aDescLines.push(sLine);
        }
    }

    return cleanMarkdown(aDescLines.join(" ").trim());
}

/**
 * Skip past a > [!NOTE] block
 * @param {Array<string>} aBlock
 * @param {number} iStart
 * @returns {number}
 */
function skipNoteBlock(aBlock, iStart) {
    let i = iStart + 1;
    while (i < aBlock.length) {
        const sLine = aBlock[i].trim();
        if (sLine.indexOf(">") !== 0 && sLine !== "") {
            return i - 1;
        }
        if (sLine === "" && i + 1 < aBlock.length && aBlock[i + 1].trim().indexOf(">") !== 0) {
            return i;
        }
        i++;
    }
    return i - 1;
}

/**
 * Find the next non-empty line index
 * @param {Array<string>} aBlock
 * @param {number} iStart
 * @returns {number}
 */
function findNextNonEmpty(aBlock, iStart) {
    for (let i = iStart; i < aBlock.length; i++) {
        if (aBlock[i].trim() !== "") {
            return i;
        }
    }
    return -1;
}

/**
 * Extract the syntax from a function block (first code block)
 * @param {Array<string>} aBlock
 * @returns {string}
 */
function extractSyntax(aBlock) {
    let bInCode = false;
    const aSyntaxLines = [];

    for (let i = 0; i < aBlock.length; i++) {
        const sLine = aBlock[i].trim();

        if (sLine.indexOf("```") !== -1 && !bInCode) {
            bInCode = true;
            continue;
        }
        if (sLine.indexOf("```") !== -1 && bInCode) {
            break;
        }
        if (bInCode) {
            aSyntaxLines.push(aBlock[i].trim());
        }
    }

    return aSyntaxLines.join("\n").trim();
}

/**
 * Extract parameters from the parameter table
 * @param {Array<string>} aBlock
 * @returns {Array<Object>}
 */
function extractParameters(aBlock) {
    const aParams = [];
    let bInParamTable = false;
    let iHeaderRowsSeen = 0;

    for (let i = 0; i < aBlock.length; i++) {
        const sLine = aBlock[i].trim();

        if (sLine.indexOf("| Parameter") !== -1) {
            bInParamTable = true;
            iHeaderRowsSeen = 0;
            continue;
        }

        if (bInParamTable) {
            // Skip the separator row (| --- | --- | ...)
            if (sLine.indexOf("| ---") !== -1) {
                iHeaderRowsSeen++;
                continue;
            }

            // End of table
            if (sLine === "" || (sLine.indexOf("|") === -1 && sLine.indexOf("| Return") === -1)) {
                // Check if next table is the return value table
                break;
            }
            if (sLine.indexOf("| Return") !== -1) {
                break;
            }

            // Parse parameter row
            const oParam = parseTableRow(sLine);
            if (oParam) {
                // parseTableRow can return an array for combined params
                if (Array.isArray(oParam)) {
                    for (let p = 0; p < oParam.length; p++) {
                        aParams.push(oParam[p]);
                    }
                } else {
                    aParams.push(oParam);
                }
            }
        }
    }

    return aParams;
}

/**
 * Parse a markdown table row into one or more parameter objects.
 * Some rows combine multiple params like "<*summand_1*>, <*summand_2*>"
 * @param {string} sRow
 * @returns {Object|Array<Object>|null}
 */
function parseTableRow(sRow) {
    const aCells = sRow.split("|").filter(function (s) { return s.trim() !== ""; });
    if (aCells.length >= 4) {
        const sRawName = aCells[0].trim();
        const sRequired = aCells[1].trim();
        const sType = aCells[2].trim();
        const sDescription = cleanMarkdown(aCells[3].trim());

        // Clean the parameter name: remove <*...*>, angle brackets, etc.
        const sCleanName = sRawName
            .replace(new RegExp("<\\*", "g"), "")
            .replace(new RegExp("\\*>", "g"), "")
            .replace(new RegExp("[<>]", "g"), "")
            .replace(new RegExp("\\*", "g"), "")
            .trim();

        // Check if this is a combined parameter row (e.g., "summand_1, summand_2")
        // but not a variadic "..." pattern
        const aNames = sCleanName.split(new RegExp(",\\s*", ""));
        if (aNames.length > 1 && sCleanName.indexOf("...") === -1) {
            const aResults = [];
            for (let n = 0; n < aNames.length; n++) {
                const sName = aNames[n].trim();
                if (sName !== "" && sName !== "...") {
                    aResults.push({
                        sName: sName,
                        bRequired: sRequired === "Yes",
                        sType: sType,
                        sDescription: sDescription
                    });
                }
            }
            return aResults;
        }

        return {
            sName: sCleanName,
            bRequired: sRequired === "Yes",
            sType: sType,
            sDescription: sDescription
        };
    }
    return null;
}

/**
 * Extract return value info from the return value table
 * @param {Array<string>} aBlock
 * @returns {{ sType: string, sDescription: string }}
 */
function extractReturnInfo(aBlock) {
    let bInReturnTable = false;

    for (let i = 0; i < aBlock.length; i++) {
        const sLine = aBlock[i].trim();

        if (sLine.indexOf("| Return value") !== -1 || sLine.indexOf("| Return Value") !== -1) {
            bInReturnTable = true;
            continue;
        }

        if (bInReturnTable) {
            if (sLine.indexOf("| ---") !== -1) {
                continue;
            }
            if (sLine.indexOf("|") !== -1) {
                const aCells = sLine.split("|").filter(function (s) { return s.trim() !== ""; });
                if (aCells.length >= 3) {
                    return {
                        sType: cleanMarkdown(aCells[1].trim()),
                        sDescription: cleanMarkdown(aCells[2].trim())
                    };
                }
            }
            break;
        }
    }

    return { sType: "", sDescription: "" };
}

/**
 * Extract examples from a function block
 * @param {Array<string>} aBlock
 * @returns {Array<string>}
 */
function extractExamples(aBlock) {
    const aExamples = [];
    let bFoundExampleHeader = false;
    let bInCode = false;
    let iCodeBlockCount = 0;
    const aCurrentExample = [];

    for (let i = 0; i < aBlock.length; i++) {
        const sLine = aBlock[i].trim();

        if (sLine.indexOf("*Example") !== -1) {
            bFoundExampleHeader = true;
            iCodeBlockCount = 0;
            continue;
        }

        if (bFoundExampleHeader) {
            if (sLine.indexOf("```") !== -1 && !bInCode) {
                bInCode = true;
                continue;
            }
            if (sLine.indexOf("```") !== -1 && bInCode) {
                bInCode = false;
                iCodeBlockCount++;
                if (iCodeBlockCount === 1 && aCurrentExample.length > 0) {
                    aExamples.push(aCurrentExample.join("\n"));
                    aCurrentExample.length = 0;
                }
                continue;
            }
            if (bInCode && iCodeBlockCount === 0) {
                aCurrentExample.push(aBlock[i].trim());
            }
        }
    }

    return aExamples;
}

/**
 * Strip markdown formatting from text
 * @param {string} sText
 * @returns {string}
 */
function cleanMarkdown(sText) {
    return sText
        .replace(new RegExp("\\[([^\\]]+)\\]\\([^)]+\\)", "g"), "$1")
        .replace(new RegExp("<br\\s*/?>", "gi"), " ")
        .replace(new RegExp("<[^>]+>", "g"), "")
        .replace(new RegExp("\\*\\*([^*]+)\\*\\*", "g"), "$1")
        .replace(new RegExp("\\*([^*]+)\\*", "g"), "$1")
        .replace(new RegExp("`([^`]+)`", "g"), "$1")
        .replace(new RegExp("\\s+", "g"), " ")
        .trim();
}

module.exports = { parseFunctionReference };
