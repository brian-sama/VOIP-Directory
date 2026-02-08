import axios from 'axios';

const instance = axios.create({
  // Use relative path for production (IIS proxy) or dynamic hostname for development
  // @ts-ignore
  baseURL: import.meta.env.MODE === 'production' ? '/api' : `http://${window.location.hostname}:5001/api`,
});

export default instance;
