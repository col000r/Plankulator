# Plankulator

A React application for optimizing woodworking cutting plans from 3D OBJ files. Plankulator analyzes 3D models, generates efficient cutting sequences that minimize material waste, and provides interactive 3D visualization with color-coded pieces.

🌐 **Live Demo**: [https://plankulator.brightlight.rocks](https://plankulator.brightlight.rocks)

## Features

### Core Functionality
- **3D Model Import**: Parse OBJ files with multi-material support
- **Smart Optimization**: Intelligent bin packing algorithm that minimizes waste
- **Material Management**: Configure multiple material types with custom dimensions and pricing
- **3D Visualization**: Interactive Three.js viewer with color-coded pieces
- **Orientation Optimizer**: Tests 6 orientations per piece for optimal material usage

### New Features
- **📊 Print-Ready Cutting Plans**: Generate professional cutting lists with visual diagrams and checkboxes
- **💾 Save/Load Projects**: Export and import complete projects as JSON files
- **💰 Cost Calculator**: Optional material pricing with automatic total calculation
- **📝 Project Notes**: Add instructions that print with your cutting plan
- **📏 Measurement Labels**: Visual dimensions on cutting diagrams
- **🎨 Distinct Color System**: High-contrast colors for easy piece identification

## Installation

```bash
# Clone the repository
git clone https://github.com/col000r/Plankulator.git
cd plankulator

# Install dependencies
npm install
```

## Usage

### Development Mode
```bash
npm run dev
```
Opens development server on http://localhost:3000 with hot-reload

### Production Build
```bash
npm run build
```
Creates optimized build in `dist/` folder

### Deployment
Upload contents of `dist/` folder to any static web hosting service

## How It Works

1. **Prepare Your Model**: Ensure each piece is a separate object in your 3D software
2. **Upload OBJ File**: Select your 3D model file
3. **Configure Materials**: Set up available raw materials (dimensions, price)
4. **Add Notes**: Optional project instructions or reminders
5. **Generate Plan**: View optimized cutting sequence
6. **Save/Print**: Export project or print cutting list for workshop use

## OBJ File Requirements

⚠️ **Important**: Each piece to be cut must be a separate object in your OBJ file

- **Blender**: Each piece should be a separate object in the outliner
- **SketchUp**: Ensure each component is a separate group/component, then export as single OBJ file
- **Fusion 360**: Ensure each body/component is separate, then export all as single OBJ file
- **Sample Files**: Available in the app for reference

## Material Configuration

Each material type supports:
- **Name**: Material identifier
- **Length**: Available length in mm
- **Width**: Available width in mm
- **Thickness**: Material thickness in mm
- **Saw Kerf**: Blade width for cut spacing in mm
- **Price** (optional): Cost per unit for budget calculation

## Visual Features

### 3D Viewer
- Orbit controls (drag to rotate, scroll to zoom, right-click to pan)
- Automatic camera positioning
- Color-coded piece identification matching cutting plan
- Grid alignment at model base

### Cutting Plan Visualization
- 2D layout with actual piece proportions
- Top-aligned pieces (realistic cutting position)
- Waste areas clearly marked with red striped pattern
- Measurement labels and scale rulers
- Saw kerf visualization between pieces

### Print Layout
- Compact summary with key metrics
- Visual plank diagrams with color-coded pieces
- Checkboxes for tracking completed cuts
- Material requirements table
- Cost breakdown (if prices entered)
- Project notes included

## Project Management

### Save/Load
- Export complete projects as JSON
- Includes model, materials, settings, and notes
- Resume work anytime

### Printing
- Professional cutting lists
- Visual representations of each plank
- Optimized for workshop use
- Check off cuts as completed

## Technology Stack

- **React 18** - UI framework
- **Three.js** - 3D graphics rendering
- **React Three Fiber** - React renderer for Three.js
- **Tailwind CSS** - Styling
- **Vite** - Build tool
- **Lucide React** - Icons

## Browser Requirements

- Modern browser with WebGL support
- JavaScript enabled
- Recommended: Chrome, Firefox, Safari, or Edge (latest versions)

## Sample Files

The app includes sample OBJ files:
- `Shelves.obj` - Multi-shelf design demonstrating object separation

## Tips for Best Results

1. **Model Preparation**: Ensure clean separation of pieces in your 3D software
2. **Material Selection**: Add multiple material types for automatic optimization
3. **Orientation**: The algorithm tests all orientations - no manual rotation needed
4. **Grouping**: Identical pieces are automatically counted and grouped
5. **Pricing**: Add prices to materials for instant cost calculation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Author

Created by Markus Hofer ([https://markus.hofer.rocks](https://markus.hofer.rocks))

## License

MIT License

## Support

For issues, questions, or feature requests, please open an issue on GitHub.