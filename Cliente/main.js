// constantes
const porta = 3000;
const tamanho = 30;
const coeExpantion = 4;
var tamBlock = 360 / (tamanho * coeExpantion); // 3
// variaveis
var _map = [];
var _seed = 0;
// variaveis de configuração
var _id = 0;
// variaveis de estado
var gotInitialMap = false;
var canAssembleMap = true;
var lastTime = 0,lastTimeFps = 0;
var qtChunksDrawed = 314;
// variaveis moveis
let _chunk = [0, 0];
let _poss = [tamBlock / 2, tamBlock / 2];
// variaveis de Interação
var initializedDoubleTouch = false
var startedTouch = [0, 0];
var startedTouchZoom = [[0, 0], [0, 0]];
//connection
const ws = new WebSocket('ws://192.168.0.14:3000');
// ws.onopen = () => log("Conectado ao servidor!", false);
ws.onmessage = (ev) => {
	const data = JSON.parse(ev.data);
	log("Recebido: " + JSON.stringify(data.type), false);
	processData(data);
};
//
function processData(data) {
	let comms = ["seed"];
	comms.filter(e => e != data.type).forEach(e => logServer(data.type + data.data.length + " " + data.time));
	comms.filter(e => e == data.type).forEach(e => logServer(data.type + " " + data.time));

	switch (data.type) {
		case "map":
			_map = data.data;
			break;
		case "initialMap":
			_map = data.data;
			_id = data.id;
			document.getElementById("id").textContent += " " + _id.split(" ")[0];
			gotInitialMap = true;
			ws.send(JSON.stringify(
				{
					type: "orderChunks",
					id: _id,
					pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock },
					data: _map
				}));
			break;
		case "orderChunks":
			_map = data.data;
			break;
		// configs
		case "seed":
			_seed = data.seed;
			canAssembleMap = true;
			document.getElementById("seed").textContent = _seed;
			break;
		default:
			log("main.js - Tipo de dado desconhecido: " + data.type, false);
	}
}
function setup() {
	const canvas = createCanvas(tamanho * tamBlock * coeExpantion, tamanho * tamBlock * coeExpantion);
	// const canvas = createCanvas(960,960);
	canvas.parent("localCanvas");
	console.log("setup");

	createFreeMap();
	//
}
function draw() {
	log("",false);
	log("init: "+Math.round((new Date() - lastTime)),true);
	lastTime = new Date();
	background(128);
	let x = width / 2 - _poss[0];
	let y = height / 2 - _poss[1];
	translate(x, y);
	log("procs: "+Math.round((new Date() - lastTime)),true);
	lastTime = new Date();
	doMap();
	log("doMap: "+Math.round((new Date() - lastTime)),true);
	lastTime = new Date();
	translate(-x, -y);
	doMove();
	log("move: "+Math.round((new Date() - lastTime)),true);
	lastTime = new Date();
	// fill("#ff000040");
	// rect(width / 2 - tamanho * tamBlock * coeExpantion / 2, height / 2 - tamanho * tamBlock * coeExpantion / 2, tamanho * tamBlock * coeExpantion, tamanho * tamBlock * coeExpantion);
	// circle(width / 2, height / 2,
	// (coeExpantion * tamanho * tamBlock / 2 * Math.pow(2, .5)) * 2);
	//
	if (gotInitialMap) logicChunks();
	log("logicChunks: "+Math.round((new Date() - lastTime)),true);
	lastTime = new Date();
	//
	keyPressing();
	log("key: "+Math.round((new Date() - lastTime)),true);
	lastTime = new Date();
	// end
	depuration();
}

