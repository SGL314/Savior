import express from "express";
import { pri, getId, getDate, getTime } from "../Auxs/auxiliar.js";
import path from "path";
import { Worker } from "worker_threads";
import os from "os";
import { exec } from "child_process";
import { WebSocketServer } from "ws";
import fs from "fs";

const raw = fs.readFileSync("./data/configs/definitions_clientToServer.json", "utf-8");
const json = JSON.parse(raw);

const stepDefaultMetters = json.stepDefaultMetters;
const coeExpantionToMetters = json.coeExpantionToMetters;

const app = express();

const __dirname = "/mnt/c/Users/samug/OneDrive/Documentos/Scripts/Scriptshtml/Savior/"
const portaCliente = 1234;
const portaServer = 3141;
const portaWebSocket = 3000;
const ipGeral = "192.168.0.13"; // 192.168.0.15 10.36.65.102

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
app.use(express.static(path.join(__dirname, "Cliente")));

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
	res.json({
		tamanho: _map.length, clientes: clients, seed: _seed,
		things: {
			water: countObject("water", 0, _map),
			sand: countObject("sand", 0, _map),
			stone: countObject("stone", 0, _map),
			space: countObject("space", 0, _map)
		}
	});
});
appServer.get("/newMap", (req, res) => {
	_map = [];
	try {
		formSeed();
		send(clients[0].ws, { type: "seed", seed: _seed });
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
	send(ws, {
		type: "configs",
		id: client.id,
		game: {
			stepDefaultMetters: stepDefaultMetters,
			coeExpantionToMetters: coeExpantionToMetters
		}
	});
	send(ws, { type: "seed", seed: _seed });

	if (_map.length == 0) {
		// console.log("Enviando ordem newMap para " + client.id);
		send(ws, { type: "newMap", data: ["newMap"] });
	}
	else {
		// console.log("Enviando initialMap para " + client.id);
		send(ws, { type: "initialMap", data: _map });
	}

	// ⚠️ ASYNC adicionado para processamento assíncrono
	ws.on("message", async (msg) => {
		const data = JSON.parse(msg);
		// console.log(data);
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
	let variMin = 10;
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
			if (_map.length != 0) formSeed();
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
				if (c.x == data.data.keyChunk.x && c.y == data.data.keyChunk.y) {
					// Adiciona o novo bloco na posição correta dentro da chunk
					chunkAtt = c;
					switch (data.data.localBlock) {
						case 0:
							c.chunk[data.data.localChunk.x].unshift(data.data.what);
							break;
						case 1:
							seeIfReplaceInBlocks(c, data, variMin);
							break;
						default:
							erro("Tipo de localBlock desconhecido: " + data.data.localBlock);
					}
				}
			});
			// console.log("Received (addInMap): "+data.data);
			// ordena o block do chunk
			if (data.data.localChunk.x < 0) {
				erro("Chunk com posição negativa não suportada --addInMap:" + JSON.stringify(data.data.localChunk));
			}
			let antes = chunkAtt.chunk[data.data.localChunk.x];
			if (antes == null) {
				erro("Chunk não encontrado para atualização --addInMap:" + JSON.stringify(chunkAtt.atualized) + "\n" + JSON.stringify(chunkAtt.x) + "\n" + JSON.stringify(chunkAtt.y) + "\n" + JSON.stringify(chunkAtt.renderHash));
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
					keyChunk: { x: chunkAtt.x, y: chunkAtt.y },
					chunk: chunkAtt
				}]
			});
			processor.remove(idTime);
			break;
		default:
			console.log("server.js - Tipo de dado desconhecido: " + data.type);
	}
}
function seeIfReplaceInBlocks(chunk, data, vMn) {
	// .chunk[data.data.localChunk.x].unshift(data.data.what);
	let variMin = vMn;
	let block = data.data.what;
	let init = Math.round((block.depth) * variMin) / variMin;
	let end = Math.round((init + block.height) * variMin) / variMin;
	//
	// console.log(chunk.chunk[data.data.localChunk.x]);
	// não tá removendo do lado de algo q tá partido
	let justPut = true;
	for (let b of chunk.chunk[data.data.localChunk.x]) {
		if (b == null) continue;
		// console.log(init, end, b.depth, b.height);
		if (b.depth >= end && init >= b.depth + b.height) {
			justPut &= true;
		} else {
			if (end >= b.depth && end <= b.depth + b.height) { // remove abaixo
				// console.log("remove abaixo");
				justPut &= false;
				let rem = end - b.depth;
				// console.log(rem);
				rem = Math.min(rem, block.height);
				if (rem == block.height) {
					let nBlock = {}; // bloco de cima
					for (let k in b) {
						nBlock[k] = b[k];
					}
					nBlock.depth = b.depth;
					nBlock.height = init - b.depth;
					chunk.chunk[data.data.localChunk.x].unshift(nBlock);
					let h = b.height, d = b.depth;
					b.depth = end;
					b.height = h + d - end;
				} else {
					b.depth += rem;
					b.height -= rem;
				}
				// console.log(b.depth,b.height);
			}
			if (b.depth + b.height >= init && init >= b.depth) { // remove acima
				justPut &= false;
				let rem = b.depth + b.height - init;
				rem = Math.min(rem, block.height);
				if (rem == block.height) {

				} else {
					b.height -= rem;

				}
				// console.log(rem);
			}
		}
	}
	if (block.thing != "space") {
		if (justPut) {
			chunk.chunk[data.data.localChunk.x].unshift(block);
		} else {
			chunk.chunk[data.data.localChunk.x].unshift(block);
		}
	}
	for (let b of chunk.chunk[data.data.localChunk.x]) {
		b.depth = Math.round(b.depth * variMin) / variMin;
		b.height = Math.round(b.height * variMin) / variMin;
	}
	freeZeroHeights(chunk, vMn);
	console.log(chunk.chunk[data.data.localChunk.x]);
}
function freeZeroHeights(chunk, vMn) {
	chunk.chunk.map(blocks => {
		let nBlocks = []
		for (let ind = 0; ind < blocks.length; ind++) {
			if (blocks[ind] == null) continue;
			blocks[ind].height = Math.round(blocks[ind].height * vMn) / vMn;
			if (blocks[ind].height == 0) blocks.splice(ind, 1);
			nBlocks.push(blocks[ind]);
		}
		blocks = nBlocks;
	});
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
setTimeout(() => { main(); console.log("Iniciando main()"); }, 0.5 * 1000);

// game
function formSeed() {
	_seed = Math.floor(Math.random() * 10000);
}
// WATERFALL
var processingInMain = {
	"waterfall": false,
	"gradefall": false,
	"boxfall": false,
};
function main() {
	let initMain = new Date();
	let minTime = 1000; // ms
	if (!processingInMain["boxfall"]) {
		processingInMain["boxfall"] = true;
		return;
		setTimeout(async () => { // com bugs
			let init = new Date();
			// try { console.log("in: " + JSON.stringify(_map.filter(c => c.x == 0)[0].chunk[21])); } catch (e) { }
			let ret = await boxfall();
			if (ret.length > 0) {
				// console.log("---gradefall--- "+JSON.stringify(_map.filter(c=>c.x==0 && c.y==0)[0].chunk[23][23]));
				let chunks = _map.filter(c => {
					for (let r of ret) {
						if (c.x == r.key.x) return true;
					}
					return false;
				});
				// console.log(chunks[0].chunk[21]);
				// type: "attChunks",
				// data: [{
				// 	keyChunk: { x: chunkAtt.x, y: chunkAtt.y },
				// 	chunk: chunkAtt
				// }]
				let data = chunks.map(c => ({
					keyChunk: { x: c.x, y: c.y },
					chunk: c
				}));
				broadcast({ type: "attChunks", data: data });
				// simulateAttChunks(data);
				//
				let txt = "";
				let t = 0;
				let vt = 0;
				let variMin = 10;
				data.map(c => {
					let chunk = c.chunk;
					for (let blk of chunk.chunk) {
						if (!JSON.stringify(blk).includes("water")) continue;
						let nBlk = [];
						for (let i = 0; i < blk.length; i++) {
							let b = blk[i];
							if (b == null) continue;
							nBlk.push(b);
							if (b.thing == "water") {
								t++;
								b.height = Math.round(b.height * variMin) / variMin;
								b.depth = Math.round(b.depth * variMin) / variMin;

								vt += b.height;
								txt += t + "(" + chunk.chunk.indexOf(blk) + "): " + JSON.stringify(b) + " - ";
								txt += " " + JSON.stringify(blk[i + 1]) + "\n";
							}
							//  else if (i > 0 && blk[i - 1].thing == "water") { // verificar se null
							// }
						}
						blk = nBlk;
					}
				});
				txt += "\n---: " + JSON.stringify(data[0].chunk.chunk[7]) + "\n";
				txt += "\nvt: " + vt;
				let k = (vt != 5 && vt != 5.000000000000001 && vt != 4.999999999999999
					&& vt != 4.999999999999998
				) ? "\x1b[34m" : "";
				// console.log(k + txt);

			}
			// console.log("wtfll: " + (new Date() - init) + "ms : " + countObject("water", 0, _map));
			processingInMain["boxfall"] = false;
		});
	}
	let dif = new Date() - initMain;
	setTimeout(main, (minTime - dif < 0) ? 0 : minTime - dif);
}
var repeatWaterfall = 20;
const tamanho = 30;
// BOXFALL
function boxfall() {
	let tamW = tamanho, tamH = tamanho;
	let t = 0, n_chunks = _map.length, totalW = tamW * n_chunks;
	let nCh_global = [];
	function init() {
		// 1. ESTADO FUTURO UNIFICADO(nCh)
		// nCh_global = [[0 for _ in range(tamH)]for _ in range(totalW)]
		for (let i = 0; i < totalW; i++) {
			nCh_global.push([]);
			for (let j = 0; j < tamH; j++) {
				nCh_global[i].push(0);
			}
		}

		// 2. COPIAR SÓLIDOS
		let c_idx = 0;
		for (let gx = 0; gx < totalW; gx++) {
			c_idx = gx; // tamW
			let lx = gx % tamW;
			for (let p = 0; p < tamH; p++) {
				if (_map[c_idx] == undefined || 
					_map[c_idx]['chunk'][lx][p] == undefined) continue;
				if (isImpenetrable(_map[c_idx]['chunk'][lx][p])) {
					nCh_global[gx][p] = 3;
				}
			}
		}
	}
	init();
	// 3. PROCESSAR ÁGUA(DE BAIXO PARA CIMA) pt1
	// let ordem_gx = list(range(totalW));
	function process(activate){
		for (let p = tamH - 1; p >= 0; p--) {
			let ordem_gx = [];
			for (let i = 0; i < totalW; i++) {
				ordem_gx.push(i);
			}
			let coeLateralization = 0.4;
			if (Math.random() < coeLateralization) {
				ordem_gx.reverse();
			}
			let c_idx,lx;
			for (let gx of ordem_gx) {
				c_idx = gx; // tamW
				lx = gx % tamW

				if (_map[c_idx] == undefined || _map[c_idx]['chunk'][lx][p] == undefined ||
					_map[c_idx]['chunk'][lx][p].thing != "water") continue;
				let thingWater = _map[c_idx]['chunk'][lx][p];

				t += 1
				let moved = false;

				// -- - VERIFICAÇÃO DE DESTINO VAZIO(PASSADO E FUTURO)-- -
				// Para evitar que '01110' cause empurrões, a água só se move 
				// se o destino for 0 no mapa que estamos lendo E no que estamos escrevendo.
				function sep1() {
					// 1. ABAIXO
					if (p < tamH - 1) {
						let fillIn = (gx % tamW) / tamW; //  (a//b) == quantos b cabem inteiramente dentro de a
						if (_map[fillIn]['chunk'][gx % tamW][p + 1] == 0 && nCh_global[gx][p + 1] == 0) {
							nCh_global[gx][p + 1] = thingWater;
							moved = true;
						}
					}
				}
				function sep2() {
					// 2. DIAGONAIS ABAIXO
					if (!moved && p < tamH - 1) {
						let dirs = [-1, 1];
						if (Math.random() < coeLateralization) dirs.reverse();
						for (let d of dirs) {
							let tx = gx + d;
							if (0 <= tx && tx < totalW) {
								fillIn = (tx % tamW) / tamW;
								if (_map[fillIn]['chunk'][tx % tamW][p + 1] == 0 && nCh_global[tx][p + 1] == 0) {
									nCh_global[tx][p + 1] = thingWater;
									moved = true;
									break;
								}
							}
						}
					}
				}
				function sep3() {
					// 3. LATERAIS(Nivelamento)
					if (!moved) {
						let dirs = [-1, 1];
						if (Math.random() < coeLateralization) dirs.reverse();
						for (let d of dirs) {
							let tx = gx + d;
							if (0 <= tx && tx < totalW) {
								// Só move se o vizinho lateral estiver vazio AGORA
								let fillIn = (tx % tamW) / tamW;
								if (_map[fillIn]['chunk'][tx % tamW][p] == 0 && nCh_global[tx][p] == 0) {
									nCh_global[tx][p] = thingWater;
									moved = true;
									break;
								}
							}
						}
					}
				}
				function sep4() {
					// 4. FICAR PARADO(CONSERVAÇÃO RÍGIDA)
					if (!moved) {
						// Se não conseguiu se mover para um lugar VAZIO, 
						// ela obrigatoriamente tenta manter a posição original.
						if (nCh_global[gx][p] == 0) {
							nCh_global[gx][p] = thingWater;
						} else {
							// Se até a posição original foi tomada(por alguém de cima caindo),
							// aí ela procura o primeiro buraco pra cima apenas para não sumir.
							let tp = p - 1;
							while (tp >= 0) {
								if (nCh_global[gx][tp] == 0) {
									nCh_global[gx][tp] = thingWater;
									break;
								}
								tp -= 1;
							}
						}
					}
				}
				if (activate[1-1]) sep1();
				if (activate[2-1]) sep2();
				if (activate[3-1]) sep3();
				if (activate[4-1]) sep4();

				if (moved) {

				}
			}
		}
	}
	process([1,1,1,1]);
	function end() {
		// 4. DEVOLVER OS DADOS
		for (let gx = 0; gx < totalW; gx++) {
			let c_idx = (gx % tamW) / tamW;
			if (_map[c_idx] == undefined) continue;
			let lx = gx % tamW;
			_map[c_idx]['chunk'][lx] = nCh_global[gx];
		}
	}
	end();
	// another turn without sep3()
	init();
	process([1,1,0,1]);
	end();

	return t;
}
// auxs
function absrv(blk) {
	// console.log(blk);
	const canAbsrvIn = 2;
	const _absrv = (a) => a.hardness < canAbsrvIn;
	return _absrv(blk);
}
function isImpenetrable(block) {
	return !absrv(block);
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
// function makeWaterBlock(h, d) {
// 	return {
// 		height: h,
// 		depth: d,
// 		thing: "water",
// 		hardness: 1,
// 		color: "//00ccffff"
// 	};
// }

// function chunkEqKey(chunk, key) {
// return chunk.x + "," + chunk.y == key;
// }
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
