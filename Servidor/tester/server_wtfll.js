import express from "express";
import { pri, getId, getDate, getTime } from "../../Auxs/auxiliar.js";
import path from "path";
import { Worker } from "worker_threads";
import os from "os";
import { exec } from "child_process";

const app = express();

const __dirname = "/mnt/c/Users/samug/OneDrive/Documentos/Scripts/Scriptshtml/Savior/"
const portaCliente = 1234;
const portaServer = 3141;
const portaWebSocket = 3000;
const ipGeral = "192.168.0.15"; // 192.168.0.15 10.36.65.102

// Função para obter o IP interno do WSL (172.x.x.x)
function getWslIp() {
	const interfaces = os.networkInterfaces();
	for (const name in interfaces) {
		for (const net of interfaces[name]) {
			if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('172.17.')) {
				return net.address;
			}
		}
	}
	return 'localhost';
}

const wslIp = getWslIp();
// Servir o cliente
app.use(express.static(path.join(__dirname, "Servidor/tester")));

// Rotas HTTP Cliente
app.get("/api/msg", (req, res) => {
	res.json({ msg: "Servidor respondeu!" });
});
app.get("/checkConnection", (req, res) => {
	res.json({ msg: "Connected!" });
});
app.get("/map", (req, res) => {
	res.json({ msg: "Mapa salvo" });
});



// app.get("/checkConnection", (req, res) => {
// 	res.json({ msg: "Connected!" });
// });

// app.get("/map", (req, res) => {
// 	res.json({ msg: "Mapa salvo" });
// });

// ESCUTA NO ENDEREÇO 0.0.0.0 (Todas as interfaces)
app.listen(portaCliente, '0.0.0.0', () => {
	console.log(`\n======================================================`);
	console.log(`✅ Servidor Express rodando no WSL (IP Interno): ${wslIp}:${portaCliente}`);
	console.log(`🌐 ACESSO EXTERNO (Celular/LAN):`);
	console.log(`\n📱 ACESSE DO SEU CELULAR:`);
	console.log(`   http://${ipGeral}:${portaCliente}/`);
	console.log(`\n🔌 WebSocket: ws://${ipGeral}:${portaWebSocket}`);
});


// game variables
var _map = []; // mapa do jogo
var _seed = 2906;
// formSeed(); // semente inicial do jogo
/* SEMENTES LEGAIS
2906: teste de waterfall
6800: territorio grande com lagos
*/

// game
import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: portaWebSocket });

console.log("Servidor WebSocket rodando na porta " + portaWebSocket);

// Lista de clientes conectados
class Client {
	constructor(ws) {
		this.id = getId();
		this.pos = [0, 0];
		this.ws = ws;
	}
}

var processes = [];
class Processor {
	constructor(ws) {
		this.id = getId();
		this.ws = ws;
	}
	add(type) {
		let idTime = getTime();
		text("Processo adicionado:    " + idTime + " " + type, "g");
		processes.push({ type: type, idTime: idTime });
		return idTime;
	}
	getType(idTime) {
		try {
			return processes.filter(e => e.idTime == idTime)[0].type;
		} catch (e) {
			return "undefined";
		}
	}
	remove(idTime) {
		text("Processo removido:      " + idTime + " " + this.getType(idTime), "r");
		processes = processes.filter(e => e.idTime != idTime);
	}
}

var processor = new Processor();
let clients = [];
// SERVIDOR
const appServer = express();
// Servir o servidor
appServer.use(express.static(path.join(__dirname, "Servidor/logger")));
// Rotas HTTP Servidor
appServer.get("/getAll", (req, res) => {
	res.json({ tamanho: _map.length, clientes: clients });
});
appServer.get("/newMap", (req, res) => {
	_map = [];
	try {
		send(clients[0].ws, { type: "newMap", data: ["newMap"] });
	} catch (e) {
		console.log("Nenhum cliente conectado para enviar o newMap\n" + clients.length);
	}
	res.json({ tamanho: _map.length, clientes: clients });
});
// listenner
appServer.listen(portaServer, '0.0.0.0', () => {
	console.log(`\n======================================================`);
	console.log(`✅ Admin Servidor Express rodando: http://${ipGeral}:${portaServer}`);
	// console.log(`🌐 ACESSO EXTERNO (Celular/LAN):`);
	// console.log(`\n📱 ACESSE DO SEU CELULAR:`);
	// console.log(`   http://${ipGeral}:${portaCliente}/`);
	// console.log(`\n🔌 WebSocket: ws://${ipGeral}:${portaWebSocket}`);
});
// end

