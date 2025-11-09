# Image Upload with Crop

**Category:** File Upload
**Complexity:** Complex
**Files:** 6
**Dependencies:** react-dropzone, react-easy-crop
**Estimated Time:** 7-8 minutes

## Description

Upload images with built-in cropping tool. Crop to specific aspect ratios before upload.

## Implementation

Create an image uploader with cropping functionality:

### Files to create:

- `components/ImageCropUpload.tsx` - Main component
- `components/CropModal.tsx` - Modal with crop interface
- `components/CropPreview.tsx` - Live crop preview
- `hooks/useImageCrop.ts` - Cropping logic
- `utils/imageCrop.ts` - Canvas utilities for cropping
- `types/crop.ts` - TypeScript interfaces

### Requirements:

- Drag & drop or browse to select image
- Open crop modal after image selection
- Crop interface with:
  - Draggable crop area
  - Zoom slider
  - Rotation controls
  - Aspect ratio presets (1:1, 4:3, 16:9, free)
  - Grid overlay
- Real-time preview of cropped result
- Save cropped image as Blob for upload
- Original image preserved (option to re-crop)
- Compress image after crop (quality slider)
- Show final file size
- Support for PNG, JPEG, WebP
- Cancel to start over
- Dark mode support

### Install dependencies:

```bash
npm install react-dropzone react-easy-crop
```

**Return:** Cropped image as File object ready for upload.