function createFreeMap() {
	_newMap(false);
}
function newMap() {
	// noiseSeed(1234567890);
	console.log("Creating new Map");
	canAssembleMap = false;
	ws.send(JSON.stringify({ type: "formSeed", id: _id }));
	// while (!canAssembleMap) {}
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
	noiseDetail(8, 0.2); // 8,0.5    4,0.5    8,0.2 
	noiseSeed(_seed);
	let vari = 0.1;
	var chunk = [];
	var desconfiguraPatterns = 3141592;
	if (useSeed) {
		for (let i = 0; i < tamanho; i++) {
			chunk.push([]);
			for (let j = 0; j < tamanho; j++) {
				let n = noise((i + x * tamanho + desconfiguraPatterns) * vari, (j + y * tamanho + desconfiguraPatterns) * vari);
				// determina biome let biome = "water"; 
				if (n < 0.25) biome = "deepwater";
				else if (n < 0.35) biome = "water";
				else if (n < 0.40) biome = "sand";
				else if (n < 0.55) biome = "grass";
				else if (n < 0.75) biome = "stone";
				else biome = "snow";
				// cria bloco completo 
				let block = {
					height: n, // altura do ruído 
					biome: biome, // bioma 
					depth: 1 - n, // profundidade 
					hardness: biome === "stone" ? 3 : 1, // dureza 
					color: getColor(biome) // cor 
				};
				chunk[i].push(block);
				// salva objeto
			}
		}
	}
	else {
		let biome = "deepwater";
		let col = getColor(biome);
		let block = {
			height: 0, // altura do ruído 
			biome: biome, // bioma 
			depth: 1, // profundidade 
			hardness: 1, // dureza 
			color: col // cor 
		};
		for (let i = 0; i < tamanho; i++) {
			chunk.push([]);
			for (let j = 0; j < tamanho; j++) {
				chunk[i].push(block);
			}
		}
	}
	return { x: x, y: y, chunk: chunk };
}

