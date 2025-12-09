loadPixels();
let raio = width;
for (let i = 0; i < tamanho; i++) {
	for (let j = 0; j < tamanho; j++) {
		noStroke();
		//
		// fill(map[i][j] * 255);
		let n = map[i][j];

		// 2. Falloff radial
		let dx = i - width / 2;
		let dy = j - height / 2;
		let distCenter = sqrt(dx * dx + dy * dy) / raio;

		let altura = n - distCenter * 0.7; // 0.7 controla quanta ilha
		let col = color(0);
		//
		if (altura < 0.25) col = color(0, 40, 120);          // oceano profundo
		else if (altura < 0.35) col = color(0, 80, 180);     // água rasa
		else if (altura < 0.40) col = color(240, 230, 140);  // areia
		else if (altura < 0.55) col = color(34, 139, 34);    // grama
		else if (altura < 0.75) col = color(110, 110, 110);  // montanha
		else col = color(255);                              // neve

		// fill(col);
		// console.log(col);
		// rect(i * (width / tamanho), j * (height / tamanho), width / tamanho, height / tamanho);
		let index = (i + j * width) * 4;
		pixels[index] = red(col);
		pixels[index + 1] = green(col);
		pixels[index + 2] = blue(col);
		pixels[index + 3] = 255;
	}
}
updatePixels();