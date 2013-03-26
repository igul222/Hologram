var fov = 40;
var canvasWidth = 1080/8;
var canvasHeight = 1920/16;
var vidWidth = 1080/4;
var vidHeight = 1920/4;
var tiltSpeed = 0.1;
var tiltAmount = 0.9;
var camera, scene, renderer;
var mouseX = 0;
var mouseY = 0;
var keyboard;
var windowHalfX, windowHalfY;
var video, videoTexture;
var world3D;
var geometry;
var vidCanvas;
var ctx;
var pixels;
var max=0;
var averageLightness;
var totalLightness;
var averageLightnessLast;
var totalLightnessLast;
var pixelsLast;
var last = false;
var interval;
var status = false;
var captured = false;
var noisePosn = 0;
var wireMaterial;
var meshMaterial;
var whiteMaterial;
var container;
var params;
var title, info, prompt;

//start the show
$(function() {
  init();
});

function WCMParams() {
  this.zoom = 1;
  this.mOpac = 1;
  this.wfOpac = 0.1;
  this.contrast = 3;
  this.saturation = 1;
  this.invertZ = false;
  this.zDepth = 800;
  this.noiseStrength = 200;
  this.noiseScale = 0.01;
  this.noiseSpeed = 0.02;
  this.intervalDuration = 100;
  //this.doSnapshot = function() {};
}

function init(){

  params = new WCMParams();

  container = document.querySelector('#container');

  //init 3d
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 1, 5000);
  camera.target = new THREE.Vector3(0,0,0);
  scene.add(camera);
  camera.position.z = 600;
  world3D = new THREE.Object3D();
  scene.add(world3D);


  var image1 = new Image(); 
  image1.src = $('#image1')[0].src; 
  imageTexture = new THREE.Texture(image1);
  image1.tex = imageTexture;
  image1.tex.needsUpdate = true;
  image1.onload = function() {
    image1.tex.needsUpdate = true;
    image1.loaded = true;
    if(image2.loaded)
      getZDepths();
  }

  var image2 = new Image(); 
  image2.src = $('#image2')[0].src; 
  image2Texture = new THREE.Texture(image2);
  image2.tex = imageTexture;
  image2.tex.needsUpdate = true;
  image2.onload = function() {
    image2.tex.needsUpdate = true;
    image2.loaded = true;
    if(image1.loaded)
      getZDepths();
  }

  //add mirror plane
  geometry = new THREE.PlaneGeometry(vidWidth, vidHeight, canvasWidth, canvasHeight);
  geometry.dynamic = true;

  meshMaterial = new THREE.MeshBasicMaterial({
    opacity: 1,
    map: imageTexture
  });
  meshMaterial.image = image1; 
  meshMaterial.needsUpdate = true;
  wireMaterial = new THREE.MeshBasicMaterial({
    opacity: 0.1,
    color: 0xffffff,
    wireframe: true,
    blending: THREE.AdditiveBlending,
    transparent: true
  });

  var mirror = new THREE.Mesh(geometry, meshMaterial);
  world3D.add(mirror);

  var wiremirror = new THREE.Mesh(geometry, wireMaterial);
  world3D.add(wiremirror);
  wiremirror.position.z = 5;

  renderer = new THREE.WebGLRenderer({
    antialias: true
  });
  renderer.sortObjects = false;
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  //document.addEventListener('mousemove', onMouseMove, false);
  //window.addEventListener('resize', onResize, false);
  document.addEventListener('mousewheel', onWheel, false);

  //init listeners
  document.addEventListener('mousemove', onMouseMove, false);
  window.addEventListener('resize', onResize, false);
  //document.addEventListener('mousewheel', onWheel, false);
  //container.addEventListener('click', hideInfo, false);
  //title.addEventListener('click', showInfo, false);

  // initialize pixel arrays
  vidCanvas = document.createElement('canvas');
  document.body.appendChild(vidCanvas);
  vidCanvas.style.position = 'absolute';
  vidCanvas.style.display = 'none';
  ctx = vidCanvas.getContext('2d');
  ctx.drawImage(image1, 0, 0, canvasWidth + 1, canvasHeight + 1);
  
  secondCanvas = document.createElement('canvas');
  document.body.appendChild(secondCanvas);
  secondCanvas.style.position = 'absolute';
  secondCanvas.style.display = 'none';
  ctx2 = secondCanvas.getContext('2d');
  ctx2.drawImage(image2, 0, 0, canvasWidth + 1, canvasHeight + 1);


  //extra stuff
  onResize();

  animate();
}
function animate() {
  requestAnimationFrame(animate);
  render();
}
function render() {
  world3D.scale = new THREE.Vector3(1, 1, 1);
  world3D.rotation.x += ((mouseY * tiltAmount) - world3D.rotation.x) * tiltSpeed;
  world3D.rotation.y += ((mouseX * tiltAmount) - world3D.rotation.y) * tiltSpeed;
  //camera.lookAt(camera.target);
  renderer.render(scene, camera);
}
function onMouseMove(event) {
  mouseX = (event.clientX - windowHalfX) / (windowHalfX);
  mouseY = (event.clientY - windowHalfY) / (windowHalfY);
}
function onWheel(event) {

  params.zoom += event.wheelDelta * 0.002;
  //limit
  params.zoom = Math.max(params.zoom, 0.1);
  params.zoom = Math.min(params.zoom, 5);
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;
}


