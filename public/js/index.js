let scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);

renderer.setSize(window.innerWidth, window.innerHeight);

const filename = "js/mps.js"
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

function ColorToHex(color) {
	var hexadecimal = color?.toString(16);
	return hexadecimal?.length == 1 ? "0" + hexadecimal : hexadecimal;
}

function ConvertRGBtoHex(red, green, blue) {
	return "0x" + ColorToHex(Math.floor(red * 255)) + ColorToHex(Math.floor(green * 255)) + ColorToHex(Math.floor(blue * 255));
}

function animate() {
	requestAnimationFrame(animate);

	if (points) {
		scene = new THREE.Scene();

		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		geometry.setAttribute('color', new THREE.Float32BufferAttribute(convertColorRGB(colors), 3));
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

		for (let i = 0; i < particles.length; i++) {
			if (particles[i].type > 1) {
				continue;
			}
			const dir = new THREE.Vector3(particles[i].v[0], particles[i].v[1], 0);

			//normalize the direction vector (convert to vector of length 1)
			dir.normalize();

			const origin = new THREE.Vector3(particles[i].x[0] - 0.3, particles[i].x[1] - 0.5, 0);
			const length = 0.05 * Math.sqrt(particles[i].v[0] ** 2 + particles[i].v[1] ** 2);
			const hex = Number(ConvertRGBtoHex(colors[i].r, colors[i].g, colors[i].b));
			//const hex =Number(0xff0000);

			const arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex);
			scene.add(arrowHelper);
		}
		points = null;
	}

	renderer.render(scene, camera);
};

animate();
let worker = new Worker(filename);
worker.addEventListener('message', function (e) {
	points = e.data.points;
	colors = e.data.colors;
	sizes = e.data.sizes;
	particles = e.data.particles;
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