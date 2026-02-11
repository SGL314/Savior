function chunkEqKey(chunk, key) {
	return chunk.x + "" == key;
}
function countWater(nivel, place) {
	switch (nivel) {
		case 0:
			let v = 0;
			for (let l of place.chunk) {
				for (let b of l) {
					if (b.thing == "water") v += b.height;
				}
			}
			return v;
		default:
			return -314;
	}
}
function recreateChunkGraphics(mapData) {
	let chunkSizePx = tamanho * tamBlock;

	mapData.forEach(chunk => {
		// Ignora chunks que, por acaso, já tenham graphics
		if (chunk.graphics) return;

		let chunkGraphics = [];
		for (let i = 0; i < 1 / stepDefaultMetters; i++) {
			chunkGraphics.push(createGraphics(chunkSizePx, chunkSizePx));
			chunkGraphics[i].noStroke();
		}

		// Desenha o conteúdo do chunk no buffer
		for (let i = 0; i < tamanho; i++) {
			for (let j = 0; j < tamanho; j++) {
				let blocks = chunk.chunk[i][j];

				// Usa a cor e o tamBlock original para desenhar
				let draws = drawBlock(blocks);
				for (let k = 0; k < 1 / stepDefaultMetters; k++) {
					chunkGraphics[k].fill(draws[k]);
					chunkGraphics[k].rect(i * tamBlock, j * tamBlock, tamBlock, tamBlock);
				}
			}
		}

		// Adiciona a propriedade graphics de volta ao chunk
		chunk.graphics = chunkGraphics;
	});

	return mapData;
}
// get adjs adjs
// let rep = init_;
// while (true) {
// 	const inner = (a, b) => {
// 		let r = false;
// 		b.map(c => {
// 			if (c.i == a.i) r |= true;
// 			r |= false;
// 		});
// 		// console.log(r);
// 		return r;
// 	}
// 	let added = false;
// 	let nRep = [];
// 	for (let ad of rep) {
// 		if (ad.i > 0 && chunk.chunk[ad.i - 1].length > 0 && (chunk.chunk[ad.i - 1][0].thing == "water" || ad.i == i)) {
// 			let add = { i: ad.i - 1 };
// 			if (ad.i - 1 != i && !inner(add, adjs)) {
// 				adjs.push(add);
// 				added = true;
// 				if (chunk.chunk[ad.i - 1][0].thing == "water") nRep.push(add);
// 			}
// 		}
// 		if (ad.i < tam - 1 && chunk.chunk[ad.i + 1].length > 0 && (chunk.chunk[ad.i + 1][0].thing == "water" || ad.i == i)) {
// 			let add = { i: ad.i + 1 };
// 			if (ad.i + 1 != i && !inner(add, adjs)) {
// 				adjs.push(add);
// 				added = true;
// 				if (chunk.chunk[ad.i + 1][0].thing == "water") nRep.push(add);
// 			}
// 		}
// 	}
// 	if (!added) break;
// 	nRep.map(c => {
// 		rep.push(c);
// 	});
// 	// console.log(adjs);
// }