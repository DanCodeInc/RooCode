# Code Index Settings Component

This folder contains a modular implementation of the Code Index Settings component, following SOLID principles.

## Structure

```
code-index/
├── index.ts                      # Export all components
├── CodeIndexSettings.tsx         # Main container component
├── types.ts                      # Shared types and interfaces
├── README.md                     # This documentation file
├── hooks/
│   ├── useCodeIndexStatus.ts     # Custom hook for status management
│   └── useCodeIndexMessaging.ts  # Custom hook for message handling
├── components/
│   ├── CodeIndexToggle.tsx       # Enable/disable toggle component
│   ├── CodeIndexCredentials.tsx  # API key and URL input fields
│   ├── CodeIndexStatus.tsx       # Status indicator and progress display
│   └── CodeIndexActions.tsx      # Action buttons (Start Indexing, Clear Data)
└── utils/
    └── statusHelpers.ts          # Helper functions for status processing
```

## SOLID Principles Applied

### Single Responsibility Principle (SRP)

Each component and hook has a single responsibility:

- `CodeIndexToggle`: Handles the enable/disable checkbox
- `CodeIndexCredentials`: Manages API key and URL inputs
- `CodeIndexStatus`: Displays status and progress information
- `CodeIndexActions`: Provides action buttons with confirmation dialogs
- `useCodeIndexStatus`: Manages status state
- `useCodeIndexMessaging`: Handles communication with the extension

### Open/Closed Principle (OCP)

Components are designed to be extended without modification:

- Status display logic can be extended by adding new status types
- New actions can be added without modifying existing components

### Liskov Substitution Principle (LSP)

Components with similar props can be substituted for each other:

- All UI components follow a consistent prop pattern
- Status handling is abstracted through interfaces

### Interface Segregation Principle (ISP)

Component interfaces are small and focused:

- Each component only receives the props it needs
- Props are grouped by functionality

### Dependency Inversion Principle (DIP)

Components depend on abstractions, not concrete implementations:

- Status management is abstracted through custom hooks
- Communication with the extension is abstracted through messaging hooks

## Usage

Import the main component from the index file:

```tsx
import { CodeIndexSettings } from "./code-index"
```

Then use it in your component:

```tsx
<CodeIndexSettings
	codeIndexEnabled={codeIndexEnabled}
	codeIndexOpenAiKey={codeIndexOpenAiKey}
	codeIndexQdrantUrl={codeIndexQdrantUrl}
	setCachedStateField={setCachedStateField}
/>
```
