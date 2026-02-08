/**
 * Test script for the parser module.
 * Run with: node test/parserTest.js
 */
const path = require("path");
const { parseFunctionReference } = require("../src/parser");

const sRefPath = path.join(__dirname, "..", "expression-functions-reference.md");
let iTotalTests = 0;
let iPassedTests = 0;

function assert(bCondition, sMessage) {
    iTotalTests++;
    if (bCondition) {
        iPassedTests++;
        console.log("  PASS: " + sMessage);
    } else {
        console.log("  FAIL: " + sMessage);
    }
}

console.log("Parsing reference file...");
const aFunctions = parseFunctionReference(sRefPath);

console.log("\n--- Basic Parsing Tests ---");
assert(aFunctions.length > 100, "Should parse over 100 functions (got " + aFunctions.length + ")");
assert(aFunctions.length <= 150, "Should parse fewer than 150 functions (got " + aFunctions.length + ")");

console.log("\n--- Function Name Tests ---");
const aExpectedNames = [
    "action", "actions", "add", "addDays", "addHours", "addMinutes",
    "concat", "contains", "if", "guid", "json", "utcNow",
    "toLower", "toUpper", "trim", "replace", "split",
    "xpath", "xml", "workflow", "variables", "trigger"
];
for (let i = 0; i < aExpectedNames.length; i++) {
    const sName = aExpectedNames[i];
    const oFound = aFunctions.find(function (f) { return f.sName === sName; });
    assert(!!oFound, "Should find function: " + sName);
}

console.log("\n--- Category Tests ---");
const oCatCounts = {};
for (let i = 0; i < aFunctions.length; i++) {
    const sCat = aFunctions[i].sCategory;
    oCatCounts[sCat] = (oCatCounts[sCat] || 0) + 1;
}
const aExpectedCategories = ["String", "Collection", "Math", "Date and time", "Workflow", "Conversion", "Logical comparison", "URI parsing", "Manipulation"];
for (let c = 0; c < aExpectedCategories.length; c++) {
    assert(!!oCatCounts[aExpectedCategories[c]], "Should have category: " + aExpectedCategories[c] + " (count: " + (oCatCounts[aExpectedCategories[c]] || 0) + ")");
}

console.log("\n--- Parameter Tests ---");
const oAddFunc = aFunctions.find(function (f) { return f.sName === "add"; });
assert(oAddFunc.aParameters.length === 2, "add() should have 2 params (got " + oAddFunc.aParameters.length + ")");
assert(oAddFunc.aParameters[0].sName === "summand_1", "add() first param should be summand_1");
assert(oAddFunc.aParameters[0].bRequired === true, "add() first param should be required");

const oIfFunc = aFunctions.find(function (f) { return f.sName === "if"; });
assert(oIfFunc.aParameters.length === 3, "if() should have 3 params (got " + oIfFunc.aParameters.length + ")");

const oGuidFunc = aFunctions.find(function (f) { return f.sName === "guid"; });
assert(oGuidFunc.aParameters.length === 1, "guid() should have 1 param (got " + oGuidFunc.aParameters.length + ")");
assert(oGuidFunc.aParameters[0].bRequired === false, "guid() format param should be optional");

const oAddDays = aFunctions.find(function (f) { return f.sName === "addDays"; });
assert(oAddDays.aParameters.length === 3, "addDays() should have 3 params (got " + oAddDays.aParameters.length + ")");

console.log("\n--- Syntax Tests ---");
assert(oAddFunc.sSyntax.indexOf("add(") !== -1, "add() syntax should contain 'add('");
assert(oGuidFunc.sSyntax.indexOf("guid()") !== -1, "guid() syntax should contain 'guid()'");
assert(oAddDays.sSyntax.indexOf("addDays(") !== -1, "addDays() syntax should contain 'addDays('");

console.log("\n--- Return Value Tests ---");
assert(oAddFunc.sReturnType !== "", "add() should have a return type");
assert(oIfFunc.sReturnType !== "", "if() should have a return type");

console.log("\n--- Description Tests ---");
assert(oAddFunc.sDescription.length > 10, "add() should have a description");
assert(oGuidFunc.sDescription.length > 10, "guid() should have a description");

console.log("\n--- Example Tests ---");
assert(oAddFunc.aExamples.length > 0, "add() should have examples (got " + oAddFunc.aExamples.length + ")");
assert(oAddDays.aExamples.length >= 2, "addDays() should have at least 2 examples (got " + oAddDays.aExamples.length + ")");

console.log("\n=======================================");
console.log("Results: " + iPassedTests + "/" + iTotalTests + " tests passed");
if (iPassedTests === iTotalTests) {
    console.log("All tests passed!");
} else {
    console.log((iTotalTests - iPassedTests) + " test(s) FAILED");
    process.exit(1);
}
