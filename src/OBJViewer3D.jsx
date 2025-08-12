import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// Component to handle camera positioning based on model bounds
const CameraController = ({ boundingBox }) => {
  const { camera, controls } = useThree();
  
  useEffect(() => {
    if (boundingBox && !boundingBox.isEmpty()) {
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      
      const maxDim = Math.max(size.x, size.y, size.z);
      
      // Position camera to see the entire model
      const fov = camera.fov * (Math.PI / 180);
      const distance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 0.8;
      
      // Position camera at a nice angle - closer to isometric view
      camera.position.set(
        center.x + distance * 0.6,
        center.y + distance * 0.8, 
        center.z + distance * 0.6
      );
      
      // Look at the center of the model
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      
      // Update orbit controls target
      if (controls) {
        controls.target.copy(center);
        controls.update();
      }
      
    }
  }, [boundingBox, camera, controls]);
  
  return null;
};

// Parse OBJ content and create geometries
const parseOBJToGeometry = (objContent) => {
  const lines = objContent.split('\n');
  const objects = [];
  let currentObject = null;
  let vertices = [];
  let allVertices = [];
  
  for (let line of lines) {
    line = line.trim();
    
    if (line.startsWith('v ')) {
      // Vertex position
      const coords = line.substring(2).trim().split(/\s+/).map(n => parseFloat(n));
      if (coords.length >= 3 && !isNaN(coords[0]) && !isNaN(coords[1]) && !isNaN(coords[2])) {
        allVertices.push(new THREE.Vector3(coords[0], coords[1], coords[2]));
      }
    } else if (line.startsWith('o ')) {
      // New object
      if (currentObject && currentObject.faces.length > 0) {
        objects.push(currentObject);
      }
      const objectName = line.substring(2).trim();
      currentObject = {
        name: objectName,
        vertices: [],
        faces: []
      };
    } else if (line.startsWith('f ')) {
      // Face definition
      if (!currentObject) {
        currentObject = {
          name: 'default',
          vertices: [],
          faces: []
        };
      }
      
      const faceData = line.substring(2).trim().split(/\s+/);
      const faceIndices = faceData.map(vertex => {
        // Handle v/vt/vn, v//vn, v/vt, or just v formats
        const parts = vertex.split('/');
        const vertexIndex = parseInt(parts[0]);
        // Convert to 0-based index
        return vertexIndex > 0 ? vertexIndex - 1 : allVertices.length + vertexIndex;
      });
      
      // Create triangles from face
      if (faceIndices.length === 3) {
        currentObject.faces.push(faceIndices);
      } else if (faceIndices.length === 4) {
        // Convert quad to two triangles
        currentObject.faces.push([faceIndices[0], faceIndices[1], faceIndices[2]]);
        currentObject.faces.push([faceIndices[0], faceIndices[2], faceIndices[3]]);
      } else if (faceIndices.length > 4) {
        // Fan triangulation for polygons with more than 4 vertices
        for (let i = 1; i < faceIndices.length - 1; i++) {
          currentObject.faces.push([faceIndices[0], faceIndices[i], faceIndices[i + 1]]);
        }
      }
    }
  }
  
  // Add the last object
  if (currentObject && currentObject.faces.length > 0) {
    objects.push(currentObject);
  }
  
  
  // Convert to Three.js geometries
  const geometries = [];
  
  objects.forEach((obj, objIndex) => {
    
    if (obj.faces.length > 0) {
      const geometry = new THREE.BufferGeometry();
      const positions = [];
      const normals = [];
      
      // Extract vertices for faces
      obj.faces.forEach((face, faceIndex) => {
        // Get the three vertices of the triangle
        const v1 = allVertices[face[0]];
        const v2 = allVertices[face[1]];
        const v3 = allVertices[face[2]];
        
        if (v1 && v2 && v3) {
          // Add vertices
          positions.push(v1.x, v1.y, v1.z);
          positions.push(v2.x, v2.y, v2.z);
          positions.push(v3.x, v3.y, v3.z);
          
          // Calculate normal
          const edge1 = new THREE.Vector3().subVectors(v2, v1);
          const edge2 = new THREE.Vector3().subVectors(v3, v1);
          const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
          
          // Add the same normal for all three vertices
          normals.push(normal.x, normal.y, normal.z);
          normals.push(normal.x, normal.y, normal.z);
          normals.push(normal.x, normal.y, normal.z);
        } else {
        }
      });
      
      if (positions.length > 0) {
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.computeBoundingBox();
        
        
        geometries.push({
          geometry: geometry,
          name: obj.name || `Piece_${objIndex}`,
          position: new THREE.Vector3(0, 0, 0)
        });
      } else {
      }
    }
  });
  
  return geometries;
};

