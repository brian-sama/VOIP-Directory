import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import AppNavbar from './components/layout/Navbar';
import LoginPage from './components/pages/LoginPage';
import DashboardPage from './components/pages/DashboardPage';
import SettingsPage from './components/pages/SettingsPage';
import LogsPage from './components/pages/LogsPage';
import DirectoryPage from './components/pages/DirectoryPage';
import PrivateRoute from './components/routing/PrivateRoute';
import './App.css';

function App() {
  return (
    <Router>
      <AppNavbar />
      <main className="py-3">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<PrivateRoute />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/directory" element={<DirectoryPage />} />
          </Route>
          <Route path="/logs" element={<PrivateRoute />}>
            <Route path="/logs" element={<LogsPage />} />
          </Route>
          <Route path="/admin" element={<PrivateRoute />}>
            <Route path="/admin" element={<AdminPage />} />
          </Route>
          <Route path="/settings" element={<PrivateRoute />}>
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </main>
    </Router>
  );
}

export default App;