wss.on("connection", (ws) => {
	let client = new Client(ws);
	clients.push(client);
	console.log("Cliente conectado. Total:", clients.length);
	send(ws, { type: "initialMap", id: client.id, data: _map });
	send(ws, { type: "seed", seed: _seed });

	// ⚠️ ASYNC adicionado para processamento assíncrono
	ws.on("message", async (msg) => {
		const data = JSON.parse(msg);
		let fracId = data.id.split(" ")[0];
		let withoutMap = ["formSeed"];
		withoutMap.filter(e => e != data.type).forEach(e => console.log("Recebido de " + fracId + " : " + data.type + "" + data.data.length + " " + getTime()));
		withoutMap.filter(e => e == data.type).forEach(e => console.log("Recebido de " + fracId + " : " + data.type + "" + " " + getTime()));

		let sendGeral = data;

		// Libera o event loop imediatamente para processar próximas mensagens
		setImmediate(async () => {
			await processMessage(ws, data, client, fracId, sendGeral);
		});
	});

	// Quando o cliente desconectar
	ws.on("close", () => {
		clients = clients.filter((c) => c.ws !== ws);
		console.log("Cliente saiu. Total:", clients.length);
	});
});

// ============================================
// FUNÇÃO ASSÍNCRONA PARA PROCESSAR MENSAGENS
// ============================================

