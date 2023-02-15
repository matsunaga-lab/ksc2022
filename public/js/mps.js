/* index.js(メインスレッド)から送られてきた情報 */
//　マウスの左クリックが押されているか
let isMouseButtonPressed = false;
onmessage = (e) => {
	isMouseButtonPressed = e.data.isMouseButtonPressed;
};

// 物理パラメタ
const dim = 2; // 空間次元数
const rho = 1.0e+3; // 密度 [kg/m^3]
const nu = 1.0e-6; // 動粘性係数 [m^2/s]
const g_x = 0.0; // 重力加速度x成分 [m/s^2]
const g_y = -10.0; // 重力加速度y成分 [m/s^2]

// 計算パラメタ
const ell0 = 0.005; // 初期粒子間距離 [m]
const re_non = 3.1; // 初期粒子間距離と影響半径の比
const speed_of_sound = 10.0; // 音速 [m/s]（現実の音速ではない）
const dt_max = 5.0e-4; // 時間ステップの最大値 [s]
const courant_max = 0.1; // 最大クーラン数（速度）
const bfcourant_max = 0.1; // 最大クーラン数（外力）
const diffusion_max = 0.1; // 最大拡散数
const collision_dist = 0.9; // 衝突モデルの距離係数
const collision_coef = 0.5; // 衝突モデルの反発係数

// 定数
const type_fluid = 0; // 粒子タイプ：流体粒子
const type_wall = 1; // 粒子タイプ：壁粒子
const type_dummy = 2; // 粒子タイプ：ダミー壁粒子
const re = re_non*ell0; // 影響半径 [m]
const re_sq = re*re; // 影響半径の2乗
const re_inv = 1.0/re; // 影響半径の逆数
const pnd0 = calc_pnd0(re_non); // 基準粒子数密度
const pnd0_inv = 1.0/pnd0; // 基準粒子数密度の逆数
const lambda0 = calc_lambda0(re_non,ell0);

// 変数
let step = 0; // 現在のステップ数
let time = 0.0; // 現在の時間 [s]

// 可視化領域
let view_x_min = -1.0; // [m]
let view_x_max = 1.0; // [m]
let view_y_min = -1.0; // [m]
let view_y_max = 1.0; // [m]

// インジェクタ（流入口）
let injectors = []

// 粒子データ
const particles = createInitParticles();

// バケットデータ
let bucket_x_min = 0.0;
let bucket_x_max = 0.0;
let bucket_y_min = 0.0;
let bucket_y_max = 0.0;
let bucket_num_x = 0;
let bucket_num_y = 0;
let bucket_offset = [];
let bucket_values = [];


// 初期粒子配置を計算する関数
function createInitParticles() {
	const tank_width = 0.8; // 容器の幅 [m]
	const tank_height = 0.6; // 容器の高さ [m]
	const liquid_width = 0.2; // 液柱の幅 [m]
	const liquid_height = 0.4; // 液柱の高さ [m]
	
	// 可視化領域
	view_x_min = 0.0;
	view_x_max = tank_width;
	view_y_min = 0.0;
	view_y_max = tank_height;
	
	let posX_min = 0.0;
	let posX_max = liquid_width;
	let posY_min = 0.0;
	let posY_max = liquid_height;
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
	posX_max = tank_width;
	posY_min = 0.0;
	posY_max = tank_height;
	numX = Math.floor((posX_max - posX_min) / ell0 + 0.5);
	numY = Math.floor((posY_max - posY_min) / ell0 + 0.5);
	const layer = Math.floor(re_non)+1; // 壁を何層の粒子で表現するか
	
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

	// インジェクタの作成
	for (let i = 0; i < 10; ++i) {
		injectors.push({
			x: [ell0*0.5, 0.5+ell0*i],
			v: [1.0, 0.0],
			f: 0.0
		})
	}
	for (let i = 0; i < 10; ++i) {
		injectors.push({
			x: [tank_width-ell0*0.5, 0.5+ell0*i],
			v: [-1.0, 0.0],
			f: 0.0
		})
	}

	return ret;
}

