// IN MAIN
{
	{
		// // return;
		// // if (!processingInMain["waterfall"]) {
		// // 	processingInMain["waterfall"] = true;
		// // 	setTimeout(async () => { // com bugs
		// // 		let init = new Date();
		// // 		// try { console.log("in: " + JSON.stringify(_map.filter(c => c.x == 0)[0].chunk[21])); } catch (e) { }
		// // 		let ret = await waterfall();
		// // 		if (ret.length > 0) {
		// // 			// console.log("---waterfall--- "+JSON.stringify(_map.filter(c=>c.x==0 && c.y==0)[0].chunk[23][23]));
		// // 			let chunks = _map.filter(c => {
		// // 				for (let r of ret) {
		// // 					if (c.x == r.key.x) return true;
		// // 				}
		// // 				return false;
		// // 			});
		// // 			// console.log(chunks[0].chunk[21]);
		// // 			// type: "attChunks",
		// // 			// data: [{
		// // 			// 	keyChunk: { x: chunkAtt.x, y: chunkAtt.y },
		// // 			// 	chunk: chunkAtt
		// // 			// }]
		// // 			let data = chunks.map(c => ({
		// // 				keyChunk: { x: c.x, y: c.y },
		// // 				chunk: c
		// // 			}));
		// // 			broadcast({ type: "attChunks", data: data });
		// // 			// simulateAttChunks(data);
		// // 			//
		// // 			let txt = "";
		// // 			let t = 0;
		// // 			let vt = 0;
		// // 			let variMin = 10;
		// // 			data.map(c => {
		// // 				let chunk = c.chunk;
		// // 				for (let blk of chunk.chunk) {
		// // 					if (!JSON.stringify(blk).includes("water")) continue;
		// // 					for (let i = 0; i < blk.length; i++) {
		// // 						let b = blk[i];
		// // 						if (b.thing == "water") {
		// // 							t++;
		// // 							b.height = Math.round(b.height * variMin) / variMin;
		// // 							b.depth = Math.round(b.depth * variMin) / variMin;

		// // 							vt += b.height;
		// // 							txt += t + "(" + chunk.chunk.indexOf(blk) + "): " + JSON.stringify(b) + " - ";
		// // 							txt += " " + JSON.stringify(blk[i + 1]) + "\n";
		// // 						} else if (i > 0 && blk[i - 1].thing == "water") {
		// // 						}


		// // 					}

		// // 				}
		// // 			});
		// // 			txt += "\n---: " + JSON.stringify(data[0].chunk.chunk[7]) + "\n";
		// // 			txt += "\nvt: " + vt;
		// // 			let k = (vt != 5 && vt != 5.000000000000001 && vt != 4.999999999999999
		// // 				&& vt != 4.999999999999998
		// // 			) ? "\x1b[34m" : "";
		// // 			// console.log(k + txt);

		// // 		}
		// // 		// console.log("wtfll: " + (new Date() - init) + "ms : " + countObject("water", 0, _map));
		// // 		processingInMain["waterfall"] = false;
		// // 	});
		// // }
	}
	// if (!processingInMain["gradefall"]) {
	// 	processingInMain["gradefall"] = true;
	// 	setTimeout(async () => { // com bugs
	// 		let init = new Date();
	// 		// try { console.log("in: " + JSON.stringify(_map.filter(c => c.x == 0)[0].chunk[21])); } catch (e) { }
	// 		let ret = await gradefall();
	// 		if (ret.length > 0) {
	// 			// console.log("---gradefall--- "+JSON.stringify(_map.filter(c=>c.x==0 && c.y==0)[0].chunk[23][23]));
	// 			let chunks = _map.filter(c => {
	// 				for (let r of ret) {
	// 					if (c.x == r.key.x) return true;
	// 				}
	// 				return false;
	// 			});
	// 			// console.log(chunks[0].chunk[21]);
	// 			// type: "attChunks",
	// 			// data: [{
	// 			// 	keyChunk: { x: chunkAtt.x, y: chunkAtt.y },
	// 			// 	chunk: chunkAtt
	// 			// }]
	// 			let data = chunks.map(c => ({
	// 				keyChunk: { x: c.x, y: c.y },
	// 				chunk: c
	// 			}));
	// 			broadcast({ type: "attChunks", data: data });
	// 			// simulateAttChunks(data);
	// 			//
	// 			let txt = "";
	// 			let t = 0;
	// 			let vt = 0;
	// 			let variMin = 10;
	// 			data.map(c => {
	// 				let chunk = c.chunk;
	// 				for (let blk of chunk.chunk) {
	// 					if (!JSON.stringify(blk).includes("water")) continue;
	// 					let nBlk = [];
	// 					for (let i = 0; i < blk.length; i++) {
	// 						let b = blk[i];
	// 						if (b == null) continue;
	// 						nBlk.push(b);
	// 						if (b.thing == "water") {
	// 							t++;
	// 							b.height = Math.round(b.height * variMin) / variMin;
	// 							b.depth = Math.round(b.depth * variMin) / variMin;

	// 							vt += b.height;
	// 							txt += t + "(" + chunk.chunk.indexOf(blk) + "): " + JSON.stringify(b) + " - ";
	// 							txt += " " + JSON.stringify(blk[i + 1]) + "\n";
	// 						}
	// 						//  else if (i > 0 && blk[i - 1].thing == "water") { // verificar se null
	// 						// }


	// 					}
	// 					blk = nBlk;
	// 				}
	// 			});
	// 			txt += "\n---: " + JSON.stringify(data[0].chunk.chunk[7]) + "\n";
	// 			txt += "\nvt: " + vt;
	// 			let k = (vt != 5 && vt != 5.000000000000001 && vt != 4.999999999999999
	// 				&& vt != 4.999999999999998
	// 			) ? "\x1b[34m" : "";
	// 			// console.log(k + txt);

	// 		}
	// 		// console.log("wtfll: " + (new Date() - init) + "ms : " + countObject("water", 0, _map));
	// 		processingInMain["gradefall"] = false;
	// 	});
	// }
}

