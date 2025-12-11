# ====================================================================
# === Configuração Automática de Portas para Acesso Externo ao WSL ===
# ===          Detecta o IP do WSL e configura o netsh.            ===
# ====================================================================

# Lista as portas que você deseja encaminhar
$PORTS = @(1234, 3000)

Write-Host "--- 1. Detectando o IP atual do WSL ---"

# Executa 'hostname -I' dentro do WSL para obter o IP atual
# O .Trim() remove espaços em branco extras
$WSL_IP = (wsl.exe hostname -I).Trim()

if (-not $WSL_IP) {
    Write-Error "ERRO: Não foi possível obter o IP do WSL. Certifique-se de que o WSL está em execução."
    # Pode tentar iniciar o WSL aqui se quiser: wsl.exe -d Ubuntu
    Exit 1
}

Write-Host "IP do WSL detectado: $WSL_IP"
Write-Host ""
Write-Host "--- 2. Configurando Encaminhamento de Portas (netsh) ---"

foreach ($Porta in $PORTS) {
    Write-Host "Limpando regra netsh antiga para a porta $Porta..."
    # Limpa a regra antiga para evitar erros de duplicidade
    netsh interface portproxy delete v4tov4 listenport=$Porta listenaddress=0.0.0.0 | Out-Null
    
    Write-Host "Adicionando regra de encaminhamento para a porta $Porta -> $WSL_IP"
    # Adiciona a nova regra usando o IP DINÂMICO detectado
    netsh interface portproxy add v4tov4 listenport=$Porta listenaddress=0.0.0.0 connectport=$Porta connectaddress=$WSL_IP
}

Write-Host ""
Write-Host "--- 3. Configurando Firewall do Windows (Apenas a primeira vez) ---"

# Adiciona regras de Firewall para permitir que seu celular acesse as portas.
# Verifica se a regra já existe para não criar duplicatas.
foreach ($Porta in $PORTS) {
    $RuleName = "WSL_Port_${Porta}_TCP"
    
    # Remove regras antigas com o mesmo nome para evitar conflitos
    Remove-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue

    Write-Host "Criando regra de Firewall para a porta $Porta..."
    New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -LocalPort $Porta -Protocol TCP -Action Allow -Profile Any
}

Write-Host ""
Write-Host "=== Configuração Concluída ==="
Write-Host "O tráfego de rede está agora encaminhado para o IP $WSL_IP."