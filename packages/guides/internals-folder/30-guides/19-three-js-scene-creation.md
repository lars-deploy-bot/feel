# Three.js Scene Implementation

## Basic Scene Setup

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script>
  // Initialize scene, camera, renderer
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Add lighting
  const ambientLight = new THREE.AmbientLight(0x404040);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Create geometry
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);

  camera.position.z = 5;

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    cube.rotation.x += 0.01;
    cube.rotation.y += 0.01;
    renderer.render(scene, camera);
  }
  animate();
</script>
```

## Interaction Controls

```javascript
// Mouse drag rotation
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    cube.rotation.y += (e.clientX - previousMousePosition.x) * 0.01;
    cube.rotation.x += (e.clientY - previousMousePosition.y) * 0.01;
  }
  previousMousePosition = { x: e.clientX, y: e.clientY };
});

// Zoom with mouse wheel
document.addEventListener('wheel', (e) => {
  camera.position.z += e.deltaY * 0.01;
  camera.position.z = Math.max(2, Math.min(10, camera.position.z));
});
```

## Responsive Handling

```javascript
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
```
