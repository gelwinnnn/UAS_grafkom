import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js';

import {FBXLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/FBXLoader.js';
import {GLTFLoader} from 'https://cdn.jsdelivr.net/npm/three@0.118.1/examples/jsm/loaders/GLTFLoader.js';
// import { ThreeMFLoader } from './three/examples/jsm/Addons.js';


class BasicCharacterControllerProxy {
	constructor(animations) {
		this._animations = animations;
	}

	get animations() {
		return this._animations;
	}
};


class BasicCharacterController {
	constructor(params, cur) {
		this._Init(params);
		this._cur = cur;
	}

	_Init(params) {
		this._params = params;
		this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0);
		this._acceleration = new THREE.Vector3(1, 0.25, 50.0);
		this._velocity = new THREE.Vector3(0, 0, 0);
		this._position = new THREE.Vector3();
		this._firstCollide = true;
		this._collideProblem = false;

		this._animations = {};
		this._input = new BasicCharacterControllerInput();
		this._stateMachine = new CharacterFSM(
			new BasicCharacterControllerProxy(this._animations));

		this._LoadModels();
	}

	_LoadModels() {
		const loader = new FBXLoader();
		loader.setPath('./resources/car/low_poly_car/Car-Model/');
		loader.load('Car.fbx', (fbx) => {
		fbx.scale.setScalar(0.01);
		fbx.traverse(c => {
			c.castShadow = true;
			c.receiveShadow = true;
		});

		this._target = fbx;
		this._params.scene.add(this._target);

		var carOuter = new THREE.Mesh(
			new THREE.BoxGeometry(3, 4, 3),
			new THREE.MeshBasicMaterial({color:0xffffff})
		)
		carOuter.material.transparent = true;
		carOuter.material.opacity = 0.4;
		carOuter.position.set(0, 0, 0)
		// this._params.scene.add(carOuter);
		this._carOuter = carOuter;

		let carBB = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
		carBB.setFromObject(carOuter);
		this._BB = carBB;


		this._mixer = new THREE.AnimationMixer(this._target);

		this._manager = new THREE.LoadingManager();
		this._manager.onLoad = () => {
			this._stateMachine.SetState('idle');
		};

		const _OnLoad = (animName, anim) => {
			const clip = anim.animations[0];
			const action = this._mixer.clipAction(clip);

			this._animations[animName] = {
			clip: clip,
			action: action,
			};
		};

		const loader = new FBXLoader(this._manager);
		loader.setPath('./resources/car/low_poly_car/Car-Model/');
		loader.load('walk.fbx', (a) => { _OnLoad('walk', a); });
		loader.load('run.fbx', (a) => { _OnLoad('run', a); });
		loader.load('idle.fbx', (a) => { _OnLoad('idle', a); });
		loader.load('dance.fbx', (a) => { _OnLoad('dance', a); });
		});
	}

	get Position() {
		return this._position;
	}

	get Rotation() {
		if (!this._target) {
		return new THREE.Quaternion();
		}
		return this._target.quaternion;
	}

	Update(timeInSeconds) {
		if (!this._stateMachine._currentState) {
		return;
		}		

		this._stateMachine.Update(timeInSeconds, this._input);

		let isCollide = this._cur.isCarCollide();
		if(isCollide && this._firstCollide){
			this._acceleration.x *= -1;
			this._acceleration.y *= -1;
			this._acceleration.z *= -1;
			this._velocity.x *= -10;
			this._velocity.y *= -10;
			this._velocity.z *= -10;
			this._firstCollide = false;
			this._collideProblem = true;
		}
		else if(!isCollide && this._collideProblem){
			this._collideProblem = false;
			this._acceleration.x *= -1;
			this._acceleration.y *= -1;
			this._acceleration.z *= -1;
			this._velocity.x *= -0.1;
			this._velocity.y *= -0.1;
			this._velocity.z *= -0.1;
		}
		else if(!isCollide){
			this._firstCollide = true;
		}

		const velocity = this._velocity;
		const frameDecceleration = new THREE.Vector3(
			velocity.x * this._decceleration.x,
			velocity.y * this._decceleration.y,
			velocity.z * this._decceleration.z
		);
		frameDecceleration.multiplyScalar(timeInSeconds);
		frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(
			Math.abs(frameDecceleration.z), Math.abs(velocity.z));

		velocity.add(frameDecceleration);

		const controlObject = this._target;
		const _Q = new THREE.Quaternion();
		const _A = new THREE.Vector3();
		const _R = controlObject.quaternion.clone();

		const acc = this._acceleration.clone();
		if (this._input._keys.shift) {
		acc.multiplyScalar(2.0);
		}

		if (this._stateMachine._currentState.Name == 'dance') {
		acc.multiplyScalar(0.0);
		}

		if (this._input._keys.forward) {
		velocity.z += acc.z * timeInSeconds;
		}
		if (this._input._keys.backward) {
		velocity.z -= acc.z * timeInSeconds;
		}
		if (this._input._keys.left) {
		_A.set(0, 1, 0);
		_Q.setFromAxisAngle(_A, 4.0 * Math.PI * timeInSeconds * this._acceleration.y);
		_R.multiply(_Q);
		}
		if (this._input._keys.right) {
		_A.set(0, 1, 0);
		_Q.setFromAxisAngle(_A, 4.0 * -Math.PI * timeInSeconds * this._acceleration.y);
		_R.multiply(_Q);
		}

		controlObject.quaternion.copy(_R);

		const oldPosition = new THREE.Vector3();
		oldPosition.copy(controlObject.position);

		const forward = new THREE.Vector3(0, 0, 1);
		forward.applyQuaternion(controlObject.quaternion);
		forward.normalize();

		const sideways = new THREE.Vector3(1, 0, 0);
		sideways.applyQuaternion(controlObject.quaternion);
		sideways.normalize();

		sideways.multiplyScalar(velocity.x * timeInSeconds);
		forward.multiplyScalar(velocity.z * timeInSeconds);

		controlObject.position.add(forward);
		controlObject.position.add(sideways);

		this._position.copy(controlObject.position);

		this._carOuter.position.x = this._position.x;
		this._carOuter.position.y = this._position.y;
		this._carOuter.position.z = this._position.z;

		this._BB.copy(this._carOuter.geometry.boundingBox).applyMatrix4(controlObject.matrixWorld);

		if (this._mixer) {
		this._mixer.update(timeInSeconds);
		}
	}
};

