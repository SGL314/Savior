import fs from "fs";

const texto = fs.readFileSync("arquivo.txt", "utf8");
console.log(texto);


import express from "express";

const app = express();
app.get("/", (req, res) => res.send("Olá Node!"));
app.listen(3000);
