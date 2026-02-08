---
name: flow-intellisense
description: Power Automate and Azure Logic Apps expression functions reference. Use this skill when working with Logic Apps or Power Automate workflow expressions, including string, collection, math, date, URI, manipulation, and logical functions.
---

# Power Automate & Azure Logic Apps Expression Functions Reference

This document provides a complete reference for expression functions available in Azure Logic Apps and Power Automate workflow expressions.

## Expression Syntax

- Functions in expressions: `@{functionName(parameter)}`
- Nested functions: `@{outerFunction(innerFunction(parameter))}`
- Property access: `@{functionName(parameter).propertyName}`
- Interpolated format (inline with text): `text @{functionName(parameter)} text`
- Parameters are evaluated left to right
- A `?` after a parameter means it is optional

## String Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| chunk | `chunk('<text>', <length>)` | Split a string into chunks of equal length |
| concat | `concat('<text1>', '<text2>', ...)` | Combine two or more strings. Max result: 104,857,600 chars |
| endsWith | `endsWith('<text>', '<searchText>')` | Check if string ends with substring (case-insensitive) |
| formatNumber | `formatNumber(<number>, '<format>', '<locale>'?)` | Format a number as a string |
| guid | `guid('<format>'?)` | Generate a GUID. Formats: "N", "D" (default), "B", "P", "X" |
| indexOf | `indexOf('<text>', '<searchText>')` | Return starting position of substring (case-insensitive, 0-based). Returns -1 if not found |
| isFloat | `isFloat('<string>', '<locale>'?)` | Check if string is a floating-point number |
| isInt | `isInt('<string>')` | Check if string is an integer |
| lastIndexOf | `lastIndexOf('<text>', '<searchText>')` | Return position of last occurrence of substring (case-insensitive, 0-based) |
| length | `length('<collection>')` | Return number of items in string or array |
| nthIndexOf | `nthIndexOf('<text>', '<searchText>', <occurrence>)` | Return position of nth occurrence of substring. Negative occurrence searches from end |
| replace | `replace('<text>', '<oldText>', '<newText>')` | Replace substring (case-sensitive) |
| slice | `slice('<text>', <startIndex>, <endIndex>?)` | Return substring by start/end position. Supports negative indices |
| split | `split('<text>', '<delimiter>')` | Split string into array by delimiter |
| startsWith | `startsWith('<text>', '<searchText>')` | Check if string starts with substring (case-insensitive) |
| substring | `substring('<text>', <startIndex>, <length>?)` | Return characters from specified position (0-based). startIndex + length must be <= string length |
| toLower | `toLower('<text>')` | Convert to lowercase |
| toUpper | `toUpper('<text>')` | Convert to uppercase |
| trim | `trim('<text>')` | Remove leading and trailing whitespace |

## Collection Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| chunk | `chunk([<collection>], <length>)` | Split array into chunks of equal length |
| contains | `contains('<collection>', '<value>')` | Check if collection has specific item (case-sensitive) |
| empty | `empty('<collection>')` | Check if collection is empty |
| first | `first('<collection>')` | Return first item |
| intersection | `intersection([<coll1>], [<coll2>], ...)` | Return only common items across collections |
| item | `item()` | Return current item in a repeating action over an array |
| join | `join([<collection>], '<delimiter>')` | Join array items with delimiter. Max result: 104,857,600 chars |
| last | `last('<collection>')` | Return last item |
| length | `length([<collection>])` | Return number of items |
| reverse | `reverse([<collection>])` | Reverse order of items |
| skip | `skip([<collection>], <count>)` | Remove items from front, return rest |
| sort | `sort([<collection>], '<sortBy>'?)` | Sort items. Optional key for object sorting |
| take | `take('<collection>', <count>)` | Return items from front |
| union | `union([<coll1>], [<coll2>], ...)` | Return all items from all collections (no duplicates) |

## Logical Comparison Functions

Note: null values are converted to empty string ("") in comparisons.

| Function | Signature | Description |
|----------|-----------|-------------|
| and | `and(<expr1>, <expr2>, ...)` | True if all expressions are true |
| equals | `equals(<object1>, <object2>)` | True if both values are equivalent |
| greater | `greater(<value>, <compareTo>)` | True if first > second |
| greaterOrEquals | `greaterOrEquals(<value>, <compareTo>)` | True if first >= second |
| if | `if(<expression>, <valueIfTrue>, <valueIfFalse>)` | Return value based on boolean expression |
| less | `less(<value>, <compareTo>)` | True if first < second |
| lessOrEquals | `lessOrEquals(<value>, <compareTo>)` | True if first <= second |
| not | `not(<expression>)` | True if expression is false |
| or | `or(<expr1>, <expr2>, ...)` | True if at least one expression is true |

