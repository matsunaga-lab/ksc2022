const scene = new THREE.Scene();
const camera_width = window.innerWidth;
const camera_height = window.innerHeight;
const camera = new THREE.OrthographicCamera(camera_width / -2, camera_width / 2, camera_height / -2, camera_height / 2, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 形状データを作成
const SIZE = window.innerHeight;
// 配置する個数
const LENGTH = 1000;
// 頂点情報を格納する配列
const vertices = [];
for (let i = 0; i < LENGTH; i++) {
	const x = SIZE * (Math.random() - 0.5);
	const y = SIZE * (Math.random() - 0.5);

	vertices.push(x, y, -1);
}

scene.add(createPointsMesh(vertices));

function createPointsMesh(vertices) {
	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

	const material = new THREE.PointsMaterial({
		size: 5,
		color: 0xffffff,
	});

	return new THREE.Points(geometry, material);
}

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
};

animate();