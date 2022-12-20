const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer();
document.body.appendChild(renderer.domElement);

let points = null;
let geometry = null;

function animate() {
	requestAnimationFrame(animate);

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

	if (points) {
		if (geometry == null) {
			geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));

			const material = new THREE.PointsMaterial({
				size: 2,
				color: 0xffffff,
			});

			const pointsMesh = new THREE.Points(geometry, material);
			scene.add(pointsMesh);
		} else {
			geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
		}

		points = null;
	}

	renderer.render(scene, camera);
};

animate();

let worker = new Worker('js/mps.js');
worker.addEventListener('message', function (e) {
	points = e.data.points;
	document.getElementById('stepCount').textContent = e.data.steps ? `${e.data.steps} steps` : '';
	document.getElementById('processingTime').textContent = e.data.processingTime ? `${Math.floor(e.data.processingTime)} ms/step` : '';
}, false);