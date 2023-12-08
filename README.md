<h1 align="center">ft_transcendance</h1>

<p align="center">
  <strong>Transcendence is a full-featured multiplayer game site centered around playing ping pong. The application focuses on interactivity and real-time functionality.</strong>
</p>

## About the Project

This project incorporates a chat system and a multiplayer ping pong game, both leveraging real-time communication technologies for immediate, responsive user experiences. The chat system utilizes Server-Sent Events (SSE) for real-time messaging and notifications, while the multiplayer game is powered by Socket.IO, allowing users to interact, chat, and invite each other for a game of ping pong.

### Key Features
- 🏓 **Multiplayer Ping Pong Game:** The centerpiece of the project is a real-time ping pong game that supports multiple users. It's powered by Socket.IO, a popular library for real-time web applications, which ensures quick, responsive gameplay.

- 💬 **Chat System:** Users can interact with each other through a built-in chat system that uses Server-Sent Events (SSE) for real-time messaging. This fosters user interaction and engagement, making the game more than just a game but a social platform.

- 📩 **Invite System:** Users can invite each other to play a game of ping pong, creating a sense of community and competition.

## Project Architecture

This project is based on a multi-service architecture, including a Postgres database, a React.js application for the frontend, a Nest.js application for the backend.

### Services Overview
- 🗄️ **Postgres Database (db service):** This service acts as the central database for the application. All user data, game data, and chat logs are stored here.

- 🌐 **React.js Application (vite service):** This service handles the frontend of the application. It renders the user interface, handles user inputs, and communicates with the backend service.

- 🚀 **Nest.js Application (nest-app service):** This service is the backbone of the application. It manages the business logic, handles database operations, and communicates with the frontend service via API endpoints. It uses Server-Sent Events (SSE) to power the chat system, delivering real-time messaging and notifications. Socket.IO is used for the multiplayer ping pong game, enabling real-time, interactive gameplay.
