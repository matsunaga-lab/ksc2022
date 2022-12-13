importScripts('math.js')

const space_width = 10;
const grid_width = 100;
const cell_width = space_width / grid_width;
const dt = 1e-2;
const gravity = -1e-2;
const dynamic_viscosity = 1e-2;
const eos_power = 4;

const alpha = 0;
const affine = true;

const particles = createSquareParticles(5, 1);
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
				x: [pos.x, pos.y],
				v: math.zeros(2),
				C: math.zeros(2, 2),
				mass: (size * size * 1 * 1) / (num * num),
			});
		}
	}

	return particles;
}

function createInitGrid() {
	const grid = []
	for (let i = 0; i < (grid_width + 1) * (grid_width + 1); ++i) {
		grid.push({
			v: math.zeros(2),
			v_next: math.zeros(2),
			mass: 0,
			force: math.zeros(2),
		})
	}
	return grid;
}

function convertParticlesToPoints(particles) {
	const points = [];
	for (let i = 0; i < particles.length; i++) {
		points.push(particles[i].x[0] - 5, particles[i].x[1] - 5, 0);
	}
	return points;
}

function update() {
	clearGrid();
	P2G_1();
	P2G_2();
	updateGrid();
	G2P();
}

function clearGrid() {
	grid.forEach(c => {
		c.mass = 0;
		c.v = math.zeros(2);
		c.force = math.zeros(2);
		c.v_next = math.zeros(2);
	});
}

function P2G_1() {
	particles.forEach(p => {
		const base_coord = calcBaseCoord(p.x);
		const weights = calcWeights(p.x, base_coord);

		for (let gx = 0; gx < 3; ++gx) {
			for (let gy = 0; gy < 3; ++gy) {
				const cell_x = math.add(base_coord, [gx, gy]);
				const cell_dist = math.subtract(math.multiply(cell_x, cell_width), p.x);

				const Q = affine ? math.multiply(p.C, cell_dist) : math.zeros(2);

				const weight = math.subset(weights, math.index(gx, 0)) * math.subset(weights, math.index(gy, 1));
				const mass_contrib = weight * p.mass;

				const cell_index = calcCellIndexForPeriodicBoundary(cell_x);
				if (cell_index < 0 || cell_index >= (grid_width + 1) * (grid_width + 1)) {
					continue;
				}

				const cell = grid[cell_index];
				cell.mass += mass_contrib;
				cell.v = math.add(cell.v, math.multiply(mass_contrib, math.add(p.v, Q)));
			}
		}
	});
}

function P2G_2() {
	particles.forEach(p => {
		const base_coord = calcBaseCoord(p.x);
		const weights = calcWeights(p.x, base_coord);

		const density = calcDensity(base_coord, weights);
		const volume = p.mass / density;

		const pressure = 0;

		const dudv = p.C;
		const anti_trace = math.subset(dudv, math.index(1, 0)) + math.subset(dudv, math.index(0, 1));
		const strain = math.matrix([
			[math.subset(dudv, math.index(0, 0)), anti_trace / 2],
			[anti_trace / 2, math.subset(dudv, math.index(1, 1))]
		]);

		const viscosity_term = math.multiply(dynamic_viscosity, strain);
		const stress = math.add(
			math.matrix([[-pressure, 0], [0, -pressure]]),
			viscosity_term
		);

		const eq_16_term_0 = math.multiply(-volume * 4 / (cell_width * cell_width), stress);

		for (let gx = 0; gx < 3; ++gx) {
			for (let gy = 0; gy < 3; ++gy) {
				const cell_x = math.add(base_coord, [gx, gy]);
				const cell_dist = math.subtract(math.multiply(cell_x, cell_width), p.x);

				const weight = math.subset(weights, math.index(gx, 0)) * math.subset(weights, math.index(gy, 1));
				const cell_index = calcCellIndexForPeriodicBoundary(cell_x);
				if (cell_index < 0 || cell_index >= (grid_width + 1) * (grid_width + 1)) {
					continue;
				}

				const cell = grid[cell_index];
				cell.force = math.add(cell.force, math.multiply(math.multiply(weight, eq_16_term_0), cell_dist));
			}
		}
	});
}

