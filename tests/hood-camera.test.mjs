import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Vector3} from 'three';
import {shoulderFrame} from '../src/lib/hood-camera.ts';

test('on-foot shoulder camera leaves the avatar left of the crosshair at every heading',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  const player=new Vector3(8,.1,11),pivot=new Vector3(),focus=new Vector3(),position=new Vector3();
  shoulderFrame(player,yaw,.16,false,pivot,focus,position);
  const camera=new PerspectiveCamera(57,16/9,.1,220);camera.position.copy(position);camera.lookAt(focus);camera.updateMatrixWorld();
  const torso=player.clone().add(new Vector3(0,1.3,0)).project(camera);
  assert.ok(torso.x<-.15&&torso.x>-.5,`heading ${yaw}: ${torso.x}`);
  assert.ok(Math.abs(focus.clone().project(camera).x)<1e-6);
 }
});
test('driving retains a centered chase camera',()=>{
 const player=new Vector3(),pivot=new Vector3(),focus=new Vector3(),position=new Vector3();
 shoulderFrame(player,0,.16,true,pivot,focus,position);
 assert.equal(focus.x,0);assert.equal(position.x,0);assert.ok(Math.abs(position.distanceTo(focus)-9)<1e-6);
});

test('interior framing stays below the ceiling and keeps the reticle clear',()=>{
 const player=new Vector3(0,.1,0),pivot=new Vector3(),focus=new Vector3(),position=new Vector3();
 shoulderFrame(player,Math.PI,.16,false,pivot,focus,position,true);
 assert.ok(Math.abs(position.distanceTo(focus)-2.7)<1e-6);
 assert.ok(position.y<4.5);
 const camera=new PerspectiveCamera(57,16/9,.1,220);camera.position.copy(position);camera.lookAt(focus);camera.updateMatrixWorld();
 assert.ok(player.clone().add(new Vector3(0,1.3,0)).project(camera).x<-.15);
});
