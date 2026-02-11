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
		tamanho: _map.length, clientes: clients,
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

	if (_map.length == 0) send(ws, { type: "newMap", data: ["newMap"] });
	else send(ws, { type: "initialMap", data: _map });

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
};
function main() {
	let initMain = new Date();
	let minTime = 1000; // ms
	// return;
	// if (!processingInMain["waterfall"]) {
	// 	processingInMain["waterfall"] = true;
	// 	setTimeout(async () => { // com bugs
	// 		let init = new Date();
	// 		// try { console.log("in: " + JSON.stringify(_map.filter(c => c.x == 0)[0].chunk[21])); } catch (e) { }
	// 		let ret = await waterfall();
	// 		if (ret.length > 0) {
	// 			// console.log("---waterfall--- "+JSON.stringify(_map.filter(c=>c.x==0 && c.y==0)[0].chunk[23][23]));
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
	// 					for (let i = 0; i < blk.length; i++) {
	// 						let b = blk[i];
	// 						if (b.thing == "water") {
	// 							t++;
	// 							b.height = Math.round(b.height * variMin) / variMin;
	// 							b.depth = Math.round(b.depth * variMin) / variMin;

	// 							vt += b.height;
	// 							txt += t + "(" + chunk.chunk.indexOf(blk) + "): " + JSON.stringify(b) + " - ";
	// 							txt += " " + JSON.stringify(blk[i + 1]) + "\n";
	// 						} else if (i > 0 && blk[i - 1].thing == "water") {
	// 						}


	// 					}

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
	// 		processingInMain["waterfall"] = false;
	// 	});
	// }
	if (!processingInMain["gradefall"]) {
		processingInMain["gradefall"] = true;
		setTimeout(async () => { // com bugs
			let init = new Date();
			// try { console.log("in: " + JSON.stringify(_map.filter(c => c.x == 0)[0].chunk[21])); } catch (e) { }
			let ret = await gradefall();
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
			processingInMain["gradefall"] = false;
		});
	}
	let dif = new Date() - initMain;
	setTimeout(main, (minTime - dif < 0) ? 0 : minTime - dif);
}
var repeatWaterfall = 20;
// GRADEFALL
// 000nota
//
async function gradefall() {
	if (repeatWaterfall <= 0) return [];
	// ordenar os  chunks antes de gradefall
	let changes = [];
	// let mapCopied = _map.copyWithin(_map.length,0);
	let hashesKeyChunks = getHashesKeyChunks();
	let chaveChunk = "0,0";
	let move = 5;
	//
	let init = new Date();
	let configsChunks = await getConfigs();
	console.log("configsChunks: " + (new Date() - init) + "ms");
	_map.map(chunk => {

		let chA = hashesKeyChunks.get((chunk.x - 1) + "," + chunk.y);
		let chB = hashesKeyChunks.get((chunk.x + 1) + "," + chunk.y);
		// console.log(chA.x + "," +chunk.x+","+ chB.x);
		let retChunk = configsChunks.find(c => c.x == chunk.x && c.y == chunk.y);
		let variMin = 10;
		let change = false;
		let tam = chunk.chunk.length;
		let attrib = []
		for (var i = 0; i < chunk.chunk.length; i++) {
			let grades = retChunk.gradess[i];
			let blocks = chunk.chunk[i];
			let nGrades = [];
			// console.log(i, grades);
			let show = i == 10 || i == 11 || i == 12;
			if (show && chunk.x == 1 && chunk.y == 0) {
				fs.writeFileSync(
					"./tester/_map.json",
					JSON.stringify(_map, null, 2), // null,2 = JSON bonito
					"utf-8"
				);
			}
			// if (!(chunkEqKey(chunk, chaveChunk) && show)) continue;
			let microChange = false; // quando desce a água
			// aglutine
			for (let j = 0; j < grades.length; j++) {
				if (j>0){
					if (grades[j].t == grades[j-1].t){ // já estão colados
						grades[j].h += grades[j-1].h;
						grades[j-1].h = 0;
					}
				}
			}
			grades = grades.filter(g=>g.h>0)
			retChunk.gradess[i] = grades;
			// process
			for (let j = 0; j < grades.length; j++) {
				let g = grades[j];
				let pos_g = (j == grades.length - 1) ? null : grades[j + 1];
				if (pos_g != null) {
					if (g.t == "water") {
						console.log(g.h, "water", i, ",in", j);
						if (pos_g.t == "space") {
							pos_g.h = Math.round(pos_g.h * variMin) / variMin;
							//
							microChange = true;
							change = true;
							if (pos_g.h >= move) { // cabe completamente
								console.log("tot");
								g.d += move;
								pos_g.d += move;
								pos_g.h -= move;
							}
							else if (pos_g.h > 0) { // cabe completamente
								console.log("parc",pos_g.h);
								g.d += pos_g.h;
								pos_g.d += pos_g.h;
								pos_g.h -= pos_g.h;
							} else {
								console.log("uai, caiu no else ??? :", pos_g);
							}
						}//encontrou um chão
						else {
							console.log("splash");
							//getblocks
							let adjs = []; // {i: i}: blocksInterfer
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
							// matriz quaternária
							// 0 : space
							// 1 : water
							// 2 : absorve
							// 3 : wall
							// getting
							let matrizQua = []
							for (let ad of adjs) {
								let ch = null;
								if (ad.i < 0) ch = chA;
								else if (ad.i >= tam) ch = chB
								else ch = chunk;
								if (ch.chunk[(ad.i + tam) % tam].length > 0) {
									matrizQua.push(configsChunks.find(c => c.x == ch.x && c.y == ch.y).matrizesQua[(ad.i + tam) % tam]);
								}
							}
							matrizQua.splice(1, 0, retChunk.matrizesQua[i]);
							//
							console.log("entring", grades, matrizQua);
							let indN = 1;
							let l = 0;
							let indSpcN = -1;
							let upOne = false;
							for (let m of matrizQua[indN]) {
								if (upOne) {
									upOne = false;
									continue;
								}
								indSpcN++;
								if (m[0] == 1) { // water
									let indA = indN - 1;
									let lA = 0;
									let difA = 0;
									let indSpcA = -1;
									for (let m2 of matrizQua[indA]) {
										indSpcA++;
										lA += m2[1];
										if (lA >= l && m2[0] == 0) { // só pode ser space
											let da = Math.round((lA - l) * variMin) / variMin;
											difA = Math.min(m[1], (da == 0) ? m[1] : da);
											break;
										}
									}
									//
									let indB = indN + 1;
									let lB = 0;
									let difB = 0;
									let indSpcB = -1;
									for (let m2 of matrizQua[indB]) {
										indSpcB++;
										lB += m2[1];
										if (lB >= l && m2[0] == 0) { // só pode ser space
											let db = Math.round((lB - l) * variMin) / variMin;
											difB = Math.min(m[1], (db == 0) ? m[1] : db);
											break;
										}
									}
									//
									let dif = 0;
									dif = Math.min((difA == 0) ? difB : difA, (difB == 0) ? difA : difB);// diferença acima
									// calc
									let qt = 1 + ((difA == 0) ? 0 : 1) + ((difB == 0) ? 0 : 1);
									// reduce
									dif = Math.round(dif * variMin); // pot 10
									let reduceSide = Math.round((dif - dif % qt) / qt * variMin) / (variMin * variMin); // pot 1
									let restante = Math.round(dif % qt) / variMin; // pot 1
									// console.log("dfs: ", dif, difA, difB);
									// console.log("--: ", qt, reduceSide, restante);
									if (indSpcN > 10) continue;
									change = true;
									// reduz e coloca no centro
									matrizQua[indN][indSpcN][1] -= reduceSide * (qt - 1);
									let cor = m[2].color;
									matrizQua[indN][indSpcN][1] = Math.round(matrizQua[indN][indSpcN][1] * variMin) / variMin;
									// matrizQua[indN][indSpcN][1] += reduceSide * 1;
									// matrizQua[indN].splice(indSpcN, ((matrizQua[indN][indSpcN][1] == 0) ? 1 : 0)
									// , [1, reduceSide, { thing: "water", hardness: 1 }]); // coloca água
									matrizQua[indN].splice(indSpcN, 0, [0, Math.round(reduceSide * (qt - 1) * variMin) / variMin, null]);
									upOne = true;// pula 1 pra n ficar iterando sobre o mesmo
									// matrizQua[indN].splice(indSpcN, 0, [0, reduceSide]); // space
									// coloca
									// reduz do centro e coloca nos lados
									// if (difA!=0 && difB!=0){
									// 	matrizQua[indA][indSpcA][1] += reduceSide;
									// }
									let alters = [
										{ dif: difA, ind: indA, indSpc: indSpcA },
										{ dif: difB, ind: indB, indSpc: indSpcB }
									];
									for (let alt of alters) {
										if (alt.dif != 0) {
											let level = Math.round((matrizQua[alt.ind][alt.indSpc][1] - reduceSide) * variMin) / variMin;
											matrizQua[alt.ind].splice(alt.indSpc, 1, [1, reduceSide, { thing: "water", hardness: 1, color: cor }]); // coloca água
											matrizQua[alt.ind].splice(alt.indSpc, 0, [0, level, null]); // space
										}
										//
									}
									// console.log("result: ", matrizQua);
								}
								l += m[1];
							}
							//encoding
							// console.log("encoding", matrizQua);
							let indLine = 0
							adjs = [adjs[0], { i: i }, adjs[1]]
							for (let ad of adjs) {
								let ch = null;
								if (ad.i < 0) ch = chA;
								else if (ad.i >= tam) ch = chB
								else ch = chunk;

								if (ch.chunk[(ad.i + tam) % tam].length > 0) {
									let blks = [];
									let dp = 0;
									// if ((ad.i + tam) % tam==14){
									// 	console.log("process encoding\n",matrizQua[indLine]);
									// }
									for (let blk of matrizQua[indLine]) {
										dp += blk[1];
										if (blk[0] == 0 || blk[1] == 0) continue; // space || nada
										dp -= blk[1];
										blks.push({
											height: blk[1],
											depth: Math.round(dp * variMin) / variMin,
											thing: blk[2].thing,
											hardness: blk[2].hardness,
											color: blk[2].color
										});
										dp += blk[1];
									}
									attrib.push({
										keyChunk: { x: ch.x, y: ch.y },
										local: (ad.i + tam) % tam,
										what: blks
									});
									// if ((ad.i + tam) % tam==14){
									// 	console.log("pre-final\n",blks);
									// }
									// atribuição 
									let retChunk_ = configsChunks.find(c => c.x == ch.x && c.y == ch.y);
									let grades_ = gradeIt(blks, (ad.i + tam) % tam == 14);
									retChunk_.gradess[(ad.i + tam) % tam] = grades_;
									retChunk_.matrizesQua[(ad.i + tam) % tam] = matrizeIt([{ i: ad.i, bks: retChunk_.gradess[(ad.i + tam) % tam] }]);
									// colocação
									let blocks_ = blks;

									// for (let b of blocks_) {
									// 	ind++;
									// 	while (grades_[ind].t == "space") { ind++; }
									// 	b.height = grades_[ind].h;
									// 	b.depth = grades_[ind].d;
									// 	// console.log(b.thing,b.height,b.depth);
									// }
									ch.chunk[(ad.i + tam) % tam] = blocks_;
									// send
									changes.push({
										key: { x: ch.x, y: ch.y },
									});
									microChange = true;
									//
									if ((ad.i + tam) % tam == 14) {
										console.log("Final");
										console.log(ad, ch.x, (ad.i + tam) % tam, blks);
									}
									// console.log(ad.i,blks);

								}
								indLine++;
							}
						}
					}
				}

				// nGrades[j] = g;
				// if (pos_g != null) {
				// 	nGrades[j + 1] = pos_g;
				// }
			}
			if (microChange) {
				// grades = nGrades;
				console.log("Final");
				// encoding
				// recria os blocks
				let nBlocks = [];
				for (let b of grades) {
					if (b == null || b == undefined || b.t == "space") continue;
					let nB = {
						height: b.h,
						depth: b.d,
						thing: b.t,
						hardness: b.hd,
						color: b.color
					}
					nBlocks.push(nB);
				}
				chunk.chunk[i] = nBlocks;
			}
		}
		if (change) {
			changes.push({
				key: { x: chunk.x, y: chunk.y },
			});
			// attrib
			for (let att of attrib) {
				// changes.push({
				// 	key: { x: att.keyChunk.x, y: att.keyChunk.y },
				// });
				// _map.filter(c => c.x == att.keyChunk.x && c.y == att.keyChunk.y)[0].chunk[att.local] = att.what;
				// repeatWaterfall--;
			}
		}
	});
	//
	console.log("returning");
	return changes;
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
// 		color: "#00ccffff"
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