function updateGrid() {
	grid.forEach((cell, index) => {
		if (cell.mass <= 0) {
			return;
		}

		cell.v = math.divide(cell.v, cell.mass);
		cell.v_next = math.add(cell.v, math.multiply(dt, math.add([0, gravity], math.divide(cell.force, cell.mass))))

		const x = (index % (grid_width + 1)) * cell_width;
		const y = (index / (grid_width + 1)) * cell_width;
		if (x <= 4.5 || x >= 5.5) {
			cell.v = math.zeros(2);
			cell.v_next = math.zeros(2);
		}
	});
}

function G2P() {
	particles.forEach(p => {
		const base_coord = calcBaseCoord(p.x);
		const weights = calcWeights(p.x, base_coord);

		const pv_n = p.v;
		p.v = math.zeros(2);

		let B = math.zeros(2, 2);

		for (let gx = 0; gx < 3; ++gx) {
			for (let gy = 0; gy < 3; ++gy) {
				const cell_x = math.add(base_coord, [gx, gy]);
				const cell_dist = math.subtract(math.multiply(cell_x, cell_width), p.x);
				const cell_index = calcCellIndexForPeriodicBoundary(cell_x);
				if (cell_index < 0 || cell_index >= (grid_width + 1) * (grid_width + 1)) {
					continue;
				}
				const weight = math.subset(weights, math.index(gx, 0)) * math.subset(weights, math.index(gy, 1));
				const cell = grid[cell_index];

				p.v = math.add(p.v, math.multiply(math.subtract(cell.v_next, math.multiply(alpha, cell.v)), weight))
				p.v = math.subset(p.v, math.index(0), 0);
				p.x[1] += math.subset(cell.v_next, math.index(1)) * weight * dt;

				const weighted_velocity = math.multiply(cell.v_next, weight);
				B = math.add(B, math.transpose(math.matrix([math.multiply(weighted_velocity, cell_dist[0]), math.multiply(weighted_velocity, cell_dist[1])])))
			}
		}

		p.v = math.add(p.v, math.multiply(alpha, pv_n));
		p.v = math.subset(p.v, math.index(0), 0);

		p.C = math.multiply(B, 4 / (cell_width * cell_width));

		if (p.x[1] <= 4.5) {
			p.x[1] = 5.5 - (4.5 - p.x[1]);
		}
	});
}

function calcBaseCoord(x) {
	return math.floor(math.subtract(math.divide(x, cell_width), 0.5));
}

function calcWeights(x, base_coord) {
	const fx = math.subtract(math.divide(x, cell_width), base_coord);
	const w1 = math.multiply(0.5, math.dotPow(math.subtract(1.5, fx), 2));
	const w2 = math.subtract(0.75, math.dotPow(math.subtract(fx, 1), 2));
	const w3 = math.multiply(0.5, math.dotPow(math.subtract(fx, 0.5), 2));
	const weights = math.matrix([w1, w2, w3]);
	return weights;
}

function calcCellIndexForPeriodicBoundary(cell_x) {
	let x = cell_x[0];
	let y = cell_x[1];

	if (y * cell_width <= 4.5) {
		y = (5.5 - (4.5 - y * cell_width)) / cell_width;
	} else if (y * cell_width >= 5.5) {
		y = (4.5 + (y * cell_width - 5.5)) / cell_width;
	}

	return math.floor(x) + math.floor(y) * (grid_width + 1);
}

function calcDensity(base_coord, weights) {
	let density = 0;
	for (let gx = 0; gx < 3; ++gx) {
		for (let gy = 0; gy < 3; ++gy) {
			const cell_x = math.add(base_coord, [gx, gy]);
			const weight = math.subset(weights, math.index(gx, 0)) * math.subset(weights, math.index(gy, 1));
			const cell_index = calcCellIndexForPeriodicBoundary(cell_x);
			if (cell_index < 0 || cell_index >= (grid_width + 1) * (grid_width + 1)) {
				continue;
			}
			density += grid[cell_index].mass * weight / (cell_width * cell_width);
		}
	}
	return density;
}

var global_scope = this.self;

setInterval(() => {
	update();
	global_scope.postMessage({
		points: convertParticlesToPoints(particles)
	});
});