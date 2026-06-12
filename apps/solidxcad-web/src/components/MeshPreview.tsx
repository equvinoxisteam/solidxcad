'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { getToken } from '@/lib/api';

type MeshPreviewProps = {
  projectId: string;
  fileId: string;
  fileName: string;
  kind: string;
};

export function MeshPreview({ projectId, fileId, fileName, kind }: MeshPreviewProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let renderer: import('three').WebGLRenderer | null = null;
    let frameId = 0;

    async function load() {
      const el = mountRef.current;
      if (!el) return;

      setLoading(true);
      setError('');

      const ext = fileName.split('.').pop()?.toLowerCase() || kind;
      if (ext === 'gcode' || kind === 'gcode') {
        setError('G-code toolpaths open in the full CAD Viewer tab.');
        setLoading(false);
        return;
      }
      if (ext === 'step' || ext === 'stp' || kind === 'step') {
        setError('STEP preview uses the STL sidecar or full CAD Viewer tab.');
        setLoading(false);
        return;
      }

      try {
        const token = getToken();
        const res = await fetch(`/api/projects/${projectId}/files/${fileId}/content`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Could not load mesh file');
        const buffer = await res.arrayBuffer();

        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');

        if (disposed) return;

        while (el.firstChild) el.removeChild(el.firstChild);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1e1e1e);

        const camera = new THREE.PerspectiveCamera(45, el.clientWidth / el.clientHeight, 0.1, 5000);
        camera.position.set(80, 60, 80);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(el.clientWidth, el.clientHeight);
        el.appendChild(renderer.domElement);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;

        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 0.85);
        key.position.set(1, 2, 1);
        scene.add(key);

        const grid = new THREE.GridHelper(200, 20, 0x3c3c3c, 0x2a2a2a);
        scene.add(grid);

        let object: import('three').Object3D;

        if (ext === 'glb' || ext === 'gltf' || kind === 'glb') {
          const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
          const loader = new GLTFLoader();
          const gltf = await loader.parseAsync(buffer, '');
          object = gltf.scene;
        } else if (ext === 'stl' || kind === 'stl') {
          const { STLLoader } = await import('three/examples/jsm/loaders/STLLoader.js');
          const loader = new STLLoader();
          const geometry = loader.parse(buffer);
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0x4ec9b0,
            metalness: 0.15,
            roughness: 0.65,
          });
          object = new THREE.Mesh(geometry, material);
        } else {
          throw new Error(`Preview not supported for .${ext}`);
        }

        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        object.position.sub(center);
        scene.add(object);

        const maxDim = Math.max(size.x, size.y, size.z, 1);
        camera.position.set(maxDim * 1.4, maxDim, maxDim * 1.4);
        controls.target.set(0, 0, 0);
        controls.update();

        const animate = () => {
          if (disposed) return;
          frameId = requestAnimationFrame(animate);
          controls.update();
          renderer?.render(scene, camera);
        };
        animate();

        const onResize = () => {
          const box = mountRef.current;
          if (!box || !renderer) return;
          const w = box.clientWidth;
          const h = box.clientHeight;
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);

        setLoading(false);

        return () => {
          window.removeEventListener('resize', onResize);
        };
      } catch (err) {
        if (!disposed) {
          setError(err instanceof Error ? err.message : 'Preview failed');
          setLoading(false);
        }
      }
    }

    const cleanupResize = load();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      cleanupResize?.then?.((fn) => fn?.());
      if (renderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
      if (mount.firstChild) {
        while (mount.firstChild) mount.removeChild(mount.firstChild);
      }
    };
  }, [projectId, fileId, fileName, kind]);

  return (
    <div className="absolute inset-0">
      <div ref={mountRef} className="absolute inset-0" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-base/60">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
          <p className="text-sm text-muted max-w-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
