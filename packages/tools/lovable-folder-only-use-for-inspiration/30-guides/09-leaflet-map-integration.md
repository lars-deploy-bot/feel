# Leaflet Map Integration for React 18

## Important Version Notice

React-Leaflet v5+ has Context API compatibility issues with React 18. This guide demonstrates using vanilla Leaflet directly with React refs for reliable map functionality.

## Complete Map Component Example

### Basic Map with Markers

```typescript
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

interface Location {
  lat: number;
  lon: number;
  name: string;
  description?: string;
}

interface MapProps {
  locations: Location[];
}

export const Map = ({ locations }: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  // Calculate center from locations
  const center: [number, number] = locations.length > 0
    ? [
        locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length,
        locations.reduce((sum, loc) => sum + loc.lon, 0) / locations.length,
      ]
    : [51.505, -0.09]; // Default: London

  useEffect(() => {
    if (!mapRef.current) return;

    // Initialize map if not already created
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView(center, 13);

      // Add OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    } else {
      // Update view if map already exists
      mapInstanceRef.current.setView(center, 13);
    }

    // Clear existing markers
    mapInstanceRef.current.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        mapInstanceRef.current?.removeLayer(layer);
      }
    });

    // Add markers for each location
    locations.forEach((location) => {
      if (mapInstanceRef.current) {
        const marker = L.marker([location.lat, location.lon]);

        const popupContent = `
          <div style="min-width: 150px;">
            <div style="font-weight: 600; margin-bottom: 4px;">
              ${location.name}
            </div>
            ${location.description ? `<div style="font-size: 12px; color: #666;">${location.description}</div>` : ''}
          </div>
        `;

        marker.bindPopup(popupContent);
        marker.addTo(mapInstanceRef.current);
      }
    });

    // Cleanup on unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [locations, center]);

  return (
    <div
      ref={mapRef}
      className="w-full h-96 rounded-lg overflow-hidden"
    />
  );
};
```

## Installation

```bash
bun add leaflet @types/leaflet
```

**Do NOT install react-leaflet** - it has React 18 compatibility issues.

## Key Implementation Details

### Marker Icon Fix

Leaflet's default marker icons don't load correctly in bundled React apps. The icon fix at the top of the file is **required**:

```typescript
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});
```

### Map Lifecycle Management

- **mapRef**: References the DOM container element
- **mapInstanceRef**: Stores the Leaflet map instance across re-renders
- **Initialize once**: Create map only if `mapInstanceRef.current` is null
- **Update on changes**: Use `setView()` to update existing map

### Marker Management

When locations change:
1. Iterate through existing layers
2. Remove all `L.Marker` instances
3. Add new markers based on updated data

This prevents duplicate markers on re-renders.

### Cleanup

Always dispose the map in the cleanup function:

```typescript
return () => {
  if (mapInstanceRef.current) {
    mapInstanceRef.current.remove();
    mapInstanceRef.current = null;
  }
};
```

## Advanced Features

### Custom Marker Icons

```typescript
const customIcon = L.icon({
  iconUrl: '/path/to/marker.png',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32],
});

L.marker([lat, lon], { icon: customIcon }).addTo(map);
```

### Interactive Popups

```typescript
marker.bindPopup(popupContent);
marker.on('click', () => {
  console.log('Marker clicked!');
});
```

### Map Events

```typescript
map.on('zoom', () => {
  console.log('Current zoom:', map.getZoom());
});

map.on('moveend', () => {
  const center = map.getCenter();
  console.log('New center:', center.lat, center.lng);
});
```

### Fit Bounds to Markers

```typescript
if (locations.length > 0) {
  const bounds = L.latLngBounds(
    locations.map(loc => [loc.lat, loc.lon])
  );
  map.fitBounds(bounds, { padding: [50, 50] });
}
```

## Alternative Tile Providers

### Mapbox (requires API key)

```typescript
L.tileLayer(
  'https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}',
  {
    attribution: '© <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox/streets-v11',
    accessToken: 'YOUR_MAPBOX_TOKEN',
    tileSize: 512,
    zoomOffset: -1,
  }
).addTo(map);
```

### Dark Mode Theme

```typescript
L.tileLayer(
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
  {
    attribution: '© OpenStreetMap, © CartoDB',
  }
).addTo(map);
```

## Common Pitfalls

### 1. React-Leaflet Compatibility

**Problem**: `render2 is not a function` error with react-leaflet v5+

**Solution**: Use vanilla Leaflet with refs (as shown in this guide)

### 2. Missing Marker Icons

**Problem**: Markers don't appear or show broken image icons

**Solution**: Apply the icon fix at the top of your component file

### 3. Memory Leaks

**Problem**: Map instances persist after component unmount

**Solution**: Always call `map.remove()` in cleanup function

### 4. Duplicate Markers

**Problem**: Markers multiply on each re-render

**Solution**: Clear existing markers before adding new ones

```typescript
mapInstanceRef.current.eachLayer((layer) => {
  if (layer instanceof L.Marker) {
    mapInstanceRef.current?.removeLayer(layer);
  }
});
```

### 5. Map Not Rendering

**Problem**: Container has zero height

**Solution**: Set explicit height in CSS or className

```tsx
<div ref={mapRef} className="h-96 w-full" />
```

## TypeScript Considerations

Install type definitions:

```bash
bun add -D @types/leaflet
```

Type the map instance:

```typescript
const mapInstanceRef = useRef<L.Map | null>(null);
```

## Performance Optimization

### Debounce Map Updates

```typescript
import { useMemo } from 'react';

const center = useMemo(() => {
  if (locations.length === 0) return [51.505, -0.09];
  return [
    locations.reduce((sum, loc) => sum + loc.lat, 0) / locations.length,
    locations.reduce((sum, loc) => sum + loc.lon, 0) / locations.length,
  ];
}, [locations]);
```

### Limit Marker Count

```typescript
const limitedLocations = locations.slice(0, 100);
```

### Cluster Large Datasets

For 100+ markers, consider using MarkerCluster plugin:

```bash
bun add leaflet.markercluster @types/leaflet.markercluster
```

---

**Note**: Vanilla Leaflet with React refs is the most reliable approach for React 18+. Avoid react-leaflet unless using an older React version or a stable backport.
