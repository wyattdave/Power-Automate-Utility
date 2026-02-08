---
applyTo: '**'
---
all code should follow these guidelines:

- javscript should not be in the html file but the js files
- css should not be in the html file but the css files

Naming convetions:
- uese let and const instead of var
- Use camelCase for variable and function names (e.g., myVariable, calculateTotal).
- First letter of variables should identify the type:
  - b for boolean (e.g., bIsActive)
  - i for integer/number (e.g., iTotalCount)
  - s for string (e.g., sUserName)
  - a for array (e.g., aItemsList)
  - o for object (e.g., oUserDetails)
  - e for element (e.g., eSubmitButton)

Design patterns:
- when creating regexs uses new regexp('pattern', 'flags') instead of /pattern/flags
- when embedding variables in strings use "string"+variable+"string" instead of template literals
- use a function first approach, avoid classes unless absolutely necessary