class BasicCharacterControllerInput {	
	constructor() {
		this._Init();    
	}

	_Init() {
		this._keys = {
		forward: false,
		backward: false,
		left: false,
		right: false,
		space: false,
		shift: false,
		};
		document.addEventListener('keydown', (e) => this._onKeyDown(e), false);
		document.addEventListener('keyup', (e) => this._onKeyUp(e), false);
	}

	_onKeyDown(event) {
		switch (event.keyCode) {
		case 87: // w
			this._keys.forward = true;
			break;
		case 65: // a
			this._keys.left = true;
			break;
		case 83: // s
			this._keys.backward = true;
			break;
		case 68: // d
			this._keys.right = true;
			break;
		case 32: // SPACE
			this._keys.space = true;
			break;
		case 16: // SHIFT
			this._keys.shift = true;
			break;
		}
	}

	_onKeyUp(event) {
		switch(event.keyCode) {
		case 87: // w
			this._keys.forward = false;
			break;
		case 65: // a
			this._keys.left = false;
			break;
		case 83: // s
			this._keys.backward = false;
			break;
		case 68: // d
			this._keys.right = false;
			break;
		case 32: // SPACE
			this._keys.space = false;
			break;
		case 16: // SHIFT
			this._keys.shift = false;
			break;
		}
	}

	_onMouseDown(event) {
		// switch(event.)
	}
};


class FiniteStateMachine {
	constructor() {
		this._states = {};
		this._currentState = null;
	}

	_AddState(name, type) {
		this._states[name] = type;
	}

	SetState(name) {
		const prevState = this._currentState;
		
		if (prevState) {
		if (prevState.Name == name) {
			return;
		}
		prevState.Exit();
		}

		const state = new this._states[name](this);

		this._currentState = state;
		state.Enter(prevState);
	}

	Update(timeElapsed, input) {
		if (this._currentState) {
		this._currentState.Update(timeElapsed, input);
		}
	}
};


