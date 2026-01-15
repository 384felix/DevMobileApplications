# AI Coding Guidelines for DevMobileApplications

## Project Overview
This workspace contains learning projects for mobile application development. The main project is `firstmobileapp/`, a Preact-based web app using Vite.

## Tech Stack
- **Framework**: Preact (lightweight React alternative)
- **Build Tool**: Vite with custom `rolldown-vite` override for enhanced performance
- **Language**: JavaScript with JSX
- **Styling**: CSS modules (app.css, index.css)

## Key Workflows
- **Development**: `npm run dev` starts Vite dev server with HMR
- **Build**: `npm run build` creates production bundle
- **Preview**: `npm run preview` serves built app locally
- **No testing framework** currently configured - add tests as needed

## Code Patterns
- Use Preact hooks (`useState`, etc.) instead of class components
- Import assets from `./assets/` or `/` (public folder)
- Follow standard JSX syntax with Preact-specific optimizations
- CSS classes applied directly in JSX (e.g., `class="logo"`)

## Project Structure
- `firstmobileapp/src/app.jsx`: Main app component with state management
- `firstmobileapp/src/main.jsx`: Entry point rendering App to DOM
- `Vorlesung_Tutorial/`: Directory for tutorial code (currently minimal)

## Conventions
- ES modules (`type: "module"` in package.json)
- No TypeScript - use plain JavaScript
- Minimal dependencies: focus on Preact core + Vite tooling

## Key Files
- [firstmobileapp/package.json](firstmobileapp/package.json): Dependencies and scripts
- [firstmobileapp/vite.config.js](firstmobileapp/vite.config.js): Build configuration
- [firstmobileapp/src/app.jsx](firstmobileapp/src/app.jsx): Example component structure