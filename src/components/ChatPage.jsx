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
import { Menu, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { BsThreeDotsVertical } from 'react-icons/bs'; 

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
      client.send(
        `/app/userJoin/${roomId}`,
        {},
        JSON.stringify(currentUser) // Ensure no extra quotes
      );
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
    <div className="relative min-h-screen flex justify-center items-center bg-gray-100 py-6">
      {/* Main Chat Window Container */}
      <div className="relative w-full max-w-4xl bg-white shadow-lg rounded-lg overflow-hidden">
  
        {/* Header */}
        <header className="border-b dark:border-gray-700 w-full bg-white py-4 px-6 shadow flex justify-between items-center">
          <div>
            <h1 className="text-xl font-semibold text-gray-800">
              Room: <span className="text-blue-500">{roomId}</span> |
              Topic: <span className="text-blue-500">{room?.roomTopic || "General"}</span>
            </h1>
          </div>
  
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold text-gray-800">
              User: <span className="text-green-500">
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
                className="bg-red-600 hover:bg-red-800 px-3 py-2 rounded-full"
              >
                Delete Room
              </button>
            )}
  
            <button
              onClick={handleLogout}
              className="bg-purple-600 hover:bg-purple-800 px-3 py-2 rounded-full"
            >
              Leave Room
            </button>
          </div>
        </header>
  
        {/* Main Chat Content */}
        <div className="flex flex-col md:flex-row gap-6 px-6 py-4 ">
  
          {/* Chat Messages */}
          <div className="w-full md:w-3/4 h-[400px] bg-gray-50 rounded-lg overflow-y-auto p-4 shadow-sm">
            <div className="space-y-4">
              {messages.map((message, index) => (
                
                <div
                
                  key={index}
                  className={`flex ${message.sender === currentUser ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`relative p-3 rounded-lg max-w-xs md:max-w-md ${message.sender === currentUser ? "bg-green-800" : "bg-gray-800"}`}
                  >
                    {room?.adminUser === currentUser && !message.deleted &&(
                      <button
                        onClick={() => deleteMessage(message.id)}
                        className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-700 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        title="Delete message"
                      >
                        ×
                      </button>
                    )}
                    <div className="flex gap-3">
                    {!message.deleted && (
                      <img
                        className="h-10 w-10 rounded-full"
                        src={`https://avatar.iran.liara.run/public/?username=${message.sender}`}
                        alt={message.sender}
                      />
                      )}
                      <div>
                        {message.deleted ? (
                          <p className="text-gray-400 italic">This message was deleted by an admin.</p>
                        ) : (
                          <>
                            <p className="font-bold text-sm flex items-center gap-1 text-white">
                              {message.sender}
                              {room?.adminUser === message.sender && (
                                <span className="text-xs bg-blue-500 px-1 rounded">Admin</span>
                              )}
                            </p>
                            {/* Step 3: Check if message is deleted and show placeholder */}

                            <p className="text-white">{message.content}</p>
                          </>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {timeAgo(message.timeStamp)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
  
          {/* Online Users Sidebar */}
          <div className="w-full md:w-1/4 bg-blue-100 rounded-lg p-4 shadow-sm">
            <h3 className="font-bold text-center mb-2 text-gray-800">
              Online Users ({[...new Set(onlineUsers.map(u => u.replace(/"/g, '')))].length})
            </h3>
            <ul className="space-y-2">
              {[...new Set(onlineUsers.map(u => u.replace(/"/g, '')))]
                .map((user) => (
                  <li key={user} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="h-2 w-2 bg-green-500 rounded-full mr-2"></span>
                      <span className="truncate text-gray-800">
                        {user}
                        {room?.adminUser?.replace(/"/g, '') === user && (
                          <span className="ml-1 text-xs bg-blue-500 px-1 rounded">Admin</span>
                        )}
                      </span>
                    {room?.adminUser === currentUser && room?.adminUser !== user && (
                      <button
                      onClick={() => removeUser(user)}
                      className="text-xs bg-red-500 hover:bg-red-700 px-1 rounded"
                      >
                        Remove
                      </button>
                    )}
                    </div>    
                  </li>
                ))}
            </ul>
          </div>
  
        </div>
  
        {/* Message Input */}
        <div className="w-full bg-white rounded-lg p-4 mt-4 mb-6 shadow-lg">
          <div className="flex items-center bg-gray-900 rounded-full px-4 py-2 max-w-2xl mx-auto">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              type="text"
              placeholder="Type your message..."
              className="flex-1 bg-transparent border-none focus:outline-none text-green px-3 py-2"
            />
            <div className="flex gap-2">
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
    </div>
  );
};

export default ChatPage;