class CharacterFSM extends FiniteStateMachine {
	constructor(proxy) {
		super();
		this._proxy = proxy;
		this._Init();
	}

	_Init() {
		this._AddState('idle', IdleState);
		this._AddState('walk', WalkState);
		this._AddState('run', RunState);
		// this._AddState('dance', DanceState);
	}
};


class State {
	constructor(parent) {
		this._parent = parent;
	}

	Enter() {}
	Exit() {}
	Update() {}
};


class DanceState extends State {
	constructor(parent) {
		super(parent);

		this._FinishedCallback = () => {
		this._Finished();
		}
	}

	get Name() {
		return 'dance';
	}

	Enter(prevState) {
		const curAction = this._parent._proxy._animations['dance'].action;
		const mixer = curAction.getMixer();
		mixer.addEventListener('finished', this._FinishedCallback);

		if (prevState) {
		const prevAction = this._parent._proxy._animations[prevState.Name].action;

		curAction.reset();  
		curAction.setLoop(THREE.LoopOnce, 1);
		curAction.clampWhenFinished = true;
		curAction.crossFadeFrom(prevAction, 0.2, true);
		curAction.play();
		} else {
		curAction.play();
		}
	}

	_Finished() {
		this._Cleanup();
		this._parent.SetState('idle');
	}

	_Cleanup() {
		const action = this._parent._proxy._animations['dance'].action;
		
		action.getMixer().removeEventListener('finished', this._CleanupCallback);
	}

	Exit() {
		this._Cleanup();
	}

	Update(_) {
	}
};


class WalkState extends State {
	constructor(parent) {
	super(parent);
	}

	get Name() {
	return 'walk';
	}

	Enter(prevState) {
	const curAction = this._parent._proxy._animations['walk'].action;
	if (prevState) {
	const prevAction = this._parent._proxy._animations[prevState.Name].action;

	curAction.enabled = true;

	if (prevState.Name == 'run') {
		const ratio = curAction.getClip().duration / prevAction.getClip().duration;
		curAction.time = prevAction.time * ratio;
	} else {
		curAction.time = 0.0;
		curAction.setEffectiveTimeScale(1.0);
		curAction.setEffectiveWeight(1.0);
	}

	curAction.crossFadeFrom(prevAction, 0.5, true);
	curAction.play();
	} else {
	curAction.play();
	}
	}

	Exit() {
	}

	Update(timeElapsed, input) {
	if (input._keys.forward || input._keys.backward) {
	if (input._keys.shift) {
		this._parent.SetState('run');
	}
	return;
	}

	this._parent.SetState('idle');
	}
};


class RunState extends State {
	constructor(parent) {
		super(parent);
	}

	get Name() {
		return 'run';
	}

	Enter(prevState) {
		const curAction = this._parent._proxy._animations['run'].action;
		if (prevState) {
		const prevAction = this._parent._proxy._animations[prevState.Name].action;

		curAction.enabled = true;

		if (prevState.Name == 'walk') {
			const ratio = curAction.getClip().duration / prevAction.getClip().duration;
			curAction.time = prevAction.time * ratio;
		} else {
			curAction.time = 0.0;
			curAction.setEffectiveTimeScale(1.0);
			curAction.setEffectiveWeight(1.0);
		}

		curAction.crossFadeFrom(prevAction, 0.5, true);
		curAction.play();
		} else {
			curAction.play();
		}
	}

	Exit() {
	}

	Update(timeElapsed, input) {
		if (input._keys.forward || input._keys.backward) {
		if (!input._keys.shift) {
			this._parent.SetState('walk');
		}
		return;
		}

		this._parent.SetState('idle');
	}
};


class IdleState extends State {
	constructor(parent) {
		super(parent);
	}

	get Name() {
		return 'idle';
	}

	Enter(prevState) {
		const idleAction = this._parent._proxy._animations['idle'].action;
		if (prevState) {
		const prevAction = this._parent._proxy._animations[prevState.Name].action;
		idleAction.time = 0.0;
		idleAction.enabled = true;
		idleAction.setEffectiveTimeScale(1.0);
		idleAction.setEffectiveWeight(1.0);
		idleAction.crossFadeFrom(prevAction, 0.5, true);
		idleAction.play();
		} else {
		idleAction.play();
		}
	}

