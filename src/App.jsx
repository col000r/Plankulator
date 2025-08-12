import React, { useState, useCallback } from 'react';
import { Upload, Download, Settings, Scissors, Calculator, FileText, Package, AlertTriangle, Box, Printer, Save, DollarSign, StickyNote } from 'lucide-react';
import OBJViewer3D from './OBJViewer3D';

const OBJCuttingPlanner = () => {
  const [objFile, setObjFile] = useState(null);
  const [objFileContent, setObjFileContent] = useState(null);
  const [pieces, setPieces] = useState([]);
  const [cuttingPlan, setCuttingPlan] = useState([]);
  const [materialSettings, setMaterialSettings] = useState([
    {
      id: 1,
      name: 'Triboard Plank',
      length: 4000,
      width: 400,
      thickness: 37,
      sawKerf: 2,
      pricePerUnit: null
    }
  ]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [orientationWarnings, setOrientationWarnings] = useState([]);
  const [projectNotes, setProjectNotes] = useState('');

  // Parse OBJ file
  const parseOBJFile = (content) => {
    const lines = content.split('\n');
    let objects = [];
    let currentObject = null;

    for (let line of lines) {
      line = line.trim();
      
      if (line.startsWith('o ')) {
        const objectName = line.substring(2);
        currentObject = {
          name: objectName,
          vertices: []
        };
        objects.push(currentObject);
      } else if (line.startsWith('v ') && currentObject) {
        const coords = line.substring(2).split(' ').map(n => parseFloat(n));
        currentObject.vertices.push(coords);
      }
    }

    return objects;
  };

  // Calculate dimensions for each object
  const calculateDimensions = (vertices) => {
    if (vertices.length === 0) return null;
    
    let minX = Math.min(...vertices.map(v => v[0]));
    let maxX = Math.max(...vertices.map(v => v[0]));
    let minY = Math.min(...vertices.map(v => v[1]));
    let maxY = Math.max(...vertices.map(v => v[1]));
    let minZ = Math.min(...vertices.map(v => v[2]));
    let maxZ = Math.max(...vertices.map(v => v[2]));
    
    return {
      x: Math.abs(maxX - minX),
      y: Math.abs(maxY - minY), 
      z: Math.abs(maxZ - minZ)
    };
  };

  // Smart piece orientation with automatic material selection
  const optimizePieceOrientation = (pieces, materials) => {
    let warnings = [];
    
    
    return pieces.map(piece => {
      const { length, width, thickness } = piece;
      const originalDims = [length, width, thickness];
      
      
      let bestMatch = null;
      let bestOrientation = null;
      let bestScore = Infinity;
      
      // Try each material to find the best fit
      for (const material of materials) {
        
        // Find all possible orientations that could fit in this material
        const orientations = [
          { cut: length, width: width, thick: thickness, label: `${length}(cut) × ${width} × ${thickness}` },
          { cut: length, width: thickness, thick: width, label: `${length}(cut) × ${thickness} × ${width}` },
          { cut: width, width: length, thick: thickness, label: `${width}(cut) × ${length} × ${thickness}` },
          { cut: width, width: thickness, thick: length, label: `${width}(cut) × ${thickness} × ${length}` },
          { cut: thickness, width: length, thick: width, label: `${thickness}(cut) × ${length} × ${width}` },
          { cut: thickness, width: width, thick: length, label: `${thickness}(cut) × ${width} × ${length}` }
        ];
        
        // Filter orientations that physically fit in this material
        const validOrientations = orientations.filter(orient => {
          const fits = orient.cut <= material.length && 
                      orient.width <= material.width && 
                      orient.thick <= material.thickness;
          return fits;
        });
        
        
        if (validOrientations.length > 0) {
          // Choose the orientation that minimizes cutting length for this material
          const bestOrientationForMaterial = validOrientations.reduce((best, current) => 
            current.cut < best.cut ? current : best
          );
          
          // Calculate efficiency score
          const cuttingLength = bestOrientationForMaterial.cut;
          const thicknessWaste = material.thickness - bestOrientationForMaterial.thick;
          const widthWaste = material.width - bestOrientationForMaterial.width;
          
          // Weighted score: heavily favor better thickness fit
          const score = cuttingLength + (thicknessWaste * 100) + (widthWaste * 0.1);
          
          
          // If this is the best score so far, use this material
          if (score < bestScore) {
            bestMatch = material;
            bestOrientation = bestOrientationForMaterial;
            bestScore = score;
          }
        }
      }
      
      if (!bestMatch) {
        warnings.push({
          piece: piece.name,
          dims: `${length} × ${width} × ${thickness}mm`,
          issue: `Cannot fit in any available material`
        });
        
        return {
          ...piece,
          cuttingLength: length,
          finalWidth: width,
          finalThickness: thickness,
          orientation: 'ERROR',
          canFit: false,
          material: null,
          originalDims
        };
      }
      
      
      return {
        ...piece,
        cuttingLength: bestOrientation.cut,
        finalWidth: bestOrientation.width,
        finalThickness: bestOrientation.thick,
        orientation: bestOrientation.label,
        canFit: true,
        material: bestMatch,
        originalDims
      };
    });
  };

  // Generate cutting plan with smart orientation and multiple materials
  const generateCuttingPlan = (pieces, materials) => {
    // Group pieces by material
    const piecesByMaterial = {};
    pieces.filter(p => p.canFit).forEach(piece => {
      const materialId = piece.material.id;
      if (!piecesByMaterial[materialId]) {
        piecesByMaterial[materialId] = {
          material: piece.material,
          pieces: []
        };
      }
      piecesByMaterial[materialId].pieces.push(piece);
    });

    let allPlanks = [];
    let globalPlankNumber = 1;

    // Generate cutting plan for each material type
    Object.values(piecesByMaterial).forEach(materialGroup => {
      const { material, pieces: materialPieces } = materialGroup;
      let remainingPieces = materialPieces.map(p => ({...p}));
      
      // Sort pieces by cutting length descending for better packing
      remainingPieces.sort((a, b) => b.cuttingLength - a.cuttingLength);

      while (remainingPieces.some(p => p.count > 0)) {
        let currentPlank = {
          number: globalPlankNumber++,
          material: material,
          pieces: [],
          usedLength: 0,
          wasteLength: 0,
          materialDims: `${material.length} × ${material.width} × ${material.thickness}mm`
        };
        
        let remainingLength = material.length;
        
        // Pack pieces into this plank
        let foundPiece = true;
        while (foundPiece && remainingLength > 0) {
          foundPiece = false;
          
          // Find a piece that fits (including kerf if not first piece)
          for (let piece of remainingPieces) {
            let neededLength = piece.cuttingLength;
            if (currentPlank.pieces.length > 0) {
              neededLength += material.sawKerf;
            }
            
            if (piece.count > 0 && neededLength <= remainingLength) {
              currentPlank.pieces.push({
                name: piece.name,
                cuttingLength: piece.cuttingLength,
                finalWidth: piece.finalWidth,
                finalThickness: piece.finalThickness,
                orientation: piece.orientation,
                originalDims: piece.originalDims,
                material: piece.material,
                id: `${piece.name}-${currentPlank.pieces.length + 1}`
              });
              
              currentPlank.usedLength += neededLength;
              remainingLength -= neededLength;
              piece.count--;
              foundPiece = true;
              break;
            }
          }
        }
        
        currentPlank.wasteLength = remainingLength;
        allPlanks.push(currentPlank);
      }
    });

    return allPlanks;
  };

  // Add new material
  const addMaterial = () => {
    const newId = Math.max(...materialSettings.map(m => m.id)) + 1;
    setMaterialSettings(prev => [...prev, {
      id: newId,
      name: `Material ${newId}`,
      length: 4000,
      width: 400,
      thickness: 37,
      sawKerf: 2,
      pricePerUnit: null
    }]);
  };

  // Remove material
  const removeMaterial = (id) => {
    if (materialSettings.length > 1) {
      setMaterialSettings(prev => prev.filter(m => m.id !== id));
    }
  };

  // Update material
  const updateMaterial = (id, field, value) => {
    setMaterialSettings(prev => prev.map(m => 
      m.id === id ? {...m, [field]: value} : m
    ));
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.name.toLowerCase().endsWith('.obj')) {
      alert('Please upload a valid OBJ file');
      return;
    }

    setObjFile(file);
    setIsAnalyzing(true);
    setAnalysisComplete(false);
    setOrientationWarnings([]);
    
    // Reset color assignments for new file
    window.pieceColorMap = new Map();
    window.nextColorIndex = 0;

    try {
      const content = await file.text();
      setObjFileContent(content); // Store the OBJ content for 3D viewer
      const objects = parseOBJFile(content);
      
      // Process each object
      let allPieces = [];
      let pieceGroups = {};

      objects.forEach((obj, i) => {
        const dims = calculateDimensions(obj.vertices);
        if (dims) {
          const xMM = Math.round(dims.x * 1000 * 10) / 10;
          const yMM = Math.round(dims.y * 1000 * 10) / 10;
          const zMM = Math.round(dims.z * 1000 * 10) / 10;
          
          const piece = {
            name: obj.name,
            length: xMM,
            width: yMM, 
            thickness: zMM
          };
          
          allPieces.push(piece);
          
          // Group similar pieces
          const key = `${piece.length} × ${piece.width} × ${piece.thickness}`;
          if (!pieceGroups[key]) {
            pieceGroups[key] = {
              ...piece,
              count: 0,
              pieces: []
            };
          }
          pieceGroups[key].count++;
          pieceGroups[key].pieces.push(piece.name);
        }
      });

      // Smart orientation optimization with multiple materials
      const groupsArray = Object.values(pieceGroups);
      const optimizedPieces = optimizePieceOrientation(groupsArray, materialSettings);
      
      // Store warnings
      const warnings = optimizedPieces.filter(p => !p.canFit).map(p => ({
        piece: p.name,
        dims: `${p.length} × ${p.width} × ${p.thickness}mm`,
        issue: p.orientation === 'ERROR' ? 'Cannot fit in any available material' : 'Unknown orientation issue'
      }));
      setOrientationWarnings(warnings);
      
      // Generate cutting plan
      const plan = generateCuttingPlan(optimizedPieces, materialSettings);
      
      setPieces(optimizedPieces);
      setCuttingPlan(plan);
      setAnalysisComplete(true);
    } catch (error) {
      alert('Error processing OBJ file. Please check the file format.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Get piece color based on dimensions (consistent coloring for identical pieces)
  const getPieceColor = (piece) => {
    // Create a consistent hash from the piece dimensions
    const dimensionKey = `${piece.cuttingLength}×${piece.finalWidth}×${piece.finalThickness}`;
    
    // Use a map to store color assignments for consistency across renders
    if (!window.pieceColorMap) {
      window.pieceColorMap = new Map();
      window.nextColorIndex = 0;
    }
    
    // If we've already assigned a color to this dimension, use it
    if (window.pieceColorMap.has(dimensionKey)) {
      return window.pieceColorMap.get(dimensionKey);
    }
    
    // High-contrast, visually distinct colors using HSL for better distribution
    // These colors are carefully selected to be maximally distinct
    const distinctColors = [
      '#FF0000', // Pure Red
      '#0000FF', // Pure Blue
      '#00AA00', // Green (darker for better contrast)
      '#FF8C00', // Dark Orange
      '#9400D3', // Violet
      '#00CED1', // Dark Turquoise
      '#FFD700', // Gold
      '#FF1493', // Deep Pink
      '#32CD32', // Lime Green
      '#4B0082', // Indigo
      '#FF6347', // Tomato
      '#1E90FF', // Dodger Blue
      '#8B4513', // Saddle Brown
      '#00FA9A', // Medium Spring Green
      '#DC143C', // Crimson
      '#00BFFF', // Deep Sky Blue
      '#FF69B4', // Hot Pink
      '#228B22', // Forest Green
      '#FFA500', // Orange
      '#4169E1', // Royal Blue
      '#A0522D', // Sienna
      '#20B2AA', // Light Sea Green
      '#B22222', // Fire Brick
      '#6495ED', // Cornflower Blue
      '#FF4500', // Orange Red
      '#2E8B57', // Sea Green
      '#D2691E', // Chocolate
      '#48D1CC', // Medium Turquoise
      '#C71585', // Medium Violet Red
      '#6B8E23'  // Olive Drab
    ];
    
    // Assign the next available color
    const colorIndex = window.nextColorIndex % distinctColors.length;
    const color = distinctColors[colorIndex];
    
    // Store the assignment and increment the index
    window.pieceColorMap.set(dimensionKey, color);
    window.nextColorIndex++;
    
    return color;
  };

  // Calculate plank efficiency
  const calculateEfficiency = (plank, plankLength) => {
    return ((plank.usedLength / plankLength) * 100).toFixed(1);
  };

  // Calculate total cost
  const calculateTotalCost = () => {
    if (!cuttingPlan || cuttingPlan.length === 0) return null;
    
    let totalCost = 0;
    let hasAnyPrice = false;
    
    // Group planks by material and count
    const materialCounts = {};
    cuttingPlan.forEach(plank => {
      const materialId = plank.material.id;
      materialCounts[materialId] = (materialCounts[materialId] || 0) + 1;
    });
    
    // Calculate cost for each material
    Object.entries(materialCounts).forEach(([materialId, count]) => {
      const material = materialSettings.find(m => m.id === parseInt(materialId));
      if (material && material.pricePerUnit !== null && material.pricePerUnit > 0) {
        totalCost += material.pricePerUnit * count;
        hasAnyPrice = true;
      }
    });
    
    return hasAnyPrice ? { total: totalCost, counts: materialCounts } : null;
  };

  // Save project to JSON
  const saveProject = () => {
    const projectData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      materials: materialSettings,
      objFileName: objFile?.name || null,
      objContent: objFileContent,
      pieces: pieces,
      cuttingPlan: cuttingPlan,
      notes: projectNotes
    };
    
    const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plankulator-project-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Load project from JSON
  const loadProject = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const projectData = JSON.parse(e.target.result);
        
        // Restore project state
        if (projectData.materials) setMaterialSettings(projectData.materials);
        if (projectData.objContent) setObjFileContent(projectData.objContent);
        if (projectData.pieces) setPieces(projectData.pieces);
        if (projectData.cuttingPlan) setCuttingPlan(projectData.cuttingPlan);
        if (projectData.notes) setProjectNotes(projectData.notes);
        if (projectData.objFileName) {
          setObjFile({ name: projectData.objFileName });
          setAnalysisComplete(true);
        }
        
        // Check for warnings
        if (projectData.pieces) {
          const warnings = projectData.pieces.filter(p => !p.canFit).map(p => ({
            piece: p.name,
            dims: `${p.length} × ${p.width} × ${p.thickness}mm`,
            issue: 'Cannot fit in any available material'
          }));
          setOrientationWarnings(warnings);
        }
      } catch (error) {
        alert('Error loading project file. Please check the file format.');
      }
    };
    reader.readAsText(file);
  };

  // Print cutting plan
  const printCuttingPlan = () => {
    const printWindow = window.open('', '_blank');
    const costInfo = calculateTotalCost();
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Cutting Plan - ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 15px; font-size: 14px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 5px; font-size: 24px; margin: 10px 0; }
          h2 { color: #555; margin-top: 20px; font-size: 18px; }
          .header-info { display: flex; justify-content: space-between; margin-bottom: 15px; }
          .header-info span { margin-right: 20px; }
          .summary { background: #f5f5f5; padding: 10px; border-radius: 5px; margin: 15px 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
          .summary-item { }
          .summary-item strong { display: block; font-size: 12px; color: #666; }
          .summary-item .value { font-size: 16px; color: #333; }
          .plank { page-break-inside: avoid; margin: 15px 0; border: 1px solid #ddd; }
          .plank-header { background: #333; color: white; padding: 8px; font-size: 14px; display: flex; justify-content: space-between; align-items: center; }
          .plank-visual { background: #f5f5f5; padding: 10px; border-bottom: 1px solid #ddd; }
          .plank-diagram { height: 40px; background: #8B4513; position: relative; border: 1px solid #654321; box-shadow: inset 0 2px 4px rgba(0,0,0,0.1); }
          .piece-visual { position: absolute; top: 0; border: 1px solid #000; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; font-weight: bold; overflow: hidden; }
          .piece-unused { position: absolute; background: repeating-linear-gradient(45deg, #ff6b6b, #ff6b6b 4px, #ff8e8e 4px, #ff8e8e 8px); opacity: 0.7; }
          .kerf-visual { position: absolute; top: 0; height: 100%; background: #333; }
          .waste-visual { position: absolute; top: 0; height: 100%; background: repeating-linear-gradient(45deg, #ff6b6b, #ff6b6b 4px, #ff8e8e 4px, #ff8e8e 8px); border: 1px solid #ff0000; }
          .piece-list { padding: 10px; }
          .piece-item { margin: 5px 0; padding: 5px; background: #f9f9f9; border-left: 3px solid #4CAF50; display: flex; align-items: center; }
          .checkbox { width: 15px; height: 15px; border: 2px solid #333; display: inline-block; margin-right: 8px; flex-shrink: 0; }
          .piece-info { flex: 1; }
          .piece-name { font-weight: bold; font-size: 13px; }
          .dimensions { color: #666; font-size: 11px; margin-left: 23px; }
          .notes { background: #fffbf0; border: 1px solid #f0d000; padding: 10px; margin: 15px 0; border-radius: 5px; }
          .materials-table { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 13px; }
          .materials-table th, .materials-table td { padding: 6px; border: 1px solid #ddd; text-align: left; }
          .materials-table th { background: #f0f0f0; font-size: 12px; }
          .cost-summary { background: #e8f5e9; padding: 10px; border-radius: 5px; margin: 15px 0; }
          .scale-legend { font-size: 10px; color: #666; margin-top: 5px; display: flex; justify-content: space-between; }
          @media print { 
            .plank { page-break-inside: avoid; }
            body { margin: 10px; font-size: 12px; }
            h1 { font-size: 20px; }
            h2 { font-size: 16px; }
          }
        </style>
      </head>
      <body>
        <h1>Plankulator Cutting Plan</h1>
        <div class="header-info">
          <span><strong>Date:</strong> ${new Date().toLocaleDateString()}</span>
          <span><strong>Project:</strong> ${objFile?.name || 'Unnamed Project'}</span>
        </div>
        
        ${projectNotes ? `
        <div class="notes">
          <strong>Notes:</strong> ${projectNotes.replace(/\n/g, '<br>')}
        </div>
        ` : ''}
        
        <div class="summary">
          <div class="summary-item">
            <strong>Total Planks</strong>
            <div class="value">${cuttingPlan.length}</div>
          </div>
          <div class="summary-item">
            <strong>Total Pieces</strong>
            <div class="value">${pieces.filter(p => p.canFit).reduce((sum, p) => sum + p.count, 0)}</div>
          </div>
          <div class="summary-item">
            <strong>Efficiency</strong>
            <div class="value">${((cuttingPlan.reduce((sum, p) => sum + (p.material.length - p.wasteLength), 0) / cuttingPlan.reduce((sum, p) => sum + p.material.length, 0)) * 100).toFixed(1)}%</div>
          </div>
          <div class="summary-item">
            <strong>Total Waste</strong>
            <div class="value">${cuttingPlan.reduce((sum, p) => sum + p.wasteLength, 0).toFixed(0)}mm</div>
          </div>
          ${costInfo ? `
          <div class="summary-item">
            <strong>Total Cost</strong>
            <div class="value">$${costInfo.total.toFixed(2)}</div>
          </div>
          ` : ''}
        </div>
        
        ${costInfo ? `
        <div class="cost-summary">
          <h3 style="font-size: 14px; margin: 5px 0;">Cost Breakdown</h3>
          ${Object.entries(costInfo.counts).map(([materialId, count]) => {
            const material = materialSettings.find(m => m.id === parseInt(materialId));
            if (!material.pricePerUnit) return '';
            const cost = material.pricePerUnit * count;
            return `<div style="font-size: 12px;">${material.name}: ${count} × $${material.pricePerUnit.toFixed(2)} = $${cost.toFixed(2)}</div>`;
          }).join('')}
        </div>
        ` : ''}
        
        <h2>Materials Required</h2>
        <table class="materials-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Dimensions (L×W×T mm)</th>
              <th>Quantity</th>
              ${costInfo ? '<th>Unit Price</th><th>Total Cost</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${Object.entries(cuttingPlan.reduce((acc, plank) => {
              const key = plank.material.id;
              if (!acc[key]) {
                acc[key] = { material: plank.material, count: 0 };
              }
              acc[key].count++;
              return acc;
            }, {})).map(([id, data]) => `
              <tr>
                <td>${data.material.name}</td>
                <td>${data.material.length} × ${data.material.width} × ${data.material.thickness}</td>
                <td>${data.count}</td>
                ${costInfo && data.material.pricePerUnit ? 
                  `<td>$${data.material.pricePerUnit.toFixed(2)}</td><td>$${(data.material.pricePerUnit * data.count).toFixed(2)}</td>` : 
                  (costInfo ? '<td>-</td><td>-</td>' : '')}
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <h2>Cutting List by Plank</h2>
        ${cuttingPlan.map(plank => {
          // Calculate positions for visual diagram
          let currentPos = 0;
          const piecePositions = plank.pieces.map((piece, idx) => {
            const startPos = currentPos;
            const width = (piece.cuttingLength / plank.material.length) * 100;
            currentPos += piece.cuttingLength;
            if (idx < plank.pieces.length - 1) {
              currentPos += plank.material.sawKerf;
            }
            return { piece, startPos, width, idx };
          });
          
          return `
          <div class="plank">
            <div class="plank-header">
              <span><strong>Plank ${plank.number}:</strong> ${plank.material.name} (${plank.material.length}×${plank.material.width}×${plank.material.thickness}mm)</span>
              <span>${plank.pieces.length} cuts • ${calculateEfficiency(plank, plank.material.length)}% efficient</span>
            </div>
            
            <div class="plank-visual">
              <div class="plank-diagram">
                ${piecePositions.map(({ piece, startPos, width, idx }) => {
                  const leftPercent = (startPos / plank.material.length) * 100;
                  const color = getPieceColor(piece);
                  // Calculate piece height based on width usage (top-aligned)
                  const heightPercent = Math.min((piece.finalWidth / plank.material.width) * 100, 100);
                  
                  // Add kerf visualization if not first piece
                  let kerfHtml = '';
                  if (idx > 0) {
                    const kerfLeft = ((startPos - plank.material.sawKerf) / plank.material.length) * 100;
                    const kerfWidth = (plank.material.sawKerf / plank.material.length) * 100;
                    kerfHtml = `<div class="kerf-visual" style="left: ${kerfLeft}%; width: ${kerfWidth}%;"></div>`;
                  }
                  
                  // Add unused width area if piece doesn't use full width
                  let unusedHtml = '';
                  if (piece.finalWidth < plank.material.width) {
                    unusedHtml = `<div class="piece-unused" style="left: ${leftPercent}%; width: ${width}%; top: ${heightPercent}%; height: ${100 - heightPercent}%;"></div>`;
                  }
                  
                  return kerfHtml + `
                    <div class="piece-visual" style="left: ${leftPercent}%; width: ${width}%; top: 0; height: ${heightPercent}%; background: ${color};">
                      ${width > 3 ? `#${idx + 1}` : ''}
                    </div>
                  ` + unusedHtml;
                }).join('')}
                
                ${plank.wasteLength > 0 ? `
                  <div class="waste-visual" style="left: ${((plank.material.length - plank.wasteLength) / plank.material.length) * 100}%; width: ${(plank.wasteLength / plank.material.length) * 100}%;">
                    ${(plank.wasteLength / plank.material.length) * 100 > 5 ? `${plank.wasteLength.toFixed(0)}mm` : ''}
                  </div>
                ` : ''}
              </div>
              <div class="scale-legend">
                <span>0mm</span>
                <span>${plank.material.length}mm</span>
              </div>
            </div>
            
            <div class="piece-list">
              ${plank.pieces.map((piece, idx) => `
                <div class="piece-item">
                  <span class="checkbox"></span>
                  <div class="piece-info">
                    <span class="piece-name">
                      <span style="display: inline-block; width: 12px; height: 12px; background: ${getPieceColor(piece)}; border: 1px solid #000; vertical-align: middle; margin-right: 5px;"></span>
                      Cut #${idx + 1}: ${piece.name.replace(/\s*\(\d+\)$/g, '').trim()}
                    </span>
                    <div class="dimensions">
                      ${piece.cuttingLength} × ${piece.finalWidth} × ${piece.finalThickness}mm
                      ${idx > 0 ? ` (add ${plank.material.sawKerf}mm kerf)` : ''}
                    </div>
                  </div>
                </div>
              `).join('')}
              ${plank.wasteLength > 5 ? `
                <div style="margin-top: 8px; padding: 5px; background: #fff3cd; border-left: 3px solid #ffc107; font-size: 12px;">
                  <strong>Waste:</strong> ${plank.wasteLength.toFixed(0)}mm
                </div>
              ` : ''}
            </div>
          </div>
        `}).join('')}
        
        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ccc; text-align: center; color: #666;">
          <p>Generated by Plankulator - ${new Date().toISOString()}</p>
        </div>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Render cutting plan visualization
  const renderCuttingPlan = () => {
    if (!analysisComplete || cuttingPlan.length === 0) return null;

    const totalWaste = cuttingPlan.reduce((sum, plank) => sum + plank.wasteLength, 0);
    const totalLength = cuttingPlan.reduce((sum, plank) => sum + plank.material.length, 0);
    const overallEfficiency = ((totalLength - totalWaste) / totalLength * 100).toFixed(1);
    const fittablePieces = pieces.filter(p => p.canFit);
    const totalFittablePieces = fittablePieces.reduce((sum, p) => sum + p.count, 0);

    return (
      <div className="space-y-6">
        {/* Summary with Cost */}
        {(() => {
          const costInfo = calculateTotalCost();
          return (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">📋 Cutting Plan Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="font-medium">Total planks needed:</span> {cuttingPlan.length}
            </div>
            <div>
              <span className="font-medium">Total pieces:</span> {totalFittablePieces}
            </div>
            <div>
              <span className="font-medium">Total waste:</span> {Math.round(totalWaste)}mm
            </div>
            <div>
              <span className="font-medium">Overall efficiency:</span> {overallEfficiency}%
            </div>
          </div>
          <div className="mt-2 text-xs text-blue-700">
            Materials used: {[...new Set(cuttingPlan.map(p => p.material.name))].join(', ')}
          </div>
          {costInfo && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="flex items-center gap-2 text-green-800">
                <DollarSign size={16} />
                <span className="font-semibold">Total Material Cost: ${costInfo.total.toFixed(2)}</span>
              </div>
              <div className="mt-2 text-xs text-blue-700">
                {Object.entries(costInfo.counts).map(([materialId, count]) => {
                  const material = materialSettings.find(m => m.id === parseInt(materialId));
                  if (!material.pricePerUnit) return null;
                  return (
                    <div key={materialId}>
                      {material.name}: {count} × ${material.pricePerUnit.toFixed(2)} = ${(material.pricePerUnit * count).toFixed(2)}
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            </div>
          )}
            </div>
          );
        })()}

        {/* Legend for cutting plan visualization */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <h4 className="font-semibold text-yellow-800 mb-2">🎨 Cutting Plan Legend:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>• <strong>Piece alignment:</strong> All pieces aligned to top edge (realistic cutting position)</li>
            <li>• <strong>Height visualization:</strong> Piece height = actual width usage on plank</li>
            <li>• <strong>Color coding:</strong> Identical dimensions = same color for easy matching</li>
            <li>• <strong>Material selection:</strong> Each piece automatically assigned to best-fitting material</li>
            <li>• <strong>Tooltips:</strong> Hover over any piece to see full details and dimensions</li>
            <li>• <strong>Dotted areas:</strong> Unused plank width below narrow pieces</li>
            <li>• <strong>Dark gray strips:</strong> Material lost to saw blade kerf</li>
          </ul>
        </div>

        {/* Planks */}
        {cuttingPlan.map((plank) => (
          <div key={plank.number} className="border border-gray-300 rounded-lg overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
              <span className="font-semibold">
                Plank {plank.number}: {plank.pieces.length} pieces ({plank.material.name})
              </span>
              <span className="text-green-300 text-sm">
                {calculateEfficiency(plank, plank.material.length)}% efficient
              </span>
            </div>
            
            <div className="bg-amber-800 relative h-28 overflow-hidden border-t-2 border-b-2 border-gray-600">
              {/* Plank outline showing actual material dimensions */}
              <div className="absolute inset-0 border-2 border-gray-700 bg-amber-900 bg-opacity-30"></div>
              
              {/* Length ruler at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-3 bg-gray-700 bg-opacity-50 flex items-center text-white text-xs font-mono z-10">
                <div className="px-1">0mm</div>
                <div className="flex-1"></div>
                <div className="px-1">{plank.material.length}mm</div>
              </div>
              
              {plank.pieces.map((piece, index) => {
                const startPos = index === 0 ? 0 : 
                  plank.pieces.slice(0, index).reduce((sum, p) => sum + p.cuttingLength, 0) + 
                  (index * plank.material.sawKerf);
                const widthPercent = (piece.cuttingLength / plank.material.length) * 100;
                const leftPercent = (startPos / plank.material.length) * 100;
                
                // Calculate the breadth (how much of the plank width this piece uses)
                const breadthPercent = (piece.finalWidth / plank.material.width) * 100;
                const heightPercent = (piece.finalThickness / plank.material.thickness) * 100;
                
                // Position pieces at the top (not centered) - this is how they would actually be cut
                const topOffset = 0; // Always align to top
                const actualHeight = Math.min(breadthPercent, 100); // Cap at 100%
                
                return (
                  <React.Fragment key={piece.id}>
                    {index > 0 && (
                      <div 
                        className="absolute h-full bg-gray-600 border-l border-r border-gray-400 z-10"
                        style={{
                          left: `${((startPos - plank.material.sawKerf) / plank.material.length) * 100}%`,
                          width: `${(plank.material.sawKerf / plank.material.length) * 100}%`
                        }}
                      >
                        <div className="flex items-center justify-center h-full text-xs text-gray-300">
                          |
                        </div>
                      </div>
                    )}
                    
                    {/* Main piece visualization showing actual breadth */}
                    <div
                      className="absolute border-r border-black border-l border-black flex flex-col items-center justify-center text-white text-xs font-bold overflow-hidden z-20 cursor-help"
                      style={{
                        left: `${leftPercent}%`,
                        width: `${widthPercent}%`,
                        top: `${topOffset}%`,
                        height: `${actualHeight}%`,
                        backgroundColor: getPieceColor(piece),
                        border: piece.finalWidth < plank.material.width * 0.8 ? '2px solid #333' : '1px solid #000',
                        boxShadow: piece.finalWidth < plank.material.width * 0.8 ? 'inset 0 0 0 1px rgba(255,255,255,0.3)' : 'none'
                      }}
                      title={`Piece #${index + 1}: ${piece.name.replace(/\s*\(\d+\)$/g, '').trim()}
Dimensions: ${piece.cuttingLength}×${piece.finalWidth}×${piece.finalThickness}mm
Orientation: ${piece.orientation}
Original: ${piece.originalDims[0]}×${piece.originalDims[1]}×${piece.originalDims[2]}mm`}
                    >
                      <div className="text-xs opacity-80">#{index + 1}</div>
                      {/* Conditional text display based on available space */}
                      {widthPercent > 8 ? (
                        <div className="text-center leading-tight">
                          <div className="text-xs">{piece.name.replace(/\s*\(\d+\)$/g, '').trim()}</div>
                          <div className="text-xs opacity-90">
                            {piece.cuttingLength}×{piece.finalWidth}×{piece.finalThickness}
                          </div>
                          {piece.finalWidth < plank.material.width * 0.8 && widthPercent > 12 && (
                            <div className="text-xs opacity-70">(narrow)</div>
                          )}
                        </div>
                      ) : widthPercent > 4 ? (
                        <div className="text-center leading-tight">
                          <div className="text-xs opacity-90">
                            {piece.cuttingLength}×{piece.finalWidth}
                          </div>
                        </div>
                      ) : widthPercent > 2 ? (
                        <div className="text-center">
                          <div className="text-xs opacity-90">{piece.cuttingLength}</div>
                        </div>
                      ) : (
                        <div className="text-center">
                          <div className="text-xs opacity-90">•</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Measurement label */}
                    {widthPercent > 3 && (
                      <div
                        className="absolute text-xs font-mono text-gray-800 bg-white bg-opacity-90 px-1 rounded"
                        style={{
                          left: `${leftPercent}%`,
                          top: `${actualHeight + 2}%`,
                          transform: 'translateY(2px)',
                          zIndex: 30,
                          fontSize: '10px',
                          border: '1px solid #ccc'
                        }}
                      >
                        {piece.cuttingLength}mm
                      </div>
                    )}
                    
                    {/* Unused width indicator for narrow pieces */}
                    {piece.finalWidth < plank.material.width && (
                      <>
                        {/* Bottom unused area (since pieces are aligned to top) - styled like waste */}
                        <div
                          className="absolute bg-red-400 bg-opacity-70"
                          style={{
                            left: `${leftPercent}%`,
                            width: `${widthPercent}%`,
                            top: `${actualHeight}%`,
                            height: `${100 - actualHeight}%`,
                            backgroundImage: 'repeating-linear-gradient(45deg, #ff6b6b, #ff6b6b 8px, #ff8e8e 8px, #ff8e8e 16px)'
                          }}
                        />
                      </>
                    )}
                  </React.Fragment>
                );
              })}
              
              {plank.wasteLength > 0 && (
                <div
                  className="absolute h-full bg-red-400 bg-opacity-70 flex items-center justify-center text-red-900 text-xs font-bold"
                  style={{
                    left: `${((plank.material.length - plank.wasteLength) / plank.material.length) * 100}%`,
                    width: `${(plank.wasteLength / plank.material.length) * 100}%`,
                    backgroundImage: 'repeating-linear-gradient(45deg, #ff6b6b, #ff6b6b 8px, #ff8e8e 8px, #ff8e8e 16px)'
                  }}
                >
                  {Math.round(plank.wasteLength)}mm
                </div>
              )}
            </div>
            
            <div className="p-3 bg-gray-50 text-sm text-gray-600">
              Used: {Math.round(plank.usedLength)}mm, Waste: {Math.round(plank.wasteLength)}mm
              {plank.pieces.length > 1 && (
                <span> • {plank.pieces.length - 1} cuts ({(plank.pieces.length - 1) * plank.material.sawKerf}mm kerf)</span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white min-h-screen">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center gap-2">
          <Scissors className="text-blue-600" />
          PLANKulator - Smart OBJ Cutting Planner
        </h1>
        <p className="text-gray-600">
          Upload an OBJ file to generate an optimized cutting plan with intelligent piece orientation
        </p>
      </div>

      {/* Material Settings Panel */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Package size={20} className="text-gray-600" />
            <h3 className="font-semibold text-gray-800">Raw Materials ({materialSettings.length})</h3>
          </div>
          <button
            onClick={addMaterial}
            className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
          >
            + Add Material
          </button>
        </div>
        
        <div className="space-y-4">
          {materialSettings.map((material, index) => (
            <div key={material.id} className="bg-white p-3 rounded border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-700">Material {index + 1}</h4>
                {materialSettings.length > 1 && (
                  <button
                    onClick={() => removeMaterial(material.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                )}
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <div className="col-span-2 md:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={material.name}
                    onChange={(e) => updateMaterial(material.id, 'name', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="e.g., Triboard"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Length (mm)
                  </label>
                  <input
                    type="number"
                    value={material.length}
                    onChange={(e) => updateMaterial(material.id, 'length', parseInt(e.target.value) || 4000)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Width (mm)
                  </label>
                  <input
                    type="number"
                    value={material.width}
                    onChange={(e) => updateMaterial(material.id, 'width', parseInt(e.target.value) || 400)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Thickness (mm)
                  </label>
                  <input
                    type="number"
                    value={material.thickness}
                    onChange={(e) => updateMaterial(material.id, 'thickness', parseInt(e.target.value) || 37)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Saw Kerf (mm)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={material.sawKerf}
                    onChange={(e) => updateMaterial(material.id, 'sawKerf', parseFloat(e.target.value) || 2)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={material.pricePerUnit || ''}
                    onChange={(e) => updateMaterial(material.id, 'pricePerUnit', e.target.value ? parseFloat(e.target.value) : null)}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="Optional"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-blue-800">
          <strong>💡 Smart Material Selection:</strong> Each piece will automatically find the best-fitting material and optimal orientation to minimize waste.
        </div>
      </div>

      {/* File Upload and Requirements */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* File Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Upload size={40} className="mx-auto text-gray-400 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Upload OBJ File
          </h3>
          <p className="text-gray-600 mb-4 text-sm">
            Select a .obj file to analyze and generate a cutting plan
          </p>
          <input
            type="file"
            accept=".obj"
            onChange={handleFileUpload}
            className="hidden"
            id="obj-upload"
          />
          <label
            htmlFor="obj-upload"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors"
          >
            <FileText size={18} className="mr-2" />
            Choose OBJ File
          </label>
        </div>

        {/* OBJ File Requirements Info */}
        <div className="lg:col-span-2 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
            <Box size={16} />
            OBJ File Requirements
          </h4>
          <div className="text-sm text-blue-700 space-y-2">
            <p><strong>Important:</strong> Each piece to be cut must be a separate object in your OBJ file.</p>
            <ul className="ml-4 list-disc space-y-1">
              <li><strong>Blender:</strong> Each piece should be a separate object in the outliner</li>
              <li><strong>SketchUp:</strong> Ensure each component is a separate group/component, then export as single OBJ file</li>
              <li><strong>Fusion 360:</strong> Ensure each body/component is separate, then export all as single OBJ file</li>
              <li><strong>Sample file:</strong> <a href="/Shelves.obj" download className="text-blue-600 hover:text-blue-800 underline">Download Shelves.obj</a> to see proper structure</li>
            </ul>
            <p className="text-xs text-blue-600 mt-2">
              💡 Tip: Pieces with identical dimensions will be automatically grouped and counted together.
            </p>
          </div>
        </div>
      </div>

      {/* Project Management */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Project Notes */}
        <div className="lg:col-span-2 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote size={18} className="text-yellow-600" />
            <h3 className="font-semibold text-gray-800">Project Notes</h3>
          </div>
          <textarea
            value={projectNotes}
            onChange={(e) => setProjectNotes(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
            rows="3"
            placeholder="Add any notes about this project (e.g., special instructions, material supplier, deadline)..."
          />
          <p className="text-xs text-yellow-700 mt-2">
            These notes will be included when you print the cutting plan.
          </p>
        </div>
        
        {/* Project Actions */}
        <div className="border-2 border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Project Actions</h3>
          <div className="space-y-3">
            {/* Save Project */}
            <button
              onClick={saveProject}
              disabled={!analysisComplete}
              className="w-full px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Save size={16} />
              Save Project
            </button>
            
            {/* Load Project */}
            <label className="block">
              <input
                type="file"
                accept=".json"
                onChange={loadProject}
                className="hidden"
              />
              <div className="w-full px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors flex items-center justify-center gap-2 text-sm">
                <Upload size={16} />
                Load Project
              </div>
            </label>
            
            {/* Print */}
            <button
              onClick={printCuttingPlan}
              disabled={!analysisComplete}
              className="w-full px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <Printer size={16} />
              Print Cutting Plan
            </button>
          </div>
        </div>
      </div>

      {/* Analysis Status */}
      {isAnalyzing && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing OBJ file and calculating smart orientations...</p>
        </div>
      )}

      {/* 3D Model Viewer */}
      {objFileContent && !isAnalyzing && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Box size={20} />
            3D Model View {analysisComplete && '(Color-coded by piece)'}
          </h3>
          <OBJViewer3D 
            objContent={objFileContent} 
            pieces={pieces} 
            getPieceColor={getPieceColor}
          />
          <div className="mt-2 text-sm text-gray-600">
            • Drag to rotate • Scroll to zoom • Right-click drag to pan
          </div>
        </div>
      )}

      {/* Orientation Warnings */}
      {orientationWarnings.length > 0 && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={20} className="text-red-600" />
            <h3 className="font-semibold text-red-800">⚠️ Pieces That Don't Fit</h3>
          </div>
          <div className="space-y-2">
            {orientationWarnings.map((warning, index) => (
              <div key={index} className="text-sm text-red-700 bg-red-100 p-2 rounded">
                <strong>{warning.piece}</strong> ({warning.dims}) - {warning.issue}
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm text-red-600">
            Consider using larger raw material or splitting these pieces.
          </div>
        </div>
      )}

      {/* Pieces Summary */}
      {analysisComplete && pieces.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Calculator size={20} />
            Detected Pieces ({pieces.filter(p => p.canFit).reduce((sum, p) => sum + p.count, 0)} fit, {pieces.filter(p => !p.canFit).reduce((sum, p) => sum + p.count, 0)} don't fit)
          </h3>
          
          {/* Pieces that fit */}
          {pieces.filter(p => p.canFit).length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-green-800 mb-2">✅ Pieces that fit in cutting plan:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pieces.filter(p => p.canFit).map((piece, index) => (
                  <div key={index} className="bg-green-50 border-green-200 p-3 rounded border">
                    <div className="flex items-center gap-2 mb-1">
                      <div 
                        className="w-4 h-4 rounded border border-gray-400 flex-shrink-0"
                        style={{ backgroundColor: getPieceColor(piece) }}
                      ></div>
                      <div className="font-medium text-gray-900 text-sm">
                        {piece.name.replace(/\s*\(\d+\)$/g, '').trim() || `Piece ${index + 1}`}
                      </div>
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      Dimensions: {piece.cuttingLength}×{piece.finalWidth}×{piece.finalThickness}mm
                    </div>
                    <div className="text-xs text-blue-700 mb-1">
                      Material: {piece.material.name}
                    </div>
                    <div className="text-xs text-gray-500">
                      Quantity: {piece.count}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Pieces that don't fit */}
          {pieces.filter(p => !p.canFit).length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-red-800 mb-2">❌ Pieces that don't fit (excluded from cutting plan):</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pieces.filter(p => !p.canFit).map((piece, index) => (
                  <div key={index} className="bg-red-50 border-red-200 p-3 rounded border">
                    <div className="font-medium text-gray-900 text-sm mb-1">
                      {piece.name.replace(/[()0-9]/g, '').trim() || `Piece ${index + 1}`}
                    </div>
                    <div className="text-xs text-gray-600 mb-1">
                      Original: {piece.originalDims[0]}×{piece.originalDims[1]}×{piece.originalDims[2]}mm
                    </div>
                    <div className="text-xs text-red-700">
                      Cannot fit in any available material cross-section
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Quantity: {piece.count}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded">
                <div className="text-sm text-red-700">
                  <strong>💡 Solutions for oversized pieces:</strong>
                  <ul className="mt-1 ml-4 list-disc text-xs">
                    <li>Use larger raw material planks</li>
                    <li>Split pieces into smaller components</li>
                    <li>Redesign to fit available material dimensions</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cutting Plan */}
      {renderCuttingPlan()}

      {/* Help Text */}
      {!objFile && (
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-semibold text-yellow-800 mb-2">💡 How the Smart Multi-Material System Works:</h4>
          <ul className="text-sm text-yellow-700 space-y-1">
            <li>1. <strong>Define materials:</strong> Add multiple raw materials with different dimensions</li>
            <li>2. <strong>Upload OBJ file:</strong> The system will detect all pieces in your design</li>
            <li>3. <strong>Smart material selection:</strong> Each piece tests all materials to find the best fit</li>
            <li>4. <strong>Orientation optimization:</strong> 6 orientations tested per material for each piece</li>
            <li>5. <strong>Efficiency priority:</strong> Chooses the combination that minimizes cutting waste</li>
            <li>6. <strong>Automatic assignment:</strong> No manual selection needed - everything is optimized</li>
            <li>7. <strong>Generate plan:</strong> View the optimized cutting sequence grouped by material</li>
          </ul>
          <div className="mt-3 p-2 bg-yellow-100 rounded text-xs">
            <strong>Example:</strong> A shelf with thick structural pieces and thin shelves will automatically use thick planks for structure and thin boards for shelves, minimizing both material cost and waste.
          </div>
        </div>
      )}
    </div>
  );
};

export default OBJCuttingPlanner;