## Conversion Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| array | `array('<value>')` | Return array from single input |
| base64 | `base64('<value>')` | Return base64-encoded string |
| base64ToBinary | `base64ToBinary('<value>')` | Return binary from base64 string |
| base64ToString | `base64ToString('<value>')` | Decode base64 string |
| binary | `binary('<value>')` | Return base64-encoded binary of string |
| bool | `bool(<value>)` | Return boolean version of value |
| createArray | `createArray('<obj1>', '<obj2>', ...)` | Return array from multiple inputs |
| dataUri | `dataUri('<value>')` | Return data URI for string |
| dataUriToBinary | `dataUriToBinary('<value>')` | Return binary from data URI |
| dataUriToString | `dataUriToString('<value>')` | Return string from data URI |
| decimal | `decimal('<value>')` | Return decimal number from string. Wrap with string() to preserve precision |
| decodeBase64 | `decodeBase64('<value>')` | **Deprecated** - use base64ToString() |
| decodeDataUri | `decodeDataUri('<value>')` | Return binary from data URI. Prefer dataUriToBinary() |
| decodeUriComponent | `decodeUriComponent('<value>')` | Decode escape characters in string |
| encodeUriComponent | `encodeUriComponent('<value>')` | Encode URL-unsafe characters. Prefer uriComponent() |
| float | `float('<value>', '<locale>'?)` | Convert string to float. Supports locale-specific formats |
| int | `int('<value>')` | Convert string to integer |
| json | `json('<value>')` | Convert string or XML to JSON |
| string | `string(<value>)` | Convert value to string. Null becomes empty string ("") |
| uriComponent | `uriComponent('<value>')` | URI-encode a string |
| uriComponentToBinary | `uriComponentToBinary('<value>')` | Return binary from URI-encoded string |
| uriComponentToString | `uriComponentToString('<value>')` | Decode URI-encoded string |
| xml | `xml('<value>')` | Convert string/JSON to XML. JSON must have single root property |

## Math Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| add | `add(<summand1>, <summand2>)` | Add two numbers |
| div | `div(<dividend>, <divisor>)` | Divide two numbers (integer division). Divisor cannot be 0 |
| max | `max(<num1>, <num2>, ...)` or `max([<array>])` | Return highest value |
| min | `min(<num1>, <num2>, ...)` or `min([<array>])` | Return lowest value |
| mod | `mod(<dividend>, <divisor>)` | Return remainder. Result sign matches dividend |
| mul | `mul(<multiplicand1>, <multiplicand2>)` | Multiply two numbers |
| rand | `rand(<minValue>, <maxValue>)` | Random integer, inclusive at start, exclusive at end |
| range | `range(<startIndex>, <count>)` | Return integer array. Count must be <= 100,000 |
| sub | `sub(<minuend>, <subtrahend>)` | Subtract second from first |

## Date and Time Functions

Default timestamp format: "o" (yyyy-MM-ddTHH:mm:ss.fffffffK) - ISO 8601.
Time unit values: "Second", "Minute", "Hour", "Day", "Week", "Month", "Year".

| Function | Signature | Description |
|----------|-----------|-------------|
| addDays | `addDays('<timestamp>', <days>, '<format>'?)` | Add days to timestamp |
| addHours | `addHours('<timestamp>', <hours>, '<format>'?)` | Add hours to timestamp |
| addMinutes | `addMinutes('<timestamp>', <minutes>, '<format>'?)` | Add minutes to timestamp |
| addSeconds | `addSeconds('<timestamp>', <seconds>, '<format>'?)` | Add seconds to timestamp |
| addToTime | `addToTime('<timestamp>', <interval>, '<timeUnit>', '<format>'?)` | Add time units to timestamp |
| convertFromUtc | `convertFromUtc('<timestamp>', '<destTimeZone>', '<format>'?)` | Convert from UTC to target time zone |
| convertTimeZone | `convertTimeZone('<timestamp>', '<sourceTimeZone>', '<destTimeZone>', '<format>'?)` | Convert between time zones |
| convertToUtc | `convertToUtc('<timestamp>', '<sourceTimeZone>', '<format>'?)` | Convert to UTC |
| dateDifference | `dateDifference('<startDate>', '<endDate>')` | Return difference as timespan string |
| dayOfMonth | `dayOfMonth('<timestamp>')` | Return day of month (integer) |
| dayOfWeek | `dayOfWeek('<timestamp>')` | Return day of week (0=Sunday, 1=Monday, ...) |
| dayOfYear | `dayOfYear('<timestamp>')` | Return day of year (integer) |
| formatDateTime | `formatDateTime('<timestamp>', '<format>'?, '<locale>'?)` | Format a timestamp |
| getFutureTime | `getFutureTime(<interval>, '<timeUnit>', '<format>'?)` | Current timestamp + time units |
| getPastTime | `getPastTime(<interval>, '<timeUnit>', '<format>'?)` | Current timestamp - time units |
| parseDateTime | `parseDateTime('<timestamp>', '<locale>'?, '<format>'?)` | Parse timestamp string to ISO 8601 |
| startOfDay | `startOfDay('<timestamp>', '<format>'?)` | Return start of day |
| startOfHour | `startOfHour('<timestamp>', '<format>'?)` | Return start of hour |
| startOfMonth | `startOfMonth('<timestamp>', '<format>'?)` | Return start of month |
| subtractFromTime | `subtractFromTime('<timestamp>', <interval>, '<timeUnit>', '<format>'?)` | Subtract time units from timestamp |
| ticks | `ticks('<timestamp>')` | Return ticks (100-nanosecond intervals since 0001-01-01) |
| utcNow | `utcNow('<format>'?)` | Return current timestamp |

