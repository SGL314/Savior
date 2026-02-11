// 14/12/2025 22h45
// constantes
const ipGeral = "192.168.0.15"; //10.96.160.102
const porta = 3000;
const tamanho = 30;
const coeExpantion = 4;
const FPS_LIMIT = 20;
const FRAME_TIME_MS = 1000 / FPS_LIMIT;
var tamBlock = 360 / (tamanho * coeExpantion); // 3
const erros = [
	["ERRO-001", "Sem chunks a enviar;\nlogicChunk(); sending"],
	["ERRO-002", "Chunk não encontrado para atualização"], // processAttChunk(data)
];
const tamanhoMaximo = [2, 2]; // 40,20
// variaveis
var _map = [];
var _seed = 0;
// variaveis de configuração
var _id = 0;
var stepDefaultMetters = 0.05;
var stepMetters = stepDefaultMetters;
var coeExpantionToMetters = 100;
// variaveis de estado
var activation = { "processData": true };
var gotInitialMap = false;
var canAssembleMap = true;
var lastTimesEsp = [0, 0, 0];
var lastTime = 0, lastTimeFps = 0;
var qtChunksDrawed = 314;
var waitDoMap = false;
var lastFrameStart = 0;
var now = new Date();
var _mapOrderQueue = [];
var _chunksToRecreateQueue = [];
var _chunksQueue = []; // 🛑 VARIÁVEL FALTANTE: Fila para geração de novos chunks
var isProcessingMapOrder = false;
var isRecreatingGraphics = false;
var isGeneratingChunks = false; // 🛑 VARIÁVEL FALTANTE: Flag para controlar a fila de geração
// variaveis moveis
var metters = 0;
var selectPutting = "";
let _chunk = [0, 0];
let _poss = [tamBlock / 2, tamBlock / 2];
_poss[0] += 21 * tamBlock; // teste
_poss[1] += 6 * tamBlock; // teste
var zoom = 2, initZoom = 1; // tudo 1
// variaveis de iteração
var initializedDoubleTouch = false
var startedTouch = [0, 0];
var startedTouchZoom = [[0, 0], [0, 0]];
//connection
const ws = new WebSocket('ws://' + ipGeral + ':3000');
// ws.onopen = () => log("Conectado ao servidor!", false);
ws.onmessage = (ev) => {
	const data = JSON.parse(ev.data);
	logServer("Recebido: " + JSON.stringify(data.type), false);
	setTimeout(() => { processData(data) }, 0);
};
//
function processData(data) {
	// if (!activation["processData"]) return;
	lastTime = new Date();
	logServer("process Data: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();

	// 🛑 REMOVER O BLOCO WHILE (waitDoMap): Este tipo de loop síncrono bloqueia o navegador.

	let comms = ["seed"];
	comms.filter(e => e != data.type).forEach(e => logServer(data.type + data.data.length + " " + data.time));
	comms.filter(e => e == data.type).forEach(e => logServer(data.type + " " + data.time));
	// activation["processData"] = false;
	switch (data.type) {
		case "newMap": // usa o cliente só pra fazer o mapa
			let mapSend = newMap();
			let _safeMapToSend = mapSend.map(chunk => {
				return {
					x: chunk.x,
					y: chunk.y,
					chunk: chunk.chunk,
					renderHash: chunk.renderHash,
					atualized: chunk.atualized
				};
			});
			send({ type: "newMap", id: _id, data: _safeMapToSend });
			location.reload();
			break;
		case "map":
		case "orderChunks":
			// console.log("c0,0: ");
			// console.log(data.data);
			_mapOrderQueue.push(data.data); // 🛑 1. ENFILEIRA A NOVA ORDEM DO MAPA

			if (!isProcessingMapOrder) {
				setTimeout(() => { processMapOrderQueue() }, 0); // debug // 🛑 2. INICIA O PROCESSAMENTO LENTO DA ORDEM
			}
			break;
		case "attChunks": // precisa recalcular o hash e recriar o gráfico
			setTimeout(() => { processAttChunk(data) }, 0);
			break;
		case "initialMap":
			_mapOrderQueue.push(data.data); // 🛑 1. ENFILEIRA A NOVA ORDEM DO MAPA

			_id = data.id; // 🛑 2. INICIALIZAÇÃO CRÍTICA
			document.getElementById("id").textContent += " " + _id.split(" ")[0];
			gotInitialMap = true; // 🛑 Necessário para logicChunks() iniciar

			// 🛑 3. ENVIO ASSÍNCRONO DA PRIMEIRA ORDEM DE CHUNKS
			// O cliente precisa se registrar no servidor e pedir chunks imediatamente após inicializar
			const safeMapToSend = data.data.map(chunk => {
				const newChunk = { ...chunk };
				delete newChunk.graphics;
				return newChunk;
			});

			setTimeout(() => {
				send(
					{
						type: "orderChunks",
						id: _id,
						pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock },
						data: safeMapToSend
					});
			}, 0);

			if (!isProcessingMapOrder) {
				processMapOrderQueue(); // 🛑 4. INICIA O PROCESSAMENTO LENTO DA ORDEM (A primeira ordem)
			}
			break;
		case "seed":
			_seed = data.seed; // 🛑 CONFIGURAÇÃO INICIAL DA SEED
			canAssembleMap = true;
			document.getElementById("seed").textContent = _seed;
			break;

		default:
			log("main.js - Tipo de dado desconhecido: " + data.type, false); // 🛑 TIPO DE DADO DESCONHECIDO
	}
	logServer("process Data end: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();
}
function processGraphicsQueue(layer) {
	const CHUNKS_PER_CALL = 2; // Ajuste este valor

	if (_chunksToRecreateQueue.length === 0) {
		isRecreatingGraphics = false;
		return;
	}

	isRecreatingGraphics = true;
	let processedCount = 0;
	let chunkSizePx = tamanho * tamBlock;

	while (processedCount < CHUNKS_PER_CALL && _chunksToRecreateQueue.length > 0) {
		let chunk = _chunksToRecreateQueue.shift();
		// console.log("Recriando gráfico para chunk (" + chunk.x + ", " + chunk.y + ") => " + layer);
		if (!chunk.graphics || chunk) { //  && (chunk.graphics.length != layers || chunk.graphics.length + 1 < layer)

			// Lógica de recriação do graphics (o trabalho que demorava 333ms)
			let chunkGraphics = [];
			// 1 / stepDefaultMetters             1
			for (let i = 0; i < 1 / stepDefaultMetters; i++) {
				chunkGraphics.push(0);
			}
			for (let i = layer; i < layer + 1; i++) {
				chunkGraphics[i] = createGraphics(chunkSizePx, chunkSizePx);
				chunkGraphics[i].noStroke();
			}

			// 🛑 CÓDIGO DE DESENHO COMPLETO INCLUÍDO AQUI
			for (let i = 0; i < tamanho; i++) {
				for (let j = 0; j < tamanho; j++) {
					let blocks = chunk.chunk[i][j];
					let draws = drawBlock(blocks);
					for (let k = layer; k < layer + 1; k++) { // 1 / stepDefaultMetters
						chunkGraphics[k].fill(draws[k]);
						chunkGraphics[k].rect(i * tamBlock, j * tamBlock, tamBlock, tamBlock);
					}
				}
			}
			// 🛑 FIM DO CÓDIGO DE DESENHO COMPLETO
			console.log("(" + _chunksToRecreateQueue.length + ") layerress: " + chunk.x + ", " + chunk.y);
			console.log(chunk, chunkGraphics);
			if (!chunk.graphics) chunk.graphics = chunkGraphics;
			else {
				for (var i = 0; i < chunk.graphics.length; i++) {
					if (chunkGraphics[i] == 0) continue;
					chunk.graphics[i] = chunkGraphics[i];
					console.log("Recriado gráfico layer " + i + " para chunk (" + chunk.x + ", " + chunk.y + ")");
				}
			}

			// Limpa o placeholder após o gráfico estar pronto
			if (chunk.placeholderGraphics) {
				delete chunk.placeholderGraphics;
			}
		}
		// console.log(chunk);
		// console.log("Recriando gráfico para chunk (" + chunk.x + ", " + chunk.y + ") => " + chunk.graphics.length);
		processedCount++;
		// redefine o chunk do map
		_map = _map.map(c => {
			if (c.x === chunk.x && c.y === chunk.y) {
				return chunk;
			} else {
				return c;
			}
		});
	}

	if (_chunksToRecreateQueue.length > 0) {
		setTimeout(processGraphicsQueue, 10, layer);
	} else {
		isRecreatingGraphics = false;
	}
}
function processMapOrderQueue() {
	lastTimesEsp[0] = new Date();
	logEsp("" + Math.round((new Date() - lastTime)), false, 0);
	logEsp("moq: " + Math.round((new Date() - lastTimesEsp[0])), true, 0);
	lastTimesEsp[0] = new Date();
	if (_mapOrderQueue.length === 0) {
		isProcessingMapOrder = false;
		return;
	}

	isProcessingMapOrder = true;
	console.log("chunks c/ graphics: " + _map.filter(c => c.graphics).length);
	// Pega o primeiro mapa da fila para processar
	const newMapOrder = _mapOrderQueue.shift();
	let chunksToEnqueue = [];
	logEsp("moq--: " + Math.round((new Date() - lastTimesEsp[0])), true, 0);
	lastTimesEsp[0] = new Date();
	// 🛑 CRIA O NOVO MAPA COM CHUNKS EXISTENTES (PRESERVAÇÃO DO GRÁFICO ANTIGO)
	const mergedMap = newMapOrder.map(newChunk => {
		// Tenta encontrar o chunk antigo no mapa de desenho atual
		const existingChunk = _map.find(c => c.x === newChunk.x && c.y === newChunk.y);

		if (existingChunk) {
			// Se o hash for o mesmo E o graphics existe:
			if (existingChunk.renderHash === newChunk.renderHash && existingChunk.graphics) {
				// Preserva o graphics ANTIGO. Não precisa recriar nem enfileirar.
				newChunk.graphics = existingChunk.graphics;
				return newChunk;
			} else if (existingChunk.graphics) {
				// Hash mudou (mudança de bloco), mas o graphics antigo ainda é útil como placeholder.
				// Usamos o gráfico antigo temporariamente para não deixar buraco.
				newChunk.placeholderGraphics = existingChunk.graphics;
				chunksToEnqueue.push(newChunk);
				return newChunk;
			}
		}

		// Se for um chunk novo, ou se o antigo não tinha graphics:
		// verifica se já não está processando ele
		let doIt = true;
		_chunksToRecreateQueue.map(c => {
			if (c.x === newChunk.x && c.y === newChunk.y) doIt = false;
		});
		if (doIt) chunksToEnqueue.push(newChunk);
		return newChunk;
	});
	logEsp("moq merge: " + Math.round((new Date() - lastTimesEsp[0])), true, 0);
	lastTimesEsp[0] = new Date();
	// 1. ATUALIZA O MAPA DE DESENHO (AGORA COM GRÁFICOS PRESENTE OU PLACEHOLDER)
	mergedMap.filter(c => !_map.find(m => m.x === c.x && m.y === c.y)).forEach(c => {
		_map.push(c);
	})
	console.log("after chunks c/ graphics: " + _map.filter(c => c.graphics).length);

	// 2. ENFILEIRA os chunks que realmente precisam de reconstrução
	_chunksToRecreateQueue.push(...chunksToEnqueue);
	logEsp("moq adding: " + Math.round((new Date() - lastTimesEsp[0])), true, 0);
	lastTimesEsp[0] = new Date();

	// 3. INICIA/CONTINUA O PROCESSAMENTO LENTO DOS GRÁFICOS
	if (!isRecreatingGraphics) {
		setTimeout(processGraphicsQueue, 0, metters / (stepDefaultMetters * coeExpantionToMetters));
	}
	logEsp("moq graphics: " + Math.round((new Date() - lastTimesEsp[0])), true, 0);
	lastTimesEsp[0] = new Date();

	// 4. Agenda o processamento do próximo mapa na fila (se houver)
	if (_mapOrderQueue.length > 0) {
		setTimeout(processMapOrderQueue, 10);
	} else {
		isProcessingMapOrder = false;
	}
	logEsp("moq final: " + Math.round((new Date() - lastTimesEsp[0])), true, 0);
	lastTimesEsp[0] = new Date();
}
function processChunkGenerationQueue() {
	if (_chunksQueue.length === 0) {
		isGeneratingChunks = false;
		return; // Fila vazia, encerra a recursão
	}

	isGeneratingChunks = true;

	// Processa APENAS UM chunk por chamada
	let chunkCoords = _chunksQueue.shift();

	if (chunkCoords) {
		// 🛑 GERA O CHUNK PESADO
		let newChunk = getChunk(chunkCoords.x, chunkCoords.y, true);

		// Adiciona ao mapa DE DESENHO PRINCIPAL
		_map.push(newChunk);

		// Opcional: Você pode querer logar isso
		// console.log(`Chunk [${chunkCoords.x}, ${chunkCoords.y}] gerado e adicionado ao mapa.`);
	}

	// Se ainda houver chunks, agenda a próxima execução
	if (_chunksQueue.length > 0) {
		// 🛑 AGENDA A PRÓXIMA CHAMADA NA FILA DE EVENTOS (0ms para o próximo ciclo de CPU)
		setTimeout(processChunkGenerationQueue, 0);
	} else {
		isGeneratingChunks = false; // Terminou o trabalho
	}
}
function processAttChunk(data) {
	// type: "attChunk",
	// 		data: [{
	// 			keyChunk: { x: chunkAtt.x, y: chunkAtt.y },
	// 			chunk: chunkAtt
	// 		}]
	for (let chn of data.data) {
		let chunk = null;
		_map.map(c => {
			if (c.x == chn.keyChunk.x && c.y == chn.keyChunk.y) {
				c.chunk = chn.chunk.chunk;
				chunk = c;
				return;
			}
		});
		// Todo mundo tem q ter esse chunk
		if (chunk == null) erro("ERRO-002", JSON.stringify(chn.keyChunk));
		//
		_chunksToRecreateQueue.push(chunk);
		if (!isRecreatingGraphics) {

			calculateRenderHash(chunk.chunk);
			setTimeout(processGraphicsQueue, 0, metters / (stepDefaultMetters * coeExpantionToMetters));
		}
	}
}
function setup() {
	const canvas = createCanvas(tamanho * tamBlock * coeExpantion, tamanho * tamBlock * coeExpantion);
	// const canvas = createCanvas(960,960);
	canvas.parent("localCanvas");
	console.log("setup");

	noLoop();
	createFreeMap();
	defineButtons();
	requestAnimationFrame(manualDrawLoop); // 🛑 Inicia o loop manual.
}
function manualDrawLoop(timestamp) {

	// 1. EXECUTA O DRAW (O SEU CÓDIGO DE RENDERIZAÇÃO)
	draw();

	const frameProcessingTime = new Date().getTime() - now;

	// 2. CÁLCULO DO SLEEP (ESPERA DINÂMICA)
	let sleepTime = FRAME_TIME_MS - frameProcessingTime;

	// Garante que o sleepTime não seja negativo (se o frame demorou mais que 100ms)
	if (sleepTime < 0) {
		console.log(sleepTime);
		sleepTime = 0;
	}

	// 3. AGENDAMENTO DO PRÓXIMO FRAME
	// Usa setTimeout para agendar a próxima chamada APÓS o tempo de espera.
	setTimeout(() => {
		requestAnimationFrame(manualDrawLoop);
	}, sleepTime);
	now = new Date().getTime();
}
function draw() {
	// Note: Removida a lógica 'lastTimeFps', pois o timing é tratado em manualDrawLoop
	// try { console.log("repetidos: " + _map.filter(c => _map.filter(m => m.x === c.x && m.y === c.y).length > 1).length) } catch (e) { }]
	// console.log(_map.find(c => c.x == 0 && c.y == 0));
	log("", false);
	log("init: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();
	background("#ae00ffff");
	toroide();

	// --- 1. DESENHO DO MAPA (ISOLADO) ---
	push();
	doMap();
	pop();

	log("doMap: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();
	// buttons() logo abaixo
	buttons();

	// --- 2. DESENHO DA UI/HUD (Sem Zoom) ---
	doMove();
	log("move: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();

	// ... (o restante da lógica) ...

	if (gotInitialMap) logicChunks(false);
	log("logicChunks: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();
	//
	keyPressing();
	log("key: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();
	// end
	depuration();
	//
	try {
		stroke(3);
		fill("#0f00ff");
		// line(startedTouchZoom[0][0], startedTouchZoom[0][1], touches[0].x, touches[0].y);
		// line(startedTouchZoom[1][0], startedTouchZoom[1][1], touches[1].x, touches[1].y);
	} catch (e) { }
	// position
	// text(mouseX + ", " + mouseY, mouseX, mouseY);

	// Chama o loop de desenho do p5.js (faz a renderização)
	p5.prototype.redraw();
}

// create

function createFreeMap() {
	_newMap(false);
}
function newMap() {
	// noiseSeed(1234567890);
	console.log("Creating new Map");
	canAssembleMap = false;
	send({ type: "formSeed", id: _id });
	return _newMap(true);
}
function _newMap(useSeed) {
	log("Creating " + useSeed);
	let map = [];
	for (let i = -(coeExpantion - 1); i <= coeExpantion - 1; i++) {
		for (let j = -(coeExpantion - 1); j <= coeExpantion - 1; j++) {
			let chunk = getChunk(i, j, useSeed);
			map.push(chunk);
		}
	}
	return map;
}
function getChunk(x, y, useSeed) {
	// 1. Configurações de Perlin Noise
	noiseDetail(8, 0.2);
	noiseSeed(_seed);
	let coeExpantionEarth = 80; // min make bigger; max make smaller 
	let vari = stepDefaultMetters * coeExpantionEarth; // 0.01 = 1m
	var desconfiguraPatterns = [
		-17124165,
		2442342782];
	let variMin = 10; // 1/varMin
	var chunk = [];
	// console.log(
	// 	noise(0, 0, 0),
	// 	noise(10, 0, 0),
	// 	noise(0, 10, 0),
	// 	noise(0, 0, 10)
	// );


	// 2. Cria o buffer gráfico (Canvas offscreen)
	let chunkSizePx = tamanho * tamBlock;
	let chunkGraphics = [];
	for (let i = 0; i < 1 / stepDefaultMetters; i++) {
		chunkGraphics.push(createGraphics(chunkSizePx, chunkSizePx));
		chunkGraphics[i].noStroke();
	}
	// console.log(chunkGraphics.length);
	if (useSeed) {
		for (let i = 0; i < tamanho; i++) {
			chunk.push([]);
			for (let j = 0; j < tamanho; j++) {

				// ... dentro dos loops i e j ...

				// 1. Definições do Mapa
				let worldW = tamanhoMaximo[0] * tamanho;
				let worldH = tamanhoMaximo[1] * tamanho;

				let gx = x * tamanho + i;
				let gy = y * tamanho + j;

				// 2. Coordenadas Angulares (0 a 2PI)
				let ax = (gx / worldW) * Math.PI * 2;
				let ay = (gy / worldH) * Math.PI * 2;

				// 3. Geometria do Toro (Donut)
				// R = Raio Maior (o tamanho do anel)
				// r = Raio Menor (a grossura do tubo)
				// Ajuste 'vari' aqui para mudar o zoom do noise
				let R = 2.0;
				let r = 0.8;

				// Coordenadas originais do Toro
				// Isso mapeia o 2D para a superfície de um donut em 3D
				let torusX = (R + r * Math.cos(ay)) * Math.cos(ax);
				let torusY = (R + r * Math.cos(ay)) * Math.sin(ax);
				let torusZ = r * Math.sin(ay);

				// 🛑 4. O PULO DO GATO: ROTAÇÃO DE EIXOS
				// O problema do espelho é que o Toro original é simétrico no eixo Z.
				// Vamos girar essas coordenadas para misturar o eixo Z (anti-simétrico) com o Y.
				// Isso "bagunça" a simetria e remove o espelho.

				let angle = Math.PI / 4; // 45 graus
				let cosA = Math.cos(angle);
				let sinA = Math.sin(angle);

				// Rotaciona em torno do eixo X
				let finalX = torusX;
				let finalY = torusY * cosA - torusZ * sinA;
				let finalZ = torusY * sinA + torusZ * cosA;

				// 5. Gera o Ruído
				// Multiplica por 'vari' para controlar a escala (zoom) das texturas
				let n = noise(
					finalX * vari + desconfiguraPatterns[0],
					finalY * vari + desconfiguraPatterns[1],
					finalZ * vari
				);

				// ... continua com a lógica de biomas (if n < tWater ...)

				// console.log(n);
				// let n = noise((i + sx * tamanho + desconfiguraPatterns) * vari,
				// 	(j + sy * tamanho + desconfiguraPatterns) * vari,
				// 	sz*vari
				// );
				// Geração de Bioma/Bloco
				let thing = "water";
				let tWater = 0.35;
				if (n < tWater) thing = "water";
				else if (n < 0.40) thing = "sand";
				else if (n < 0.55) thing = "earth";
				else if (n < 0.75) thing = "stone";
				else thing = "snow";
				// definition blocks
				let blocks = [];

				switch (thing) {
					case "water":
						let colorWater = getColor(thing);
						colorWater = [colorWater[0],
						(getColor("-shallowwater")[1] - colorWater[1]) * n / tWater + colorWater[1],
						(getColor("-shallowwater")[2] - colorWater[2]) * n / tWater + colorWater[2],
							255];
						blocks = [
							{ // sem agua no começo
								height: (tWater - n) * coeExpantionToMetters,
								depth: 0,
								thing: thing,
								hardness: 1,
								color: colorWater
							},
							{
								height: (0.1) * coeExpantionToMetters,
								depth: Math.round(((tWater - n) * coeExpantionToMetters) * variMin) / variMin,
								thing: "sand",
								hardness: 1,
								color: getColor("sand")
							}
						];
						if (x!=0 && y!=0) { 
							blocks = [
							// { // sem agua no começo
							// 	height: (tWater - n) * coeExpantionToMetters,
							// 	depth: 0,
							// 	thing: thing,
							// 	hardness: 1,
							// 	color: colorWater
							// },
							{
								height: (0.1) * coeExpantionToMetters,
								depth: Math.round(((tWater - n) * coeExpantionToMetters) * variMin) / variMin,
								thing: "sand",
								hardness: 1,
								color: getColor("sand")
							}
						];
						}
						break;
					case "earth":
						blocks = [
							{
								height: 10,
								depth: 0,
								thing: thing,
								hardness: thing === "stone" ? 3 : 1,
								color: getColor(thing)
							}
						];
						break;
					default:
						blocks = [
							{
								height: 5,
								depth: 0,
								thing: thing,
								hardness: thing === "stone" ? 3 : 1,
								color: getColor(thing)
							}
						];
				}
				// subsolo
				let initDepth = blocks[blocks.length - 1].depth + blocks[blocks.length - 1].height, l1 = 15;
				blocks.push({
					height: l1,
					depth: initDepth,
					thing: "stone",
					hardness: 3,
					color: getColor("stone")
				});
				blocks.push({
					height: (100 - (initDepth + l1)),
					depth: initDepth + l1,
					thing: "rock",
					hardness: 5,
					color: getColor("rock")
				});
				//

				chunk[i].push(blocks);

				// Desenha o bloco no buffer gráfico
				let draws = drawBlock(blocks);
				for (let k = metters / (stepDefaultMetters * coeExpantionToMetters); k < metters / (stepDefaultMetters * coeExpantionToMetters) + 1; k++) {
					chunkGraphics[k].fill(draws[k]);
					chunkGraphics[k].rect(i * tamBlock, j * tamBlock, tamBlock, tamBlock);
				}
			}
		}
	} else {
		// Se não usar seed (Mapa Inicial Vazio)
		let thing = "-nada-";
		let col = getColor(thing);
		let blocks = [
			{
				height: 100,
				depth: 0,
				thing: thing, hardness: 1, color: col
			}
		];

		let draws = drawBlock(blocks);
		for (let k = 0; k < 1 / stepDefaultMetters; k++) {
			chunkGraphics[k].fill(draws[k]);
			chunkGraphics[k].rect(0, 0, chunkSizePx, chunkSizePx);
		}
		for (let i = 0; i < tamanho; i++) {
			chunk.push([]);
			for (let j = 0; j < tamanho; j++) {
				chunk[i].push(blocks);
			}
		}
	}

	// 🛑 NOVO: Calcula o hash de renderização com base nos dados do chunk
	const hashValue = calculateRenderHash(chunk);
	// console.log(chunkGraphics.length);

	return {
		x: x,
		y: y,
		chunk: chunk,
		graphics: chunkGraphics,
		renderHash: hashValue, // 🛑 NOVO: Inclui o hash no objeto do chunk
		atualized: true
	};
}
function getColor(thing) { // retorna array RGB por bioma
	"#002878"
	"#0078ff"
	"rgba(136, 61, 0, 1)"
	"#rgba(49, 49, 49, 1)"
	switch (thing) { // escolhe cor
		case "water": return [0, 40, 120, 255]; // azul profundo
		case "-shallowwater": return [0, 120, 255, 255]; // azul claro 
		case "sand": return [240, 230, 140, 255]; // areia
		case "earth": return [136, 61, 0, 255]; // terra
		case "stone": return [110, 110, 110, 255]; // pedra
		case "snow": return [255, 255, 255, 255]; // neve
		case "rock": return [50, 50, 50, 255]; // rocha
		default: return [255, 0, 255, 255]; // nada
	}
}
function drawBlock(blocks) {
	let finalColors = [];
	for (let i = 0; i < 1 / stepDefaultMetters; i++) {
		// console.log(">"+i* stepDefaultMetters * coeExpantionToMetters);
		for (let j = 0; j < blocks.length; j++) {
			// console.log(blocks[j].depth + blocks[j].height);
			if (blocks[j].depth + blocks[j].height > i * stepDefaultMetters * coeExpantionToMetters) {
				finalColors.push(blocks[j].color);
				// console.log(j);
				break;
			}
		}
	}
	return finalColors;
}

//

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
function calculateRenderHash(chunkData) {
	let hash = 0;
	// Percorre apenas os dados que definem a aparência
	for (let i = 0; i < tamanho; i++) {
		for (let j = 0; j < tamanho; j++) {
			// Usa o código da cor (ou outro identificador numérico) para o hash.
			// Se a cor for uma string (ex: "#00FF00"), você precisará de uma conversão.
			// Para simplicidade, vamos somar os códigos ASCII da string de cor.
			for (let l = 0; l < 1 / stepDefaultMetters; l++) {
				const colorString = drawBlock(chunkData[i][j])[l].toString();
				for (let k = 0; k < colorString.length; k++) {
					hash += colorString.charCodeAt(k);
				}
			}
		}
	}
	// Retorna um valor final que pode ser comparado
	return hash; // Limita o hash para um número gerenciável: % 100000
}
function doMap() {
	qtChunksDrawed = 0;

	let camWorldX = _poss[0];
	let camWorldY = _poss[1];

	// -------------------------------------------------------------------------
	// 🛑 TRANSFORMAÇÃO CORRETA PARA CENTRALIZAR O ZOOM NA CÂMERA (_poss)
	// 1. Centraliza a tela para ter o centro como ponto de pivot
	translate(width / 2, height / 2);

	// 2. Translação Inversa: Move o ponto da câmera (_poss) para a origem.

	// 3. Aplica a escala (zoom). O zoom é aplicado em torno da origem (o ponto da câmera).
	scale(zoom);

	// 4. Translação Final: Move o mundo de volta para a posição correta, agora escalada.
	translate(-camWorldX, -camWorldY);
	// translate(camWorldX, camWorldY);

	// 5. Translação Final de Câmera (ajuste de posicionamento)
	let x = -_poss[0];
	let y = -_poss[1];
	// translate(x, y);

	// -------------------------------------------------------------------------
	// Culling (Visibilidade)
	let viewWidth = width / zoom;
	let viewHeight = height / zoom;
	let viewLeft = camWorldX - viewWidth / 2;
	let viewTop = camWorldY - viewHeight / 2;
	let viewRight = camWorldX + viewWidth / 2;
	let viewBottom = camWorldY + viewHeight / 2;

	waitDoMap = true;
	showExtremes = false;
	noStroke();
	let indGraphics = metters / (stepDefaultMetters * coeExpantionToMetters);
	let process = false;
	let verifyRecreate = [];

	_map.forEach(chunk => {
		// try {
		// 	console.log(chunk.graphics);
		// } catch (e) {
		// 	console.log(chunk.placeholderGraphics);
		// }
		if (!chunk.graphics && !chunk.placeholderGraphics) {
			return;
		}
		// Verifica se o chunk está visível no viewport atual
		if (!isChunkVisible(chunk, viewLeft, viewRight, viewTop, viewBottom)) {
			return;
		}
		// ... (verificação isChunkVisible) ...

		qtChunksDrawed++;


		// 🛑 PRIORIDADE: 1. Graphics Pronto, 2. Graphics Placeholder
		let graphicToDraw;
		try {
			graphicToDraw = (chunk.graphics[indGraphics]) ? chunk.graphics[indGraphics] : chunk.placeholderGraphics[indGraphics];
			if (graphicToDraw == 0) {
				verifyRecreate.push(chunk);
				process = true;
				return;
			}
		} catch (e) {
			verifyRecreate.push(chunk);
			process = true;
			return;
		}

		if (graphicToDraw) {
			image(
				graphicToDraw,
				chunk.x * tamanho * tamBlock,
				chunk.y * tamanho * tamBlock
			);
		}
		if (showExtremes) {
			stroke(1);
			fill("#ff000080");
			rect(
				chunk.x * (tamanho) * tamBlock,
				chunk.y * (tamanho) * tamBlock,
				(tamanho) * tamBlock,
				(tamanho) * tamBlock
			);
			noStroke();
		}
	});
	waitDoMap = false;
	if (showExtremes) {
		stroke(1);
		fill("#0044ff70");
		rect(
			viewLeft,
			viewTop,
			viewWidth,
			viewHeight
		);
		noStroke();
		circle(camWorldX, camWorldY, 10);
		fill("#ff0000");
		text(_poss[0] + ", " + _poss[1], camWorldX + 10, camWorldY - 10);
	}
	if (process) {
		_chunksToRecreateQueue.map(c => {
			verifyRecreate = verifyRecreate.filter(vr => {
				if (c.x == vr.x && c.y == vr.y) return false;
				return true;
			});
		});
		verifyRecreate.map(vr => {
			_chunksToRecreateQueue.push(vr);
		});
		console.log("recreate " + _chunksToRecreateQueue.length);
		// setTimeout(processGraphicsQueue, 10, indGraphics); // Continua processando gráficos se necessário
		setTimeout(processGraphicsQueue, 10, indGraphics);
		// if (!isRecreatingGraphics) {
		// }
	}
}
function doMove() {
	noStroke();
	fill("#ff000040");
	circle(width / 2, height / 2, 2);
	rect(width / 2 - tamBlock / 2, height / 2 - tamBlock / 2, tamBlock, tamBlock);
	//
	// Função utilitária para facilitar a vida
	const mod = (n, m) => ((n % m) + m) % m;

	// Calculando os índices brutos (floored para garantir inteiros)
	let rawX = Math.floor((Math.floor(_poss[0]) - 1) / 3);
	let rawY = Math.floor((Math.floor(_poss[1]) - 1) / 3);

	// Aplicando o módulo seguro para o tamanho do chunk
	let x = mod(rawX, tamanho);
	let y = mod(rawY, tamanho);
	// atribuição
	document.getElementById("chunk").textContent = _chunk[0] + ", " + _chunk[1] + " | " + x + ", " + y;
}
// do Map
function isChunkVisible(chunk, viewLeft, viewRight, viewTop, viewBottom) {
	// let chunksize = tamanho * tamBlock * Math.floor(zoom);

	// // Coordenadas da chunk no mundo
	// let chunkStartX = chunk.x * chunksize;
	// let chunkStartY = chunk.y * chunksize;

	// return (
	// 	(chunkStartX < viewRight && chunkStartX > viewLeft || chunkStartX + chunksize < viewRight && chunkStartX + chunksize > viewLeft) &&
	// 	(chunkStartY > viewTop && chunkStartY < viewBottom || chunkStartY + chunksize < viewBottom && chunkStartY + chunksize > viewTop)
	// );

	// 🛑 CORREÇÃO: O tamanho do chunk em pixels do mundo é FIXO.
	// Não multiplique pelo zoom aqui.
	let chunksize = tamanho * tamBlock;

	// Coordenadas do inicio do chunk no mundo
	let chunkStartX = chunk.x * chunksize;
	let chunkStartY = chunk.y * chunksize;

	// Verificação de Interseção AABB (Axis-Aligned Bounding Box) simples
	return (
		chunkStartX < viewRight &&
		chunkStartX + chunksize > viewLeft &&
		chunkStartY < viewBottom &&
		chunkStartY + chunksize > viewTop
	);
}
// draw
function toroide() {
	// tamanho total do mundo em pixels
	const worldW = tamanhoMaximo[0] * tamanho * tamBlock;
	const worldH = tamanhoMaximo[1] * tamanho * tamBlock;

	// wrap toroidal em X
	if (_poss[0] < -worldW / 2) {
		_poss[0] += worldW;
	} else if (_poss[0] >= worldW / 2) {
		_poss[0] -= worldW;
	}

	// wrap toroidal em Y
	if (_poss[1] < -worldH / 2) {
		_poss[1] += worldH;
	} else if (_poss[1] >= worldH / 2) {
		_poss[1] -= worldH;
	}
}
function logicChunks(orderOut) {
	// 1. Calcula o CHUNK CENTRAL atual baseado na posição da câmera (_poss)
	let newChunk = [
		Math.floor(_poss[0] / (tamBlock * tamanho)),
		Math.floor(_poss[1] / (tamBlock * tamanho))
	];
	let order = false; // Flag para indicar se o chunk central mudou
	order = orderOut || false;
	// Checa se o chunk central mudou
	if (newChunk[0] != _chunk[0] || newChunk[1] != _chunk[1]) {
		_chunk = newChunk;
		order = true;
	}
	// console.log("oo:"+ orderOut);

	// 2. CÁLCULO SENSÍVEL AO ZOOM (Qt de chunks a carregar ao redor do centro)
	// Calcula quantos chunks cabem na metade da tela com o zoom atual, mais uma margem de segurança (2).
	let chunksHalfView = (width / zoom) / (tamanho * tamBlock);
	let qtAdd = Math.ceil(chunksHalfView) - 1;

	let toFind = []; // Lista de coordenadas [x, y] que deveriam existir

	// 3. Seleciona os chunks que DEVEM estar na vizinhança (no raio de qtAdd)
	for (let i = _chunk[0] - qtAdd; i <= _chunk[0] + qtAdd; i++) {
		for (let j = _chunk[1] - qtAdd; j <= _chunk[1] + qtAdd; j++) {
			toFind.push({ x: i, y: j });
		}
	}
	// remove os q passa do maximo
	toFind = toFind.filter(chunk =>
		chunk.x <= tamanhoMaximo[0] / 2 - 1 && chunk.x >= -tamanhoMaximo[0] / 2
		&& chunk.y <= tamanhoMaximo[1] / 2 - 1 && chunk.y >= -tamanhoMaximo[1] / 2);
	// return;

	// 4. Limpeza e Verificação (Culling de Memória)
	// Filtra o _map para manter apenas os necessários E remove os chunks já existentes da lista 'toFind'
	let remainAtualizeds = false;
	_map = _map.filter(chunk => {
		if (chunk.atualized) remainAtualizeds = true;
		// pega do _map
		for (let i = 0; i < toFind.length; i++) {
			if (chunk.x == toFind[i].x && chunk.y == toFind[i].y) {
				// Se o chunk existe e é necessário, removemos ele de toFind 
				toFind.splice(i, 1);
				break;
			}
		}
		// Retorna true para manter no _map, false para descartar
		return true;
	});
	_chunksQueue = _chunksQueue.filter(chunk => {
		let shouldKeep = false;
		// pega da lista de chunks q estão sendo construídos
		for (let i = 0; i < toFind.length; i++) {
			if (chunk.x == toFind[i].x && chunk.y == toFind[i].y) {
				// Se o chunk existe e é necessário, removemos ele de toFind 
				toFind.splice(i, 1);
				shouldKeep = true;
				break;
			}
		}
		// Retorna true para manter no _map, false para descartar
		return true;
	});
	// console.log(_map.map(c => c.x + ", " + c.y).join("\n"));
	// console.log("TOFIND");
	// console.log(toFind.map(c => c.x + ", " + c.y).join("\n"));
	// 5. Enfileira a geração dos chunks que FALTAM
	let added = toFind.length > 0;
	if (added) {
		_chunksQueue.push(...toFind);
	}

	// 🛑 6. GARANTE QUE O PROCESSAMENTO DA FILA ESTÁ INICIADO
	if (!isGeneratingChunks && _chunksQueue.length > 0) {
		processChunkGenerationQueue(); // debug NÂO PODE SER ASSYNC
	}

	// envia as paradas assincronamente
	// return;
	let v1 = toFind.length > 0 || remainAtualizeds, v2 = order;

	if (v1 || v2) {
		const safeMapToSend = _map.filter(c => c.atualized).map(chunk => {
			return {
				x: chunk.x,
				y: chunk.y,
				chunk: chunk.chunk,
				renderHash: chunk.renderHash,
				atualized: chunk.atualized
			};
		});
		if (v1) {
			logServer("Addeds: " + toFind.length + ". De _map" + _map.length + "; >>> adMp-oC" + safeMapToSend.length + " " + getTime());
			setTimeout(() => { send({ type: "addMap-orderChunks", id: _id, pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock }, data: safeMapToSend }) }, 0);

			// O timeout 0 (ou 1) libera o browser para o próximo frame
		} else if (v2) {
			logServer("Order. De _map" + _map.length + "; >>> adMp-oCs" + safeMapToSend.length + " " + getTime());
			setTimeout(() => { send({ type: "addMap-orderChunks", id: _id, pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock }, data: safeMapToSend }) }, 0);
		} else {
			erro("ERRO-001", null);
		}
		safeMapToSend.forEach(a => {
			_map.filter(b => (b.x == a.x && b.y == a.y)).forEach(c => c.atualized = false);
			// _map.filter(b=>(b.x==a.x && b.y==a.y)).forEach(c=>console.log(c.x+","+c.y));
		}); // remarkAtt
	}
}
// buttons
class Button {
	constructor(name, x, y, w, h, txt, cor, func) {
		this.name = name;
		this.cor = cor;
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.txt = txt;
		this.func = func;
		this.clicked = false;
	}
	click(px, py) {
		let cl = px >= this.x && px <= this.x + this.w &&
			py >= this.y && py <= this.y + this.h;
		if (cl) {
			this.clicked = !this.clicked;
			this.func();
			return true;
		}
		return false;
	}
	draw() {
		fill(this.cor);
		rect(this.x, this.y, this.w, this.h);

		if (this.clicked) {
			stroke("#00ff00")
			fill("#00ff0020");
			rect(this.x, this.y, this.w, this.h);
		}
		//
		textSize(this.w / 4);
		fill("#ffffff");
		text(this.txt, this.x + this.w / 2 - textWidth(this.txt) / 2, this.y + this.h / 2 + textAscent() / 2);
	}
}
class AreaButtons extends Button {
	constructor(name, x, y, w, h, txt, cor, func) {
		super(name, x, y, w, h, txt, cor, func);
		this.btns = [];
	}
}
var geral = new AreaButtons("geral",
	0, 0
	, 0, 0,
	"", "#ff0000", () => {
		console.log("geral");
	}
);
var localAreaBtns = [], voltar;
function defineButtons() {
	let pad = 5;
	noStroke();
	fill("#00000073");
	rect(pad, height * 3 / 4 + pad, width - pad * 2, height * 1 / 4 - pad * 2);
	// definitions
	let l = 0, c = 0;
	let tam = 40;
	let gap = 10;
	// adm
	geral.btns.push(new AreaButtons("adm",
		pad * 2 + tam * c + gap * c, pad * 2 + height * 3 / 4 + tam * l + gap * l
		, tam, tam,
		"ADM", "#aa0000", () => {
			localAreaBtns = [0];
		}
	));
	l = 0; c = 0;
	geral.btns[geral.btns.length - 1].btns.push(
		new AreaButtons("put",
			pad * 2 + tam * c + gap * c, pad * 2 + height * 3 / 4 + tam * l + gap * l
			, tam, tam,
			"PUT", "#85aa00ff", () => {
				localAreaBtns.push(0);
			}
		));
	// adm-put
	l = 0; c = 0;
	geral.btns[geral.btns.length - 1].btns[0].btns.push(
		new Button("water",
			pad * 2 + tam * c + gap * c, pad * 2 + height * 3 / 4 + tam * l + gap * l
			, tam, tam,
			"WATER", "#1b50ffff", () => {
				selectPutting = (selectPutting == "water") ? "" : "water";
			}
		));


	//voltar
	voltar = new Button("voltar",
		width - pad * 2 - tam / 2, pad * 2 + height * 3 / 4 + tam * l + gap * l
		, tam / 2, tam / 2,
		"VOLTAR", "#aa0000ff", () => {
			localAreaBtns.shift();
		}
	);
}
function buttons() {
	// geral
	let pad = 5;
	noStroke();
	fill("#00000073");
	rect(pad, height * 3 / 4 + pad, width - pad * 2, height * 1 / 4 - pad * 2);
	//
	let local = geral;
	for (var i = 0; i < localAreaBtns.length; i++) {
		local = local.btns[localAreaBtns[i]];
	}
	// voltar
	voltar.draw();
	voltar.clicked = false;
	//
	for (let b of local.btns) {
		b.draw();
	}
}
function click() {
	// Buttons
	{
		let local = geral;
		for (var i = 0; i < localAreaBtns.length; i++) {
			local = local.btns[localAreaBtns[i]];
		}
		// 
		let px = -1, py = -1;
		if (mouseIsPressed && mouseButton === LEFT) {
			px = mouseX;
			py = mouseY;
		} else {
			px = touches.length > 0 ? touches[0].x : -1;
			py = touches.length > 0 ? touches[0].y : -1;
		}
		// voltar
		voltar.click(px, py);
		//
		let clicked = false;
		for (let b of local.btns) {
			clicked = clicked || b.click(px, py);
		}
		if (clicked) return;
	}
	// Tela
	{
		if (selectPutting != "") {
			let chunk = _map.find(c => c.x == _chunk[0] && c.y == _chunk[1]);
			console.log(chunk.renderHash);
			if (chunk != undefined) {
				// Função utilitária para facilitar a vida
				const mod = (n, m) => ((n % m) + m) % m;

				// Calculando os índices brutos (floored para garantir inteiros)
				let rawX = Math.floor((Math.floor(_poss[0]) - 1) / 3);
				let rawY = Math.floor((Math.floor(_poss[1]) - 1) / 3);

				// Aplicando o módulo seguro para o tamanho do chunk
				let x = mod(rawX, tamanho);
				let y = mod(rawY, tamanho);

				// Agora o acesso ao array nunca será negativo
				let sendIt = {
					keyChunk: { x: chunk.x, y: chunk.y },
					localChunk: { x: x, y: y },
					localBlock: 0,
					what: {
						height: stepDefaultMetters * coeExpantionToMetters,
						depth: metters,
						thing: selectPutting,
						hardness: 1,
						color: getColor(selectPutting)
					}
				};
				setTimeout(() => {
					send({
						type: "addInMap", id: _id,
						data: sendIt
					})
				}, 0);
				// // ordena
				// let antes = chunk.chunk[x][y];
				// let novo = [];
				// let minDepth = 31415926535;
				// while (antes.length > 0) {
				// 	let rem = null;
				// 	minDepth = 31415926535;
				// 	for (let b of antes) {
				// 		if (b.depth < minDepth) {
				// 			minDepth = b.depth;
				// 			rem = b;
				// 		}
				// 	}
				// 	novo.push(rem);
				// 	antes.splice(antes.indexOf(rem), 1);
				// }
				// chunk.chunk[x][y] = novo;
				//
			}

			// _chunksToRecreateQueue.push(chunk);
			// chunk.atualized = false;
			// chunk.renderHash = calculateRenderHash(chunk.chunk);
			// console.log(chunk.renderHash);
			// if (!isRecreatingGraphics) {
			// 	setTimeout(processGraphicsQueue, 0, metters / (stepDefaultMetters * coeExpantionToMetters));
			// }
			// logicChunks(true);
		}
	}
}

// movement
var pressingMovement = {
	'W': {
		pressing: false, time: new Date()
	},
	'A': {
		pressing: false, time: new Date()
	},
	'S': {
		pressing: false, time: new Date()
	},
	'D': {
		pressing: false, time: new Date()
	}
};
function keyPressing() {
	let move = tamBlock;
	let timeMovementContinuous = 333; // ms
	if (keyIsDown('W'.charCodeAt(0))) {
		if (pressingMovement['W'].pressing == false) {
			pressingMovement['W'].pressing = true;
			pressingMovement['W'].time = new Date();
		}
		_poss[1] -= (new Date() - pressingMovement['W'].time < timeMovementContinuous) ? 0 : move;
	}
	if (keyIsDown('S'.charCodeAt(0))) {
		if (pressingMovement['S'].pressing == false) {
			pressingMovement['S'].pressing = true;
			pressingMovement['S'].time = new Date();
		}
		_poss[1] += (new Date() - pressingMovement['S'].time < timeMovementContinuous) ? 0 : move;
	}
	if (keyIsDown('A'.charCodeAt(0))) {
		if (pressingMovement['A'].pressing == false) {
			pressingMovement['A'].pressing = true;
			pressingMovement['A'].time = new Date();
		}
		_poss[0] -= (new Date() - pressingMovement['A'].time < timeMovementContinuous) ? 0 : move;
	}
	if (keyIsDown('D'.charCodeAt(0))) {
		if (pressingMovement['D'].pressing == false) {
			pressingMovement['D'].pressing = true;
			pressingMovement['D'].time = new Date();
		}
		_poss[0] += (new Date() - pressingMovement['D'].time < timeMovementContinuous) ? 0 : move;
	}



}
function keyReleased() {

	for (let k in pressingMovement) {
		if (key.toUpperCase() == k) {
			pressingMovement[k].pressing = false;
		}
	}
}
function keyPressed() {
	if (keyCode == UP_ARROW) {
		moveLayer(-1);
	}
	if (keyCode == DOWN_ARROW) {
		moveLayer(1);
	}

	let move = tamBlock;
	if (key.toUpperCase() == 'W') {
		_poss[1] -= move;
	}
	if (key.toUpperCase() == 'S') {
		_poss[1] += move;
	}
	if (key.toUpperCase() == 'A') {
		_poss[0] -= move;
	}
	if (key.toUpperCase() == 'D') {
		_poss[0] += move;
	}
}
function mousePressed() {
	click();
}
function touchStarted() {
	// 🛑 ADICIONE A VERIFICAÇÃO DE SEGURANÇA AQUI
	if (touches.length > 0) {
		startedTouch = [touches[0].x, touches[0].y];
	}
	click();
}
function touchMoved() {
	// let move = tamBlock;
	// if (touches[0].y < height / 2) {
	// 	_poss[1] -= move;
	// }
	// if (touches[0].y > height / 2) {
	// 	_poss[1] += move;
	// }
	// if (touches[0].x < width / 2) {
	// 	_poss[0] -= move;
	// }
	// if (touches[0].x > width / 2) {
	// 	_poss[0] += move;
	// }

	// movimentação
	// _poss[0] -= touches[0].x - startedTouch[0];
	// _poss[1] -= touches[0].y - startedTouch[1];


	// zoom
	//att
	//mud
	if (touches.length == 1) {
		// logServer("no zoom");
		initializedDoubleTouch = false;
		_poss[0] -= touches[0].x - startedTouch[0]; // deixar isso aqui
		_poss[1] -= touches[0].y - startedTouch[1]; // deixar isso aqui 
		startedTouch = [touches[0].x, touches[0].y];
	} else if (touches.length == 2) {
		// log("no atribuition");
		if (!initializedDoubleTouch) {
			initZoom = zoom;
			startedTouchZoom[0] = [touches[0].x, touches[0].y];
			startedTouchZoom[1] = [touches[1].x, touches[1].y];
			initializedDoubleTouch = true;
			// logServer("atribuition");
		}
		initializedDoubleTouch = (touches.length >= 2) !== (!initializedDoubleTouch && touches.length >= 2);
		let dist1 = Math.sqrt(Math.pow(touches[0].x - touches[1].x, 2) + Math.pow(touches[0].y - touches[1].y, 2));
		let dist2 = Math.sqrt(Math.pow(startedTouchZoom[0][0] - startedTouchZoom[1][0], 2) + Math.pow(startedTouchZoom[0][1] - startedTouchZoom[1][1], 2));
		zoom = initZoom * dist1 / dist2;
		// startedTouchZoom[0] = [touches[0].x, touches[0].y];
		// startedTouchZoom[1] = [touches[1].x, touches[1].y];
		//

	} else {
		initializedDoubleTouch = false;
	}

	// tamBlock = Math.round(tamBlock); // diminui o bug do dis-zoom
	let stepZoom = 0.5;
	zoom = Math.round(zoom / stepZoom) * stepZoom;
	zoom = Math.max(0.5, zoom);
	zoom = Math.min(32, zoom);
	// tamBlock = Math.ceil(tamBlock);
}
function zoomIn() {
	zoom += 0.5;
	zoom = Math.max(0.5, zoom);
	zoom = Math.min(32, zoom);
}
function zoomOut() {
	zoom -= 0.5;
	zoom = Math.max(0.5, zoom);
	zoom = Math.min(32, zoom);
}
function moveLayer(v) {
	let m = metters;
	metters += v * stepMetters * coeExpantionToMetters;
	metters = (metters < 0) ? 0 : metters;
	metters = (metters >= 1 * coeExpantionToMetters) ? (1 - stepDefaultMetters) * coeExpantionToMetters : metters;
	console.log("metters: " + metters + "\n" + stepMetters * coeExpantionToMetters);
	if (m != metters) { // recarrega as paradas qnd muda de layer
		if (!isRecreatingGraphics) {
			_chunksToRecreateQueue.push(..._map);
			console.log("recreate for layer change");
			setTimeout(processGraphicsQueue, 0, metters / (stepDefaultMetters * coeExpantionToMetters));
		}
	}
}

// html/comunication
// document.getElementById("newMap").onclick = async () => {
// 	send({ type: "map", id: _id, pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock }, data: newMap() });
// 	document.getElementById("checkConnection").textContent = "No connection !";
// 	const r = await fetch('http://' + ipGeral + ':1234/checkConnection')
// 	const data = await r.json();
// 	document.getElementById("checkConnection").textContent = data.msg;
// 	document.getElementById("seed").textContent = _seed;
// };

document.getElementById("checkConnection").onclick = async () => { // conection
	document.getElementById("checkConnection").textContent = "No connection !";
	const r = await fetch('http://' + ipGeral + ':1234/checkConnection')
	const data = await r.json();
	document.getElementById("checkConnection").textContent = data.msg;
};

//auxiliar
function getTime() {
	let now = new Date();
	let pad2 = n => n.toString().padStart(2, '0');
	let pad3 = n => n.toString().padStart(3, '0');
	let hh = pad2(now.getHours());
	let min = pad2(now.getMinutes());
	let ss = pad2(now.getSeconds());
	let ms = pad3(now.getMilliseconds());
	return `${hh}:${min}:${ss}.${ms}`
}
function depuration() {

	document.getElementById("qtCh.Dr.").textContent = "" + qtChunksDrawed + "/" + _map.length;
	document.getElementById("zoom").textContent = zoom;
	document.getElementById("fps").textContent = Math.round(1000 / (new Date() - lastTimeFps));
	lastTimeFps = new Date();
	log("dep: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();
	document.getElementById("touches").textContent = touches.length;
	// tocuhes
	// try{
	// document.getElementById("th1").textContent = ""+touches[0].x+", "+touches[0].y;
	// document.getElementById("th2").textContent = ""+touches[1].x+", "+touches[1].y;
	// document.getElementById("d1").textContent = touches.length;
	// document.getElementById("d2").textContent = touches.length;
	// }catch (e) {}
	// hidenator
	let rem = "touches"
	document.getElementById(rem).style.display = "none";
	Array.from(document.getElementsByTagName("th")).filter(e => e.textContent == rem).map(e => e.style.display = "none");
	document.getElementById("metters").textContent = metters;

}
function send(msg) {
	msg["time"] = getTime();
	ws.send(JSON.stringify(msg))
}
function erro(code, msg) {
	console.log(code, erros.filter(e => e[0] == code)[0][1]);
	let sendIt = code + ": " + erros.filter(e => e[0] == code)[0][1];
	if (msg != null) {
		sendIt += " --> (" + msg + ")";
	}
	document.getElementById("erro").textContent = sendIt;
	document.getElementById("erro").style.display = "flex";
}