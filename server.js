const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");

const Message = require("./models/Message");

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(cors());
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// MongoDB
mongoose.connect("mongodb://127.0.0.1:27017/chat-app")
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.log(err));

// Users in room
const usersInRoom = {};

const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // JOIN ROOM
  socket.on("joinRoom", async ({ username, room }) => {
    socket.join(room);
    socket.room = room;
    socket.username = username;

    if (!usersInRoom[room]) usersInRoom[room] = [];
    usersInRoom[room].push(username);

    io.to(room).emit("roomUsers", usersInRoom[room]);

    const messages = await Message.find({ room });

    socket.emit("loadMessages", messages);
  });

  // SEND MESSAGE
  socket.on("sendMessage", async (data) => {
    if (!socket.room) return;

    const newMessage = new Message({
      user: data.user,
      text: data.text,
      room: socket.room
    });

    await newMessage.save();

    io.to(socket.room).emit("receiveMessage", newMessage);
  });

  // TYPING
  socket.on("typing", (username) => {
    if (!socket.room) return;
    socket.to(socket.room).emit("typing", username);
  });

  socket.on("stopTyping", () => {
    if (!socket.room) return;
    socket.to(socket.room).emit("stopTyping");
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    const room = socket.room;
    const username = socket.username;

    if (room && usersInRoom[room]) {
      usersInRoom[room] = usersInRoom[room].filter(u => u !== username);
      io.to(room).emit("roomUsers", usersInRoom[room]);
    }

    console.log("User disconnected:", socket.id);
  });
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});