# i18n EJS Preview

A VS Code extension that shows inline previews of i18n translation values in EJS templates.

## Features

- **Hover Previews**: Hover over translation keys to see their values
- **Inline Decorations**: See translation values displayed inline next to the keys
- **Nested Key Support**: Supports nested JSON keys (e.g., `product.sections.compression.title`)
- **Array & Object Handling**: Displays arrays and objects appropriately
- **Auto-reload**: Automatically reloads when i18n JSON files change

## Usage

1. Install the extension
2. Open a workspace containing EJS templates and i18n JSON files
3. Configure the extension settings (optional):
   - `i18nEjsPreview.i18nFolder`: Folder containing i18n JSON files (default: `locales`)
   - `i18nEjsPreview.defaultLocale`: Default locale to use (default: `en`)
   - `i18nEjsPreview.functionName`: i18n function name (default: `__`)

4. Hover over or view inline decorations for translation keys like: `<%= __('product.title') %>`

## Requirements

- VS Code 1.85.0 or higher
- i18n translation files in JSON format

## Development

```bash
npm install
npm run compile
```

Press F5 to run the extension in debug mode.
