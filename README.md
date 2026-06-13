# Asteroids

Clon del clásico arcade **Asteroids** renderizado con **PixiJS v8 (WebGL)**, sin bundler ni instalación: la única dependencia se carga desde un CDN.

## Demo:

[Asteroids demo](https://ddpadilla.github.io/space-battleship/)

## Descripción

Nave espacial en un campo de asteroides con envolvimiento de bordes (el espacio es toroidal). Destruye asteroides para sumar puntos: los grandes se parten en medianos, los medianos en pequeños. Incluye power-ups, un enemigo "Cazador" que persigue a la nave, fondo de estrellas con parallax y partículas de color.

## Tecnologías

- **PixiJS v8** — renderizado WebGL acelerado por GPU (global `PIXI` vía CDN)
- **JavaScript (ES6+)** — lógica del juego en un solo archivo `game.js`
- Sin frameworks de juego, sin bundler, sin `npm install`

## Cómo correr

Abre `index.html` directamente en el navegador (doble clic, requiere conexión a internet para el CDN), o usa un servidor local:

```bash
npx serve .
```

Luego visita `http://localhost:3000`.

## Controles

| Tecla            | Acción       |
| ---------------- | ------------ |
| `←` `→`          | Rotar nave   |
| `↑`              | Propulsar    |
| `Espacio`        | Disparar     |
| `B` / `Shift`    | Lanzar bomba |

## Power-ups

| Tipo     | Efecto                                         |
| -------- | ---------------------------------------------- |
| `3x`     | Triple disparo temporal                        |
| `B`      | Bomba: onda expansiva que limpia la zona       |
| `M`      | Imán: atrae los power-ups hacia la nave        |
| `+1`     | Vida extra (1UP)                               |

## Puntuación

| Objetivo  | Puntos |
| --------- | ------ |
| Grande    | 20     |
| Mediano   | 50     |
| Pequeño   | 100    |
| Cazador   | 250    |

## Características

- 3 vidas con invencibilidad temporal al reaparecer (parpadeo)
- Asteroides que se parten en fragmentos más pequeños al ser destruidos
- Enemigo "Cazador" con IA de persecución, barra de vida y varios impactos
- Bomba acumulable con onda expansiva que despeja asteroides y daña al Cazador
- Fondo de estrellas con parallax en varias capas
- Partículas de color: explosiones, estela del propulsor y destello de disparo
