const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);

renderer.setSize(window.innerWidth, window.innerHeight);

const SIZE = 1;
let camera_width;
let camera_height;
if (window.innerWidth <= window.innerHeight) {
	camera_width = SIZE;
	camera_height = SIZE / window.innerWidth * window.innerHeight;
} else {
	camera_width = SIZE / window.innerHeight * window.innerWidth;
	camera_height = SIZE;
}
const camera = new THREE.OrthographicCamera(camera_width / -2, camera_width / 2, camera_height / -2, camera_height / 2);
camera.up.set(0, -1, 0);
camera.position.set(0, 0, -10);
camera.lookAt(new THREE.Vector3(0, 0, 0));

let points = null;
let colors = null;
let sizes = null;
let geometry = null;

function animate() {
	requestAnimationFrame(animate);

	if (points) {
		if (geometry == null) {
			geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
			geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
			geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

			const material = new THREE.PointsMaterial({
				vertexColors: true
			});
			material.onBeforeCompile = (shader) => {
				const keyword = 'uniform float size;';
				shader.vertexShader = shader.vertexShader.replace(keyword, 'attribute float size;');
			};


			const pointsMesh = new THREE.Points(geometry, material);
			scene.add(pointsMesh);
		} else {
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
			geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
			geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
		}

		points = null;
	}

	renderer.render(scene, camera);
};

animate();

let worker = new Worker('js/mps.js');
worker.addEventListener('message', function (e) {
	points = e.data.points;
	colors = convertColorRGB(e.data.colors);
	sizes = e.data.sizes;
	document.getElementById('time').textContent = e.data.time ? `${Math.round(e.data.time * 100) / 100} s` : '';
	document.getElementById('stepCount').textContent = e.data.steps ? `${e.data.steps} steps` : '';
	document.getElementById('processingTime').textContent = e.data.processingTime ? `${Math.floor(e.data.processingTime)} ms/step` : '';
}, false);

const convertColorRGB = (colors) => {
	if (colors == null) {
		colors = new Array(points.length / 3).fill([1, 1, 1]);
	}

	const res = new Array(colors.length * 3);
	const color = new THREE.Color();
	for (let i = 0; i < colors.length; ++i) {
		color.setRGB(colors[i].r, colors[i].g, colors[i].b);
		res[3 * i] = color.r;
		res[3 * i + 1] = color.g;
		res[3 * i + 2] = color.b;
	}

	return res;
}