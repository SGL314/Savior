export function pri(msg) { // comentário ao lado
	console.log(msg);
}; // fim pri

export function getId() {
	const now = new Date();
	const pad = n => n.toString().padStart(2, '0');
	const yyyy = now.getFullYear();
	const mm = pad(now.getMonth() + 1);
	const dd = pad(now.getDate());
	const hh = pad(now.getHours());
	const min = pad(now.getMinutes());
	const ss = pad(now.getSeconds());
	return `${Math.round(Math.random()*255)}-${Math.round(Math.random()*255)}-${Math.round(Math.random()*255)}-${Math.round(Math.random()*255)} ${hh}:${min}:${ss} ${dd}-${mm}-${yyyy}`;
}

export function getDate() {
	const now = new Date();
	const pad = n => n.toString().padStart(2, '0');
	const yyyy = now.getFullYear();
	const mm = pad(now.getMonth() + 1);
	const dd = pad(now.getDate());
	const hh = pad(now.getHours());
	const min = pad(now.getMinutes());
	const ss = pad(now.getSeconds());
	return `${hh}:${min}:${ss} ${dd}-${mm}-${yyyy}`
}

export function getTime() {
	const now = new Date();
	const pad2 = n => n.toString().padStart(2, '0');
	const pad3 = n => n.toString().padStart(3, '0');
	const hh = pad2(now.getHours());
	const min = pad2(now.getMinutes());
	const ss = pad2(now.getSeconds());
	const ms = pad3(now.getMilliseconds());
	return `${hh}:${min}:${ss}.${ms}`
}