	Exit() {
	}

	Update(_, input) {
		if (input._keys.forward || input._keys.backward) {
		this._parent.SetState('walk');
		} else if (input._keys.space) {
		this._parent.SetState('dance');
		}
	}
};


class ThirdPersonCamera {
	constructor(params) {
		this._params = params;
		this._camera = params.camera;
		this._mode = 0;
		this._zoom = 0;
		this._isAnimating = true;

		this._currentPosition = new THREE.Vector3();
		this._currentLookat = new THREE.Vector3();

		window.addEventListener('keypress', (e) => {
			if (e.key === 'q') {
				this._mode = (this._mode + 1	) % 2;
			}
		});

		window.addEventListener('wheel', (e) => {
			e.preventDefault(); // Prevent the default scroll behavior
			if (e.deltaY < 0) {
				this._zoom++;
				if (this._zoom > 5) this._zoom = 5;
			} else {
				this._zoom--;
				if (this._zoom < -5) this._zoom = -5;
			}
		}, { passive: false });

		const keyframes = [
			{ start: { x: 10, y: 30, z: 10 }, end: { x: 0, y: 10, z: 20 } },
			{ start: { x: 30, y: 10, z: -30 }, end: { x: 10, y: 10, z: 10 } },
			{ start: { x: -30, y: 30, z: 30 }, end: { x: -10, y: 5, z: -10 } },
			{ start: { x: -10, y: 5, z: -10 }, end: { x: -30, y: 5, z: 10 } },
			{ start: { x: 25, y: 20, z: -10}, end: { x: -30, y:20, z: -10}},
		];
		const duration = 15000;
		const tweens = [];

		for (let i = 0; i < keyframes.length; i++) {
			const { start, end } = keyframes[i];

			const tween = new TWEEN.Tween(start)
				.to(end, duration / keyframes.length)
				.easing(TWEEN.Easing.Quadratic.InOut)
				.onUpdate(() => {
					this._camera.position.set(start.x, start.y, start.z);
					this._camera.lookAt(0, 0, 0);
				});

			tweens.push(tween);
		}
		for (let i = 0; i < tweens.length - 1; i++) {
			tweens[i].chain(tweens[i + 1]);
		}

		tweens[0].start();
		tweens[tweens.length - 1].onComplete(() => {
			this._isAnimating = false;
		});
	}

	_CalculateIdealOffset() {
		const idealOffset = new THREE.Vector3(0, 5, -15);
		idealOffset.applyQuaternion(this._params.target.Rotation);
		idealOffset.add(this._params.target.Position);
		return idealOffset;
	}

	_CalculateIdealLookat() {
		const idealLookat = new THREE.Vector3(0, 10, 50);
		idealLookat.applyQuaternion(this._params.target.Rotation);
		idealLookat.add(this._params.target.Position);
		return idealLookat;
	}

	Update(timeElapsed) {
		TWEEN.update();

		if (!this._isAnimating) {
			const idealOffset = this._CalculateIdealOffset();
			const idealLookat = this._CalculateIdealLookat();

			const t = 1.0 - Math.pow(0.001, timeElapsed);

			this._currentPosition.lerp(idealOffset, t);
			this._currentLookat.lerp(idealLookat, t);

			if (this._mode === 0) {
				this._camera.position.copy(this._currentPosition);
			} else if (this._mode === 1) {
				this._camera.position.copy(this._params.target.Position);
				this._camera.position.y += 2;
			}

			let vec = new THREE.Vector3(
				this._currentLookat.x - this._camera.position.x,
				this._currentLookat.y - this._camera.position.y,
				this._currentLookat.z - this._camera.position.z
			);
			let mul = this._zoom * 0.02;

			this._camera.position.x += vec.x * mul;
			this._camera.position.y += vec.y * mul;
			this._camera.position.z += vec.z * mul;

			this._camera.lookAt(this._currentLookat);
		}
	}
}



class Demo {
	constructor() {
		this._Initialize();
	}

