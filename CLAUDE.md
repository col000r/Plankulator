# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Plankulator is a React TypeScript application for optimizing woodworking cutting plans from 3D OBJ files. It analyzes 3D models, generates efficient cutting sequences that minimize material waste, and provides interactive 3D visualization of the models with color-coded pieces.

## Architecture

### Component Structure
- **Main Application**: `src/App.jsx` - Core cutting optimization logic and UI
- **3D Visualization**: `src/OBJViewer3D.jsx` - Three.js-based 3D model viewer with color-coded pieces
- **Entry Point**: `src/main.jsx` - React app initialization
- **Standalone Version**: `plankulator.html` - Self-contained version using CDN imports

### Technology Stack
- **Frontend**: React 19 with hooks-based state management
- **3D Graphics**: Three.js with React Three Fiber (@react-three/fiber) and Drei (@react-three/drei)
- **Styling**: Tailwind CSS (loaded via CDN)
- **Icons**: Lucide React
- **Build Tool**: Vite

### Key Algorithms
1. **OBJ Parser**: Custom parser that handles vertices, faces, and multiple objects with material support
2. **Orientation Optimizer**: Tests 6 orientations per piece to minimize material usage across multiple material types
3. **Bin Packing**: Multi-constraint optimization algorithm for fitting pieces onto raw materials with saw kerf calculations
4. **3D Visualization**: Real-time 3D rendering with automatic camera positioning and color-coded piece identification

## Development Commands

```bash
npm run dev     # Start development server on port 3000
npm run build   # Build for production
npm run preview # Preview production build
```

### Alternative Running Methods
- **Development**: Use `npm run dev` for hot-reload development
- **Standalone**: Open `plankulator.html` directly in browser (uses CDN dependencies)

## Testing Approach

Use the included sample OBJ files for testing:
- `Shelf.obj` - Simple single-material shelf design (with `Shelf.mtl`)
- `Shelf_2kindsOfPlanks.obj` - Complex multi-material shelf (with `Shelf_2kindsOfPlanks.mtl`)

## Key Implementation Details

### Material Settings Structure
```typescript
{
  id: number,
  name: string,
  length: number,    // mm
  width: number,     // mm  
  thickness: number, // mm
  sawKerf: number    // mm (blade width)
}
```

### Piece Optimization Flow
1. Parse OBJ file to extract pieces
2. Calculate bounding boxes for each piece
3. Test 6 orientations (XYZ, XZY, YXZ, YZX, ZXY, ZYX)
4. Select orientation that minimizes material usage
5. Apply bin packing algorithm with saw kerf calculations
6. Generate visual cutting plan with piece placement

### UI Components
- Material settings panel with Add/Delete/Edit capabilities
- File upload area with drag-and-drop support
- Interactive 3D model viewer with orbit controls and color-coded pieces
- Piece analysis display with grouping and counts
- Visual 2D cutting plan with piece placement visualization
- Statistics panel showing efficiency metrics and waste calculations

### 3D Visualization Features
- **Camera Controls**: Automatic fit-to-view, orbit controls (drag to rotate, scroll to zoom, right-click to pan)
- **Color Coding**: Each piece type gets a consistent color shared between 3D view and cutting plan
- **Grid Alignment**: Grid positioned at model bottom and centered on XZ plane
- **Performance**: Optimized for large models with polygon offset to prevent z-fighting

## Important Constraints

- Pieces larger than available materials are flagged as warnings
- Saw kerf is added between all pieces for accurate cutting
- Identical pieces are automatically grouped and counted
- Material thickness must match piece requirements exactly
- 3D viewer requires WebGL support and handles models scaled from meters to millimeters