// Component to render individual piece
const OBJPiece = ({ geometry, color, position, name }) => {
  const meshRef = useRef();
  
  return (
    <mesh ref={meshRef} geometry={geometry} position={position}>
      <meshPhongMaterial 
        color={color} 
        side={THREE.DoubleSide}
        transparent={true}
        opacity={0.9}
        polygonOffset={true}
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
      />
    </mesh>
  );
};

// Grid component that aligns with model bottom and centers on XZ
const ModelAlignedGrid = ({ boundingBox }) => {
  const gridPosition = useMemo(() => {
    if (boundingBox && !boundingBox.isEmpty()) {
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      
      // Position grid at the bottom of the centered model
      // Since model is centered at origin, bottom is at -size.y/2
      return [0, -size.y/2, 0];
    }
    return [0, -2000, 0]; // fallback
  }, [boundingBox]);

  return <gridHelper args={[10000, 50, '#888888', '#cccccc']} position={gridPosition} />;
};

// Main 3D model component
const OBJModel = ({ objContent, pieceColors }) => {
  const modelRef = useRef();
  
  // Parse OBJ content into geometries
  const { geometries, boundingBox } = useMemo(() => {
    if (!objContent) return { geometries: [], boundingBox: null };
    
    try {
      const geos = parseOBJToGeometry(objContent);
      
      // Scale to millimeters (OBJ is in meters, we want to display in mm)
      const scaleFactor = 1000;
      geos.forEach(g => {
        g.geometry.scale(scaleFactor, scaleFactor, scaleFactor);
        g.position.multiplyScalar(scaleFactor);
      });
      
      // Calculate overall bounding box
      const finalBox = new THREE.Box3();
      geos.forEach(g => {
        g.geometry.computeBoundingBox();
        const tempBox = g.geometry.boundingBox.clone();
        tempBox.translate(g.position);
        finalBox.union(tempBox);
      });
      
      return { geometries: geos, boundingBox: finalBox };
    } catch (error) {
      return { geometries: [], boundingBox: null };
    }
  }, [objContent]);
  
  // Center the model
  const modelCenter = useMemo(() => {
    if (!boundingBox || boundingBox.isEmpty()) return new THREE.Vector3(0, 0, 0);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    return center.negate();
  }, [boundingBox]);
  
  if (geometries.length === 0) {
    return null;
  }
  
  return (
    <group ref={modelRef} position={modelCenter}>
      {geometries.map((item, index) => {
        const color = pieceColors[item.name] || pieceColors[index] || '#808080';
        return (
          <OBJPiece
            key={index}
            geometry={item.geometry}
            color={color}
            position={item.position}
            name={item.name}
          />
        );
      })}
      <CameraController boundingBox={boundingBox} />
    </group>
  );
};

// Debug Component to show scene stats
const SceneDebugInfo = () => {
  const { scene, camera } = useThree();
  
  
  return null;
};

