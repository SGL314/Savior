import express from "express";
import { pri, getId, getDate, getTime } from "../Auxs/auxiliar.js";
import path from "path";
import { Worker } from "worker_threads";
import cors from "cors"; // 1. Importar o pacote
import os from "os";

const corsOptions = {
	// Permite explicitamente a origem onde o seu cliente está rodando
	origin: 'http://localhost:1234',
	// Outras opções de segurança (métodos permitidos, headers, etc.)
	methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
	credentials: true, // Se você precisar de cookies/sessão
};


const app = express();
const __dirname = "/mnt/c/Users/samug/OneDrive/Documentos/Scripts/Scriptshtml/Savior/"
const portaCliente = 1234;
const portaWebSocket = 3000;

//

// Servir o cliente
app.use(cors(corsOptions));
app.use(express.static(path.join(__dirname, "Cliente")));
//messages
app.get("/api/msg", (req, res) => {
	res.json({ msg: "Servidor respondeu!" });
});
app.get("/checkConnection", (req, res) => {
	res.json({ msg: "Connected!" });
});
app.get("/map", (req, res) => {
	res.json({ msg: "Mapa salvo" });
});
//
async function getRealHostIp(port) {
    try {
        // 1. Tenta resolver 'host.docker.internal', que muitas vezes aponta para o Host do Windows no WSL
        const addresses = await new Promise((resolve, reject) => {
            dns.lookup('host.docker.internal', { family: 4 }, (err, address, family) => {
                if (err) return reject(err);
                resolve(address);
            });
        });
        
        // Se a resolução funcionar, usa esse IP. Ele deve ser o IP do Windows Host.
        if (addresses && addresses !== '127.0.0.1') {
             // Retorna o IP do Host (Ex: 192.168.x.x)
             return addresses; 
        }

    } catch (e) {
        // Ignora erros de DNS, vamos tentar o método tradicional (fallback)
    }

    // 2. Fallback: Se não conseguir resolver o Host, retorna o IP do WSL
    const interfaces = os.networkInterfaces();
    for (const name in interfaces) {
        for (const net of interfaces[name]) {
            // Retorna o primeiro IP IPv4 que não é loopback
            if (net.family === 'IPv4' && !net.internal) {
                return net.address; // Este será o IP 172.x.x.x do WSL
            }
        }
    }

    return 'localhost';
}

const ipReal = await getRealHostIp(); // Obtém o IP real
app.listen(portaCliente, '0.0.0.0', () => {
	console.log("Servidor rodando em http://"+ipReal+":" + portaCliente, false);
});

// game variables 
var _map = [];
var _seed = 0;formSeed();

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
let clients = [];

wss.on("connection", (ws) => {
	let client = new Client(ws);
	clients.push(client);
	console.log("Cliente conectado. Total:", clients.length);
	send(ws,{ type: "initialMap", id: client.id, data: _map });
	send(ws,{ type: "seed", seed: _seed });

	// Quando receber uma mensagem JSON do cliente
	ws.on("message", (msg) => {
		const data = JSON.parse(msg);
		let fracId = data.id.split(" ")[0];
		let withoutMap = ["formSeed"];
		withoutMap.filter(e => e != data.type).forEach(e => console.log("Recebido de " + fracId + " : " + data.type + "" + data.data.length + " " + getTime()));
		withoutMap.filter(e => e == data.type).forEach(e => console.log("Recebido de " + fracId + " : " + data.type + "" + " " + getTime()));
		

		// send(ws,{ type: "reply", data: "Recebi seu JSON!" }); // 1) Responder SÓ para o cliente que enviou
		let sendGeral = data;
		var worker;
		switch (data.type) {
			case "map":
				_map = data.data;

				// broadcast(sendGeral);
				broadcast(sendGeral);
				send(ws,{ type: "seed", seed: _seed });
				break;
			case "orderChunks":
				for (let client of clients) {
					if (client.id == data.id) {
						client.pos = data.pos;
					}
				}
				// 1. Cria a thread
				worker = new Worker("../Auxs/worker.js", { // recebe map
					workerData: {
						type: "orderChunks",
						pos: data.pos,
						map: data.data, // Envia os dados para o worker
					}
				});

				// 2. Recebe a resposta do worker
				worker.on("message", (result) => {
					// O resultado vem quando o cálculo termina
					console.log("Enviando " + result.length + " chunks ordenados para ", fracId, ",", getTime());
					send(ws, { type: "orderChunks", data: result });
				});

				// 3. Lida com erros (importante!)
				worker.on("error", (err) => {
					console.error("Erro no Worker Thread:", err);
					// send(ws,{ type: "error", msg: "Cálculo falhou." });
				});

				// 4. Limpeza (opcional, mas recomendado)
				worker.on("exit", (code) => {
					if (code !== 0)
						console.error(`Worker parou com código de saída ${code}`);
				});

				// Responde imediatamente ao cliente que o cálculo começou
				// send(ws,{ type: "status", msg: "Iniciando cálculo do mapa..." });
				break;
			case "map-orderChunks":
				_map = data.data;
				for (let client of clients) {
					if (client.id == data.id) {
						client.pos = data.pos;
					}
				}
				// 1. Cria a thread
				worker = new Worker("../Auxs/worker.js", { // recebe map
					workerData: {
						type: "orderChunks",
						pos: data.pos,
						map: data.data, // Envia os dados para o worker
					}
				});

				// 2. Recebe a resposta do worker e broadcast
				sendGeral["type"] = "map";
				broadcastExceptId(sendGeral, data.id);
				worker.on("message", (result) => {
					// O resultado vem quando o cálculo termina
					console.log("Enviando " + result.length + " chunks ordenados para ", fracId, ",", getTime());
					send(ws, { type: "orderChunks", data: result });
				});

				// 3. Lida com erros (importante!)
				worker.on("error", (err) => {
					console.error("Erro no Worker Thread:", err);
					// send(ws,{ type: "error", msg: "Cálculo falhou." });
				});

				// 4. Limpeza (opcional, mas recomendado)
				worker.on("exit", (code) => {
					if (code !== 0)
						console.error(`Worker parou com código de saída ${code}`);
				});

				// Responde imediatamente ao cliente que o cálculo começou
				// send(ws,{ type: "status", msg: "Iniciando cálculo do mapa..." });
				// send(ws, { type: "seed", seed: _seed });
				break;
			case "formSeed":
				formSeed();
				broadcast({ type: "seed", seed: _seed });
				break;
			default:
				console.log("server.js - Tipo de dado desconhecido: " + data.type);
		}
		// broadcast(sendGeral); // 2) Enviar para TODOS os clientes conectados
	});

	// Quando o cliente desconectar
	ws.on("close", () => {
		clients = clients.filter((c) => c.ws !== ws);
		console.log("Cliente saiu. Total:", clients.length);
	});
});

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
