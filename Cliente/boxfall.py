from random import randrange as rd
import os
import time as tm

# --- CONFIGURAÇÕES ---
tamW = 20  
tamH = 20  
num_chunks = 3
_map = []

def create(t):
    chs = []
    hei = rd(tamH)
    for i in range(t):
        ch = {'x': i, 'y': 0, 'chunk': []}
        for j in range(tamW):
            blk = []
            for k in range(tamH):
                if k >= hei: blk.append(3)
                else: blk.append(0)
            hei += rd(3) - 1
            if hei > tamH - 2: hei = tamH - 2
            if hei < 5: hei = 5
            ch['chunk'].append(blk)
        chs.append(ch)
    return chs

def colorIt(v):
    match v:
        case 0: return "\033[37;40m  \033[m"
        case 1: return "\033[37;44m  \033[m"
        case 3: return "\033[37;43m  \033[m"
    return "  "

def show():
    output = ""
    for j in range(tamH):
        linha_texto = ""
        for c in range(len(_map)):
            for i in range(tamW):
                linha_texto += colorIt(_map[c]['chunk'][i][j])
        output += linha_texto + "\n"
    print(output)

def process():
    t = 0
    n_chunks = len(_map)
    totalW = tamW * n_chunks
    
    # 1. ESTADO FUTURO UNIFICADO (nCh)
    nCh_global = [[0 for _ in range(tamH)] for _ in range(totalW)]
    
    # 2. COPIAR SÓLIDOS
    for gx in range(totalW):
        c_idx = gx // tamW
        lx = gx % tamW
        for p in range(tamH):
            if _map[c_idx]['chunk'][lx][p] == 3:
                nCh_global[gx][p] = 3

    # 3. PROCESSAR ÁGUA (DE BAIXO PARA CIMA) pt1
    for p in range(tamH - 1, -1, -1):
        ordem_gx = list(range(totalW))
        if rd(2) == 0: ordem_gx.reverse()

        for gx in ordem_gx:
            c_idx = gx // tamW
            lx = gx % tamW
            
            if _map[c_idx]['chunk'][lx][p] != 1:
                continue

            t += 1
            moved = False

            # --- VERIFICAÇÃO DE DESTINO VAZIO (PASSADO E FUTURO) ---
            # Para evitar que '01110' cause empurrões, a água só se move 
            # se o destino for 0 no mapa que estamos lendo E no que estamos escrevendo.

            # 1. ABAIXO
            if p < tamH - 1:
                if _map[gx//tamW]['chunk'][gx%tamW][p+1] == 0 and nCh_global[gx][p+1] == 0:
                    nCh_global[gx][p+1] = 1
                    moved = True

            # 2. DIAGONAIS ABAIXO
            if not moved and p < tamH - 1:
                dirs = [-1, 1]
                if rd(2) == 0: dirs.reverse()
                for d in dirs:
                    tx = gx + d
                    if 0 <= tx < totalW:
                        if _map[tx//tamW]['chunk'][tx%tamW][p+1] == 0 and nCh_global[tx][p+1] == 0:
                            nCh_global[tx][p+1] = 1
                            moved = True
                            break

            # 3. LATERAIS (Nivelamento)
            if not moved:
                dirs = [-1, 1]
                if rd(2) == 0: dirs.reverse()
                for d in dirs:
                    tx = gx + d
                    if 0 <= tx < totalW:
                        # Só move se o vizinho lateral estiver vazio AGORA
                        if _map[tx//tamW]['chunk'][tx%tamW][p] == 0 and nCh_global[tx][p] == 0:
                            nCh_global[tx][p] = 1
                            moved = True
                            break

            # 4. FICAR PARADO (CONSERVAÇÃO RÍGIDA)
            if not moved:
                # Se não conseguiu se mover para um lugar VAZIO, 
                # ela obrigatoriamente tenta manter a posição original.
                if nCh_global[gx][p] == 0:
                    nCh_global[gx][p] = 1
                else:
                    # Se até a posição original foi tomada (por alguém de cima caindo),
                    # aí ela procura o primeiro buraco pra cima apenas para não sumir.
                    tp = p - 1
                    while tp >= 0:
                        if nCh_global[gx][tp] == 0:
                            nCh_global[gx][tp] = 1
                            break
                        tp -= 1
                        
     # 4. DEVOLVER OS DADOS
    for gx in range(totalW):
        c_idx = gx // tamW
        lx = gx % tamW
        _map[c_idx]['chunk'][lx] = nCh_global[gx]
    
     # 4. DEVOLVER OS DADOS
    for gx in range(totalW):
        c_idx = gx // tamW
        lx = gx % tamW
        _map[c_idx]['chunk'][lx] = nCh_global[gx]
    
    # 1. ESTADO FUTURO UNIFICADO (nCh)
    nCh_global = [[0 for _ in range(tamH)] for _ in range(totalW)]
    
    # 2. COPIAR SÓLIDOS
    for gx in range(totalW):
        c_idx = gx // tamW
        lx = gx % tamW
        for p in range(tamH):
            if _map[c_idx]['chunk'][lx][p] == 3:
                nCh_global[gx][p] = 3
    
    # 3. PROCESSAR ÁGUA (DE BAIXO PARA CIMA) pt 2
    for p in range(tamH - 1, -1, -1):
        ordem_gx = list(range(totalW))
        if rd(2) == 0: ordem_gx.reverse()

        for gx in ordem_gx:
            c_idx = gx // tamW
            lx = gx % tamW
            
            if _map[c_idx]['chunk'][lx][p] != 1:
                continue

            t += 1
            moved = False

            # --- VERIFICAÇÃO DE DESTINO VAZIO (PASSADO E FUTURO) ---
            # Para evitar que '01110' cause empurrões, a água só se move 
            # se o destino for 0 no mapa que estamos lendo E no que estamos escrevendo.

            # 1. ABAIXO
            if p < tamH - 1:
                if _map[gx//tamW]['chunk'][gx%tamW][p+1] == 0 and nCh_global[gx][p+1] == 0:
                    nCh_global[gx][p+1] = 1
                    moved = True

            # 2. DIAGONAIS ABAIXO
            if not moved and p < tamH - 1:
                dirs = [-1, 1]
                if rd(2) == 0: dirs.reverse()
                for d in dirs:
                    tx = gx + d
                    if 0 <= tx < totalW:
                        if _map[tx//tamW]['chunk'][tx%tamW][p+1] == 0 and nCh_global[tx][p+1] == 0:
                            nCh_global[tx][p+1] = 1
                            moved = True
                            break

            # # 3. LATERAIS (Nivelamento)
            # if not moved:
            #     dirs = [-1, 1]
            #     if rd(2) == 0: dirs.reverse()
            #     for d in dirs:
            #         tx = gx + d
            #         if 0 <= tx < totalW:
            #             # Só move se o vizinho lateral estiver vazio AGORA
            #             if _map[tx//tamW]['chunk'][tx%tamW][p] == 0 and nCh_global[tx][p] == 0:
            #                 nCh_global[tx][p] = 1
            #                 moved = True
            #                 break

            # 4. FICAR PARADO (CONSERVAÇÃO RÍGIDA)
            if not moved:
                # Se não conseguiu se mover para um lugar VAZIO, 
                # ela obrigatoriamente tenta manter a posição original.
                if nCh_global[gx][p] == 0:
                    nCh_global[gx][p] = 1
                else:
                    # Se até a posição original foi tomada (por alguém de cima caindo),
                    # aí ela procura o primeiro buraco pra cima apenas para não sumir.
                    tp = p - 1
                    while tp >= 0:
                        if nCh_global[gx][tp] == 0:
                            nCh_global[gx][tp] = 1
                            break
                        tp -= 1
    
    
    # 4. DEVOLVER OS DADOS
    for gx in range(totalW):
        c_idx = gx // tamW
        lx = gx % tamW
        _map[c_idx]['chunk'][lx] = nCh_global[gx]
        
    return t
# --- EXECUÇÃO ---
_map = create(num_chunks)

# Adicionando água em níveis diferentes para testar preenchimento
for i in range(12):
    for j in range(10):
        c_idx = i // tamW
        lx = i % tamW
        _map[c_idx]['chunk'][lx][j] = 1

try:
    while True:
        qtd = process()
        print("\033[H", end="")
        print(f"Quantidade de Água: {qtd}    ") # Espaços extras limpam rastro de números maiores
        show()
        tm.sleep(0.05)
        os.system("clear")
except KeyboardInterrupt:
    pass