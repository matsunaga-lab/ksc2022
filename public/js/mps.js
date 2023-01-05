const tank_width = 0.8; // [m]
const tank_height = 0.6; // [m]
const liquid_width = 0.2; // [m]
const liquid_height = 0.4; // [m]

const domain_x_min = -1.0; // [m]
const domain_x_max = tank_width+1.0; // [m]
const domain_y_min = -1.0; // [m]
const domain_y_max = tank_height+1.0; // [m]

const dim = 2; // number of spatial dimensions
const rho = 1.0e+3; // fluid density [kg/m^3]
const nu = 1.0e-6; // kinematic viscosity [m^2/s]
const g = [0.0,-10.0]; // gravitational acceleration [m/s^2]

let time = 0.0; // current time [s]
let step = 0; // current step count
const ell0 = 0.005; // particle distance (diameter) [m]
const dt_max = 1.0e-3; // maximum time step interval [s]
const courant_max = 0.1; // maximum Courant number
const diffusion_max = 0.1; // maximum diffusion number
const re_non = 3.1; // non-dimensional effective radius
const collision_dist = 0.9; // collision distance (non-dimensional)
const collision_coef = 0.5; // collision coefficient
const speed_of_sound = 10.0; // [m/s]

const re = re_non*ell0; // effective radius [m]
const re_sq = re*re;
const re_inv = 1.0/re;
const pnd0 = calc_pnd0(re_non); // reference particle number density
const pnd0_inv = 1.0/pnd0;

const type_fluid = 0;
const type_wall = 1;
const type_dummy = 2;
const type_ghost = 3;

const particles = createInitParticles();

let bucket_x_min = 0.0;
let bucket_x_max = 0.0;
let bucket_y_min = 0.0;
let bucket_y_max = 0.0;
let bucket_num_x = 0;
let bucket_num_y = 0;
let bucket_offset = [];
let bucket_values = [];

function weight(r_sq,re_sq) {
	if( r_sq < re_sq ){
		return Math.sqrt(re_sq/r_sq)-1.0;
	}else{
		return 0.0;
	}
}

function calc_pnd0(re_non) {
	const delta = Math.ceil(re_non);
	let ret = 0.0;
	for(let ny=-delta;ny<=delta;++ny){
		for(let nx=-delta;nx<=delta;++nx){
			if( nx == 0 && ny == 0 ){ continue; }
			ret += weight(nx*nx+ny*ny,re_non*re_non);
		}
	}
	return ret;
}

