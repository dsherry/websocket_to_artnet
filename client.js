const websocketAddress = "ws://10.0.18.242";
const socket = new WebSocket(websocketAddress);

Object.defineProperty(Array.prototype, 'chunk', {
  value: function(chunkSize) {
    var R = [];
    for (var i=0; i<this.length; i+=chunkSize)
      R.push(this.slice(i,i+chunkSize));
    return R;
  }
});

let defaultText = "function draw(previousFrame, tick){\n    var vals = Array(300).fill(200);\n\n    // create a control signal ranging from 0 to 1, based on the tick\n    var speedFactor = (2 * 3.14159) * 0.0001;\n    var controlSignal = (Math.sin(speedFactor * tick) + 1) / 2.0;\n    // scale that signal to range from 0 to 99 (because we have 100 LEDs)\n    controlSignal = Math.floor(controlSignal * 100.0);\n    // set RGB for one pixel to white, based on where the control signal is\n    vals[controlSignal * 3] = 255;\n    vals[controlSignal * 3 + 1] = 255;\n    vals[controlSignal * 3 + 2] = 255;\n    return vals;\n}";

const editor = CodeMirror(document.getElementById("mount"), {
  value: defaultText,
  mode:  "javascript",
});

var ledArray = [];
var lightObjectArray = [];
var currentCode = defaultText;
var codeChanged = false;

var scene;
var renderer;
var camera;

editor.on("changes", function(){
  let userCode = editor.getValue();
  let messageDiv = document.getElementById("message");

  try {
    eval(userCode);
    currentCode = userCode;

    // reset
    codeChanged = true;
    messageDiv.innerHTML = "\n";
    messageDiv.classList.remove("error");


  } catch(err) {
    messageDiv.innerHTML = err;
    messageDiv.classList.add("error");
  }
});

function start() {
    let messageDiv = document.getElementById("message");
    let send = function() {
        try {
            if (codeChanged) {
                codeChanged = false;
            }
            eval(currentCode);
            let tick = Date.now();
            let previousFrame = ledArray;
            ledArray = eval("draw(previousFrame, tick)");
            ledArray = ledArray
                .slice(0,300)
                .map(function(num){ return Math.floor(num); })
                .map(function(num){
                    return num <= 0 ? 0 : num >= 255 ? 255 : num;
                })

            let buffer = new ArrayBuffer(300);

            for (let i = 0; i < ledArray.length; i++) {
              buffer[i] = ledArray[i];
            }

            socket.send( buffer );

        } catch(err) {
            messageDiv.innerHTML = err;
            messageDiv.classList.add("error");
        }
        requestAnimationFrame(send);
    }
    window.requestAnimationFrame(send);
};


function setupScene() {
  let canvas = document.getElementById("viz");
  let width = canvas.offsetWidth;
  let height = canvas.offsetHeight;

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera( 10,  width/height, 0.1, 1000 );
  renderer = new THREE.WebGLRenderer();

  renderer.setSize( width, height );
  camera.position.z = 300;

  canvas.appendChild( renderer.domElement );

  scene.background = new THREE.Color( 0xf0f0f0 );

	let wallMat = new THREE.MeshPhongMaterial({color: 0x888888});
  let wallGeometry = new THREE.PlaneBufferGeometry( 500, 500 );
  let wallMesh = new THREE.Mesh( wallGeometry, wallMat );
  wallMesh.receiveShadow = true;
  wallMesh.position.set(0, 0, -15);
  scene.add( wallMesh );

  let cylGeo = new THREE.CylinderBufferGeometry( 7, 7, 200, 32 );
  let cylMat = new THREE.MeshPhongMaterial({
    color: 0x222222,
    reflectivity: 0.2,
    shininess: 0,
  } );
  var cylinder = new THREE.Mesh( cylGeo, cylMat );
  cylinder.rotateZ(Math.PI / 2);
  scene.add( cylinder );

  // Create all the initial objects
  for (let i = 0; i < 100; i++) {
    let bulb = new THREE.PointLight( 0xff0000, 0.2, 30, 10 );
    let bulbGeometry = new THREE.SphereBufferGeometry( 1, 32, 32 );
    let bulbMat = new THREE.MeshStandardMaterial( {
      emissive: 0x000000,
      emissiveIntensity: 0.5,
      wireframe: true
		} );

    bulb.add( new THREE.Mesh( bulbGeometry, bulbMat ) );
    let times = 1.68;
    bulb.position.set( (-i * times) + (50 * times)
                       , Math.sin(i*times) * 10
                       , Math.cos(i*times) * 10 );
    bulb.castShadow = true;

    scene.add( bulb );
    lightObjectArray.push(bulb);
  }
}

function toRgb([r,g,b]) {
  return new THREE.Color(r,g,b);
};

function updateLightObject(lightObject, color) {
  lightObject.color = color;
  lightObject.children[0].material.color = color;
  // lightObject.children[0].material.emissive = color;
};

function animate() {
	requestAnimationFrame( animate );

  let newColors = ledArray.chunk(3).map(toRgb);
  newColors.forEach(function(color, index){
    updateLightObject(lightObjectArray[index], color);
  });

	renderer.render( scene, camera );
}

start();
setupScene();
animate();