// バケットデータを更新する関数
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

// 近傍粒子インデックスリストを返す関数
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

// 重み関数を計算する関数
function weight(r_sq,re_sq) {
	if( r_sq < re_sq ){
		return Math.sqrt(re_sq/r_sq)-1.0;
	}else{
		return 0.0;
	}
}

// 基準粒子数密度を計算する関数
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

// lambda0を計算する関数
function calc_lambda0(re_non,ell0) {
	const delta = Math.ceil(re_non);
	let ret = 0.0;
	for(let ny=-delta;ny<=delta;++ny){
		for(let nx=-delta;nx<=delta;++nx){
			if( nx == 0 && ny == 0 ){ continue; }
			ret += weight(nx*nx+ny*ny,re_non*re_non)*(nx*nx+ny*ny);
		}
	}
	ret *= ell0*ell0/calc_pnd0(re_non);
	return ret;
}

// 時間ステップを計算する関数
function calc_dt() {
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
	const bf_max = Math.sqrt(g_x*g_x+g_y*g_y);
	const dt_courant = ( vel_max > 0.0 )? courant_max*ell0/vel_max : dt_max ;
	const dt_bfcourant = ( bf_max > 0.0 )? Math.sqrt(bfcourant_max*ell0/bf_max) : dt_max ;
	const dt_diffusion = ( nu > 0.0 )? diffusion_max*ell0*ell0/nu : dt_max ;
	let dt = dt_max;
	if( dt > dt_courant ){ dt = dt_courant; }
	if( dt > dt_bfcourant ){ dt = dt_bfcourant; }
	if( dt > dt_diffusion ){ dt = dt_diffusion; }
	return dt
}

// インジェクタから粒子を追加する関数
function inject_particles(dt) {
	for (let i = 0; i < injectors.length; i++) {
		const x_i = injectors[i].x[0];
		const y_i = injectors[i].x[1];
		const u_i = injectors[i].v[0];
		const v_i = injectors[i].v[1];
		injectors[i].f += ell0*Math.sqrt(u_i*u_i+v_i*v_i)*dt;
		if( injectors[i].f < ell0*ell0 ){
			continue; // 積算流入体積が単一粒子体積ell0^d未満なのでまだ粒子追加しない
		}
		const neighbors = getNeighbors(x_i,y_i);
		let r_sq_min = Number.POSITIVE_INFINITY;
		let j_min = -1;
		for (let k = 0; k < neighbors.length; k++) {
			const j = neighbors[k];
			const x_ij = particles[j].x[0]-x_i;
			const y_ij = particles[j].x[1]-y_i;
			const r_sq = x_ij*x_ij+y_ij*y_ij;
			if( r_sq_min > r_sq ){
				r_sq_min = r_sq;
				j_min = j;
			}
		}
		if( r_sq_min < ell0*ell0 ){
			// 流入口とオーバーラップしている粒子が存在するので粒子追加を見送る
			// オーバーラップしている粒子の速度を流入速度に強制書き換え
			particles[j_min].v[0] = u_i;
			particles[j_min].v[1] = v_i;
			continue;
		}
		// 粒子を追加
		particles.push({
			type: type_fluid,
			x: [x_i, y_i],
			v: [u_i, v_i],
			p: 0.0,
		})
		injectors[i].f = 0.0; // 積算流入体積をクリア
	}
}

