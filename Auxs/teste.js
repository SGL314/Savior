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

var initPos = {x: 0, y: 0};

function compareChunksByDistance(a, b) {
	// Calcula a distância de Manhattan para a chunk 'a' 
	const distA = Math.pow(Math.pow(a.x-initPos.x,2) + Math.pow(a.y-initPos.y,2),.5);

	// Calcula a distância de Manhattan para a chunk 'b'
	const distB = Math.pow(Math.pow(b.x-initPos.x,2) + Math.pow(b.y-initPos.y,2),.5);

	// Se a diferença for negativa, A (mais perto) vem antes de B.
	// Se a diferença for positiva, B (mais perto) vem antes de A.
	return distA - distB;
}

// ----------------------------------------------------------------

// Exemplo de Chunks Iniciais e Novas
const initialChunks = [
	{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 },
	{ x: 1, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 2 },
	{ x: 2, y: 0 }, { x: 2, y: 1 }, { x: 2, y: 2 }
];

const newChunksToLoad = [
	{ x: -1, y: -1 },
	{ x: -1, y: 0 },
	{ x: -1, y: 1 },
	{ x: 0, y: -1 },
	{ x: 1, y: -1 },
];

// O seu array a ser ordenado seria a combinação de todas elas (ou apenas as novas se o resto já estiver carregado)
const allChunks = [...initialChunks, ...newChunksToLoad];

// Supondo que você use a função quickSort definida anteriormente:
const sortedChunks = quickSort(allChunks, compareChunksByDistance);

console.log("Chunks Ordenadas por Distância (0,0):");
/*
Saída Esperada:
(0, 0) - D=0
(0, 1), (1, 0), (0, -1), (-1, 0) - D=1
(0, 2), (1, 1), (2, 0), (-1, -1), etc. - D=2
*/
console.log(sortedChunks.map(c => `(${c.x}, ${c.y}) - Distância: ${compareChunksByDistance(c, initPos)}`));