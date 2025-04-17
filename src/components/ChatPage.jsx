import React, { useEffect, useRef, useState } from "react";
import { MdAttachFile, MdSend } from "react-icons/md";
import useChatContext from "../context/ChatContext";
import { useNavigate } from "react-router";
import SockJS from "sockjs-client";
import { Stomp } from "@stomp/stompjs";
import toast from "react-hot-toast";
import { baseURL, httpClient } from "../config/AxiosHelper";
import { getMessagess } from "../services/RoomService";
import { timeAgo } from "../config/helper";

const ChatPage = () => {
  const {
    roomId,
    currentUser,
    connected,
    setConnected,
    setRoomId,
    setCurrentUser,
  } = useChatContext();

  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [stompClient, setStompClient] = useState(null);
  const [room, setRoom] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const inputRef = useRef(null);
  const chatBoxRef = useRef(null);

  // Check connection and redirect if not connected
  useEffect(() => {
    if (!connected) {
      navigate("/");
    }
  }, [connected, navigate]);

  // Load messages and room data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [messagesData, roomData] = await Promise.all([
          getMessagess(roomId),
          httpClient.get(`/api/v1/rooms/${roomId}`).then(res => res.data),
        ]);
        setMessages(messagesData);
        setRoom(roomData);
      } catch (error) {
        toast.error("Failed to load room data");
      }
    };

    if (connected) {
      loadData();
    }
  }, [roomId, connected]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTo({
        top: chatBoxRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  // WebSocket connection and subscriptions
  useEffect(() => {
    if (!connected) return;

    const sock = new SockJS(`${baseURL}/chat`);
    const client = Stomp.over(sock);

    client.connect({}, () => {
      setStompClient(client);
      toast.success("Connected to chat");

      // Subscribe to messages
      client.subscribe(`/topic/room/${roomId}`, (message) => {
        const newMessage = JSON.parse(message.body);
        setMessages(prev => [...prev, newMessage]);
      });

      // Subscribe to online users updates
      client.subscribe(`/topic/onlineUsers/${roomId}`, (message) => {
        setOnlineUsers(JSON.parse(message.body));
      });
      client.subscribe(`/topic/roomDeleted/${roomId}`, () => {
        toast.error("This room has been deleted by the admin");
        handleLogout();
        window.location.reload(); // Force refresh
      });
      client.subscribe(`/topic/userRemoved/${roomId}/${currentUser}`, () => {
        toast.error("You have been removed from the room by admin");
        handleLogout();
        window.location.reload();
      });

      // Notify server of user join
      client.send(`/app/userJoin/${roomId}`, {}, JSON.stringify(currentUser));
    });

    return () => {
      if (client && client.connected) {
        client.disconnect();
      }
    };
  }, [roomId, currentUser, connected]);

  const sendMessage = () => {
    if (input.trim() && stompClient && connected) {
      const message = {
        sender: currentUser,
        content: input,
        roomId: roomId,
      };

      stompClient.send(
        `/app/sendMessage/${roomId}`,
        {},
        JSON.stringify(message)
      );
      setInput("");
    }
  };

  const deleteMessage = async (messageId) => {
    try {
      await httpClient.delete(
        `/api/v1/rooms/${roomId}/messages/${messageId}?requestedBy=${currentUser}`
      );
      setMessages(messages.filter(m => m.id !== messageId));
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };
  const removeUser = async (username) => {
    try {
      await httpClient.delete(
        `/api/v1/rooms/${roomId}/users/${username}?requestedBy=${currentUser}`
      );
      toast.success(`${username} removed`);
    } catch (error) {
      toast.error("Failed to remove user");
    }
  };

  const handleLogout = () => {
    if (stompClient) stompClient.disconnect();
    setConnected(false);
    setRoomId("");
    setCurrentUser("");
    navigate("/");
  };

  return (
    <div className="relative h-screen">
      {/* Header */}
      <header className="dark:border-gray-700 fixed w-full dark:bg-gray-900 py-5 shadow flex justify-between items-center px-4 z-20">
        <div>
          <h1 className="text-xl font-semibold">
            Room: <span className="text-blue-300">{roomId}</span> | 
            Topic: <span className="text-blue-300">{room?.roomTopic || "General"}</span>
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">
            User: <span className="text-green-300">
              {currentUser} 
              {room?.adminUser === currentUser && (
                <span className="ml-1 text-xs bg-blue-500 px-2 py-1 rounded-full">Admin</span>
              )}
            </span>
          </h1>
          
          {room?.adminUser === currentUser && (
            <button
              onClick={async () => {
                try {
                  await httpClient.delete(
                    `/api/v1/rooms/${roomId}?requestedBy=${currentUser}`
                  );
                  navigate("/");
                } catch (error) {
                  toast.error("Only admin can delete the room");
                }
              }}
              className="dark:bg-red-600 dark:hover:bg-red-800 px-3 py-2 rounded-full"
            >
              Delete Room
            </button>
          )}
          
          <button
            onClick={handleLogout}
            className="dark:bg-purple-600 dark:hover:bg-purple-800 px-3 py-2 rounded-full"
          >
            Leave Room
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <main
        ref={chatBoxRef}
        className="pt-24 pb-32 px-4 w-full md:w-3/4 lg:w-2/3 mx-auto h-screen overflow-y-auto"
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.sender === currentUser ? "justify-end" : "justify-start"
            } mb-4`}
          >
            <div
              className={`relative p-3 rounded-lg max-w-xs md:max-w-md ${
                message.sender === currentUser
                  ? "bg-green-800"
                  : "bg-gray-800"
              }`}
            >
              {room?.adminUser === currentUser && (
                <button
                  onClick={() => deleteMessage(message.id)}
                  className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  title="Delete message"
                >
                  ×
                </button>
              )}
              <div className="flex gap-3">
                <img
                  className="h-10 w-10 rounded-full"
                  src={`https://avatar.iran.liara.run/public/?username=${message.sender}`}
                  alt={message.sender}
                />
                <div>
                  <p className="font-bold text-sm flex items-center gap-1">
                    {message.sender}
                    {room?.adminUser === message.sender && (
                      <span className="text-xs bg-blue-500 px-1 rounded">Admin</span>
                    )}
                  </p>
                  <p className="text-white">{message.content}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {timeAgo(message.timeStamp)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </main>

      {/* Online Users Sidebar */}
      <div className="fixed right-4 top-24 w-48 bg-gray-800 p-3 rounded-lg shadow-lg z-10">
        <h3 className="font-bold text-center mb-2">
          Online Users ({onlineUsers.length})
        </h3>
        <ul className="space-y-2">
          {onlineUsers.map((user) => (
            <li key={user} className="flex items-center justify-between">
              <div className="flex items-center">
                <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                <span className="truncate">
                  {user}
                  {room?.adminUser === user && (
                    <span className="ml-1 text-xs bg-blue-500 px-1 rounded">Admin</span>
                  )}
                </span>
              </div>
              {room?.adminUser === currentUser && room?.adminUser !== user && (
                <button
                  onClick={() => removeUser(user)}
                  className="text-xs bg-red-500 hover:bg-red-700 px-1 rounded"
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Message Input */}
      <div className="fixed bottom-4 left-0 right-0 px-4">
        <div className="flex items-center bg-gray-900 rounded-full px-4 py-2 max-w-2xl mx-auto">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            type="text"
            placeholder="Type your message..."
            className="flex-1 bg-transparent border-none focus:outline-none text-white px-3 py-2"
          />
          <div className="flex gap-2">
            <button className="p-2 text-gray-400 hover:text-white">
              <MdAttachFile size={20} />
            </button>
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="p-2 bg-green-600 rounded-full hover:bg-green-700 disabled:opacity-50"
            >
              <MdSend size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;