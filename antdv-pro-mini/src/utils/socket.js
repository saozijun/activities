import { io } from 'socket.io-client';

const URL = 'http://localhost:3000';
const socket = io(URL, {
  autoConnect: false,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

socket.onAny((event, ...args) => {
  console.log('socket event:', event, args);
});

export default socket; 