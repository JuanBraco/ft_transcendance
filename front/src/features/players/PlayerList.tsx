/* eslint-disable @typescript-eslint/no-explicit-any */
import "./PlayerList.css";
import { useContext, useState, useEffect } from "react";
import { User } from "../../model/User";
import { Avatar, Divider, List, ListItem, ListItemAvatar, ListItemText, ListSubheader, Paper, Typography } from "@mui/material";
import { ChatResponse } from "../../model/ChatResponse";
import { UserContext } from "../../App";
import { useThrowAsyncError } from "../../utils/useThrowAsyncError";
import UserInfoDialog from "./dialog/UserInfoDialog";
import axiosInstance from "../../utils/axiosInstance";

function PlayerList() {
  const { gameSocket, chatSocket, allPlayers, blackList } = useContext(UserContext);
  const throwAsyncError = useThrowAsyncError();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [gameInvitationError, setGameInvitationError] = useState<string>("");
  const [display, setDisplay] = useState<boolean>(false);
  const [friendsList, setFriendsList] = useState<User[]>([]);

  async function getAllFriends() {
    try {
      const friendsList = await axiosInstance.get("/user/allFriends");
      return friendsList;
    } catch (error) {
      throwAsyncError(error);
    }
  }

  useEffect(() => {
    getAllFriends()
      .then((info) => {
        setFriendsList(info!.data.friends);
      })
      .catch((error) => throwAsyncError(error));
  }, []);

  /*
   ** Handle game invite
   ** ********************************************************************************
   */
  useEffect(() => {
    try {
      if (gameSocket) {
        gameSocket.on("createdGame", onCreatedGame);
      }
    } catch (error) {
      throwAsyncError(error);
    }

    return () => {
      try {
        gameSocket?.off("createdGame", onCreatedGame);
      } catch (error) {
        throwAsyncError(error);
      }
    };
  }, [gameSocket, selectedUser]);

  function onCreatedGame(game: any) {
    if (selectedUser) {
      try {
        chatSocket?.emit("inviteGame", { player: selectedUser, gameId: game.id }, (response: ChatResponse) => {
          if (!response.ok) {
            setGameInvitationError(response.statusText);
          }
        });
      } catch (error) {
        throwAsyncError(error);
      }
    }
  }

  useEffect(() => {
    setGameInvitationError("");
  }, [setSelectedUser]);
  /*
   ** ********************************************************************************
   */

  const openUserDialog = async (user: User) => {
    setDisplay(true); // TEST LENA
    const tmpUser = await axiosInstance.post("user/userById", user);
    setSelectedUser(tmpUser.data);
  };

  const closeUserDialog = () => {
    setDisplay(false);
    setSelectedUser(null);
  };

  function userIsFriend(user: User | null, friends: User[]) {
    if (friends && user && friends.some((friend) => friend.id === user.id)) {
      return true;
    }
    return false;
  }

  function userIsBlocked(user: User | null, blocked: User[]) {
    if (blocked && user && blocked.some((player) => player.id === user.id)) {
      return true;
    }
    return false;
  }

  function userIsOther(user: User, friends: User[], blocked: User[]) {
    if (friends.some((player) => player.id === user.id) || blocked.some((player) => player.id === user.id)) {
      return false;
    }
    return true;
  }

  /*
   ** Handle friends and blocked players update
   ** ********************************************************************************
   */
  useEffect(() => {
    if (chatSocket) {
      try {
        // subscribe to chat events
        chatSocket.on("updateOnFriend", updateFriendsList);
      } catch (error) {
        throwAsyncError(error);
      }
    }

    return () => {
      try {
        chatSocket?.off("updateOnFriend", updateFriendsList);
      } catch (error) {
        throwAsyncError(error);
      }
    };
  }, [chatSocket]);

  async function getFriendsList() {
    try {
      const friendsList = await axiosInstance.get("/user/allFriends");
      return friendsList;
    } catch (error) {
      throwAsyncError(error);
    }
  }

  function updateFriendsList() {
    getFriendsList()
      .then((info) => {
        setFriendsList(info!.data.friends);
      })
      .catch((error) => throwAsyncError(error));
  }
  /*
   ** ********************************************************************************
   */

  const generateUserList = (filteredUsers: User[]) => {
    return filteredUsers.map((filteredUser) => (
      <ListItem key={filteredUser.id} button onClick={() => openUserDialog(filteredUser)} className="PlayerList__item">
        <ListItemAvatar>
          <Avatar src={filteredUser.imageUrl} alt={filteredUser.nickname} className="PlayerList__avatar" />
        </ListItemAvatar>
        <ListItemText primary={filteredUser.nickname} primaryTypographyProps={{ className: "PlayerList__text" }} />
        <div className={`PlayerList__status ${filteredUser.online ? (filteredUser.isPlaying ? "playing" : "online") : "offline"}`} />
      </ListItem>
    ));
  };

  return (
    <Paper elevation={3} sx={{ marginTop: 2, overflowY: "auto", height: "calc(100vh - 120px)", border: `1px solid #366873` }}>
      {gameInvitationError && <Typography color="error">{gameInvitationError}</Typography>}
      <Typography className="PlayerList__title" sx={{ color: "#015958", fontWeight: "bold", fontSize: "13px" }}>
        Players
      </Typography>
      <List className="PlayerList__list">
        <ListSubheader sx={{ maxWidth: 200, color: "black" }}>Friends</ListSubheader>
        {generateUserList(allPlayers.filter((user) => userIsFriend(user, friendsList)))}
        <Divider />
        <ListSubheader sx={{ maxWidth: 200, color: "black" }}>Other players</ListSubheader>
        {generateUserList(allPlayers.filter((user) => userIsOther(user, friendsList, blackList)))}
        <Divider />
        <ListSubheader sx={{ maxWidth: 200, color: "black" }}>Blocked players</ListSubheader>
        {generateUserList(allPlayers.filter((user) => userIsBlocked(user, blackList)))}
      </List>

      {display && (
        <UserInfoDialog
          selectedUser={selectedUser}
          closeUserDialog={closeUserDialog}
          isFriends={userIsFriend(selectedUser, friendsList)}
          isBlocked={userIsBlocked(selectedUser, blackList)}
        />
      )}
    </Paper>
  );
}

export default PlayerList;