//
// GRADEFALL
// 000nota
//
async function gradefall() {
	const eps = 0.1;

	const canAbsrvIn = 2;
	const absrv = (a) => a.hardness < canAbsrvIn;

	const changes = [];

	// ===================================================
	// 1. CHUNK → MATRIZ GLOBAL
	// ===================================================
	const mat = new Map(); // "x,y" => 0,1,2,3
	const waterCells = [];

	for (const chunk of _map) {
		const baseX = chunk.x * tamanho;

		for (let cx = 0; cx < chunk.chunk.length; cx++) {
			const x = baseX + cx;

			for (const blk of chunk.chunk[cx]) {
				const y0 = Math.round(blk.depth);
				const y1 = Math.round(blk.depth + blk.height);

				let id = 0;
				if (blk.thing === "water") id = 1;
				else if (absrv(blk)) id = 2;
				else id = 3;

				for (let y = y0; y < y1; y++) {
					mat.set(`${x},${y}`, id);
					if (id === 1) waterCells.push({ x, y, blk, chunk });
				}
			}
		}
	}

	// snapshot
	const next = new Map(mat);

	// ===================================================
	// 2. SIMULAÇÃO (SÓ MATRIZ)
	// ===================================================
	for (const w of waterCells) {
		const { x, y } = w;

		// tentar cair
		const below = `${x},${y + 1}`;
		if (!mat.has(below)) {
			next.delete(`${x},${y}`);
			next.set(below, 1);
			continue;
		}

		// tentar absorver
		if (mat.get(below) === 2) {
			next.delete(`${x},${y}`);
			continue;
		}

		// espalhar
		const dirs = [-1, 1];
		for (const dx of dirs) {
			const side = `${x + dx},${y}`;
			const sideBelow = `${x + dx},${y + 1}`;

			if (!mat.has(side) && !mat.has(sideBelow)) {
				next.delete(`${x},${y}`);
				next.set(side, 1);
				break;
			}
		}
	}

	// ===================================================
	// 3. MATRIZ → CHUNK (APLICAÇÃO REAL)
	// ===================================================
	for (const w of waterCells) {
		const key = `${w.x},${w.y}`;

		if (!next.has(key)) {
			w.blk.depth += 1 - eps;
			changes.push(w.chunk);
		}
	}

	return [...new Set(changes)].map(c => ({ key: { x: c.x, y: c.y } }));
}


