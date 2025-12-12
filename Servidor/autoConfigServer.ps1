# ====================================================================
# === Configuracao Automatica de Portas para Acesso Externo ao WSL ===
# ====================================================================

$PORTS = @(1234, 3000)

# Obtem o IP INTERNO do WSL (172.x.x.x)
$WSL_IP_ALL = (wsl.exe -d Ubuntu -u root hostname -I 2>$null | Select-Object -First 1).Trim()
$WSL_IP = $WSL_IP_ALL.Split(" ")[0]

# Obtem o IP EXTERNO (LAN) do Windows (192.168.x.x)
$HostIP = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias * -ErrorAction SilentlyContinue |
    Where-Object {
        $_.PrefixOrigin -eq 'Dhcp' -and 
        $_.AddressState -eq 'Preferred' -and 
        $_.IPAddress -notlike "169.254.*"
    } | Select-Object -ExpandProperty IPAddress -First 1

if (-not $WSL_IP -or $WSL_IP -eq "") {
    Exit 1
}

# Configurando Encaminhamento de Portas (netsh)
foreach ($Porta in $PORTS) {
    netsh interface portproxy delete v4tov4 listenport=$Porta listenaddress=0.0.0.0 2>$null | Out-Null
    netsh interface portproxy add v4tov4 listenport=$Porta listenaddress=0.0.0.0 connectport=$Porta connectaddress=$WSL_IP | Out-Null
}

# Configurando Firewall do Windows
foreach ($Porta in $PORTS) {
    $RuleName = "WSL_Port_${Porta}_TCP"
    Remove-NetFirewallRule -DisplayName $RuleName -ErrorAction SilentlyContinue 2>$null | Out-Null
    New-NetFirewallRule -DisplayName $RuleName -Direction Inbound -LocalPort $Porta -Protocol TCP -Action Allow -Profile Any | Out-Null
}