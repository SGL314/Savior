import { parentPort, workerData } from 'worker_threads';
var initPos = { x: 0, y: 0 };
function quickSort(arr, comparator) {
	// Caso base: arrays com 0 ou 1 elemento já estão ordenados
	if (arr.length <= 1) {
		return arr;
	}

	// 1. Escolher um Pivô (Escolhemos o elemento do meio para simplicidade)
	const pivotIndex = Math.floor(arr.length / 2);
	const pivot = arr[pivotIndex];

	// 2. Particionar o array
	const less = [];    // Elementos que vêm antes do pivô
	const greater = []; // Elementos que vêm depois do pivô
	const equal = [];   // Elementos iguais ao pivô (opcional, mas bom para estabilidade)

	for (let i = 0; i < arr.length; i++) {
		const item = arr[i];
		const comparisonResult = comparator(item, pivot);

		if (comparisonResult < 0) {
			less.push(item);
		} else if (comparisonResult > 0) {
			greater.push(item);
		} else {
			// Inclui o pivô e elementos iguais no array 'equal'
			equal.push(item);
		}
	}

	// 3. Combinar os resultados recursivamente
	// [quickSort(menos)] + [iguais/pivô] + [quickSort(maiores)]
	return [
		...quickSort(less, comparator),
		...equal,
		...quickSort(greater, comparator)
	];
}

function compareChunksByDistance(a, b) {
	// Calcula a distância de Manhattan para a chunk 'a' 
	const distA = Math.pow(Math.pow(a.x-initPos.x,2) + Math.pow(a.y-initPos.y,2),.5);

	// Calcula a distância de Manhattan para a chunk 'b'
	const distB = Math.pow(Math.pow(b.x-initPos.x,2) + Math.pow(b.y-initPos.y,2),.5);

	// Se a diferença for negativa, A (mais perto) vem antes de B.
	// Se a diferença for positiva, B (mais perto) vem antes de A.
	return distA - distB;
}

// 1. O código do Worker começa a executar aqui.
// 'workerData' contém o objeto passado na criação da thread.
try {
    const dataFromMain = workerData;
	// console.log(JSON.stringify(dataFromMain.map.length));
	var result = "-nada-";
    
    // 2. Executa a tarefa demorada
	switch (dataFromMain.type) {
		case "orderChunks":
			initPos = dataFromMain.pos;
			var result = quickSort(dataFromMain.map, compareChunksByDistance);
			// console.log(result.map(c => `(${c.x}, ${c.y}) - Distância: ${compareChunksByDistance(c, initPos)}`))
			break;
	}    

    // 3. Envia o resultado de volta para a Thread Principal
    if (parentPort) {
        parentPort.postMessage(result);
    }

} catch (error) {
    console.error("Erro fatal na Worker Thread:", error);
    
    // 4. Em caso de erro, notifica a Thread Principal
    if (parentPort) {
        parentPort.postMessage({ 
            status: "error", 
            message: error.message 
        });
    }
}