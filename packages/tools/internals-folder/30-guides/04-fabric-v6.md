# Fabric.js Version 6 Implementation Guide

## Important Version Notice

Fabric.js v6 introduces breaking API changes. This guide covers the updated implementation patterns.

## Complete Canvas Example

### Component Structure

```typescript
import { useEffect, useRef, useState } from "react";
import { Canvas as FabricCanvas, Circle, Rect } from "fabric";
import { Toolbar } from "./Toolbar";
import { ColorPicker } from "./ColorPicker";
import { toast } from "sonner";

export const Canvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);
  const [activeColor, setActiveColor] = useState("#000000");
  const [activeTool, setActiveTool] = useState<"select" | "draw" | "rectangle" | "circle">("select");

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: 800,
      height: 600,
      backgroundColor: "#ffffff",
    });

    // Critical: Initialize brush immediately after canvas creation
    canvas.freeDrawingBrush.color = activeColor;
    canvas.freeDrawingBrush.width = 2;

    setFabricCanvas(canvas);
    toast("Canvas ready! Start drawing!");

    return () => {
      canvas.dispose();
    };
  }, []);

  // Handle tool changes
  useEffect(() => {
    if (!fabricCanvas) return;

    fabricCanvas.isDrawingMode = activeTool === "draw";
    
    if (activeTool === "draw" && fabricCanvas.freeDrawingBrush) {
      fabricCanvas.freeDrawingBrush.color = activeColor;
      fabricCanvas.freeDrawingBrush.width = 2;
    }
  }, [activeTool, activeColor, fabricCanvas]);

  // Tool selection handler
  const handleToolClick = (tool: typeof activeTool) => {
    setActiveTool(tool);

    if (tool === "rectangle") {
      const rect = new Rect({
        left: 100,
        top: 100,
        fill: activeColor,
        width: 100,
        height: 100,
      });
      fabricCanvas?.add(rect);
    } else if (tool === "circle") {
      const circle = new Circle({
        left: 100,
        top: 100,
        fill: activeColor,
        radius: 50,
      });
      fabricCanvas?.add(circle);
    }
  };

  // Clear canvas
  const handleClear = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = "#ffffff";
    fabricCanvas.renderAll();
    toast("Canvas cleared!");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 items-center">
        <Toolbar 
          activeTool={activeTool} 
          onToolClick={handleToolClick} 
          onClear={handleClear} 
        />
        <ColorPicker color={activeColor} onChange={setActiveColor} />
      </div>
      <div className="border border-gray-200 rounded-lg shadow-lg overflow-hidden">
        <canvas ref={canvasRef} className="max-w-full" />
      </div>
    </div>
  );
};
```

## Key Implementation Details

### Canvas Initialization
- Create FabricCanvas instance with explicit dimensions
- Initialize freeDrawingBrush immediately after canvas creation
- Set default brush properties before any user interaction

### Drawing Mode Management
- Toggle `isDrawingMode` based on active tool
- Update brush properties whenever tool or color changes
- Maintain brush configuration even when switching tools

### Shape Creation
- Use constructor pattern: `new Rect()`, `new Circle()`
- Add shapes to canvas using `canvas.add()`
- Set initial position and styling properties

### Cleanup
- Always dispose canvas in cleanup function
- Prevents memory leaks in React applications

## Critical Differences from v5

1. **Import Pattern**: Import shape classes directly from 'fabric'
2. **Brush Initialization**: Must initialize brush immediately after canvas creation
3. **Drawing Mode**: Use `isDrawingMode` boolean property
4. **Shape Instantiation**: Use `new` keyword with shape constructors

## Common Pitfalls

- **Forgetting brush initialization**: Causes drawing mode to fail
- **Late brush configuration**: Set brush properties before enabling drawing mode
- **Missing cleanup**: Always dispose canvas in useEffect cleanup

---

**Note**: Fabric.js v6 requires immediate brush initialization - don't delay this setup or drawing mode won't function correctly.
