// constantes
const ipGeral = "192.168.0.10"; //10.96.160.102
const porta = 3000;
const tamanho = 30;
const coeExpantion = 4;
const FPS_LIMIT = 20;
const FRAME_TIME_MS = 1000 / FPS_LIMIT;
var tamBlock = 360 / (tamanho * coeExpantion); // 3
const erros = [
	["ERRO-001", ""],
]
// variaveis
var _map = [];
var _seed = 0;
// variaveis de configuração
var _id = 0;
// variaveis de estado
var gotInitialMap = false;
var canAssembleMap = true;
var lastTime = 0, lastTimeFps = 0;
var lastTimesEsp = [0,0,0];
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
let _chunk = [0, 0];
let _poss = [tamBlock / 2, tamBlock / 2];
var zoom = 1, initZoom = 1;
// variaveis de iteração
var initializedDoubleTouch = false
var startedTouch = [0, 0];
var startedTouchZoom = [[0, 0], [0, 0]];
//connection
const ws = new WebSocket('ws://' + ipGeral + ':3000');
// ws.onopen = () => log("Conectado ao servidor!", false);
ws.onmessage = (ev) => {
	const data = JSON.parse(ev.data);
	// log("Recebido: " + JSON.stringify(data.type), false);
	processData(data);
};
//
function processData(data) {
	lastTime = new Date();
	logServer("process Data: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();

	// 🛑 REMOVER O BLOCO WHILE (waitDoMap): Este tipo de loop síncrono bloqueia o navegador.

	let comms = ["seed"];
	comms.filter(e => e != data.type).forEach(e => logServer(data.type + data.data.length + " " + data.time));
	comms.filter(e => e == data.type).forEach(e => logServer(data.type + " " + data.time));

	switch (data.type) {
		case "map":
		case "orderChunks":
			_mapOrderQueue.push(data.data); // 🛑 1. ENFILEIRA A NOVA ORDEM DO MAPA

			if (!isProcessingMapOrder) {
				processMapOrderQueue(); // 🛑 2. INICIA O PROCESSAMENTO LENTO DA ORDEM
			}
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
			logServer("main.js - Tipo de dado desconhecido: " + data.type, false); // 🛑 TIPO DE DADO DESCONHECIDO
	}
	logServer("process Data end: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();
}
function processGraphicsQueue() {
	const CHUNKS_PER_CALL = 2; // Ajuste este valor

	if (_chunksToRecreateQueue.length === 0) {
		isRecreatingGraphics = false;
		return;
	}

	isRecreatingGraphics = true;
	let processedCount = 0;
	let chunkSizePx = tamanho * tamBlock;

	while (processedCount < CHUNKS_PER_CALL && _chunksToRecreateQueue.length > 0) {
		const chunk = _chunksToRecreateQueue.shift();

		if (chunk && !chunk.graphics) {

			// Lógica de recriação do graphics (o trabalho que demorava 333ms)
			let chunkGraphics = createGraphics(chunkSizePx, chunkSizePx);
			chunkGraphics.noStroke();

			// 🛑 CÓDIGO DE DESENHO COMPLETO INCLUÍDO AQUI
			for (let i = 0; i < tamanho; i++) {
				for (let j = 0; j < tamanho; j++) {
					let block = chunk.chunk[i][j];
					chunkGraphics.fill(block.color);
					chunkGraphics.rect(i * tamBlock, j * tamBlock, tamBlock, tamBlock);
				}
			}
			// 🛑 FIM DO CÓDIGO DE DESENHO COMPLETO

			chunk.graphics = chunkGraphics;

			// Limpa o placeholder após o gráfico estar pronto
			if (chunk.placeholderGraphics) {
				delete chunk.placeholderGraphics;
			}
		}
		processedCount++;
	}

	if (_chunksToRecreateQueue.length > 0) {
		setTimeout(processGraphicsQueue, 10);
	} else {
		isRecreatingGraphics = false;
	}
}
function processMapOrderQueue() {
	lastTimesEsp[0] = new Date();
	log("moq: " + Math.round((new Date() - lastTime)), true,0);
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
	log("moq--: " + Math.round((new Date() - lastTime)), true,0);
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
		chunksToEnqueue.push(newChunk);
		return newChunk;
	});
	log("moq merge: " + Math.round((new Date() - lastTime)), true,0);
	lastTimesEsp[0] = new Date();
	// 1. ATUALIZA O MAPA DE DESENHO (AGORA COM GRÁFICOS PRESENTE OU PLACEHOLDER)
	mergedMap.filter(c => !_map.find(m => m.x === c.x && m.y === c.y)).forEach(c => {
		_map.push(c);
	})
	console.log("after chunks c/ graphics: " + _map.filter(c => c.graphics).length);


	// 2. ENFILEIRA os chunks que realmente precisam de reconstrução
	_chunksToRecreateQueue.push(...chunksToEnqueue);

	// 3. INICIA/CONTINUA O PROCESSAMENTO LENTO DOS GRÁFICOS
	if (!isRecreatingGraphics) {
		processGraphicsQueue();
	}

	// 4. Agenda o processamento do próximo mapa na fila (se houver)
	if (_mapOrderQueue.length > 0) {
		setTimeout(processMapOrderQueue, 500);
	} else {
		isProcessingMapOrder = false;
	}
	log("moq final: " + Math.round((new Date() - lastTime)), true,0);
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
		setTimeout(processChunkGenerationQueue, 5);
	} else {
		isGeneratingChunks = false; // Terminou o trabalho
	}
}
function setup() {
	const canvas = createCanvas(tamanho * tamBlock * coeExpantion, tamanho * tamBlock * coeExpantion);
	// const canvas = createCanvas(960,960);
	canvas.parent("localCanvas");
	console.log("setup");

	noLoop();
	createFreeMap();
	requestAnimationFrame(manualDrawLoop); // 🛑 Inicia o loop manual.
	//
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
	// try{console.log("repetidos: "+_map.filter(c => _map.filter(m => m.x === c.x && m.y === c.y).length > 1).length)}catch (e) {}
	// console.log(_map.map(c => c.x + " " + c.y).join("\n"));
	log("", false);
	log("init: " + Math.round((new Date() - lastTime)), true);	
	lastTime = new Date();
	background(128);

	// --- 1. DESENHO DO MAPA (ISOLADO) ---
	push();
	doMap();
	pop();

	log("doMap: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();

	// --- 2. DESENHO DA UI/HUD (Sem Zoom) ---
	doMove();
	log("move: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();

	// ... (o restante da lógica) ...

	if (gotInitialMap) logicChunks();
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
		line(startedTouchZoom[0][0], startedTouchZoom[0][1], touches[0].x, touches[0].y);
		line(startedTouchZoom[1][0], startedTouchZoom[1][1], touches[1].x, touches[1].y);
	} catch (e) { }

	// Chama o loop de desenho do p5.js (faz a renderização)
	p5.prototype.redraw();
	log("draw: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();
}
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

//

function recreateChunkGraphics(mapData) {
	let chunkSizePx = tamanho * tamBlock;

	mapData.forEach(chunk => {
		// Ignora chunks que, por acaso, já tenham graphics
		if (chunk.graphics) return;

		let chunkGraphics = createGraphics(chunkSizePx, chunkSizePx);
		chunkGraphics.noStroke();

		// Desenha o conteúdo do chunk no buffer
		for (let i = 0; i < tamanho; i++) {
			for (let j = 0; j < tamanho; j++) {
				let block = chunk.chunk[i][j];

				// Usa a cor e o tamBlock original para desenhar
				chunkGraphics.fill(block.color);
				chunkGraphics.rect(i * tamBlock, j * tamBlock, tamBlock, tamBlock);
			}
		}

		// Adiciona a propriedade graphics de volta ao chunk
		chunk.graphics = chunkGraphics;
	});

	return mapData;
}
function getChunk(x, y, useSeed) {
	// 1. Configurações de Perlin Noise
	noiseDetail(8, 0.2);
	noiseSeed(_seed);
	let vari = 0.05; // 0.1 normal; 0.05 worldbox; 
	var desconfiguraPatterns = 3141592;

	var chunk = [];

	// 2. Cria o buffer gráfico (Canvas offscreen)
	let chunkSizePx = tamanho * tamBlock;
	let chunkGraphics = createGraphics(chunkSizePx, chunkSizePx);
	chunkGraphics.noStroke(); // Não queremos bordas nos blocos

	if (useSeed) {
		for (let i = 0; i < tamanho; i++) {
			chunk.push([]);
			for (let j = 0; j < tamanho; j++) {

				// Geração de Bioma/Bloco
				let n = noise((i + x * tamanho + desconfiguraPatterns) * vari, (j + y * tamanho + desconfiguraPatterns) * vari);
				let biome = "water";
				if (n < 0.25) biome = "deepwater";
				else if (n < 0.35) biome = "water";
				else if (n < 0.40) biome = "sand";
				else if (n < 0.55) biome = "grass";
				else if (n < 0.75) biome = "stone";
				else biome = "snow";

				let block = {
					height: n,
					biome: biome,
					depth: 1 - n,
					hardness: biome === "stone" ? 3 : 1,
					color: getColor(biome)
				};
				chunk[i].push(block);

				// Desenha o bloco no buffer gráfico
				chunkGraphics.fill(block.color);
				chunkGraphics.rect(i * tamBlock, j * tamBlock, tamBlock, tamBlock);
			}
		}
	} else {
		// Se não usar seed (Mapa Inicial Vazio)
		let biome = "deepwater";
		let col = getColor(biome);
		let block = { height: 0, biome: biome, depth: 1, hardness: 1, color: col };

		chunkGraphics.fill(col);
		chunkGraphics.rect(0, 0, chunkSizePx, chunkSizePx);

		for (let i = 0; i < tamanho; i++) {
			chunk.push([]);
			for (let j = 0; j < tamanho; j++) {
				chunk[i].push(block);
			}
		}
	}

	// 🛑 NOVO: Calcula o hash de renderização com base nos dados do chunk
	const hashValue = calculateRenderHash(chunk);

	return {
		x: x,
		y: y,
		chunk: chunk,
		graphics: chunkGraphics,
		renderHash: hashValue // 🛑 NOVO: Inclui o hash no objeto do chunk
	};
}
function calculateRenderHash(chunkData) {
	let hash = 0;
	// Percorre apenas os dados que definem a aparência
	for (let i = 0; i < tamanho; i++) {
		for (let j = 0; j < tamanho; j++) {
			// Usa o código da cor (ou outro identificador numérico) para o hash.
			// Se a cor for uma string (ex: "#00FF00"), você precisará de uma conversão.
			// Para simplicidade, vamos somar os códigos ASCII da string de cor.
			const colorString = chunkData[i][j].color.toString();
			for (let k = 0; k < colorString.length; k++) {
				hash += colorString.charCodeAt(k);
			}
		}
	}
	// Retorna um valor final que pode ser comparado
	return hash % 100000; // Limita o hash para um número gerenciável
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
	translate(-camWorldX, -camWorldY);

	// 3. Aplica a escala (zoom). O zoom é aplicado em torno da origem (o ponto da câmera).
	scale(zoom);

	// 4. Translação Final: Move o mundo de volta para a posição correta, agora escalada.
	translate(camWorldX, camWorldY);

	// 5. Translação Final de Câmera (ajuste de posicionamento)
	let x = -_poss[0];
	let y = -_poss[1];
	translate(x, y);

	// -------------------------------------------------------------------------
	// Culling (Visibilidade)
	let viewWidth = width / zoom;
	let viewHeight = height / zoom;
	let viewLeft = camWorldX - viewWidth / 2;
	let viewTop = camWorldY - viewHeight / 2;
	let viewRight = camWorldX + viewWidth / 2;
	let viewBottom = camWorldY + viewHeight / 2;

	waitDoMap = true;
	noStroke();

	_map.forEach(chunk => {
		// Verifica se o chunk está visível no viewport atual
		if (!isChunkVisible(chunk, viewLeft, viewRight, viewTop, viewBottom)) {
			return;
		}
		// ... (verificação isChunkVisible) ...

		qtChunksDrawed++;

		// 🛑 PRIORIDADE: 1. Graphics Pronto, 2. Graphics Placeholder
		let graphicToDraw = (chunk.graphics) ? chunk.graphics : chunk.placeholderGraphics;

		if (graphicToDraw) {
			image(
				graphicToDraw,
				chunk.x * tamanho * tamBlock,
				chunk.y * tamanho * tamBlock
			);
		}
	});
	waitDoMap = false;
}
function doMove() {
	fill("#ff000040");
	circle(width / 2, height / 2, 2);
	rect(width / 2 - tamBlock / 2, height / 2 - tamBlock / 2, tamBlock, tamBlock);
}
// do Map
function getColor(biome) { // retorna array RGB por bioma
	switch (biome) { // escolhe cor
		case "deepwater": return [0, 40, 120]; // azul profundo
		case "water": return [0, 80, 180]; // azul claro
		case "sand": return [240, 230, 140]; // areia
		case "grass": return [34, 139, 34]; // grama
		case "stone": return [110, 110, 110]; // pedra
		case "snow": return [255, 255, 255]; // neve
	}
}
function isChunkVisible(chunk, viewLeft, viewRight, viewTop, viewBottom) {
	let chunksize = tamanho * tamBlock;

	// Coordenadas da chunk no mundo
	let chunkStartX = chunk.x * chunksize;
	let chunkStartY = chunk.y * chunksize;

	return (
		chunkStartX + chunksize > viewLeft &&
		chunkStartX < viewRight &&
		chunkStartY + chunksize > viewTop &&
		chunkStartY < viewBottom
	);
}
// draw
function logicChunks() {
	// 1. Calcula o CHUNK CENTRAL atual baseado na posição da câmera (_poss)
	let newChunk = [
		Math.floor(_poss[0] / (tamBlock * tamanho)),
		Math.floor(_poss[1] / (tamBlock * tamanho))
	];
	let order = false; // Flag para indicar se o chunk central mudou

	// Checa se o chunk central mudou
	if (newChunk[0] != _chunk[0] || newChunk[1] != _chunk[1]) {
		_chunk = newChunk;
		document.getElementById("chunk").textContent = _chunk[0] + ", " + _chunk[1];
		order = true;
	}

	// 2. CÁLCULO SENSÍVEL AO ZOOM (Qt de chunks a carregar ao redor do centro)
	// Calcula quantos chunks cabem na metade da tela com o zoom atual, mais uma margem de segurança (2).
	let chunksHalfView = (width / zoom) / (tamanho * tamBlock);
	let qtAdd = Math.ceil(chunksHalfView) - 1;

	let toFind = []; // Lista de coordenadas [x, y] que deveriam existir
	log("lC - 1,2: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();
	// 3. Seleciona os chunks que DEVEM estar na vizinhança (no raio de qtAdd)
	for (let i = _chunk[0] - qtAdd; i <= _chunk[0] + qtAdd; i++) {
		for (let j = _chunk[1] - qtAdd; j <= _chunk[1] + qtAdd; j++) {
			toFind.push({ x: i, y: j });
		}
	}
	log("lC - selecting: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();
	// 4. Limpeza e Verificação (Culling de Memória)
	// Filtra o _map para manter apenas os necessários E remove os chunks já existentes da lista 'toFind'
	_map = _map.filter(chunk => {
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
	log("lC - filtering: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();
	let added = toFind.length > 0;
	if (added) {
		_chunksQueue.push(...toFind);
	}
	log("lC - adding: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();

	// 🛑 6. GARANTE QUE O PROCESSAMENTO DA FILA ESTÁ INICIADO
	if (!isGeneratingChunks && _chunksQueue.length > 0) {
		// setTimeout(()=>{processChunkGenerationQueue();}, 0);
		processChunkGenerationQueue();
	}
	log("lC - processing: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();

	// envia as paradas
	if (toFind.length > 0) {
		const safeMapToSend = _map.map(chunk => {
			return {
				x: chunk.x,
				y: chunk.y,
				chunk: chunk.chunk,
				renderHash: chunk.renderHash
			};
		});
		// Se há muitos chunks novos, adiciona-os em um timeout para não travar
		setTimeout(() => {
			// _map.push(...chunksToAdd); // Adiciona todos os chunks de uma vez

			// 5. Envia ao servidor APÓS a adição
			// Re-executa a lógica de envio APENAS se houve adição
			logServer("Chunks a ser adicionados: " + toFind.length + ". Enviando map-orderChunks" + _map.length + " " + getTime());
			send({ type: "map-orderChunks", id: _id, pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock }, data: safeMapToSend });
		}, 0); // O timeout 0 (ou 1) libera o browser para o próximo frame
	}

	// Se apenas a ORDEM mudou (chunk central), envia imediatamente
	else if (order) {
		const safeMapToSend = _map.map(chunk => {
			return {
				x: chunk.x,
				y: chunk.y,
				chunk: chunk.chunk,
				renderHash: chunk.renderHash
			};
		});
		setTimeout(() => {
			logServer("Apenas Ordem. Enviando map-orderChunks" + _map.length + " " + getTime());
			send({ type: "map-orderChunks", id: _id, pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock }, data: safeMapToSend });
		}, 0);
	}
	log("lC - sending: " + Math.round((new Date() - lastTime)), true);
	lastTime = new Date();
}

// movement
function keyPressing() {
	let move = tamBlock;
	if (keyIsDown('W'.charCodeAt(0))) {
		_poss[1] -= move;
	}
	if (keyIsDown('S'.charCodeAt(0))) {
		_poss[1] += move;
	}
	if (keyIsDown('A'.charCodeAt(0))) {
		_poss[0] -= move;
	}
	if (keyIsDown('D'.charCodeAt(0))) {
		_poss[0] += move;
	}

	if (keyIsDown('O'.charCodeAt(0))) {
		tamBlock += 1;
	}
	if (keyIsDown('L'.charCodeAt(0))) {
		tamBlock += -1;
		if (tamBlock < 1) {
			tamBlock = 1;
		}
	}
}
function touchStarted() {
	// 🛑 ADICIONE A VERIFICAÇÃO DE SEGURANÇA AQUI
	if (touches.length > 0) {
		startedTouch = [touches[0].x, touches[0].y];
	}
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
		startedTouchZoom[0] = [touches[0].x, touches[0].y];
		startedTouchZoom[1] = [touches[1].x, touches[1].y];
		//

	}

	// tamBlock = Math.round(tamBlock); // diminui o bug do dis-zoom
	let stepZoom = 0.5;
	zoom = Math.round(zoom / stepZoom) * stepZoom;
	zoom = Math.max(0.5, zoom);
	zoom = Math.min(32, zoom);
	// tamBlock = Math.ceil(tamBlock);
}

// html/comunication
document.getElementById("newMap").onclick = async () => {
	send({
		type: "map", id: _id, pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock }, data: newMap().map(chunk => {
			return {
				x: chunk.x,
				y: chunk.y,
				chunk: chunk.chunk,
				renderHash: chunk.renderHash
			};
		})
	});
	document.getElementById("checkConnection").textContent = "No connection !";
	const r = await fetch('http://' + ipGeral + ':1234/checkConnection')
	const data = await r.json();
	document.getElementById("checkConnection").textContent = data.msg;
	document.getElementById("seed").textContent = _seed;
};

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
	// hidenator
	let rem = "touches"
	document.getElementById(rem).style.display = "none";
	Array.from(document.getElementsByTagName("th")).filter(e => e.textContent == rem).map(e => e.style.display = "none");

}
function send(msg) {
	msg["time"] = getTime();
	ws.send(JSON.stringify(msg))
}
function erro(code) {
	console.log(code, erros.filter(e => e[0] == code)[0][1]);
	document.getElementById("erro").textContent = code + ": " + msg;
	document.getElementById("erro").style.display = "flex";
}