async function processMessage(ws, data, client, fracId, sendGeral) {
	var worker;
	let idTime = processor.add(data.type);

	switch (data.type) {
		case "map":
			_map = data.data;
			broadcast(sendGeral);
			send(ws, { type: "seed", seed: _seed });
			break;
		case "orderChunks":
			for (let c of clients) {
				if (c.id == data.id) {
					c.pos = data.pos;
				}
			}

			try {
				// Aguarda o worker de forma assíncrona	
				const result = await runWorker({
					type: "orderChunks",
					pos: data.pos,
					map: data.data,
				});

				console.log("Enviando " + result.length + " chunks ordenados para ", fracId, ",", getTime());
				send(ws, { type: "orderChunks", data: result });
			} catch (err) {
				erro("Erro no Worker Thread:", err);
			}
			break;

		case "map-orderChunks":
			_map = data.data;

			for (let c of clients) {
				if (c.id == data.id) {
					c.pos = data.pos;
				}
			}

			// Broadcast do mapa para outros clientes
			sendGeral["type"] = "map";
			broadcastExceptId(sendGeral, data.id);

			try {
				// Aguarda o worker de forma assíncrona
				const result = await runWorker({
					type: "orderChunks",
					pos: data.pos,
					map: data.data,
				});

				// Verifica se ainda há apenas 1 processo deste tipo
				if (processes.filter(e => e.type == "map-orderChunks").length > 10) {
					console.log("Ignorando resultado - múltiplos processos ativos");
					processor.remove(idTime);
					return;
				}

				console.log("Enviando " + result.length + " chunks do tipo {" + Object.keys(result[0]) + "} ordenados para ", fracId, ",", getTime());
				send(ws, { type: "orderChunks", data: result });
				processor.remove(idTime);
			} catch (err) {
				erro("Erro no Worker Thread:", err);
				processor.remove(idTime);
			}
			break;
		case "addMap-orderChunks":
			// merge
			data.data.filter(c => !_map.find(m => m.x === c.x && m.y === c.y)).forEach(c => {
				_map.push(c);
			})
			_map.map(m => {
				m = data.data.find(c => c.x === m.x && c.y === m.y);
			});
			// console.log("after chunks c/ graphics: " + _map.filter(c => c.graphics).length);
			//
			for (let c of clients) {
				if (c.id == data.id) {
					c.pos = data.pos;
				}
			}

			// Broadcast do mapa para outros clientes
			sendGeral["type"] = "map";
			broadcastExceptId(sendGeral, data.id);

			try {
				// Aguarda o worker de forma assíncrona
				const result = await runWorker({
					type: "orderChunks",
					pos: data.pos,
					map: data.data,
				});

				// Verifica se ainda há apenas 1 processo deste tipo
				if (processes.filter(e => e.type == "map-orderChunks").length > 10) {
					console.log("Ignorando resultado - múltiplos processos ativos");
					processor.remove(idTime);
					return;
				}
				try {
					console.log("Enviando " + result.length + " chunks do tipo {" + Object.keys(result[0]) + "} ordenados para ", fracId, ",", getTime());

				} catch (e) {
					erro("Result: " + result);
				}
				send(ws, { type: "orderChunks", data: result });
				processor.remove(idTime);
			} catch (err) {
				erro("Erro no Worker Thread:", err);
				processor.remove(idTime);
			}
			break;

		case "formSeed":
			formSeed();
			console.log("Seed formada: " + _seed);
			broadcast({ type: "seed", seed: _seed });
			break;
		case "newMap":
			_map = data.data;
			sendGeral["type"] = "map";
			broadcast(sendGeral);
			break;
		case "addInMap":
			// keyChunk: { x: chunk.x, y: chunk.y }, 
			// 		localChunk: { x: x, y: y },
			// 		localBlock: 0,
			// 		what: {
			// 			height: stepDefaultMetters * coeExpantionToMetters,
			// 			depth: metters,
			// 			thing: selectPutting,
			// 			hardness: 1,
			// 			color: getColor(selectPutting)
			// 		}
			let chunkAtt = null;
			_map.map(c => {
				if (c.x == data.data.keyChunk.x) {
					// Adiciona o novo bloco na posição correta dentro da chunk
					chunkAtt = c;
					switch (data.data.localBlock) {
						case 0:
							c.chunk[data.data.localChunk.x].unshift(data.data.what);
							break;
						default:
							erro("Tipo de localBlock desconhecido: " + data.data.localBlock);
					}
				}
			});
			console.log("Received (addInMap): "+JSON.stringify(data.data));
			// ordena o block do chunk
			if (data.data.localChunk.x < 0) {
				erro("Chunk com posição negativa não suportada --addInMap:" + JSON.stringify(data.data.localChunk));
			}
			let antes = chunkAtt.chunk[data.data.localChunk.x];
			if (antes == null) {
				erro("Chunk não encontrado para atualização --addInMap:" + JSON.stringify(chunkAtt.atualized) + "\n" + JSON.stringify(chunkAtt.x) + "\n" + JSON.stringify(chunkAtt.renderHash));
			}
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
				}
				novo.push(rem);
				antes.splice(antes.indexOf(rem), 1);
			}
			chunkAtt.chunk[data.data.localChunk.x] = novo;
			// envia atualização para todos
			broadcast({
				type: "attChunks",
				data: [{
					keyChunk: { x: chunkAtt.x },
					chunk: chunkAtt
				}]
			});
			processor.remove(idTime);
			break;
		default:
			console.log("server.js - Tipo de dado desconhecido: " + data.type);
	}
}

// ============================================
// FUNÇÃO HELPER PARA EXECUTAR WORKER COM PROMISE
// ============================================

function runWorker(workerData) {
	return new Promise((resolve, reject) => {
		const worker = new Worker("../Auxs/worker.js", { workerData });

		worker.on("message", (result) => {
			resolve(result);
			worker.terminate(); // Limpa o worker após uso
		});

		worker.on("error", (err) => {
			reject(err);
			worker.terminate();
		});

		worker.on("exit", (code) => {
			if (code !== 0 && code !== 1) {
				reject(new Error(`Worker parou com código ${code}`));
			}
		});
	});
}

