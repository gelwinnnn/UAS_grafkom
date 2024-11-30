
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.118/build/three.module.js'
import * as CANNON from '../resources/node_modules/cannon-es/dist/cannon-es.js';
import CannonDebugger from '../resources/node_modules/cannon-es-debugger/dist/cannon-es-debugger.js';

export class Map {
    constructor() {
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

        this._Initialize();

    }
    
    _Initialize() { 
        this._CreateCannonCircle(8, 8, 8, -97, 10, -130);
    }

    _CreateCannonCircle(radius, posX, posY, posZ) {
        const segments = 64;
        const cylinderShape = new CANNON.Cylinder(radius, radius, 0.1, segments);
            
        const cylinderBody = new CANNON.Body({ mass: 0, type: CANNON.Body.STATIC });
        cylinderBody.addShape(cylinderShape);
        cylinderBody.position.set(posX, posY, posZ);
        this._world.addBody(cylinderBody); // Menambahkan tubuh fisika ke dalam dunia simulasi
    };
}

    

    