function doMap() {
	qtChunksDrawed = 0;
	// O viewport visível (os limites do mundo que estão na tela, em coordenadas do mundo)
	// Canto Superior Esquerdo do mundo que está visível na tela (0,0) do canvas
	// Recalcula o deslocamento aplicado em draw() para determinar o que é visível
	let camX = width / 2 - _poss[0];
	let camY = height / 2 - _poss[1];

	let viewLeft = -camX;
	let viewTop = -camY;
	let viewRight = width - camX;
	let viewBottom = height - camY;

	let drawed = []
	_map.forEach(chunk => {

		if (!isChunkVisible(chunk, viewLeft, viewRight, viewTop, viewBottom)) {
			return;
		}
		qtChunksDrawed++;
		drawed.push([chunk.x,chunk.y])
		for (let i = 0; i < tamanho; i++) {
			for (let j = 0; j < tamanho; j++) {
				noStroke();
				// stroke(1);
				// neve 
				let b = chunk.chunk[i][j];
				// pega bloco 
				fill(b.color);
				// fill([255, 255, 255]);
				// console.log(col); 
				rect((i) * tamBlock + chunk.x * tamBlock * tamanho,
					(j) * tamBlock + chunk.y * tamBlock * tamanho,
					tamBlock, tamBlock);
				// textos
				// fill(0, 255, 0);
				// textSize(tamBlock / 4);
				// text(chunk.x + ", " + chunk.y, i * tamBlock + chunk.x * tamBlock * tamanho + tamBlock / 4, j * tamBlock + chunk.y * tamBlock * tamanho + tamBlock / 4);

				// fill(0, 0, 255);
				// textSize(tamBlock / 4);
				// text(i + ", " + j, i * tamBlock + chunk.x * tamBlock * tamanho + tamBlock / 4, j * tamBlock + chunk.y * tamBlock * tamanho + tamBlock / 2);
			}
		}
	});
	// log("Appear: " + qt, true);
	console.log(drawed);
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

	// 1. Coordenadas da chunk no mundo (sem translate)
	let chunkStartX = chunk.x * chunksize;
	let chunkStartY = chunk.y * chunksize;

	return (
		chunkStartX + chunksize > viewLeft &&      // A borda direita da chunk está à direita do limite esquerdo visível
		chunkStartX < viewRight &&   // A borda esquerda da chunk está à esquerda do limite direito visível
		chunkStartY + chunksize > viewTop &&       // A borda inferior da chunk está abaixo do limite superior visível
		chunkStartY < viewBottom    // A borda superior da chunk está acima do limite inferior visível
	);
}
// draw
function logicChunks() {
	let newChunk = [Math.floor(_poss[0] / (tamBlock * tamanho)), Math.floor(_poss[1] / (tamBlock * tamanho))];
	let order = false;
	if (newChunk[0] != _chunk[0] || newChunk[1] != _chunk[1]) {
		_chunk = newChunk;
		document.getElementById("chunk").textContent = _chunk[0] + ", " + _chunk[1];
		order = true;
	}
	// definition
	let qtAdd = width / (tamanho * tamBlock) - 1;
	let toFind = [];
	// seleciona os q pode adicionar
	for (let i = _chunk[0] - qtAdd; i <= _chunk[0] + qtAdd; i++) {
		for (let j = _chunk[1] - qtAdd; j <= _chunk[1] + qtAdd; j++) {
			toFind.push({ x: i, y: j });
		}
	}
	// remove os q ja tem
	_map.forEach(chunk => {
		for (let i = 0; i < toFind.length; i++) {
			if (chunk.x == toFind[i].x && chunk.y == toFind[i].y) {
				toFind.splice(i, 1);
			}
		}
	});
	// adiciona os q faltam
	let added = false;
	let qtAdded = 0;
	for (let i = 0; i < toFind.length; i++) {
		let chunk = getChunk(toFind[i].x, toFind[i].y, true);
		_map.push(chunk);
		added = true;
		qtAdded++;
	}
	// if (added) logServer("Chunks Adicionados: " + qtAdded);
	// manda pra td mundo
	// if (added && !order) {
	// 	logServer("Chunks Adicionados: " + qtAdded + " - Enviando map" + _map.length+" "+getTime());
	// 	ws.send(JSON.stringify({ type: "map", id: _id, pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock }, data: _map }));
	// }
	if (order || added) {
		logServer("Enviando map-orderChunks" + _map.length + " " + getTime());
		ws.send(JSON.stringify({ type: "map-orderChunks", id: _id, pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock }, data: _map }));
	}
	// else if (added && !order) {
	// 	logServer("Chunks Adicionados: " + qtAdded + " - Enviando map" + _map.length+" "+getTime());
	// 	ws.send(JSON.stringify({ type: "map-orderChunks", id: _id, pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock }, data: _map }));

	// }
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
	startedTouch = [touches[0].x, touches[0].y];
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
	_poss[0] -= touches[0].x - startedTouch[0];
	_poss[1] -= touches[0].y - startedTouch[1];
	startedTouch = [touches[0].x, touches[0].y];

	// zoom
	//att
	//mud
	if (touches.length >= 2) {
		log("no atribuition");
		if (!initializedDoubleTouch) {
			startedTouchZoom[0] = [touches[0].x, touches[0].y];
			startedTouchZoom[1] = [touches[1].x, touches[1].y];
			initializedDoubleTouch = true;
			log("atribuition");
		}
		initializedDoubleTouch = (touches.length >= 2) !== (!initializedDoubleTouch && touches.length >= 2);
		let dist1 = Math.sqrt(Math.pow(touches[0].x - touches[1].x, 2) + Math.pow(touches[0].y - touches[1].y, 2));
		let dist2 = Math.sqrt(Math.pow(startedTouchZoom[0][0] - startedTouchZoom[1][0], 2) + Math.pow(startedTouchZoom[0][1] - startedTouchZoom[1][1], 2));
		tamBlock *= dist1 / dist2;
		startedTouchZoom[0] = [touches[0].x, touches[0].y];
		startedTouchZoom[1] = [touches[1].x, touches[1].y];
	} else {
		initializedDoubleTouch = false;
	}
	tamBlock = Math.max(3, tamBlock);
	tamBlock = Math.min(100, tamBlock);
	tamBlock = Math.ceil(tamBlock);
}

// html/comunication
document.getElementById("newMap").onclick = async () => {
	send(JSON.stringify({ type: "map", id: _id, pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock }, data: newMap() }));
	document.getElementById("checkConnection").textContent = "No connection !";
	const r = await fetch('http://192.168.0.14:1234/checkConnection')
	const data = await r.json();
	document.getElementById("checkConnection").textContent = data.msg;
	document.getElementById("seed").textContent = _seed;
};

document.getElementById("checkConnection").onclick = async () => { // conection
	document.getElementById("checkConnection").textContent = "No connection !";
	const r = await fetch('http://192.168.0.14:1234/checkConnection')
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
function depuration(){
	
	document.getElementById("qtCh.Dr.").textContent = ""+qtChunksDrawed+"/"+_map.length;
	document.getElementById("tamBlock").textContent = Math.round(tamBlock*100)/100;
	document.getElementById("fps").textContent = Math.round(1000/(new Date() - lastTimeFps));
	lastTimeFps = new Date();
	log("dep: "+Math.round((new Date() - lastTime)),true);
	lastTime = new Date();
	
}
function send(msg) {
	msg = JSON.parse(msg);
	msg["time"] = getTime();
	ws.send(JSON.stringify(msg))
}