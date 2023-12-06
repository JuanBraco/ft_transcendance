/* eslint-disable @typescript-eslint/no-explicit-any */
import p5 from "p5";
import { User } from "../../../model/User";
import { Socket } from "socket.io-client";
import { UserDetails } from "../../../model/UserDetails";

import * as CONSTANTS from "../constants";
import { VarGame } from "../../../model/VarGame";

function handleDraw(p5: p5, varGame: VarGame, playerRName: string, playerLName: string, SpeedMode: boolean, canvasSize: any) {
  const padW = canvasSize.width * 0.0167;
  const padH = canvasSize.height * 0.2;
  
  // fixed items
  if (SpeedMode) p5.background(0, 0, 139);
  else p5.background(0);
  p5.stroke(255);
  p5.strokeWeight(4);
  for (let i = 0; i < canvasSize.height; i += 20) {
    p5.line(canvasSize.width / 2, i, canvasSize.width / 2, i + 10);
  }

  // Scores
  p5.textFont("Arial", 4); // Use a pixelated font
  p5.fill(255);
  p5.textAlign(p5.CENTER, p5.TOP); // Centered text at the top
  p5.textSize(canvasSize.width / 20);
  // p5.text(varGame.scoreL, canvasSize.width * (1 / 4), canvasSize.height / 8);
  // p5.text(varGame.scoreR, canvasSize.width * (3 / 4), canvasSize.height / 8);

  // Drawing the player names
  p5.textSize(canvasSize.width / 15); // Slightly smaller text for player names
  p5.text(playerLName, canvasSize.width * (1 / 4), canvasSize.height / 50); // Below the left player's score
  p5.text(playerRName, canvasSize.width * (3 / 4), canvasSize.height / 50); // Below the right player's score

  //Mobile items
  p5.fill(255);
  //Paddles
  p5.rect(0, varGame.yPadL, padW, padH);
  p5.rect(canvasSize.width, varGame.yPadR, padW, padH);
  //Ball
  p5.rect(varGame.xBall, varGame.yBall, canvasSize.width * 0.0125, canvasSize.width * 0.0125);
}

function handlePaddleCollision(
  varGame: VarGame,
  paddleSide: "left" | "right",
  applySpeedMode: boolean,
  setModeSpeed: (isSpeed: boolean) => void,
  gameSocket: Socket | null,
  room: string,
  canvasSize: any,
) {
  const padW = canvasSize.width * 0.0167;
  const padH = canvasSize.height * 0.2;
  const diam = canvasSize.width * 0.0125;
  const paddleXPos = paddleSide === "left" ? 0 : canvasSize.width - padW;
  const yPaddle = paddleSide === "left" ? varGame.yPadL : varGame.yPadR;
  const beyondPaddle = paddleSide === "left" ? varGame.xBall < diam / 2 : varGame.xBall + diam / 2 > canvasSize.width;
  const collisionXCond = paddleSide === "left" ? varGame.xBall <= paddleXPos + padW : varGame.xBall >= paddleXPos;
  const speedFactor = paddleSide === "left" ? 1 : -1;

  if (collisionXCond && varGame.yBall >= yPaddle - padW && varGame.yBall <= yPaddle + padH) {
    // Collision with paddle detected
    const yMidPaddle = yPaddle + padH / 2;
    varGame.ySpeed = varGame.yBall < yMidPaddle ? -Math.abs(varGame.ySpeed) : Math.abs(varGame.ySpeed);
    varGame.xSpeed = Math.abs(varGame.xSpeed) * speedFactor;

    if (varGame.isSpeed) {
      varGame.ySpeed *= CONSTANTS.SPEED_INCREASE_FACTOR;
      varGame.xSpeed *= CONSTANTS.SPEED_INCREASE_FACTOR;
    }
  } else if (beyondPaddle) {
    // Ball is beyond the paddle
    handlePointScored(paddleSide === "right", varGame, canvasSize);
    resetBallSpeed(varGame, applySpeedMode, speedFactor, canvasSize);
    setModeSpeed(false);
    varGame.isSpeed = false;
    gameSocket?.emit("storeScore", {
      gameId: room,
      scoreR: varGame.scoreR,
      scoreL: varGame.scoreL,
      end: false,
    });
  }
}

function checkWallCollision(gameVars: VarGame, canvasSize: any) {
  const diam = canvasSize.width * 0.0125;
  if ((gameVars.ySpeed < 0 && gameVars.yBall < diam / 2) || (gameVars.ySpeed > 0 && gameVars.yBall > canvasSize.height - diam / 2)) {
    gameVars.ySpeed *= -1;
  }
}

