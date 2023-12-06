/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useContext, useEffect, useState } from "react";
import { P5CanvasInstance, ReactP5Wrapper } from "@p5-wrapper/react";
import GameService from "./utils/utilsGame";
import { UserContext } from "../../App";
import { VarGame } from "../../model/VarGame";
import * as CONSTANTS from "./constants";
import { User } from "../../model/User";

interface DrawSketchProps {
  setGameStatus: React.Dispatch<React.SetStateAction<string>>;
  hostPlayerR: User | null;
  joinPlayerL: User | null;
  room: string;
  setWinner: React.Dispatch<React.SetStateAction<string>>;
}

const DrawSketch: React.FC<DrawSketchProps> = ({ setGameStatus, hostPlayerR, joinPlayerL, room, setWinner }) => {
  const { user, gameSocket } = useContext(UserContext);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [varGame, setVarGame] = useState<VarGame | null>(null);
  const [modeSpeed, setModeSpeed] = useState<boolean>(false);
  
  useEffect(() => {
      const updateCanvasSize = () => {
        const divElement = document.querySelector(".game-sketch");
        if (divElement) {
            setCanvasSize({
                width: divElement.clientWidth,
                height: divElement.clientHeight,
            });
            console.log('HERE')
        }
      };
    updateCanvasSize();
  }, []);

  useEffect(() => {
    if (canvasSize) {
      // Check if gameDisplay has been set
      const newVarGame = {
        yBall: canvasSize.height / 2,
        xBall: canvasSize.width / 2 - canvasSize.width * 0.0125 / 2,
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

  // Function to draw the wave
  function sketch(p5: P5CanvasInstance) {
    p5.setup = () => p5.createCanvas(canvasSize.width, canvasSize.height);

    p5.windowResized = () => {
        const updateCanvasSize = () => {
            const divElement = document.querySelector(".game-sketch");
            if (divElement) {
                setCanvasSize({
                    width: divElement.clientWidth,
                    height: divElement.clientHeight,
                });
                console.log('HERE')
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
            GameService.movePaddle(varGame.yPadR - canvasSize.height / 15, gameSocket, user, varGame, room, true, canvasSize);
          }
        } else if (e.code === CONSTANTS.DOWN_ARROW) {
          if (user!.nickname === hostPlayerR!.nickname) {
            GameService.movePaddle(varGame.yPadR + canvasSize.height / 15, gameSocket, user, varGame, room, true, canvasSize);
          }
        } else if (e.code === CONSTANTS.S_KEY) {
          if (user!.nickname === joinPlayerL!.nickname) {
            GameService.movePaddle(varGame.yPadL + canvasSize.height / 15, gameSocket, user, varGame, room, false, canvasSize);
          }
        } else if (e.code === CONSTANTS.W_KEY) {
          if (user!.nickname === joinPlayerL!.nickname) {
            GameService.movePaddle(varGame.yPadL - canvasSize.height / 15, gameSocket, user, varGame, room, false, canvasSize);
          }
        } else if (e.code === CONSTANTS.B_KEY) {
          GameService.handlePowerUp(gameSocket, user, varGame, room, setModeSpeed, canvasSize);
        }
      }
    };

    p5.draw = () => {
      GameService.handleDraw(p5, varGame!, hostPlayerR!.nickname, joinPlayerL!.nickname, modeSpeed, canvasSize);
      GameService.checkCollision(varGame!, modeSpeed, setModeSpeed, gameSocket, room, canvasSize);
      GameService.calculation(user!, varGame!, hostPlayerR!, joinPlayerL!, gameSocket, room, setGameStatus, setWinner, canvasSize);
    };
  }

  useEffect(() => {
    if (!gameSocket) return;

    const onMove = (data: any) => {
      if (data.user!.id !== user!.id) {
        varGame!.yBall = data.yBall * canvasSize.height;
        varGame!.xBall = data.xBall * canvasSize.width;
        varGame!.yPadR = data.yPadR * canvasSize.height;
        varGame!.yPadL = data.yPadL * canvasSize.height;
        varGame!.scoreL = data.scoreL;
        varGame!.scoreR = data.scoreR;
        varGame!.isSpeed = data.isSpeed;
      }
    };

    const onUpdateMode = () => {
      setModeSpeed(true);
      varGame!.isSpeed = true;
    };

    gameSocket.on("move", onMove);
    gameSocket.on("updateMode", onUpdateMode);

    return () => {
      gameSocket.off("move", onMove);
      gameSocket.off("updateMode", onUpdateMode);
    };
  }, [gameSocket, varGame]);

  return <ReactP5Wrapper sketch={sketch} />;
};

export default DrawSketch;
