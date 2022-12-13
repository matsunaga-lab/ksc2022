importScripts('math.js')

const grid_width = 400;
const space_width = 10;
const cell_width = space_width / grid_width;
const dt = 5e-3;
const gravity = 1e-2;
const dynamic_viscosity = 1e-2;
const eos_power = 4;

const alpha = 0;
const affine = true;

const particles = createSquareParticles(0, 1);
const grid = createInitGrid();

function createSquareParticles(center, size) {
	const pos_min = center - size / 2;
	const pos_max = center + size / 2;
	const num = Math.floor((pos_max - pos_min) / (cell_width / 2) + 0.5);

	const particles = [];
	for (let ny = 0; ny < num; ++ny) {
		for (let nx = 0; nx < num; ++nx) {
			const pos = {
				x: (pos_max - pos_min) * (nx + 0.5) / num + pos_min,
				y: (pos_max - pos_min) * (ny + 0.5) / num + pos_min
			}
			particles.push({
				x: pos,
				v: 0,
				C: 0,
				mass: (size * size * 1 * 1) / (nx * ny),
			});
		}
	}

	return particles;
}

function createInitGrid() {
	const grid = []
	for (let i = 0; i < (grid_width + 1) * (grid_width + 1); ++i) {
		grid.push({
			v: 0,
			v_next: 0,
			mass: 0,
			force: 0,
		})
	}
	return grid;
}

function convertParticlesToPoints(particles) {
	const points = [];
	for (let i = 0; i < particles.length; i++) {
		points.push(particles[i].x.x, particles[i].x.y, 0);
	}
	return points;
}

function update() {
	clearGrid();
	const a = math.round(math.e, 3);
}

function clearGrid() {
	grid.forEach(c => {
		c.mass = 0;
		c.v = 0;
		c.force = 0;
		c.v_next = 0;
	});
}

function P2G_1() {
	const weights = createInitWeights();
	particles.forEach(p => {
		const base_coord_x = calcBaseCoord(p.x.x);
		const base_coord_y = calcBaseCoord(p.x.y);
	});
}

function createInitWeights() {
	const weights = [];
	for (let i = 0; i < 3; ++i) {
		weights.push([0, 0])
	}
	return weights;
}

var global_scope = this.self;

setInterval(() => {
	update();
	global_scope.postMessage({
		points: convertParticlesToPoints(particles)
	});
});