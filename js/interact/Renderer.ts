import { Board } from "../objects/Board";
import { BoardSize } from "../objects/BoardSize";
import { Coords } from "../objects/Coords";
import { Player } from "../objects/Player";
import { Tile } from "../objects/Tile";

import CanvasClass from "../interact/Canvas";

import * as Map from "../logic/Map";

import { Utils } from "../logic/Utils";

import { Image } from "react-native-canvas";
import { playerImages } from "../assets/base64/players";
import { tileImages } from "../assets/base64/tiles";

const SPRITE_SIZE: number = 64;
const OFFSET_DIVIDE: number = 100;

export class Renderer {
  public tileSize: number;

  protected tiles: object;
  protected playerTypes: object;
  protected boardSize: BoardSize;
  protected canvas: CanvasClass;

  protected animationHandle: number; // used only in rotations

  protected lampMode: boolean = false; // lamp mode only draws around the eggs

  protected renderMap: boolean[][]; // map of screen with whether it needs rendering

  protected checkResize: boolean = true;

  protected tileImages: object = {}; // image elements of tiles
  protected playerImages: object = {}; // image element of players

  protected rotating: boolean;

  protected loadCallback: () => void; // call this when all the tiles are loaded
  protected totalTiles: number = 0;
  protected tilesLoaded: number = 0;

  constructor(
    tiles: object,
    playerTypes: object,
    boardSize: BoardSize,
    canvas: CanvasClass,
    loadCallback: () => void
  ) {
    this.tiles = tiles;
    this.playerTypes = playerTypes;
    this.boardSize = boardSize;
    this.canvas = canvas;
    this.loadCallback = loadCallback;
    this.loadTilePalette(this.canvas, tiles);
    this.loadPlayerPalette(this.canvas);
  }

  public render(
    board: Board,
    renderMap: boolean[][],
    players: Player[],
    renderAngle: number
  ) {
    // console.log("Renderer->render",board, renderMap, renderAngle);
    this.tileSize = this.canvas.calcTileSize(this.boardSize);
    this.renderBoard(board, renderMap, renderAngle);
    this.renderPlayers(players);
    this.renderFrontLayerBoard(board, renderMap, renderAngle);
  }

  public drawRotatingBoard(
    clockwise: boolean,
    moveSpeed: number,
    completed: () => void
  ) {
    if (this.rotating === true) {
      // already
      return false;
    }

    const canvas = this.canvas.getCanvas();
    const savedData = this.getImageData(canvas);
    this.rotating = true;

    if (clockwise) {
      this.drawRotated(savedData, 1, 0, 90, moveSpeed, completed);
    } else {
      this.drawRotated(savedData, -1, 0, -90, moveSpeed, completed);
    }
  }

  protected getImageData(canvas: RNCanvasElement): HTMLImageElement {
    const cw = canvas.width;
    const ch = canvas.height;

    const savedData = new Image();
    savedData.src = canvas.toDataURL("image/png");

    return savedData;
  }

  protected loadTilePalette(canvas, tiles) {
    this.totalTiles = this.tilesLoaded = 0;
    for (const i in tiles) {
      if (tiles[i] !== undefined) {
        this.totalTiles++;
        const thisTile = tiles[i];

        const imageName = thisTile.img;

        const base64 = tileImages[imageName];

        const width = SPRITE_SIZE;
        const height = SPRITE_SIZE;

        const tileImage = new Image(canvas.getCanvas(), height, width);

        tileImage.width = width.toString();
        tileImage.height = height.toString();

        tileImage.src = base64;

        tileImage.addEventListener("load", () => {
          this.markTileImageAsLoaded(thisTile.id);
        });

        this.tileImages[thisTile.id] = {
          image: tileImage,
          ready: false
        };
      }
    }
  }

  protected loadPlayerPalette(canvas) {
    for (const i in this.playerTypes) {
      if (this.playerTypes[i] !== undefined) {
        const playerType = this.playerTypes[i];
        const imageName = playerType.img;

        const base64 = playerImages[imageName];

        const width = SPRITE_SIZE * playerType.frames;
        const height = SPRITE_SIZE;

        const playerImage = new Image(canvas.getCanvas(), height, width);

        playerImage.width = width.toString();
        playerImage.height = height.toString();

        playerImage.src = base64;

        playerImage.addEventListener("load", () => {
          this.markPlayerImageAsLoaded(imageName);
        });

        this.playerImages[imageName] = {
          image: playerImage,
          ready: false
        };
      }
    }
  }

  protected markPlayerImageAsLoaded(img: string) {
    this.playerImages[img].ready = true;
  }

  protected markTileImageAsLoaded(id: number) {
    this.tilesLoaded++;
    this.tileImages[id].ready = true;
    if (this.tilesLoaded === this.totalTiles) {
      this.loadCallback(); // we are ready to fucking party
    }
  }

  protected renderBoard(
    board: Board,
    renderMap: boolean[][],
    renderAngle: number
  ): void {
    const ctx = this.canvas.getDrawingContext();
    ctx.globalAlpha = 1;
    const tiles = board.getAllTiles();
    tiles.map(tile => {
      const needsDraw = renderMap[tile.x][tile.y];
      if (needsDraw === false) {
        this.showUnrenderedTile(tile.x, tile.y);
        return;
      }
      if (!tile.frontLayer) {
        this.renderTile(tile.x, tile.y, tile, renderAngle);
      } else {
        // render sky behind see through tiles
        this.drawSkyTile(tile, tile.x, tile.y, renderAngle);
      }
    });
  }

  protected drawSkyTile(tile: Tile, x: number, y: number, renderAngle: number) {
    const skyTile = this.tiles[1];
    this.renderTile(x, y, skyTile, renderAngle);
  }

