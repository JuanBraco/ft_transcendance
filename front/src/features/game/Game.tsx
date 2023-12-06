import { useContext, useEffect, useRef, useState } from "react";
import { UserContext } from "../../App";
import { User } from "../../model/User";
import { GameMdl } from "../../model/GameMdl";
import { Socket, io } from "socket.io-client";
import * as CONSTANTS from "./constants";
import { GameMessage } from "./utils/DisplayGame";
import { GameResponse } from "../../model/GameResponse";
import { Box, Container, Typography } from "@mui/material";
import baseURL from "../../utils/baseURL";
import { Cookies } from "react-cookie";
import axiosInstance from "../../utils/axiosInstance";
import DrawSketch from './DrawSketch';

function Game() {

  const cookies = new Cookies();

  const { user, gameSocket, setGameSocket } = useContext(UserContext);
  const [room, setRoom] = useState<string>("");
  const [gameStatus, setGameStatus] = useState<string>("");
  const [gameInvitationError, setGameInvitationError] = useState<string>("");
  const [winner, setWinner] = useState<string>("");
  const [hostPlayerR, setHostPlayer] = useState<User | null>(null);
  const [joinPlayerL, setJoinPlayer] = useState<User | null>(null);

  const gameContainerHeightRef = useRef<HTMLDivElement>(null);



  const gameSocketRef = useRef<Socket | null>(null);

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



  useEffect(() => {
    async function checkUserInGame() {
      try {
        const response = await axiosInstance.get("/user/isPlaying");
        // Do something with the response
        if (response.data) setGameStatus("PAUSE");
      } catch (error) {
        console.error("Error checking if user is in game", error);
        // Handle error
      }
    }

    checkUserInGame();
  }, []);
  

  useEffect(() => {
    // Call it initially to set the initial sizes

    const socket = io(baseURL + "/game", {
      forceNew: true,
      query: { tokenJwt: cookies.get("jwt") },
    });
    setGameSocket(socket);

    gameSocketRef.current = socket;
    return () => {
        if (gameSocketRef.current) {
          gameSocketRef.current.disconnect();
        }
    };
  }, []);

  async function handleJoinGame() {
    gameSocket?.emit("joinGame", { roomId: room }, (response: GameResponse) => {
      if (!response.ok) {
        setGameInvitationError(response.statusText);
        setGameStatus("ERROR");
      }
    });
  }

  const renderGameStatus = () => {
    switch (gameStatus) {
      case "LIVE":
        return <DrawSketch setGameStatus={setGameStatus} hostPlayerR={hostPlayerR} joinPlayerL={joinPlayerL} room={room} setWinner={setWinner}/>;
      case "PAUSE":
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h6">Waiting for opponent...</Typography>
          </Box>
          );
      case "ENDED":
        return <GameMessage player={winner} message={CONSTANTS.MSG_END} subMessage={CONSTANTS.SUBMSG_END} handleJoinGame={handleJoinGame} />;
      case "ERROR":
        return gameInvitationError && <div style={{ color: "red" }}>{gameInvitationError}</div>;
      default:
        return (
          <Box sx={{ textAlign: "center" }}>
            <GameMessage player={user!.fullName} message={CONSTANTS.MSG_START} subMessage={CONSTANTS.SUBMSG_START} handleJoinGame={handleJoinGame} />
            {/* <img src="https://www.primarygames.com/arcade/classic/pongclassic/logo200.png" alt="Pong Logo" style={{ maxWidth: '100%', height: 'auto' }} /> */}
            <img
              src="https://www.hiig.de/wp-content/uploads/2014/11/Pong1-1200x900.jpg"
              alt="Pong Logo"
              style={{ maxWidth: "50%", height: "auto" }}
            />
          </Box>
        );
    }
  };

  return (
    <>
      <Box
        sx={{ marginTop: 2, marginLeft: 2, borderRadius: 1, border: `1px solid #366873`, height: "calc(100vh - 120px)", overflowY: "auto" }}
        ref={gameContainerHeightRef}
      >
        <Container component="main" maxWidth={false}>
          <Typography className="PlayerList__title" sx={{ color: "#015958", fontWeight: "bold", fontSize: "13px" }}>
            Game
          </Typography>
          <div className="game-sketch">{renderGameStatus()}</div>
        </Container>
      </Box>
    </>
  );
}

export default Game;
