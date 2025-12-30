import axios from 'axios';

const instance = axios.create({
  // Dynamically use the current hostname (useful when accessing from other network IPs)
  baseURL: `http://${window.location.hostname}:5001/api`,
});

export default instance;
