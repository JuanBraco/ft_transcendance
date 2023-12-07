import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserService } from 'src/user/user.service';
import { GameService } from './game.service';
import { GameResponse } from './game.interface';
import { UserGateway } from 'src/user/user.gateway';
import { GameState } from './game.state';

@WebSocketGateway({
  cors: { origin: process.env.FRONT_URL },
  namespace: 'game',
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private prisma: PrismaService,
    private userService: UserService,
    private userGateway: UserGateway,
    private gameService: GameService
  ) {}

  private gameStates: Map<string, GameState> = new Map();
  private gameLoops: Map<string, NodeJS.Timer> = new Map();

  private startGameLoop(roomId: string): void {
    if (!this.gameStates.has(roomId)) {
      const gameState = new GameState();
      this.gameStates.set(roomId, gameState);
    }

    const gameState = this.gameStates.get(roomId);

    const gameLoop = setInterval(() => {
      gameState.update();
      const stat = gameState.getState();
      if (stat.scoreL == 3 || stat.scoreR == 3) {
        this.gameService.storeScore(roomId, stat.scoreR, stat.scoreL);
        this.stopGameLoop(roomId);
      }
      this.server.to(roomId).emit('gameStateUpdate', gameState.getState());
    }, 1000 / 60) as any;

    this.gameLoops.set(roomId, gameLoop);
  }

  private stopGameLoop(roomId: string): void {
    const gameLoop = this.gameLoops.get(roomId);
    if (gameLoop) {
      clearInterval(gameLoop as any);
      this.gameStates.delete(roomId);
      this.gameLoops.delete(roomId);
    }
  }

  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = await this.userService.getUserFromToken(client.handshake.query.tokenJwt);
      if (!user) {
        client.emit('error', 'Invalid user token');
        client.disconnect();
        return;
      }
      client.data.user = user;
      await this.handleReconnection(client, user.id);
    } catch {
      client.emit('error', 'Connection error');
      client.disconnect();
    }
  }

  private async handleReconnection(client: Socket, userId: string): Promise<void> {
    try {
      // Retrieve the paused game for the reconnecting user
      const userGamePaused = await this.gameService.getUserGames(userId);
      if (!userGamePaused) {
        return; // Exit if there are no paused games for this user
      }
      // Find if there is another player in the game
      const otherPlayer = userGamePaused.players.find((player) => player.id !== userId);

      // Determine the game status based on the other player's status
      const isOtherPlayerActive = otherPlayer && otherPlayer.isPlaying && otherPlayer.online;
      const gameStatusToUpdate = isOtherPlayerActive ? 'LIVE' : 'PAUSE';

      // Update the game status and the user's playing status
      const updatedGame = await this.gameService.updateGameStatus(userGamePaused.id, gameStatusToUpdate);
      await this.gameService.updatePlaying(userId);
      this.userGateway.playersStatusUpdate();

      if (gameStatusToUpdate === 'LIVE') {
        this.startGameLoop(userGamePaused.id);
      }

      // Join the user to the game room and notify other players
      await client.join(userGamePaused.id);
      this.server.to(userGamePaused.id).emit('joinedGame', updatedGame);
    } catch (error) {
      client.emit('reconnection_error', 'Failed to reconnect to the game');
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    try {
      if (!client.data.user) return;
      const userId = client.data.user.id;
      if (!userId) return;
      const activeGame = await this.gameService.getActiveGames(userId);
      if (!activeGame) {
        this.gameService.updateUserPlaying(client.data.user, false);
        return;
      }
      const updatedGame = await this.gameService.pauseGame(activeGame.id);
      this.gameService.updateUserPlaying(client.data.user, false);
      this.userGateway.playersStatusUpdate();
      const gameLoop = this.gameLoops.get(activeGame.id);
      if (gameLoop) {
        clearInterval(gameLoop as any);
      }
      this.server.to(activeGame.id).emit('opponentDisconnected', updatedGame);
    } catch (error) {
      throw error;
    }
  }

  @SubscribeMessage('createAnInviteGame')
  async createRoom(@ConnectedSocket() client: any, @MessageBody() body: any): Promise<GameResponse> {
    const createGameResponse = (ok: boolean, statusText: string) => ({
      ok,
      status: '', // If status is meant to be set dynamically, you could pass this as a parameter as well.
      statusText,
    });

    try {
      // Check if the user who is trying to create the game is already in a live game
      const isInLiveGame = await this.gameService.isUserInLiveGame(client.data.user.id);

      // Check if the user who is creating the game is already playing in another game
      const userInvitingIsPlaying = await this.gameService.isUserPlaying(client.data.user.id);
      if (userInvitingIsPlaying) {
        return createGameResponse(false, 'User inviting is already in a Game');
      }

      // Check if the invited user is already playing in another game
      const userInvitedIsPlaying = await this.gameService.isUserPlaying(body.id);
      if (userInvitedIsPlaying) {
        return createGameResponse(false, 'User invited is already in a Game');
      }

      // If the user is already in a live game, return an error response
      if (isInLiveGame) {
        return createGameResponse(false, 'User already in a Live Game');
      }

      // Create a new game
      const game = await this.gameService.createGame(client.data.user, 5000, false, 'PRIVATE');
      if (!game) {
        createGameResponse.statusText = 'Error in creating the game in the DB.';
      }

      // Update the user's status to 'playing'
      this.gameService.updateUserPlaying(client.data.user, true);

      // Add user to game room and notify about the creation of the game and the invited player
      await client.join(game.id);
      this.server.to(game.id).emit('createdGame', game);
      this.server.to(game.id).emit('invitedPlayer', body.nickname);

      return createGameResponse(true, '');
    } catch (error) {
      return createGameResponse(true, 'Error in creating the game');
    }
  }

  @SubscribeMessage('joinInvitation')
  async joinInvitation(@ConnectedSocket() client: any, @MessageBody() gameId: string): Promise<GameResponse> {
    const createGameResponse = (ok: boolean, statusText: string) => ({
      ok,
      status: '',
      statusText,
    });

    try {
      const isInLiveGame = await this.gameService.isUserInLiveGame(client.data.user.id);
      if (isInLiveGame) return createGameResponse(false, 'User already in a Live Game');
      let updatedGame = await this.gameService.addUsertoGame(client.data.user, gameId);
      const updatedUser = this.gameService.updateUserPlaying(client.data.user, true);
      if (!updatedGame || !updatedUser) return createGameResponse(false, 'Error updating the game with the user.');
      client.join(updatedGame.id);
      this.server.to(updatedGame.id).emit('joinedGame', updatedGame);
      this.startGameLoop(updatedGame.id);
      return createGameResponse(true, '');
    } catch (error) {
      return createGameResponse(false, `Error in joining the invitation: ${error.message}`);
    }
  }

  @SubscribeMessage('joinGame')
  async joinGame(@ConnectedSocket() client: any): Promise<GameResponse> {
    const createGameResponse = (ok: boolean, statusText: string) => ({
      ok,
      status: '',
      statusText,
    });

    try {
      const isInLiveGame = await this.gameService.isUserInLiveGame(client.data.user.id);
      if (isInLiveGame) {
        return createGameResponse(false, 'User already in a Live Game');
      }

      const lowestPositionGame = await this.gameService.getLowestPositionGame();

      if (lowestPositionGame && !lowestPositionGame.full) {
        let updatedGame = await this.gameService.addUsertoGame(client.data.user, lowestPositionGame.id);
        if (updatedGame) {
          await this.gameService.updateUserPlaying(client.data.user, true);
          await client.join(updatedGame.id);
          this.server.to(updatedGame.id).emit('joinedGame', updatedGame);
          this.startGameLoop(updatedGame.id);
          return createGameResponse(true, '');
        } else {
          return createGameResponse(false, "Error in <joinSocketToGame>: This User can't be added to the game.");
        }
      }

      // If no available game or it's full, create a new one
      const nextPosition = await this.gameService.getNextPosition();
      const newGame = await this.gameService.createGame(client.data.user, nextPosition, false, 'PUBLIC');
      if (newGame) {
        await this.gameService.updateUserPlaying(client.data.user, true);
        this.userGateway.playersStatusUpdate();
        await client.join(newGame.id);
        this.server.to(newGame.id).emit('joinedGame', newGame);
        return createGameResponse(true, '');
      } else {
        return createGameResponse(false, 'Error in creating the game in the DB.');
      }
    } catch (error) {
      return createGameResponse(false, `Error with the database`);
    }
  }

  @SubscribeMessage('startPowerUp')
  async startPowerUp(@ConnectedSocket() client: any, @MessageBody() data: any) {
    const roomId = data.room;
    const gameState = this.gameStates.get(roomId);
    if (!gameState) {
      // Handle the case where the game state does not exist for the room
      return;
    }
    gameState.updateSpeedMode(data.isSpeed);
    if (roomId) {
      const game = await this.prisma.game.update({
        where: { id: roomId },
        data: { mode: 'SPEED' },
      });
      this.server.to(game.id).emit('updateMode', game);
    }
  }

  @SubscribeMessage('paddleMove')
  makeMoveLeftDw(@MessageBody() data: any, @ConnectedSocket() client: any): void {
    const roomId = data.room;
    const gameState = this.gameStates.get(roomId);
    if (!gameState) {
      // Handle the case where the game state does not exist for the room
      return;
    }

    gameState.updatePaddlePosition(data.yPadR, data.yPadL);
    // client.to(roomId).emit('move', data);
  }
}
