import { parentPort } from "worker_threads";
// import { ordenaBlocksAndCut, gradeIt } from "local_wtfll.js";

parentPort.on("message", (chunk) => {
	const canAbsrvIn = 3;
	const absrv = (a) => a.hd < canAbsrvIn;
	let variMin = 10;

	let retChunk = {
		x: chunk.x,
		y: chunk.y,
		gradess: [],
		matrizesQua: []
	};

	for (let i = 0; i < chunk.chunk.length; i++) {
		ordenaBlocksAndCut(chunk, i, variMin);

		let blocks = chunk.chunk[i];
		let grades = gradeIt(blocks);
		retChunk.gradess.push(grades);

		let matrizQua = [];
		let level = 0;

		for (let g of grades) {
			if (g.t === "space") matrizQua.push(0);
			else if (g.t === "water") matrizQua.push(1);
			else if (absrv(g)) matrizQua.push(2);
			else matrizQua.push(3);

			level += 1 / variMin;
		}

		retChunk.matrizesQua.push(matrizQua);
	}

	parentPort.postMessage(retChunk);
});
function ordenaBlocksAndCut(chunk, i, variMin) {
	let antes = chunk.chunk[i];
	let novo = [];
	let minDepth = 31415926535;
	while (antes.length > 0) {
		let rem = null;
		minDepth = 31415926535;
		for (let b of antes) {
			if (b.depth < minDepth) {
				minDepth = b.depth;
				rem = b;
			}
			b.depth = Math.round(b.depth * variMin) / variMin;
			b.height = Math.round(b.height * variMin) / variMin;
		}
		novo.push(rem);
		antes.splice(antes.indexOf(rem), 1);
	}
	chunk.chunk[i] = novo;
}
function gradeIt(blocks) {
	let grades = [];
	for (var a = 0; a < blocks.length; a++) {
		// if (chunkEqKey(chunk, chaveChunk)&&show) console.log("going-pre(" + i + "): " + JSON.stringify(chunk.chunk[i]));
		let entring = { h: blocks[a].height, d: blocks[a].depth, t: blocks[a].thing, hd: blocks[a].hardness };
		grades.push(entring);
	}
	let lastD = grades[0].d;
	if (lastD != 0) {
		grades.unshift({ h: grades[0].d, d: 0, t: "space", hd: 0 });
		lastD = grades[0].d;
	}
	let ind = 0
	let nGrades = [];
	for (let g of grades) {
		// console.log(lastD);
		if (g.d != lastD) {
			nGrades.push({ h: g.d - lastD, d: lastD, t: "space", hd: 0 });
		}
		lastD = g.d + g.h;
		nGrades.push(g);
		// console.log(nGrades);
	}
	return nGrades;
}