// "THE ALGORITHM"

function getHSL(x,y, array){
  var base = (Math.floor(y) * (canvasWidth + 1) + Math.floor(x)) * 4;
  var c = {
    r: array[base + 0],
    g: array[base + 1],
    b: array[base + 2],
    a: array[base + 3]
  };
  return getHSLfromRGB(c.r,c.g,c.b);
}

function getHSLRelDifferences(x,y){
  // if(0){//isNaN(averageLightness)){
    // first = getHSL(x,y,pixels);
    // last = getHSL(x,y,pixelsLast);
  // }else{
    first = getHSL(x,y,pixels);
    last = getHSL(x,y, pixelsLast);
  // }
  return {
    h: last.h-first.h,
    s: last.s-first.s,
    l: (last.l-averageLightnessLast)-(first.l-averageLightness)
  };
}

function getHSLfromRGB(r, g, b){
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return {
        h: h,
        s: s,
        l: l
    };
}

function getColor(x, y) {
  var base = (Math.floor(y) * (canvasWidth + 1) + Math.floor(x)) * 4;
  var c = {
    r: pixels[base + 0],
    g: pixels[base + 1],
    b: pixels[base + 2],
    a: pixels[base + 3]
  };
  return (c.r << 16) + (c.g << 8) + c.b;
}

function getZDepths() {

  //draw webcam video pixels to canvas for pixel analysis
  //double up on last pixel get because there is one more vert than pixels
  ctx.drawImage(image1, 0, 0, canvasWidth + 1, canvasHeight + 1);
  pixels = ctx.getImageData(0, 0, canvasWidth + 1, canvasHeight + 1).data;

  ctx2.drawImage(image2, 0, 0, canvasWidth + 1, canvasHeight + 1);
  pixelsLast = ctx2.getImageData(0, 0, canvasWidth + 1, canvasHeight + 1).data;



  // $(document).keydown(function(event) {
  //   if (event.which == 71) {
  //     pixelsLast=pixels;
  //   interval = 0;
  //   last = true;
  //    }
  //    else if (event.which == 84) {
  //   last = true;
  //   status = !status;
  //   take3DSnap();
  //    }
  //    else if(event.which == 81){
  //     video.readyState = video.HAVE_ENOUGH_DATA;
  //    }
  //    else if(event.which == 87){
  //     video.readyState = !video.HAVE_ENOUGH_DATA;
  //    }
  // });
  // if((interval<=params.intervalDuration)){
  //   pixels = ctx.getImageData(0, 0, canvasWidth + 1, canvasHeight + 1).data;
  //   pixelsLast=pixels;
  //   //interval = 0;
  //   last = true;
  //   interval++;
  // }
  // else if(!captured){
  //   //pixels = ctx.getImageData(0, 0, canvasWidth + 1, canvasHeight + 1).data;
  // }
  // else{
  //   //pixels = 
  //   interval++;
  //   //console.log(interval);
  //   //console.log(params.intervalDuration);
  // }

  averageLightness = 0;
  averageLightnessLast = 0;
  for (var i = 0; i < canvasWidth + 1; i++) {
    for (var j = 0; j < canvasHeight + 1; j++) {
      averageLightness += getHSL(i,j,pixels).l;
      averageLightnessLast += getHSL(i,j,pixelsLast).l;
    }
  }
  averageLightness /= (canvasWidth*canvasHeight);
  averageLightnessLast /= (canvasWidth*canvasHeight);

  averageLightness = 1;
  averageLightnessLast = 1;

  for (var i = 0; i < canvasWidth + 1; i++) {
    for (var j = 0; j < canvasHeight + 1; j++) {
      var color = new THREE.Color(getColor(i, j));
      
      var HSLDiff = getHSLRelDifferences(i,j);
      var colorDepth = HSLDiff.l;
      
      var gotoZ = params.zDepth * Math.sqrt(Math.sqrt(Math.abs(colorDepth)));

      //add noise wobble
      //gotoZ += perlin.noise(i * params.noiseScale, j * params.noiseScale, noisePosn) * params.noiseStrength;
      //invert?
      if (params.invertZ) gotoZ = -gotoZ;
      //tween to stablize
      geometry.vertices[j * (canvasWidth + 1) + i].z += (gotoZ - geometry.vertices[j * (canvasWidth + 1) + i].z) / 5;
    }
  }

  for (var i = 1; i < canvasWidth ; i++) {
    for (var j = 1; j < canvasHeight ; j++) {
      geometry.vertices[j * (canvasWidth + 1) + i].z = (
        geometry.vertices[j*(canvasWidth+1)+i].z + 
        geometry.vertices[(j-1)*(canvasWidth+1)+i].z + 
        geometry.vertices[(j+1)*(canvasWidth+1)+i].z + 
        geometry.vertices[j*(canvasWidth+1)+i-1].z + 
        geometry.vertices[j*(canvasWidth+1)+i+1].z)/5;
    }
  }

  geometry.verticesNeedUpdate = true;
}
