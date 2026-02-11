// 14/12/2025 22h45
// constantes
const ipGeral = "192.168.0.11"; //10.96.160.102
const porta = 3000;
const tamanho = 30;
const coeExpantion = 2;
const FPS_LIMIT = 20;
const FRAME_TIME_MS = 1000 / FPS_LIMIT;
var tamBlock = 5; // 30
const erros = [
	["ERRO-001", "Sem chunks a enviar;\nlogicChunk(); sending"],
	["ERRO-002", "Chunk não encontrado para atualização"], // processAttChunk(data)
	["ERRO-003", "Tipo de funcDraw() de buttons não definido"], // buttons
];
const tamanhoMaximo = [4, 1]; // 40,20
// variaveis
var _map = [];
var _seed = 1234;
// variaveis de configuração
var _id = 0;
var stepDefaultMetters = 5;
var stepMetters = stepDefaultMetters;
var coeExpantionToMetters = 1;
var borderInChunks = true;
var initWithWater = false;
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
var _chunksQueue = []; //
var isProcessingMapOrder = false;
var isRecreatingGraphics = false;
var isGeneratingChunks = false; //
// variaveis moveis
var loop = -1;
var metters = 0;
var selectPutting = "";
let _chunk = [0, 0];
let _poss = [tamBlock / 2, tamBlock / 2];
_poss[0] += 11 * tamBlock + 1 * tamanho * tamBlock; // teste
_poss[1] += 10 * tamBlock; // teste
var zoom = 4, initZoom = 1; // tudo 1
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
	// data.type = "seed";
	let comms = ["seed", "configs"];
	let foundComm = false;
	for (let comm of comms) {
		if (comm == data.type) {
			foundComm = true;
			logServer(data.type + " " + data.time);
			break;
		}
	}
	if (!foundComm) logServer(data.type + data.data.length + " " + data.time);
	// activation["processData"] = false;
	switch (data.type) {
		case "newMap": // usa o cliente só pra fazer o mapa
			console.log("newMap");
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
			// location.reload();
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
		case "configs":
			console.log(data.id);
			_id = data.id; // 🛑 2. INICIALIZAÇÃO CRÍTICA
			stepDefaultMetters = data.game.stepDefaultMetters;
			stepMetters = stepDefaultMetters;
			coeExpantionToMetters = data.game.coeExpantionToMetters;
			break;
		case "initialMap":
			_mapOrderQueue.push(data.data); // 🛑 1. ENFILEIRA A NOVA ORDEM DO MAPA


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
			console.log("seed " + _seed);
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
			// console.log(chunk.graphics);
			// Lógica de recriação do graphics (o trabalho que demorava 333ms)
			let chunkGraphics = [];
			// 1 / stepDefaultMetters             1

			chunkGraphics = createGraphics(chunkSizePx, chunkSizePx);
			chunkGraphics.noStroke();
			// console.log("Recriando graphics de: "+chunk.x+","+chunk.y);

			// 🛑 CÓDIGO DE DESENHO COMPLETO INCLUÍDO AQUI
			for (let i = 0; i < tamanho; i++) {
				let blocks = chunk.chunk[i];
				// console.log(blocks);
				let draws = drawBlock(blocks);
				for (let k = 0; k < draws.length; k++) { // 20 paradas
					if ((i == 0 || i == tamanho - 1) && borderInChunks) chunkGraphics.stroke(1);
					else chunkGraphics.noStroke();
					// console.log(draws[k]);
					chunkGraphics.fill(draws[k][2]); // 2: é a cor propriamente dita
					chunkGraphics.rect(i * tamBlock, (draws[k][0] - draws[k][1]) * tamBlock / (stepDefaultMetters * coeExpantionToMetters), tamBlock, tamBlock * draws[k][1] / (stepDefaultMetters * coeExpantionToMetters));
					// console.log(i,k);
				}
			}
			// 🛑 FIM DO CÓDIGO DE DESENHO COMPLETO
			// console.log("(" + _chunksToRecreateQueue.length + ") layerress: " + chunk.x);
			// console.log(chunk, chunkGraphics);
			// if (!chunk.graphics) chunk.graphics = chunkGraphics;
			// else {
			// 	// console.log("Recriado gráfico layer " + layer + " para chunk (" + chunk.x + ")");
			// }
			chunk.graphics = chunkGraphics;
			// console.log(chunk.chunk);

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
	// createFreeMap();
	console.log("setup");

	noLoop();
	defineButtons();
	requestAnimationFrame(manualDrawLoop); // 🛑 Inicia o loop manual.
}
function manualDrawLoop(timestamp) {
	loop++;
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
	background("#5a83ffff");
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
	_newMap(true);
}
function newMap() {
	// noiseSeed(1234567890);
	console.log("Creating new Map");
	canAssembleMap = false;
	send({ type: "formSeed", id: _id });
	return _newMap(true);
}
function _newMap(useSeed) {
	console.log("Creating " + useSeed);
	let map = [];
	// não dá pra não criar tudo se não da bug no waterfall
	for (let i = -(tamanhoMaximo[0] - 1) - 1; i <= tamanhoMaximo[0] - 1; i++) {
		for (let j = -(tamanhoMaximo[1] - 1); j <= tamanhoMaximo[1] - 1; j++) {
			let chunk = getChunk(i, j, useSeed);
			map.push(chunk);
		}
	}
	return map;
}
function getChunk(x, y, useSeed) {
	console.log("getChunk: " + x + ", " + y + " - " + getTime());
	// 1. Configurações de Perlin Noise
	noiseDetail(8, 0.2); // default: 8, 0.2
	noiseSeed(_seed);
	let coeExpantionEarth = 1; // min make bigger; max make smaller 
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
	let chunkGraphics = createGraphics(chunkSizePx, chunkSizePx);
	chunkGraphics.noStroke();
	// console.log(chunkGraphics.length);
	if (useSeed) {
		for (let i = 0; i < tamanho; i++) {

			let gx = x * tamanho + i;
			let ax = gx;
			let tx = ax;

			let blend = 1;

			if (x <= -tamanhoMaximo[0] + 1) {
				// 90 - (3 - 1) * 30 = 90 - 60 = 30
				t = (abs(gx) - (tamanhoMaximo[0] - 1) * tamanho) / (tamanho * 2)
				blend = 1 / (1 + Math.exp(t * 10))
			}
			if (x >= tamanhoMaximo[0] - 2) {
				// 90 - (3 - 1) * 30 = 90 - 60 = 30
				t = (gx - (tamanhoMaximo[0] - 1) * tamanho) / (tamanho * 2)
				blend = 1 / (1 + Math.exp(t * 10))
			}

			// tx = tx * vari * blend;

			// noise limitado
			let n = noise(
				tx * vari + desconfiguraPatterns[0]
			) * blend; // from 0.0 to 1.0
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
			//
			let gapTerrenoAcima = 50; // addIt
			let tamBlk = 1;

			switch (thing) {
				case "water":
					let m = (tWater - n) * coeExpantionToMetters;
					let total = tWater * coeExpantionToMetters;
					let colorWater = getColorByProf("water", m, total);
					console.log((m-m%5)/5);
					blocks = [];
					let t = 1;
					if (initWithWater) {
						t = m;
						for (let h = 0; h < t; h += tamBlk) {
							blocks.push(
								{
									height: tamBlk,
									depth: h,
									thing: thing,
									hardness: 1,
									color: colorWater
								}
							);
						}
					}
					t = (0.1) * coeExpantionToMetters;
					for (let h = 0; h < t; h += tamBlk) {
						blocks.push(
							{
								height: tamBlk,
								depth: h + Math.round(m * variMin) / variMin,
								thing: "sand",
								hardness: 2,
								color: getColor("sand")
							}
						);
					}
					break;
				case "earth":
					t = 10;
					blocks = []
					for (let h = 0; h < t; h += tamBlk) {
						blocks.push(
							{
								height: tamBlk,
								depth: h,
								thing: thing,
								hardness: thing === "stone" ? 3 : 2,
								color: getColor(thing)
							}
						);
					}
					break;
				default:
					t = 5;
					blocks = []
					for (let h = 0; h < t; h += tamBlk) {
						blocks.push(
							{
								height: tamBlk,
								depth: h,
								thing: thing,
								hardness: thing === "stone" ? 3 : 2,
								color: getColor(thing)
							}
						);
					}
					break;
			}
			// gapTerreno
			for (let b of blocks) {   // addIt
				b.depth += gapTerrenoAcima;
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
				height: 200,
				depth: initDepth + l1,
				thing: "rock",
				hardness: 5,
				color: getColor("rock")
			});
			// deixa as paradas limpas
			for (let b of blocks) {
				b.height = Math.round(b.height * variMin) / variMin;
				b.depth = Math.round(b.depth * variMin) / variMin;
			}
			//

			chunk[i] = blocks;

			// Desenha o bloco no buffer gráfico
			let draws = drawBlock(blocks);
			for (let k = 0; k < draws.length; k++) { // 20 paradas
				if ((i == 0 || i == tamanho - 1) && borderInChunks) chunkGraphics.stroke(1);
				else chunkGraphics.noStroke();
				chunkGraphics.fill(draws[k][2]);
				chunkGraphics.rect(i * tamBlock, (draws[k][0] - draws[k][1]) * tamBlock / (stepDefaultMetters * coeExpantionToMetters), tamBlock, tamBlock * draws[k][1] / (stepDefaultMetters * coeExpantionToMetters));
			}

		}
	}
	else {
		console.log("sem seed");
		// Se não usar seed (Mapa Inicial Vazio)
		let thing = "-nada-";
		let blocks = [
			{
				height: 100,
				depth: 0,
				thing: thing, hardness: 700, color: getColor(thing)
			}
		];

		for (let i = 0; i < tamanho; i++) {
			chunk.push([]);

			let draws = drawBlock(blocks);
			for (let k = 0; k < draws.length; k++) {
				if ((i == 0 || i == tamanho - 1) && borderInChunks) chunkGraphics.stroke(1);
				else chunkGraphics.noStroke();
				chunkGraphics.fill(draws[k][2]);
				chunkGraphics.rect(i * tamBlock, (draws[k][0] - draws[k][1]) * tamBlock / (stepDefaultMetters * coeExpantionToMetters), tamBlock, tamBlock * draws[k][1] / (stepDefaultMetters * coeExpantionToMetters));
			}
			// console.log(draws[0]);
			chunk[i] = blocks;
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
	"#rgba(0, 0, 0, 0.26)"

	switch (thing) { // escolhe cor
		case "water": return [0, 40, 120, 255]; // azul profundo
		case "-shallowwater": return [0, 120, 255, 255]; // azul claro 
		case "sand": return [240, 230, 140, 255]; // areia
		case "earth": return [136, 61, 0, 255]; // terra
		case "stone": return [110, 110, 110, 255]; // pedra
		case "snow": return [255, 255, 255, 255]; // neve
		case "rock": return [50, 50, 50, 255]; // rocha
		case "fundoTransparente": return [0, 0, 0, 0];
		case "space": return [0, 0, 0, 64];
		default: return [255, 0, 255, 255]; // nada
	}
}
function getColorByProf(thing, m, total) {
	// console.log(m, total);
	let colorWater = getColor(thing);
	return [colorWater[0],
	(getColor("-shallowwater")[1] - colorWater[1]) * (1 - m / total) + colorWater[1],
	(getColor("-shallowwater")[2] - colorWater[2]) * (1 - m / total) + colorWater[2],
		255];
}
function drawBlock(blocks) {
	let finalColors = [];
	// console.log("---")
	// console.log(blocks);
	for (let j = 0; j < blocks.length; j++) {
		// console.log(blocks[j].depth + blocks[j].height);
		finalColors.push([blocks[j].depth + blocks[j].height, blocks[j].height, blocks[j].color]);
	}
	// console.log(finalColors)
	// taka os espaços vazios
	let res = [];
	for (let i = 0; i < finalColors.length; i++) {
		res.push(finalColors[i]);
		if (i < finalColors.length - 1) {
			if (finalColors[i][0] != finalColors[i + 1][0] - finalColors[i + 1][1]) {
				res.push([finalColors[i + 1][0] - finalColors[i + 1][1], (finalColors[i + 1][0] - finalColors[i + 1][1]) - finalColors[i][0], getColor("fundoTransparente")]);
			}
		}
	}
	return finalColors;
}

function calculateRenderHash(chunkData) {
	let hash = 0;
	// Percorre apenas os dados que definem a aparência
	// console.log(chunkData);
	for (let i = 0; i < tamanho; i++) {
		// Usa o código da cor (ou outro identificador numérico) para o hash.
		// Se a cor for uma string (ex: "#00FF00"), você precisará de uma conversão.
		// Para simplicidade, vamos somar os códigos ASCII da string de cor.
		for (let l = 0; l < chunkData[i].length; l++) {
			const colorString = drawBlock(chunkData[i])[l].toString();
			for (let k = 0; k < colorString.length; k++) {
				hash += colorString.charCodeAt(k);
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
	translate(width / 2, height / 2);
	scale(zoom);
	translate(-camWorldX, -camWorldY);

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
	let txt = "";
	let chNow = [
		Math.floor(_poss[0] / (tamBlock * tamanho)),
		Math.floor(_poss[1] / (tamBlock * tamanho))
	];

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
		// if (chunk.x==1) console.log(infinitePlanetView(chunk,x,y));
		let _inf = infinitePlanetView(chunk, chNow[0], chNow[1]);
		let inf = _inf[0];
		let moveNow = _inf[1];
		if (!isChunkVisible(chunk, viewLeft, viewRight, viewTop, viewBottom)) {
			if (!inf) return;
		}
		// ... (verificação isChunkVisible) ...



		// 🛑 PRIORIDADE: 1. Graphics Pronto, 2. Graphics Placeholder
		let graphicToDraw;
		try {
			graphicToDraw = (chunk.graphics) ? chunk.graphics : chunk.placeholderGraphics;
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
			// console.log(chunk.x * tamanho * tamBlock + moveNow.x);
			image(
				graphicToDraw,
				chunk.x * tamanho * tamBlock + moveNow.x,
				chunk.y * tamanho * tamBlock + moveNow.y
			);
			txt += chunk.x + ", ";
			qtChunksDrawed++;
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
		delete chunk.moveNow;
	});
	// console.log(txt);
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
	document.getElementById("chunk").textContent = _chunk[0] + ", " + _chunk[1] + " | " + x + ", " + y + "\n" + _poss[0] + "," + _poss[1];
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
function infinitePlanetView(chunk, x, y) {
	let moveNow = { x: 0, y: 0 };
	if (chunk.x == tamanhoMaximo[0] - 1 && x == -tamanhoMaximo[0]) { // atras
		moveNow.x = -tamanhoMaximo[0] * 2 * tamanho * tamBlock;
		return [true, moveNow];
	} else if (chunk.x == -tamanhoMaximo[0] && x == tamanhoMaximo[0] - 1) { // atras
		moveNow.x = tamanhoMaximo[0] * 2 * tamanho * tamBlock;
		return [true, moveNow];
	}
	return [false, moveNow];
}
// draw
function toroide() {
	// tamanho total do mundo em pixels
	const worldW = (tamanhoMaximo[0] * 2) * tamanho * tamBlock;
	const worldH = (tamanhoMaximo[1] * 2) * tamanho * tamBlock;

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
	// console.log(qtAdd);
	// 3. Seleciona os chunks que DEVEM estar na vizinhança (no raio de qtAdd)
	for (let i = _chunk[0] - qtAdd; i <= _chunk[0] + qtAdd; i++) {
		for (let j = _chunk[1] - qtAdd; j <= _chunk[1] + qtAdd; j++) {
			toFind.push({ x: i, y: j });
		}
	}
	// remove os q passa do maximo
	toFind = toFind.map(chunk => {
		if (chunk.x == tamanhoMaximo[0] && chunk.y == 0) chunk.x = -tamanhoMaximo[0];
		else if (chunk.x == -tamanhoMaximo[0] - 1 && chunk.y == 0) chunk.x = tamanhoMaximo[0] - 1;
		return chunk;
	});
	toFind = toFind.filter(chunk =>
		chunk.x <= tamanhoMaximo[0] - 1 && chunk.x >= -tamanhoMaximo[0] && chunk.y == 0 // somente primeiro level
	); // && chunk.y <= tamanhoMaximo[1] - 1 && chunk.y >= -tamanhoMaximo[1]
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
	// console.log(toFind);
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
	// console.log(">");
	// console.log(_map[_map.length-1])
	// console.log(getTime()+_map[_map.length-1].atualized);

	// envia as paradas assincronamente
	// return;
	let v1 = toFind.length > 0 || remainAtualizeds, v2 = order;

	if (v1 || v2) {
		const safeMapToSend = _map.filter(c => c.atualized).map(chunk => {
			// console.log("sending "+chunk.x);
			// console.log(JSON.stringify(chunk.chunk));
			return {
				x: chunk.x,
				y: chunk.y,
				chunk: chunk.chunk,
				renderHash: chunk.renderHash,
				atualized: chunk.atualized
			};
		});
		if (v1) {
			logServer("Ads" + toFind.length + " _map" + _map.length + " > aMoC" + safeMapToSend.length + " " + getTime());
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
// promisses = 80
class Button {
	constructor(name, x, y, w, h, txt, cor, func, typeFuncDraw) {
		this.name = name;
		this.cor = cor;
		this.x = x;
		this.y = y;
		this.w = w;
		this.h = h;
		this.txt = txt;
		this.func = func;
		this.typeFuncDraw = typeFuncDraw;
		this.clicked = false;
	}
	click(px, py) {
		let cl = px >= this.x && px <= this.x + this.w &&
			py >= this.y && py <= this.y + this.h;
		if (cl) {
			this.clicked = !this.clicked;
			this.func();
			console.log("click " + this.name);
		}
		return cl;
	}
	draw() {
		if (this.typeFuncDraw != null) {
			switch (this.typeFuncDraw) {
				case 0:
					break;
				case 1:
					if (selectPutting != this.name) this.clicked = false;
					break;
				default:
					erro("ERRO-003", "typeFuncDraw= " + this.typeFuncDraw);

			}
		}
		//

		if (this.clicked) {
			fill(this.cor);
			rect(this.x, this.y, this.w, this.h);
			stroke("#00ff00");
			// fill("#00ff004d");
			rect(this.x, this.y, this.w, this.h);
		} else {
			noStroke();
			fill(this.cor);
			rect(this.x, this.y, this.w, this.h);
		}
		//
		textSize(this.w / 4);
		fill("#ffffff");
		text(this.txt, this.x + this.w / 2 - textWidth(this.txt) / 2, this.y + this.h / 2 + textAscent() / 2);
	}
}
class AreaButtons extends Button {
	constructor(name, x, y, w, h, txt, cor, func, funcDraw, btns) {
		super(name, x, y, w, h, txt, cor, func, funcDraw);
		this.btns = btns;
	}
}
var geral = new AreaButtons("geral",
	0, 0
	, 0, 0,
	"", "#ff0000", () => {
		console.log("geral");
	}, null, []
);
var localAreaBtns = [], voltar;
function defineButtons() {
	let pad = 5;
	noStroke();
	fill("#00000073");
	rect(pad, height * 3 / 4 + pad, width - pad * 2, height * 1 / 4 - pad * 2);
	// definitions
	let l = 0, c = 0;
	let tam = 30;
	let gap = 10;
	// adm
	geral.btns.push(new AreaButtons("adm",
		pad * 2 + tam * c + gap * c, pad * 2 + height * 3 / 4 + tam * l + gap * l
		, tam, tam,
		"ADM", "#aa0000", () => {
			localAreaBtns = [0];
		}, null,
		[
			new AreaButtons("put",
				pad * 2 + tam * c + gap * c, pad * 2 + height * 3 / 4 + tam * l + gap * l
				, tam, tam,
				"PUT", "#85aa00ff", () => {
					localAreaBtns.push(0);
				}, null,
				[
					new Button("water",
						pad * 2 + tam * c + gap * c, pad * 2 + height * 3 / 4 + tam * l + gap * l
						, tam, tam,
						"WATER", "#1b50ffff", () => {
							selectPutting = (selectPutting == "water") ? "" : "water";
						}, 1
					)
					, new Button("stone",
						pad * 2 + tam * (c + 1) + gap * (c + 1), pad * 2 + height * 3 / 4 + tam * l + gap * l
						, tam, tam,
						"STONE", getColor("stone"), () => {
							selectPutting = (selectPutting == "stone") ? "" : "stone";
						}, 1
					)
					, new Button("space",
						pad * 2 + tam * (c + 0) + gap * (c + 0), pad * 2 + height * 3 / 4 + tam * (l + 1) + gap * (l + 1)
						, tam, tam,
						"SPACE", getColor("space"), () => {
							selectPutting = (selectPutting == "space") ? "" : "space";
						}, 1
					)
				]
			)
		]
	));
	// l = 0; c = 0;

	// // adm-put
	// l = 0; c = 0;
	// geral.btns[geral.btns.length - 1].btns[0].btns.push(
	// 	;
	// geral.btns[geral.btns.length - 1].btns[0].btns.push(
	// );


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
	// console.log(selectPutting);
	local.clicked = false;
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
			let chunk = _map.find(c => c.x == _chunk[0]);
			// console.log(chunk.renderHash);
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
					localChunk: { x: x },
					localBlock: 1, // 0: unshift; 1:replace in block unshift
					what: {
						height: stepDefaultMetters * coeExpantionToMetters,
						depth: (rawY) * stepDefaultMetters * coeExpantionToMetters, // addIt : era o 'metters'
						thing: selectPutting,
						hardness: 1,
						color: getColor(selectPutting)
					}
				};
				// console.log(sendIt);
				// console.log("put in: "+(rawY-20)*stepDefaultMetters * coeExpantionToMetters)
				setTimeout(() => {
					send({
						type: "addInMap", id: _id,
						data: sendIt
					})
				}, 0);
				// simula recebimento
				// simulateMergeChunks(sendIt);
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