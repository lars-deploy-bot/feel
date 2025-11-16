# Interactive Map with Markers

**Category:** Maps
**Complexity:** Medium
**Files:** 4
**Dependencies:** leaflet, react-leaflet
**Estimated Time:** 4-5 minutes

## Description

Leaflet map with custom markers and popups. Click markers to see location details.

## Implementation

Create an interactive Leaflet map with custom markers:

### Files to create:

- `components/InteractiveMap.tsx` - Main map component
- `components/CustomMarker.tsx` - Custom marker with popup
- `components/Map.module.css` - Map styling
- `types/map.ts` - TypeScript interfaces for locations

### Requirements:

- Leaflet map with OpenStreetMap tiles
- Custom marker icons (use SVG or image)
- Click marker to open popup with:
  - Location name
  - Description
  - Optional image
  - Optional "Get Directions" link
- Map controls (zoom, fullscreen)
- Center map button to return to initial view
- Responsive map size
- Dark mode map tiles option
- Props: locations array, center coordinates, zoom level

### Install dependencies:

```bash
npm install leaflet react-leaflet @types/leaflet
```

### Example usage:

```tsx
<InteractiveMap locations={stores} center={[51.5, -0.1]} zoom={12} />
```