	async _Initialize() {
	
		this._trees = []
		this._treesBB = []
		this._invisibleBoxes = [];
		this._threejs = new THREE.WebGLRenderer({
		antialias: true,
		});
		this._threejs.outputEncoding = THREE.sRGBEncoding;
		this._threejs.shadowMap.enabled = true;
		this._threejs.shadowMap.type = THREE.PCFSoftShadowMap;
		this._threejs.setPixelRatio(window.devicePixelRatio);
		this._threejs.setSize(window.innerWidth, window.innerHeight);

		document.body.appendChild(this._threejs.domElement);

		window.addEventListener('resize', () => {
		this._OnWindowResize();
		}, false);

		const fov = 60;
		const aspect = 1920 / 1080;
		const near = 1.0;
		const far = 1000.0;
		this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
		this._camera.position.set(25, 10, 25);

		this._scene = new THREE.Scene();

		let light = new THREE.DirectionalLight(0xFFFFFF, 1.0);
		light.position.set(300, 100, 200);
		light.target.position.set(0, 0, 0);
		light.castShadow = true;
		light.receiveShadow = true;
		light.shadow.bias = -0.001;
		light.shadow.mapSize.width = 8192;
		light.shadow.mapSize.height = 8192;
		light.shadow.camera.near = 0.1;
		light.shadow.camera.far = 500.0;
		light.shadow.camera.near = 0.5;
		light.shadow.camera.far = 500.0;
		light.shadow.camera.left = 110;
		light.shadow.camera.right = -110;
		light.shadow.camera.top = 110;
		light.shadow.camera.bottom = -110;
		this._scene.add(light);

		light = new THREE.AmbientLight(0xFFFFFF, 0.25);
		this._scene.add(light);

		const loader = new THREE.CubeTextureLoader();
		const texture = loader.load([
			'./resources/posx.jpg',
			'./resources/negx.jpg',
			'./resources/posy.jpg',
			'./resources/negy.jpg',
			'./resources/posz.jpg',
			'./resources/negz.jpg',
		]);
		texture.encoding = THREE.sRGBEncoding;
		this._scene.background = texture;

		const plane = new THREE.Mesh(
			new THREE.PlaneGeometry(100, 100, 10, 10),
			new THREE.MeshStandardMaterial({
				color: 0x808080,
			}));
		plane.castShadow = true;
		plane.receiveShadow = true;
		plane.rotation.x = -Math.PI / 2;
		plane.position.set(0,-1,0);
		// this._scene.add(plane);

		function generateTree(cur, xpos=0, zpos=0, scale=5){
			const fbxLoader = new FBXLoader();
			fbxLoader.setPath('./resources/Tree/');
			fbxLoader.load('Tree.fbx', (c) => {
				c.scale.setScalar(scale);
				c.traverse(x => {
					x.castShadow = true;
					x.receiveShadow = true;
				});
				c.position.set(xpos, 0, zpos);
				cur._scene.add(c);
				cur._trees.push(c);

				let treeOuter = new THREE.Mesh(
					new THREE.BoxGeometry(3.5, 4, 3.5),
					new THREE.MeshBasicMaterial({color:0xffffff})
				)
				treeOuter.position.set(xpos, 0, zpos);
				// cur._scene.add(treeOuter);

				let treeBB = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
				treeBB.setFromObject(treeOuter);
				cur._treesBB.push(treeBB);
			});
		}

		function generateInvisWall(cur, xpos = 0, ypos = 0, zpos = 0, width = 1, height = 1, depth = 1) {			
			const geometry = new THREE.BoxGeometry(width, height, depth);

			//ganti opacity ke 0 biar invis
			const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 });
		
			const invisibleBox = new THREE.Mesh(geometry, material);
		
			// Set position 
			invisibleBox.position.set(xpos, ypos, zpos);

			cur._scene.add(invisibleBox);
		
			// Create a Box3 to represent the bounding box
			let boundingBox = new THREE.Box3(new THREE.Vector3(), new THREE.Vector3());
			boundingBox.setFromObject(invisibleBox);
		
			// Add the bounding box to the array
			cur._treesBB.push(boundingBox);
		