// game
function formSeed() {
	_seed = Math.floor(Math.random() * 10000);
}
var processingInMain = {
	"waterfall": false,

};
main();
function main() {
	if (!processingInMain["waterfall"]) {
		processingInMain["waterfall"] = true;
		setImmediate(async () => { // com bugs
			try { console.log("in: " + JSON.stringify(_map.filter(c => c.x == 0)[0].chunk[21])); } catch (e) { }
			let ret = await waterfall();
			if (ret.length > 0) {
				// console.log("---waterfall--- "+JSON.stringify(_map.filter(c=>c.x==0 && c.y==0)[0].chunk[23][23]));
				let chunks = _map.filter(c => {
					for (let r of ret) {
						if (c.x == r.key.x) return true;
					}
					return false;
				});
				console.log(chunks[0].chunk[21][6]);
				// type: "attChunks",
				// data: [{
				// 	keyChunk: { x: chunkAtt.x, y: chunkAtt.y },
				// 	chunk: chunkAtt
				// }]
				let data = chunks.map(c => ({
					keyChunk: { x: c.x },
					chunk: c
				}));
				broadcast({ type: "attChunks", data: data });
			}
			processingInMain["waterfall"] = false;
		});
	}
	setTimeout(main, 20);
}
var repeatWaterfall = 20;
async function waterfall() {
	if (repeatWaterfall <= 0) return;
	// ordenar antes de waterfall
	let changes = [];
	// let mapCopied = _map.copyWithin(_map.length,0);
	_map.map(chunk => {
		let change = false;
		for (var i = 0; i < chunk.chunk.length; i++) {
			let blocks = chunk.chunk[i];
			// let tam = chunk.chunk[i].length;

			for (var a = 0; a < blocks.length - 1; a++) { // -1 pra não ser o ultimo
				if (chunkEqKey(chunk, "0") && i == 21) console.log("going-pre-inner(" + i + "): " + JSON.stringify(chunk.chunk[i]));
				if (blocks[a].thing == "water") {
					let v = blocks[a].height;
					if (v == 0) continue;
					let p = v + blocks[a].depth;
					// down water
					if (blocks[a + 1].depth >= p + v) {// cabe completamente
						blocks[a].depth += v;
						change = true;
					} else if (blocks[a + 1].depth > p) { // cabe parcialmente
						let cab = blocks[a + 1].depth - p;
						blocks[a].depth += cab;
						change = true;
					} else if (blocks[a + 1].thing == "water") { // aglutinate water
						blocks[a].height += blocks[a + 1].height;
						blocks.splice(a + 1, 1);
						change = true;
					} else { // splash water
						// getting 
						let adjs = [];
						if (i > 0) {
							adjs.push({ i: i - 1});
						}
						if (i < tam - 1) {
							adjs.push({ i: i + 1});
						}
						let variMin = 10;
						// getting
						let holes = []
						for (let ad of adjs) {
							if (chunk.chunk[ad.i].length > 0) {
								holes.push({ i: ad.i });
							}
						}
						let qt = holes.length;
						// level
						let levels = [{ h: 0 * variMin, d: chunk.chunk[i][1].depth * variMin, p: { i: i } }];
						for (let h of holes) {
							levels.push({ h: 0 * variMin, d: chunk.chunk[h.i][0].depth * variMin, p: { i: h.i } });
						}
						// ordena
						levels.sort((a, b) => b.d - a.d);
						// console.log(levels);
						// [
						// 	{ h: 1.0999999999999872, d: 14.2, p: { i: 23, j: 22 } },
						// 	{ h: 0, d: 15.3, p: { i: 24, j: 23 } },
						// 	{ h: 0, d: 15.6, p: { i: 23, j: 23 } },
						// 	{ h: 0, d: 15.9, p: { i: 22, j: 23 } },
						// 	{ h: 0, d: 16.5, p: { i: 23, j: 24 } }
						// ]
						// leveller
						let thisRepeat = 5;
						while (true) {
							v = blocks[a].height * variMin;
							if (thisRepeat <= 0 || v == 0) break;
							//
							//
							let mins = [];
							let min = -31415926535;
							// pega os minimos
							let ind = 0;
							let txt = "";
							for (let l of levels) {
								txt += " " + l.d - l.h + ";"
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
							dif *= mins.length;
							// console.log("dif: " + dif + ", v:" + v);
							// splash
							if (v >= dif) {
								if (mins[0] == nx) dif = v;
								v -= dif;
								let qt = mins.length;
								if (dif % qt == 0) {
									for (let b of mins) {
										change = true;
										levels[b].h += dif / qt;
									}
								} else {
									for (let b of mins) {
										change = true;
										levels[b].h += (dif - dif % qt) / qt;
									}
								}
							}
							else {
								let qt = mins.length;
								if (v % qt == 0) {
									change = true;
									for (let b of mins) {
										levels[b].h += v / qt;
									}
								} else {
									change = true;
									for (let b of mins) {
										levels[b].h += (v - v % qt) / qt;
									}
									// distribui o resto
									v %= qt;
									for (let b of mins) {
										levels[b].h += 1;
										v -= 1;
										if (v == 0) break;
									}
								}
							}
							blocks[a].height = v / variMin;
							thisRepeat--;
							// att values
							// for (let l of levels){
							// 	l.d = Math.round(l.d;
							// 	l.h = Math.round(l.h*variMin)/variMin;
							// }
							console.log(levels);
						}
						// reassociate
						for (let l of levels) {
							let base = makeWaterBlock(0, 0);
							base.height = l.h / variMin;
							base.depth = (l.d - l.h) / variMin;
							if (base.height != 0) {
								if (l.p.i == i) {
									blocks[0] = base;
									chunk.chunk[i] = blocks;
									console.log(i + ":> " + JSON.stringify(chunk.chunk[21]));
								}
								else {
									chunk.chunk[l.p.i].unshift(base);
									console.log(l.p.i + ": " + JSON.stringify(chunk.chunk[l.p.i]));
								}
							}
						}
						//
						if (chunkEqKey(chunk, "0") && i == 21) console.log("going-pre-inner(" + i + "): " + JSON.stringify(chunk.chunk[i]));
					}

				}
			}
			if (chunkEqKey(chunk, "0") && change && i == 21) {
				console.log("going-pre: " + JSON.stringify(chunk.chunk[i]));
			}
			chunk.chunk[i] = blocks;
		}
		if (change) {
			changes.push({
				key: { x: chunk.x }
			});
			console.log("going: " + JSON.stringify(chunk.chunk[21][6]));
			// repeatWaterfall-=1;
		}

	});
	//
	return changes;
}

// message
function send(ws, msg) {
	msg["time"] = getTime();
	ws.send(JSON.stringify(msg));
}

// Função pra enviar para todos
function broadcast(obj) {
	const json = obj;
	for (const c of clients) {
		send(c.ws, json);
	}
}

function broadcastExceptId(obj, id) {
	const json = obj;
	for (const c of clients) {
		if (c.id == id) continue;
		send(c.ws, json);
	}
}
// auxiliares
function makeWaterBlock(h, d) {
	return {
		height: h,
		depth: d,
		thing: "water",
		hardness: 1,
		color: "#00ccffff"
	};
}

function chunkEqKey(chunk, key) {
	return chunk.x == key;
}
function text(msg, col) {
	let colors = [
		["k", 30],
		["r", 31],
		["g", 32],
		["y", 33],
		["b", 34],
		["m", 35],
		["c", 36],
		["w", 37],

		// ["K", 90],
		// ["R", 91],
		// ["G", 92],
		// ["Y", 93],
		// ["B", 94],
		// ["M", 95],
		// ["C", 96],
		// ["W", 97],

		["bgk", 40],
		["bgr", 41],
		["bgg", 42],
		["bgy", 43],
		["bgb", 44],
		["bgm", 45],
		["bgc", 46],
		["bgw", 47],

		["bold", 1],
		["underline", 4],
		["blink", 5],
		["reverse", 7],
		["hidden", 8],

	]
	let ls = col.split("-")
	let color = ls[0];
	let bg = ls[1];
	let style = ls[2];
	//
	color = "\x1b[" + colors.filter(e => e[0] == color)[0][1] + "m";
	bg = (ls.length > 1) ? "\x1b[" + colors.filter(e => e[0] == bg)[0][1] + "m" : "";
	style = (ls.length > 2) ? "\x1b[" + colors.filter(e => e[0] == style)[0][1] + "m" : "";
	//
	console.log(color + bg + style + msg + "\x1b[0m");
}
function erro(msg) {
	text(msg, "b-bgr-bold");
}