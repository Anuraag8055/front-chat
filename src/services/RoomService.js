import { httpClient } from "../config/AxiosHelper";

export const createRoomApi = async (roomDetail) => {
  const response = await httpClient.post(
      `/api/v1/rooms`,
      roomDetail, // Send the full object { roomId, userName, roomTopic }
      {
          headers: {
              "Content-Type": "application/json", // Explicitly set JSON
          },
      }
  );
  return response.data;
};

export const joinChatApi = async (roomId) => {
  const response = await httpClient.get(`/api/v1/rooms/${roomId}`);
  return response.data;
};

export const getMessagess = async (roomId, size = 50, page = 0) => {
  const response = await httpClient.get(
    `/api/v1/rooms/${roomId}/messages?size=${size}&page=${page}`
  );
  return response.data;
};