function getConfigs() {
	let retorno = [];
	_map.map(chunk => {
		retorno.push(_getConfigs(chunk));
	});
	return retorno;
}
function _getConfigs(chunk) {
	let variMin = 10;
	let retChunk = {
		x: chunk.x, y: chunk.y,
		gradess: [],
		matrizesQua: []
	}
	for (var i = 0; i < chunk.chunk.length; i++) {
		// ORDENA os blocks : colocar antes de atualizar o map // 000nota
		ordenaBlocksAndCut(chunk, i, variMin);
		//
		let nGrades = [];
		let blocks = chunk.chunk[i];
		let grades = gradeIt(blocks, false);
		grades.map(g => {
			nGrades.push(null);
		});
		retChunk.gradess.push(grades);
		let blocksInterfer = [{ i: i, bks: grades }];
		// matriz quaternária
		// 0 : space
		// 1 : water
		// 2 : wall
		// 3 : absorve
		let matrizQua = matrizeIt(blocksInterfer);
		retChunk.matrizesQua.push(matrizQua);
	}
	return retChunk;
}
function ordenaBlocksAndCut(chunk, i, variMin) {
	let antes = chunk.chunk[i];
	let novo = [];
	let minDepth = 31415926535;
	while (antes.length > 0) {
		let rem = null;
		minDepth = 31415926535;
		for (let b of antes) {
			if (b == null) continue;
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
function gradeIt(blocks, show) {
	let grades = [];
	let variMin = 10;
	for (var a = 0; a < blocks.length; a++) {
		if (blocks[a] == null) continue;
		blocks[a].height = Math.round(blocks[a].height * variMin) / variMin;
		blocks[a].depth = Math.round(blocks[a].depth * variMin) / variMin;
		// if (chunkEqKey(chunk, chaveChunk)&&show) console.log("going-pre(" + i + "): " + JSON.stringify(chunk.chunk[i]));
		let entring = { h: blocks[a].height, d: blocks[a].depth, t: blocks[a].thing, hd: blocks[a].hardness, color: blocks[a].color };
		// aglutina
		if (a >= 1) {
			let last = grades[grades.length - 1];
			if (last.t == entring.t && last.hd == entring.hd && last.color == entring.color) {
				if (blocks[a - 1] != null) {
					last.h += entring.h;
					blocks[a - 1].height += entring.h;
					blocks[a - 1].height = Math.round(blocks[a - 1].height * variMin) / variMin;
					blocks[a] = null;
					continue;
				}
			}
		}
		entring.h = Math.round(entring.h * variMin) / variMin;
		entring.d = Math.round(entring.d * variMin) / variMin;
		//
		grades.push(entring);

	}
	// refatora tirando os null de blocks
	// if (show) console.log("in-gradeIt:\n",blocks);
	blocks = blocks.filter(b => b != null).filter(b => b.height != 0);
	// if (show) console.log("in-gradeIt:\n",grades);
	//
	let lastD = grades[0].d;
	if (lastD != 0) {
		grades.unshift({ h: grades[0].d, d: 0, t: "space", hd: 0, color: null });
		lastD = grades[0].d;
	}
	let ind = 0
	let nGrades = [];
	for (let g of grades) {
		// console.log(lastD);
		if (g.d != lastD) {
			nGrades.push({ h: g.d - lastD, d: lastD, t: "space", hd: 0, color: null });
		}
		lastD = g.d + g.h;
		nGrades.push(g);
		// console.log(nGrades);
	}
	return nGrades.map(g => {
		g.h = Math.round(g.h * variMin) / variMin;
		g.d = Math.round(g.d * variMin) / variMin;
		return g;
	}).filter(g => g.h != 0);
}
function matrizeIt(blocksInterfer) {
	const canAbsrvIn = 2;
	const absrv = (a) => a.hd < canAbsrvIn;
	let variMin = 10;
	let matrizQua = [];
	for (let bks of blocksInterfer) {
		let pre = []
		let level = 0;
		let numberNow = 0;
		let qt = 0;
		for (let indB = 0; indB < bks.bks.length; indB++) {
			let n = null;
			// console.log(bks.bks[indB],level);
			qt = bks.bks[indB].h;
			if (bks.bks[indB].t == "space") n = 0;
			else if (bks.bks[indB].t == "water") n = 1;
			else if (absrv(bks.bks[indB])) n = 2;
			else n = 3;
			qt = Math.round(qt * variMin) / variMin;
			if (qt == 0) continue;
			pre.push([n, qt, { thing: bks.bks[indB].t, hardness: bks.bks[indB].hd, color: bks.bks[indB].color }]);
		}
		// // aglutina
		// let done = true;
		// while (done) {
		// 	done = false;
		// 	for (let k = 1; k < pre.length; k++) {
		// 		if (pre[k][0] == pre[k - 1][0]) {
		// 			pre[k - 1][1] += pre[k][1];
		// 			pre[k][1] = 0;
		// 			done = true;
		// 		}
		// 	}
		// 	pre = pre.filter(e => e[1] > 0);
		// }
		matrizQua = pre.filter(e => e[1] > 0);
		// matrizQua = pre;
	}
	return matrizQua;
}
// WATERFALL
async function waterfall() {
	if (repeatWaterfall <= 0) return;
	// ordenar os blocks e os chunks antes de waterfall
	let changes = [];
	// let mapCopied = _map.copyWithin(_map.length,0);
	let hashesKeyChunks = getHashesKeyChunks();
	let chaveChunk = "-100,0";
	console.log();
	// fs.readFileSync("./data/configs/definitions_clientToServer.json", "utf-8");
	fs.writeFileSync(
		"./tester/_map.json",
		JSON.stringify(_map, null, 2), // null,2 = JSON bonito
		"utf-8"
	);
	_map.map(chunk => {
		//
		let chA = hashesKeyChunks.get((chunk.x - 1) + "," + chunk.y);
		let chB = hashesKeyChunks.get((chunk.x + 1) + "," + chunk.y);
		// console.log(chA.x + "," +chunk.x+","+ chB.x);
		//
		let variMin = 10;
		let change = false;
		let tam = chunk.chunk.length;
		for (var i = 0; i < chunk.chunk.length; i++) {
			let blocks = chunk.chunk[i];
			let indsRemove = [];
			let changeNow = false
			for (var a = 0; a < blocks.length - 1; a++) { // -1 pra não ser o ultimo
				let show = i == 13;
				if (chunkEqKey(chunk, chaveChunk) && show) console.log("going-pre(" + i + "): " + JSON.stringify(chunk.chunk[i]));
				// console.log()
				if (blocks[a].thing == "water") {
					let v = blocks[a].height;
					if (v == 0) {
						// console.log("remove: (" + i + ")" + JSON.stringify(blocks[a]) + "\n");
						indsRemove.push(a);
						continue;
					}
					let p = Math.round((v + blocks[a].depth) * variMin) / variMin;
					// console.log("inner: (" + i + ") => " + blocks[a + 1].depth + ", " + blocks[a].depth + ", " + v)
					// down water
					if (blocks[a + 1].depth >= p + v) {// cabe completamente
						blocks[a].depth += v;
						// console.log("down total");
						change = true;
						changeNow = true;
					} else if (blocks[a + 1].depth > p) { // cabe parcialmente
						let cab = blocks[a + 1].depth - p;
						blocks[a].depth += cab;
						// console.log("down parcial");
						change = true;
						changeNow = true;
					} else if (blocks[a + 1].thing == "water") { // aglutinate water
						blocks[a].height += blocks[a + 1].height;
						blocks.splice(a + 1, 1);
						// console.log("aglutinate");
						change = true;
						changeNow = true;
					} else { // splash water

						if (chunkEqKey(chunk, chaveChunk) && show) console.log("splash")
						// getting 
						let init_ = [{ i: i }]
						let adjs = [];
						if (i > 0) {
							adjs.push({ i: i - 1 });
						}
						else {
							adjs.push({ i: i - 1 }); // next chunks  
						}
						if (i < tam - 1) {
							adjs.push({ i: i + 1 });
						}
						else {
							adjs.push({ i: i + 1 }); // next chunks 
						}

						// getting
						let holes = []
						for (let ad of adjs) {
							let ch = null;
							if (ad.i < 0) ch = chA;
							else if (ad.i >= tam) ch = chB
							else ch = chunk;
							// console.log(ad.i);
							// console.log(ch.x);
							if (ch.chunk[(ad.i + tam) % tam].length > 0) {
								holes.push({ i: ad.i });
							}
							// console.log("end")
							// try { // erro bizarro q rola qnd vai reconstruir o chunk lá no mai
							// 	if (ch.chunk[(ad.i + tam) % tam].length > 0) {
							// 		holes.push({ i: ad.i });
							// 	}
							// } catch (e) {
							// 	console.log("mini-erro bizarro");
							// 	continue;
							// }
						}
						// verify se tem q ficar quieto
						let ver = [{
							block: chunk.chunk[i],
							pos: { i: i }
						}];
						holes.map(b => {
							let ch = null;
							if (b.i < 0) ch = chA;
							else if (b.i >= tam) ch = chB;
							else ch = chunk;

							ver.push({
								block: ch.chunk[(b.i + tam) % tam],
								pos: { i: b.i }
							});
						});
						if (chunkEqKey(chunk, chaveChunk) && show) {
							for (let v of ver) console.log("ver: " + JSON.stringify(v))
						}
						// verifica
						let quiet = true;
						for (let v = 1; v < ver.length; v++) {
							if (ver[v].block.length > 0) {
								let w = ver[v].block.length > 0;
								let ind = 0;
								if (w && ver[v].block[ind].thing == "water" && ver[0].block[0].thing == "water") {
									if (Math.round(Math.abs(ver[v].block[ind].depth - ver[0].block[0].depth) * variMin) / variMin > 1 / variMin) {
										quiet = false;
										// console.log("n: " + Math.round(Math.abs(ver[v].block[ind].depth - ver[0].block[0].depth) * variMin) / variMin);
									}
								} else if (w) { // quando tem uma parede q ultrapassa onivel da agua
									if (Math.round((ver[v].block[ind].depth - ver[0].block[0].depth) * variMin) / variMin > 1 / variMin) {
										quiet = false;
										// console.log("s: " + Math.round(Math.abs(ver[v].block[ind].depth - ver[0].block[0].depth) * variMin) / variMin);
									}
								}
							}
						}
						if (quiet) {
							let desnRel = false;
							// desnível relativo : 7, 7.1, 6.9
							for (let v = 0; v < ver.length; v++) {
								for (let w = 0; w < ver.length; w++) {
									if (v != w && ver[v].block[0].thing == "water" && ver[w].block[0].thing == "water") {
										// console.log(ver[v].block[0].depth - ver[w].block[0].depth);
										if (Math.round((ver[v].block[0].depth - ver[w].block[0].depth) * variMin) / variMin >= 1 / variMin * 2) {
											desnRel = true;
											// console.log(JSON.stringify(ver));
											let d = ver[v].block[0].depth - ver[w].block[0].depth;
											// retira v (mais alto)
											ver[w].block[0].depth += d;
											ver[w].block[0].height -= d;
											// console.log(JSON.stringify(ver));
											// distribuition
											d *= variMin;
											d = Math.round(d);
											let aum = (d - d % 2) / 2;
											aum /= variMin;
											// d /= variMin;
											//
											ver[v].block[0].depth -= aum;
											ver[v].block[0].height += aum;
											// console.log(JSON.stringify(ver));
											ver[w].block[0].depth -= aum;
											ver[w].block[0].height += aum;
											// console.log(JSON.stringify(ver));
											ver[w].block[0].depth -= (d % 2) / variMin;
											ver[w].block[0].height += (d % 2) / variMin;
											// console.log("rsn "+v+","+w);
											// rounding
											ver[v].block[0].depth = Math.round(ver[v].block[0].depth * variMin) / variMin;
											ver[v].block[0].height = Math.round(ver[v].block[0].height * variMin) / variMin;
											ver[w].block[0].depth = Math.round(ver[w].block[0].depth * variMin) / variMin;
											ver[w].block[0].height = Math.round(ver[w].block[0].height * variMin) / variMin;

											// console.log(JSON.stringify(ver));
											// reatrib

											ver.map(b => {
												let ch = null;
												if (b.pos.i < 0) ch = chA
												else if (b.pos.i >= tam) ch = chB;
												else ch = chunk;
												ch.chunk[(b.pos.i + tam) % tam] = b.block;
											});
											// console.log("\x1b[33m reatrib: (" + countWater(0, chunk) + ")\n\n" + JSON.stringify(chunk.chunk));
										}
									}
								}
							}
							// if (desnRel) console.log("desnRel");
							//
							// console.log("quiet");
							// console.log(ver);
							continue;
						}
						//
						let qt = holes.length;
						// level
						let levels = [{ h: 0 * variMin, d: chunk.chunk[i][1].depth * variMin, p: { i: i } }];
						for (let h of holes) {
							let ch = null;
							if (h.i < 0) ch = chA
							else if (h.i >= tam) ch = chB;
							else ch = chunk;
							levels.push({ h: 0 * variMin, d: ch.chunk[(h.i + tam) % tam][0].depth * variMin, p: { i: h.i } });
						}
						// ordena
						levels.sort((a, b) => b.d - a.d);
						// console.log("init: ");
						// console.log(JSON.stringify(levels));
						// leveller
						let thisRepeat = 5;
						if (chunkEqKey(chunk, chaveChunk) && show) {
							for (let l of levels) console.log("l: " + JSON.stringify(l) + '\n')
						}
						while (true) {
							v = (blocks[a].height) * variMin;
							if (thisRepeat <= 0 || v == 0) break;
							//
							let mins = [];
							let min = -31415926535;
							// pega os minimos
							let ind = 0;
							let txt = "";
							// console.log("mins: ");
							for (let l of levels) {
								txt += " (" + l.d + "," + l.h + ");"
								if (l.d - l.h >= min) {
									min = l.d - l.h;
									mins.push(ind)
								}
								ind++;
							}
							// console.log(txt);
							// console.log("mins: " + JSON.stringify(mins));
							// pega o proximo level
							let nx = 31415926535;
							ind = 0;
							for (let l of levels) {
								if (l.d - l.h != min) {
									nx = ind;
									break;
								}
								ind++;
							}
							// console.log("nx: " + nx);
							if (nx == 31415926535) nx = mins[0];
							// fazer distribuir o restante da água..

							// destiny volume
							let dif = levels[mins[0]].d - levels[mins[0]].h - (levels[nx].d - levels[nx].h);
							// console.log("lp" + thisRepeat);
							// console.log(JSON.stringify(levels));
							dif *= mins.length;
							// console.log("dif: " + dif + ", v:" + v);
							// splash
							let qt = mins.length;
							// free trash
							v = Math.round(v);
							dif = Math.round(dif);
							//
							txt = "" + v + ", " + dif + " : " + qt;
							if (v >= dif) {
								if (mins[0] == nx || dif == 0) dif = v;
								v -= dif;
								if (dif % qt == 0) {
									for (let b of mins) {
										change = true;
										changeNow = true;
										levels[b].h += dif / qt;
									}
								} else {
									let r = (dif - dif % qt) / qt;
									for (let b of mins) {
										change = true;
										changeNow = true;
										levels[b].h += r;
									}
									// distribui o resto
									r = dif % qt;
									for (let b of mins) {
										if (r == 0) break;
										change = true;
										changeNow = true;
										levels[b].h += 1;
										r -= 1;
									}
								}
							}
							else {
								// if (mins[0] == nx) dif = v;
								if (v % qt == 0) {
									let r = v / qt;
									change = true;
									changeNow = true;
									for (let b of mins) {
										if (v == 0) break;
										levels[b].h += r;
										v -= r;
									}
								} else {
									change = true;
									changeNow = true;
									let r = (v - v % qt) / qt;
									for (let b of mins) {
										if (v == 0) break;
										levels[b].h += r;
										v -= r;
									}
									// distribui o resto
									for (let b of mins) {
										if (v == 0) break;
										levels[b].h += 1;
										v -= 1;
									}
								}
							}
							blocks[a].height = v / variMin;
							// console.log(txt + "\n" + v);
							thisRepeat--;
							// console.log(JSON.stringify(levels));
							// att values
							// for (let l of levels){
							// 	l.d = Math.round(l.d;
							// 	l.h = Math.round(l.h*variMin)/variMin;
							// }
						}
						// reassociate
						for (let l of levels) {
							let base = makeWaterBlock(l.h / variMin, 0);
							base.height = l.h / variMin;
							base.depth = (l.d - l.h) / variMin;

							base.height = Math.round(base.height * variMin) / variMin;
							base.depth = Math.round(base.depth * variMin) / variMin;
							if (base.height != 0) {
								if (l.p.i == i) {
									blocks[0] = base;
									chunk.chunk[i] = blocks;
									// console.log(i + ":> " + JSON.stringify(chunk.chunk[21]));
								}
								else {
									let ch = null;
									if (l.p.i < 0) ch = chA
									else if (l.p.i >= tam) ch = chB;
									else ch = chunk;
									ch.chunk[(l.p.i + tam) % tam].unshift(base);
									// console.log(l.p.i + ": " + JSON.stringify(chunk.chunk[l.p.i]));
								}
							}
						}


						//
						// if (chunkEqKey(chunk, "0") && i == 21) console.log("going-pre-inner(" + i + "): " + JSON.stringify(chunk.chunk[i]));
					}
					blocks[a].color = getColorByProf("water", blocks[a].height, stepDefaultMetters * 7 * coeExpantionToMetters)
					if (changeNow) break; // dizem q n pode tirar
				}
				// cores
			}
			// if (chunkEqKey(chunk, "0") && change && i == 21) {
			// 	// console.log("going-pre: " + JSON.stringify(chunk.chunk[i]));
			// }
			chunk.chunk[i] = blocks;
			// if (change) {
			// 	// console.log("fn ("+i+"):"+countWater(0, chunk));
			// 	// let idN = Math.round(Math.random() * 100);
			// 	// console.log('>m-ret ' + idN);
			// 	// miniRet([{
			// 	// 	key: { x: chunk.x }
			// 	// }], idN);
			// 	// console.log('<m-ret ('+JSON.stringify(indsRemove)+')' + JSON.stringify(chunk.chunk[5])+ JSON.stringify(chunk.chunk[6])+ JSON.stringify(chunk.chunk[7]));
			// }
			for (let ind = 0; ind < blocks.length; ind++) {
				if (chunk.chunk[i][ind].height == 0) chunk.chunk[i].splice(ind, 1);
			}
			// if (change){
			// 	console.log("r-fn ("+i+"):"+countWater(0, chunk));
			// 	console.log('<m-ret ('+JSON.stringify(indsRemove)+')' + JSON.stringify(chunk.chunk[5])+ JSON.stringify(chunk.chunk[6])+ JSON.stringify(chunk.chunk[7]));

			// }
		}
		if (change) {
			changes.push({
				key: { x: chunk.x, y: chunk.y },
			});
		}
	});
	//
	// console.log("\x1b[31m returning");
	return changes;
}
// auxs
function getHashesKeyChunks() {
	let a = new Map();
	let mnx = 31415926535;
	let mxx = -31415926535;
	for (let c of _map) {
		a.set(c.x + "," + c.y, c);
		if (c.x < mnx) mnx = c.x;
		if (c.x > mxx) mxx = c.x;
	}
	// define os de tras e os da frente como os q dá a volta (sem y)
	a.set((mnx - 1) + "," + 0, a.get(mxx + "," + 0));
	a.set((mxx + 1) + "," + 0, a.get(mnx + "," + 0));
	// console.log(a.get((mnx-1) + "," + 0));
	return a;
}
function makeWaterBlock(h, d) {
	return {
		height: h,
		depth: d,
		thing: "water",
		hardness: 1,
		color: getColorByProf("water", h, stepDefaultMetters * 7 * coeExpantionToMetters)
	};
}
function getColorByProf(thing, m, total) {

	switch (thing) {
		case "water":
			let a = [0, 40, 120, 255]; // water
			let b = [0, 120, 255, 255]; // shallow
			//
			let colorWater = a;
			let retorno = [colorWater[0],
			(b[1] - colorWater[1]) * (1 - m / total) + colorWater[1],
			(b[2] - colorWater[2]) * (1 - m / total) + colorWater[2],
				255];
			// console.log(retorno)
			return retorno;
		default:
			erro("Cor não identificada - getColorByProf: " + thing);
			return [0, 0, 0, 64]; // void

	}
}
function countObject(object, nivel, place) {
	let variMin = 10;
	let v = 0;
	switch (nivel) {
		case 0:
			v = 0;
			place.map(chunk => {
				for (let l of chunk.chunk) {
					for (let b of l) {
						if (b.thing == object) v += b.height;
					}
				}
			});
			// 441.8449447231262 = 441.9
			// 447.9
			// 452.9
			break;
		case 1:
			v = 0;
			for (let l of place.chunk) {
				for (let b of l) {
					if (b.thing == bject) v += b.height;
				}
			}
			break;
		default:
			return -314;
	}
	return Math.round(v * variMin) / variMin;
}
function chunkEqKey(chunk, key) {
	return (chunk.x + "," + chunk.y) == key;
}