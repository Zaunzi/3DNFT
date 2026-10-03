import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera,Mesh,BoxGeometry,MeshBasicMaterial} from 'three';
import {updateFollowCamera} from '../src/player/followCamera.ts';
test('third-person offset never changes player position and retracts before walls',()=>{const anchor=new PerspectiveCamera(),view=new PerspectiveCamera();anchor.position.set(10,2,10);const before=anchor.position.clone();assert.equal(updateFollowCamera(view,anchor,[]),4.5);assert.equal(view.position.z,14.5);assert.ok(anchor.position.equals(before));const wall=new Mesh(new BoxGeometry(4,4,.2),new MeshBasicMaterial());wall.position.set(10,2,12);const d=updateFollowCamera(view,anchor,[wall]);assert.ok(d>1&&d<2);assert.ok(anchor.position.equals(before));wall.geometry.dispose();wall.material.dispose();});