			// Optionally store the invisible box for further manipulation
			cur._invisibleBoxes.push(invisibleBox);
		}

		function getRandomBetween(a, b) {
			return Math.random() * (b - a) + a;
		}

		function generateCloud(cur){
			let url = [
				'Cloud_Large.fbx',
				'Cloud_Large2.fbx',
				'Cloud_Long.fbx',
				'Cloud_Long2.fbx',
				'Cloud_Long3.fbx',
				'Cloud_Medium.fbx',
				'Cloud_Medium2.fbx',
				'Cloud_Small.fbx',
				'Cloud_Small2.fbx',
				'Cloud_Small3.fbx',
			]
			let idx = url[Math.floor(getRandomBetween(0, 10))];
			var loader = new FBXLoader();
			loader.setPath('./resources/cloud/fbx/');
	
			loader.load(idx, (cl) => {
				cl.scale.setScalar(0.05);
				cl.position.set(getRandomBetween(-47, 47), getRandomBetween(20, 50), getRandomBetween(-87, 18));

				cl.traverse((child) => {
					if (child.isMesh) {
						child.material.transparent = true;
						child.material.opacity = getRandomBetween(0.4, 0.7);
						child.receiveShadow = true;
					}
				});
				cur._scene.add(cl);
			});
		}
		
		generateTree(this, 9, 22);
		generateTree(this, -10, -30, 10);
		generateTree(this, -25, -80);

		// Generate invisible box
		generateInvisWall(this, 18,4,0, 8,10,100);
		generateInvisWall(this, -2,4,29, 100,10,10);
		generateInvisWall(this, -52,4,29, 8,10,300);
		generateInvisWall(this, 0,4,-93, 100,10,8);
		generateInvisWall(this, 52.5,4,-70, 8,10,50);
		generateInvisWall(this, 39,4,-47, 50,10,8);

		for(let i = 0;i<10;i++) generateCloud(this);

		this._mixers = [];
		this._previousRAF = null;

		this._LoadAnimatedModel();
		this._LoadModel();
		this._RAF();
	}

	_LoadAnimatedModel() {
		const params = {
		camera: this._camera,
		scene: this._scene,
		}
		this._controls = new BasicCharacterController(params, this);

		this._thirdPersonCamera = new ThirdPersonCamera({
		camera: this._camera,
		target: this._controls,
		});
	}

	_LoadModel() {
		const loader = new GLTFLoader();
		loader.load('./resources/track.glb', (gltf) => {
		gltf.scene.traverse(c => {
			c.castShadow = true;
			c.receiveShadow = true;
			c.position.set(0,0.019,0);
		});
		this._scene.add(gltf.scene);
		});
	}

	_OnWindowResize() {
		this._camera.aspect = window.innerWidth / window.innerHeight;
		this._camera.updateProjectionMatrix();
		this._threejs.setSize(window.innerWidth, window.innerHeight);
	}

	_RAF() {
		requestAnimationFrame((t) => {
		if (this._previousRAF === null) {
			this._previousRAF = t;
		}

		this._RAF();

		this._threejs.render(this._scene, this._camera);
		this._Step(t - this._previousRAF);
		this._previousRAF = t;

		});
	}

	_Step(timeElapsed) {
		const timeElapsedS = timeElapsed * 0.001;
		if (this._mixers) {
		this._mixers.map(m => m.update(timeElapsedS));
		}

		if (this._controls) {
		this._controls.Update(timeElapsedS);
		}

		this._thirdPersonCamera.Update(timeElapsedS);
	}

	isCarCollide(){
		let ans = false;

		for(let i = 0; i < this._treesBB.length;i++){
			if(this._treesBB[i].intersectsBox(this._controls._BB)){
				ans = true;
			}
		}
		return ans;
	}
}

let _APP = null;

window.addEventListener('DOMContentLoaded', () => {
	_APP = new Demo();
});


function _LerpOverFrames(frames, t) {
	const s = new THREE.Vector3(0, 0, 0);
	const e = new THREE.Vector3(100, 0, 0);
	const c = s.clone();

	for (let i = 0; i < frames; i++) {
		c.lerp(e, t);
	}
	return c;
}

function _TestLerp(t1, t2) {
	const v1 = _LerpOverFrames(100, t1);
	const v2 = _LerpOverFrames(50, t2);
}

_TestLerp(0.01, 0.01);
_TestLerp(1.0 / 100.0, 1.0 / 50.0);
_TestLerp(1.0 - Math.pow(0.3, 1.0 / 100.0), 1.0 - Math.pow(0.3, 1.0 / 50.0));