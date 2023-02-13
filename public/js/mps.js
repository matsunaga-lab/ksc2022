// 物理パラメタ

// 計算パラメタ

// 定数
const type_fluid = 0; // 粒子タイプ：流体粒子
const type_wall = 1; // 粒子タイプ：壁粒子
const type_dummy = 2; // 粒子タイプ：ダミー壁粒子

// 変数
let step = 0; // 現在のステップ数
let time = 0.0; // 現在の時間 [s]

// 可視化領域
let view_x_min = -1.0; // [m]
let view_x_max = 1.0; // [m]
let view_y_min = -1.0; // [m]
let view_y_max = 1.0; // [m]

// 粒子データ
const particles = createInitParticles();

// バケットデータ


// 初期粒子配置を計算する関数
function createInitParticles() {
	const ret = [];

	for (let i = 0; i < 3; i++) {
		ret.push({
			type: type_fluid,
			x: [0.1*i, 0.0],
			v: [0.0, 0.0],
			p: 0.0,
		});
	}
	
	for (let i = 0; i < 3; i++) {
		ret.push({
			type: type_wall,
			x: [0.1*i, 0.1],
			v: [0.0, 0.0],
			p: 0.0,
		});
	}
	
	for (let i = 0; i < 3; i++) {
		ret.push({
			type: type_dummy,
			x: [0.1*i, 0.2],
			v: [0.0, 0.0],
			p: 0.0,
		});
	}

	return ret;
}

// 時間を1ステップ進める関数
function update() {
	// 時間ステップを計算する

	// 近傍粒子バケットを更新する

	// 仮速度を計算する

	// 粒子間衝突を計算する

	// 仮位置を計算する

	// 近傍粒子バケットを更新する

	// 圧力を計算する

	// 新しい時刻の速度と時間を計算する

	// ステップ数と時間を進める
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
		points: convertParticlesToPoints(particles),
		colors: convertParticlesToColors(particles),
		sizes: convertParticlesToSizes(particles),
	});
});
