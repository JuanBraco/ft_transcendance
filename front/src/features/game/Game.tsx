import { useContext, useEffect, useState } from "react";
import { UserContext } from "../../App";
import { User } from "../../model/User";
import { GameMdl } from "../../model/GameMdl";
import { io } from "socket.io-client";
import * as CONSTANTS from "./constants";
import { GameMessage } from "../../common/display/DisplayMessage";
import { GameResponse } from "../../model/GameResponse";
import baseURL from "../../utils/baseURL";
import { Cookies } from "react-cookie";
import axiosInstance from "../../utils/axiosInstance";
import DrawSketch from "./DrawSketch";
import { Box, Typography } from "@mui/material";

function Game() {
  const cookies = new Cookies();

  const { user, gameSocket, setGameSocket } = useContext(UserContext);
  const [room, setRoom] = useState<string>("");
  const [gameStatus, setGameStatus] = useState<string>("");
  const [gameInvitationError, setGameInvitationError] = useState<string>("");
  const [winner, setWinner] = useState<string>("");
  const [hostPlayerR, setHostPlayer] = useState<User | null>(null);
  const [joinPlayerL, setJoinPlayer] = useState<User | null>(null);

  async function checkUserInGame() {
    try {
      const response = await axiosInstance.get("/user/isPlaying");
      if (response.data) setGameStatus("PAUSE");
    } catch (error) {
      console.error("Error checking if user is in game", error);
    }
  }

  useEffect(() => {
    const socket = io(baseURL + "/game", { forceNew: true, query: { tokenJwt: cookies.get("jwt") } });
    setGameSocket(socket);

    checkUserInGame();
    return () => {
      if (socket) socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!gameSocket) return;

    const onJoinedGame = (game: GameMdl) => {
      if (game.error) {
        return;
      }
      setGameStatus(game.status);
      setRoom(game.id);

      if (game.owner) setHostPlayer(game.owner);
      if (game.players![0] && game.players![1]) setJoinPlayer(game.players![1].id === game.owner.id ? game.players![0] : game.players![1]);
    };

    const onOpponentDisconnected = (game: GameMdl) => {
      setGameStatus(game.status);
    };

    const setInvitedPlayer = () => {
      setGameStatus("PAUSE");
    };

    gameSocket.on("joinedGame", onJoinedGame);
    gameSocket.on("opponentDisconnected", onOpponentDisconnected);
    gameSocket.on("invitedPlayer", setInvitedPlayer);

    return () => {
      gameSocket.off("joinedGame", onJoinedGame);
      gameSocket.off("opponentDisconnected", onOpponentDisconnected);
      gameSocket.off("invitedPlayer", setInvitedPlayer);
    };
  }, [gameSocket]);

  async function handleJoinGame() {
    gameSocket?.emit("joinGame", { roomId: room }, (response: GameResponse) => {
      if (!response.ok) {
        setGameInvitationError(response.statusText);
        setGameStatus("ERROR");
      }
    });
  }

  return (
    <>
      <Box sx={{ marginTop: 2, marginLeft: 2, borderRadius: 1, border: `1px solid #366873`, height: "calc(100vh - 120px)", overflowY: "auto" }}>
        <div className="relative h-screen overflow-hidden px-6 pt-16 mx-auto space-y-8 max-w-7xl lg:px-8 md:space-y-16 md:pt-24 lg:pt-32">
          <Typography className="PlayerList__title" sx={{ color: "#015958", fontWeight: "bold", fontSize: "13px" }}>
            Game
          </Typography>
          <div className="game-sketch absolute inset-0" style={{ height: "calc(100vh - 200px)" }}>
            {(() => {
              switch (gameStatus) {
                case "LIVE":
                  return (
                    <div className="text-center">
                      {hostPlayerR && joinPlayerL && (
                        <DrawSketch
                          setGameStatus={setGameStatus}
                          hostPlayerR={hostPlayerR}
                          joinPlayerL={joinPlayerL}
                          room={room}
                          setWinner={setWinner}
                        />
                      )}
                    </div>
                  );
                case "PAUSE":
                  return (
                    <div className="text-center">
                      <h6 className="text-lg">Waiting for opponent...</h6>
                    </div>
                  );
                case "ENDED":
                  return (
                    <GameMessage player={winner} message={CONSTANTS.MSG_END} subMessage={CONSTANTS.SUBMSG_END} handleJoinGame={handleJoinGame} />
                  );
                case "ERROR":
                  return gameInvitationError && <div className="text-red-500">{gameInvitationError}</div>;
                default:
                  return (
                    <GameMessage
                      player={user!.fullName}
                      message={CONSTANTS.MSG_START}
                      subMessage={CONSTANTS.SUBMSG_START}
                      handleJoinGame={handleJoinGame}
                    />
                  );
              }
            })()}
          </div>
        </div>
      </Box>
    </>
  );
}

export default Game;
