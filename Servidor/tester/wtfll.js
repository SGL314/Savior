// import express from "express";
// import { pri, getId, getDate, getTime } from "../../Auxs/auxiliar.js";
// import path from "path";
// import { Worker } from "worker_threads";
// import os from "os";
// import { exec } from "child_process";
//
const ipGeral = "192.168.0.15"; //10.96.160.102
const porta = 3000;
const tamanho = 30;
const coeExpantion = 4;
const FPS_LIMIT = 20;
const FRAME_TIME_MS = 1000 / FPS_LIMIT;
var tamBlock = 360 / (tamanho * coeExpantion); // 3*2
//
const tamanhoMaximo = [2, 1]; // 40,20 // 40,20
//
var _map = [];
var _seed = 2906;
//// variaveis de configuração
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
let _chunk = [10, 0];
let _poss = [tamBlock / 2, tamBlock / 2];
_poss[0] += 11 * tamBlock + 0*tamanho * tamBlock;  // teste
_poss[1] += 20 * tamBlock;   // teste
var zoom = 2, initZoom = 1; // tudo 1
// variaveis de iteração
var initializedDoubleTouch = false
var startedTouch = [0, 0];
var startedTouchZoom = [[0, 0], [0, 0]];
//connection
// process
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

			chunkGraphics = createGraphics(chunkSizePx, chunkSizePx);
			chunkGraphics.noStroke();

			// 🛑 CÓDIGO DE DESENHO COMPLETO INCLUÍDO AQUI
			for (let i = 0; i < tamanho; i++) {
				let blocks = chunk.chunk[i];
				let draws = drawBlock(blocks);
				for (let k = 0; k < draws.length; k++) { // 20 paradas
					if (i == 0 || i == tamanho - 1) chunkGraphics.stroke(1);
					else chunkGraphics.noStroke();
					chunkGraphics.fill(draws[k][2]); // 2: é a cor propriamente dita
					chunkGraphics.rect(i * tamBlock, (draws[k][0] - draws[k][1]) * tamBlock / (stepDefaultMetters * coeExpantionToMetters), tamBlock, tamBlock * draws[k][1] / (stepDefaultMetters * coeExpantionToMetters));
				}
			}
			// 🛑 FIM DO CÓDIGO DE DESENHO COMPLETO
			// console.log("(" + _chunksToRecreateQueue.length + ") layerress: " + chunk.x);
			// console.log(chunk, chunkGraphics);
			if (!chunk.graphics) chunk.graphics = chunkGraphics;
			else {
				chunk.graphics = chunkGraphics;
				// console.log("Recriado gráfico layer " + layer + " para chunk (" + chunk.x + ")");
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
			if (c.x === chunk.x) {
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
//
function setup() {
	const canvas = createCanvas(tamanho * tamBlock * coeExpantion, tamanho * tamBlock * coeExpantion);
	// const canvas = createCanvas(960,960);
	canvas.parent("localCanvas");
	console.log("setup");
	_map = newMap();
	defineButtons();
	main();
}
function draw() {
	background("#979797ff");
	push();
	doMap();
	pop();
	//
	logicChunks(false);
	keyPressing();
	//
	doMove();
	buttons();
}
//
function doMap() {
	tChunksDrawed = 0;

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

	_map.map(chunk => {
		image(
			chunk.graphics,
			chunk.x * tamanho * tamBlock,
			chunk.y * tamanho * tamBlock
		);
	})
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
// create

function newMap() {
	// noiseSeed(1234567890);
	console.log("Creating new Map");
	canAssembleMap = false;
	// send({ type: "formSeed", id: _id });
	return _newMap(true);
}
function _newMap(useSeed) {
	log("Creating " + useSeed);
	let map = [];
	for (let i = -(tamanhoMaximo[0] - 1); i <= tamanhoMaximo[0] - 1; i++) {
		for (let j = -(tamanhoMaximo[1] - 1); j <= tamanhoMaximo[1] - 1; j++) {
			let chunk = getChunk(i, j, useSeed);
			map.push(chunk);
		}
	}
	return map;
}
function getChunk(x,y, useSeed) {
	// 1. Configurações de Perlin Noise
	noiseDetail(8, 0.2);
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
	let chunkGraphics = createGraphics(chunkSizePx, 1 / (stepDefaultMetters) * tamBlock);
	chunkGraphics.noStroke();
	// console.log(chunkGraphics.length);
	if (useSeed) {
		for (let i = 0; i < tamanho; i++) {
			chunk.push([]);
			// 1. Definições do Mapa
			let gx = x * tamanho + i;

			// 2. Coordenadas Angulares (0 a 2PI)
			let ax = gx;

			// Coordenadas originais do Toro
			// Isso mapeia o 2D para a superfície de um donut em 3D
			let n = noise(
				ax * vari + desconfiguraPatterns[0],
				// finalZ * vari
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
			//
			let gapTerrenoAcima = 10; // addIt

			switch (thing) { 
				case "water":
					let m = (tWater - n) * coeExpantionToMetters;
					let total = tWater * coeExpantionToMetters;
					let colorWater = getColorByProf("water", m, total);
					blocks = [
						{ // sem agua no começo
							height: m,
							depth: 0,
							thing: thing,
							hardness: 1,
							color: colorWater
						},
						{
							height: (0.1) * coeExpantionToMetters,
							depth: Math.round(m * variMin) / variMin,
							thing: "sand",
							hardness: 1,
							color: getColor("sand")
						}
					];
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
				height: (100 - (initDepth + l1)),
				depth: initDepth + l1,
				thing: "rock",
				hardness: 5,
				color: getColor("rock")
			});
			//

			chunk[i] = blocks;

			// Desenha o bloco no buffer gráfico
			console.log(blocks);
			let draws = drawBlock(blocks);
			for (let k = 0; k < draws.length; k++) { // 20 paradas
				if (i == 0 || i == tamanho - 1) chunkGraphics.stroke(1);
				else chunkGraphics.noStroke();
				chunkGraphics.fill(draws[k][2]);
				chunkGraphics.rect(i * tamBlock, (draws[k][0] - draws[k][1]) * tamBlock / (stepDefaultMetters * coeExpantionToMetters), tamBlock, tamBlock * draws[k][1] / (stepDefaultMetters * coeExpantionToMetters));
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
	console.log(chunk);
	const hashValue = calculateRenderHash(chunk);

	return {
		x: x,
		y: y,
		chunk: chunk,
		graphics: chunkGraphics,
		renderHash: hashValue, // 🛑 NOVO: Inclui o hash no objeto do chunk
		atualized: true
	};
}
function calculateRenderHash(chunkData) {
	let hash = 0;
	// Percorre apenas os dados que definem a aparência
	console.log(chunkData);
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
		case "fundoTransparente": return [0, 0, 0, 0];
		case "-nada-": return [255, 128, 255, 128]; // nada
		default: return [255, 0, 255, 255]; // nada mesmo
	}
}
function getColorByProf(thing, m, total) {
	console.log(m, total);
	let colorWater = getColor(thing);
	return [colorWater[0],
	(getColor("-shallowwater")[1] - colorWater[1]) * (1 - m / total) + colorWater[1],
	(getColor("-shallowwater")[2] - colorWater[2]) * (1 - m / total) + colorWater[2],
		255];
}
function drawBlock(blocks) {
	let finalColors = [];
	let found = false;
	for (let j = 0; j < blocks.length; j++) {
		// console.log(blocks[j].depth + blocks[j].height);
		finalColors.push([blocks[j].depth + blocks[j].height, blocks[j].height, blocks[j].color]);
	}
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

// 

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
					keyChunk: { x: chunk.x },
					localChunk: { x: x },
					localBlock: 0,
					what: {
						height: stepDefaultMetters * coeExpantionToMetters,
						depth: (rawY - 20) * stepDefaultMetters * coeExpantionToMetters, // addIt : era o 'metters'
						thing: selectPutting,
						hardness: 1,
						color: getColor(selectPutting)
					}
				};
				// console.log("put in: "+(rawY-20)*stepDefaultMetters * coeExpantionToMetters)
				// setTimeout(() => {
				// 	send({
				// 		type: "addInMap", id: _id,
				// 		data: sendIt
				// 	})
				// }, 0);
				// simula recebimento
				simulateMergeChunks(sendIt);
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
function simulateMergeChunks(sendIt) {
	let chunkAtt = null;
	_map.map(c => {
		if (c.x == sendIt.keyChunk.x) {
			// Adiciona o novo bloco na posição correta dentro da chunk
			chunkAtt = c;
			switch (sendIt.localBlock) {
				case 0:
					c.chunk[sendIt.localChunk.x].unshift(sendIt.what);
					break;
				default:
					erro("Tipo de localBlock desconhecido: " + sendIt.localBlock);
			}
		}
	});
	//
	let antes = chunkAtt.chunk[sendIt.localChunk.x];
	// if (antes == null) {
	// 	erro("Chunk não encontrado para atualização --addInMap:" + JSON.stringify(chunkAtt.atualized) + "\n" + JSON.stringify(chunkAtt.x) + "\n" + JSON.stringify(chunkAtt.renderHash));
	// }
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
	chunkAtt.chunk[sendIt.localChunk.x] = novo;
	_chunksToRecreateQueue.push(chunkAtt);
	if (!isRecreatingGraphics) {
		setTimeout(() => { processGraphicsQueue(0) }, 0);
	}
}
function simulateAttChunks(data) {
	// let data = chunks.map(c => ({
	// 				keyChunk: { x: c.x },
	// 				chunk: c
	// 			}));
	let chunkAtt = null;
	_map.map(c => {
		for (let chunk of data) {
			if (c.x == chunk.keyChunk.x) {
				// Adiciona o novo bloco na posição correta dentro da chunk
				chunkAtt = c;
				c = chunk.chunk;
				// console.log("attCHunks (" + chunk.keyChunk.x + ")");
			}
		}
	});
	_chunksToRecreateQueue.push(chunkAtt);
	if (!isRecreatingGraphics) {
		setTimeout(() => { processGraphicsQueue(0) }, 0);
	}
	//
	// let antes = chunkAtt.chunk[sendIt.localChunk.x];

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

// auxs

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
function send(msg) {
	msg["time"] = getTime();
	ws.send(JSON.stringify(msg))
}


// WATERFALL


var processingInMain = {
	"waterfall": false,

};
function main() {
	// return;
	if (!processingInMain["waterfall"]) {
		processingInMain["waterfall"] = true;
		setTimeout(async () => { // com bugs
			// try { console.log("in: " + JSON.stringify(_map.filter(c => c.x == 0)[0].chunk[21])); } catch (e) { }
			let ret = await waterfall();
			if (ret.length > 0) {
				// console.log("---waterfall--- "+JSON.stringify(_map.filter(c=>c.x==0 && c.y==0)[0].chunk[23][23]));
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
					keyChunk: { x: c.x },
					chunk: c
				}));
				// broadcast({ type: "attChunks", data: data });
				simulateAttChunks(data);
				//
				let txt = "";
				let t = 0;
				let vt = 0;
				let variMin = 10;
				data.map(c => {
					let chunk = c.chunk;
					for (let blk of chunk.chunk) {
						if (!JSON.stringify(blk).includes("water")) continue;
						for (let i = 0; i < blk.length; i++) {
							let b = blk[i];
							if (b.thing == "water") {
								t++;
								b.height = Math.round(b.height * variMin) / variMin;
								b.depth = Math.round(b.depth * variMin) / variMin;

								vt += b.height;
								txt += t + "(" + chunk.chunk.indexOf(blk) + "): " + JSON.stringify(b) + " - ";
								txt += " " + JSON.stringify(blk[i + 1]) + "\n";
							} else if (i > 0 && blk[i - 1].thing == "water") {
							}


						}

					}
				});
				txt += "\n---: " + JSON.stringify(data[0].chunk.chunk[7]) + "\n";
				txt += "\nvt: " + vt;
				let k = (vt != 5 && vt != 5.000000000000001 && vt != 4.999999999999999
					&& vt != 4.999999999999998
				) ? "\x1b[34m" : "";
				// console.log(k + txt);

			}
			processingInMain["waterfall"] = false;
		});
	}
	setTimeout(main, 16.6666 * 6);
}
var repeatWaterfall = 20;

async function waterfall() {
	if (repeatWaterfall <= 0) return;
	// ordenar antes de waterfall
	let changes = [];
	// let mapCopied = _map.copyWithin(_map.length,0);
	_map.map(chunk => {
		let variMin = 10;
		let change = false;
		let tam = chunk.chunk.length;
		for (var i = 0; i < chunk.chunk.length; i++) {
			let blocks = chunk.chunk[i];
			let indsRemove = [];
			for (var a = 0; a < blocks.length - 1; a++) { // -1 pra não ser o ultimo
				// if (chunkEqKey(chunk, "0") && i == 21) console.log("going-pre-inner(" + i + "): " + JSON.stringify(chunk.chunk[i]));
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
					} else if (blocks[a + 1].depth > p) { // cabe parcialmente
						let cab = blocks[a + 1].depth - p;
						blocks[a].depth += cab;
						// console.log("down parcial");
						change = true;
					} else if (blocks[a + 1].thing == "water") { // aglutinate water
						blocks[a].height += blocks[a + 1].height;
						blocks.splice(a + 1, 1);
						// console.log("aglutinate");
						change = true;
					} else { // splash water

						// console.log("splash")
						// getting 
						let init_ = [{ i: i }]
						let adjs = [];
						if (i > 0) {
							adjs.push({ i: i - 1 });
						}
						if (i < tam - 1) {
							adjs.push({ i: i + 1 });
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


						// getting
						let holes = []
						for (let ad of adjs) {
							if (chunk.chunk[ad.i].length > 0) {
								holes.push({ i: ad.i });
							}
						}
						// verify se tem q ficar quieto
						let ver = [{
							block: chunk.chunk[i],
							pos: { i: i }
						}];
						holes.map(b => {
							ver.push({
								block: chunk.chunk[b.i],
								pos: { i: b.i }
							});
						});
						// console.log(ver);
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
												chunk.chunk[b.pos.i] = b.block;
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
							levels.push({ h: 0 * variMin, d: chunk.chunk[h.i][0].depth * variMin, p: { i: h.i } });
						}
						// ordena
						levels.sort((a, b) => b.d - a.d);
						// console.log("init: ");
						// console.log(JSON.stringify(levels));
						// leveller
						let thisRepeat = 5;
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
										levels[b].h += dif / qt;
									}
								} else {
									let r = (dif - dif % qt) / qt;
									for (let b of mins) {
										change = true;
										levels[b].h += r;
									}
									// distribui o resto
									r = dif % qt;
									for (let b of mins) {
										if (r == 0) break;
										change = true;
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
									for (let b of mins) {
										if (v == 0) break;
										levels[b].h += r;
										v -= r;
									}
								} else {
									change = true;
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
									chunk.chunk[l.p.i].unshift(base);
									// console.log(l.p.i + ": " + JSON.stringify(chunk.chunk[l.p.i]));
								}
							}
						}


						//
						// if (chunkEqKey(chunk, "0") && i == 21) console.log("going-pre-inner(" + i + "): " + JSON.stringify(chunk.chunk[i]));
					}
					blocks[a].color = getColorByProf("water", blocks[a].height, stepDefaultMetters*7*coeExpantionToMetters)
					if (change) break;
				}
				// cores
			}
			// if (chunkEqKey(chunk, "0") && change && i == 21) {
			// 	// console.log("going-pre: " + JSON.stringify(chunk.chunk[i]));
			// }
			chunk.chunk[i] = blocks;
			if (change) {
				// console.log("fn ("+i+"):"+countWater(0, chunk));
				let idN = Math.round(Math.random() * 100);
				// console.log('>m-ret ' + idN);
				// miniRet([{
				// 	key: { x: chunk.x }
				// }], idN);
				// console.log('<m-ret ('+JSON.stringify(indsRemove)+')' + JSON.stringify(chunk.chunk[5])+ JSON.stringify(chunk.chunk[6])+ JSON.stringify(chunk.chunk[7]));
			}
			for (let ind = 0; ind < blocks.length; ind++) {
				if (chunk.chunk[i][ind].thing == "water" && chunk.chunk[i][ind].height == 0) chunk.chunk[i].splice(ind, 1);
			}
			// if (change){
			// 	console.log("r-fn ("+i+"):"+countWater(0, chunk));
			// 	console.log('<m-ret ('+JSON.stringify(indsRemove)+')' + JSON.stringify(chunk.chunk[5])+ JSON.stringify(chunk.chunk[6])+ JSON.stringify(chunk.chunk[7]));

			// }
		}
		if (change) {
			changes.push({
				key: { x: chunk.x }
			});
		}
		// //
		// let txt = "";
		// let t = 0;
		// let vt = 0;
		// for (let blk of chunk.chunk) {
		// 	if (!JSON.stringify(blk).includes("water")) continue;
		// 	for (let i = 0; i < blk.length; i++) {
		// 		let b = blk[i];
		// 		if (b.thing == "water") {
		// 			t++;
		// 			b.height = Math.round(b.height * variMin) / variMin;
		// 			b.depth = Math.round(b.depth * variMin) / variMin;

		// 			vt += b.height;
		// 			txt += t + "(" + chunk.chunk.indexOf(blk) + "): " + JSON.stringify(b) + " - ";
		// 			txt += " " + JSON.stringify(blk[i + 1]) + "\n";
		// 		} else if (i > 0 && blk[i - 1].thing == "water") {
		// 			// txt +=  "---: " + JSON.stringify(b) + "\n";
		// 		}


		// 	}

		// }
		// txt += "\nvt: " + vt;
		// console.log(txt);
		// return;
		// repeatWaterfall-=1;


	});
	//
	// console.log("\x1b[31m returning");
	return changes;
}
// auxs
function makeWaterBlock(h, d) {
	return {
		height: h,
		depth: d,
		thing: "water",
		hardness: 1,
		color: getColorByProf("water", h, stepDefaultMetters*7*coeExpantionToMetters)
	};
}
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