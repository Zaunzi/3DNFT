import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ExperienceRegistry } from '../src/items/rendering.ts';
import { ObjectRegistry } from '../src/objects/registry.ts';

test('portal previews accept validity materials while placed portals keep animating', () => {
  const portals = new ExperienceRegistry(), objects = new ObjectRegistry();
  const preview = portals.portal(), placed = portals.portal();
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const renderCallbacks = (group: THREE.Group) => group.traverse(object => {
    if (object instanceof THREE.Mesh) {
      const material = object.material as THREE.Material;
      object.onBeforeRender({} as THREE.WebGLRenderer, scene, camera, object.geometry, material, null);
    }
  });
  try {
    let surface: THREE.ShaderMaterial | undefined;
    placed.traverse(object => { if (object instanceof THREE.Mesh && object.material instanceof THREE.ShaderMaterial) surface = object.material; });
    assert.ok(surface);
    for (const valid of [true, false, true]) {
      surface.uniforms.time.value = -1;
      objects.setPreviewValid(preview, valid);
      assert.doesNotThrow(() => renderCallbacks(preview));
      assert.equal(surface.uniforms.time.value, -1, 'preview must not mutate shared portal shader');
      renderCallbacks(placed);
      assert.ok(surface.uniforms.time.value >= 0, 'placed portal still animates');
    }
  } finally { objects.dispose(); portals.dispose(); }
});