function calculateSpeedBasedOnWindowSize(applySpeedMode: boolean, canvasSize: any) {
  // Calculate base speeds as a fraction of the window dimensions
  const baseXSpeed = canvasSize.width * CONSTANTS.SPEED_X_FACTOR;
  const baseYSpeed = canvasSize.height * CONSTANTS.SPEED_Y_FACTOR;

  // Apply speed mode multiplier if needed
  const speedMultiplier = applySpeedMode ? CONSTANTS.SPEED_INCREASE_FACTOR : 1;

  return {
    xSpeed: baseXSpeed * speedMultiplier,
    ySpeed: baseYSpeed * speedMultiplier,
  };
}

function resetBallSpeed(gameVars: VarGame, applySpeedMode: boolean, speedFactor: number, canvasSize: any) {
  const { xSpeed, ySpeed } = calculateSpeedBasedOnWindowSize(applySpeedMode, canvasSize);
  gameVars.ySpeed = ySpeed;
  gameVars.xSpeed = xSpeed * speedFactor;
}

function checkCollision(
  gameVars: VarGame,
  modeSpeed: boolean,
  setModeSpeed: (isSpeed: boolean) => void,
  gameSocket: Socket | null,
  room: string,
  canvasSize: any,
) {
  handlePaddleCollision(gameVars, "left", modeSpeed, setModeSpeed, gameSocket, room, canvasSize);
  handlePaddleCollision(gameVars, "right", modeSpeed, setModeSpeed, gameSocket, room, canvasSize);
  checkWallCollision(gameVars, canvasSize);
}

async function calculation(
  user: UserDetails,
  varGame: VarGame,
  hostPlayerR: User,
  joinPlayerL: User,
  gameSocket: Socket | null,
  room: string,
  setGameStatus: (status: string) => void,
  setWinner: (status: string) => void,
  canvasSize: any,
) {
  if (user!.nickname === hostPlayerR!.nickname) {
    varGame.xBall = varGame.xBall + varGame.xSpeed;
    varGame.yBall = varGame.yBall + varGame.ySpeed;
  }

  if (varGame.scoreL === 11 || varGame.scoreR === 11) {
    gameSocket?.emit("storeScore", {
      gameId: room,
      scoreR: varGame.scoreR,
      scoreL: varGame.scoreL,
      winner: varGame.scoreL === 11 ? joinPlayerL : hostPlayerR,
      end: true,
    });
    setGameStatus("ENDED");
    setWinner(varGame.scoreL === 11 ? joinPlayerL.fullName : hostPlayerR.fullName);
    varGame.scoreL = 0;
    varGame.scoreR = 0;
    varGame.yPadL = canvasSize.height / 2;
    varGame.yPadR = canvasSize.height / 2;
  }

  if (user!.nickname === hostPlayerR!.nickname) emitMove(gameSocket, varGame, user, room, canvasSize);
}

function handlePointScored(hitRight: boolean, varG: VarGame, canvasSize: any) {
  const diam = canvasSize.width * 0.0125;
  if (hitRight) {
    varG.scoreL += 1;
  } else {
    varG.scoreR += 1;
  }
  varG.xBall = canvasSize.width / 2 - diam / 2;
  const numb = Math.random();
  if (numb % 2) {
    varG.yBall = canvasSize.height;
  } else {
    varG.yBall = 0;
  }
}

function emitMove(gSock: Socket | null, varG: VarGame, user: UserDetails | null, room: string, canvasSize: any) {
  gSock?.emit("move", {
    room: room,
    yBall: varG.yBall / canvasSize.height,
    xBall: varG.xBall / canvasSize.width,
    ySpeed: varG.ySpeed / canvasSize.height,
    xSpeed: varG.xBall / canvasSize.width,
    yPadR: varG.yPadR / canvasSize.height,
    yPadL: varG.yPadL / canvasSize.height,
    scoreL: varG.scoreL,
    scoreR: varG.scoreR,
    user: user,
    isSpeed: varG.isSpeed,
  });
}

function movePaddle(
  newY: number,
  gSock: Socket | null,
  user: UserDetails | null,
  varG: VarGame,
  room: string,
  right: boolean,
  canvasSize: any
) {
  const padH = canvasSize.height * 0.2;
  if (newY >= -padH / 2 && newY <= canvasSize.height) {
    if (right) {
      varG.yPadR = newY;
    } else {
      varG.yPadL = newY;
    }
    emitMove(gSock, varG, user, room, canvasSize);
  }
}

function handlePowerUp(
  gameSocket: Socket | null,
  user: UserDetails | null,
  varGame: VarGame,
  room: string,
  setModeSpeed: (isSpeed: boolean) => void,
  canvasSize: any
) {
  setModeSpeed(true);
  varGame.isSpeed = true;
  gameSocket?.emit("startPowerUp", { roomId: room });
  emitMove(gameSocket, varGame, user, room, canvasSize);
}

const GameService = {
  handleDraw,
  checkCollision,
  emitMove,
  calculation,
  movePaddle,
  handlePowerUp,
};

export default GameService;
