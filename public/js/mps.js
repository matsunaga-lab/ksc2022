importScripts('math.js')

const tank_width = 0.8;
const tank_height = 0.6;
const liquid_width = 0.2;
const liquid_height = 0.4;
const particle_size = 0.005;
const type_fluid = 0;
const type_wall = 1;
const type_dummy = 2;

const dt = 1.0e-3;
const gx = 0.0;
const gy = -10.0;
const rho = 1.0e+3;
const nu = 1.0e-6;
const speed_of_sound = 10.0;
const re_non = 3.1;

const particles = createInitParticles();

function createInitParticles() {
	posX_min = 0.0;
	posX_max = posX_min+liquid_width;
	posY_min = 0.0;
	posY_max = posY_min+liquid_height;
	numX = Math.floor((posX_max - posX_min) / particle_size + 0.5);
	numY = Math.floor((posY_max - posY_min) / particle_size + 0.5);

	const particles = [];

	// fluid particles
	for (let ny = 0; ny < numY; ++ny) {
		for (let nx = 0; nx < numX; ++nx) {
			const pos = {
				x: (posX_max - posX_min) * (nx + 0.5) / numX + posX_min,
				y: (posY_max - posY_min) * (ny + 0.5) / numY + posY_min
			}
			particles.push({
				type: type_fluid,
				x: [pos.x, pos.y],
				v: [0.0, 0.0],
				p: 0.0,
			});
		}
	}
	
	posX_min = 0.0;
	posX_max = posX_min+tank_width;
	posY_min = 0.0;
	posY_max = posY_min+tank_height;
	numX = Math.floor((posX_max - posX_min) / particle_size + 0.5);
	numY = Math.floor((posY_max - posY_min) / particle_size + 0.5);
	layer = Math.floor(re_non)+1;
	
	// wall and dummy particles
	for (let ny = -layer; ny < numY+layer; ++ny) {
		for (let nx = -layer; nx < numX+layer; ++nx) {
			if( nx >= 0 && nx < numX && ny >= 0 && ny < numY ){ continue; }
			const pos = {
				x: (posX_max - posX_min) * (nx + 0.5) / numX + posX_min,
				y: (posY_max - posY_min) * (ny + 0.5) / numY + posY_min
			}
			is_wall = ( nx >= -1 && nx <= numX && ny >= -1 && ny <= numY )
			particles.push({
				type: is_wall? type_wall : type_dummy,
				x: [pos.x, pos.y],
				v: [0.0, 0.0],
				p: 0.0,
			});
		}
	}

	return particles;
}

function convertParticlesToPoints(particles) {
	const rangeX_min = 0.0;
	const rangeX_max = rangeX_min+tank_width;
	const rangeY_min = 0.0;
	const rangeY_max = rangeY_min+tank_height;
	const offsetX = (rangeX_max-rangeX_min)/2;
	const offsetY = (rangeY_max-rangeY_min)/2;
	const scale = 1.0/Math.max(rangeX_max-rangeX_min,rangeY_max-rangeY_min);
	const points = [];
	for (let i = 0; i < particles.length; i++) {
		points.push((particles[i].x[0]-offsetX)*scale, (particles[i].x[1]-offsetY)*scale, 0);
	}
	return points;
}

function weight(r_sq,re_sq) {
	if( r_sq < re_sq ){
		return Math.sqrt(re_sq/r_sq)-1.0;
	}else{
		return 0.0;
	}
}

function update() {
	// calc constants
	re_sq = (re_non*particle_size)*(re_non*particle_size)
	pnd0 = 0.0
	for(let ny=-5;ny<=5;++ny){
		for(let nx=-5;nx<=5;++nx){
			if( nx == 0 && ny == 0 ){ continue; }
			pnd0 += weight(nx*nx+ny*ny,re_non*re_non)
		}
	}
	pnd0_inv = 1.0/pnd0

	// update velocity
	for (let i = 0; i < particles.length; i++) {
		if( particles[i].type >= type_wall ){
			continue;
		}
		lapU_x = 0.0;
		lapU_y = 0.0;
		particles[i].v[0] += (lapU_x*nu+gx)*dt;
		particles[i].v[1] += (lapU_y*nu+gy)*dt;
	}
	
	// move particles
	for (let i = 0; i < particles.length; i++) {
		if( particles[i].type >= type_wall ){
			continue;
		}
		particles[i].x[0] += particles[i].v[0]*dt;
		particles[i].x[1] += particles[i].v[1]*dt;
	}
	
	// calc pressure
	for (let i = 0; i < particles.length; i++) {
		if( particles[i].type > type_wall ){
			continue;
		}
		x_i = particles[i].x[0];
		y_i = particles[i].x[1];
		let pnd = 0.0;
		for (let j = 0; j < particles.length; j++) {
			if( j == i ){ continue; }
			x_ij = particles[j].x[0]-x_i;
			y_ij = particles[j].x[1]-y_i;
			pnd += weight(x_ij*x_ij+y_ij*y_ij,re_sq)
		}
		pnd *= pnd0_inv
		particles[i].p = (pnd-1.0)*rho*speed_of_sound*speed_of_sound
	}
	
	// correct velocity and position
	for (let i = 0; i < particles.length; i++) {
		if( particles[i].type >= type_wall ){
			continue;
		}
		gradP_x = 0.0;
		gradP_y = 0.0;
		particles[i].v[0] -= gradP_x/rho*dt;
		particles[i].v[1] -= gradP_y/rho*dt;
		particles[i].x[0] -= gradP_x/rho*dt*dt;
		particles[i].x[1] -= gradP_y/rho*dt*dt;
	}
}

var global_scope = this.self;

let step = 0;
setInterval(() => {
	const startTime = performance.now();
	update();
	const endTime = performance.now();

	global_scope.postMessage({
		processingTime: endTime - startTime,
		steps: ++step,
		points: convertParticlesToPoints(particles)
	});
});