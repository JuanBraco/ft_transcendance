/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useContext, useEffect, useState } from "react";
import { P5CanvasInstance, ReactP5Wrapper } from "@p5-wrapper/react";
import { UserContext } from "../../App";
import * as CONSTANTS from "./constants";
import { User } from "../../model/User";
import p5 from "p5";

interface DrawSketchProps {
  setGameStatus: React.Dispatch<React.SetStateAction<string>>;
  hostPlayerR: User;
  joinPlayerL: User;
  room: string;
  setWinner: React.Dispatch<React.SetStateAction<string>>;
}

interface VarGame {
  yBall: number;
  xBall: number;
  yPadR: number;
  yPadL: number;
  scoreL: number;
  scoreR: number;
  xSpeed: number;
  ySpeed: number;
  isSpeed : boolean;
}

const DrawSketch: React.FC<DrawSketchProps> = ({ setGameStatus, hostPlayerR, joinPlayerL, room, setWinner }) => {
  const { user, gameSocket } = useContext(UserContext);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [varGame, setVarGame] = useState<VarGame | null>(null);
  const [modeSpeed, setModeSpeed] = useState<boolean>(false);

  const updateCanvasSize = () => {
    const divElement = document.querySelector(".game-sketch");
    if (divElement) {
      setCanvasSize({
        width: divElement.clientWidth * 0.9,
        height: divElement.clientWidth * 0.9 * (3 / 5),
      });
    }
  };

  useEffect(() => {
    updateCanvasSize();
  }, []);

  useEffect(() => {
    if (canvasSize) {
      // Check if gameDisplay has been set
      const newVarGame = {
        yBall: canvasSize.height / 2,
        xBall: canvasSize.width / 2 - (canvasSize.width * 0.0125) / 2,
        xSpeed: canvasSize.width * CONSTANTS.SPEED_X_FACTOR,
        ySpeed: canvasSize.height * CONSTANTS.SPEED_Y_FACTOR,
        scoreL: varGame ? varGame.scoreL : 0,
        scoreR: varGame ? varGame.scoreR : 0,
        yPadL: canvasSize.height / 2,
        yPadR: canvasSize.height / 2,
        isSpeed: varGame ? varGame.isSpeed : false,
      };

      setVarGame(newVarGame); // Now you can safely set varGame
    }
  }, [canvasSize]);

  function handleDraw(p5: p5) {
    if (!varGame) return;
    const padW = canvasSize.width * 0.0167;
    const padH = canvasSize.height * 0.2;

    // fixed items
    if (modeSpeed) p5.background(0, 0, 139);
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
    p5.text(varGame.scoreL, canvasSize.width * (1 / 4), canvasSize.height / 8);
    p5.text(varGame.scoreR, canvasSize.width * (3 / 4), canvasSize.height / 8);

    // Drawing the player names
    p5.textSize(canvasSize.width / 15); // Slightly smaller text for player names
    p5.text(joinPlayerL!.nickname, canvasSize.width * (1 / 4), canvasSize.height / 50); // Below the left player's score
    p5.text(hostPlayerR!.nickname, canvasSize.width * (3 / 4), canvasSize.height / 50); // Below the right player's score

    //Mobile items
    p5.fill(255);
    //Paddles
    p5.rect(0, varGame.yPadL, padW, padH);
    p5.rect(canvasSize.width - padW, varGame.yPadR, padW, padH);
    //Ball
    p5.rect(varGame.xBall, varGame.yBall, canvasSize.width * 0.0125, canvasSize.width * 0.0125);
  }

  function movePaddle(newY: number, right: boolean) {
    if (!gameSocket || !varGame) return;
    const padH = canvasSize.height * 0.2;
    if (newY >= -padH / 2 && newY <= canvasSize.height) {
      if (right) {
        varGame!.yPadR = newY;
      } else {
        varGame!.yPadL = newY;
      }
      gameSocket.emit("paddleMove", {
        room: room,
        yPadR: varGame.yPadR / canvasSize.height,
        yPadL: varGame.yPadL / canvasSize.height,
      });
    }
  }

  function handlePowerUp() {
    setModeSpeed(true);
    varGame!.isSpeed = true;
    gameSocket?.emit("startPowerUp", { room: room, isSpeed: varGame!.isSpeed });
  }

  // Function to draw the wave
  function sketch(p5: P5CanvasInstance) {
    if (!varGame) return;
    p5.setup = () => p5.createCanvas(canvasSize.width, canvasSize.height);

    p5.windowResized = () => {
      const updateCanvasSize = () => {
        const divElement = document.querySelector(".game-sketch");
        if (divElement) {
          setCanvasSize({
            width: divElement.clientWidth * 0.9,
            height: divElement.clientWidth * 0.9 * (3 / 5),
          });
        }
      };
      updateCanvasSize();
      p5.resizeCanvas(canvasSize.width, canvasSize.height);
    };

    p5.keyPressed = () => {
      const e = { code: p5.key };
      if (user && varGame) {
        if (e.code === CONSTANTS.UP_ARROW) {
          if (user!.nickname === hostPlayerR!.nickname) {
            movePaddle(varGame.yPadR - canvasSize.height / 15, true);
          }
        } else if (e.code === CONSTANTS.DOWN_ARROW) {
          if (user!.nickname === hostPlayerR!.nickname) {
            movePaddle(varGame.yPadR + canvasSize.height / 15, true);
          }
        } else if (e.code === CONSTANTS.S_KEY) {
          if (user!.nickname === joinPlayerL!.nickname) {
            movePaddle(varGame.yPadL + canvasSize.height / 15, false);
          }
        } else if (e.code === CONSTANTS.W_KEY) {
          if (user!.nickname === joinPlayerL!.nickname) {
            movePaddle(varGame.yPadL - canvasSize.height / 15, false);
          }
        } else if (e.code === CONSTANTS.B_KEY) {
          handlePowerUp();
        }
      }
    };

    p5.draw = () => {
      handleDraw(p5);
      if (varGame.scoreL >= 3 || varGame.scoreR >= 3) {
        setGameStatus("ENDED");
        setWinner(varGame.scoreL === 3 ? joinPlayerL.fullName : hostPlayerR.fullName);
        varGame.scoreL = 0;
        varGame.scoreR = 0;
        varGame.yPadL = canvasSize.height / 2;
        varGame.yPadR = canvasSize.height / 2;
      }
    };
  }

  useEffect(() => {
    if (!gameSocket) return;

    const gameStateUpdate = (data: any) => {
        varGame!.yBall = data.yBall * canvasSize.height;
        varGame!.xBall = data.xBall * canvasSize.width;
        varGame!.yPadR = data.yPadR * canvasSize.height;
        varGame!.yPadL = data.yPadL * canvasSize.height;
        varGame!.scoreL = data.scoreL;
        varGame!.scoreR = data.scoreR;
        varGame!.isSpeed = data.isSpeed;
        if(data.isSpeed) {
          setModeSpeed(true);
        } else {
          setModeSpeed(false);
        }
    };

    gameSocket.on("gameStateUpdate", gameStateUpdate);

    return () => {
      gameSocket.off("gameStateUpdate", gameStateUpdate);
    };
  }, [varGame]);

  return <ReactP5Wrapper sketch={sketch} />;
};

export default DrawSketch;
