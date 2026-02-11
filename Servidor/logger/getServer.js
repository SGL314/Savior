// document.getElementById("newMap").onclick = async () => {
// 	send({ type: "map", id: _id, pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock }, data: newMap() });
// 	document.getElementById("checkConnection").textContent = "No connection !";

// 	const data = await r.json();
// 	document.getElementById("checkConnection").textContent = data.msg;
// 	document.getElementById("seed").textContent = _seed;
// };
// consts
const ipGeral = "192.168.0.11";
//
var tamanho = -1,seed = -1;
var clientes = [];
var things = {a:'0'};
//
function run() {
	depuration();
	// recursion
	setTimeout(() => { run() }, 100);
}
function depuration() {

	// // document.getElementById("qtCh.Dr.").textContent = "" + qtChunksDrawed + "/" + _map.length;
	// // document.getElementById("zoom").textContent = zoom;
	// // document.getElementById("fps").textContent = Math.round(1000 / (new Date() - lastTimeFps));
	// lastTimeFps = new Date();
	// log("dep: " + Math.round((new Date() - lastTime)), true);
	// lastTime = new Date();
	// // document.getElementById("touches").textContent = touches.length;
	// // tocuhes
	// // try{
	// // document.getElementById("th1").textContent = ""+touches[0].x+", "+touches[0].y;
	// // document.getElementById("th2").textContent = ""+touches[1].x+", "+touches[1].y;
	// // document.getElementById("d1").textContent = touches.length;
	// // document.getElementById("d2").textContent = touches.length;
	// // }catch (e) {}
	// // hidenator
	// let rem = "touches"
	// document.getElementById(rem).style.display = "none";
	// Array.from(document.getElementsByTagName("th")).filter(e => e.textContent == rem).map(e => e.style.display = "none");
	document.getElementById("tamanho").textContent = tamanho;
	document.getElementById("seed").textContent = seed;
	// Array.from(document.getElementsByTagName("th")).filter(e => e.textContent == rem).map(e => e.style.display = "none");	
	document.getElementById("clientes").textContent = clientes.map(c=>c.id.split(" ")[0]).join("\n");
	let txt = "";
	for (let item of Object.keys(things)) {
		txt += item+": "+things[item]+"\n";
	}
	document.getElementById("things").textContent = txt;
}
async function getAll() {
	let respJs = await fetch('http://' + ipGeral + ':3141/getAll');
	let resp = await respJs.json();
	tamanho = resp.tamanho;
	clientes = resp.clientes;
	things = resp.things;
	seed = resp.seed;
	setTimeout(() => { getAll() }, 50);
}
// runner
run();
getAll();
// sending
document.getElementById("newMap").onclick = async () => {
	// send({ type: "map", id: _id, pos: { x: _poss[0] / tamBlock, y: _poss[1] / tamBlock }, data: newMap() });
	// document.getElementById("checkConnection").textContent = "No connection !";
	let respJs = await fetch('http://' + ipGeral + ':3141/newMap');
	// const data = await r.json();
	// document.getElementById("checkConnection").textContent = data.msg;
	// document.getElementById("seed").textContent = _seed;
};