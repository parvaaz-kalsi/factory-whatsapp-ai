import { io } from 'socket.io-client';

const backendUrl = import.meta.env.VITE_BACKEND_URL || (window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin);
const socket = io(backendUrl, { autoConnect: true, transports: ['websocket'] });

export default socket;
