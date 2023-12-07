/* eslint-disable @typescript-eslint/no-explicit-any */
import { Socket } from "socket.io-client";
import * as CONSTANTS from "../constants";
import { VarGame } from "../../../model/VarGame";

function handlePaddleCollision(
  varGame: VarGame,
  paddleSide: "left" | "right",
  applySpeedMode: boolean,
  setModeSpeed: (isSpeed: boolean) => void,
  gameSocket: Socket | null,
  room: string,
  canvasSize: any
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
  canvasSize: any
) {
  handlePaddleCollision(gameVars, "left", modeSpeed, setModeSpeed, gameSocket, room, canvasSize);
  handlePaddleCollision(gameVars, "right", modeSpeed, setModeSpeed, gameSocket, room, canvasSize);
  // Check upper and lower wall collision
  const diam = canvasSize.width * 0.0125;
  if ((gameVars.ySpeed < 0 && gameVars.yBall < diam / 2) || (gameVars.ySpeed > 0 && gameVars.yBall > canvasSize.height - diam / 2)) {
    gameVars.ySpeed *= -1;
  }
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

const GameService = {
  checkCollision,
};

export default GameService;
