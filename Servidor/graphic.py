import math
import matplotlib.pyplot as plt

tamanho = 30
tamanhoMaximo = [3, 1]

R = 20.0   # raio maior (anel)
r = 0.8    # raio menor (tubo)
vari = 0.05 * 100

pks = [[[],[]], [[],[]]]

for x_ in range(tamanhoMaximo[0] * 2):
    x = x_ - tamanhoMaximo[0]
    y = 1

    for i in range(tamanho):
        worldW = tamanhoMaximo[0] * 2 * tamanho
        worldH = tamanhoMaximo[1] * 2 * tamanho

        gx = x * tamanho + i
        ax = gx  # você decidiu usar ax direto como gx

        # valor base (substitui o noise por algo visível)
        tx = ax

        blend = 1
        print(gx)

        if x <= -tamanhoMaximo[0] + 1:
            # 90-(3-1)*30 = 90-60 = 30
            t = (abs(gx)-(tamanhoMaximo[0]-1)*tamanho) / (tamanho*2)
            print("ta:",t)
            blend = 1 / (1 + math.exp(t * 10))
		
        # blend = 1
        if x >= tamanhoMaximo[0] - 2:
            # 90-(3-1)*30 = 90-60 = 30
            t = (gx-(tamanhoMaximo[0]-1)*tamanho) / (tamanho*2)
            print("tb:",t)
            blend = 1 / (1 + math.exp(t * 10))

        tx = tx*vari * blend
        # print("blend:",blend)
        # print(f"{blend:.2f} {tx:.2f}")
        pks[0][0].append(blend)
        pks[0][1].append(len(pks[0][0]) - 1)
        pks[1][0].append(tx)
        pks[1][1].append(len(pks[1][0]) - 1)

plt.plot(pks[0][1], pks[0][0])
plt.plot(pks[1][1], pks[1][0])
plt.axis("equal")
plt.show()