  // just go over and draw the over-the-top stuff
  protected renderFrontLayerBoard(
    board: Board,
    renderMap: boolean[][],
    renderAngle: number
  ) {
    const tiles = board.getAllTiles();
    tiles.map(tile => {
      const needsDraw = renderMap[tile.x][tile.y];
      if (needsDraw === false) {
        return;
      }
      if (tile.frontLayer) {
        this.renderTile(tile.x, tile.y, tile, renderAngle);
      }
    });
  }

  // debugging tools
  protected showUnrenderedTile(x: number, y: number) {
    if (!this.lampMode) {
      return false;
    }
    const tileSize = Math.floor(this.tileSize);
    const ctx = this.canvas.getDrawingContext();
    ctx.fillStyle = "rgba(0,0,0,0.1)";
    ctx.fillRect(
      Math.floor(x * tileSize),
      Math.floor(y * tileSize),
      tileSize,
      tileSize
    );
  }

  protected renderPlayers(players: Player[]) {
    players.map(player => {
      return this.renderPlayer(player);
    });
  }

  protected getTileImage(tile: Tile) {
    if (tile.id < 1) {
      // console.log("invalid tile requested", tile.id, tile);
      return false;
    }
    const tileImage = this.tileImages[tile.id];

    if (tileImage.ready) {
      return tileImage.image;
    }
    return false;
  }

  protected renderTile = function(
    x: number,
    y: number,
    tile: Tile,
    renderAngle: number
  ): boolean {
    const ctx = this.canvas.getDrawingContext();
    const tileSize = this.tileSize;

    const img = this.getTileImage(tile);

    if (!img) {
      // console.log("Could not find tile image for id " + tile.id);
      return false;
    }

    let left = Math.floor(x * tileSize);
    let top = Math.floor(y * tileSize);

    if (renderAngle === 0) {
      ctx.drawImage(img, left, top, tileSize, tileSize);
    } else {
      const angleInRad = renderAngle * (Math.PI / 180);

      const offset = Math.floor(tileSize / 2);

      left = Math.floor(left + offset);
      top = Math.floor(top + offset);

      ctx.translate(left, top);
      ctx.rotate(angleInRad);

      ctx.drawImage(img, -offset, -offset, tileSize, tileSize);

      ctx.rotate(-angleInRad);
      ctx.translate(-left, -top);
    }

    return true;
  };

  protected getPlayerImage(img: string) {
    const playerImage = this.playerImages[img];
    if (playerImage.ready) {
      return playerImage.image;
    }
    return false;
  }

  protected renderPlayer(player: Player) {
    const ctx = this.canvas.getDrawingContext();
    const tileSize = this.tileSize;

    const offsetRatio = tileSize / OFFSET_DIVIDE;

    const coords = player.coords;

    const left = Math.floor(coords.x * tileSize + coords.offsetX * offsetRatio);
    const top = Math.floor(coords.y * tileSize + coords.offsetY * offsetRatio);

    const clipLeft = Math.floor(player.currentFrame * SPRITE_SIZE);
    const clipTop = 0;

    const image = this.getPlayerImage(player.img);
    if (!image) {
      // console.log('player image not loaded', player.img);
      return false;
    }

    ctx.drawImage(
      image,
      clipLeft,
      0,
      SPRITE_SIZE,
      SPRITE_SIZE,
      left,
      top,
      tileSize,
      tileSize
    );

    if (left < 0) {
      // also draw on right
      const secondLeft = left + tileSize * this.boardSize.width;
      ctx.drawImage(
        image,
        clipLeft,
        0,
        SPRITE_SIZE,
        SPRITE_SIZE,
        secondLeft,
        top,
        tileSize,
        tileSize
      );
    }

    if (left + tileSize > tileSize * this.boardSize.width) {
      // also draw on left
      const secondLeft = left - tileSize * this.boardSize.width;
      ctx.drawImage(
        image,
        clipLeft,
        0,
        SPRITE_SIZE,
        SPRITE_SIZE,
        secondLeft,
        top,
        tileSize,
        tileSize
      );
    }

    if (top + tileSize > tileSize * this.boardSize.height) {
      // also draw on top
      const secondTop = top - tileSize * this.boardSize.height;
      ctx.drawImage(
        image,
        clipLeft,
        0,
        SPRITE_SIZE,
        SPRITE_SIZE,
        left,
        secondTop,
        tileSize,
        tileSize
      );
    }
  }

  protected drawRotated(
    savedData: HTMLImageElement,
    direction: number,
    angle: number,
    targetAngle: number,
    moveSpeed: number,
    completed: () => any
  ) {
    const canvas = this.canvas.getCanvas();

    if (direction > 0) {
      if (angle >= targetAngle) {
        completed();
        this.rotating = false;
        return false;
      }
    } else {
      if (angle <= targetAngle) {
        completed();
        this.rotating = false;
        return false;
      }
    }

    const angleInRad = angle * (Math.PI / 180);

    const offset = canvas.width / 2;

    const ctx = this.canvas.getDrawingContext();

    const left = offset;
    const top = offset;

    this.canvas.wipeCanvas("rgba(0,0,0,0.1)");

    ctx.translate(left, top);
    ctx.rotate(angleInRad);

    ctx.drawImage(savedData, -offset, -offset);

    ctx.rotate(-angleInRad);
    ctx.translate(-left, -top);

    angle += direction * (moveSpeed / 2);

    this.animationHandle = window.requestAnimationFrame(() => {
      this.drawRotated(
        savedData,
        direction,
        angle,
        targetAngle,
        moveSpeed,
        completed
      );
    });
  }
}
