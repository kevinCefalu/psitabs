# PsiTabs

A powerful tab management extension with AI capabilities to help organize your browser tabs.

## Overview

PsiTabs is designed to help you take control of your browsing experience by providing smart tab management features. Whether you're dealing with dozens of open tabs or trying to keep your research organized, PsiTabs offers intuitive tools to improve your productivity.

## Features

- **Find Duplicate Tabs** - Automatically detect and manage duplicate tabs
- **Sort Tabs** - Organize tabs in your current window by domain, title, or other criteria
- **Group Similar Tabs** - Intelligently group related tabs together
- **AI-Powered Organization** - Uses advanced algorithms to understand tab content and relationships
- **Side Panel Interface** - Quick access to tab management tools without interrupting your workflow
- **Customizable Settings** - Configure the extension to match your workflow

## Building the Extension

### Prerequisites

- [Node.js](https://nodejs.org/) (latest LTS version recommended)
- npm (comes with Node.js)

### Setup

1. Clone the repository:
   ```
   git clone https://github.com/kevinCefalu/psitabs.git
   cd psitabs
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Build the extension:

   For development build with source maps:
   ```
   npm run build
   ```

   For production build (minified):
   ```
   npm run build:prod
   ```

   The built extension will be available in the [`dist`](dist ) folder.

### Development

To continuously rebuild as you make changes:
```
npm run watch
```

To check for TypeScript errors without building:
```
npm run type-check
```

To lint your code:
```
npm run lint
```

## Installing in Microsoft Edge

1. Build the extension using one of the build commands above
2. Open Microsoft Edge and navigate to `edge://extensions/`
3. Enable "Developer mode" using the toggle in the bottom-left corner
4. Click "Load unpacked"
5. Navigate to the [`dist`](dist ) folder in your project directory and select it
6. PsiTabs should now appear in your extensions list and be ready to use

Note: If you need to update the extension in edge, you can simply rebuild the extension using `npm run build` or `npm run build:prod`, then go back to `edge://extensions/` and click the "Reload" button next to PsiTabs in the extensions list. This will load the latest version of your extension without needing to remove and re-add it.

## Usage

- Click the PsiTabs icon in your browser toolbar to open the popup interface
- Use the side panel for more comprehensive tab management
- Configure preferences in the options page
- Use keyboard shortcuts for quick actions:
  - Open PsiTabs popup: Default browser shortcut for extensions
  - Open side panel: Custom shortcut (configurable)
  - Find duplicates: Custom shortcut (configurable)
  - Sort tabs: Custom shortcut (configurable)
  - Group tabs: Custom shortcut (configurable)

## License

ISC License

## Author

Psibit Engineering

---

*PsiTabs is currently in development. This documentation reflects the current state of the project and may be updated as new features are implemented.*