// 時間を1ステップ進める関数
function update() {
	if (!isMouseButtonPressed) {
		return;
	}
	// 時間ステップを計算する
	const dt = calc_dt();

	// 近傍粒子バケットを更新する
	updateBucket();

	// 仮速度を計算する
	const vel_bak2 = new Array(particles.length*dim).fill(0.0);
	for (let i = 0; i < particles.length; i++) {
		vel_bak2[i*2] = particles[i].v[0];
		vel_bak2[i*2+1] = particles[i].v[1];
	}
	const coef_laplacian = 2*dim/(pnd0*lambda0);
	for (let i = 0; i < particles.length; i++) {
		if( particles[i].type >= type_wall ){
			continue;
		}
		const x_i = particles[i].x[0];
		const y_i = particles[i].x[1];
		const u_i = particles[i].v[0];
		const v_i = particles[i].v[1];
		let lapU_x = 0.0;
		let lapU_y = 0.0;
		const neighbors = getNeighbors(x_i,y_i);
		for (let k = 0; k < neighbors.length; k++) {
			const j = neighbors[k];
			if( j != i ){
				const x_ij = particles[j].x[0]-x_i;
				const y_ij = particles[j].x[1]-y_i;
				const r_sq = x_ij*x_ij+y_ij*y_ij;
				if( r_sq < re_sq ){
					const w_ij = weight(r_sq,re_sq);
					const u_ij = vel_bak2[j*2]-u_i;
					const v_ij = vel_bak2[j*2+1]-v_i;
					lapU_x += w_ij*u_ij;
					lapU_y += w_ij*v_ij;
				}
			}
		}
		lapU_x *= coef_laplacian;
		lapU_y *= coef_laplacian;
		particles[i].v[0] += (lapU_x*nu+g_x)*dt;
		particles[i].v[1] += (lapU_y*nu+g_y)*dt;
	}

	// 粒子間衝突を計算する
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

	// 仮位置を計算する
	for (let i = 0; i < particles.length; i++) {
		if( particles[i].type >= type_wall ){
			continue;
		}
		particles[i].x[0] += particles[i].v[0]*dt;
		particles[i].x[1] += particles[i].v[1]*dt;
	}

	// 近傍粒子バケットを更新する
	updateBucket();

	// 圧力を計算する
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

	// 新しい時刻の速度と時間を計算する
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

	// インジェクタから粒子を追加する
	inject_particles(dt)

	// ステップ数と時間を進める
	step += 1;
	time += dt;
}


// 描画用：粒子位置を返す関数
function convertParticlesToPoints(particles) {
	const offsetX = (view_x_min+view_x_max)/2;
	const offsetY = (view_y_min+view_y_max)/2;
	const scale = 1.0/Math.max(view_x_max-view_x_min,view_y_max-view_y_min);
	const points = [];
	for (let i = 0; i < particles.length; i++) {
		points.push((particles[i].x[0]-offsetX)*scale, (particles[i].x[1]-offsetY)*scale, 0);
	}
	return points;
}

// 描画用：粒子サイズを返す関数
function convertParticlesToSizes(particles) {
	const sizes = new Array(particles.length);
	for (let i = 0; i < particles.length; i++) {
		if (particles[i].type == type_wall || particles[i].type == type_dummy) {
			sizes[i] = 5;
		} else {
			sizes[i] = 3;
		}
	}
	return sizes;
}

function clamp(x, min, max) {
	return Math.min(max, Math.max(x, min));
}

function calcColorRGB(x) {
	const r = clamp(2.0-4.0*Math.abs(x-1.0),0.0,1.0);
	const g = clamp(2.0-4.0*Math.abs(x-0.5),0.0,1.0);
	const b = clamp(2.0-4.0*Math.abs(x-0.0),0.0,1.0);
	return {r,g,b};
}

// 描画用：粒子の色を返す関数
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

	if (v_max == v_min) {
		v_max += 0.5;
		v_min -= 0.5;
	}

	const colors = [];
	for (let i = 0; i < particles.length; i++) {
		if (particles[i].type == type_fluid) {
			colors.push(calcColorRGB((vels[i] - v_min) / (v_max - v_min)));
		} else if (particles[i].type == type_dummy) {
			colors.push({ r: 0.5, g: 0.5, b: 0.5 });
		} else {
			colors.push({ r: 1, g: 1, b: 1 });
		}
	}
	return colors;
}

var global_scope = this.self;

setInterval(() => {
	const startTime = performance.now();
	update();
	const endTime = performance.now();

	global_scope.postMessage({
		processingTime: endTime - startTime,
		steps: step,
		time: time,
		points: convertParticlesToPoints(particles),
		colors: convertParticlesToColors(particles),
		sizes: convertParticlesToSizes(particles),
	});
});
