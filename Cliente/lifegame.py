import numpy as np
import matplotlib.pyplot as plt
import matplotlib.animation as animation

# Configurações iniciais
N = 50  # Tamanho da grade (NxN)
ON = 255
OFF = 0
vals = [ON, OFF]

def update(frameNum, img, grid, N):
    # Cópia da grade para aplicar as regras simultaneamente
    newGrid = grid.copy()
    for i in range(N):
        for j in range(N):
            # Calcula a soma dos 8 vizinhos usando aritmética modular (toroidal)
            total = int((grid[i, (j-1)%N] + grid[i, (j+1)%N] +
                         grid[(i-1)%N, j] + grid[(i+1)%N, j] +
                         grid[(i-1)%N, (j-1)%N] + grid[(i-1)%N, (j+1)%N] +
                         grid[(i+1)%N, (j-1)%N] + grid[(i+1)%N, (j+1)%N]) / 255)

            # Aplicando as regras de Conway
            if grid[i, j] == ON:
                if (total < 2) or (total > 3):
                    newGrid[i, j] = OFF
            else:
                if total == 3:
                    newGrid[i, j] = ON

    # Atualiza a imagem e a grade
    img.set_data(newGrid)
    grid[:] = newGrid[:]
    return img,

# Cria uma grade com estados aleatórios
grid = np.random.choice(vals, N*N, p=[0.2, 0.8]).reshape(N, N)

# Configuração da animação
fig, ax = plt.subplots()
img = ax.imshow(grid, interpolation='nearest', cmap='binary')
ani = animation.FuncAnimation(fig, update, fargs=(img, grid, N),
                              frames=10, interval=50, save_count=50)

plt.show()