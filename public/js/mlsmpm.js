var global_scope = this.self;

function generateRandomPoints() {
	const LENGTH = 1000;
	const vertices = [];
	for (let i = 0; i < LENGTH; i++) {
		const x = (Math.random() - 0.5);
		const y = (Math.random() - 0.5);

		vertices.push(x, y, -1);
	}
	return vertices;
}

setInterval(() => {
	global_scope.postMessage({
		points: generateRandomPoints()
	});
});