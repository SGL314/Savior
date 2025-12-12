import { execSync } from "child_process";

function getWindowsLanIp() {
    try {
        // roda comando ipconfig do Windows (via WSL)
        const output = execSync('cmd.exe /c "ipconfig"').toString();
        // pega o primeiro IPv4 da LAN (192.168.x.x)
        const match = output.match(/IPv4.*:\s*(192\.168\.\d+\.\d+)/);
        if (match) return match[1];
    } catch (err) {
        console.error("Erro ao pegar IP via ipconfig:", err);
    }
    return null;
}

console.log(getWindowsLanIp());
