let points;

function update() {
	points = [];

	const LENGTH = 1000;
	for (let i = 0; i < LENGTH; i++) {
		const x = (Math.random() - 0.5);
		const y = (Math.random() - 0.5);

		points.push(x, y, 0);
	}
}

var global_scope = this.self;

setInterval(() => {
	update();
	global_scope.postMessage({
		points: points
	});
});