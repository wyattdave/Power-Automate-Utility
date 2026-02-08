# Flow IntelliSense

> **125 expression functions** — fully documented, autocompleted, and ready to use in your Logic App and Power Automate workflows.

---

## What It Does

Flow IntelliSense brings rich editing support for Azure Logic Apps and Power Automate expression functions directly into VS Code. Stop switching between the docs and your editor — get instant access to every function's syntax, parameters, return types, and examples right where you write your workflow definitions.

Works in `.json` files, `.jsonc` files, and **new untitled files** with no extension, ideal for quick copy and pasting in to Power Automate.

---

## Features

### Autocomplete

Type `@{` inside any JSON string value to instantly see all 125 expression functions. Each suggestion includes:

- The function's category (String, Math, Date/Time, etc.)
- A full parameter list showing required vs. optional parameters
- Smart snippet insertion with `Tab`-navigable placeholders for required parameters

```json
"inputs": "@{"   // <-- type @{ here to see all functions
```

### Hover Documentation

Hover over any function name to see a rich documentation popup with:

- Description of what the function does
- Full syntax block
- Parameter table with types and descriptions
- Return type and description
- Usage examples from the official Microsoft reference

### Signature Help

Type `(` after a function name or `,` between arguments to see:

- The full function signature
- Which parameter you're currently filling in (highlighted)
- Type and description for the active parameter

---

## Supported Functions — 125 Total

### String (15 functions)

`concat` · `endsWith` · `formatNumber` · `guid` · `indexOf` · `lastIndexOf` · `nthIndexOf` · `replace` · `slice` · `split` · `startsWith` · `substring` · `toLower` · `toUpper` · `trim`

### Collection (13 functions)

`chunk` · `contains` · `empty` · `first` · `intersection` · `join` · `last` · `length` · `reverse` · `skip` · `sort` · `take` · `union`

### Logical Comparison (11 functions)

`and` · `equals` · `greater` · `greaterOrEquals` · `if` · `isFloat` · `isInt` · `less` · `lessOrEquals` · `not` · `or`

### Conversion (23 functions)

`array` · `base64` · `base64ToBinary` · `base64ToString` · `binary` · `bool` · `createArray` · `dataUri` · `dataUriToBinary` · `dataUriToString` · `decimal` · `decodeBase64` · `decodeDataUri` · `decodeUriComponent` · `encodeUriComponent` · `float` · `int` · `json` · `string` · `uriComponent` · `uriComponentToBinary` · `uriComponentToString` · `xml`

### Math (9 functions)

`add` · `div` · `max` · `min` · `mod` · `mul` · `rand` · `range` · `sub`

### Date and Time (22 functions)

`addDays` · `addHours` · `addMinutes` · `addSeconds` · `addToTime` · `convertFromUtc` · `convertTimeZone` · `convertToUtc` · `dateDifference` · `dayOfMonth` · `dayOfWeek` · `dayOfYear` · `formatDateTime` · `getFutureTime` · `getPastTime` · `parseDateTime` · `startOfDay` · `startOfHour` · `startOfMonth` · `subtractFromTime` · `ticks` · `utcNow`

### Workflow (21 functions)

`action` · `actions` · `body` · `formDataMultiValues` · `formDataValue` · `item` · `items` · `iterationIndexes` · `listCallbackUrl` · `multipartBody` · `outputs` · `parameters` · `result` · `trigger` · `triggerBody` · `triggerFormDataMultiValues` · `triggerFormDataValue` · `triggerMultipartBody` · `triggerOutputs` · `variables` · `workflow`

### URI Parsing (6 functions)

`uriHost` · `uriPath` · `uriPathAndQuery` · `uriPort` · `uriQuery` · `uriScheme`

### Manipulation (5 functions)

`addProperty` · `coalesce` · `removeProperty` · `setProperty` · `xpath`

---

## Quick Start

1. **Install** the extension from the VS Code Marketplace
2. **Open** any `.json` file — such as a Logic App workflow definition
3. **Type** `@{` inside a string value to see function suggestions
4. **Select** a function — required parameters are inserted as snippet placeholders
5. **Press** `Tab` to jump between parameters
6. **Hover** over any function name to read its full documentation

Also works in **new untitled files** — just start typing, no file extension needed.

---

## Example Workflow

```json
{
    "actions": {
        "Compose": {
            "type": "Compose",
            "inputs": "@{concat('Hello', ' ', 'World')}"
        },
        "Get_future_time": {
            "type": "Compose",
            "inputs": "@{addDays(utcNow(), 7)}"
        },
        "Format_result": {
            "type": "Compose",
            "inputs": "@{formatNumber(add(1, 2), '0.00')}"
        },
        "Format_date": {
            "type": "Compose",
            "inputs": "@{formatDateTime(convertTimeZone(utcNow(),'UTC','Fiji Standard Time'),'d/M/yyyy')}"
        }
    }
}
```

Every `@{...}` expression in the example above gets full IntelliSense support.

---

## Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| `flowIntelliSense.referencePath` | Path to a custom `expression-functions-reference.md` file | Bundled or workspace copy |

---

## Commands

| Command | Description |
|---------|-------------|
| `Flow IntelliSense: Show Function Count` | Display how many expression functions are currently loaded |
| `Flow IntelliSense: View Skill File` | Open the SKILL.md file in a Markdown preview — shows the installed Copilot skill or the bundled source |
| `Flow IntelliSense: Delete Skill File` | Remove the SKILL.md file from the Copilot skills directory and reset the install flag |

### Copilot Skill (SKILL.md)

On first activation the extension automatically copies a `SKILL.md` file to `~/.copilot/skills/flow-intellisense/SKILL.md`. This file gives GitHub Copilot contextual knowledge of all 125 expression functions so it can assist with Power Automate and Logic App expressions. Use the **View Skill File** command to inspect it or **Delete Skill File** to remove it.

---

## Requirements

- VS Code **1.80.0** or later
- No additional dependencies — the extension is self-contained

---

## Data Source

Function definitions are parsed from the official [Microsoft Azure Logic Apps expression functions reference](https://learn.microsoft.com/en-us/azure/logic-apps/workflow-definition-language-functions-reference). The reference file is bundled with the extension and can be replaced with a custom version via the `flowIntelliSense.referencePath` setting.

---

## Development

```bash
# Clone the repo
git clone https://github.com/your-org/flow-intellisense.git

# Open in VS Code
code flow-intellisense

# Press F5 to launch the Extension Development Host

# Run parser tests
cd extension
node test/parserTest.js
```

### Building a VSIX

```bash
cd extension
npm install -g @vscode/vsce
vsce package
```

Install the `.vsix` via: **Extensions** > **...** > **Install from VSIX**

---

## Release Notes

### 0.1.0

- Initial release
- 125 expression functions across 9 categories
- Autocomplete with snippet parameter placeholders
- Hover documentation with syntax, parameters, return types, and examples
- Signature help with active parameter highlighting
- Support for `.json`, `.jsonc`, and untitled files

---

## License

MIT