## Workflow Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| action | `action()` | Return current action's output at runtime |
| actions | `actions('<actionName>')` | Return named action's output at runtime |
| body | `body('<actionName>')` | Return action's body output. Shorthand for `actions('<actionName>').outputs.body` |
| formDataMultiValues | `formDataMultiValues('<actionName>', '<key>')` | Return array of values matching key in form-data output |
| formDataValue | `formDataValue('<actionName>', '<key>')` | Return single value matching key in form-data output |
| item | `item()` | Current item in repeating action over array |
| items | `items('<loopName>')` | Current item from each cycle in for-each loop |
| iterationIndexes | `iterationIndexes('<loopName>')` | Index value for current iteration in Until loop |
| listCallbackUrl | `listCallbackUrl()` | Return callback URL for trigger/action (HttpWebhook and ApiConnectionWebhook only) |
| multipartBody | `multipartBody('<actionName>', <index>)` | Return body for specific part in multipart output |
| outputs | `outputs('<actionName>')` | Return action's output at runtime |
| parameters | `parameters('<parameterName>')` | Return value for workflow parameter |
| result | `result('<scopedActionName>')` | Return results from top-level actions in scoped action (For_each, Until, Scope) |
| trigger | `trigger()` | Return trigger output at runtime |
| triggerBody | `triggerBody()` | Return trigger's body output. Shorthand for `trigger().outputs.body` |
| triggerFormDataMultiValues | `triggerFormDataMultiValues('<key>')` | Return array of values matching key in trigger form-data |
| triggerFormDataValue | `triggerFormDataValue('<key>')` | Return single value matching key in trigger form-data |
| triggerMultipartBody | `triggerMultipartBody(<index>)` | Return body for specific part in trigger multipart output |
| triggerOutputs | `triggerOutputs()` | Return trigger output. Shorthand for `trigger().outputs` |
| variables | `variables('<variableName>')` | Return value of specified variable |
| workflow | `workflow().<property>` | Return workflow details. Properties: name, type, id, location, run, tags |

## URI Parsing Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| uriHost | `uriHost('<uri>')` | Return host value |
| uriPath | `uriPath('<uri>')` | Return path value |
| uriPathAndQuery | `uriPathAndQuery('<uri>')` | Return path and query values |
| uriPort | `uriPort('<uri>')` | Return port value |
| uriQuery | `uriQuery('<uri>')` | Return query value |
| uriScheme | `uriScheme('<uri>')` | Return scheme value |

## JSON & XML Manipulation Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| addProperty | `addProperty(<object>, '<property>', <value>)` | Add property to JSON object. Fails if property exists |
| coalesce | `coalesce(<obj1>, <obj2>, ...)` | Return first non-null value |
| removeProperty | `removeProperty(<object>, '<property>')` | Remove property from JSON object |
| setProperty | `setProperty(<object>, '<property>', <value>)` | Set property value on JSON object |
| xpath | `xpath('<xml>', '<xpath>')` | Find XML nodes/values matching XPath expression |

## Key Behaviors

- **Case sensitivity**: `contains`, `replace` are case-sensitive. `indexOf`, `lastIndexOf`, `startsWith`, `endsWith` are case-insensitive.
- **Null handling**: In logical comparisons, null values become empty strings (""). `string(null)` returns "".
- **Base64**: Azure Logic Apps auto-performs base64 encoding/decoding - manual conversion usually unnecessary.
- **div() behavior**: Integer division when both operands are integers; float result if either operand is float.
- **mod() sign**: Result sign matches the dividend sign.
- **Time zones**: Use Windows time zone names (e.g., "Pacific Standard Time").
- **Format strings**: Use .NET format specifiers for dates and numbers.