function createInitParticles() {
	let posX_min = 0.0;
	let posX_max = posX_min+liquid_width;
	let posY_min = 0.0;
	let posY_max = posY_min+liquid_height;
	let numX = Math.floor((posX_max - posX_min) / ell0 + 0.5);
	let numY = Math.floor((posY_max - posY_min) / ell0 + 0.5);

	const ret = [];

	// fluid particles
	for (let ny = 0; ny < numY; ++ny) {
		for (let nx = 0; nx < numX; ++nx) {
			const x = (posX_max - posX_min) * (nx + 0.5) / numX + posX_min;
			const y = (posY_max - posY_min) * (ny + 0.5) / numY + posY_min;
			ret.push({
				type: type_fluid,
				x: [x, y],
				v: [0.0, 0.0],
				p: 0.0,
			});
		}
	}
	
	posX_min = 0.0;
	posX_max = posX_min+tank_width;
	posY_min = 0.0;
	posY_max = posY_min+tank_height;
	numX = Math.floor((posX_max - posX_min) / ell0 + 0.5);
	numY = Math.floor((posY_max - posY_min) / ell0 + 0.5);
	const layer = Math.floor(re_non)+1;
	
	// wall and dummy particles
	for (let ny = -layer; ny < numY+layer; ++ny) {
		for (let nx = -layer; nx < numX+layer; ++nx) {
			if( nx >= 0 && nx < numX && ny >= 0 && ny < numY ){ continue; }
			const x = (posX_max - posX_min) * (nx + 0.5) / numX + posX_min;
			const y = (posY_max - posY_min) * (ny + 0.5) / numY + posY_min;
			const is_wall = ( nx >= -1 && nx <= numX && ny >= -1 && ny <= numY );
			ret.push({
				type: is_wall? type_wall : type_dummy,
				x: [x, y],
				v: [0.0, 0.0],
				p: 0.0,
			});
		}
	}

	return ret;
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

function convertParticlesToSizes(particles) {
	const sizes = new Array(particles.length);
	for (let i = 0; i < particles.length; i++) {
		if (particles[i].type == type_wall || particles[i].type == type_dummy) {
			sizes[i] = 10;
		} else {
			sizes[i] = 3;
		}
	}
	return sizes;
}

const convertParticlesToColors = convertParticlesVeclocityToColors;

function convertParticlesVeclocityToColors(particles) {
	const vels = [];
	for (let i = 0; i < particles.length; i++) {
		vels.push(Math.sqrt(particles[i].v[0] * particles[i].v[0] + particles[i].v[1] * particles[i].v[1]));
	}

	let v_max = Number.NEGATIVE_INFINITY;
	let v_min = Number.POSITIVE_INFINITY;
	for (let i = 0; i < particles.length; i++) {
		v_max = Math.max(v_max, vels[i]);
		v_min = Math.min(v_min, vels[i]);
	}

	const colors = [];
	for (let i = 0; i < particles.length; i++) {
		if (particles[i].type == type_fluid) {
			colors.push(calcColorRGB((vels[i] - v_min) / (v_max - v_min)));
		} else {
			colors.push({ r: 1, g: 1, b: 1 });
		}
	}
	return colors;
}

function sigmoid(x, gain, offset) {
	return (Math.tanh(gain * (x + offset) / 2) + 1) / 2;
}

function clamp(x, min, max) {
	return Math.min(max, Math.max(x, min));
}

// https://qiita.com/masato_ka/items/c178a53c51364703d70b
function calcColorRGB(x) {
	const gain = 10;
	const offset_x = 0.2;
	const offset_green = 0.6;

	x = clamp(x, 0, 1);
	x = x * 2 - 1;

	const r = sigmoid(x, gain, -1 * offset_x);
	const b = 1 - sigmoid(x, gain, offset_x);
	const g = sigmoid(x, gain, offset_green) + (1 - sigmoid(x, gain, -1 * offset_green)) - 1;

	return { r, g, b };
}

function updateBucket() {
	bucket_x_min = 0.0;
	bucket_x_max = 0.0;
	bucket_y_min = 0.0;
	bucket_y_max = 0.0;
	if( particles.length > 0 ){
		bucket_x_min = bucket_x_max = particles[0].x[0];
		bucket_y_min = bucket_y_max = particles[0].x[1];
	}
	for (let i = 1; i < particles.length; i++) {
		const x_i = particles[i].x[0];
		const y_i = particles[i].x[0];
		if( bucket_x_min > x_i ){ bucket_x_min = x_i; }else if( bucket_x_max < x_i ){ bucket_x_max = x_i; }
		if( bucket_y_min > y_i ){ bucket_y_min = y_i; }else if( bucket_y_max < y_i ){ bucket_y_max = y_i; }
	}
	const re = re_non*ell0;
	const re_inv = 1.0/re;
	bucket_num_x = Math.floor((bucket_x_max-bucket_x_min)*re_inv)+1;
	bucket_num_y = Math.floor((bucket_y_max-bucket_y_min)*re_inv)+1;
	const bucket_num_total = bucket_num_x*bucket_num_y;
	const bucket_first = new Array(bucket_num_total).fill(-1);
	const bucket_last = new Array(bucket_num_total).fill(-1);
	const bucket_next = new Array(particles.length).fill(-1);
	for (let i = 0; i < particles.length; i++) {
		const bx = Math.floor((particles[i].x[0]-bucket_x_min)*re_inv);
		const by = Math.floor((particles[i].x[1]-bucket_y_min)*re_inv);
		const b = bx+bucket_num_x*by;
		if( bucket_first[b] < 0 ){
			bucket_first[b] = i;
		}else{
			bucket_next[bucket_last[b]] = i;
		}
		bucket_last[b] = i;
	}
	bucket_offset = new Array(bucket_num_total+1).fill(0);
	bucket_values = new Array(particles.length).fill(-1);
	let cnt = 0;
	bucket_offset[0] = 0;
	for (let b = 0; b < bucket_num_total; ++b) {
		let i = bucket_first[b];
		while( i >= 0 ){
			bucket_values[cnt] = i;
			i = bucket_next[i];
			++cnt;
		}
		bucket_offset[b+1] = cnt;
	}
}

function getNeighbors(x,y) {
	const bx_i = Math.floor((x-bucket_x_min)*re_inv);
	const by_i = Math.floor((y-bucket_y_min)*re_inv);
	const ret = [];
	for (let by_j = by_i-1; by_j <= by_i+1; ++by_j) {
		if( by_j < 0 || by_j >= bucket_num_y ){ continue; }
		for (let bx_j = bx_i-1; bx_j <= bx_i+1; ++bx_j) {
			if( bx_j < 0 || bx_j >= bucket_num_x ){ continue; }
			const b = bx_j+bucket_num_x*by_j;
			const k0 = bucket_offset[b];
			const k1 = bucket_offset[b+1];
			for (let k = k0; k < k1; ++k) {
				ret.push(bucket_values[k]);
			}
		}
	}
	return ret;
}

function calc_dt() {
}

function update() {
	// determine dt
	let vel_sq_max = 0.0;
	for (let i = 0; i < particles.length; i++) {
		u_i = particles[i].v[0];
		v_i = particles[i].v[1];
		vel_sq_i = u_i*u_i+v_i*v_i;
		if( vel_sq_max < vel_sq_i ){
			vel_sq_max = vel_sq_i;
		}
	}
	const vel_max = Math.sqrt(vel_sq_max);
	const dt_courant = ( vel_max > 0.0 )? courant_max*ell0/vel_max : dt_max ;
	const dt_diffusion = ( nu > 0.0 )? diffusion_max*ell0*ell0/nu : dt_max ;
	let dt = dt_max;
	if( dt > dt_courant ){ dt = dt_courant; }
	if( dt > dt_diffusion ){ dt = dt_diffusion; }

	updateBucket();
	
	// update velocity
	for (let i = 0; i < particles.length; i++) {
		if( particles[i].type >= type_wall ){
			continue;
		}
		let lapU_x = 0.0;
		let lapU_y = 0.0;
		// ...
		particles[i].v[0] += (lapU_x*nu+g[0])*dt;
		particles[i].v[1] += (lapU_y*nu+g[1])*dt;
	}
	
	// collision model
	const vel_bak = new Array(particles.length*dim).fill(0.0);
	for (let i = 0; i < particles.length; i++) {
		vel_bak[i*2] = particles[i].v[0];
		vel_bak[i*2+1] = particles[i].v[1];
	}
	const collision_re = collision_dist*ell0;
	const collision_re_sq = collision_re*collision_re;
	for (let i = 0; i < particles.length; i++) {
		if( particles[i].type >= type_wall ){
			continue;
		}
		const x_i = particles[i].x[0];
		const y_i = particles[i].x[1];
		const u_i = particles[i].v[0];
		const v_i = particles[i].v[1];
		const neighbors = getNeighbors(x_i,y_i);
		for (let k = 0; k < neighbors.length; k++) {
			const j = neighbors[k];
			if( j != i ){
				const x_ij = particles[j].x[0]-x_i;
				const y_ij = particles[j].x[1]-y_i;
				const r_sq = x_ij*x_ij+y_ij*y_ij;
				if( r_sq < collision_re_sq ){
					const u_ij = vel_bak[j*2]-u_i;
					const v_ij = vel_bak[j*2+1]-v_i;
					const tmp = x_ij*u_ij+y_ij*v_ij;
					if( tmp < 0.0 ){
						const tmp2 = tmp*(1.0+collision_coef)/(r_sq*2.0);
						particles[i].v[0] += x_ij*tmp2;
						particles[i].v[1] += y_ij*tmp2;
					}
				}
			}
		}
	}
	
	// move particles
	for (let i = 0; i < particles.length; i++) {
		if( particles[i].type >= type_wall ){
			continue;
		}
		particles[i].x[0] += particles[i].v[0]*dt;
		particles[i].x[1] += particles[i].v[1]*dt;
	}
	
	updateBucket();
	
	// calc pressure
	const coef_pressure = rho*speed_of_sound*speed_of_sound;
	for (let i = 0; i < particles.length; i++) {
		if( particles[i].type > type_wall ){
			continue;
		}
		const x_i = particles[i].x[0];
		const y_i = particles[i].x[1];
		let pnd_i = 0.0;
		const neighbors = getNeighbors(x_i,y_i);
		for (let k = 0; k < neighbors.length; k++) {
			const j = neighbors[k];
			if( j != i ){
				const x_ij = particles[j].x[0]-x_i;
				const y_ij = particles[j].x[1]-y_i;
				const r_sq = x_ij*x_ij+y_ij*y_ij;
				if( r_sq < re_sq ){
					const w_ij = weight(r_sq,re_sq);
					pnd_i += w_ij;
				}
			}
		}
		pnd_i *= pnd0_inv;
		if( pnd_i > 1.0 ){
			particles[i].p = (pnd_i-1.0)*coef_pressure;
		}else{
			particles[i].p = 0.0;
		}
	}
	
	// correct velocity and position
	const dt_by_rho = dt/rho;
	const dtdt_by_rho = dt*dt/rho;
	for (let i = 0; i < particles.length; i++) {
		if( particles[i].type >= type_wall ){
			continue;
		}
		const x_i = particles[i].x[0];
		const y_i = particles[i].x[1];
		const p_i = particles[i].p;
		let gradP_x = 0.0;
		let gradP_y = 0.0;
		const neighbors = getNeighbors(x_i,y_i);
		for (let k = 0; k < neighbors.length; k++) {
			const j = neighbors[k];
			if( j != i ){
				const x_ij = particles[j].x[0]-x_i;
				const y_ij = particles[j].x[1]-y_i;
				const r_sq = x_ij*x_ij+y_ij*y_ij;
				if( r_sq < re_sq ){
					const r_sq_inv = 1.0/r_sq;
					const w_ij = weight(r_sq,re_sq);
					const p_j = particles[j].p;
					gradP_x += (p_j+p_i)*w_ij*r_sq_inv*x_ij;
					gradP_y += (p_j+p_i)*w_ij*r_sq_inv*y_ij;
				}
			}
		}
		gradP_x *= dim*pnd0_inv;
		gradP_y *= dim*pnd0_inv;
		particles[i].v[0] -= gradP_x*dt_by_rho;
		particles[i].v[1] -= gradP_y*dt_by_rho;
		particles[i].x[0] -= gradP_x*dtdt_by_rho;
		particles[i].x[1] -= gradP_y*dtdt_by_rho;
	}
	
	// detect out-of-domain particles
	for (let i = 0; i < particles.length; i++) {
		if( particles[i].type >= type_wall ){
			continue;
		}
		const x_i = particles[i].x[0];
		const y_i = particles[i].x[1];
		if( x_i < domain_x_min || x_i >= domain_x_max || y_i < domain_y_min || y_i >= domain_y_max ){
			particles[i].type = type_ghost;
			particles[i].v[0] = 0.0;
			particles[i].v[1] = 0.0;
			particles[i].p = 0.0;
		}
	}
	
	time += dt;
	step += 1;
}

var global_scope = this.self;

setInterval(() => {
	const startTime = performance.now();
	update();
	const endTime = performance.now();

	global_scope.postMessage({
		processingTime: endTime - startTime,
		steps: step,
		points: convertParticlesToPoints(particles),
		colors: convertParticlesToColors(particles),
		sizes: convertParticlesToSizes(particles),
	});
});