// Fit to view controller (inside Canvas)
const FitToViewController = ({ boundingBox, triggerFit }) => {
  const { camera, controls } = useThree();
  
  useEffect(() => {
    if (triggerFit && boundingBox && !boundingBox.isEmpty()) {
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);
      
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera.fov * (Math.PI / 180);
      const distance = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 0.8;
      
      camera.position.set(
        center.x + distance * 0.6,
        center.y + distance * 0.8, 
        center.z + distance * 0.6
      );
      
      camera.lookAt(center);
      camera.updateProjectionMatrix();
      
      if (controls) {
        controls.target.copy(center);
        controls.update();
      }
    }
  }, [triggerFit, boundingBox, camera, controls]);
  
  return null;
};

// Main 3D Viewer Component
const OBJViewer3D = ({ objContent, pieces, getPieceColor }) => {
  const [fitTrigger, setFitTrigger] = useState(0);
  
  // Generate color mapping for pieces
  const pieceColors = useMemo(() => {
    const colors = {};
    
    if (pieces && pieces.length > 0) {
      pieces.forEach((piece, index) => {
        // Use the same color function from the cutting plan
        const color = getPieceColor ? getPieceColor(piece) : '#808080';
        colors[piece.name] = color;
        colors[index] = color; // Fallback to index
        
        // Map piece name without special characters
        const cleanName = piece.name.replace(/[()0-9]/g, '').trim();
        colors[cleanName] = color;
        
        // Also map by piece name variations
        if (piece.pieces) {
          piece.pieces.forEach(pieceName => {
            colors[pieceName] = color;
          });
        }
      });
    }
    
    return colors;
  }, [pieces, getPieceColor]);
  
  if (!objContent) {
    return (
      <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
        <p className="text-gray-500">No OBJ file loaded</p>
      </div>
    );
  }
  
  // Get bounding box for fit-to-view button
  const modelBounds = useMemo(() => {
    if (!objContent) return null;
    
    try {
      const geos = parseOBJToGeometry(objContent);
      const scaleFactor = 1000;
      
      const finalBox = new THREE.Box3();
      geos.forEach(g => {
        g.geometry.scale(scaleFactor, scaleFactor, scaleFactor);
        g.geometry.computeBoundingBox();
        finalBox.union(g.geometry.boundingBox);
      });
      
      return finalBox;
    } catch (error) {
      return null;
    }
  }, [objContent]);

  return (
    <div className="w-full h-96 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden relative">
      {/* Fit to View button - outside Canvas */}
      {modelBounds && (
        <button 
          onClick={() => setFitTrigger(prev => prev + 1)}
          className="absolute top-2 right-2 z-10 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
        >
          Fit to View
        </button>
      )}
      
      <Canvas 
        camera={{ 
          position: [10, 10, 10], 
          fov: 25,
          near: 1,
          far: 50000
        }}
        onCreated={({ gl, camera }) => {
          gl.setClearColor('#f5f5f5');
          
          // Three.js handles depth testing automatically
          // Just ensure sortObjects is enabled for better depth sorting
          gl.sortObjects = true;
        }}
      >
        <OrbitControls 
          enablePan={true} 
          enableZoom={true} 
          enableRotate={true}
          zoomSpeed={0.5}
          panSpeed={0.5}
          rotateSpeed={0.5}
          target={[0, 0, 0]}
        />
        
        {/* Lighting */}
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1.0} />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} />
        
        {/* Debug cube to test rendering */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshPhongMaterial color="red" />
        </mesh>
        
        {/* Model */}
        <OBJModel objContent={objContent} pieceColors={pieceColors} />
        
        {/* Grid helper aligned with model bottom */}
        {modelBounds && <ModelAlignedGrid boundingBox={modelBounds} />}
        
        {/* Axes helper */}
        <axesHelper args={[1000]} />
        
        {/* Debug info */}
        <SceneDebugInfo />
        
        {/* Fit to view controller */}
        {modelBounds && <FitToViewController boundingBox={modelBounds} triggerFit={fitTrigger} />}
      </Canvas>
    </div>
  );
};

export default OBJViewer3D;