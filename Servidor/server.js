import express from "express";
import { pri, getId, getDate, getTime } from "../Auxs/auxiliar.js";
import path from "path";
import { Worker } from "worker_threads";
import os from "os";
import { exec } from "child_process";

const app = express();
const __dirname = "/mnt/c/Users/samug/OneDrive/Documentos/Scripts/Scriptshtml/Savior/"
const portaCliente = 1234;
const portaWebSocket = 3000;
const ipGeral = "10.96.160.102";

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

// Rotas HTTP
app.get("/api/msg", (req, res) => {
  res.json({ msg: "Servidor respondeu!" });
});

app.get("/checkConnection", (req, res) => {
  res.json({ msg: "Connected!" });
});

app.get("/map", (req, res) => {
  res.json({ msg: "Mapa salvo" });
});

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
var _seed = 0; formSeed(); // semente inicial do jogo

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
		return processes.filter(e => e.idTime == idTime)[0].type;
	}
	remove(idTime) {
		text("Processo removido:      " + idTime + " " + this.getType(idTime), "r");
		processes = processes.filter(e => e.idTime != idTime);
	}
}

var processor = new Processor();
let clients = [];

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
				console.error("Erro no Worker Thread:", err);
			}
			break;

		case "map-orderChunks":
			_map = data.data;
			let idTime = processor.add(data.type);

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
				if (processes.filter(e => e.type == "map-orderChunks").length > 1) {
					console.log("Ignorando resultado - múltiplos processos ativos");
					processor.remove(idTime);
					return;
				}

				console.log("Enviando " + result.length + " chunks ordenados para ", fracId, ",", getTime());
				send(ws, { type: "orderChunks", data: result });
				processor.remove(idTime);
			} catch (err) {
				console.error("Erro no Worker Thread:", err);
				processor.remove(idTime);
			}
			break;

		case "formSeed":
			formSeed();
			console.log("Seed formada: " + _seed);
			broadcast({ type: "seed", seed: _seed });
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

function text(msg, color) {
	let colors = [
		["k", 30],
		["r", 31],
		["g", 32],
		["y", 33],
		["b", 34],
		["m", 35],
		["c", 36],
		["w", 37]
	]
	console.log("\x1b[" + colors.filter(e => e[0] == color)[0][1] + "m" + msg + "\x1b[0m");
}